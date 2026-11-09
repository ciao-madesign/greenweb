// Prova end-to-end dei controlli di privacy (Chromium via Playwright).
// Uso: node scripts/e2e-privacy.cjs <cartella-profilo-temporanea>   (circa 90 s)
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const assert = require('assert');
const EXT = path.resolve(__dirname, '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const key = (d = new Date()) => `day:${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return key(d); };

(async () => {
  const srv = http.createServer((q, r) => {
    q.resume();
    q.on('end', () => { r.setHeader('content-type', 'text/html'); r.end(q.url.startsWith('/f') ? 'y'.repeat(3000) : 'ok'); });
  }).listen(8780);
  const ctx = await chromium.launchPersistentContext(process.argv[2], { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  await wait(2500);
  const store = () => sw.evaluate(() => chrome.storage.local.get(null));
  const setSettings = (s) => sw.evaluate((x) => chrome.storage.local.set({ settings: x }), s);
  const badge = () => sw.evaluate(() => chrome.action.getBadgeText({}));
  const traffic = async (host) => {
    const p = await ctx.newPage();
    await p.goto(`http://${host}:8780/`);
    await p.bringToFront();
    await p.evaluate(async () => { for (let i = 0; i < 5; i++) await fetch(`/f?${i}`); });
    return p;
  };
  const ok = (name) => console.log('OK  ', name);

  // 1. Registrazione normale
  const p = await traffic('localhost');
  await wait(22000);
  let day = (await store())[key()] ?? {};
  assert.ok(day.localhost && day.localhost.b >= 15000 && day.localhost.n >= 5, `traffico non registrato: ${JSON.stringify(day.localhost)}`);
  ok('traffico registrato normalmente');

  // 2. Sito escluso: mai registrato
  await setSettings({ excluded: ['127.0.0.1'] });
  await wait(1500);
  const q = await traffic('127.0.0.1');
  await wait(22000);
  day = (await store())[key()] ?? {};
  assert.ok(!day['127.0.0.1'], 'sito escluso registrato');
  ok('sito escluso mai registrato');
  await q.close();

  // 3. Pausa
  await setSettings({ paused: true });
  await wait(1500);
  assert.strictEqual(await badge(), 'II');
  ok('badge "II" in pausa');
  await wait(22000); // i dati accumulati prima della pausa vengono salvati: poi lo stato non deve più cambiare
  const snap = JSON.stringify((await store())[key()]);
  await p.bringToFront();
  await p.evaluate(async () => { for (let i = 0; i < 8; i++) await fetch(`/f?p${i}`); });
  await wait(22000);
  assert.strictEqual(JSON.stringify((await store())[key()]), snap, 'dati registrati durante la pausa');
  ok('nulla registrato durante la pausa');

  // 4. Esclusione dalle impostazioni: cancella i dati già raccolti
  await setSettings({});
  const o = await ctx.newPage();
  await o.goto(`chrome-extension://${id}/options/options.html`);
  await wait(500);
  await o.fill('#excluded', 'localhost');
  await o.locator('#excluded').dispatchEvent('change');
  await wait(1500);
  const st = await store();
  assert.ok(!(st[key()] ?? {}).localhost, 'dati del sito escluso non cancellati');
  assert.ok(!(st.session?.stats?.all ?? {}).localhost, 'sessione non ripulita');
  ok('aggiungere un sito escluso cancella i dati già raccolti');

  // 5. Esportazione CSV
  await sw.evaluate((k) => chrome.storage.local.set({ [k]: { 'esempio.org': { n: 3, b: 4096, ms: 12000 } } }), key());
  await o.reload();
  await wait(600);
  const [download] = await Promise.all([o.waitForEvent('download'), o.click('#export')]);
  const csv = require('fs').readFileSync(await download.path(), 'utf8');
  assert.ok(csv.startsWith('day,domain,requests,bytes,active_seconds\n'), csv);
  assert.ok(csv.includes('"esempio.org",3,4096,12'), csv);
  ok('esportazione CSV (esattamente ciò che è memorizzato)');

  // 6. Conservazione: 7 giorni
  await sw.evaluate((ks) => chrome.storage.local.set(Object.fromEntries(ks.map((k) => [k, { 'vecchio.org': { n: 1, b: 1, ms: 1 } }]))), [daysAgo(3), daysAgo(20), 'day:2020-01-01']);
  await o.selectOption('#retention', '7');
  await wait(2500);
  const ks = Object.keys(await store()).filter((k) => k.startsWith('day:'));
  assert.ok(ks.includes(daysAgo(3)) && ks.includes(key()), `giorni recenti persi: ${ks}`);
  assert.ok(!ks.includes(daysAgo(20)) && !ks.includes('day:2020-01-01'), `giorni vecchi rimasti: ${ks}`);
  ok('conservazione a 7 giorni: i giorni più vecchi vengono eliminati subito');

  // 7. Cancellazione totale
  o.on('dialog', (d) => d.accept());
  await o.click('#delete');
  await wait(800);
  assert.strictEqual(Object.keys(await store()).filter((k) => k.startsWith('day:') || k === 'session').length, 0);
  ok('"Elimina tutto" rimuove giorni e sessione');

  await ctx.close();
  srv.close();
  console.log('Tutte le prove superate');
})().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
