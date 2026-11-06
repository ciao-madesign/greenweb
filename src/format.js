// Formattazione dei valori con Intl (supporta ogni lingua, anche cinese e giapponese).
export function makeFormatter(lang, currency) {
  const sig = new Intl.NumberFormat(lang, { maximumSignificantDigits: 2 });
  const money = new Intl.NumberFormat(lang, { style: 'currency', currency, maximumSignificantDigits: 2 });
  const up = (v, big, small, div = 1000) => (v >= 1000 ? `${sig.format(v / div)} ${big}` : `${sig.format(v)} ${small}`);
  return (v, unit) => {
    switch (unit) {
      case 'Wh': return up(v, 'kWh', 'Wh');
      case 'g': return up(v, 'kg', 'g');
      case 'mL': return up(v, 'L', 'mL');
      default: return money.format(v);
    }
  };
}

/** Unità di misura per le equivalenze (Intl, localizzate). */
export function makeUnits(lang) {
  const u = (unit) => new Intl.NumberFormat(lang, { style: 'unit', unit, unitDisplay: 'short', maximumSignificantDigits: 2 });
  const [km, m, h, min, s] = ['kilometer', 'meter', 'hour', 'minute', 'second'].map(u);
  const n = new Intl.NumberFormat(lang, { maximumSignificantDigits: 2 });
  return {
    num: (v) => n.format(v),
    distanceKm: (v) => (v >= 1 ? km.format(v) : m.format(v * 1000)),
    hours: (v) => (v >= 1 ? h.format(v) : v * 60 >= 1 ? min.format(v * 60) : s.format(v * 3600)),
  };
}
