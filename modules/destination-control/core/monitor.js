// Osservazione delle richieste completate: dominio di destinazione e IP (se il browser lo espone).
// Solo contatori in memoria, salvati in blocco. Nessun blocco, nessuna rete: V1.0 è di sola identificazione.
import { addDestination, mergeDestinations, destStorageKey } from './audit.js';

const FLUSH_MS = 20000;

/**
 * @param {object} deps
 * @param {object} deps.api API WebExtensions (storage)
 * @param {(d:object)=>boolean} deps.isMonitored decide se la richiesta si può registrare (modulo attivo, non in pausa, non esclusa)
 * @param {()=>string} deps.today chiave del giorno
 */
export function createMonitor({ api, isMonitored, today }) {
  let pending = {};
  let timer = null;
  let queue = Promise.resolve();

  const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/\.$/, ''); } catch { return null; } };

  function flush() {
    clearTimeout(timer);
    timer = null;
    const batch = pending;
    pending = {};
    queue = queue.then(async () => {
      const days = Object.keys(batch);
      if (!days.length) return;
      const keys = days.map(destStorageKey);
      const stored = await api.storage.local.get(keys);
      const out = {};
      for (const day of days) out[destStorageKey(day)] = mergeDestinations(stored[destStorageKey(day)] ?? {}, batch[day]);
      await api.storage.local.set(out);
    }).catch(() => {});
    return queue;
  }

  return {
    /** Da chiamare per ogni richiesta completata. Ignora ciò che non è osservabile; nessun errore verso il chiamante. */
    observe(d) {
      try {
        if (!isMonitored(d)) return;
        const host = hostOf(d.url);
        if (!host) return;
        addDestination((pending[today()] ??= {}), host, d.ip ?? null);
        timer ??= setTimeout(flush, FLUSH_MS);
      } catch { /* mai disturbare la navigazione */ }
    },
    flush,
    /** Scarta ciò che non è ancora salvato (cancellazione dati, modulo disattivato). */
    reset() { pending = {}; clearTimeout(timer); timer = null; },
    /** Toglie dai dati in attesa i domini che soddisfano il predicato. */
    purge(pred) {
      for (const day of Object.keys(pending)) pending[day] = Object.fromEntries(Object.entries(pending[day]).filter(([h]) => !pred(h)));
    },
  };
}
