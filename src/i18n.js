// i18n minimale: un file JSON per lingua, fallback inglese. Aggiungere una lingua = aggiungere locales/<codice>.json
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

/** Lingua scelta dall'utente (settings.lang) oppure quella del browser. */
export async function initI18n() {
  const { settings = {} } = await api.storage.local.get('settings');
  const lang = settings.lang || navigator.language.split('-')[0];
  base = (await load(FALLBACK)) ?? {};
  dict = lang === FALLBACK ? base : ((await load(lang)) ?? base);
  document.documentElement.lang = dict === base ? FALLBACK : lang;
  document.documentElement.dir = new Intl.Locale(document.documentElement.lang).textInfo?.direction ?? 'ltr';
  return document.documentElement.lang;
}

export const t = (key) => dict[key] ?? base[key] ?? key;

export function translateDom(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
}
