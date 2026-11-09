import { api } from '../src/compat.js';
import { initI18n, t, translateDom } from '../src/i18n.js';
import { METRICS, DEFAULT_PROFILE } from '../src/engine.js';

await initI18n();
translateDom();

const load = (p) => fetch(api.runtime.getURL(p)).then((r) => r.json());
const [coeffs, languages] = await Promise.all([load('data/coefficients.json'), load('data/languages.json')]);
const { settings: stored = {} } = await api.storage.local.get('settings');

// Regione suggerita dalla lingua del browser (solo un suggerimento; il predefinito resta l'Italia).
const EU = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE LV LT LU MT NL PL PT RO SK SI ES SE'.split(' ');
function guessProfile() {
  const region = new Intl.Locale(navigator.language).maximize().region;
  if (region === 'IT') return 'it';
  if (region === 'US') return 'us';
  if (region === 'CN') return 'cn';
  if (region === 'JP') return 'jp';
  return EU.includes(region) ? 'eu' : DEFAULT_PROFILE;
}

const $ = (id) => document.getElementById(id);
const fill = (sel, items, current) => sel.replaceChildren(...items.map(([v, l]) => Object.assign(new Option(l, v), { selected: v === current })));
fill($('profile'), Object.keys(coeffs.profiles).map((p) => [p, t(`profile.${p}`)]), stored.profile ?? guessProfile());
fill($('lang'), [['', t('options.auto')], ...languages.map((l) => [l.code, l.name])], stored.lang ?? '');
fill($('metric'), Object.keys(METRICS).map((m) => [m, t(`metric.${m}`)]), stored.metric ?? 'co2e');

const dashboard = api.runtime.getURL('dashboard/dashboard.html');
const collect = () => {
  const settings = { ...stored, profile: $('profile').value, metric: $('metric').value };
  if ($('lang').value) settings.lang = $('lang').value; else delete settings.lang;
  return settings;
};
$('start').onclick = async () => { await api.storage.local.set({ settings: collect() }); location.href = dashboard; };
$('skip').onclick = (e) => { e.preventDefault(); location.href = dashboard; };
$('lang').onchange = async () => { await api.storage.local.set({ settings: collect() }); location.reload(); }; // cambio lingua immediato
