// Dati per il Privacy audit, tutti derivati da ciò che l'estensione dichiara e memorizza davvero.
// Funzioni pure: la pagina e i test usano le stesse.

/** Permessi che l'estensione sa spiegare. Un permesso nuovo nel manifest senza spiegazione viene segnalato. */
export const KNOWN_PERMISSIONS = ['webRequest', 'idle', 'storage', 'alarms'];

/** Fatti verificabili sul manifest: permessi, accesso ai siti, script nelle pagine, connessioni consentite. */
export function auditManifest(m) {
  const csp = m.content_security_policy?.extension_pages ?? '';
  const connect = /connect-src\s+([^;]+)/.exec(csp)?.[1]?.trim() ?? null;
  return {
    permissions: (m.permissions ?? []).map((name) => ({ name, known: KNOWN_PERMISSIONS.includes(name) })),
    optionalPermissions: m.optional_permissions ?? [],
    hosts: m.host_permissions ?? [],
    allSites: (m.host_permissions ?? []).some((h) => /^(https?|\*):\/\/\*\/\*$/.test(h) || h === '<all_urls>'),
    contentScripts: (m.content_scripts ?? []).length,
    connectSrc: connect,
    noExternalConnections: connect === "'self'",
    webAccessible: (m.web_accessible_resources ?? []).length,
  };
}

const CATEGORIES = [
  ['day:', 'footprint'], ['meta:', 'versions'], ['dest:', 'destinations'], ['session', 'session'], ['settings', 'settings'],
];

/** Che cosa c'è nello storage: per categoria numero di voci e dimensione approssimata (byte JSON). */
export function auditStorage(all) {
  const out = {};
  let total = 0;
  for (const [key, value] of Object.entries(all ?? {})) {
    const cat = CATEGORIES.find(([p]) => key === p || (p.endsWith(':') && key.startsWith(p)))?.[1] ?? 'other';
    const size = JSON.stringify(value).length + key.length;
    const e = (out[cat] ??= { entries: 0, bytes: 0 });
    e.entries += 1;
    e.bytes += size;
    total += size;
  }
  return { categories: out, total };
}
