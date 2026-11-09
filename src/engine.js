// Motore di stima (puro). Energia in Wh come grandezza salvata; CO2e, acqua e costo sono conversioni.
// Ogni valore è una terna { min, mid, max }. Nessun doppio conteggio: il dispositivo dipende dal tempo,
// rete e data center dai byte (o dal tempo per streaming e AI), mai entrambi per la stessa componente.

const K = ['min', 'mid', 'max'];
const tri = (f) => Object.fromEntries(K.map((k) => [k, f(k)]));
const ORDER = ['unavailable', 'low', 'medium', 'high'];
const worst = (a, b) => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b);

/** Potenza del dispositivo scelto dall'utente (terna min/mid/max, in W). */
export function devicePower(c, device) {
  const p = c.energy.device_power_w;
  return p.types[device] ?? p.types[p.default];
}

/**
 * Energia (Wh) di una voce { n, b, ms } per una categoria. Restituisce anche la quota di data center
 * (`dc_wh`), che serve al calcolo dell'acqua sul sito. Dispositivo = tempo; rete e data center = byte
 * (navigazione) oppure tempo (streaming, AI testuale), mai entrambi.
 */
export function estimateEntry(entry, category, c, device) {
  const cat = c.categories[category] ?? c.categories.other;
  const hours = entry.ms / 3.6e6;
  const gb = entry.b / 1e9;
  const e = c.energy;
  const P = devicePower(c, device);
  const parts = tri((k) => {
    let net = 0, dc = 0;
    switch (cat.model) {
      case 'streaming': {
        const remote = hours * e.streaming_kwh_per_hour.value[k] * 1000;
        dc = remote * e.dc_share_of_remote.value[k];
        net = remote - dc;
        break;
      }
      case 'ai_text':
        dc = hours * e.ai_text_prompts_per_hour.value[k] * e.ai_text_wh_per_prompt.value[k];
        break;
      default: // 'bytes': navigazione, e AI immagini/video (solo rete: la parte remota non è stimabile)
        net = gb * e.network_kwh_per_gb.value[k] * 1000;
        dc = gb * e.datacenter_kwh_per_gb.value[k] * 1000;
    }
    return { total: hours * P[k] + net + dc, dc };
  });
  let reliability = cat.reliability;
  if (cat.model === 'bytes' && entry.b === 0 && entry.n > 0) reliability = worst(reliability, 'low'); // dimensioni non esposte
  return { wh: tri((k) => parts[k].total), dc_wh: tri((k) => parts[k].dc), reliability, incomplete: !!cat.incomplete };
}

/**
 * Conversioni dell'energia con il profilo regionale.
 * acqua = energia data center x WUE sul sito + energia totale x acqua consumata per produrre l'elettricità.
 */
export function convert(wh, profile, c, dcWh) {
  const dc = dcWh ?? { min: 0, mid: 0, max: 0 };
  const onsite = c.water.onsite_l_per_kwh_dc.value, grid = c.water.grid_l_per_kwh.value;
  return {
    co2_g: tri((k) => (wh[k] / 1000) * (profile.co2_range?.[k] ?? profile.co2_g_per_kwh)),
    water_ml: tri((k) => dc[k] * onsite[k] + wh[k] * grid[k]), // Wh x L/kWh = mL
    cost: tri((k) => (wh[k] / 1000) * (profile.price_range?.[k] ?? profile.price_per_kwh)),
  };
}

export function sumTri(list) {
  return tri((k) => list.reduce((s, x) => s + x[k], 0));
}

export function sumEstimates(list) {
  return {
    wh: sumTri(list.map((x) => x.wh)),
    dc_wh: sumTri(list.map((x) => x.dc_wh)),
    reliability: list.reduce((r, x) => worst(r, x.reliability), 'high'),
    incomplete: list.some((x) => x.incomplete),
  };
}

export const DEFAULT_PROFILE = 'it';

/** Profilo effettivo: profilo scelto + override numerici dell'utente. */
export function resolveProfile(c, settings = {}) {
  const base = { ...(c.profiles[settings.profile] ?? c.profiles[DEFAULT_PROFILE]) };
  const ov = settings.overrides ?? {};
  // Un valore scelto dall'utente sostituisce anche l'intervallo documentato.
  if (ov.co2_g_per_kwh !== undefined) delete base.co2_range;
  if (ov.price_per_kwh !== undefined) delete base.price_range;
  return { ...base, ...ov };
}

// --- Metriche, soglie e semaforo ---------------------------------------------
export const METRICS = {
  co2e:  { key: 'co2_g',    unit: 'g' },
  water: { key: 'water_ml', unit: 'mL' },
  cost:  { key: 'cost',     unit: 'cur' },
};
export const DEFAULT_METRIC = 'co2e';
export const metricOf = (settings = {}) => (METRICS[settings.metric] ? settings.metric : DEFAULT_METRIC);

export const zeroEstimate = () => ({ wh: { min: 0, mid: 0, max: 0 }, dc_wh: { min: 0, mid: 0, max: 0 }, reliability: 'high', incomplete: false });

/** Stima del totale di un giorno: stats[giorno] = { dominio: { n, b, ms } }. */
export function estimateDay(dayStats, domains, classify, c, device) {
  const list = Object.entries(dayStats ?? {}).map(([host, e]) => estimateEntry(e, classify(host, domains), c, device));
  return list.length ? sumEstimates(list) : zeroEstimate();
}

/** Soglie [verde→giallo, giallo→rosso] nell'unità della metrica: override utente, altrimenti derivate dal riferimento. */
export function thresholdsFor(metric, settings, profile, c) {
  const custom = settings?.thresholds?.[metric];
  if (Array.isArray(custom) && custom.length === 2 && custom[0] < custom[1]) return custom;
  const ref = c.reference_thresholds_wh_per_day;
  // Per l'acqua si assume una quota tipica di data center (30%) nell'energia di riferimento.
  const at = (wh) => convert({ min: wh, mid: wh, max: wh }, profile, c, { min: wh * 0.3, mid: wh * 0.3, max: wh * 0.3 })[METRICS[metric].key].mid;
  return [at(ref.low), at(ref.high)];
}

export const levelOf = (value, [low, high]) => (value < low ? 'green' : value < high ? 'yellow' : 'red');

// --- Equivalenze quotidiane ---------------------------------------------------
/** total = { wh, co2_g, water_ml, cost } (valori centrali). Parametri e fonti in data/equivalences.json. */
export function equivalences(total, profile, eq) {
  const p = (id) => eq.params[id].value;
  const f = {
    car_km: () => total.co2_g / p('car_g_per_km'),
    light_hours_co2: () => total.co2_g / ((p('led_w') / 1000) * profile.co2_g_per_kwh),
    led_hours: () => total.wh / p('led_w'),
    bottles: () => total.water_ml / p('bottle_ml'),
    washing_cycles: () => total.cost / (p('washing_kwh') * profile.price_per_kwh),
  };
  return eq.items.map((it) => ({ id: it.id, value: f[it.id]?.(), params: it.params })).filter((x) => Number.isFinite(x.value));
}
