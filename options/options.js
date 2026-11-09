import { api } from '../src/compat.js';
import { initI18n, t, translateDom } from '../src/i18n.js';
import { resolveProfile, metricOf, METRICS, thresholdsFor, DEFAULT_PROFILE } from '../src/engine.js';
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
$('excluded').value = priv.excluded.join('\n');
// Conteggio dei messaggi AI: un'opzione per servizio, tutte spente di default.
$('ai-list').replaceChildren(...aiFile.adapters.map((a) => {
  const row = document.createElement('label');
  row.className = 'ai-row';
  const box = Object.assign(document.createElement('input'), { type: 'checkbox', id: `ai-${a.id}`, checked: !!priv.aiServices[a.id] });
  box.dataset.service = a.id;
  box.addEventListener('change', save);
  row.append(box, Object.assign(document.createElement('span'), { textContent: a.label }), Object.assign(document.createElement('small'), { textContent: a.domain }));
  return row;
}));

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
  for (const k of dayKeys(all)) out[k] = purgeHosts(all[k], list);
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
    paused: $('paused').checked, retentionDays: Number($('retention').value), excluded,
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

['co2', 'price', 'low', 'high', 'lang', 'device', 'paused', 'retention', 'excluded'].forEach((id) => $(id).addEventListener('change', save));
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
  await api.storage.local.remove([...dayKeys(all), 'session']);
  $('status').textContent = t('options.deleted');
  await refreshSummary();
});

// Esportazione locale: il file contiene esattamente ciò che è memorizzato, niente altro.
$('export').addEventListener('click', async () => {
  const all = await api.storage.local.get(null);
  const days = Object.fromEntries(dayKeys(all).map((k) => [k.slice(4), all[k]]));
  const url = URL.createObjectURL(new Blob([csvFromDays(days)], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'digital-footprint-counter-data.csv' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

refreshFields();
refreshSummary();
