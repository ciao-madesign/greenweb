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
