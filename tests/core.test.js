import test from 'node:test';
import assert from 'node:assert/strict';
import { hostFromUrl, classify, addSample, contentLength, badgeText, expiredDayKeys, dayStorageKey } from '../src/core.js';

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

test('addSample somma i campioni; expiredDayKeys elimina solo i giorni vecchi', () => {
  const a = {};
  addSample(a, '2026-11-06', 'x.com', { n: 1, b: 10 });
  addSample(a, '2026-11-06', 'x.com', { ms: 5 });
  assert.deepEqual(a['2026-11-06']['x.com'], { n: 1, b: 10, ms: 5 });
  const keys = ['day:2020-01-01', 'day:2026-11-06', 'settings', 'session'].concat(dayStorageKey('2026-08-01'));
  assert.deepEqual(expiredDayKeys(keys, 90, new Date('2026-11-06')), ['day:2020-01-01', 'day:2026-08-01']);
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
  assert.equal(badgeValue('cost', 0.25), '.25');
  assert.equal(badgeValue('cost', 0.0634), '.063');
  assert.equal(badgeValue('co2e', 0.87), '.87g');
  assert.equal(badgeValue('co2e', 0.004), '<.01g');
  assert.equal(badgeValue('water', 0.45), '.45m');
  assert.equal(badgeValue('co2e', 0.999), '1.0g');
  assert.equal(badgeValue('co2e', 0), '0');
});

test('soglie: derivate dal riferimento, override utente, semaforo', () => {
  const c = JSON.parse(readFileSync(new URL('../data/coefficients.json', import.meta.url)));
  const p = resolveProfile(c, {});
  const [lo, hi] = thresholdsFor('co2e', {}, p, c);
  const ref = c.reference_thresholds_wh_per_day;
  assert.ok(Math.abs(lo - (ref.low / 1000) * p.co2_g_per_kwh) < 1e-6 && Math.abs(hi - (ref.high / 1000) * p.co2_g_per_kwh) < 1e-6);
  assert.deepEqual(thresholdsFor('co2e', { thresholds: { co2e: [1, 2] } }, p, c), [1, 2]);
  assert.equal(levelOf(1, [5, 10]), 'green');
  assert.equal(levelOf(5, [5, 10]), 'yellow');
  assert.equal(levelOf(10, [5, 10]), 'red');
  assert.equal(metricOf({ metric: 'boh' }), 'co2e');
  assert.equal(estimateDay({}, {}, () => 'other', c).wh.mid, 0);
});

import { lastNDays, aggregateDays } from '../src/core.js';
import { equivalences } from '../src/engine.js';

test('lastNDays e aggregateDays', () => {
  const days = lastNDays(3, new Date('2026-03-02T12:00:00'));
  assert.deepEqual(days, ['2026-03-02', '2026-03-01', '2026-02-28']);
  const stats = { '2026-03-02': { 'a.com': { n: 1, b: 10, ms: 5 } }, '2026-03-01': { 'a.com': { n: 2, b: 5, ms: 1 }, 'b.com': { n: 1, b: 1, ms: 1 } }, '2020-01-01': { 'x.com': { n: 9, b: 9, ms: 9 } } };
  const agg = aggregateDays(stats, days);
  assert.deepEqual(agg['a.com'], { n: 3, b: 15, ms: 6 });
  assert.equal(agg['x.com'], undefined);
});

test('equivalenze: auto, lampadina, bottiglie, lavatrice', () => {
  const c = JSON.parse(readFileSync(new URL('../data/coefficients.json', import.meta.url)));
  const eq = JSON.parse(readFileSync(new URL('../data/equivalences.json', import.meta.url)));
  const p = resolveProfile(c, {});
  const q = (id) => eq.params[id].value;
  const r = Object.fromEntries(equivalences({ wh: 100, co2_g: q('car_g_per_km'), water_ml: q('bottle_ml') * 2, cost: q('washing_kwh') * p.price_per_kwh }, p, eq).map((x) => [x.id, x.value]));
  assert.ok(Math.abs(r.car_km - 1) < 1e-9);
  assert.ok(Math.abs(r.led_hours - 100 / q('led_w')) < 1e-9);
  assert.ok(Math.abs(r.bottles - 2) < 1e-9);
  assert.ok(Math.abs(r.washing_cycles - 1) < 1e-9);
  assert.ok(Math.abs(r.light_hours_co2 - q('car_g_per_km') / ((q('led_w') / 1000) * p.co2_g_per_kwh)) < 1e-9);
  for (const it of eq.items) for (const id of it.params) assert.ok(eq.params[id]);
});

test('manifest: nessuna connessione esterna consentita dalla CSP', () => {
  const m = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
  const csp = m.content_security_policy.extension_pages;
  assert.match(csp, /connect-src 'self'/);
  assert.doesNotMatch(csp, /https?:|\*/);
});
