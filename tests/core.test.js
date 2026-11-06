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
