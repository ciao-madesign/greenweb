// Logica pura (nessuna API del browser): facile da testare.

/** Dominio dall'URL, senza "www.". Solo http(s); l'URL completo non viene mai conservato. */
export function hostFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/** Giorno locale in formato YYYY-MM-DD. */
export function dayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Categoria del dominio: corrispondenza più specifica (host completo, poi domini superiori). */
export function classify(host, domains) {
  let h = host;
  while (h) {
    if (domains[h]) return domains[h];
    const i = h.indexOf('.');
    if (i < 0) break;
    h = h.slice(i + 1);
  }
  return 'other';
}

/** Somma un campione { n: richieste, b: byte, ms: tempo attivo } in stats[giorno][dominio]. */
export function addSample(stats, day, host, delta) {
  const d = (stats[day] ??= {});
  const e = (d[host] ??= { n: 0, b: 0, ms: 0 });
  e.n += delta.n ?? 0;
  e.b += delta.b ?? 0;
  e.ms += delta.ms ?? 0;
}

export function mergeStats(target, source) {
  for (const [day, hosts] of Object.entries(source)) {
    for (const [host, e] of Object.entries(hosts)) addSample(target, day, host, e);
  }
}

/** Elimina i giorni più vecchi di `keepDays`. */
export function pruneOld(stats, keepDays, now = new Date()) {
  const limit = new Date(now);
  limit.setDate(limit.getDate() - keepDays);
  const min = dayKey(limit);
  for (const day of Object.keys(stats)) if (day < min) delete stats[day];
}

/** Content-Length dalle intestazioni di risposta; 0 se assente (dato non disponibile). */
export function contentLength(headers) {
  for (const h of headers ?? []) {
    if (h.name.toLowerCase() === 'content-length') {
      const v = parseInt(h.value, 10);
      return Number.isFinite(v) && v > 0 ? v : 0;
    }
  }
  return 0;
}

export function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return `${b >= 100 ? b.toFixed(0) : b.toFixed(1)} ${u[i]}`;
}

/** Testo breve per il badge (max ~4 caratteri). */
export function badgeText(bytes) {
  if (bytes < 1024 * 1024) return '<1M';
  const mb = bytes / (1024 * 1024);
  if (mb < 100) return `${Math.round(mb)}M`;
  const gb = mb / 1024;
  return gb < 10 ? `${gb.toFixed(1)}G` : `${Math.round(gb)}G`;
}

function compact(x) {
  if (x >= 10) return String(Math.round(x));
  if (x >= 1) return x.toFixed(1);
  if (x >= 0.1) return x.toFixed(2);
  return x > 0 ? '<.1' : '0';
}

/** Testo del badge per la metrica scelta (breve, indipendente dalla lingua). g/kg, mL/L, costo senza simbolo. */
export function badgeValue(metric, v) {
  if (!(v > 0)) return '0';
  if (metric === 'co2e') return v >= 1000 ? `${compact(v / 1000)}k` : `${compact(v)}g`;
  if (metric === 'water') return v >= 1000 ? `${compact(v / 1000)}L` : `${compact(v)}m`;
  return compact(v);
}
