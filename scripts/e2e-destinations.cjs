// Prova end-to-end di Destination Control (Chromium via Playwright).
// Uso: node scripts/e2e-destinations.cjs <cartella-profilo-temporanea>   (circa 80 s)
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const assert = require('assert');
const EXT = path.resolve(__dirname, '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const KEY = `dest:${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

(async () => {
  const srv = http.createServer((q, r) => { q.resume(); q.on('end', () => { r.setHeader('content-type', 'text/html'); r.end('ok'); }); }).listen(8781);
  const ctx = await chromium.launchPersistentContext(process.argv[2], { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  await wait(2500);
  const store = () => sw.evaluate(() => chrome.storage.local.get(null));
  const setSettings = (s) => sw.evaluate((x) => chrome.storage.local.set({ settings: x }), s);
  const traffic = async (host, tag) => {
    const p = await ctx.newPage();
    await p.goto(`http://${host}:8781/`);
    await p.bringToFront();
    await p.evaluate(async (t) => { for (let i = 0; i < 4; i++) await fetch(`/f?token=${t}${i}`); }, tag);
    return p;
  };
  const ok = (n) => console.log('OK  ', n);

  // 1. Spento di default: nulla registrato
  const p1 = await traffic('localhost', 'SEGRETO');
  await wait(22000);
  assert.ok(!(await store())[KEY], 'registrato con il modulo spento');
  ok('modulo spento: nessuna destinazione registrata');

  // 2. Attivo: dominio, IP e contatori; mai URL o parametri
  await setSettings({ destinations: true });
  await wait(1500);
  await p1.evaluate(async () => { for (let i = 0; i < 4; i++) await fetch(`/g?token=SEGRETO${i}`); });
  await wait(22000);
  let all = await store();
  const rec = all[KEY]?.localhost;
  assert.ok(rec && rec.n >= 4, `destinazione non registrata: ${JSON.stringify(all[KEY])}`);
  const ips = Object.keys(rec.ips);
  console.log('     IP osservati da Chromium:', ips.join(', ') || '(nessuno)');
  assert.ok(ips.length > 0, 'IP non esposto');
  assert.ok(!JSON.stringify(all).includes('SEGRETO'), 'parametri della richiesta salvati');
  ok('modulo attivo: dominio, IP e contatori; nessun URL o parametro');

  // 3. Sito escluso: mai registrato
  await setSettings({ destinations: true, excluded: ['127.0.0.1'] });
  await wait(1500);
  const p2 = await traffic('127.0.0.1', 'X');
  await wait(22000);
  all = await store();
  assert.ok(!all[KEY]?.['127.0.0.1'], 'sito escluso registrato');
  ok('sito escluso mai registrato');
  await p2.close();

  // 4. Dashboard: pannello visibile e senza errori
  const errors = [];
  const dash = await ctx.newPage();
  dash.on('pageerror', (e) => errors.push(e.message));
  dash.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await dash.goto(`chrome-extension://${id}/dashboard/dashboard.html`);
  await wait(1500);
  const text = await dash.locator('#dest').innerText();
  assert.ok(await dash.locator('#dest').isVisible(), 'pannello non visibile');
  assert.ok(/localhost/.test(text), `destinazione assente dal pannello: ${text}`);
  assert.deepStrictEqual(errors, [], `errori in dashboard: ${errors}`);
  ok('dashboard: pannello visibile, nessun errore');
  console.log(text.split('\n').slice(0, 14).join(' | '));

  // 5. Eliminazione dei dati: il registro sparisce
  const opt = await ctx.newPage();
  opt.on('dialog', (dl) => dl.accept());
  await opt.goto(`chrome-extension://${id}/options/options.html`);
  await opt.locator('#delete').click();
  await wait(1500);
  assert.ok(!Object.keys(await store()).some((k) => k.startsWith('dest:')), 'registro non eliminato');
  ok('"Elimina tutti i dati" cancella anche il registro destinazioni');

  // 6. Disattivazione: ripristino del comportamento ordinario
  await setSettings({ destinations: false });
  await wait(1500);
  await p1.evaluate(async () => { for (let i = 0; i < 3; i++) await fetch(`/h?${i}`); });
  await wait(22000);
  assert.ok(!Object.keys(await store()).some((k) => k.startsWith('dest:')), 'registrato dopo la disattivazione');
  ok('disattivato: nessuna nuova registrazione');

  await ctx.close(); srv.close();
  console.log('TUTTO OK');
})().catch((e) => { console.error('ERRORE', e.message); process.exit(1); });
