import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditManifest, auditStorage } from '../src/audit.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const manifest = read('../manifest.json');
const locales = { it: read('../locales/it.json'), en: read('../locales/en.json') };

test('manifest: le promesse di privacy sono vere', () => {
  const a = auditManifest(manifest);
  assert.equal(a.contentScripts, 0, 'content script presenti');
  assert.equal(a.noExternalConnections, true, 'connect-src non limitato a self');
  assert.deepEqual(a.optionalPermissions, []);
  assert.equal(a.webAccessible, 0);
});

test('ogni permesso del manifest è noto e spiegato in entrambe le lingue', () => {
  const a = auditManifest(manifest);
  for (const p of a.permissions) {
    assert.ok(p.known, `permesso non documentato: ${p.name}`);
    for (const l of Object.keys(locales)) assert.ok(locales[l][`p.perm.${p.name}`], `${l}: manca p.perm.${p.name}`);
  }
});

test('le chiavi della pagina privacy esistono in entrambe le lingue', () => {
  const keys = (l) => Object.keys(locales[l]).filter((k) => k.startsWith('p.') || k === 'nav.privacy' || k === 'options.privacy_audit').sort();
  assert.deepEqual(keys('it'), keys('en'));
  assert.ok(keys('it').length > 50);
});

test('auditManifest riconosce permessi nuovi non documentati e script di contenuto', () => {
  const a = auditManifest({ permissions: ['webRequest', 'cookies'], content_scripts: [{}], content_security_policy: { extension_pages: "connect-src https://x.com" } });
  assert.equal(a.permissions[1].known, false);
  assert.equal(a.contentScripts, 1);
  assert.equal(a.noExternalConnections, false);
});

test('auditStorage: categorie, voci e dimensione', () => {
  const s = auditStorage({ 'day:2026-11-12': { 'a.com': { n: 1 } }, 'day:2026-11-11': {}, 'dest:2026-11-12': { 'a.com': { n: 1, ips: {} } }, settings: { lang: 'it' }, session: { start: 1, stats: {} }, 'meta:2026-11-12': { m: [2], c: ['1@x'] }, strano: 1 });
  assert.equal(s.categories.footprint.entries, 2);
  assert.equal(s.categories.destinations.entries, 1);
  assert.equal(s.categories.versions.entries, 1);
  assert.equal(s.categories.other.entries, 1);
  assert.ok(s.total > 0);
  assert.deepEqual(auditStorage({}), { categories: {}, total: 0 });
});
