// Costruisce modules/destination-control/database/ranges.json da elenchi pubblici ufficiali già scaricati.
// Nessuna rete: si passano i file locali. Uso:
//   node scripts/build-destinations.mjs --out modules/destination-control/database/ranges.json \
//     --aws ip-ranges.json --cloudflare-v4 ips-v4.txt --cloudflare-v6 ips-v6.txt --fastly public-ip-list.json --google cloud.json \
//     --date 2026-11-12
// Le fonti ufficiali sono indicate sotto; la licenza va verificata a ogni aggiornamento.
import { readFileSync, writeFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const date = args.date ?? new Date().toISOString().slice(0, 10);
const out = args.out ?? 'modules/destination-control/database/ranges.json';
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const lines = (p) => readFileSync(p, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

const datasets = [], networks = [];
const add = (id, title, url, license, list) => {
  datasets.push({ id, title, source: url, license, updated: date, confidence: 'verified' });
  for (const n of list) networks.push({ ...n, dataset: id });
};

if (args.aws) {
  const j = json(args.aws);
  const rows = [...(j.prefixes ?? []).map((p) => ({ cidr: p.ip_prefix, region: p.region, service: p.service })),
    ...(j.ipv6_prefixes ?? []).map((p) => ({ cidr: p.ipv6_prefix, region: p.region, service: p.service }))];
  add('aws', 'AWS IP address ranges', 'https://ip-ranges.amazonaws.com/ip-ranges.json', 'AWS Customer Agreement / public file',
    rows.map((r) => ({ cidr: r.cidr, owner: 'Amazon Web Services', provider: 'Amazon Web Services', type: r.service === 'CLOUDFRONT' ? 'cdn' : 'cloud', region: r.region === 'GLOBAL' ? null : r.region, region_declared_by_operator: true })));
}
if (args['cloudflare-v4'] || args['cloudflare-v6']) {
  const rows = [...(args['cloudflare-v4'] ? lines(args['cloudflare-v4']) : []), ...(args['cloudflare-v6'] ? lines(args['cloudflare-v6']) : [])];
  add('cloudflare', 'Cloudflare IP ranges', 'https://www.cloudflare.com/ips/', 'public file', rows.map((cidr) => ({ cidr, owner: 'Cloudflare', provider: 'Cloudflare', type: 'cdn' })));
}
if (args.fastly) {
  const j = json(args.fastly);
  add('fastly', 'Fastly public IP list', 'https://api.fastly.com/public-ip-list', 'public API', [...(j.addresses ?? []), ...(j.ipv6_addresses ?? [])].map((cidr) => ({ cidr, owner: 'Fastly', provider: 'Fastly', type: 'cdn' })));
}
if (args.google) {
  const j = json(args.google);
  add('google-cloud', 'Google Cloud IP ranges', 'https://www.gstatic.com/ipranges/cloud.json', 'public file',
    (j.prefixes ?? []).map((p) => ({ cidr: p.ipv4Prefix ?? p.ipv6Prefix, owner: 'Google Cloud', provider: 'Google Cloud', type: 'cloud', region: p.scope, region_declared_by_operator: true })).filter((n) => n.cidr));
}

writeFileSync(out, `${JSON.stringify({ schema: 1, generated: date, datasets, networks })}\n`);
console.log(`${out}: ${networks.length} reti da ${datasets.length} fonti`);
