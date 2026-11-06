// Unico punto di differenza tra browser: Firefox espone `browser`, Chromium `chrome`.
export const api = globalThis.browser ?? globalThis.chrome;
export const action = api.action ?? api.browserAction;
