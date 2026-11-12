// Classificazione di una destinazione. Ogni campo ha valore, attendibilità e fonte, separatamente:
// verified (confermato da una fonte attendibile), probable (dedotto), unknown (non determinabile).
// Il luogo fisico, l'elaborazione e la conservazione dei dati NON si deducono da un IP: restano sconosciuti.
import { lookupIp } from './identity.js';

export const CONFIDENCE = ['unknown', 'probable', 'verified'];
const unknown = () => ({ value: null, confidence: 'unknown', source: null });
const field = (value, confidence, source) => (value == null || value === '' ? unknown() : { value, confidence, source });

/** Attendibilità più bassa tra quelle indicate. */
export const lowest = (list) => CONFIDENCE[Math.min(...list.map((c) => CONFIDENCE.indexOf(c)), 2)];

/**
 * @param {{ host: string, ip?: string|null }} dest destinazione osservata (dominio e, se disponibile, IP)
 * @param {object|null} index indice costruito da buildIndex
 */
export function classifyDestination({ host, ip }, index) {
  const out = {
    domain: field(host, 'verified', 'observed'),
    ip: field(ip, 'verified', 'observed'),
    asn: unknown(), owner: unknown(), provider: unknown(), type: unknown(),
    country: unknown(), region: unknown(),
    data_center: unknown(), processing_location: unknown(), storage_location: unknown(),
    shared: false, updated: null,
  };
  const hit = ip ? lookupIp(index, ip) : null;
  if (hit) {
    const { net, dataset } = hit;
    const src = dataset?.id ?? 'dataset';
    const conf = dataset?.confidence === 'verified' ? 'verified' : 'probable';
    out.asn = field(net.asn, conf, src);
    out.owner = field(net.owner, conf, src);
    out.provider = field(net.provider ?? net.owner, conf, src);
    out.type = field(net.type, conf, src);
    // Paese e regione descrivono la rete, non la posizione fisica del server: mai oltre "probable".
    out.country = field(net.country, 'probable', src);
    out.region = field(net.region, net.region_declared_by_operator ? conf : 'probable', src);
    out.data_center = field(net.data_center, 'probable', src);
    // Un IP di CDN o cloud è condiviso da molti servizi indipendenti.
    out.shared = net.type === 'cdn' || net.type === 'cloud';
    out.updated = dataset?.updated ?? null;
  }
  const fields = ['asn', 'owner', 'provider', 'type', 'country'];
  out.identified = fields.some((f) => out[f].confidence !== 'unknown');
  out.complete = out.provider.confidence !== 'unknown' && out.country.confidence !== 'unknown';
  out.confidence = out.identified ? lowest(fields.filter((f) => out[f].confidence !== 'unknown').map((f) => out[f].confidence)) : 'unknown';
  return out;
}
