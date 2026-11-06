// i18n minimale: un file JSON per lingua, fallback inglese. Aggiungere una lingua = aggiungere locales/<codice>.json
// Utilizzabile sia nelle pagine sia nel service worker.
import { api } from './compat.js';

const FALLBACK = 'en';
let dict = {};
let base = {};

async function load(lang) {
  try {
    const r = await fetch(api.runtime.getURL(`locales/${lang}.json`));
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Carica le stringhe: lingua scelta dall'utente (settings.lang) oppure quella del browser. */
export async function loadStrings() {
  const { settings = {} } = await api.storage.local.get('settings');
  const lang = settings.lang || navigator.language.split('-')[0];
  base = (await load(FALLBACK)) ?? {};
  dict = lang === FALLBACK ? base : ((await load(lang)) ?? base);
  return dict === base ? FALLBACK : lang;
}

/** Come loadStrings, e imposta lingua e direzione del documento. */
export async function initI18n() {
  const lang = await loadStrings();
  document.documentElement.lang = lang;
  document.documentElement.dir = new Intl.Locale(lang).textInfo?.direction ?? 'ltr';
  return lang;
}

export function t(key, vars) {
  let s = dict[key] ?? base[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

export function translateDom(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
}
