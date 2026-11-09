// Prova end-to-end del conteggio dei messaggi AI con un servizio simulato (Chromium via Playwright).
// Uso: node scripts/e2e-ai.cjs <cartella-profilo-temporanea>   (circa 60 s)
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const assert = require('assert');
const EXT = path.resolve(__dirname, '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const KEY = `day:${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MOCK = { id: 'mock', label: 'Mock', domain: 'localhost', method: 'POST', path: '^/api/chat$' };

(async () => {
  let bodies = 0;
  const srv = http.createServer((q, r) => {
    q.on('data', () => { bodies++; }); // il server riceve il corpo; l'estensione non deve leggerlo
    q.on('end', () => {
      if (q.url === '/api/fail') { r.statusCode = 500; return r.end('x'); }
      r.setHeader('content-type', 'text/html');
      r.end('ok');
    });
  }).listen(8790);
  const ctx = await chromium.launchPersistentContext(process.argv[2], { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  await wait(2500);
  const store = () => sw.evaluate(() => chrome.storage.local.get(null));
  const setSettings = (s) => sw.evaluate((x) => chrome.storage.local.set({ settings: x }), s);
  const ok = (m) => console.log('OK  ', m);

  // 1. Servizio attivo: contano solo i POST riusciti verso l'indirizzo giusto
  await setSettings({ aiServices: { mock: true }, aiExtraAdapters: [MOCK] });
  await wait(1500);
  const p = await ctx.newPage();
  await p.goto('http://localhost:8790/');
  await p.bringToFront();
  const post = (url) => p.evaluate((u) => fetch(u, { method: 'POST', body: 'testo segreto che non deve essere letto' }), url);
  for (let i = 0; i < 4; i++) await post('/api/chat');
  await post('/api/fail');                       // risposta 500: non conta
  await p.evaluate(() => fetch('/api/chat'));    // GET: non conta
  await post('/api/other');                      // altro percorso: non conta
  await wait(22000);
  let e = (await store())[KEY]?.localhost;
  assert.strictEqual(e?.p, 4, `messaggi contati: ${e?.p}`);
  ok('4 messaggi contati; errore 500, GET e altri percorsi ignorati');
  assert.ok(e.msc > 0 && e.msc <= e.ms, `tempo coperto: ${e.msc} / ${e.ms}`);
  ok('tempo coperto dal conteggio registrato (msc <= ms)');

  // 2. Servizio disattivato, poi attivo ma in pausa: nulla viene contato
  await setSettings({ aiServices: {}, aiExtraAdapters: [MOCK] });
  await wait(1500);
  for (let i = 0; i < 3; i++) await post('/api/chat');
  await setSettings({ aiServices: { mock: true }, aiExtraAdapters: [MOCK], paused: true });
  await wait(1500);
  for (let i = 0; i < 3; i++) await post('/api/chat');
  await wait(22000);
  e = (await store())[KEY]?.localhost;
  assert.strictEqual(e.p, 4, `conteggio cambiato: ${e.p}`);
  ok('servizio spento o in pausa: nessun messaggio contato');

  // 3. Eliminazione dei soli conteggi AI
  await setSettings({ aiServices: { mock: true }, aiExtraAdapters: [MOCK] });
  const o = await ctx.newPage();
  await o.goto(`chrome-extension://${id}/options/options.html`);
  await wait(600);
  await o.click('#ai-delete');
  await wait(800);
  const st = await store();
  assert.ok(st[KEY].localhost && st[KEY].localhost.p === undefined && st[KEY].localhost.msc === undefined, JSON.stringify(st[KEY].localhost));
  assert.ok(st[KEY].localhost.n > 0, 'gli altri dati devono restare');
  ok('"Elimina i conteggi AI" rimuove solo p e msc');

  console.log(`Corpi di richiesta ricevuti dal server: ${bodies} (l'estensione non li legge: nessun permesso requestBody)`);
  await ctx.close();
  srv.close();
  console.log('Tutte le prove superate');
})().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
