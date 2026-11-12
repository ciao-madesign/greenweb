import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIp, parseCidr, buildIndex, lookupIp } from '../core/identity.js';
import { classifyDestination } from '../core/classification.js';
import { addDestination, mergeDestinations, summarize, csvFromDestinations } from '../core/audit.js';
import { createMonitor } from '../core/monitor.js';

const data = {
  datasets: [{ id: 'cf', updated: '2026-11-12', confidence: 'verified' }, { id: 'weak', updated: '2026-01-01', confidence: 'probable' }],
  networks: [
    { cidr: '104.16.0.0/13', owner: 'Cloudflare', type: 'cdn', dataset: 'cf' },
    { cidr: '104.16.5.0/24', owner: 'Piccola rete', type: 'hosting', country: 'IT', dataset: 'weak' },
    { cidr: '2606:4700::/32', owner: 'Cloudflare', type: 'cdn', dataset: 'cf' },
  ],
};
const index = buildIndex(data);

test('parseIp: IPv4, IPv6, IPv4 mappato e non validi', () => {
  assert.equal(parseIp('1.2.3.4').v, 4);
  assert.equal(parseIp('256.1.1.1'), null);
  assert.equal(parseIp('2606:4700::1').v, 6);
  assert.deepEqual(parseIp('::ffff:1.2.3.4'), parseIp('1.2.3.4'));
  assert.equal(parseIp('1::2::3'), null);
  assert.equal(parseIp('not-an-ip'), null);
  assert.equal(parseCidr('10.0.0.0/33'), null);
});

test('lookupIp: prefisso più lungo vince, IPv6 e sconosciuti', () => {
  assert.equal(lookupIp(index, '104.16.9.9').net.owner, 'Cloudflare');
  assert.equal(lookupIp(index, '104.16.5.7').net.owner, 'Piccola rete');
  assert.equal(lookupIp(index, '2606:4700:10::1').net.owner, 'Cloudflare');
  assert.equal(lookupIp(index, '8.8.8.8'), null);
  assert.equal(lookupIp(index, null), null);
  assert.equal(index.updated, '2026-11-12');
});

test('classificazione: attendibilità per campo, nessuna falsa certezza sul luogo', () => {
  const c = classifyDestination({ host: 'a.com', ip: '104.16.5.7' }, index);
  assert.equal(c.provider.confidence, 'probable'); // dataset non verificato
  assert.equal(c.country.confidence, 'probable'); // mai "verified" per il paese
  for (const f of ['data_center', 'processing_location', 'storage_location']) assert.equal(c[f].confidence, 'unknown');
  const v = classifyDestination({ host: 'b.com', ip: '104.16.9.9' }, index);
  assert.equal(v.provider.confidence, 'verified');
  assert.equal(v.country.confidence, 'unknown'); // il dataset non lo dichiara
  assert.equal(v.shared, true); // IP di CDN: condiviso
  assert.equal(v.complete, false);
  const u = classifyDestination({ host: 'c.com', ip: '8.8.8.8' }, index);
  assert.equal(u.identified, false);
  assert.equal(u.confidence, 'unknown');
  assert.equal(classifyDestination({ host: 'd.com', ip: null }, null).identified, false);
});

test('registro: contatori, limite di IP, unione e riepilogo', () => {
  const rec = {};
  for (let i = 0; i < 8; i++) addDestination(rec, 'a.com', `1.1.1.${i}`);
  addDestination(rec, 'b.com', null);
  assert.equal(rec['a.com'].n, 8);
  assert.equal(Object.keys(rec['a.com'].ips).length, 5);
  assert.equal(rec['a.com'].ni, 3);
  const m = mergeDestinations({}, rec);
  mergeDestinations(m, rec);
  assert.equal(m['a.com'].n, 16);
  const s = summarize([{ 'x.com': { n: 3, ips: { '104.16.9.9': 3 }, t: 1 }, 'y.com': { n: 1, ips: {}, t: 1 } }], (h, ip) => classifyDestination({ host: h, ip }, index));
  assert.equal(s.requests, 4);
  assert.equal(s.identified, 3);
  assert.equal(s.noIp, 1);
});

test('CSV: nessun URL, solo dominio, IP e contatori', () => {
  const csv = csvFromDestinations({ '2026-11-12': { 'a.com': { n: 2, ips: { '104.16.9.9': 2 }, t: 1 } } }, (h, ip) => classifyDestination({ host: h, ip }, index));
  assert.match(csv, /^day,domain,ip,requests,provider/);
  assert.match(csv, /2026-11-12,"a.com","104.16.9.9",2,"Cloudflare",verified/);
});

test('monitor: registra solo se consentito, mai url completi, salva in blocco', async () => {
  const store = {};
  const api = { storage: { local: { get: async (k) => Object.fromEntries(k.map((x) => [x, store[x]]).filter(([, v]) => v), ), set: async (o) => Object.assign(store, o) } } };
  let on = false;
  const m = createMonitor({ api, today: () => '2026-11-12', isMonitored: () => on });
  m.observe({ url: 'https://a.com/x?token=SEGRETO', ip: '104.16.9.9' });
  await m.flush();
  assert.deepEqual(store, {});
  on = true;
  m.observe({ url: 'https://a.com/x?token=SEGRETO', ip: '104.16.9.9' });
  m.observe({ url: 'https://a.com/y', ip: '104.16.9.9' });
  m.observe({ url: 'non-un-url' });
  await m.flush();
  assert.equal(store['dest:2026-11-12']['a.com'].n, 2);
  assert.ok(!JSON.stringify(store).includes('SEGRETO'));
  m.observe({ url: 'https://b.com/', ip: null });
  m.reset();
  await m.flush();
  assert.equal(store['dest:2026-11-12']['b.com'], undefined);
});
