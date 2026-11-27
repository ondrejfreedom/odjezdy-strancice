# Odjezdy Strančice → Praha

Jedna HTML stránka pro starý mobil v předsíni. Ukazuje nejbližší vlak do Prahy (pravidelný odjezd, zpoždění, skutečný odjezd, odpočet, kde vlak naposledy byl, jestli vyjíždí ze Strančic) a pod ním další vlaky.

**Data:** Golemio API (PID). Do něj tečou online polohy a zpoždění vlaků od Správy železnic. Potřebuješ zdarma API klíč: https://api.golemio.cz/api-keys/

## Možnost A – Vercel (doporučeno, klíč zůstane na serveru)
1. Nahraj tuhle složku do nového repa na GitHubu (`index.html`, `api/odjezdy.js`).
2. Na vercel.com: Add New → Project → vyber repo → Deploy (nic nastavovat netřeba).
3. Settings → Environment Variables: `GOLEMIO_TOKEN` = tvůj klíč → Redeploy.
4. Na mobilu otevři `https://<projekt>.vercel.app`.

## Možnost B – úplně bez serveru
Otevři `index.html` kdekoli (GitHub Pages, nebo jen soubor v telefonu), klepni na **Nastavení** a vlož API klíč. Klíč se uloží v prohlížeči.
Jde to i přes odkaz `index.html?token=TVUJ_KLIC` (uloží se a z adresy zmizí).

## Instalace jako aplikace (ikona, celá obrazovka)
1. Otevři stránku na https adrese (GitHub Pages / Vercel) s klíčem: `https://<adresa>/?token=TVUJ_KLIC` – klíč se uloží a z adresy zmizí.
2. Chrome → menu ⋮ → **Instalovat aplikaci** / **Přidat na plochu**.
3. Spouštěj ikonou „Vlak Praha“ – otevře se přes celou obrazovku bez adresního řádku.

Na lokálním souboru instalace nefunguje; tam použij tlačítko **Celá obrazovka** dole (nebo klepni na hodiny).

## Počasí (přejeď doleva)
Data z Open-Meteo (zdarma, bez klíče). Aktuální teplota a pocitová, animace podle počasí, souhrn srážek na příštích 6 h (nebo do půlnoci), graf na 12 h, záchytné body ráno / poledne / podvečer / večer a nejnižší teplota. Na hlavní stránce je nahoře krátký souhrn – klepnutím otevře počasí. Po 3 minutách bez dotyku se stránka vrátí na odjezdy. Poloha jde změnit v Nastavení.

## Kalendář (třetí obrazovka)
Den v týdnu, datum, příštích 7 dní a odpočet dní do nadcházejících událostí. Události (název, datum, ikona, volitelně „každý rok“) se přidávají tlačítkem „Upravit události“ přímo na obrazovce a ukládají se jen v daném telefonu.

## Rohlík (čtvrtá obrazovka)
Kdy dorazí nákup z Rohlik.cz: časové okno, po převzetí kurýrem přesný odhad příjezdu, počet zastávek před tebou. Na odjezdech a počasí je krátký zelený řádek, pokud je nějaká objednávka.

Rohlík nejde číst přímo z prohlížeče, proto je potřeba malá funkce `api/rohlik.js` na Vercelu (zdarma):
1. vercel.com → Add New → Project → importuj tento repozitář → Deploy.
2. Settings → Environment Variables: `ROHLIK_EMAIL`, `ROHLIK_PASSWORD` (přihlášení k Rohlíku) a `ROHLIK_KEY` (libovolný tajný řetězec) → Redeploy.
3. V aplikaci na obrazovce Rohlík vyplň adresu projektu (`https://…vercel.app`) a klíč, nebo otevři odkaz `…/odjezdy-strancice/?rohlik=https://…vercel.app&rohlikKey=KLÍČ`.

Dotazování: bez objednávky 1× za hodinu, hodinu před oknem po 10 min, v okně po 3 min, když kurýr jede po 2 min. Funkce vrací jen časy a stav, žádnou adresu ani telefon. API Rohlíku je neoficiální (podle knihovny rohlik-api), může se kdykoli změnit.

## Ovládání
- Samo se obnovuje: každých 30 s (méně než 10 min do odjezdu), každou minutu (10–30 min), každých 5 min (víc než 30 min). Když vlak odjede, data se obnoví hned.
- Ruční obnovení: táhni stránku dolů, nebo klepni na „aktualizováno…“ vpravo nahoře.
- V Nastavení můžeš zadat čas cesty na nádraží → ukáže „Vyraž za X min“.

## Tipy pro mobil v předsíni
- Android: Nastavení → Displej → Vypnutí obrazovky na maximum, nebo Možnosti pro vývojáře → „Nevypínat obrazovku při nabíjení“.
- V Chrome: menu → „Přidat na plochu“ → otevře se bez adresního řádku.
- Hodiny v telefonu nech na automatickém čase (odpočet z nich počítá).
