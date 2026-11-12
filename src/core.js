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
  // Campi facoltativi del conteggio AI (solo numeri): p = messaggi inviati, msc = tempo coperto dal conteggio.
  if (delta.p) e.p = (e.p ?? 0) + delta.p;
  if (delta.msc) e.msc = (e.msc ?? 0) + delta.msc;
  // ua/ub = richieste (e byte dichiarati) di lavoratori in background di un sito aperto, non attribuibili a una scheda.
  if (delta.ua) e.ua = (e.ua ?? 0) + delta.ua;
  if (delta.ub) e.ub = (e.ub ?? 0) + delta.ub;
  // nu = richieste completate senza dimensione dichiarata (dato non disponibile, non zero byte).
  if (delta.nu) e.nu = (e.nu ?? 0) + delta.nu;
}

/** Versioni del modello usate nella raccolta di un giorno: { m: [modello], c: [coefficienti] }. */
export const metaStorageKey = (day) => `meta:${day}`;

/** Aggiunge le versioni correnti a quelle già registrate per il giorno (senza duplicati). */
export function mergeMeta(meta, modelVersion, coeffVersion) {
  const add = (list, v) => (list ?? []).includes(v) ? list : [...(list ?? []), v];
  return { m: add(meta?.m, modelVersion), c: add(meta?.c, coeffVersion) };
}

/** Chiave di archiviazione del giorno: un record { dominio: { n, b, ms } } per giorno. */
export const dayStorageKey = (day) => `day:${day}`;

/** Tra le chiavi di storage, quelle dei giorni più vecchi di `keepDays`. */
export function expiredDayKeys(keys, keepDays, now = new Date()) {
  const limit = new Date(now);
  limit.setDate(limit.getDate() - keepDays);
  const min = dayStorageKey(dayKey(limit));
  const minMeta = metaStorageKey(dayKey(limit));
  return keys.filter((k) => (k.startsWith('day:') && k < min) || (k.startsWith('meta:') && k < minMeta) || (k.startsWith('dest:') && k < `dest:${dayKey(limit)}`));
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

// Valore breve per il badge (circa 4 caratteri). Sotto 1 si usano decimali senza zero iniziale
// (".87") così il numero cambia già nei primi secondi di navigazione.
function compact(x, decimals = 2) {
  if (x >= 10) return String(Math.round(x));
  if (x >= 0.995) return x.toFixed(1);
  const d = x.toFixed(decimals);
  if (+d > 0) return d.slice(1).replace(/0+$/, '');
  return x > 0 ? `<.${'0'.repeat(decimals - 1)}1` : '0';
}

/** Testo del badge per la metrica scelta (breve, indipendente dalla lingua). g/kg, mL/L, costo senza simbolo. */
export function badgeValue(metric, v) {
  if (!(v > 0)) return '0';
  if (metric === 'co2e') return v >= 1000 ? `${compact(v / 1000)}k` : `${compact(v)}g`;
  if (metric === 'water') return v >= 1000 ? `${compact(v / 1000)}L` : `${compact(v)}m`;
  return compact(v, 3);
}

/** Chiavi dei giorni degli ultimi n giorni (oggi incluso). */
export function lastNDays(n, now = new Date()) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

/** Somma per dominio i giorni indicati: { dominio: { n, b, ms } }. */
export function aggregateDays(stats, days) {
  const out = {};
  for (const day of days) for (const [host, e] of Object.entries(stats[day] ?? {})) addSample(out, 'all', host, e);
  return out.all ?? {};
}

// --- Privacy: impostazioni, esclusioni, esportazione ---------------------------------
export const RETENTION_OPTIONS = [7, 30, 90];

/** Impostazioni di privacy con i valori predefiniti (nessuna voce avanzata attiva senza scelta dell'utente). */
export function privacyOf(settings = {}) {
  return {
    paused: !!settings.paused,
    retentionDays: RETENTION_OPTIONS.includes(settings.retentionDays) ? settings.retentionDays : 90,
    excluded: Array.isArray(settings.excluded) ? settings.excluded : [],
    destinations: settings.destinations === true, // Destination Control: spento senza una scelta esplicita
    aiServices: settings.aiServices && typeof settings.aiServices === 'object' ? settings.aiServices : {},
  };
}

/** Dominio da un testo libero ("https://www.Banca.it/x" -> "banca.it"); null se non valido. */
export function normalizeDomain(input) {
  let s = String(input ?? '').trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].replace(/^www\./, '').replace(/:\d+$/, '').replace(/\.$/, '');
  if (s === 'localhost') return s;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

/** Elenco di domini da un testo (uno per riga o separati da virgola/spazio), senza duplicati. */
export function parseDomainList(text) {
  const out = new Set();
  for (const part of String(text ?? '').split(/[\s,;]+/)) {
    const d = normalizeDomain(part);
    if (d) out.add(d);
  }
  return [...out];
}

/** Il dominio (o un suo sottodominio) è nell'elenco delle esclusioni? */
export function isExcluded(host, list) {
  return list.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Copia del record di un giorno senza i domini esclusi. */
export function purgeHosts(record, list) {
  return Object.fromEntries(Object.entries(record ?? {}).filter(([host]) => !isExcluded(host, list)));
}

/** CSV leggibile di tutto ciò che è memorizzato: ogni campo di ogni dominio e giorno, con le versioni del modello. */
export function csvFromDays(days, metas = {}) {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = ['day,domain,requests,bytes,requests_without_size,unattributed_requests,unattributed_bytes,active_seconds,ai_messages,ai_counted_seconds,model_version,coefficient_version'];
  for (const day of Object.keys(days).sort()) {
    const m = metas[day] ?? {};
    for (const [host, e] of Object.entries(days[day]).sort()) {
      rows.push([day, q(host), e.n, e.b, e.nu ?? 0, e.ua ?? 0, e.ub ?? 0, Math.round(e.ms / 1000), e.p ?? 0, Math.round((e.msc ?? 0) / 1000), q((m.m ?? []).join(' ')), q((m.c ?? []).join(' '))].join(','));
    }
  }
  return `${rows.join('\n')}\n`;
}

// --- Conteggio AI per servizio (facoltativo, solo numeri) -------------------------------
const rxCache = new Map();

/**
 * L'adattatore del servizio a cui appartiene una richiesta (metodo, dominio e percorso), oppure null.
 * Si guarda solo l'indirizzo della richiesta: il corpo non viene mai letto.
 */
export function matchAdapter(method, url, adapters) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  for (const a of adapters) {
    if (a.domain !== host || a.method !== method || typeof a.path !== 'string' || a.path.length > 200) continue;
    let rx = rxCache.get(a.path);
    if (rx === undefined) {
      try { rx = new RegExp(a.path); } catch { rx = null; }
      rxCache.set(a.path, rx);
    }
    if (rx && rx.test(u.pathname)) return a;
  }
  return null;
}

/** Copia dei record dei giorni senza i campi del conteggio AI (p, msc). */
export function stripAiFields(record) {
  return Object.fromEntries(Object.entries(record ?? {}).map(([host, e]) => {
    const { p, msc, ...rest } = e; // eslint-disable-line no-unused-vars
    return [host, rest];
  }));
}

/** Indirizzo senza identificativi (UUID, numeri lunghi, codici): per mostrare un percorso senza dati personali. */
export function maskPath(pathname) {
  return pathname.split('/').map((seg) => (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) || /^[0-9a-f]{16,}$/i.test(seg)
    || /^\d{4,}$/.test(seg) || /^[A-Za-z0-9_-]{22,}$/.test(seg) ? ':id' : seg
  )).join('/');
}
