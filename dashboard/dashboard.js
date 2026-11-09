import { api } from '../src/compat.js';
import { initI18n, t, translateDom } from '../src/i18n.js';
import { classify, lastNDays, aggregateDays, dayStorageKey } from '../src/core.js';
import { makeFormatter, makeUnits } from '../src/format.js';
import { estimateEntry, convert, sumEstimates, zeroEstimate, resolveProfile, equivalences, metricOf, thresholdsFor, levelOf, METRICS, DEFAULT_PROFILE } from '../src/engine.js';
import { gauge, donut, bars, icon } from './charts.js';

const lang = await initI18n();
translateDom();

const load = (p) => fetch(api.runtime.getURL(p)).then((r) => r.json());
const days30 = lastNDays(30);
const [raw, catalog, coeffs, eq] = await Promise.all([
  api.storage.local.get([...days30.map(dayStorageKey), 'settings']), load('data/catalog.json'), load('data/coefficients.json'), load('data/equivalences.json'),
]);
const settings = raw.settings ?? {};
const stats = Object.fromEntries(days30.map((d) => [d, raw[dayStorageKey(d)] ?? {}]));
const profileId = settings.profile in coeffs.profiles ? settings.profile : DEFAULT_PROFILE;
const profile = resolveProfile(coeffs, settings);
const fmt = makeFormatter(lang, profile.currency);
const units = makeUnits(lang);
const pct = new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 });
const PERIOD_DAYS = { day: 1, week: 7, month: 30 };
const state = { period: 'day', metric: metricOf(settings) };
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text !== undefined ? { textContent: text } : {});

// --- Calcoli ----------------------------------------------------------------------
function analyse(hosts) {
  const rows = Object.entries(hosts).map(([host, e]) => {
    const cat = classify(host, catalog.domains);
    return { host, cat, e, est: estimateEntry(e, cat, coeffs, settings.device) };
  });
  return { rows, total: rows.length ? sumEstimates(rows.map((r) => r.est)) : zeroEstimate() };
}
const analysePeriod = (p) => analyse(aggregateDays(stats, lastNDays(PERIOD_DAYS[p])));
const triOf = (est, m) => convert(est.wh, profile, coeffs, est.dc_wh)[METRICS[m].key];
const unitOf = (m) => METRICS[m].unit;
const dailyThresholds = (m) => thresholdsFor(m, settings, profile, coeffs);

// --- Controlli --------------------------------------------------------------------
function segmented(host, items, current, onPick) {
  host.replaceChildren(...items.map(([value, label]) => {
    const b = el('button', '', label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(value === current));
    b.onclick = () => { onPick(value); [...host.children].forEach((c, i) => c.setAttribute('aria-pressed', String(items[i][0] === value))); };
    return b;
  }));
}

// --- Sezioni ----------------------------------------------------------------------
function renderHero(a) {
  const m = state.metric, n = PERIOD_DAYS[state.period];
  const v = triOf(a.total, m);
  const [lo, hi] = dailyThresholds(m).map((x) => x * n);
  const level = levelOf(v.mid, [lo, hi]);
  const text = fmt(v.mid, unitOf(m));
  $('gauge').replaceChildren(gauge(v.mid, [lo, hi], `${t(`metric.${m}`)}: ${text}`));
  $('big').textContent = text;
  $('level').textContent = t(`hero.level.${level}`);
  $('level').className = `level ${level}`;
  $('range').textContent = t('hero.range', { a: fmt(v.min, unitOf(m)), b: fmt(v.max, unitOf(m)) });
  $('confidence').textContent = t('hero.confidence', { level: t(`reliability.${a.total.reliability}`).toLowerCase() }) + (a.total.incomplete ? ' *' : '');
  $('confidence').title = a.total.incomplete ? t('hero.incomplete') : '';
}

function renderEquivalences(a) {
  const c = convert(a.total.wh, profile, coeffs, a.total.dc_wh);
  const totals = { wh: a.total.wh.mid, co2_g: c.co2_g.mid, water_ml: c.water_ml.mid, cost: c.cost.mid };
  const by = Object.fromEntries(equivalences(totals, profile, eq).map((x) => [x.id, x.value]));
  const cards = [['car', units.distanceKm(by.car_km), 'card.car'], ['bulb', units.hours(by.led_hours), 'card.bulb'], ['bottle', units.num(by.bottles), 'card.bottle']];
  $('eq').replaceChildren(...cards.map(([ic, value, key]) => {
    const card = el('div', 'eq');
    const txt = el('div');
    txt.append(el('div', 'v', value), el('div', 'c', t(key)));
    card.append(icon(ic), txt);
    return card;
  }));
}

function renderWhere(a) {
  const m = state.metric;
  const groups = new Map();
  for (const r of a.rows) (groups.get(r.cat) ?? groups.set(r.cat, []).get(r.cat)).push(r.est);
  const all = [...groups].map(([id, ests]) => ({ id, value: triOf(sumEstimates(ests), m).mid })).filter((g) => g.value > 0).sort((x, y) => y.value - x.value);
  // Le prime 5 categorie; il resto e "Altro" si uniscono in un'unica voce.
  const named = all.filter((g) => g.id !== 'other');
  const top = named.slice(0, 5);
  const rest = named.slice(5).reduce((s, g) => s + g.value, 0) + (all.find((g) => g.id === 'other')?.value ?? 0);
  if (rest > 0) top.push({ id: 'other', value: rest });
  const total = top.reduce((s, g) => s + g.value, 0) || 1;
  $('donut').replaceChildren(donut(top, t('dash.where')));
  $('legend').replaceChildren(...top.map((g) => {
    const li = el('li');
    const dot = el('i');
    dot.style.background = `var(--cat-${g.id})`;
    li.append(dot, el('span', '', t(`category.${g.id}`)), el('span', 'pct', pct.format(g.value / total)));
    return li;
  }));
}

function renderTop(a) {
  const m = state.metric;
  const rows = a.rows.map((r) => ({ ...r, v: triOf(r.est, m).mid })).sort((x, y) => y.v - x.v).slice(0, 5);
  const max = rows[0]?.v || 1;
  $('top').replaceChildren(...rows.map((r) => {
    const row = el('div', 'top-row');
    const name = el('span', 'name', r.host);
    name.title = `${r.host} · ${fmt(r.v, unitOf(m))}`;
    const track = el('div', 'track');
    const fill = el('div', 'fill');
    fill.style.inlineSize = `${Math.max(3, (r.v / max) * 100)}%`;
    fill.style.background = `var(--cat-${r.cat})`;
    track.append(fill);
    row.append(name, track);
    return row;
  }));
}

function renderTrend() {
  const m = state.metric;
  const n = state.period === 'month' ? 30 : 14;
  const th = dailyThresholds(m);
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'narrow' });
  const dayNum = new Intl.DateTimeFormat(lang, { day: 'numeric' });
  const items = lastNDays(n).reverse().map((d, i, arr) => {
    const hosts = stats[d] ?? {};
    const est = Object.keys(hosts).length ? analyse(hosts).total : zeroEstimate();
    const v = triOf(est, m).mid;
    const date = new Date(`${d}T12:00:00`);
    return { label: n > 14 ? (i % 5 === 4 || i === arr.length - 1 ? dayNum.format(date) : '') : weekday.format(date), value: v, level: levelOf(v, th), today: i === arr.length - 1, title: `${d}: ${fmt(v, unitOf(m))}` };
  });
  $('trend').replaceChildren(bars(items, th, t('dash.trend')));
}

// Dettagli (tabelle) solo quando l'utente apre la sezione.
function cell(tr, text, title, num = true) {
  const td = tr.insertCell();
  td.textContent = text;
  if (num) td.className = 'num';
  if (title) td.title = title;
  return td;
}
const rangeText = (v, unit) => `${fmt(v.min, unit)} – ${fmt(v.max, unit)}`;
function metricCells(tr, est) {
  const c = convert(est.wh, profile, coeffs, est.dc_wh);
  cell(tr, fmt(est.wh.mid, 'Wh'), rangeText(est.wh, 'Wh'));
  cell(tr, fmt(c.co2_g.mid, 'g'), rangeText(c.co2_g, 'g'));
  cell(tr, fmt(c.water_ml.mid, 'mL'), rangeText(c.water_ml, 'mL'));
  cell(tr, fmt(c.cost.mid, 'cur'), rangeText(c.cost, 'cur'));
  cell(tr, t(`reliability.${est.reliability}`) + (est.incomplete ? ' *' : ''), '', false).className = `rel rel-${est.reliability}`;
}
function renderDetails() {
  const sum = $('summary').tBodies[0];
  sum.replaceChildren();
  for (const p of ['day', 'week', 'month']) {
    const tr = sum.insertRow();
    cell(tr, t(`period.${p}`), '', false);
    metricCells(tr, analysePeriod(p).total);
  }
  const body = $('sites').tBodies[0];
  body.replaceChildren();
  const a = analysePeriod(state.period);
  for (const r of [...a.rows].sort((x, y) => y.est.wh.mid - x.est.wh.mid).slice(0, 20)) {
    const tr = body.insertRow();
    cell(tr, r.host, '', false);
    cell(tr, t(`category.${r.cat}`), '', false);
    cell(tr, new Intl.NumberFormat(lang).format(r.e.n));
    cell(tr, r.e.p ? new Intl.NumberFormat(lang).format(r.e.p) : '–');
    metricCells(tr, r.est);
  }
}

function render() {
  const a = analysePeriod(state.period);
  const empty = a.rows.length === 0 && !days30.some((d) => Object.keys(stats[d]).length);
  $('empty').hidden = !empty;
  $('content').hidden = empty;
  if (empty) return;
  renderHero(a);
  renderEquivalences(a);
  renderWhere(a);
  renderTop(a);
  renderTrend();
  if ($('details').open) renderDetails();
}

// --- Avvio ------------------------------------------------------------------------
segmented($('period'), ['day', 'week', 'month'].map((p) => [p, t(`period.${p}`)]), state.period, (p) => { state.period = p; render(); });
segmented($('metric'), Object.keys(METRICS).map((m) => [m, t(`metric.${m}`)]), state.metric, (m) => { state.metric = m; render(); });
$('details').addEventListener('toggle', () => { if ($('details').open) renderDetails(); });
function showPause() {
  $('pause').textContent = t(settings.paused ? 'pause.off' : 'pause.on');
  $('paused-banner').hidden = !settings.paused;
}
$('pause').onclick = async () => { settings.paused = !settings.paused; await api.storage.local.set({ settings }); showPause(); };
showPause();
$('settings-link').onclick = (e) => { e.preventDefault(); api.runtime.openOptionsPage(); };
$('profile').textContent = `${t(`profile.${profileId}`)} · ${profile.co2_g_per_kwh} gCO₂e/kWh`;
render();
