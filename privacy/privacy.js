// Privacy audit: mostra ciò che l'estensione dichiara (manifest) e ciò che ha davvero memorizzato (storage),
// letti dal vivo. Così la promessa di privacy si può verificare, non solo leggere.
import { api } from '../src/compat.js';
import { initI18n, t, translateDom } from '../src/i18n.js';
import { formatBytes, privacyOf } from '../src/core.js';
import { auditManifest, auditStorage } from '../src/audit.js';

const lang = await initI18n();
translateDom();
const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat(lang);

const manifest = api.runtime.getManifest();
const all = await api.storage.local.get(null);
const settings = all.settings ?? {};
const priv = privacyOf(settings);
const m = auditManifest(manifest);
const s = auditStorage(all);

function li(list, cls, mark, title, detail) {
  const item = document.createElement('li');
  item.className = cls;
  const sign = Object.assign(document.createElement('span'), { className: 'mark', textContent: mark });
  const body = document.createElement('span');
  body.append(title);
  if (detail) body.append(Object.assign(document.createElement('small'), { textContent: detail }));
  item.append(sign, body);
  list.append(item);
}
const fill = (id, keys) => keys.forEach((k) => { const l = document.createElement('li'); l.textContent = t(k); $(id).append(l); });

// 1. Fatti verificabili dal manifest
const checks = $('checks');
li(checks, m.contentScripts === 0 ? 'ok' : 'warn', m.contentScripts === 0 ? '✓' : '!', t('p.chk.no_scripts'), m.contentScripts === 0 ? t('p.chk.no_scripts_d') : t('p.chk.scripts_found', { n: m.contentScripts }));
li(checks, m.noExternalConnections ? 'ok' : 'warn', m.noExternalConnections ? '✓' : '!', t('p.chk.no_network'), t('p.chk.no_network_d', { csp: m.connectSrc ?? '?' }));
li(checks, m.optionalPermissions.length === 0 ? 'ok' : 'warn', m.optionalPermissions.length === 0 ? '✓' : '!', t('p.chk.no_optional'), t('p.chk.no_optional_d'));
li(checks, m.webAccessible === 0 ? 'ok' : 'warn', m.webAccessible === 0 ? '✓' : '!', t('p.chk.not_exposed'), t('p.chk.not_exposed_d'));
li(checks, 'ok', '✓', t('p.chk.private'), t('p.chk.private_d'));

// 2. Permessi
const tbody = $('perms').tBodies[0];
for (const p of m.permissions) {
  const tr = tbody.insertRow();
  tr.insertCell().append(Object.assign(document.createElement('code'), { textContent: p.name }));
  tr.insertCell().textContent = p.known ? t(`p.perm.${p.name}`) : t('p.perm.unknown');
}
for (const h of m.allSites ? ['http(s)://*/*'] : m.hosts) {
  const tr = tbody.insertRow();
  tr.insertCell().append(Object.assign(document.createElement('code'), { textContent: h }));
  tr.insertCell().textContent = t('p.perm.hosts');
}
$('perm-note').textContent = m.allSites ? t('p.perm.hosts_note') : '';

// 3. Che cosa è memorizzato
const rows = [['footprint', 'p.st.footprint'], ['versions', 'p.st.versions'], ['destinations', 'p.st.destinations'], ['session', 'p.st.session'], ['settings', 'p.st.settings']];
const stored = $('stored').tBodies[0];
for (const [cat, key] of rows) {
  const e = s.categories[cat] ?? { entries: 0, bytes: 0 };
  const tr = stored.insertRow();
  tr.insertCell().textContent = t(`${key}.name`);
  tr.insertCell().textContent = t(`${key}.what`);
  const n = tr.insertCell(); n.textContent = nf.format(e.entries); n.className = 'num';
  const b = tr.insertCell(); b.textContent = formatBytes(e.bytes); b.className = 'num';
}
if (s.categories.other) {
  const tr = stored.insertRow();
  tr.insertCell().textContent = t('p.st.other.name');
  tr.insertCell().textContent = t('p.st.other.what');
  tr.insertCell().textContent = nf.format(s.categories.other.entries);
  tr.insertCell().textContent = formatBytes(s.categories.other.bytes);
}
$('stored-total').textContent = t('p.stored_total', { size: formatBytes(s.total), days: priv.retentionDays });

// 4. Funzioni facoltative e loro stato attuale
const opt = $('optional');
li(opt, priv.destinations ? 'on' : 'off', priv.destinations ? '●' : '○', t('p.opt.destinations'), priv.destinations ? t('p.opt.destinations_on') : t('p.opt.destinations_off'));
const ai = Object.keys(priv.aiServices).filter((k) => priv.aiServices[k]);
li(opt, ai.length ? 'on' : 'off', ai.length ? '●' : '○', t('p.opt.ai'), ai.length ? t('p.opt.ai_on', { list: ai.join(', ') }) : t('p.opt.ai_off'));
li(opt, priv.paused ? 'on' : 'off', priv.paused ? '●' : '○', t('p.opt.paused'), priv.paused ? t('p.opt.paused_on') : t('p.opt.paused_off'));
li(opt, priv.excluded.length ? 'on' : 'off', priv.excluded.length ? '●' : '○', t('p.opt.excluded'), t('p.opt.excluded_n', { n: priv.excluded.length }));

// 5. Cosa non viene mai letto, cancellato, esportato
fill('never', ['p.never.1', 'p.never.2', 'p.never.3', 'p.never.4', 'p.never.5']);
fill('delete', ['p.del.1', 'p.del.2', 'p.del.3', 'p.del.4']);
fill('export', ['p.exp.1', 'p.exp.2', 'p.exp.3']);

$('settings-link').onclick = (e) => { e.preventDefault(); api.runtime.openOptionsPage(); };
