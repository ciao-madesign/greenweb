// Misura CPU e memoria dell'estensione (Linux, Chromium via Playwright). Uso: node scripts/measure-impact.cjs <cartella-profilo-temporanea>
const { chromium } = require('playwright');
const path = require('path');
const EXT = path.resolve(__dirname, '..'); const http = require('http'); const fs = require('fs'); const cp = require('child_process');
const ticks = (pid) => { const f = fs.readFileSync(`/proc/${pid}/stat`,'utf8').split(') ')[1].split(' '); return (+f[11] + +f[12]) / 100; };
const rss = (pid) => +fs.readFileSync(`/proc/${pid}/status`,'utf8').match(/VmRSS:\s+(\d+)/)[1] / 1024;
(async () => {
  let served = 0;
  const srv = http.createServer((q, r) => { served++; r.setHeader('content-type','text/html'); r.end(q.url.startsWith('/f') ? 'y'.repeat(3000) : '<script>setInterval(()=>fetch("/f?"+Math.random()),50)</script>ok'); }).listen(8769);
  const ctx = await chromium.launchPersistentContext(process.argv[2], { channel:'chromium', headless:true,
    args:[`--disable-extensions-except=${EXT}`,`--load-extension=${EXT}`] });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  await new Promise(r=>setTimeout(r,3000));
  const pids = cp.execSync("pgrep -f -- '--extension-process'").toString().trim().split('\n').map(Number);
  console.log('extension pids', pids);
  const sum = () => pids.reduce((s,p)=>{try{return s+ticks(p)}catch{return s}},0);
  const mem = () => pids.reduce((s,p)=>{try{return s+rss(p)}catch{return s}},0);
  let c0 = sum(); await new Promise(r=>setTimeout(r,30000)); let c1 = sum();
  console.log('IDLE 30s: cpu s =', (c1-c0).toFixed(3), 'rss MB =', mem().toFixed(0));
  const p = await ctx.newPage(); await p.goto('http://localhost:8769/'); await p.bringToFront();
  await new Promise(r=>setTimeout(r,2000));
  const s0 = served; c0 = sum(); await new Promise(r=>setTimeout(r,60000)); c1 = sum(); const reqs = served - s0;
  console.log('LOAD 60s: requests =', reqs, 'cpu s =', (c1-c0).toFixed(3), 'cpu ms per 1000 req =', ((c1-c0)*1000/(reqs/1000)).toFixed(1), 'rss MB =', mem().toFixed(0));
  const st = await sw.evaluate(()=>chrome.storage.local.get(null)); console.log('storage bytes', JSON.stringify(st).length, Object.keys(st));
  await ctx.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
