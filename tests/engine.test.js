import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estimateEntry, convert, sumEstimates, resolveProfile, devicePower } from '../src/engine.js';

const c = JSON.parse(readFileSync(new URL('../data/coefficients.json', import.meta.url)));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const E = c.energy;
const P = E.device_power_w.types.laptop.mid;
const NET = E.network_kwh_per_gb.value.mid, DC = E.datacenter_kwh_per_gb.value.mid;

test('navigazione: 1 GB senza tempo = (rete + data center) Wh, con quota data center', () => {
  const r = estimateEntry({ n: 1, b: 1e9, ms: 0 }, 'browsing', c);
  near(r.wh.mid, (NET + DC) * 1000);
  near(r.dc_wh.mid, DC * 1000);
});

test('dispositivo: 1 ora = potenza del tipo scelto; streaming usa il tempo, non i byte', () => {
  near(estimateEntry({ n: 1, b: 0, ms: 3.6e6 }, 'browsing', c).wh.mid, P);
  near(estimateEntry({ n: 1, b: 0, ms: 3.6e6 }, 'browsing', c, 'desktop').wh.mid, E.device_power_w.types.desktop.mid);
  near(estimateEntry({ n: 1, b: 0, ms: 3.6e6 }, 'browsing', c, 'sconosciuto').wh.mid, P); // ripiego sul predefinito
  const s = estimateEntry({ n: 1, b: 5e9, ms: 3.6e6 }, 'streaming', c);
  near(s.wh.mid, P + E.streaming_kwh_per_hour.value.mid * 1000);
  near(s.dc_wh.mid, E.streaming_kwh_per_hour.value.mid * 1000 * E.dc_share_of_remote.value.mid);
  assert.deepEqual(devicePower(c, 'phone'), E.device_power_w.types.phone);
});

test('AI testuale: 1 ora = dispositivo + prompt/h x Wh per prompt (tutta energia da data center)', () => {
  const r = estimateEntry({ n: 1, b: 0, ms: 3.6e6 }, 'ai_text', c);
  const remote = E.ai_text_prompts_per_hour.value.mid * E.ai_text_wh_per_prompt.value.mid;
  near(r.wh.mid, P + remote);
  near(r.dc_wh.mid, remote);
});

test('AI testuale con messaggi contati: usa i conteggi per il tempo coperto, l\'ipotesi per il resto', () => {
  const wh = E.ai_text_wh_per_prompt.value.mid, rate = E.ai_text_prompts_per_hour.value.mid;
  // 1 ora, tutta coperta dal conteggio: 3 messaggi reali, nessuna ipotesi
  const full = estimateEntry({ n: 1, b: 0, ms: 3.6e6, msc: 3.6e6, p: 3 }, 'ai_text', c);
  near(full.dc_wh.mid, 3 * wh);
  assert.equal(full.reliability, 'medium');
  // 1 ora, metà coperta: 2 messaggi + mezz'ora di ipotesi
  const half = estimateEntry({ n: 1, b: 0, ms: 3.6e6, msc: 1.8e6, p: 2 }, 'ai_text', c);
  near(half.dc_wh.mid, (2 + 0.5 * rate) * wh);
  assert.equal(half.reliability, 'low');
  // conteggio a zero messaggi: potrebbe essere un adattatore rotto, quindi si usa l'ipotesi
  near(estimateEntry({ n: 1, b: 0, ms: 3.6e6, msc: 3.6e6, p: 0 }, 'ai_text', c).dc_wh.mid, rate * wh);
  // senza conteggio (comportamento di prima)
  near(estimateEntry({ n: 1, b: 0, ms: 3.6e6 }, 'ai_text', c).dc_wh.mid, rate * wh);
});

test('conversioni: CO2e e costo con intervallo del profilo; acqua = data center + elettricità', () => {
  const p = resolveProfile(c, {});
  const r = convert({ min: 0, mid: 1000, max: 2000 }, p, c);
  near(r.co2_g.mid, p.co2_g_per_kwh);
  near(r.co2_g.max, 2 * p.co2_range.max);
  near(r.cost.mid, p.price_per_kwh);
  near(r.water_ml.mid, 1000 * c.water.grid_l_per_kwh.value.mid);
  const w = convert({ min: 0, mid: 1000, max: 0 }, p, c, { min: 0, mid: 100, max: 0 });
  near(w.water_ml.mid, 100 * c.water.onsite_l_per_kwh_dc.value.mid + 1000 * c.water.grid_l_per_kwh.value.mid);
});

test('profilo e override utente (un valore proprio sostituisce l\'intervallo)', () => {
  assert.equal(resolveProfile(c, { profile: 'jp' }).currency, 'JPY');
  const o = resolveProfile(c, { profile: 'it', overrides: { price_per_kwh: 0.5, co2_g_per_kwh: 100 } });
  assert.equal(o.price_per_kwh, 0.5);
  assert.equal(o.price_range, undefined);
  assert.equal(o.co2_range, undefined);
  assert.equal(resolveProfile(c, { profile: 'xx' }).label, 'Italia');
});

test('affidabilità e incompletezza (AI immagini e video: parte remota non stimata)', () => {
  assert.equal(estimateEntry({ n: 3, b: 0, ms: 1000 }, 'browsing', c).reliability, 'low');
  assert.equal(estimateEntry({ n: 3, b: 10, ms: 1000 }, 'browsing', c).reliability, 'medium');
  for (const cat of ['ai_video', 'ai_image']) assert.equal(estimateEntry({ n: 1, b: 1, ms: 1 }, cat, c).incomplete, true);
  const s = sumEstimates([estimateEntry({ n: 1, b: 1, ms: 1 }, 'ai_video', c), estimateEntry({ n: 1, b: 1, ms: 1 }, 'browsing', c)]);
  assert.equal(s.incomplete, true);
  assert.equal(s.reliability, 'low');
  assert.ok(s.dc_wh.mid > 0);
});

test('ogni coefficiente: min<=mid<=max e fonti esistenti', () => {
  const check = (x, name) => {
    const ranges = x.types ? Object.values(x.types) : x.value ? [x.value] : [];
    for (const v of ranges) assert.ok(v.min <= v.mid && v.mid <= v.max, name);
    for (const s of x.sources) assert.ok(c.sources[s], `fonte mancante: ${s} in ${name}`);
  };
  for (const [k, x] of [...Object.entries(c.energy), ...Object.entries(c.water)]) check(x, k);
  for (const [k, p] of Object.entries(c.profiles)) {
    for (const s of p.sources) assert.ok(c.sources[s], `fonte mancante: ${s} in ${k}`);
    if (p.co2_range) assert.ok(p.co2_range.min <= p.co2_g_per_kwh && p.co2_g_per_kwh <= p.co2_range.max, k);
    if (p.price_range) assert.ok(p.price_range.min <= p.price_per_kwh && p.price_per_kwh <= p.price_range.max, k);
  }
});
