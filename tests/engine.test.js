import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { estimateEntry, convert, sumEstimates, resolveProfile } from '../src/engine.js';

const c = JSON.parse(readFileSync(new URL('../data/coefficients.json', import.meta.url)));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('navigazione: 1 GB senza tempo = 114 Wh (rete + data center)', () => {
  near(estimateEntry({ n: 1, b: 1e9, ms: 0 }, 'browsing', c).wh.mid, 114);
});

test('dispositivo: 1 ora = 20 Wh; streaming aggiunge 77 Wh e non usa i byte', () => {
  near(estimateEntry({ n: 1, b: 0, ms: 3.6e6 }, 'browsing', c).wh.mid, 20);
  near(estimateEntry({ n: 1, b: 5e9, ms: 3.6e6 }, 'streaming', c).wh.mid, 97);
});

test('AI testuale: 1 ora = 20 + 10 prompt x 0,24 Wh', () => {
  near(estimateEntry({ n: 1, b: 0, ms: 3.6e6 }, 'ai_text', c).wh.mid, 22.4);
});

test('conversioni con profilo Italia', () => {
  const r = convert({ min: 0, mid: 1000, max: 2000 }, resolveProfile(c, {}), c);
  near(r.co2_g.mid, 331);
  near(r.cost.mid, 0.32);
  near(r.water_ml.mid, 4000);
  near(r.co2_g.max, 662);
});

test('profilo e override utente', () => {
  assert.equal(resolveProfile(c, { profile: 'jp' }).currency, 'JPY');
  assert.equal(resolveProfile(c, { profile: 'it', overrides: { price_per_kwh: 0.5 } }).price_per_kwh, 0.5);
  assert.equal(resolveProfile(c, { profile: 'xx' }).label, 'Italia');
});

test('affidabilità e incompletezza', () => {
  assert.equal(estimateEntry({ n: 3, b: 0, ms: 1000 }, 'browsing', c).reliability, 'low');
  assert.equal(estimateEntry({ n: 3, b: 10, ms: 1000 }, 'browsing', c).reliability, 'medium');
  const s = sumEstimates([estimateEntry({ n: 1, b: 1, ms: 1 }, 'ai_video', c), estimateEntry({ n: 1, b: 1, ms: 1 }, 'browsing', c)]);
  assert.equal(s.incomplete, true);
  assert.equal(s.reliability, 'low');
});

test('ogni coefficiente ha min<=mid<=max e fonti esistenti', () => {
  const all = [...Object.values(c.energy), c.water_l_per_kwh];
  for (const x of all) {
    if (x.value) assert.ok(x.value.min <= x.value.mid && x.value.mid <= x.value.max);
    for (const s of x.sources) assert.ok(c.sources[s], `fonte mancante: ${s}`);
  }
  for (const p of Object.values(c.profiles)) for (const s of p.sources) assert.ok(c.sources[s]);
});
