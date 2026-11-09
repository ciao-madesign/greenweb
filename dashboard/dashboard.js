import { api } from '../src/compat.js';
import { initI18n, t, translateDom } from '../src/i18n.js';
import { classify, lastNDays, aggregateDays, dayStorageKey } from '../src/core.js';
import { makeFormatter, makeUnits } from '../src/format.js';
import { estimateEntry, convert, sumEstimates, zeroEstimate, resolveProfile, equivalences, METRICS, DEFAULT_PROFILE } from '../src/engine.js';

const lang = await initI18n();
translateDom();

const load = (p) => fetch(api.runtime.getURL(p)).then((r) => r.json());
const days30 = lastNDays(30);
const [raw, catalog, coeffs, eq] = await Promise.all([
  api.storage.local.get([...days30.map(dayStorageKey), 'settings', 'session']), load('data/catalog.json'), load('data/coefficients.json'), load('data/equivalences.json'),
]);
const { settings = {}, session } = raw;
const stats = Object.fromEntries(days30.map((d) => [d, raw[dayStorageKey(d)] ?? {}]));
const profileId = settings.profile in coeffs.profiles ? settings.profile : DEFAULT_PROFILE;
const profile = resolveProfile(coeffs, settings);
const fmt = makeFormatter(lang, profile.currency);
const units = makeUnits(lang);
const PERIODS = ['session', 'day', 'week', 'month'];
const DAYS = { day: 1, week: 7, month: 30 };
const state = { period: 'day', metric: settings.metric in METRICS ? settings.metric : 'co2e' };

// --- Dati -----------------------------------------------------------------------
const hostsFor = (p) => (p === 'session' ? (session?.stats?.all ?? {}) : aggregateDays(stats, lastNDays(DAYS[p])));
function analyse(p) {
  const rows = Object.entries(hostsFor(p)).map(([host, e]) => {
    const cat = classify(host, catalog.domains);
    return { host, cat, e, est: estimateEntry(e, cat, coeffs) };
  });
  return { rows, total: rows.length ? sumEstimates(rows.map((r) => r.est)) : zeroEstimate() };
}
const unitOf = (m) => (m === 'energy' ? 'Wh' : METRICS[m].unit);
const triOf = (est, m) => (m === 'energy' ? est.wh : convert(est.wh, profile, coeffs)[METRICS[m].key]);

// --- Helpers DOM -----------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const rangeText = (v, unit) => `${fmt(v.min, unit)} – ${fmt(v.max, unit)}`;
function cell(tr, text, title, num = true) {
  const td = tr.insertCell();
  td.textContent = text;
  if (num) td.className = 'num';
  if (title) td.title = title;
  return td;
}
function metricCells(tr, est) {
  const conv = convert(est.wh, profile, coeffs);
  cell(tr, fmt(est.wh.mid, 'Wh'), rangeText(est.wh, 'Wh'));
  cell(tr, fmt(conv.co2_g.mid, 'g'), rangeText(conv.co2_g, 'g'));
  cell(tr, fmt(conv.water_ml.mid, 'mL'), rangeText(conv.water_ml, 'mL'));
  cell(tr, fmt(conv.cost.mid, 'cur'), rangeText(conv.cost, 'cur'));
  const r = cell(tr, t(`reliability.${est.reliability}`) + (est.incomplete ? ' *' : ''), est.incomplete ? t('dashboard.incomplete') : '', false);
  r.className = `rel rel-${est.reliability}`;
}

// --- Sezioni ----------------------------------------------------------------------
function renderSummary() {
  const body = $('summary').tBodies[0];
  body.replaceChildren();
  for (const p of PERIODS) {
    const tr = body.insertRow();
    const label = p === 'session' && session?.start
      ? `${t('period.session')} (${new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(session.start)}–)` : t(`period.${p}`);
    cell(tr, label, '', false);
    metricCells(tr, analyse(p).total);
  }
}

function renderDetail() {
  const { rows, total } = analyse(state.period);
  $('empty').hidden = rows.length > 0;
  $('detail').hidden = rows.length === 0;
  if (!rows.length) return;
  const m = state.metric, unit = unitOf(m);

  // Per attività: barre CSS, accessibili (testo + valore).
  const groups = new Map();
  for (const r of rows) (groups.get(r.cat) ?? groups.set(r.cat, []).get(r.cat)).push(r.est);
  const bars = [...groups].map(([cat, ests]) => ({ cat, est: sumEstimates(ests) }))
    .map((g) => ({ ...g, v: triOf(g.est, m) })).filter((g) => g.v.mid > 0).sort((a, b) => b.v.mid - a.v.mid);
  const max = bars[0]?.v.mid || 1;
  $('chart').replaceChildren(...bars.map((g) => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    const label = Object.assign(document.createElement('span'), { textContent: t(`category.${g.cat}`) });
    const track = document.createElement('div');
    track.className = 'track';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.inlineSize = `${Math.max(2, (g.v.mid / max) * 100)}%`;
    track.append(fill);
    const val = Object.assign(document.createElement('span'), { textContent: fmt(g.v.mid, unit), title: rangeText(g.v, unit) });
    val.className = 'num';
    row.append(label, track, val);
    return row;
  }));

  // Per sito (primi 20, ordinati sulla metrica scelta).
  const body = $('sites').tBodies[0];
  body.replaceChildren();
  for (const r of [...rows].sort((a, b) => triOf(b.est, m).mid - triOf(a.est, m).mid).slice(0, 20)) {
    const tr = body.insertRow();
    cell(tr, r.host, '', false);
    cell(tr, t(`category.${r.cat}`), '', false);
    cell(tr, new Intl.NumberFormat(lang).format(r.e.n));
    metricCells(tr, r.est);
  }

  // Equivalenze sul periodo scelto.
  const c = convert(total.wh, profile, coeffs);
  const totals = { wh: total.wh.mid, co2_g: c.co2_g.mid, water_ml: c.water_ml.mid, cost: c.cost.mid };
  const show = { car_km: units.distanceKm, light_hours_co2: units.hours, led_hours: units.hours, bottles: units.num, washing_cycles: units.num };
  $('equivalences').replaceChildren(...equivalences(totals, profile, eq).map((x) => {
    const li = document.createElement('li');
    li.textContent = t(`eq.${x.id}`, { v: show[x.id](x.value) });
    return li;
  }));
}

// --- Avvio -------------------------------------------------------------------------
const fill = (sel, items, current) => sel.replaceChildren(...items.map(([v, l]) => Object.assign(new Option(l, v), { selected: v === current })));
fill($('period'), PERIODS.map((p) => [p, t(`period.${p}`)]), state.period);
fill($('metric'), ['energy', ...Object.keys(METRICS)].map((m) => [m, t(`metric.${m}`)]), state.metric);
$('period').onchange = (e) => { state.period = e.target.value; renderDetail(); };
$('metric').onchange = (e) => { state.metric = e.target.value; renderDetail(); };
$('settings-link').onclick = (e) => { e.preventDefault(); api.runtime.openOptionsPage(); };
$('profile').textContent = `${t(`profile.${profileId}`)} · ${profile.co2_g_per_kwh} gCO₂e/kWh · ${profile.currency}`;
renderSummary();
renderDetail();
