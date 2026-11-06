// Motore di stima (puro). Energia in Wh come grandezza salvata; CO2e, acqua e costo sono conversioni.
// Ogni valore è una terna { min, mid, max }. Nessun doppio conteggio: il dispositivo dipende dal tempo,
// rete e data center dai byte (o dal tempo per streaming e AI), mai entrambi per la stessa componente.

const K = ['min', 'mid', 'max'];
const tri = (f) => Object.fromEntries(K.map((k) => [k, f(k)]));
const ORDER = ['unavailable', 'low', 'medium', 'high'];
const worst = (a, b) => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b);

/** Energia (Wh) di una voce { n, b, ms } per una categoria. */
export function estimateEntry(entry, category, c) {
  const cat = c.categories[category] ?? c.categories.other;
  const hours = entry.ms / 3.6e6;
  const gb = entry.b / 1e9;
  const e = c.energy;
  const wh = tri((k) => {
    let w = hours * e.device_power_w.value[k];
    switch (cat.model) {
      case 'streaming': w += hours * e.streaming_kwh_per_hour.value[k] * 1000; break;
      case 'ai_text':   w += hours * e.ai_text_prompts_per_hour.value[k] * e.ai_text_wh_per_prompt.value[k]; break;
      case 'ai_image':  w += hours * e.ai_image_images_per_hour.value[k] * e.ai_image_wh_per_image.value[k]; break;
      default:          w += gb * e.network_dc_kwh_per_gb.value[k] * 1000; // bytes, ai_video (solo rete)
    }
    return w;
  });
  let reliability = cat.reliability;
  const usesBytes = cat.model === 'bytes' || cat.model === 'ai_video';
  if (usesBytes && entry.b === 0 && entry.n > 0) reliability = worst(reliability, 'low'); // dimensioni non esposte
  return { wh, reliability, incomplete: !!cat.incomplete };
}

/** Conversioni dell'energia con il profilo regionale (con eventuali override dell'utente). */
export function convert(wh, profile, c) {
  const w = c.water_l_per_kwh.value;
  return {
    co2_g: tri((k) => (wh[k] / 1000) * profile.co2_g_per_kwh),
    water_ml: tri((k) => wh[k] * w[k]), // Wh x L/kWh = mL
    cost: tri((k) => (wh[k] / 1000) * profile.price_per_kwh),
  };
}

export function sumTri(list) {
  return tri((k) => list.reduce((s, x) => s + x[k], 0));
}

export function sumEstimates(list) {
  return {
    wh: sumTri(list.map((x) => x.wh)),
    reliability: list.reduce((r, x) => worst(r, x.reliability), 'high'),
    incomplete: list.some((x) => x.incomplete),
  };
}

export const DEFAULT_PROFILE = 'it';

/** Profilo effettivo: profilo scelto + override numerici dell'utente. */
export function resolveProfile(c, settings = {}) {
  const base = c.profiles[settings.profile] ?? c.profiles[DEFAULT_PROFILE];
  return { ...base, ...(settings.overrides ?? {}) };
}
