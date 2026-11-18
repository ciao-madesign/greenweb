// Rapporto delle stime con provenienza: ogni riga è un'unità funzionale "dominio-giorno" con le componenti
// separate (dispositivo, rete, data center), gli intervalli e le versioni usate. Ispirato alle idee di SCI for Web
// (unità funzionale esplicita, cifre per componente, ingressi con provenienza); non ne implementa lo schema,
// che non è ancora pubblicato. Pura: nessun accesso al browser.
import { classify } from './core.js';
import { estimateEntry, convert, devicePower, resolveProfile, MODEL_VERSION, coefficientVersion } from './engine.js';

export const REPORT_SCHEMA = 'digital-footprint-counter/report/1';
const K = ['min', 'mid', 'max'];
const tri = (f) => Object.fromEntries(K.map((k) => [k, f(k)]));

/** days = { 'AAAA-MM-GG': { dominio: { n, b, ms, ... } } }, metas = { giorno: { m: [...], c: [...] } } */
export function buildReport({ days, metas = {}, catalog, coeffs, settings = {}, generatedAt = new Date().toISOString() }) {
  const profile = resolveProfile(coeffs, settings);
  const types = coeffs.energy.device_power_w.types;
  const device = settings.device in types ? settings.device : coeffs.energy.device_power_w.default;
  const rows = [];
  for (const day of Object.keys(days).sort()) {
    for (const [host, e] of Object.entries(days[day]).sort()) {
      const category = classify(host, catalog.domains);
      const est = estimateEntry(e, category, coeffs, device);
      const network = tri((k) => Math.max(est.wh[k] - est.device_wh[k] - est.dc_wh[k], 0));
      const conv = convert(est.wh, profile, coeffs, est.dc_wh);
      rows.push({
        day, domain: host, category, functional_unit: 'domain-day',
        requests: e.n, bytes: e.b, requests_without_size: e.nu ?? 0, active_seconds: Math.round(e.ms / 1000), ai_messages: e.p ?? 0,
        energy_wh: { device: est.device_wh, network, data_center: est.dc_wh, total: est.wh },
        co2e_g: conv.co2_g, water_ml: conv.water_ml, cost: conv.cost,
        reliability: est.reliability, incomplete: est.incomplete,
        model_version: metas[day]?.m ?? [], coefficient_version: metas[day]?.c ?? [],
      });
    }
  }
  const used = {};
  const take = (id, x) => { used[id] = { unit: x.unit, value: x.value ?? null, status: x.status, reliability: x.reliability, sources: x.sources, method: x.method }; };
  for (const [id, x] of Object.entries(coeffs.energy)) if (id !== 'device_power_w') take(id, x);
  for (const [id, x] of Object.entries(coeffs.water)) take(id, x);
  const sourceIds = new Set([...Object.values(used).flatMap((x) => x.sources), ...profile.sources, ...coeffs.energy.device_power_w.sources]);
  return {
    meta: {
      schema: REPORT_SCHEMA,
      generated_at: generatedAt,
      functional_unit: 'domain-day: energy and emissions of one website for one day of browsing on this device',
      scope: {
        included: ['client operational (device, from active time)', 'network operational (SWD allocation)', 'data center operational (SWD allocation, AI per message)', 'water (data-center cooling and electricity generation)'],
        excluded: ['embodied emissions of devices, network and servers', 'traffic outside the browser', 'AI image and video remote energy (no reliable coefficient)'],
      },
      model_version: MODEL_VERSION,
      coefficient_version: coefficientVersion(coeffs),
      region: {
        id: Object.keys(coeffs.profiles).find((k) => coeffs.profiles[k] === coeffs.profiles[settings.profile]) ?? 'it', label: profile.label,
        co2_g_per_kwh: profile.co2_g_per_kwh, co2_range: profile.co2_range ?? null, co2_status: profile.co2_status, co2_reference: profile.co2_reference,
        price_per_kwh: profile.price_per_kwh, price_range: profile.price_range ?? null, currency: profile.currency, price_status: profile.price_status, price_reference: profile.price_reference,
        user_overrides: settings.overrides ?? {},
      },
      device: { type: device, power_w: devicePower(coeffs, device), status: coeffs.energy.device_power_w.status, reliability: coeffs.energy.device_power_w.reliability, method: coeffs.energy.device_power_w.method },
      coefficients: used,
      sources: Object.fromEntries([...sourceIds].filter((id) => coeffs.sources[id]).map((id) => [id, coeffs.sources[id]])),
      ranges: 'min/mid/max are an envelope of documented uncertainty, not a statistical confidence interval',
    },
    rows,
  };
}

const COLUMNS = [
  'day', 'domain', 'category', 'functional_unit', 'requests', 'bytes', 'requests_without_size', 'active_seconds', 'ai_messages',
  ...['device', 'network', 'data_center', 'total'].flatMap((c) => K.map((k) => `energy_${c}_wh_${k}`)),
  ...K.map((k) => `co2e_g_${k}`), ...K.map((k) => `water_ml_${k}`), ...K.map((k) => `cost_${k}`),
  'reliability', 'incomplete', 'model_version', 'coefficient_version', 'region', 'grid_g_co2e_per_kwh', 'currency', 'device_type',
];

/** CSV piatto con le stesse righe e le colonne di contesto (regione, intensità, valuta, dispositivo). */
export function reportCsv(report) {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const m = report.meta;
  const num = (v) => (Number.isInteger(v) ? v : Number(v.toPrecision(6)));
  const lines = [COLUMNS.join(',')];
  for (const r of report.rows) {
    lines.push([
      r.day, q(r.domain), r.category, r.functional_unit, r.requests, r.bytes, r.requests_without_size, r.active_seconds, r.ai_messages,
      ...['device', 'network', 'data_center', 'total'].flatMap((c) => K.map((k) => num(r.energy_wh[c][k]))),
      ...K.map((k) => num(r.co2e_g[k])), ...K.map((k) => num(r.water_ml[k])), ...K.map((k) => num(r.cost[k])),
      r.reliability, r.incomplete, q(r.model_version.join(' ')), q(r.coefficient_version.join(' ')),
      m.region.id, m.region.co2_g_per_kwh, m.region.currency, m.device.type,
    ].join(','));
  }
  return `${lines.join('\n')}\n`;
}
