// Vercel serverless funkce: stav nadcházející objednávky z Rohlik.cz.
//
// Rohlík nemá veřejné API a prohlížeč ho z jiné stránky volat nesmí, proto tahle funkce:
//   1) se přihlásí tvým e-mailem a heslem (jen z proměnných prostředí na Vercelu),
//   2) zjistí nadcházející objednávky a u nejbližší živé sledování kurýra,
//   3) vrátí jen to nejnutnější (časy, stav, počet zastávek) – žádnou adresu, telefon ani polohu.
//
// Proměnné prostředí (Vercel → Settings → Environment Variables):
//   ROHLIK_EMAIL     – e-mail k účtu na Rohlik.cz
//   ROHLIK_PASSWORD  – heslo k účtu
//   ROHLIK_KEY       – libovolný tajný řetězec; stránka ho posílá jako ?key=…, bez něj funkce nic nevrátí
//
// Endpointy podle knihovny rohlik-api (https://pypi.org/project/rohlik-api/), jde o neoficiální API.

const BASE = 'https://www.rohlik.cz';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'cs-CZ,cs;q=0.9',
};

// přihlášení držíme v paměti, dokud funkce „žije“ (šetří opakované přihlašování)
let session = null; // { cookie, at }

function cookiesFrom(res) {
  let list = [];
  if (typeof res.headers.getSetCookie === 'function') list = res.headers.getSetCookie();
  else if (res.headers.get('set-cookie')) list = res.headers.get('set-cookie').split(/,(?=\s*[^;,\s]+=)/);
  return list.map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
}

async function login() {
  const email = process.env.ROHLIK_EMAIL, password = process.env.ROHLIK_PASSWORD;
  if (!email || !password) throw Object.assign(new Error('Na Vercelu chybí ROHLIK_EMAIL nebo ROHLIK_PASSWORD'), { code: 500 });
  const r = await fetch(BASE + '/services/frontend-service/login', {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: '' }),
  });
  let j = {};
  try { j = await r.json(); } catch (e) { /* nic */ }
  if (j.status !== 200) {
    const msg = j.status === 401 ? 'Rohlík odmítl přihlášení (zkontroluj e-mail a heslo)' : 'Přihlášení k Rohlíku selhalo (' + (j.status || r.status) + ')';
    throw Object.assign(new Error(msg), { code: 502 });
  }
  session = { cookie: cookiesFrom(r), at: Date.now() };
}

async function api(path) {
  if (!session || Date.now() - session.at > 6 * 3600 * 1000) await login();
  let r = await fetch(BASE + path, { headers: { ...HEADERS, Cookie: session.cookie } });
  if (r.status === 401 || r.status === 403) {
    await login();
    r = await fetch(BASE + path, { headers: { ...HEADERS, Cookie: session.cookie } });
  }
  return r;
}

const ms = (s) => { const t = s ? Date.parse(s) : NaN; return isNaN(t) ? null : t; };

function mapOrder(o) {
  const slot = o.deliverySlot || {};
  const total = (o.priceComposition && o.priceComposition.total) || {};
  return {
    id: o.id,
    since: ms(slot.since),
    till: ms(slot.till),
    slotType: slot.type || null,
    orderTime: ms(o.orderTime),
    items: o.itemsCount != null ? o.itemsCount : null,
    total: total.amount != null ? Number(total.amount) : null,
    currency: total.currency || null,
  };
}

function mapTracking(d) {
  const slot = d.deliverySlot || {}, early = d.earlyDelivery || {}, p = d.progress || null, c = d.courier || {};
  return {
    orderId: d.orderId,
    since: ms(slot.since),
    till: ms(slot.till),
    earlyRequested: !!early.requested,
    earlyFrom: ms(early.allowedFrom),
    status: p ? p.deliveryStatus || null : null,
    eta: p ? ms(p.estimatedArrival) : null,
    stopsBefore: p && p.stopsBefore != null ? p.stopsBefore : null,
    generatedAt: p ? ms(p.generatedAt) : null,
    // jen křestní jméno kurýra, jak ho ukazuje i aplikace Rohlíku
    courier: c.displayName ? String(c.displayName).split(' ')[0] : null,
  };
}

// odhad příjezdu (stejné pravidlo jako knihovna): dokud je objednávka ve frontě,
// nikdy dřív než začátek okna (nebo povolené dřívější doručení)
function resolveEta(order, tr) {
  if (tr && tr.eta) {
    const floor = tr.earlyRequested && tr.earlyFrom ? tr.earlyFrom : (tr.since || order.since);
    if (tr.status === 'IN_QUEUE' && floor && tr.eta < floor) return { eta: floor, source: 'tracking', capped: true };
    return { eta: tr.eta, source: 'tracking', capped: false };
  }
  return { eta: order.since || null, source: order.since ? 'slot' : null, capped: false };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const key = process.env.ROHLIK_KEY;
  if (!key || String(req.query.key || '') !== key) {
    res.status(403).json({ ok: false, error: key ? 'Neplatný klíč' : 'Na Vercelu chybí ROHLIK_KEY' });
    return;
  }

  try {
    const r = await api('/api/v3/orders/upcoming');
    if (!r.ok) throw Object.assign(new Error('Rohlík vrátil chybu ' + r.status), { code: 502 });
    const raw = await r.json();
    const orders = (Array.isArray(raw) ? raw : []).filter((o) => o && o.id != null).map(mapOrder)
      .sort((a, b) => (a.since == null) - (b.since == null) || (a.since || 0) - (b.since || 0));

    let tracking = null;
    const first = orders[0];
    // živé sledování má smysl až v den doručení (pár hodin před oknem)
    if (first && (!first.since || first.since - Date.now() < 5 * 3600 * 1000)) {
      const t = await api('/api/v2/orders/' + encodeURIComponent(first.id) + '/delivery-tracking');
      if (t.ok) {
        const d = await t.json().catch(() => null);
        if (d && d.orderId === first.id) tracking = mapTracking(d);
      }
    }
    const eta = first ? resolveEta(first, tracking) : null;
    res.status(200).json({ ok: true, now: Date.now(), orders, tracking, eta });
  } catch (e) {
    if (e.code === 502) session = null;
    res.status(e.code || 502).json({ ok: false, error: e.message || String(e) });
  }
};
