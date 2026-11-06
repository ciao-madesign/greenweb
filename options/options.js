import { api } from '../src/compat.js';
import { initI18n, t, translateDom } from '../src/i18n.js';
import { resolveProfile, metricOf, METRICS, thresholdsFor, DEFAULT_PROFILE } from '../src/engine.js';

await initI18n();
translateDom();

const load = (p) => fetch(api.runtime.getURL(p)).then((r) => r.json());
const [coeffs, languages] = await Promise.all([load('data/coefficients.json'), load('data/languages.json')]);
const { settings: stored = {} } = await api.storage.local.get('settings');
const settings = { ...stored };
const $ = (id) => document.getElementById(id);
const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) && x >= 0 ? x : undefined; };

const fill = (sel, items, current) => {
  sel.replaceChildren(...items.map(([value, label]) => Object.assign(new Option(label, value), { selected: value === current })));
};
fill($('metric'), Object.keys(METRICS).map((m) => [m, t(`metric.${m}`)]), metricOf(settings));
fill($('profile'), Object.keys(coeffs.profiles).map((p) => [p, t(`profile.${p}`)]), settings.profile in coeffs.profiles ? settings.profile : DEFAULT_PROFILE);
fill($('lang'), [['', t('options.auto')], ...languages.map((l) => [l.code, l.name])], settings.lang ?? '');

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

async function save() {
  const co2 = num($('co2').value), price = num($('price').value);
  const lo = num($('low').value), hi = num($('high').value);
  const metric = $('metric').value;
  const next = { ...settings, metric, profile: $('profile').value };
  next.overrides = { ...(co2 !== undefined && { co2_g_per_kwh: co2 }), ...(price !== undefined && { price_per_kwh: price }) };
  const th = { ...(settings.thresholds ?? {}) };
  if (lo !== undefined && hi !== undefined && lo < hi) th[metric] = [lo, hi]; else delete th[metric];
  next.thresholds = th;
  if ($('lang').value) next.lang = $('lang').value; else delete next.lang;
  const langChanged = next.lang !== settings.lang;
  Object.keys(settings).forEach((k) => delete settings[k]);
  Object.assign(settings, next);
  await api.storage.local.set({ settings: next });
  $('status').textContent = t('options.saved');
  if (langChanged) location.reload();
}

['co2', 'price', 'low', 'high'].forEach((id) => $(id).addEventListener('change', save));
['metric', 'profile'].forEach((id) => $(id).addEventListener('change', async () => { await save(); refreshFields(); }));
$('lang').addEventListener('change', save);
$('delete').addEventListener('click', async () => {
  if (!confirm(t('options.delete_confirm'))) return;
  await api.storage.local.remove('stats');
  $('status').textContent = t('options.deleted');
});
refreshFields();
