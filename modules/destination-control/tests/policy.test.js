import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRules, formatRules, sanitizeRules, evaluate, simulate } from '../core/policy.js';
import { buildIndex } from '../core/identity.js';
import { classifyDestination } from '../core/classification.js';

const index = buildIndex({
  datasets: [{ id: 'cf', updated: '2026-11-12', confidence: 'verified' }, { id: 'weak', updated: '2026-01-01', confidence: 'probable' }],
  networks: [
    { cidr: '104.16.0.0/13', owner: 'Cloudflare', provider: 'Cloudflare', type: 'cdn', dataset: 'cf' },
    { cidr: '20.0.0.0/8', owner: 'Hosty', provider: 'Hosty', type: 'hosting', country: 'US', asn: 64500, dataset: 'weak' },
  ],
});
const cls = (host, ip) => classifyDestination({ host, ip }, index);
const ev = (host, ip, rules, o) => evaluate({ host, ip }, cls(host, ip), parseRules(rules).rules, o);

test('parseRules: formati validi, commenti, errori per riga', () => {
  const { rules, errors } = parseRules('# commento\nblock provider Cloudflare\nALLOW domain https://www.Example.com/x\nBLOCK asn AS64500\nPREFER country it\nFOO domain a.com\nBLOCK cidr 10.0.0.0/99\nBLOCK nulla\n');
  assert.deepEqual(rules, [
    { action: 'BLOCK', type: 'provider', value: 'cloudflare' }, { action: 'ALLOW', type: 'domain', value: 'example.com' },
    { action: 'BLOCK', type: 'asn', value: '64500' }, { action: 'PREFER', type: 'country', value: 'IT' }]);
  assert.deepEqual(errors.map((e) => [e.line, e.reason]), [[6, 'action'], [7, 'value'], [8, 'format']]);
  assert.equal(formatRules(rules).split('\n').length, 4);
  assert.deepEqual(sanitizeRules([{ action: 'BLOCK', type: 'domain', value: 'a.com' }, { action: 'X', type: 'domain', value: 'b.com' }, null]), [{ action: 'BLOCK', type: 'domain', value: 'a.com' }]);
});

test('priorità: l\'eccezione per dominio prevale sul provider; più specifico vince', () => {
  const rules = 'BLOCK provider Cloudflare\nALLOW domain ok.example.com\nBLOCK domain example.com';
  assert.equal(ev('ok.example.com', '104.16.0.1', rules).verdict, 'allow'); // sottodominio più specifico
  assert.equal(ev('www.example.com', '104.16.0.1', rules).verdict, 'block');
  assert.equal(ev('altro.net', '104.16.0.1', rules).verdict, 'block'); // solo provider
  assert.equal(ev('altro.net', '104.16.0.1', 'BLOCK cidr 104.16.0.0/13\nALLOW cidr 104.16.5.0/24\nBLOCK country US').verdict, 'block');
  assert.equal(ev('altro.net', '104.16.5.9', 'BLOCK cidr 104.16.0.0/13\nALLOW cidr 104.16.5.0/24').verdict, 'allow'); // prefisso più lungo
  assert.equal(ev('altro.net', '104.16.5.9', 'BLOCK provider Cloudflare\nALLOW ip 104.16.5.9').verdict, 'allow'); // IP prima del provider
});

test('infrastruttura condivisa e dati probabili generano avvisi', () => {
  const r = ev('sito.it', '104.16.0.1', 'BLOCK provider Cloudflare');
  assert.equal(r.verdict, 'block');
  assert.ok(r.warnings.includes('shared'));
  const p = ev('sito.it', '20.1.1.1', 'BLOCK country US');
  assert.ok(p.warnings.includes('probable_data')); // il paese non è mai "verified"
  assert.ok(!ev('sito.it', '104.16.0.1', 'BLOCK domain sito.it').warnings.includes('shared'));
  assert.equal(ev('sito.it', '20.1.1.1', 'BLOCK asn 64500').verdict, 'block');
});

test('PREFER non blocca né autorizza; sconosciuti seguono la scelta dell\'utente', () => {
  assert.equal(ev('a.it', '104.16.0.1', 'PREFER provider Cloudflare').verdict, 'prefer');
  assert.equal(ev('x.it', '8.8.8.8', '').verdict, 'default'); // fail-open
  const u = ev('x.it', '8.8.8.8', '', { unknown: 'block' });
  assert.equal(u.verdict, 'block');
  assert.ok(u.warnings.includes('no_info'));
  assert.equal(ev('x.it', null, 'ALLOW domain x.it', { unknown: 'block' }).verdict, 'allow'); // eccezione esplicita
});

test('simulazione: totali, regole usate e domini su infrastrutture condivise', () => {
  const day = { 'a.it': { n: 6, ips: { '104.16.0.1': 6 }, t: 1 }, 'b.it': { n: 3, ips: { '104.16.0.2': 3 }, t: 1 }, 'ok.it': { n: 1, ips: { '104.16.0.3': 1 }, t: 1 }, 'x.it': { n: 2, ips: { '8.8.8.8': 2 }, t: 1 } };
  const rules = parseRules('BLOCK provider Cloudflare\nALLOW domain ok.it').rules;
  const s = simulate([day], rules, cls, { unknown: 'review' });
  assert.equal(s.requests, 12);
  assert.deepEqual(s.verdicts, { block: 9, allow: 1, review: 2, prefer: 0, default: 0 });
  assert.deepEqual(s.ruleHits[0], { requests: 9, domains: 2 });
  assert.deepEqual(s.sharedBlocked.sort(), ['a.it', 'b.it']);
  assert.equal(s.noInfoDecisions, 2);
  assert.equal(simulate([day], [], cls).verdicts.default, 12);
});
