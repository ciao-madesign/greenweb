import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReport, reportCsv, REPORT_SCHEMA } from '../src/report.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const coeffs = read('../data/coefficients.json');
const catalog = read('../data/catalog.json');
const days = {
  '2026-11-11': {
    'youtube.com': { n: 100, b: 5e6, nu: 40, ms: 900000 },
    'chatgpt.com': { n: 50, b: 1e5, nu: 30, ms: 600000, p: 8, msc: 600000 },
    'ansa.it': { n: 500, b: 7e6, nu: 150, ms: 120000 },
  },
};

test('rapporto: componenti, totali e provenienza', () => {
  const r = buildReport({ days, metas: { '2026-11-11': { m: [4], c: ['1@2026-11-11'] } }, catalog, coeffs, settings: { profile: 'it', device: 'laptop' }, generatedAt: '2026-11-18T00:00:00Z' });
  assert.equal(r.meta.schema, REPORT_SCHEMA);
  assert.equal(r.rows.length, 3);
  for (const row of r.rows) {
    for (const k of ['min', 'mid', 'max']) {
      const e = row.energy_wh;
      assert.ok(Math.abs(e.device[k] + e.network[k] + e.data_center[k] - e.total[k]) < 1e-9, `${row.domain} ${k}`);
      assert.ok(e.network[k] >= 0);
    }
    assert.equal(row.functional_unit, 'domain-day');
    assert.deepEqual(row.model_version, [4]);
  }
  assert.ok(r.meta.scope.excluded.some((x) => x.includes('embodied')));
  assert.equal(r.meta.region.id, 'it');
  assert.equal(r.meta.device.type, 'laptop');
  assert.ok(r.meta.coefficients.network_kwh_per_gb.sources.every((s) => r.meta.sources[s]), 'ogni fonte citata è nel rapporto');
  assert.ok(r.meta.region.co2_reference);
});

test('rapporto: CSV con la stessa struttura delle righe', () => {
  const r = buildReport({ days, catalog, coeffs, settings: {} });
  const lines = reportCsv(r).trim().split('\n');
  assert.equal(lines.length, 1 + r.rows.length);
  const cols = lines[0].split(',').length;
  for (const l of lines.slice(1)) assert.equal(l.split(',').length, cols, l);
  assert.ok(lines[0].includes('energy_total_wh_mid') && lines[0].includes('co2e_g_max') && lines[0].includes('grid_g_co2e_per_kwh'));
});

test('rapporto: un dispositivo sconosciuto ripiega sul predefinito e un profilo diverso cambia le emissioni', () => {
  const a = buildReport({ days, catalog, coeffs, settings: { device: 'boh', profile: 'it' } });
  assert.equal(a.meta.device.type, 'laptop');
  const us = buildReport({ days, catalog, coeffs, settings: { profile: 'us' } });
  assert.ok(us.rows[0].co2e_g.mid > a.rows[0].co2e_g.mid, 'gli USA hanno un\'intensità maggiore dell\'Italia');
  assert.equal(us.meta.region.id, 'us');
});
