// Policy Engine (V1.1, solo simulazione): valuta le regole dell'utente sulle destinazioni già osservate.
// Non blocca nulla. Regole: BLOCK, PREFER, ALLOW, REVIEW su dominio, IP, intervallo IP, ASN, provider, paese, regione.
// Priorità (la più specifica vince): 1 dominio, 2 IP/intervallo, 3 ASN/provider, 4 paese/regione, poi il comportamento
// predefinito. A parità di livello: prefisso/dominio più lungo, poi la regola scritta per prima.
// PREFER non autorizza e non blocca: è solo un'indicazione.
import { parseIp, parseCidr } from './identity.js';
import { mergeDestinations, mainIp } from './audit.js';

export const ACTIONS = ['BLOCK', 'PREFER', 'ALLOW', 'REVIEW'];
export const TYPES = ['domain', 'ip', 'cidr', 'asn', 'provider', 'country', 'region'];
const LEVEL = { domain: 1, ip: 2, cidr: 2, asn: 3, provider: 3, country: 4, region: 4 };

const normDomain = (v) => {
  const s = String(v).trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#:]/)[0].replace(/^www\./, '').replace(/\.$/, '');
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(s) ? s : null;
};

/** Valida e normalizza il valore di una regola; null se non valido. */
function normValue(type, raw) {
  const v = String(raw).trim();
  if (!v) return null;
  switch (type) {
    case 'domain': return normDomain(v);
    case 'ip': { const p = parseIp(v); return p ? v.toLowerCase() : null; }
    case 'cidr': return parseCidr(v) ? v.toLowerCase() : null;
    case 'asn': { const m = /^(?:AS)?(\d{1,10})$/i.exec(v); return m ? m[1] : null; }
    case 'country': return /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : null;
    default: return v.toLowerCase(); // provider, region
  }
}

/**
 * Legge le regole da testo, una per riga: `AZIONE tipo valore` (es. `BLOCK provider Example Cloud`).
 * Righe vuote e commenti (#) ignorati. Restituisce { rules, errors: [{ line, text, reason }] }.
 */
export function parseRules(text) {
  const rules = [], errors = [];
  String(text ?? '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const m = /^(\S+)\s+(\S+)\s+(.+)$/.exec(line);
    const err = (reason) => errors.push({ line: i + 1, text: line, reason });
    if (!m) return err('format');
    const action = m[1].toUpperCase(), type = m[2].toLowerCase();
    if (!ACTIONS.includes(action)) return err('action');
    if (!TYPES.includes(type)) return err('type');
    const value = normValue(type, m[3]);
    if (!value) return err('value');
    rules.push({ action, type, value });
  });
  return { rules, errors };
}

export const formatRules = (rules) => (rules ?? []).map((r) => `${r.action} ${r.type} ${r.value}`).join('\n');

/** Valida regole già strutturate (da impostazioni): scarta quelle non valide. */
export const sanitizeRules = (list) => parseRules(formatRules(Array.isArray(list) ? list.filter((r) => r && typeof r.action === 'string' && typeof r.type === 'string' && r.value != null) : [])).rules;

const ipInCidr = (ip, cidr) => {
  const p = parseIp(ip), c = parseCidr(cidr);
  if (!p || !c || p.v !== c.v) return false;
  const host = BigInt((p.v === 4 ? 32 : 128) - c.len);
  return (p.n >> host) << host === c.start;
};
const lc = (x) => (x == null ? null : String(x).toLowerCase());

/** Specificità dentro lo stesso livello (più alta = più specifica). */
function specificity(rule) {
  if (rule.type === 'domain') return rule.value.length;
  if (rule.type === 'ip') return 1000;
  if (rule.type === 'cidr') return parseCidr(rule.value).len;
  return 0;
}

function matches(rule, host, ip, c) {
  switch (rule.type) {
    case 'domain': return host === rule.value || host.endsWith(`.${rule.value}`);
    case 'ip': { const a = parseIp(ip), b = parseIp(rule.value); return !!a && !!b && a.v === b.v && a.n === b.n; }
    case 'cidr': return !!ip && ipInCidr(ip, rule.value);
    case 'asn': return c.asn.value != null && String(c.asn.value).replace(/^AS/i, '') === rule.value;
    case 'provider': return [c.provider.value, c.owner.value].some((x) => lc(x) === rule.value);
    case 'country': return c.country.value != null && String(c.country.value).toUpperCase() === rule.value;
    case 'region': return lc(c.region.value) === rule.value;
    default: return false;
  }
}

/**
 * Valuta una destinazione. `c` è la classificazione. Opzioni: unknown = 'allow' | 'review' | 'block'
 * (comportamento per le destinazioni non identificate, predefinito 'allow', cioè fail-open).
 * Esito: { verdict: 'block'|'allow'|'review'|'prefer'|'default', rule, index, warnings }.
 */
export function evaluate({ host, ip }, c, rules, { unknown = 'allow' } = {}) {
  let best = null;
  (rules ?? []).forEach((rule, index) => {
    if (!matches(rule, host, ip, c)) return;
    const cand = { rule, index, level: LEVEL[rule.type], spec: specificity(rule) };
    if (!best || cand.level < best.level || (cand.level === best.level && cand.spec > best.spec)) best = cand;
  });
  const warnings = [];
  if (best) {
    const { rule, level } = best;
    const verdict = rule.action.toLowerCase();
    if (level >= 3) {
      // Il giudizio su provider o paese non descrive il sito che lo usa: lo si segnala.
      if (c.shared && (verdict === 'block' || verdict === 'review')) warnings.push('shared');
      const field = { asn: 'asn', provider: 'provider', country: 'country', region: 'region' }[rule.type];
      if (field && c[field].confidence !== 'verified') warnings.push('probable_data');
    }
    return { verdict, rule, index: best.index, level, warnings };
  }
  if (!c.identified) {
    warnings.push('no_info');
    if (unknown !== 'allow') return { verdict: unknown, rule: null, index: -1, level: 5, warnings };
  }
  return { verdict: 'default', rule: null, index: -1, level: 5, warnings };
}

/**
 * Simula le regole su più giorni di registro. Restituisce i totali per esito, le regole usate, gli effetti
 * su infrastrutture condivise e le decisioni prese senza informazioni complete. Nulla viene bloccato.
 */
export function simulate(days, rules, classify, opts = {}) {
  const merged = {};
  for (const rec of days) mergeDestinations(merged, rec);
  const out = { requests: 0, domains: 0, verdicts: { block: 0, allow: 0, review: 0, prefer: 0, default: 0 }, sharedBlocked: [], noInfoDecisions: 0, probableDecisions: 0, ruleHits: (rules ?? []).map(() => ({ requests: 0, domains: 0 })), rows: [] };
  for (const [host, e] of Object.entries(merged)) {
    const ip = mainIp(e), c = classify(host, ip);
    const r = evaluate({ host, ip }, c, rules, opts);
    out.requests += e.n;
    out.domains += 1;
    out.verdicts[r.verdict] += e.n;
    if (r.index >= 0) { out.ruleHits[r.index].requests += e.n; out.ruleHits[r.index].domains += 1; }
    if (r.warnings.includes('shared')) out.sharedBlocked.push(host);
    if (r.warnings.includes('no_info') && r.verdict !== 'default') out.noInfoDecisions += e.n;
    if (r.warnings.includes('probable_data')) out.probableDecisions += e.n;
    if (r.verdict !== 'default') out.rows.push({ host, ip, n: e.n, ...r, c });
  }
  out.rows.sort((a, b) => b.n - a.n);
  return out;
}
