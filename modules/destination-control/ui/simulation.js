// Simulazione delle regole: mostra che cosa succederebbe con le regole dell'utente. Non blocca nulla.
import { simulate } from '../core/policy.js';

const el = (tag, text, cls) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text !== undefined ? { textContent: text } : {});

export function renderSimulation(host, { days, rules, unknown, classify, t, lang }) {
  host.replaceChildren();
  if (!rules?.length && (!unknown || unknown === 'allow')) return;
  const s = simulate(days, rules, classify, { unknown });
  const nf = new Intl.NumberFormat(lang);
  host.append(el('h3', t('sim.title')), el('p', t('sim.note'), 'muted small'));
  if (!s.requests) return;
  const line = (key, n) => n > 0 && host.append(el('p', t(key, { n: nf.format(n), pct: `${Math.round((n / s.requests) * 100)}%` })));
  line('sim.block', s.verdicts.block);
  line('sim.review', s.verdicts.review);
  line('sim.allow', s.verdicts.allow);
  line('sim.prefer', s.verdicts.prefer);
  if (!s.verdicts.block && !s.verdicts.review && !s.verdicts.allow && !s.verdicts.prefer) host.append(el('p', t('sim.none'), 'muted'));
  if (s.sharedBlocked.length) host.append(el('p', t('sim.shared', { n: nf.format(s.sharedBlocked.length), list: s.sharedBlocked.slice(0, 5).join(', ') }), 'note small'));
  if (s.noInfoDecisions) host.append(el('p', t('sim.no_info', { n: nf.format(s.noInfoDecisions) }), 'note small'));
  if (s.probableDecisions) host.append(el('p', t('sim.probable', { n: nf.format(s.probableDecisions) }), 'note small'));
  if (s.rows.length) {
    const table = el('table'), head = table.createTHead().insertRow();
    for (const k of ['domain', 'verdict', 'rule', 'requests']) head.append(Object.assign(document.createElement('th'), { textContent: t(`sim.col.${k}`) }));
    const body = table.createTBody();
    for (const r of s.rows.slice(0, 15)) {
      const tr = body.insertRow();
      tr.insertCell().textContent = r.host;
      tr.insertCell().textContent = t(`sim.verdict.${r.verdict}`) + (r.warnings.length ? ` (${r.warnings.map((w) => t(`sim.warn.${w}`)).join(', ')})` : '');
      tr.insertCell().textContent = r.rule ? `${r.rule.action} ${r.rule.type} ${r.rule.value}` : t('sim.unknown_rule');
      tr.insertCell().textContent = nf.format(r.n);
    }
    const wrap = el('div', '', 'scroll');
    wrap.append(table);
    host.append(wrap);
  }
}
