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

test('richieste senza dimensione dichiarata: dimensione media assunta; ripartizione dispositivo/rete/data center', () => {
  const kb = E.unknown_response_kb.value.mid;
  const r = estimateEntry({ n: 10, b: 0, nu: 10, ms: 0 }, 'browsing', c);
  near(r.wh.mid, (10 * kb * 1000 / 1e9) * (NET + DC) * 1000);
  assert.equal(r.reliability, 'low');          // tutte senza dimensione dichiarata
  const known = estimateEntry({ n: 10, b: 1e6, nu: 1, ms: 3.6e6 }, 'browsing', c);
  assert.equal(known.reliability, 'medium');   // poche richieste senza dimensione
  near(known.wh.mid, P + ((1e6 + kb * 1000) / 1e9) * (NET + DC) * 1000);
  near(known.device_wh.mid, P);
  assert.ok(known.wh.mid > known.device_wh.mid + known.dc_wh.mid);   // resta la quota di rete
  // voci vecchie senza il campo u: comportamento precedente (nessuna stima aggiunta)
  near(estimateEntry({ n: 5, b: 0, ms: 0 }, 'browsing', c).wh.mid, 0);
});

test('dispositivo: 1 ora = potenza del tipo scelto; streaming usa il tempo, non i byte', () => {
  near(estimateEntry({ n: 1, b: 0, ms: 3.6e6 }, 'browsing', c).wh.mid, P);
  near(estimateEntry({ n: 1, b: 0, ms: 3.6e6 }, 'browsing', c, 'desktop').wh.mid, E.device_power_w.types.desktop.mid);
  near(estimateEntry({ n: 1, b: 0, ms: 3.6e6 }, 'browsing', c, 'sconosciuto').wh.mid, P); // ripiego sul predefinito
  const s = estimateEntry({ n: 1, b: 2e9, ms: 3.6e6 }, 'streaming', c); // 2 GB/h: sotto la soglia 4K
  near(s.wh.mid, P + E.streaming_kwh_per_hour.value.mid * 1000);
  near(s.dc_wh.mid, E.streaming_kwh_per_hour.value.mid * 1000 * E.dc_share_of_remote.value.mid);
  assert.deepEqual(devicePower(c, 'phone'), E.device_power_w.types.phone);
});

test('streaming: media realistica per eccesso; solo i flussi da 4K alzano il riferimento', () => {
  const ref = E.streaming_kwh_per_hour.value.mid * 1000;
  const at = (gbPerHour, ms = 3.6e6) => estimateEntry({ n: 1, b: gbPerHour * 1e9 * (ms / 3.6e6), ms }, 'streaming', c).wh.mid - P * (ms / 3.6e6);
  near(at(0), ref);                  // byte non noti: riferimento
  near(at(0.3), ref);                // flusso basso (o byte sottostimati): non scende sotto il riferimento
  near(at(3), ref);                  // HD
  near(at(7), ref * E.streaming_uhd_factor.value.mid); // 4K
  near(at(7, 1.8e6), (ref / 2) * E.streaming_uhd_factor.value.mid); // mezz'ora a velocità da 4K
  assert.ok(E.streaming_kwh_per_hour.value.mid > 0.08, 'il riferimento deve stare sopra la media realistica (circa 0,08 kWh/h)');
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
    assert.ok(['sourced', 'to_verify'].includes(p.co2_status) && ['sourced', 'to_verify'].includes(p.price_status), `stati del profilo ${k}`);
    assert.ok(p.co2_reference && p.price_reference, `riferimenti del profilo ${k}`);
    if (p.co2_range) assert.ok(p.co2_range.min <= p.co2_g_per_kwh && p.co2_g_per_kwh <= p.co2_range.max, k);
    if (p.price_range) assert.ok(p.price_range.min <= p.price_per_kwh && p.price_per_kwh <= p.price_range.max, k);
  }
});

test('richieste senza dimensione abbassano l\'affidabilità in proporzione', () => {
  const r = (nu) => estimateEntry({ n: 10, b: 1e6, nu, ms: 1000 }, 'browsing', c);
  assert.equal(r(0).reliability, 'medium');
  assert.equal(r(2).reliability, 'medium');
  assert.equal(r(6).reliability, 'low');
  assert.equal(r(3).unsized, 3);
});

import { rankSites } from '../src/engine.js';
test('rankSites: totale con quote, per ora solo oltre il tempo minimo', () => {
  const rows = [
    { host: 'a.com', e: { ms: 60 * 60000 }, v: 10 },   // 1 h, 10 -> 10/h
    { host: 'b.com', e: { ms: 6 * 60000 }, v: 6 },     // 0,1 h, 6 -> 60/h
    { host: 'c.com', e: { ms: 60000 }, v: 30 },        // 1 min: troppo poco per l'ora
    { host: 'd.com', e: {}, v: 4 },                    // nessun tempo
  ];
  const val = (r) => r.v;
  const tot = rankSites(rows, val, 'total');
  assert.deepEqual(tot.rows.map((r) => r.host), ['c.com', 'a.com', 'b.com', 'd.com']);
  assert.ok(Math.abs(tot.rows[0].share - 0.6) < 1e-9);
  const hr = rankSites(rows, val, 'hour');
  assert.deepEqual(hr.rows.map((r) => r.host), ['b.com', 'a.com']);
  assert.ok(Math.abs(hr.rows[0].v - 60) < 1e-9);
  assert.equal(hr.hidden, 2);
  assert.equal(rankSites(rows, val, 'total', { limit: 2 }).rows.length, 2);
  assert.deepEqual(rankSites([], val, 'hour'), { rows: [], hidden: 0, count: 0 });
});
