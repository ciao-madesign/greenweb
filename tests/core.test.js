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

import { privacyOf, normalizeDomain, parseDomainList, isExcluded, purgeHosts, csvFromDays } from '../src/core.js';

test('privacyOf: valori predefiniti prudenti e validazione', () => {
  assert.deepEqual(privacyOf({}), { paused: false, retentionDays: 90, excluded: [], aiServices: {} });
  assert.equal(privacyOf({ retentionDays: 5 }).retentionDays, 90);
  assert.equal(privacyOf({ retentionDays: 30, paused: true }).paused, true);
});

test('normalizeDomain / parseDomainList', () => {
  assert.equal(normalizeDomain('https://www.Banca.it/conto?x=1'), 'banca.it');
  assert.equal(normalizeDomain('  mail.example.com:8080 '), 'mail.example.com');
  assert.equal(normalizeDomain('localhost'), 'localhost');
  assert.equal(normalizeDomain('non un dominio'), null);
  assert.equal(normalizeDomain('senzapunto'), null);
  assert.deepEqual(parseDomainList('banca.it\nwww.banca.it, salute.example.org  https://x.com/a'), ['banca.it', 'salute.example.org', 'x.com']);
});

test('isExcluded: dominio e sottodomini, non omonimi parziali', () => {
  const list = ['banca.it'];
  assert.equal(isExcluded('banca.it', list), true);
  assert.equal(isExcluded('app.banca.it', list), true);
  assert.equal(isExcluded('labanca.it', list), false);
  assert.equal(isExcluded('banca.it.evil.com', list), false);
});

test('purgeHosts e csvFromDays', () => {
  const rec = { 'banca.it': { n: 1, b: 2, ms: 3000 }, 'app.banca.it': { n: 1, b: 1, ms: 1 }, 'a.com': { n: 4, b: 5, ms: 6000 } };
  assert.deepEqual(Object.keys(purgeHosts(rec, ['banca.it'])), ['a.com']);
  assert.equal(csvFromDays({ '2026-11-09': { 'a.com': { n: 4, b: 5, ms: 6000 } } }), 'day,domain,requests,bytes,requests_without_size,active_seconds,ai_messages,ai_counted_seconds,model_version,coefficient_version\n2026-11-09,"a.com",4,5,0,6,0,0,"",""\n');
});

import { matchAdapter, stripAiFields, maskPath } from '../src/core.js';

test('matchAdapter: metodo, dominio e percorso; mai altro', () => {
  const ad = JSON.parse(readFileSync(new URL('../data/ai_adapters.json', import.meta.url))).adapters;
  assert.equal(matchAdapter('POST', 'https://chatgpt.com/backend-api/conversation', ad)?.id, 'chatgpt');
  assert.equal(matchAdapter('POST', 'https://chatgpt.com/backend-api/f/conversation?x=1', ad)?.id, 'chatgpt');
  assert.equal(matchAdapter('GET', 'https://chatgpt.com/backend-api/conversation', ad), null);
  assert.equal(matchAdapter('POST', 'https://chatgpt.com/backend-api/conversations', ad), null);
  assert.equal(matchAdapter('POST', 'https://claude.ai/api/organizations/o1/chat_conversations/c9/completion', ad)?.id, 'claude');
  assert.equal(matchAdapter('POST', 'https://www.perplexity.ai/rest/sse/perplexity_ask', ad)?.id, 'perplexity');
  assert.equal(matchAdapter('POST', 'https://altro.example/backend-api/conversation', ad), null);
  assert.equal(matchAdapter('POST', 'non un url', ad), null);
  assert.equal(matchAdapter('POST', 'https://x.test/a', [{ domain: 'x.test', method: 'POST', path: '(' }]), null); // regex non valida
  for (const a of ad) assert.ok(a.id && a.label && a.domain && a.path && a.kind === 'text' && ['reported', 'unconfirmed', 'verified'].includes(a.status) && Array.isArray(a.evidence));
});

test('addSample con conteggio AI e stripAiFields', () => {
  const m = {};
  addSample(m, 'd', 'chatgpt.com', { ms: 60000, msc: 60000 });
  addSample(m, 'd', 'chatgpt.com', { p: 2 });
  assert.deepEqual(m.d['chatgpt.com'], { n: 0, b: 0, ms: 60000, p: 2, msc: 60000 });
  const m2 = {};
  addSample(m2, 'd', 'a.com', { n: 3, nu: 2 });
  assert.equal(m2.d['a.com'].nu, 2);
  assert.deepEqual(stripAiFields(m.d), { 'chatgpt.com': { n: 0, b: 0, ms: 60000 } });
});

test('il service worker non legge mai il corpo delle richieste', () => {
  const sw = readFileSync(new URL('../src/background.js', import.meta.url), 'utf8');
  assert.doesNotMatch(sw, /requestBody/);
  assert.doesNotMatch(sw, /filterResponseData|debugger/);
});

test('maskPath: nasconde gli identificativi, conserva il percorso', () => {
  assert.equal(maskPath('/api/organizations/0b1c2d3e-1111-2222-3333-444455556666/chat_conversations/9f8e7d6c-aaaa-bbbb-cccc-ddddeeeeffff/completion'), '/api/organizations/:id/chat_conversations/:id/completion');
  assert.equal(maskPath('/backend-api/conversation'), '/backend-api/conversation');
  assert.equal(maskPath('/rest/sse/perplexity_ask'), '/rest/sse/perplexity_ask');
  assert.equal(maskPath('/v1/threads/1234567/messages'), '/v1/threads/:id/messages');
  assert.equal(maskPath('/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate'), '/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate');
  assert.equal(maskPath('/a/AbCdEfGhIjKlMnOpQrStUvWx'), '/a/:id');
});

import { mergeMeta, metaStorageKey } from '../src/core.js';
test('mergeMeta registra le versioni senza duplicati; le chiavi meta scadono con i giorni', () => {
  const a = mergeMeta(undefined, 2, '1@x');
  assert.deepEqual(mergeMeta(a, 2, '1@x'), { m: [2], c: ['1@x'] });
  assert.deepEqual(mergeMeta(a, 3, '1@x'), { m: [2, 3], c: ['1@x'] });
  assert.deepEqual(expiredDayKeys([metaStorageKey('2020-01-01'), metaStorageKey('2026-11-05')], 90, new Date('2026-11-06')), ['meta:2020-01-01']);
});

test('matchAdapter: rapporto reale di ChatGPT (11 novembre 2026), conta solo l\'invio del messaggio', () => {
  const ad = JSON.parse(readFileSync(new URL('../data/ai_adapters.json', import.meta.url))).adapters;
  const seen = [
    'https://chatgpt.com/backend-api/f/conversation/prepare', 'https://chatgpt.com/ces/v1/rgstr',
    'https://chatgpt.com/backend-api/sentinel/chat-requirements/prepare', 'https://chatgpt.com/backend-api/sentinel/chat-requirements/finalize',
    'https://ab.chatgpt.com/v1/initialize', 'https://chatgpt.com/backend-api/bazaar/visibility', 'https://chatgpt.com/backend-api/bazaar/event',
    'https://chatgpt.com/ces/v1/telemetry/intake', 'https://chatgpt.com/ces/statsc/flush',
  ];
  for (const u of seen) assert.equal(matchAdapter('POST', u, ad), null, u);
  assert.equal(matchAdapter('POST', 'https://chatgpt.com/backend-api/f/conversation', ad)?.id, 'chatgpt');
  assert.equal(ad.find((a) => a.id === 'chatgpt').status, 'verified');
});
