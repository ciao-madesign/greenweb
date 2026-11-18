// Prova end-to-end dell'esportazione del rapporto delle stime (CSV e JSON).
// Uso: node scripts/e2e-report.cjs <cartella-profilo-temporanea>   (circa 15 s)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const EXT = path.resolve(__dirname, '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const KEY = `day:${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

(async () => {
  const ctx = await chromium.launchPersistentContext(process.argv[2], { channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  const id = sw.url().split('/')[2];
  await wait(2500);
  await sw.evaluate((k) => chrome.storage.local.set({ [k]: { 'youtube.com': { n: 100, b: 5e6, nu: 40, ms: 900000 }, 'ansa.it': { n: 500, b: 7e6, nu: 150, ms: 120000 } }, settings: { profile: 'it', device: 'laptop' } }), KEY);
  const p = await ctx.newPage();
  await p.goto(`chrome-extension://${id}/options/options.html`);
  await wait(800);
  const get = async (btn) => { const [dl] = await Promise.all([p.waitForEvent('download'), p.click(btn)]); return [dl.suggestedFilename(), fs.readFileSync(await dl.path(), 'utf8')]; };
  const [jn, js] = await get('#export-report-json');
  const rep = JSON.parse(js);
  assert.strictEqual(jn, 'greenweb-report.json');
  assert.strictEqual(rep.meta.schema, 'digital-footprint-counter/report/1');
  assert.strictEqual(rep.rows.length, 2);
  assert.ok(rep.meta.scope.excluded.some((x) => x.includes('embodied')) && Object.keys(rep.meta.sources).length > 3);
  console.log('OK   rapporto JSON: righe, ambito, fonti', Object.keys(rep.meta.sources).length);
  const [cn, cs] = await get('#export-report-csv');
  const lines = cs.trim().split('\n');
  assert.strictEqual(cn, 'greenweb-report.csv');
  assert.strictEqual(lines.length, 3);
  assert.ok(lines[0].startsWith('day,domain,category,functional_unit'));
  console.log('OK   rapporto CSV:', lines.length - 1, 'righe,', lines[0].split(',').length, 'colonne');
  await ctx.close();
})().catch((e) => { console.error('FALLITO:', e.message); process.exit(1); });
