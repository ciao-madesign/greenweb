#!/usr/bin/env python3
"""Intensità carbonica della rete elettrica dai dati annuali di Ember, per i sei profili regionali.

Uso:
  python3 -I scripts/update-ember.py                 # scarica e mostra i valori
  python3 -I scripts/update-ember.py --apply         # aggiorna data/coefficients.json
  python3 -I scripts/update-ember.py --file x.csv    # usa un file già scaricato

Valore centrale = ultimo anno completo; intervallo = minimo e massimo degli ultimi tre anni.
Basato sulla generazione (non sul consumo) con i fattori di emissione di Ember. Solo libreria standard.
Serve poter raggiungere files.ember-energy.org (da aprire nella rete dell'ambiente).
"""
import argparse, csv, io, json, os, sys, urllib.request

URL = 'https://files.ember-energy.org/public-downloads/generation/outputs/release_generation_yearly_global.csv'
AREAS = {'it': 'Italy', 'eu': 'EU', 'us': 'United States', 'cn': 'China', 'jp': 'Japan', 'world': 'World'}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path):
    if path:
        with open(path, newline='', encoding='utf-8') as f:
            return f.read(), 'file locale'
    req = urllib.request.Request(URL, headers={'User-Agent': 'digital-footprint-counter-data-check'})
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read().decode('utf-8'), r.headers.get('Last-Modified', 'sconosciuta')


def intensities(text):
    """{area: {anno: gCO2e/kWh}} dalle righe 'Total generation'."""
    out = {a: {} for a in AREAS.values()}
    for row in csv.DictReader(io.StringIO(text)):
        if row['Area'] in out and row['Electricity source'] == 'Total generation' and row['Emissions intensity (gCO2e/kWh)']:
            out[row['Area']][int(row['Year'])] = float(row['Emissions intensity (gCO2e/kWh)'])
    return out


def summarize(data):
    latest = min(max(years) for years in data.values())  # ultimo anno presente per tutte le aree
    result = {}
    for pid, area in AREAS.items():
        vals = [data[area][y] for y in range(latest - 2, latest + 1)]
        result[pid] = {'mid': round(data[area][latest]), 'min': round(min(vals)), 'max': round(max(vals))}
    return latest, result


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--file')
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    text, modified = load(args.file)
    latest, res = summarize(intensities(text))
    print(f'Ember, generazione annuale; ultimo anno completo: {latest}; ultima modifica del file: {modified}')
    for pid, v in res.items():
        print(f"  {pid:6} {AREAS[pid]:14} centrale {v['mid']:4}  intervallo {v['min']}-{v['max']} gCO2e/kWh")
    if not args.apply:
        return 0
    path = os.path.join(ROOT, 'data', 'coefficients.json')
    with open(path, encoding='utf-8') as f:
        c = json.load(f)
    note = (f'Ember yearly generation data, {latest} (generation-based, Ember emission factors incl. lifecycle); '
            f'range = {latest - 2}-{latest} minimum and maximum; file last modified {modified}')
    for pid, v in res.items():
        p = c['profiles'][pid]
        p['co2_g_per_kwh'] = v['mid']
        p['co2_range'] = {'min': v['min'], 'max': v['max']}
        p['co2_status'] = 'sourced'
        p['co2_reference'] = note
    c['sources']['ember']['year'] = latest
    c['sources']['ember']['title'] = f'Ember, yearly electricity generation data ({latest}; emissions intensity of total generation)'
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(c, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('data/coefficients.json aggiornato')
    return 0


if __name__ == '__main__':
    sys.exit(main())
