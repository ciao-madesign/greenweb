import { api } from '../src/compat.js';
import { initI18n, t, translateDom } from '../src/i18n.js';
import { resolveProfile, metricOf, METRICS, thresholdsFor, DEFAULT_PROFILE } from '../src/engine.js';
import { csvFromDestinations } from '../modules/destination-control/core/audit.js';
import { loadClassifier } from '../modules/destination-control/core/loader.js';
import { privacyOf, parseDomainList, purgeHosts, csvFromDays, stripAiFields, RETENTION_OPTIONS } from '../src/core.js';

await initI18n();
translateDom();

const load = (p) => fetch(api.runtime.getURL(p)).then((r) => r.json());
const [coeffs, languages, aiFile] = await Promise.all([load('data/coefficients.json'), load('data/languages.json'), load('data/ai_adapters.json')]);
const { settings: stored = {} } = await api.storage.local.get('settings');
const settings = { ...stored };
const priv = privacyOf(settings);
const $ = (id) => document.getElementById(id);
const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) && x >= 0 ? x : undefined; };

const fill = (sel, items, current) => {
  sel.replaceChildren(...items.map(([value, label]) => Object.assign(new Option(label, value), { selected: String(value) === String(current) })));
};
fill($('metric'), Object.keys(METRICS).map((m) => [m, t(`metric.${m}`)]), metricOf(settings));
fill($('profile'), Object.keys(coeffs.profiles).map((p) => [p, t(`profile.${p}`)]), settings.profile in coeffs.profiles ? settings.profile : DEFAULT_PROFILE);
fill($('device'), Object.keys(coeffs.energy.device_power_w.types).map((d) => [d, t(`device.${d}`)]), settings.device ?? coeffs.energy.device_power_w.default);
fill($('lang'), [['', t('options.auto')], ...languages.map((l) => [l.code, l.name])], settings.lang ?? '');
fill($('retention'), RETENTION_OPTIONS.map((d) => [d, t(`retention.${d}`)]), priv.retentionDays);
$('paused').checked = priv.paused;
$('destinations').checked = priv.destinations;
$('excluded').value = priv.excluded.join('\n');
// Conteggio dei messaggi AI: un'opzione per servizio, tutte spente di default.
$('ai-list').replaceChildren(...aiFile.adapters.map((a) => {
  const row = document.createElement('div');
  row.className = 'ai-row';
  const label = document.createElement('label');
  const box = Object.assign(document.createElement('input'), { type: 'checkbox', id: `ai-${a.id}`, checked: !!priv.aiServices[a.id] });
  box.dataset.service = a.id;
  box.addEventListener('change', save);
  label.append(box, Object.assign(document.createElement('span'), { textContent: a.label }), Object.assign(document.createElement('small'), { textContent: a.domain }));
  const tag = a.status === 'verified' ? '' : Object.assign(document.createElement('span'), { className: 'tag', textContent: t('options.ai_unverified'), title: a.evidence?.[0]?.note ?? '' });
  const today = Object.assign(document.createElement('span'), { className: 'ai-today', id: `ai-today-${a.id}` });
  const check = Object.assign(document.createElement('button'), { type: 'button', className: 'plain', textContent: t('options.ai_diag') });
  check.addEventListener('click', () => runDiag(a));
  row.append(label, ...(tag ? [tag] : []), today, check);
  return row;
}));

/** Messaggi contati oggi per servizio: permette di verificare subito che il conteggio funzioni. */
async function refreshAiToday() {
  const k = `day:${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const day = (await api.storage.local.get(k))[k] ?? {};
  for (const a of aiFile.adapters) $(`ai-today-${a.id}`).textContent = t('options.ai_today', { n: day[a.domain]?.p ?? 0 });
}

// Verifica con traffico reale: per 60 s si vedono le richieste di invio verso il servizio e se un adattatore le riconosce.
let diagTimer = null;
async function runDiag(a) {
  clearInterval(diagTimer);
  $('ai-diag').hidden = false;
  $('ai-diag-table').tBodies[0].replaceChildren();
  $('ai-diag-status').textContent = t('options.ai_diag_running', { service: a.label });
  await api.runtime.sendMessage({ type: 'diag:start', domain: a.domain });
  const poll = async () => {
    const r = await api.runtime.sendMessage({ type: 'diag:read' });
    const body = $('ai-diag-table').tBodies[0];
    body.replaceChildren(...r.entries.map((e) => {
      const tr = document.createElement('tr');
      for (const text of [e.request, String(e.n), String(e.status), e.matched ? `✓ ${e.matched}` : '—']) tr.append(Object.assign(document.createElement('td'), { textContent: text }));
      return tr;
    }));
    if (!r.active) {
      clearInterval(diagTimer);
      $('ai-diag-status').textContent = r.entries.length ? t('options.ai_diag_done', { n: r.entries.length }) : t('options.ai_diag_none');
      refreshAiToday();
    }
  };
  diagTimer = setInterval(poll, 2000);
  poll();
}
$('ai-diag-copy').addEventListener('click', async () => {
  const rows = [...$('ai-diag-table').tBodies[0].rows].map((r) => `${r.cells[0].textContent} | ${r.cells[1].textContent}x | ${r.cells[2].textContent} | ${r.cells[3].textContent}`);
  try { await navigator.clipboard.writeText(`Requests seen (${new Date().toISOString().slice(0, 10)}):\n${rows.join('\n')}`); } catch { /* il testo resta visibile nella tabella */ }
});

function refreshFields() {
  const base = coeffs.profiles[$('profile').value];
  const ov = settings.overrides ?? {};
  $('co2').placeholder = base.co2_g_per_kwh;
  $('co2').value = ov.co2_g_per_kwh ?? '';
  $('price-label').textContent = t('options.price', { currency: base.currency });
  $('price').placeholder = base.price_per_kwh;
  $('price').value = ov.price_per_kwh ?? '';
  const metric = $('metric').value;
  const profile = resolveProfile(coeffs, { ...settings, profile: $('profile').value });
  const [dl, dh] = thresholdsFor(metric, { ...settings, thresholds: undefined }, profile, coeffs);
  const custom = settings.thresholds?.[metric];
  $('low').placeholder = +dl.toPrecision(2); $('high').placeholder = +dh.toPrecision(2);
  $('low').value = custom?.[0] ?? ''; $('high').value = custom?.[1] ?? '';
}

const destKeys = (all) => Object.keys(all).filter((k) => k.startsWith('dest:'));
const dayKeys = (all) => Object.keys(all).filter((k) => k.startsWith('day:'));

/** Riepilogo di ciò che è memorizzato: trasparenza sui dati. */
async function refreshSummary() {
  const all = await api.storage.local.get(null);
  const days = dayKeys(all);
  const domains = new Set(days.flatMap((k) => Object.keys(all[k])));
  const kb = Math.max(1, Math.round(JSON.stringify(all).length / 1024));
  $('summary').textContent = t('options.summary', { days: days.length, domains: domains.size, size: `${kb} KB` });
}

/** Cancella i dati già raccolti dei siti esclusi (giorni e sessione). */
async function purgeExcluded(list) {
  if (!list.length) return;
  const all = await api.storage.local.get(null);
  const out = {};
  for (const k of [...dayKeys(all), ...destKeys(all)]) out[k] = purgeHosts(all[k], list);
  if (all.session) out.session = { ...all.session, stats: { all: purgeHosts(all.session.stats?.all, list) } };
  await api.storage.local.set(out);
}

async function save() {
  const co2 = num($('co2').value), price = num($('price').value);
  const lo = num($('low').value), hi = num($('high').value);
  const metric = $('metric').value;
  const excluded = parseDomainList($('excluded').value);
  const next = {
    ...settings, metric, profile: $('profile').value, device: $('device').value,
    paused: $('paused').checked, destinations: $('destinations').checked, retentionDays: Number($('retention').value), excluded,
    aiServices: Object.fromEntries([...document.querySelectorAll('#ai-list input')].filter((b) => b.checked).map((b) => [b.dataset.service, true])),
  };
  next.overrides = { ...(co2 !== undefined && { co2_g_per_kwh: co2 }), ...(price !== undefined && { price_per_kwh: price }) };
  const th = { ...(settings.thresholds ?? {}) };
  if (lo !== undefined && hi !== undefined && lo < hi) th[metric] = [lo, hi]; else delete th[metric];
  next.thresholds = th;
  if ($('lang').value) next.lang = $('lang').value; else delete next.lang;
  const langChanged = next.lang !== settings.lang;
  const added = excluded.filter((d) => !(settings.excluded ?? []).includes(d));
  Object.keys(settings).forEach((k) => delete settings[k]);
  Object.assign(settings, next);
  $('excluded').value = excluded.join('\n');
  await purgeExcluded(added); // prima di salvare: lo storage cambia e il service worker rilegge le impostazioni
  await api.storage.local.set({ settings: next });
  $('status').textContent = t('options.saved');
  await refreshSummary();
  if (langChanged) location.reload();
}

['co2', 'price', 'low', 'high', 'lang', 'device', 'paused', 'destinations', 'retention', 'excluded'].forEach((id) => $(id).addEventListener('change', save));
['metric', 'profile'].forEach((id) => $(id).addEventListener('change', async () => { await save(); refreshFields(); }));

$('ai-delete').addEventListener('click', async () => {
  const all = await api.storage.local.get(null);
  const out = {};
  for (const k of dayKeys(all)) out[k] = stripAiFields(all[k]);
  if (all.session) out.session = { ...all.session, stats: { all: stripAiFields(all.session.stats?.all) } };
  await api.storage.local.set(out);
  $('status').textContent = t('options.ai_deleted');
});

$('delete').addEventListener('click', async () => {
  if (!confirm(t('options.delete_confirm'))) return;
  const all = await api.storage.local.get(null);
  await api.storage.local.remove([...dayKeys(all), ...destKeys(all), ...Object.keys(all).filter((k) => k.startsWith('meta:')), 'session']);
  $('status').textContent = t('options.deleted');
  await refreshSummary();
});

// Esportazione locale: il file contiene esattamente ciò che è memorizzato, niente altro.
$('export').addEventListener('click', async () => {
  const all = await api.storage.local.get(null);
  const days = Object.fromEntries(dayKeys(all).map((k) => [k.slice(4), all[k]]));
  const metas = Object.fromEntries(Object.keys(all).filter((k) => k.startsWith('meta:')).map((k) => [k.slice(5), all[k]]));
  const url = URL.createObjectURL(new Blob([csvFromDays(days, metas)], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'greenweb-data.csv' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

$('export-dest').addEventListener('click', async () => {
  const all = await api.storage.local.get(null);
  const days = Object.fromEntries(destKeys(all).map((k) => [k.slice(5), all[k]]));
  const { classify } = await loadClassifier(api);
  const url = URL.createObjectURL(new Blob([csvFromDestinations(days, classify)], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'greenweb-destinations.csv' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

refreshFields();
refreshSummary();
refreshAiToday();

// Diagnostica del conteggio del tempo: quanto tempo il browser ha passato in ogni stato dall'avvio.
async function refreshDiag() {
  const { diagState } = (await api.storage.session?.get('diagState')) ?? {};
  const m = diagState?.stateMs;
  const min = (ms) => `${(ms / 60000).toFixed(1)} min`;
  $('diag-states').textContent = m
    ? t('options.diag_states', { counting: min(m.counting), away: min(m.away), unfocused: min(m.unfocused), nosite: min(m.nosite), paused: min(m.paused) })
    : t('options.diag_none');
  const last = diagState?.lastCounted;
  $('diag-last').textContent = last ? t('options.diag_last', { host: last.host, time: new Date(last.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }) : '';
}
$('diag-card').addEventListener('toggle', () => { if ($('diag-card').open) refreshDiag(); });
