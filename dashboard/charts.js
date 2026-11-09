// Grafici SVG senza librerie. I colori arrivano dal CSS (variabili), così seguono tema chiaro/scuro.
const NS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

/** Icone semplici a tratto (48x48). */
const ICONS = {
  car: '<path d="M6 30v-7l5-9h22l5 9v7z"/><circle cx="14" cy="32" r="4"/><circle cx="34" cy="32" r="4"/><path d="M11 23h26"/>',
  bulb: '<path d="M24 6a12 12 0 0 0-6 22v5h12v-5a12 12 0 0 0-6-22z"/><path d="M19 39h10M21 43h6"/>',
  bottle: '<path d="M20 6h8v6l4 6v24a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3V18l4-6z"/><path d="M16 26h16"/>',
};
export function icon(name) {
  const el = svg('svg', { viewBox: '0 0 48 48', width: 44, height: 44, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  el.innerHTML = ICONS[name]; // contenuto statico, definito qui sopra
  return el;
}

/** Semicerchio verde/giallo/rosso con lancetta. `value` e `[lo, hi]` nella stessa unità. */
export function gauge(value, [lo, hi], label) {
  const W = 320, H = 178, cx = 160, cy = 156, r = 124, max = hi * 1.5;
  const p = (f) => [cx + r * Math.cos(Math.PI * (1 - f)), cy - r * Math.sin(Math.PI * (1 - f))];
  const arc = (f0, f1, cls) => {
    const [x0, y0] = p(f0), [x1, y1] = p(f1);
    return svg('path', { d: `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`, class: `arc ${cls}`, fill: 'none', 'stroke-width': 24 });
  };
  const f = Math.min(Math.max(value / max, 0), 1);
  const [nx, ny] = [cx + (r - 34) * Math.cos(Math.PI * (1 - f)), cy - (r - 34) * Math.sin(Math.PI * (1 - f))];
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gauge', role: 'img', 'aria-label': label },
    arc(0, lo / max, 'g-green'), arc(lo / max, hi / max, 'g-yellow'), arc(hi / max, 1, 'g-red'),
    svg('line', { x1: cx, y1: cy, x2: nx, y2: ny, class: 'needle', 'stroke-width': 4, 'stroke-linecap': 'round' }),
    svg('circle', { cx, cy, r: 8, class: 'needle-dot' }));
}

/** Ciambella. items: [{ id, value }]; il colore viene dalla classe `cat-<id>`. */
export function donut(items, label) {
  const R = 70, C = 2 * Math.PI * R, total = items.reduce((s, i) => s + i.value, 0) || 1;
  let offset = 0;
  const segs = items.map((i) => {
    const len = (i.value / total) * C;
    const c = svg('circle', { cx: 90, cy: 90, r: R, fill: 'none', 'stroke-width': 30, class: `seg cat-${i.id}`,
      'stroke-dasharray': `${Math.max(len - 1.5, 0)} ${C - Math.max(len - 1.5, 0)}`, 'stroke-dashoffset': -offset, transform: 'rotate(-90 90 90)' });
    offset += len;
    return c;
  });
  return svg('svg', { viewBox: '0 0 180 180', class: 'donut', role: 'img', 'aria-label': label }, ...segs);
}

/** Barre giornaliere con le due soglie tratteggiate. items: [{ label, value, level, title, today }]. */
export function bars(items, [lo, hi], label) {
  const W = 640, H = 190, top = 10, bottom = 26, plot = H - top - bottom;
  const max = Math.max(hi * 1.25, ...items.map((i) => i.value), 1e-9);
  const y = (v) => top + plot - (v / max) * plot;
  const slot = W / items.length, bw = Math.min(slot * 0.62, 34);
  const out = [
    svg('line', { x1: 0, x2: W, y1: y(lo), y2: y(lo), class: 'thr thr-yellow' }),
    svg('line', { x1: 0, x2: W, y1: y(hi), y2: y(hi), class: 'thr thr-red' }),
  ];
  items.forEach((it, i) => {
    const x = i * slot + (slot - bw) / 2, h = Math.max((it.value / max) * plot, it.value > 0 ? 2 : 0);
    const rect = svg('rect', { x, y: top + plot - h, width: bw, height: h, rx: 3, class: `bar b-${it.level}${it.today ? ' today' : ''}` }, svg('title', {}, it.title));
    out.push(rect, svg('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle', class: `axis${it.today ? ' axis-today' : ''}` }, it.label));
  });
  out.push(svg('line', { x1: 0, x2: W, y1: top + plot, y2: top + plot, class: 'base' }));
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bars', role: 'img', 'aria-label': label }, ...out);
}
