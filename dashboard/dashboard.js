import { api } from '../src/compat.js';
import { initI18n, t, translateDom } from '../src/i18n.js';
import { dayKey, classify } from '../src/core.js';
import { estimateEntry, convert, sumEstimates, sumTri, resolveProfile } from '../src/engine.js';

const lang = await initI18n();
translateDom();

const load = (p) => fetch(api.runtime.getURL(p)).then((r) => r.json());
const [{ stats = {}, settings = {} }, catalog, coeffs] = await Promise.all([
  api.storage.local.get(['stats', 'settings']), load('data/catalog.json'), load('data/coefficients.json'),
]);
const profile = resolveProfile(coeffs, settings);

const sig = new Intl.NumberFormat(lang, { maximumSignificantDigits: 2 });
const money = new Intl.NumberFormat(lang, { style: 'currency', currency: profile.currency, maximumSignificantDigits: 2 });
const scale = (v, unit) => unit === 'Wh' ? (v >= 1000 ? `${sig.format(v / 1000)} kWh` : `${sig.format(v)} Wh`)
  : unit === 'g' ? (v >= 1000 ? `${sig.format(v / 1000)} kg` : `${sig.format(v)} g`)
  : unit === 'mL' ? (v >= 1000 ? `${sig.format(v / 1000)} L` : `${sig.format(v)} mL`)
  : money.format(v);
const cell = (tr, text, title) => { const td = tr.insertCell(); td.textContent = text; td.className = 'num'; if (title) td.title = title; return td; };
const range = (x, unit) => `${scale(x.min, unit)} – ${scale(x.max, unit)}`;

function addRow(body, label, category, est, entryCount) {
  const conv = convert(est.wh, profile, coeffs);
  const tr = body.insertRow();
  tr.insertCell().textContent = label;
  tr.insertCell().textContent = category;
  cell(tr, scale(est.wh.mid, 'Wh'), range(est.wh, 'Wh'));
  cell(tr, scale(conv.co2_g.mid, 'g'), range(conv.co2_g, 'g'));
  cell(tr, scale(conv.water_ml.mid, 'mL'), range(conv.water_ml, 'mL'));
  cell(tr, scale(conv.cost.mid, '€'), range(conv.cost, '€'));
  const r = cell(tr, t(`reliability.${est.reliability}`) + (est.incomplete ? ' *' : ''));
  if (est.incomplete) r.title = t('dashboard.incomplete');
  r.className = '';
  return tr;
}

const rows = Object.entries(stats[dayKey()] ?? {}).map(([host, e]) => {
  const cat = classify(host, catalog.domains);
  return { host, cat, e, est: estimateEntry(e, cat, coeffs) };
}).sort((a, b) => b.est.wh.mid - a.est.wh.mid);

if (!rows.length) {
  document.getElementById('empty').hidden = false;
} else {
  const body = document.querySelector('tbody');
  for (const r of rows) addRow(body, r.host, t(`category.${r.cat}`), r.est);
  const total = addRow(body, t('dashboard.total'), '', sumEstimates(rows.map((r) => r.est)));
  total.className = 'total';
  document.getElementById('table').hidden = false;
}
document.getElementById('profile').textContent = `${profile.label} · ${profile.co2_g_per_kwh} gCO₂e/kWh · ${profile.currency}`;
