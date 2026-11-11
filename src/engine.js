// Motore di stima (puro). Energia in Wh come grandezza salvata; CO2e, acqua e costo sono conversioni.
// Ogni valore è una terna { min, mid, max }. Nessun doppio conteggio: il dispositivo dipende dal tempo,
// rete e data center dai byte (o dal tempo per streaming e AI), mai entrambi per la stessa componente.

/** Versione delle formule del motore: aumenta quando cambia il modo di calcolare (non i soli coefficienti). */
// 3: le richieste senza dimensione dichiarata (nu) valgono una dimensione media assunta.
// 4: il tempo attivo non si perde più quando il browser sospende il service worker; assenza dopo 5 minuti.
export const MODEL_VERSION = 4;
/** Versione dei coefficienti, ricavata dal file dati. */
export const coefficientVersion = (c) => `${c.version}@${c.updated}`;

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
    // Le richieste senza dimensione dichiarata (u) valgono una dimensione media assunta: senza questo
    // i siti che non dichiarano la dimensione (risposte compresse a pezzi) risulterebbero troppo leggeri.
    const gbk = (entry.b + (entry.nu ?? 0) * e.unknown_response_kb.value[k] * 1000) / 1e9;
    switch (cat.model) {
      case 'streaming': {
        // Riferimento: media realistica con stima per eccesso. Solo i flussi osservati a velocità da 4K
        // lo alzano; una velocità bassa non lo riduce (i byte sono spesso sottostimati).
        const rate = hours > 0 ? gb / hours : 0;
        const factor = rate >= e.streaming_uhd_gb_per_hour.value[k] ? e.streaming_uhd_factor.value[k] : 1;
        const remote = hours * e.streaming_kwh_per_hour.value[k] * 1000 * factor;
        dc = remote * e.dc_share_of_remote.value[k];
        net = remote - dc;
        break;
      }
      case 'ai_text': {
        // Messaggi contati (p) per il tempo coperto dal conteggio; per il resto, l'ipotesi di messaggi all'ora.
        // Il conteggio è considerato affidabile solo se ha visto almeno un messaggio: con zero messaggi
        // potrebbe essere un adattatore non più valido, e un falso zero sarebbe peggio dell'ipotesi.
        const covered = (entry.p ?? 0) > 0 ? (entry.msc ?? 0) : 0;
        const uncovered = Math.max(entry.ms - covered, 0) / 3.6e6;
        dc = ((entry.p ?? 0) + uncovered * e.ai_text_prompts_per_hour.value[k]) * e.ai_text_wh_per_prompt.value[k];
        break;
      }
      default: // 'bytes': navigazione, e AI immagini/video (solo rete: la parte remota non è stimabile)
        net = gbk * e.network_kwh_per_gb.value[k] * 1000;
        dc = gbk * e.datacenter_kwh_per_gb.value[k] * 1000;
    }
    return { total: hours * P[k] + net + dc, dc, device: hours * P[k] };
  });
  let reliability = cat.reliability;
  if (cat.model === 'bytes' && entry.b === 0 && entry.n > 0) reliability = worst(reliability, 'low'); // dimensioni non esposte
  // Richieste senza dimensione dichiarata: tante = byte sottostimati, quindi affidabilità ridotta.
  if (cat.model === 'bytes' && entry.n > 0 && (entry.nu ?? 0) > 0) {
    const share = entry.nu / entry.n;
    if (share >= 0.5) reliability = worst(reliability, 'low');
    else if (share > 0.1) reliability = worst(reliability, 'medium');
  }
  if (cat.model === 'ai_text' && entry.ms > 0 && (entry.p ?? 0) > 0 && (entry.msc ?? 0) >= 0.9 * entry.ms) reliability = 'medium'; // messaggi realmente contati
  return { wh: tri((k) => parts[k].total), dc_wh: tri((k) => parts[k].dc), device_wh: tri((k) => parts[k].device), reliability, incomplete: !!cat.incomplete, requests: entry.n ?? 0, unsized: entry.nu ?? 0 };
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
    device_wh: sumTri(list.map((x) => x.device_wh)),
    reliability: list.reduce((r, x) => worst(r, x.reliability), 'high'),
    incomplete: list.some((x) => x.incomplete),
    requests: list.reduce((s, x) => s + (x.requests ?? 0), 0),
    unsized: list.reduce((s, x) => s + (x.unsized ?? 0), 0),
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

export const zeroEstimate = () => ({ wh: { min: 0, mid: 0, max: 0 }, dc_wh: { min: 0, mid: 0, max: 0 }, device_wh: { min: 0, mid: 0, max: 0 }, reliability: 'high', incomplete: false, requests: 0, unsized: 0 });

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
