#!/usr/bin/env python3
"""Trasforma le misure di potenza (vedi docs/CALIBRAZIONE.md) in PROPOSTE di coefficienti.

Uso:
  python3 -I scripts/calibrate-device.py --input misure.csv          # tabella
  python3 -I scripts/calibrate-device.py --input misure.csv --json   # proposta in JSON

Non modifica mai data/coefficients.json: i valori si valutano e si inseriscono a mano, con la fonte.
Solo libreria standard.
"""
import argparse, csv, json, statistics, sys
from collections import defaultdict

BROWSING = ('reading', 'news_ads', 'email')
STREAMING = 'video_1080p'
MIN_RUNS = 5          # prove minime per un valore affidabile
MIN_FIT_RUNS = 12     # prove minime per proporre un fattore di attività
MIN_R2 = 0.5


def load(path):
    rows = []
    with open(path, newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            try:
                dur, e = float(r['duration_s']), float(r['energy_j'])
                if dur <= 0:
                    continue
                rows.append({
                    'device': r['device_type'], 'browser': r['browser'], 'adblock': r['adblock'], 'journey': r['journey'],
                    'w': e / dur, 'idle': float(r['idle_w'] or 0), 'req_min': float(r['requests'] or 0) / (dur / 60),
                    'synthetic': 'SYNTHETIC' in (r.get('notes') or ''),
                })
            except (KeyError, ValueError):
                continue
    return rows


def pct(values, p):
    """Percentile con interpolazione lineare (p tra 0 e 100)."""
    v = sorted(values)
    if len(v) == 1:
        return v[0]
    k = (len(v) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)


def summarize(rows):
    groups = defaultdict(list)
    for r in rows:
        groups[(r['device'], r['browser'], r['adblock'], r['journey'])].append(r)
    out = []
    for (dev, br, ad, jr), g in sorted(groups.items()):
        w = [x['w'] for x in g]
        idle = [x['idle'] for x in g if x['idle'] > 0]
        out.append({'device': dev, 'browser': br, 'adblock': ad, 'journey': jr, 'runs': len(g),
                    'median_w': round(statistics.median(w), 2), 'p10_w': round(pct(w, 10), 2), 'p90_w': round(pct(w, 90), 2),
                    'net_w': round(statistics.median(w) - statistics.median(idle), 2) if idle else None,
                    'warning': f'meno di {MIN_RUNS} prove' if len(g) < MIN_RUNS else ''})
    return out


def fit(points):
    """Retta potenza = a + b * richieste/minuto: (b, R2) oppure None."""
    n = len(points)
    if n < 3:
        return None
    mx = sum(x for x, _ in points) / n
    my = sum(y for _, y in points) / n
    sxx = sum((x - mx) ** 2 for x, _ in points)
    if sxx == 0:
        return None
    b = sum((x - mx) * (y - my) for x, y in points) / sxx
    ss_tot = sum((y - my) ** 2 for _, y in points)
    ss_res = sum((y - (my + b * (x - mx))) ** 2 for x, y in points)
    return b, (1 - ss_res / ss_tot) if ss_tot else 0.0


def propose(rows):
    prop = {'device_power_w': {}, 'streaming_device_factor': {}, 'activity_factor': {}, 'notes': []}
    by_dev = defaultdict(list)
    for r in rows:
        by_dev[r['device']].append(r)
    for dev, rs in by_dev.items():
        browse = [r['w'] for r in rs if r['journey'] in BROWSING]
        video = [r['w'] for r in rs if r['journey'] == STREAMING]
        if browse:
            prop['device_power_w'][dev] = {'min': round(pct(browse, 10), 1), 'mid': round(statistics.median(browse), 1), 'max': round(pct(browse, 90), 1), 'runs': len(browse)}
            if len(browse) < MIN_RUNS:
                prop['notes'].append(f'{dev}: solo {len(browse)} prove di navigazione, valore poco affidabile')
        if browse and video:
            prop['streaming_device_factor'][dev] = round(statistics.median(video) / statistics.median(browse), 2)
        pts = [(r['req_min'], r['w']) for r in rs if r['journey'] in BROWSING and r['req_min'] > 0]
        res = fit(pts) if len(pts) >= MIN_FIT_RUNS else None
        if res and res[1] >= MIN_R2:
            prop['activity_factor'][dev] = {'watts_per_request_per_minute': round(res[0], 4), 'r2': round(res[1], 2), 'runs': len(pts)}
        else:
            prop['activity_factor'][dev] = 'nessuna proposta (servono almeno %d prove con R2 >= %.1f)' % (MIN_FIT_RUNS, MIN_R2)
    if any(r['synthetic'] for r in rows):
        prop['notes'].append('ATTENZIONE: dati SINTETICI, non utilizzabili come fonte')
    return prop


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--input', required=True)
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    rows = load(a.input)
    if not rows:
        print('Nessuna misura valida nel file.', file=sys.stderr)
        return 1
    table, prop = summarize(rows), propose(rows)
    if a.json:
        print(json.dumps({'groups': table, 'proposal': prop}, ensure_ascii=False, indent=2))
        return 0
    print(f"{'dispositivo':13} {'browser':12} {'adblock':8} {'percorso':12} {'prove':5} {'W mediana':9} {'p10':6} {'p90':6} {'W netta':8}")
    for t in table:
        print(f"{t['device']:13} {t['browser']:12} {t['adblock']:8} {t['journey']:12} {t['runs']:5} {t['median_w']:9} {t['p10_w']:6} {t['p90_w']:6} {str(t['net_w']):8} {t['warning']}")
    print('\nProposta (da valutare e inserire a mano in data/coefficients.json):')
    print(json.dumps(prop, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
