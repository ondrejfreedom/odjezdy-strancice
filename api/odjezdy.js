// Vercel serverless funkce: přeposílá dotaz na Golemio a přidá API klíč z proměnné prostředí.
// Díky tomu klíč není vidět v prohlížeči a neřešíš CORS.
// Nastav ve Vercelu: Settings → Environment Variables → GOLEMIO_TOKEN = <tvůj klíč>

const ALLOWED = ['names', 'ids', 'minutesBefore', 'minutesAfter', 'limit', 'mode'];

module.exports = async function handler(req, res) {
  const token = process.env.GOLEMIO_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'Chybí proměnná prostředí GOLEMIO_TOKEN' });
    return;
  }
  // detail spoje (výchozí stanice, příjezd do Prahy)
  if (req.query.trip) {
    try {
      const r = await fetch('https://api.golemio.cz/v2/gtfs/trips/' + encodeURIComponent(String(req.query.trip)) +
        '?includeStopTimes=true&includeStops=true', { headers: { 'X-Access-Token': token, Accept: 'application/json' } });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(r.status).send(await r.text());
    } catch (e) {
      res.status(502).json({ error: 'Golemio nedostupné', detail: String(e) });
    }
    return;
  }

  const qs = new URLSearchParams();
  for (const k of ALLOWED) {
    if (req.query[k] != null) qs.set(k, String(req.query[k]));
  }
  if (!qs.has('names') && !qs.has('ids')) qs.set('names', 'Strančice');

  try {
    const r = await fetch('https://api.golemio.cz/v2/pid/departureboards?' + qs.toString(), {
      headers: { 'X-Access-Token': token, Accept: 'application/json' },
    });
    const body = await r.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(r.status).send(body);
  } catch (e) {
    res.status(502).json({ error: 'Golemio nedostupné', detail: String(e) });
  }
};
