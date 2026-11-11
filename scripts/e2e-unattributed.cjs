// Prova end-to-end del contatore delle richieste non attribuibili a una scheda (service worker).
// Uso: node scripts/e2e-unattributed.cjs <cartella-profilo-temporanea>   (circa 40 s)
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const assert = require('assert');
const EXT = path.resolve(__dirname, '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const KEY = `day:${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const SW = `self.addEventListener('message', async (e) => { for (let i = 0; i < e.data; i++) await fetch('/f?sw' + i); e.source.postMessage('done'); });`;

(async () => {
  const srv = http.createServer((q, r) => {
    if (q.url === '/sw.js') { r.setHeader('content-type', 'text/javascript'); return r.end(SW); }
    r.setHeader('content-type', 'text/html');
    r.end(q.url.startsWith('/f') ? 'y'.repeat(3000) : '<p>pagina</p>');
  }).listen(8800);
  const ctx = await chromium.launchPersistentContext(process.argv[2], { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  await new Promise((r) => setTimeout(r, 2500));
  const p = await ctx.newPage();
  await p.goto('http://localhost:8800/');
  await p.bringToFront();
  // Il service worker del sito fa 5 richieste: il browser non le attribuisce a nessuna scheda (tabId < 0).
  const done = await p.evaluate(async () => {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return new Promise((resolve) => { navigator.serviceWorker.addEventListener('message', () => resolve('done')); (reg.active ?? reg.installing).postMessage(5); });
  });
  assert.strictEqual(done, 'done');
  await wait(22000);
  const e = ((await sw.evaluate(() => chrome.storage.local.get(null)))[KEY] ?? {}).localhost;
  console.log('record:', JSON.stringify(e));
  assert.ok(e && e.ua >= 5 && e.ua <= 7, `richieste non attribuibili contate: ${e?.ua}`); // 5 richieste del worker + il caricamento dello script del worker
  assert.ok(e.ub >= 15000, `byte dichiarati: ${e.ub}`);
  console.log('OK   richieste del service worker (5 + lo script) contate come non attribuibili (>= 15000 byte), non nella stima');
  assert.ok(e.n < 5 + 6 && e.b < 15000, `le richieste del worker non devono entrare in n e b: n=${e.n} b=${e.b}`);
  console.log('OK   non incluse nel conteggio normale (n, b)');
  await ctx.close();
  srv.close();
})().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
