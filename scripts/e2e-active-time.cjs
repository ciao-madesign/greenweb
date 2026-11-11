// Prova end-to-end del tempo attivo con il service worker che va in sospensione (come nell'uso reale).
// Una pagina ferma, senza richieste, resta in primo piano per ~130 s e il worker viene sospeso due volte: il tempo registrato deve essere ~120 s (l'ultimo salvataggio è all'allarme del secondo minuto).
// Uso: node scripts/e2e-active-time.cjs <cartella-profilo-temporanea>   (circa 2 minuti)
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const assert = require('assert');
const EXT = path.resolve(__dirname, '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const KEY = `day:${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

(async () => {
  const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end('<p>pagina ferma</p>'); }).listen(8795);
  const ctx = await chromium.launchPersistentContext(process.argv[2], { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const t0 = Date.now();
  const T = () => ((Date.now() - t0) / 1000).toFixed(0);
  let closes = 0;
  const track = (w) => w.on('close', () => { closes++; console.log(`${T()} s: service worker sospeso`); });
  ctx.serviceWorkers().forEach(track);
  ctx.on('serviceworker', track);
  const sw0 = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  await wait(2500);
  // Sessione CDP su una pagina dell'estensione: serve a sospendere il service worker come farebbe il browser.
  const id = sw0.url().split('/')[2];
  const ep = await ctx.newPage();
  await ep.goto(`chrome-extension://${id}/options/options.html`);
  const cdp = await ctx.newCDPSession(ep);
  const versions = new Map();
  cdp.on('ServiceWorker.workerVersionUpdated', ({ versions: vs }) => vs.forEach((v) => versions.set(v.versionId, v)));
  await cdp.send('ServiceWorker.enable');
  await wait(800);
  const stopWorker = async () => {
    const running = [...versions.values()].filter((v) => v.scriptURL.includes('background.js') && v.runningStatus === 'running');
    for (const v of running) await cdp.send('ServiceWorker.stopWorker', { versionId: v.versionId }).catch(() => {});
    console.log(`${T()} s: sospensione forzata (${running.length} worker)`);
  };
  const p = await ctx.newPage();
  await p.goto('http://localhost:8795/');
  await p.bringToFront();
  const start = Date.now();
  await wait(25000); await stopWorker();
  await wait(40000); await stopWorker();
  await wait(65000); // dopo il salvataggio dell'allarme del secondo minuto (~120 s)
  const elapsed = (Date.now() - start) / 1000;
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const st = await sw.evaluate(() => chrome.storage.local.get(null));
  const e = st[KEY]?.localhost;
  console.log(`trascorsi ${elapsed.toFixed(0)} s, sospensioni viste: ${closes}, registrato: ${e ? Math.round(e.ms / 1000) : 0} s`);
  assert.ok(e && e.ms >= 105000, `tempo attivo troppo basso: ${e ? Math.round(e.ms / 1000) : 0} s su ${elapsed.toFixed(0)} s`);
  assert.ok(e.ms <= (elapsed + 10) * 1000, 'tempo attivo superiore al tempo trascorso');
  console.log('OK   tempo attivo corretto anche con il service worker in sospensione');
  await ctx.close();
  srv.close();
})().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
