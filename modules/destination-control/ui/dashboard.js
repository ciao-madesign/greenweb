// Pannello Destination Control per la dashboard: conteggi, identificazione e ultime destinazioni.
// Riceve i dati già letti e le funzioni di traduzione; non accede alla rete.
import { summarize } from '../core/audit.js';

const el = (tag, text, cls) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text !== undefined ? { textContent: text } : {});

/**
 * @param {HTMLElement} host sezione da riempire
 * @param {{ days: object[], classify: Function, index: object, t: Function, lang: string }} ctx
 */
export function renderDestinations(host, { days, classify, index, t, lang }) {
  const s = summarize(days, classify);
  const nf = new Intl.NumberFormat(lang);
  const pct = (n) => (s.requests ? `${Math.round((n / s.requests) * 100)}%` : '–');
  host.replaceChildren();
  host.append(el('h2', t('dest.title')));
  if (!s.requests) { host.append(el('p', t('dest.empty'), 'muted small')); return; }
  const stats = el('div', '', 'dest-stats');
  for (const [v, l] of [[nf.format(s.requests), t('dest.requests')], [pct(s.identified), t('dest.identified')], [pct(s.requests - s.identified), t('dest.unknown')]]) {
    const d = el('div'); d.append(el('b', v), el('span', l, 'muted small')); stats.append(d);
  }
  stats.className = 'dest-stats';
  host.append(stats);
  const data = index.count
    ? t('dest.dataset', { n: nf.format(index.count), date: index.updated ?? '?' })
    : t('dest.no_dataset');
  host.append(el('p', data, 'muted small'));
  if (s.noIp) host.append(el('p', t('dest.no_ip', { n: nf.format(s.noIp) }), 'muted small'));
  const table = el('table'), head = table.createTHead().insertRow();
  for (const k of ['domain', 'provider', 'country', 'type', 'confidence', 'requests']) head.append(Object.assign(document.createElement('th'), { textContent: t(`dest.col.${k}`) }));
  const body = table.createTBody();
  const unk = t('dest.unknown_value');
  for (const r of s.rows.slice(0, 15)) {
    const tr = body.insertRow();
    const c = r.c;
    const note = [c.shared ? t('dest.shared') : '', !r.ip ? t('dest.no_ip_row') : ''].filter(Boolean).join(' · ');
    tr.insertCell().textContent = note ? `${r.host} (${note})` : r.host;
    tr.insertCell().textContent = c.provider.value ?? unk;
    tr.insertCell().textContent = c.country.value ?? unk;
    tr.insertCell().textContent = c.type.value ? t(`dest.type.${c.type.value}`) : unk;
    tr.insertCell().textContent = t(`dest.conf.${c.confidence}`);
    tr.insertCell().textContent = nf.format(r.n);
  }
  const wrap = el('div', '', 'scroll');
  wrap.append(table);
  host.append(wrap, el('p', t('dest.limits'), 'muted small'));
}
