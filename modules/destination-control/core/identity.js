// Identificazione locale di un indirizzo IP tramite un dataset di reti (CIDR). Nessuna rete, nessun servizio esterno.
// Prefisso più lungo vince. IPv4 e IPv6 condividono lo stesso indice (BigInt).

/** Legge un IP in { v: 4|6, n: BigInt } oppure null. Accetta IPv6 con "::" e IPv4 mappato (::ffff:a.b.c.d). */
export function parseIp(text) {
  const s = String(text ?? '').trim().replace(/^\[|\]$/g, '').split('%')[0];
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (v4) {
    const p = v4.slice(1).map(Number);
    if (p.some((x) => x > 255)) return null;
    return { v: 4, n: BigInt(((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]) };
  }
  if (!s.includes(':')) return null;
  let str = s;
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(str);
  if (tail) {
    const a = parseIp(tail[1]);
    if (!a) return null;
    const n = Number(a.n);
    str = str.slice(0, -tail[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = str.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = halves.length === 1 ? head : [...head, ...Array(missing).fill('0'), ...rest];
  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  // IPv4 mappato in IPv6: si cerca come IPv4.
  if (n >> 32n === 0xffffn) return { v: 4, n: n & 0xffffffffn };
  return { v: 6, n };
}

/** Legge "a.b.c.d/len" o "x::/len" in { v, len, start } oppure null. */
export function parseCidr(text) {
  const [ip, lenText] = String(text ?? '').split('/');
  const p = parseIp(ip);
  if (!p || !/^\d+$/.test(lenText ?? '')) return null;
  const bits = p.v === 4 ? 32 : 128, len = Number(lenText);
  if (len > bits) return null;
  const host = BigInt(bits - len);
  return { v: p.v, len, start: (p.n >> host) << host };
}

/** Indice di ricerca: per ogni versione e lunghezza di prefisso, mappa inizio-rete -> rete. */
export function buildIndex(dataset) {
  const idx = { 4: new Map(), 6: new Map() };
  const datasets = Object.fromEntries((dataset?.datasets ?? []).map((d) => [d.id, d]));
  let count = 0;
  for (const net of dataset?.networks ?? []) {
    const c = parseCidr(net.cidr);
    if (!c) continue;
    const byLen = idx[c.v];
    if (!byLen.has(c.len)) byLen.set(c.len, new Map());
    byLen.get(c.len).set(c.start, net);
    count++;
  }
  const lens = { 4: [...idx[4].keys()].sort((a, b) => b - a), 6: [...idx[6].keys()].sort((a, b) => b - a) };
  return { idx, lens, datasets, count, updated: latest(dataset?.datasets) };
}

function latest(datasets) {
  return (datasets ?? []).map((d) => d.updated).filter(Boolean).sort().pop() ?? null;
}

/** La rete più specifica che contiene l'IP, con il dataset di provenienza; null se sconosciuta. */
export function lookupIp(index, ip) {
  const p = parseIp(ip);
  if (!p || !index) return null;
  const bits = p.v === 4 ? 32 : 128;
  for (const len of index.lens[p.v]) {
    const host = BigInt(bits - len);
    const net = index.idx[p.v].get(len)?.get((p.n >> host) << host);
    if (net) return { net, dataset: index.datasets[net.dataset] ?? null };
  }
  return null;
}
