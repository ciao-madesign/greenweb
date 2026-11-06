import test from 'node:test';
import assert from 'node:assert/strict';
import { hostFromUrl, classify, addSample, mergeStats, pruneOld, contentLength, badgeText } from '../src/core.js';

test('hostFromUrl: solo dominio, solo http(s)', () => {
  assert.equal(hostFromUrl('https://www.example.com/a?b=1#c'), 'example.com');
  assert.equal(hostFromUrl('chrome://extensions'), null);
  assert.equal(hostFromUrl('non un url'), null);
});

test('classify: corrispondenza più specifica, default other', () => {
  const d = { 'google.com': 'search', 'mail.google.com': 'communication' };
  assert.equal(classify('mail.google.com', d), 'communication');
  assert.equal(classify('maps.google.com', d), 'search');
  assert.equal(classify('sconosciuto.it', d), 'other');
});

test('addSample / mergeStats / pruneOld', () => {
  const a = {}; addSample(a, '2026-11-06', 'x.com', { n: 1, b: 10 });
  const b = {}; addSample(b, '2026-11-06', 'x.com', { ms: 5 }); addSample(b, '2020-01-01', 'old.com', { n: 1 });
  mergeStats(a, b);
  assert.deepEqual(a['2026-11-06']['x.com'], { n: 1, b: 10, ms: 5 });
  pruneOld(a, 400, new Date('2026-11-06'));
  assert.equal(a['2020-01-01'], undefined);
});

test('contentLength e badgeText', () => {
  assert.equal(contentLength([{ name: 'Content-Length', value: '123' }]), 123);
  assert.equal(contentLength([]), 0);
  assert.equal(badgeText(500), '<1M');
  assert.equal(badgeText(5 * 1024 * 1024), '5M');
  assert.equal(badgeText(3 * 1024 ** 3), '3.0G');
});

import { badgeValue } from '../src/core.js';
import { thresholdsFor, levelOf, estimateDay, metricOf, resolveProfile } from '../src/engine.js';
import { readFileSync } from 'node:fs';

test('badgeValue per metrica', () => {
  assert.equal(badgeValue('co2e', 2.4), '2.4g');
  assert.equal(badgeValue('co2e', 125), '125g');
  assert.equal(badgeValue('co2e', 1800), '1.8k');
  assert.equal(badgeValue('water', 45), '45m');
  assert.equal(badgeValue('water', 1200), '1.2L');
  assert.equal(badgeValue('cost', 0.25), '0.25');
  assert.equal(badgeValue('co2e', 0), '0');
});

test('soglie: derivate dal riferimento, override utente, semaforo', () => {
  const c = JSON.parse(readFileSync(new URL('../data/coefficients.json', import.meta.url)));
  const p = resolveProfile(c, {});
  const [lo, hi] = thresholdsFor('co2e', {}, p, c);
  assert.ok(Math.abs(lo - 0.15 * 331) < 1e-6 && Math.abs(hi - 0.4 * 331) < 1e-6);
  assert.deepEqual(thresholdsFor('co2e', { thresholds: { co2e: [1, 2] } }, p, c), [1, 2]);
  assert.equal(levelOf(1, [5, 10]), 'green');
  assert.equal(levelOf(5, [5, 10]), 'yellow');
  assert.equal(levelOf(10, [5, 10]), 'red');
  assert.equal(metricOf({ metric: 'boh' }), 'co2e');
  assert.equal(estimateDay({}, {}, () => 'other', c).wh.mid, 0);
});
