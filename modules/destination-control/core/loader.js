// Carica il dataset locale e restituisce indice e funzione di classificazione. Se il dataset manca o è
// illeggibile il modulo continua a funzionare: tutto risulta sconosciuto (fail-open).
import { buildIndex } from './identity.js';
import { classifyDestination } from './classification.js';

export async function loadClassifier(api) {
  let dataset = null;
  try { dataset = await (await fetch(api.runtime.getURL('modules/destination-control/database/ranges.json'))).json(); } catch { /* dataset assente */ }
  const index = buildIndex(dataset);
  return { index, classify: (host, ip) => classifyDestination({ host, ip }, index) };
}
