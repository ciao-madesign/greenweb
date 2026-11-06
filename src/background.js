// Service worker: raccoglie byte e tempo attivo per dominio. Nessuna rete, nessun contenuto di pagina.
import { api, action } from './compat.js';
import { hostFromUrl, dayKey, addSample, mergeStats, pruneOld, contentLength, badgeText } from './core.js';

const FLUSH_DELAY_MS = 20000;   // salvataggio aggregato (non a ogni richiesta)
const MAX_TICK_MS = 120000;     // tetto di tempo attribuibile tra due eventi
const KEEP_DAYS = 400;

let pending = {};               // dati non ancora salvati
let flushTimer = null;
let queue = Promise.resolve();  // serializza le scritture
const tabHost = new Map();      // tabId -> dominio del sito aperto
const active = { host: null, since: 0 };
const state = { idle: 'active', focused: true };

// --- Tempo attivo -----------------------------------------------------------
function accrue(now = Date.now()) {
  if (active.host && now > active.since) {
    addSample(pending, dayKey(), active.host, { ms: Math.min(now - active.since, MAX_TICK_MS) });
  }
  active.since = now;
}

async function refreshActive() {
  accrue();
  active.host = null;
  if (state.idle === 'active' && state.focused) {
    try {
      const [tab] = await api.tabs.query({ active: true, lastFocusedWindow: true });
      active.host = tab ? hostFromUrl(tab.url) : null;
    } catch { /* tab non disponibile */ }
  }
  active.since = Date.now();
}

// --- Byte trasferiti --------------------------------------------------------
function record(host, bytes) {
  if (!host) return;
  addSample(pending, dayKey(), host, { n: 1, b: bytes });
  scheduleFlush();
}

const FILTER = { urls: ['http://*/*', 'https://*/*'] };

// La navigazione principale fissa il dominio della scheda prima dei sotto-caricamenti.
api.webRequest.onBeforeRequest.addListener((d) => {
  if (d.type === 'main_frame' && d.tabId >= 0) tabHost.set(d.tabId, hostFromUrl(d.url));
}, FILTER);

api.webRequest.onCompleted.addListener((d) => {
  if (d.tabId < 0) return; // richieste del browser/estensioni: ignorate
  const bytes = contentLength(d.responseHeaders);
  if (tabHost.has(d.tabId)) return record(tabHost.get(d.tabId), bytes);
  api.tabs.get(d.tabId).then((t) => {
    const h = hostFromUrl(t.url);
    tabHost.set(d.tabId, h);
    record(h, bytes);
  }).catch(() => {});
}, FILTER, ['responseHeaders']);

api.tabs.onRemoved.addListener((id) => tabHost.delete(id));
api.tabs.onActivated.addListener(refreshActive);
api.tabs.onUpdated.addListener((id, change, tab) => {
  if (change.url) tabHost.set(id, hostFromUrl(change.url));
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
  queue = queue.then(async () => {
    if (!Object.keys(batch).length) return;
    const { stats = {} } = await api.storage.local.get('stats');
    mergeStats(stats, batch);
    pruneOld(stats, KEEP_DAYS);
    await api.storage.local.set({ stats });
    updateBadge(stats);
  }).catch(() => {});
  return queue;
}

function updateBadge(stats) {
  const today = stats[dayKey()] ?? {};
  const bytes = Object.values(today).reduce((s, e) => s + e.b, 0);
  action.setBadgeText({ text: badgeText(bytes) });
  action.setBadgeBackgroundColor({ color: '#2e7d32' });
  action.setTitle({ title: 'Digital Footprint Counter' });
}

// --- Avvio ------------------------------------------------------------------
// Un solo allarme al minuto: accredita il tempo e salva. Nessun altro polling.
api.alarms.get('tick').then((a) => { if (!a) api.alarms.create('tick', { periodInMinutes: 1 }); });
api.alarms.onAlarm.addListener((a) => { if (a.name === 'tick') flush(); });

action.onClicked.addListener(() => api.tabs.create({ url: api.runtime.getURL('dashboard/dashboard.html') }));

api.idle.queryState(60).then((s) => { state.idle = s === 'active' ? 'active' : 'idle'; refreshActive(); });
api.storage.local.get('stats').then(({ stats }) => { if (stats) updateBadge(stats); });
