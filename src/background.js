// Service worker: raccoglie byte e tempo attivo per dominio. Nessuna rete, nessun contenuto di pagina.
import { api, action } from './compat.js';
import { hostFromUrl, dayKey, dayStorageKey, addSample, expiredDayKeys, contentLength, classify, badgeValue, privacyOf, isExcluded, purgeHosts, matchAdapter } from './core.js';
import { estimateDay, convert, resolveProfile, metricOf, METRICS, thresholdsFor, levelOf } from './engine.js';
import { loadStrings, t } from './i18n.js';
import { makeFormatter } from './format.js';

const FLUSH_DELAY_MS = 20000;   // salvataggio aggregato (non a ogni richiesta)
const MAX_TICK_MS = 120000;     // tetto di tempo attribuibile tra due eventi

let pending = {};               // dati non ancora salvati
let inflight = {};              // dati in scrittura (contano ancora nel badge finché la scrittura non finisce)
let flushTimer = null;
let queue = Promise.resolve();  // serializza le scritture
const tabHost = new Map();      // tabId -> dominio del sito aperto
const audible = new Map();      // tabId -> dominio, per le schede che stanno emettendo audio
const privateTabs = new Set();  // schede in finestre private: mai monitorate
const active = { host: null, since: 0 };
let cfg = privacyOf({});        // pausa, esclusioni, conservazione (da impostazioni)
let cfgReady = false;
const early = [];               // richieste arrivate prima del caricamento delle impostazioni
const state = { idle: 'active', focused: true };

// --- Tempo attivo -----------------------------------------------------------
// Il tempo va alla scheda attiva (finestra a fuoco, utente non inattivo) e alle schede che
// riproducono audio (musica/video in secondo piano). Le altre schede in background non contano.
function accrue(now = Date.now()) {
  const dt = Math.min(now - active.since, MAX_TICK_MS);
  if (dt > 0) {
    const hosts = new Set(audible.values());
    if (active.host) hosts.add(active.host);
    for (const h of hosts) {
      if (!h || !allowed(h)) continue;
      // msc: parte del tempo in cui i messaggi AI di questo sito vengono contati (opt-in per servizio).
      addSample(pending, dayKey(), h, { ms: dt, msc: cfg.activeAdapters?.some((a) => a.domain === h) ? dt : 0 });
    }
  }
  active.since = now;
}

async function refreshActive() {
  accrue();
  scheduleLive();
  active.host = null;
  if (state.idle === 'active' && state.focused && !cfg.paused) {
    try {
      const [tab] = await api.tabs.query({ active: true, lastFocusedWindow: true });
      active.host = tab && !tab.incognito ? hostFromUrl(tab.url) : null;
    } catch { /* tab non disponibile */ }
  }
  active.since = Date.now();
}

// --- Byte trasferiti --------------------------------------------------------
/** Sito monitorabile: non in pausa e non escluso dall'utente. */
const allowed = (host) => !cfg.paused && !isExcluded(host, cfg.excluded);

function record(host, bytes, countRequest = true) {
  if (!host) return;
  if (!cfgReady) { if (early.length < 500) early.push([host, bytes, countRequest]); return; }
  if (!allowed(host)) return;
  addSample(pending, dayKey(), host, { n: countRequest ? 1 : 0, b: bytes });
  scheduleFlush();
  scheduleLive();
}

const FILTER = { urls: ['http://*/*', 'https://*/*'] };

// La navigazione principale fissa il dominio della scheda prima dei sotto-caricamenti.
api.webRequest.onBeforeRequest.addListener((d) => {
  if (d.type === 'main_frame' && d.tabId >= 0) tabHost.set(d.tabId, privateTabs.has(d.tabId) ? null : hostFromUrl(d.url));
}, FILTER);


/**
 * Conteggio dei messaggi inviati a un servizio AI scelto dall'utente: una richiesta riuscita che
 * corrisponde all'adattatore incrementa un contatore. Il corpo della richiesta non viene mai letto.
 */
function countPrompt(d) {
  if (!cfgReady || d.method !== 'POST' || d.statusCode >= 300 || !cfg.activeAdapters?.length) return;
  const a = matchAdapter(d.method, d.url, cfg.activeAdapters);
  if (!a || !allowed(a.domain)) return;
  addSample(pending, dayKey(), a.domain, { p: 1 });
  scheduleFlush();
  scheduleLive();
}

api.webRequest.onCompleted.addListener((d) => {
  if (d.tabId < 0 || privateTabs.has(d.tabId)) return; // richieste del browser/estensioni e finestre private: ignorate
  countPrompt(d);
  const bytes = contentLength(d.responseHeaders);
  if (d.type === 'main_frame') tabHost.set(d.tabId, hostFromUrl(d.url)); // dominio finale dopo eventuali redirect
  if (tabHost.has(d.tabId)) return record(tabHost.get(d.tabId), bytes);
  api.tabs.get(d.tabId).then((t) => {
    if (t.incognito) { privateTabs.add(t.id); tabHost.set(d.tabId, null); return; }
    const h = hostFromUrl(t.url);
    tabHost.set(d.tabId, h);
    record(h, bytes);
  }).catch(() => {});
}, FILTER, ['responseHeaders']);

api.tabs.onRemoved.addListener((id) => { accrue(); tabHost.delete(id); audible.delete(id); privateTabs.delete(id); });
api.tabs.onCreated.addListener((tab) => { if (tab.incognito) privateTabs.add(tab.id); });
api.tabs.onActivated.addListener(refreshActive);
api.tabs.onUpdated.addListener((id, change, tab) => {
  if (tab.incognito) { privateTabs.add(id); tabHost.set(id, null); audible.delete(id); return; }
  if (change.url) tabHost.set(id, hostFromUrl(change.url));
  if ('audible' in change || (change.url && audible.has(id))) {
    accrue();
    if (tab.audible) audible.set(id, hostFromUrl(tab.url)); else audible.delete(id);
  }
  if (tab.active && change.url) refreshActive();
});
api.windows.onFocusChanged.addListener((id) => {
  state.focused = id !== api.windows.WINDOW_ID_NONE;
  refreshActive();
});
api.idle.setDetectionInterval(60);
api.idle.onStateChanged.addListener((s) => { state.idle = s === 'active' ? 'active' : 'idle'; refreshActive(); });

// --- Salvataggio ------------------------------------------------------------
function scheduleFlush() {
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

function flush() {
  clearTimeout(flushTimer);
  flushTimer = null;
  accrue();
  const batch = pending;
  pending = {};
  inflight = batch;
  queue = queue.then(async () => {
    const days = Object.keys(batch);
    if (days.length) {
      // Un record per giorno: ogni salvataggio legge e scrive solo i giorni toccati (di solito uno).
      const keys = days.map(dayStorageKey);
      const stored = await api.storage.local.get([...keys, 'session']);
      const session = stored.session ?? { start: Date.now(), stats: {} };
      const out = { session };
      for (const day of days) {
        const rec = stored[dayStorageKey(day)] ?? {};
        for (const [host, e] of Object.entries(batch[day])) {
          addSample({ [day]: rec }, day, host, e);
          addSample(session.stats, 'all', host, e);
        }
        out[dayStorageKey(day)] = rec;
        if (day === cache.day) cache.today = rec;
      }
      await api.storage.local.set(out);
    }
    inflight = {};
    await pruneOldDays();
    await refreshBadge(); // anche senza nuovi dati: cambia il giorno, il badge si riallinea
  }).catch((e) => { inflight = {}; console.error('flush', e); });
  return queue;
}

// Elimina i giorni più vecchi di KEEP_DAYS; una volta al giorno per avvio del worker.
let lastPrune = '';
async function pruneOldDays(force = false) {
  const today = dayKey();
  if (!force && lastPrune === today) return;
  lastPrune = today;
  const all = await api.storage.local.get(null);
  const old = expiredDayKeys(Object.keys(all), cfg.retentionDays);
  if (old.length) await api.storage.local.remove(old);
}

// --- Indicatore (foglia + badge) ---------------------------------------------
const data = {};
const loadJson = (p) => (data[p] ??= fetch(api.runtime.getURL(p)).then((r) => r.json()));
const COLORS = { green: '#2e7d32', yellow: '#f9a825', red: '#c62828' };
const iconSet = (lvl) => Object.fromEntries([16, 32, 48, 128].map((n) => [n, `icons/leaf-${lvl}-${n}.png`]));
let strings = null;

// Cache in memoria: il badge "live" non rilegge lo storage a ogni aggiornamento.
const cache = { day: null, today: {}, settings: null };
async function ensureCache() {
  const day = dayKey();
  if (cache.settings && cache.day === day) return;
  const key = dayStorageKey(day);
  const stored = await api.storage.local.get([key, 'settings']);
  cache.day = day;
  cache.today = stored[key] ?? {};
  cache.settings = stored.settings ?? {};
}

/** Oggi = record salvato + dati in scrittura + dati ancora in attesa. */
function todayNow() {
  const m = {};
  for (const src of [cache.today, inflight[cache.day], pending[cache.day]]) {
    for (const [host, e] of Object.entries(src ?? {})) addSample(m, 'd', host, e);
  }
  return m.d ?? {};
}

let last = '';
async function refreshBadge() {
  const [catalog, coeffs] = await Promise.all([loadJson('data/catalog.json'), loadJson('data/coefficients.json')]);
  await ensureCache();
  const lang = await (strings ??= loadStrings());
  const settings = cache.settings;
  if (cfg.paused) { // pausa: foglia grigia e nessun valore
    const title = t('tooltip.paused');
    if (last !== `paused|${title}`) {
      last = `paused|${title}`;
      action.setBadgeText({ text: 'II' });
      action.setBadgeBackgroundColor({ color: '#8a958e' });
      action.setIcon({ path: iconSet('gray') });
      action.setTitle({ title });
    }
    return;
  }
  const profile = resolveProfile(coeffs, settings);
  const metric = metricOf(settings);
  const est = estimateDay(todayNow(), catalog.domains, classify, coeffs, settings.device);
  const value = convert(est.wh, profile, coeffs, est.dc_wh)[METRICS[metric].key].mid;
  const level = levelOf(value, thresholdsFor(metric, settings, profile, coeffs));
  const text = badgeValue(metric, value);
  const title = t('tooltip', { metric: t(`metric.${metric}`), value: makeFormatter(lang, profile.currency)(value, METRICS[metric].unit), profile: t(`profile.${settings.profile in coeffs.profiles ? settings.profile : 'it'}`) });
  const sig = `${text}|${level}|${title}`;
  if (sig === last) return; // niente chiamate inutili se nulla è cambiato
  last = sig;
  action.setBadgeText({ text });
  action.setBadgeBackgroundColor({ color: COLORS[level] });
  action.setIcon({ path: iconSet(level) });
  action.setTitle({ title });
}

// Aggiornamento "live": durante la navigazione il badge si ricalcola al più ogni 1,5 s.
const LIVE_MS = 1500;
let liveTimer = null;
function scheduleLive() {
  if (liveTimer) return;
  liveTimer = setTimeout(() => {
    liveTimer = null;
    accrue();
    loadCfg().then(() => refreshBadge()).catch(() => {});
api.tabs.query({}).then((tabs) => tabs.forEach((t) => t.incognito && privateTabs.add(t.id))).catch(() => {});
  }, LIVE_MS);
}

/** Carica pausa, esclusioni e conservazione; svuota ciò che ora è escluso. */
async function loadCfg() {
  const { settings = {} } = await api.storage.local.get('settings');
  cfg = privacyOf(settings);
  const file = await loadJson('data/ai_adapters.json');
  // Gli adattatori aggiuntivi (avanzato, anche per i test) devono avere un identificativo e un dominio.
  const extra = Array.isArray(settings.aiExtraAdapters) ? settings.aiExtraAdapters.filter((a) => a && a.id && a.domain) : [];
  cfg.activeAdapters = [...file.adapters, ...extra].filter((a) => cfg.aiServices[a.id]);
  cfgReady = true;
  for (const day of Object.keys(pending)) pending[day] = purgeHosts(pending[day], cfg.excluded);
  for (const [host, bytes, count] of early.splice(0)) record(host, bytes, count);
}

// Cambi di impostazioni o cancellazione dati: aggiorna subito.
api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) {
    strings = null; cache.settings = null; last = '';
    loadCfg().then(() => { pruneOldDays(true).catch(() => {}); return refreshBadge(); }).catch(() => {});
  }
  // Chiave 'session' rimossa = l'utente ha cancellato i dati: scarta anche quelli in attesa.
  if (changes.session && changes.session.newValue === undefined) { pending = {}; inflight = {}; cache.day = null; last = ''; refreshBadge().catch(() => {}); }
});

// --- Avvio ------------------------------------------------------------------
// Un solo allarme al minuto: accredita il tempo e salva. Nessun altro polling.
api.alarms.get('tick').then((a) => { if (!a) api.alarms.create('tick', { periodInMinutes: 1 }); });
api.alarms.onAlarm.addListener((a) => { if (a.name === 'tick') flush(); });

// La sessione corrente riparte a ogni avvio del browser.
api.runtime.onStartup.addListener(() => api.storage.local.set({ session: { start: Date.now(), stats: {} } }));

// Prima installazione: pagina di benvenuto (regione, lingua, come fissare la foglia).
api.runtime.onInstalled.addListener((d) => {
  if (d.reason === 'install') api.tabs.create({ url: api.runtime.getURL('welcome/welcome.html') });
});

action.onClicked.addListener(() => api.tabs.create({ url: api.runtime.getURL('dashboard/dashboard.html') }));

api.tabs.query({ audible: true }).then((tabs) => tabs.forEach((t) => !t.incognito && audible.set(t.id, hostFromUrl(t.url)))).catch(() => {});
api.idle.queryState(60).then((s) => { state.idle = s === 'active' ? 'active' : 'idle'; refreshActive(); });
loadCfg().then(() => refreshBadge()).catch(() => {});
api.tabs.query({}).then((tabs) => tabs.forEach((t) => t.incognito && privateTabs.add(t.id))).catch(() => {});
