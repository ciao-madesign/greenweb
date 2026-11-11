// Service worker: raccoglie byte e tempo attivo per dominio. Nessuna rete, nessun contenuto di pagina.
import { api, action } from './compat.js';
import { hostFromUrl, dayKey, dayStorageKey, addSample, expiredDayKeys, contentLength, classify, badgeValue, metaStorageKey, mergeMeta, privacyOf, isExcluded, purgeHosts, matchAdapter, maskPath, normalizeDomain } from './core.js';
import { MODEL_VERSION, coefficientVersion, estimateDay, convert, resolveProfile, metricOf, METRICS, thresholdsFor, levelOf } from './engine.js';
import { loadStrings, t } from './i18n.js';
import { makeFormatter } from './format.js';

const FLUSH_DELAY_MS = 20000;   // salvataggio aggregato (non a ogni richiesta)
// Assente = nessun input per 5 minuti (o schermo bloccato). Con soglie brevi la lettura o un video senza audio
// verrebbero scartati, anche se il dispositivo resta acceso e consuma.
const IDLE_SECONDS = 300;
const MAX_TICK_MS = 120000;     // tetto di tempo attribuibile tra due eventi

let pending = {};               // dati non ancora salvati
let inflight = {};              // dati in scrittura (contano ancora nel badge finché la scrittura non finisce)
let flushTimer = null;
let queue = Promise.resolve();  // serializza le scritture
const tabHost = new Map();      // tabId -> dominio del sito aperto
const audible = new Map();      // tabId -> dominio, per le schede che stanno emettendo audio
const privateTabs = new Set();  // schede in finestre private: mai monitorate
const active = { host: null, since: 0 };
// Il service worker viene sospeso dopo ~30 s senza eventi: la scheda attiva e l'ora dell'ultimo conteggio
// si salvano in storage.session (memoria che sopravvive alla sospensione) per non perdere il tempo trascorso.
const sessionStore = api.storage.session;
let restored = false;
// Diagnostica: quanto tempo il browser ha passato in ogni stato (memoria temporanea, visibile nelle Impostazioni).
const stateMs = { counting: 0, away: 0, unfocused: 0, nosite: 0, paused: 0 };
let lastCounted = null;
let ready; // promessa di ripristino, assegnata a fine file
let cfg = privacyOf({});        // pausa, esclusioni, conservazione (da impostazioni)
let cfgReady = false;
const early = [];               // richieste arrivate prima del caricamento delle impostazioni
const state = { idle: 'active', focused: true };

// --- Tempo attivo -----------------------------------------------------------
// Il tempo va alla scheda attiva (finestra a fuoco, utente non inattivo) e alle schede che
// riproducono audio (musica/video in secondo piano). Le altre schede in background non contano.
function accrue(now = Date.now()) {
  if (!restored) return; // finché lo stato salvato non è stato ripristinato
  const dt = Math.min(now - active.since, MAX_TICK_MS);
  if (dt > 0) {
    const bucket = cfg.paused ? 'paused' : state.idle !== 'active' ? 'away' : !state.focused ? 'unfocused' : active.host ? 'counting' : 'nosite';
    stateMs[bucket] += dt;
    if (bucket === 'counting') lastCounted = { host: active.host, at: now };
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

function persistActive() {
  try { sessionStore?.set({ activeState: { host: active.host, since: active.since }, diagState: { stateMs, lastCounted } })?.catch?.(() => {}); } catch { /* storage.session non disponibile */ }
}

async function refreshActive() {
  await ready;
  return refreshActiveNow();
}

async function refreshActiveNow() {
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
  persistActive();
}

// --- Byte trasferiti --------------------------------------------------------
/** Sito monitorabile: non in pausa e non escluso dall'utente. */
const allowed = (host) => !cfg.paused && !isExcluded(host, cfg.excluded);

function record(host, bytes, countRequest = true, unsized = false) {
  if (!host) return;
  if (!cfgReady) { if (early.length < 500) early.push([host, bytes, countRequest, unsized]); return; }
  if (!allowed(host)) return;
  addSample(pending, dayKey(), host, { n: countRequest ? 1 : 0, b: bytes, nu: countRequest && unsized ? 1 : 0 });
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

// --- Verifica degli indirizzi dei servizi AI (solo su richiesta dell'utente, in memoria, 60 s) ---------
// Mostra metodo, indirizzo senza parametri e identificativi mascherati, e stato di risposta delle richieste
// non-GET verso un solo dominio, così si può controllare con traffico reale se un adattatore riconosce i messaggi.
let diag = null;
const DIAG_MS = 60000;

async function startDiag(input) {
  const domain = normalizeDomain(input);
  if (!domain) return { ok: false };
  const { settings = {} } = await api.storage.local.get('settings');
  const file = await loadJson('data/ai_adapters.json');
  const extra = Array.isArray(settings.aiExtraAdapters) ? settings.aiExtraAdapters.filter((a) => a && a.id && a.domain) : [];
  diag = { domain, until: Date.now() + DIAG_MS, seen: new Map(), adapters: [...file.adapters, ...extra] };
  return { ok: true };
}

function diagCapture(d) {
  if (!diag || Date.now() > diag.until || d.method === 'GET' || d.method === 'HEAD' || d.method === 'OPTIONS') return;
  let u;
  try { u = new URL(d.url); } catch { return; }
  const host = u.hostname.replace(/^www\./, '');
  if (host !== diag.domain && !host.endsWith(`.${diag.domain}`)) return;
  const key = `${d.method} ${host}${maskPath(u.pathname)}`;
  if (!diag.seen.has(key) && diag.seen.size >= 50) return;
  const e = diag.seen.get(key) ?? { n: 0, status: 0, matched: null };
  e.n += 1;
  e.status = d.statusCode;
  e.matched = matchAdapter(d.method, d.url, diag.adapters)?.id ?? e.matched;
  diag.seen.set(key, e);
}

function readDiag() {
  if (!diag) return { active: false, entries: [] };
  return { active: Date.now() <= diag.until, domain: diag.domain, remaining: Math.max(0, diag.until - Date.now()),
    entries: [...diag.seen].map(([request, e]) => ({ request, ...e })) };
}

// Solo le pagine dell'estensione possono usare la verifica.
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== api.runtime.id || typeof msg?.type !== 'string') return false;
  if (msg.type === 'diag:start') { startDiag(msg.domain).then(sendResponse); return true; }
  if (msg.type === 'diag:read') { sendResponse(readDiag()); }
  return false;
});

/**
 * Richieste che il browser non attribuisce a una scheda (tabId < 0: lavoratori in background come i service worker).
 * Non entrano nella stima: si contano solo, per sito, per vedere quanto traffico sfugge. Si considera solo l'origine
 * (dominio) di un sito aperto in una scheda non privata; il resto (browser, estensioni, siti chiusi) si ignora.
 */
function countUnattributed(d) {
  const host = hostFromUrl(d.initiator ?? d.originUrl ?? d.documentUrl ?? '');
  if (!cfgReady || !host || !allowed(host) || ![...tabHost.values()].includes(host)) return;
  addSample(pending, dayKey(), host, { ua: 1, ub: contentLength(d.responseHeaders) });
  scheduleFlush();
}

api.webRequest.onCompleted.addListener((d) => {
  if (d.tabId < 0) return countUnattributed(d);
  if (privateTabs.has(d.tabId)) return; // finestre private: ignorate
  diagCapture(d);
  countPrompt(d);
  const bytes = contentLength(d.responseHeaders);
  // Senza dimensione dichiarata: non è zero byte, è un dato mancante (204/304 e cache non sono lacune).
  const unsized = bytes === 0 && !d.fromCache && d.statusCode !== 204 && d.statusCode !== 304;
  if (d.type === 'main_frame') tabHost.set(d.tabId, hostFromUrl(d.url)); // dominio finale dopo eventuali redirect
  if (tabHost.has(d.tabId)) return record(tabHost.get(d.tabId), bytes, true, unsized);
  api.tabs.get(d.tabId).then((t) => {
    if (t.incognito) { privateTabs.add(t.id); tabHost.set(d.tabId, null); return; }
    const h = hostFromUrl(t.url);
    tabHost.set(d.tabId, h);
    record(h, bytes, true, unsized);
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
// Si conta prima il tempo trascorso con lo stato precedente, poi lo stato cambia.
async function setState(patch) {
  await ready;
  accrue();
  Object.assign(state, patch);
  return refreshActiveNow();
}
api.windows.onFocusChanged.addListener((id) => setState({ focused: id !== api.windows.WINDOW_ID_NONE }));
api.idle.setDetectionInterval(IDLE_SECONDS);
api.idle.onStateChanged.addListener((s) => setState({ idle: s === 'active' ? 'active' : 'idle' }));

// --- Salvataggio ------------------------------------------------------------
function scheduleFlush() {
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
}

function flush() {
  clearTimeout(flushTimer);
  flushTimer = null;
  queue = queue.then(async () => {
    await ready;
    accrue();
    const batch = pending;
    pending = {};
    inflight = batch;
    persistActive();
    const days = Object.keys(batch);
    if (days.length) {
      // Un record per giorno: ogni salvataggio legge e scrive solo i giorni toccati (di solito uno).
      const keys = days.map(dayStorageKey);
      const metaKeys = days.map(metaStorageKey);
      const coeffs = await loadJson('data/coefficients.json');
      const stored = await api.storage.local.get([...keys, ...metaKeys, 'session']);
      const session = stored.session ?? { start: Date.now(), stats: {} };
      const out = { session };
      for (const day of days) {
        const rec = stored[dayStorageKey(day)] ?? {};
        for (const [host, e] of Object.entries(batch[day])) {
          addSample({ [day]: rec }, day, host, e);
          addSample(session.stats, 'all', host, e);
        }
        out[dayStorageKey(day)] = rec;
        out[metaStorageKey(day)] = mergeMeta(stored[metaStorageKey(day)], MODEL_VERSION, coefficientVersion(coeffs));
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
  let title = t('tooltip', { metric: t(`metric.${metric}`), value: makeFormatter(lang, profile.currency)(value, METRICS[metric].unit), profile: t(`profile.${settings.profile in coeffs.profiles ? settings.profile : 'it'}`) });
  // Stato del conteggio del tempo (utile per capire perché a volte non si registra tempo).
  const audioHosts = [...new Set(audible.values())].filter(Boolean);
  const now = state.idle !== 'active' ? t('status.away') : !state.focused ? t('status.unfocused') : active.host ? t('status.counting', { host: active.host }) : t('status.nosite');
  title = `${title}\n${now}${audioHosts.length ? ` · ${t('status.audio', { hosts: audioHosts.join(', ') })}` : ''}`;
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
  for (const [host, bytes, count, unsized] of early.splice(0)) record(host, bytes, count, unsized);
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

const audibleLoaded = api.tabs.query({ audible: true }).then((tabs) => tabs.forEach((t) => !t.incognito && audible.set(t.id, hostFromUrl(t.url)))).catch(() => {});

// Ripristino all'avvio del worker: stato salvato + stato attuale del browser, poi si conta il tempo trascorso
// durante la sospensione (con il tetto MAX_TICK_MS, l'allarme di un minuto basta a non perderne).
ready = (async () => {
  try {
    const [saved, idle, win] = await Promise.all([
      sessionStore ? sessionStore.get(['activeState', 'diagState']) : {}, api.idle.queryState(IDLE_SECONDS), api.windows.getLastFocused().catch(() => null), audibleLoaded,
    ]);
    state.idle = idle === 'active' ? 'active' : 'idle';
    if (win) state.focused = !!win.focused;
    Object.assign(stateMs, saved?.diagState?.stateMs ?? {});
    lastCounted = saved?.diagState?.lastCounted ?? null;
    const st = saved?.activeState;
    // L'ora dell'ultimo conteggio si ripristina sempre (senza, la prima volta si contavano 120 s fittizi, anche ai
    // siti con audio); la scheda attiva solo se l'utente non è assente e la finestra è in primo piano.
    active.since = st?.since ?? Date.now();
    if (st?.host && state.idle === 'active' && state.focused) active.host = st.host;
  } catch { /* si riparte dallo stato attuale */ }
  restored = true;
  accrue();
  await refreshActiveNow();
})();
loadCfg().then(() => refreshBadge()).catch(() => {});
api.tabs.query({}).then((tabs) => tabs.forEach((t) => {
  if (t.incognito) privateTabs.add(t.id);
  else if (!tabHost.has(t.id)) tabHost.set(t.id, hostFromUrl(t.url)); // siti già aperti: servono ad attribuire i lavoratori in background
})).catch(() => {});
