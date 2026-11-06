import { api } from '../src/compat.js';
import { initI18n, t, translateDom } from '../src/i18n.js';
import { dayKey, classify, formatBytes } from '../src/core.js';

const lang = await initI18n();
translateDom();

const [{ stats = {} }, catalog] = await Promise.all([
  api.storage.local.get('stats'),
  fetch(api.runtime.getURL('data/catalog.json')).then((r) => r.json()),
]);

const rows = Object.entries(stats[dayKey()] ?? {}).sort((a, b) => b[1].b - a[1].b);
const nf = new Intl.NumberFormat(lang);

if (!rows.length) {
  document.getElementById('empty').hidden = false;
} else {
  const body = document.querySelector('tbody');
  for (const [host, e] of rows) {
    const tr = body.insertRow();
    const cells = [host, t(`category.${classify(host, catalog.domains)}`), nf.format(e.n), formatBytes(e.b), `${nf.format(Math.round(e.ms / 60000))} min`];
    cells.forEach((text, i) => { const td = tr.insertCell(); td.textContent = text; if (i > 1) td.className = 'num'; });
  }
  document.getElementById('table').hidden = false;
}
