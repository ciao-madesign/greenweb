// Registro locale delle destinazioni: per giorno e dominio di destinazione, solo contatori e IP osservati.
// Mai URL, parametri, cookie, credenziali o contenuti. Chiave di archiviazione: dest:<giorno>.
export const destStorageKey = (day) => `dest:${day}`;
const MAX_IPS = 5; // IP distinti ricordati per dominio (un dominio può cambiare indirizzo)

/** Somma una richiesta in rec[dominio] = { n, ips: { ip: n }, t: ultima osservazione }. */
export function addDestination(rec, host, ip, now = Date.now()) {
  const e = (rec[host] ??= { n: 0, ips: {}, t: 0 });
  e.n += 1;
  e.t = now;
  if (ip) {
    if (ip in e.ips || Object.keys(e.ips).length < MAX_IPS) e.ips[ip] = (e.ips[ip] ?? 0) + 1;
    else e.ni = (e.ni ?? 0) + 1; // IP oltre il limite: contati, non elencati
  }
}

/** Unisce un record in un altro (stessa forma). */
export function mergeDestinations(into, from) {
  for (const [host, e] of Object.entries(from ?? {})) {
    const t = (into[host] ??= { n: 0, ips: {}, t: 0 });
    t.n += e.n;
    t.t = Math.max(t.t, e.t ?? 0);
    for (const [ip, n] of Object.entries(e.ips ?? {})) {
      if (ip in t.ips || Object.keys(t.ips).length < MAX_IPS) t.ips[ip] = (t.ips[ip] ?? 0) + n;
      else t.ni = (t.ni ?? 0) + n;
    }
    if (e.ni) t.ni = (t.ni ?? 0) + e.ni;
  }
  return into;
}

/** L'IP più frequente di un dominio, oppure null. */
export const mainIp = (e) => Object.entries(e.ips ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

/**
 * Riepilogo di più giorni: totali e righe classificate.
 * `classify(host, ip)` restituisce la classificazione; le richieste senza IP risultano non identificabili.
 */
export function summarize(days, classify) {
  const merged = {};
  for (const rec of days) mergeDestinations(merged, rec);
  let requests = 0, identified = 0, complete = 0, noIp = 0;
  const rows = Object.entries(merged).map(([host, e]) => {
    const ip = mainIp(e);
    const c = classify(host, ip);
    requests += e.n;
    if (c.identified) identified += e.n;
    if (c.complete) complete += e.n;
    if (!ip) noIp += e.n;
    return { host, ip, n: e.n, t: e.t, c };
  });
  return { rows: rows.sort((a, b) => b.n - a.n), requests, identified, complete, noIp, domains: rows.length };
}

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
/** CSV del registro: esattamente ciò che è memorizzato (dominio, IP, richieste), più l'identificazione attuale. */
export function csvFromDestinations(days, classify) {
  const rows = ['day,domain,ip,requests,provider,provider_confidence,asn,country,country_confidence,type'];
  for (const day of Object.keys(days).sort()) {
    for (const [host, e] of Object.entries(days[day]).sort()) {
      const ip = mainIp(e), c = classify(host, ip);
      rows.push([day, q(host), q(ip), e.n, q(c.provider.value), c.provider.confidence, q(c.asn.value), q(c.country.value), c.country.confidence, q(c.type.value)].join(','));
    }
  }
  return `${rows.join('\n')}\n`;
}
