// Genera le anteprime in docs/screenshots/ con dati dimostrativi (Chromium via Playwright).
// Uso: node scripts/screenshots.cjs <cartella-profilo-temporanea>
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const EXT = path.resolve(__dirname, '..');
const OUT = path.join(EXT, 'docs', 'screenshots');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const TODAY = {
  'youtube.com': [1100, 1.6e9, 48], 'github.com': [300, 40e6, 40], 'chatgpt.com': [180, 14e6, 35],
  'mail.google.com': [260, 22e6, 25], 'instagram.com': [600, 210e6, 20], 'reddit.com': [420, 95e6, 18],
  'ilpost.it': [380, 60e6, 16], 'midjourney.com': [80, 160e6, 12], 'google.com': [140, 9e6, 14], 'wikipedia.org': [90, 12e6, 9],
};
const scaled = (f) => Object.fromEntries(Object.entries(TODAY).map(([h, [n, b, m]]) => [h, { n: Math.round(n * f), b: Math.round(b * f), ms: Math.round(m * f * 60000) }]));
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

(async () => {
  const { badgeValue, classify } = await import(path.join(EXT, 'src/core.js'));
  const eng = await import(path.join(EXT, 'src/engine.js'));
  const coeffs = JSON.parse(fs.readFileSync(path.join(EXT, 'data/coefficients.json')));
  const catalog = JSON.parse(fs.readFileSync(path.join(EXT, 'data/catalog.json')));

  const seed = { settings: { profile: 'it', metric: 'co2e', lang: 'en' }, session: { start: Date.now() - 5 * 3600e3, stats: { all: scaled(0.6) } } };
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    seed[`day:${dayKey(d)}`] = scaled(i === 0 ? 1 : 0.35 + ((i * 37) % 80) / 100);
  }

  const ctx = await chromium.launchPersistentContext(process.argv[2], { channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  await wait(2500);
  const id = sw.url().split('/')[2];
  await sw.evaluate((s) => chrome.storage.local.set(s), seed);
  await wait(1500);

  const shot = async (name, url, opts = {}) => {
    const p = await ctx.newPage();
    await p.emulateMedia({ colorScheme: opts.dark ? 'dark' : 'light' });
    await p.goto(`chrome-extension://${id}/${url}`);
    await wait(700);
    if (opts.prep) await opts.prep(p);
    await p.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: !!opts.full, clip: opts.clip });
    await p.close();
  };

  await shot('welcome', 'welcome/welcome.html', { full: true });
  await shot('dashboard', 'dashboard/dashboard.html', { full: true });
  await shot('dashboard-dark', 'dashboard/dashboard.html', { full: true, dark: true });
  await shot('dashboard-week-water', 'dashboard/dashboard.html', { full: true, prep: async (p) => { await p.click('#period button:nth-child(2)'); await p.click('#metric button:nth-child(2)'); } });
  await shot('methodology', 'methodology/methodology.html', { clip: { x: 0, y: 0, width: 1280, height: 800 } });
  await shot('methodology-coefficients', 'methodology/methodology.html', { prep: async (p) => { await p.locator('#coefficients').scrollIntoViewIfNeeded(); await p.evaluate(() => document.getElementById('coefficients').scrollIntoView()); } });
  await shot('settings', 'options/options.html', { full: true });

  // Immagini per gli store: 1280x800 esatti (scale css), schermata intera senza scorrimento.
  const STORE = path.join(EXT, 'store', 'screenshots');
  fs.mkdirSync(STORE, { recursive: true });
  const storeShot = async (name, url, dark = false, prep) => {
    const p = await ctx.newPage();
    await p.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
    await p.goto(`chrome-extension://${id}/${url}`);
    await wait(700);
    if (prep) await prep(p);
    await p.screenshot({ path: path.join(STORE, `${name}.png`), scale: 'css' });
    await p.close();
  };
  await storeShot('1-dashboard', 'dashboard/dashboard.html');
  await storeShot('2-dashboard-dark', 'dashboard/dashboard.html', true);
  await storeShot('3-welcome', 'welcome/welcome.html');
  await storeShot('4-methodology', 'methodology/methodology.html');
  await storeShot('5-settings', 'options/options.html');
  await ctx.close();

  // Illustrazione della barra degli strumenti: icone e badge reali, calcolati dal motore con tre giornate tipo.
  const profile = eng.resolveProfile(coeffs, {});
  const wh = { green: 60, yellow: 170, red: 520 };
  const cards = Object.entries(wh).map(([lvl, w]) => {
    const co2 = eng.convert({ min: w, mid: w, max: w }, profile, coeffs).co2_g.mid;
    const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(EXT, `icons/leaf-${lvl}-48.png`)).toString('base64');
    const color = { green: '#2e7d32', yellow: '#f9a825', red: '#c62828' }[lvl];
    return `<div class="card"><div class="btn"><img src="${icon}" width="32" height="32"><span class="badge" style="background:${color}">${badgeValue('co2e', co2)}</span></div>
      <div class="tip">CO₂e today: ${co2 >= 1000 ? (co2 / 1000).toFixed(1) + ' kg' : Math.round(co2) + ' g'} (Italy)</div></div>`;
  }).join('');
  const b = await chromium.launch({ channel: 'chromium' });
  const pg = await b.newPage({ viewport: { width: 900, height: 220 }, deviceScaleFactor: 2 });
  await pg.setContent(`<style>body{margin:0;background:#eef2ee;font:14px system-ui;display:flex;gap:28px;justify-content:center;align-items:center;height:220px}
    .card{display:grid;gap:10px;justify-items:center}.btn{position:relative;background:#fff;border-radius:8px;padding:10px;box-shadow:0 1px 4px #0003}
    .badge{position:absolute;right:-6px;bottom:-6px;color:#fff;font-weight:700;font-size:11px;padding:1px 5px;border-radius:8px}
    .tip{background:#222;color:#fff;padding:5px 9px;border-radius:5px;font-size:12px}</style>${cards}`);
  await pg.screenshot({ path: path.join(OUT, 'toolbar.png') });
  const tile = await b.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
  const leaf = 'data:image/png;base64,' + fs.readFileSync(path.join(EXT, 'icons/leaf-green-128.png')).toString('base64');
  await tile.setContent(`<style>body{margin:0;width:440px;height:280px;background:#f3f6f2;font-family:system-ui,sans-serif;color:#14211a;display:grid;place-content:center;gap:14px;text-align:center}
    img{margin:0 auto}h1{margin:0;font-size:30px;line-height:1.1}p{margin:0;font-size:15px;color:#55645b}</style>
    <img src="${leaf}" width="84" height="84"><h1>Digital Footprint Counter</h1><p>The footprint of your browsing, estimated on your device</p>`);
  await tile.screenshot({ path: path.join(EXT, 'store', 'promo-tile-440x280.png') });
  await b.close();
  console.log('ok', fs.readdirSync(OUT));
})().catch((e) => { console.error('ERR', e); process.exit(1); });
