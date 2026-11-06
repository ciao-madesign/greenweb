// La pagina è generata dagli stessi JSON usati dal motore: ogni valore mostrato ha metodo e fonte.
import { api } from '../src/compat.js';
import { initI18n, t, translateDom } from '../src/i18n.js';

const lang = await initI18n();
translateDom();

const load = (p) => fetch(api.runtime.getURL(p)).then((r) => r.json());
const [c, eq] = await Promise.all([load('data/coefficients.json'), load('data/equivalences.json')]);
const num = new Intl.NumberFormat(lang, { maximumSignificantDigits: 4 });
const sources = { ...c.sources, ...eq.sources };

function td(tr, content, cls) {
  const cell = tr.insertCell();
  if (cls) cell.className = cls;
  if (content instanceof Node) cell.append(content); else cell.textContent = content ?? '';
  return cell;
}
function sourceLinks(ids) {
  const span = document.createElement('span');
  ids.forEach((id, i) => {
    if (i) span.append(', ');
    const a = document.createElement('a');
    a.href = `#src-${id}`;
    a.textContent = id;
    span.append(a);
  });
  return span;
}
const range = (v, unit) => (v ? `${num.format(v.min)} / ${num.format(v.mid)} / ${num.format(v.max)} ${unit}` : '—');
const status = (s) => t(`status.${s}`);

// Coefficienti energetici e acqua
const coefBody = document.querySelector('#coef-table tbody');
for (const [id, x] of [...Object.entries(c.energy), ['water_l_per_kwh', c.water_l_per_kwh]]) {
  const tr = coefBody.insertRow();
  tr.id = `coef-${id}`;
  td(tr, t(`coef.${id}`));
  td(tr, range(x.value, x.unit), 'num');
  td(tr, t(`reliability.${x.reliability}`));
  td(tr, status(x.status));
  td(tr, x.method, 'method');
  td(tr, sourceLinks(x.sources));
}
const th = c.reference_thresholds_wh_per_day;
{
  const tr = coefBody.insertRow();
  tr.id = 'coef-thresholds';
  td(tr, t('coef.thresholds'));
  td(tr, `${th.low} / ${th.high} Wh/${t('mt.day')}`, 'num');
  td(tr, '—');
  td(tr, status(th.status));
  td(tr, th.method, 'method');
  td(tr, '');
}

// Profili regionali
const profBody = document.querySelector('#profile-table tbody');
for (const [id, p] of Object.entries(c.profiles)) {
  const tr = profBody.insertRow();
  tr.id = `profile-${id}`;
  td(tr, t(`profile.${id}`));
  td(tr, num.format(p.co2_g_per_kwh), 'num');
  td(tr, `${num.format(p.price_per_kwh)} ${p.currency}/kWh`, 'num');
  td(tr, status(p.status));
  td(tr, p.reference, 'method');
  td(tr, sourceLinks(p.sources));
}

// Parametri delle equivalenze
const eqBody = document.querySelector('#eq-table tbody');
for (const [id, p] of Object.entries(eq.params)) {
  const tr = eqBody.insertRow();
  tr.id = `eqp-${id}`;
  td(tr, t(`eqp.${id}`));
  td(tr, `${num.format(p.value)} ${p.unit}`, 'num');
  td(tr, status(p.status));
  td(tr, p.note, 'method');
  td(tr, sourceLinks(p.sources));
}

// Fonti
const list = document.getElementById('source-list');
for (const [id, s] of Object.entries(sources)) {
  const li = document.createElement('li');
  li.id = `src-${id}`;
  li.append(`${s.title}${s.year ? ` (${s.year})` : ''} `);
  if (s.url && /^https?:\/\//.test(s.url)) {
    const a = Object.assign(document.createElement('a'), { href: s.url, textContent: s.url, rel: 'noopener noreferrer', target: '_blank' });
    li.append(a);
  }
  list.append(li);
}

// Limiti: attività non misurabili
const limits = document.getElementById('limits-list');
for (let i = 1; i <= 6; i++) limits.append(Object.assign(document.createElement('li'), { textContent: t(`m8.item${i}`) }));
