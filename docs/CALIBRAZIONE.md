# Calibrare la potenza del dispositivo con misure reali

Oggi la potenza del dispositivo è un'**ipotesi per tipo** (portatile 12 W, intervallo 5–25 W; da uno studio del 2025: 9–13 W in navigazione). Un'estensione non può leggere i contatori di potenza. La Green Web Foundation segnala che il consumo del client dipende dal **browser** e dalla **pagina** (un blocco pubblicità ha tolto oltre due terzi dell'energia su un sito pieno di annunci; Chrome ha consumato circa un sesto in più di Brave guardando YouTube): vanno misurati, non indovinati.

Questo documento spiega **come misurare**; `scripts/calibrate-device.py` trasforma le misure in **proposte** di coefficienti. Non si applica nulla in automatico: i numeri si valutano e si inseriscono a mano in `data/coefficients.json` con fonte e data.

## Definizione che usiamo
Potenza **lorda** del dispositivo intero (schermo compreso) mentre si fa l'attività: è ciò che misura lo studio che adottiamo (9–13 W) ed è coerente con il modello (`ore attive × watt`). Il consumo a riposo con lo stesso schermo acceso si registra a parte (`idle_w`) e il programma riporta anche la potenza **netta**, solo per informazione.

## Strumenti (a scelta)
- **Firefox Profiler** con la registrazione della potenza (Firefox 104 o successivo; macOS Apple Silicon, Windows 11, Linux): misura il dispositivo mentre Firefox esegue il percorso.
- **EnergiBridge** (open source, usato nel corso TU Delft citato dalla Green Web Foundation): misura per qualsiasi browser, adatto a confrontare Chrome, Brave e Firefox.
- Un **contatore esterno** tra presa e alimentatore, per un controllo.

## Condizioni da fissare
Stessa luminosità dello schermo, nessun'altra applicazione, alimentatore collegato (oppure sempre a batteria, ma sempre uguale), stessa rete, browser appena riavviato. **Almeno 5 ripetizioni** per ogni percorso (meglio 10), alternando i percorsi per non favorirne uno.

## Percorsi consigliati (3–5 minuti ciascuno)
| Codice | Cosa fare |
|---|---|
| `reading` | Leggere un articolo lungo senza pubblicità, scorrendo ogni tanto |
| `news_ads` | Una home di notizie piena di pubblicità (per esempio ANSA o Tuttomercatoweb), scorrendo |
| `email` | Aprire e leggere 6 email in Gmail |
| `video_1080p` | YouTube a 1080p, a schermo non intero |
| `ai_chat` | Una conversazione con un chatbot (5 messaggi) |
| `idle` | Schermo acceso, browser fermo su una pagina vuota (riferimento) |

Per ogni percorso si ripete con e senza blocco pubblicità, e per ogni browser che si vuole confrontare.

## Cosa registrare
File CSV (modello in `docs/calibration-template.csv`): `run_id, device_type, os, browser, adblock, journey, duration_s, energy_j, idle_w, bytes, requests, notes`.
- `device_type`: `laptop`, `laptop_apple`, `desktop`, `tablet` o `phone` (come nelle Impostazioni).
- `energy_j`: energia misurata nel percorso, in joule (potenza media × secondi).
- `bytes` e `requests`: dal CSV dei dati dell'estensione (Impostazioni → Esporta i miei dati) riferiti allo stesso percorso: tengono insieme potenza e traffico.

## Elaborazione
```bash
python3 -I scripts/calibrate-device.py --input misure.csv            # tabella leggibile
python3 -I scripts/calibrate-device.py --input misure.csv --json     # proposta in JSON
```
Il programma riporta per tipo di dispositivo, browser e percorso: numero di prove, potenza lorda mediana, 10° e 90° percentile (che diventano min e max proposti), potenza netta e un avviso con meno di 5 prove. Propone poi:
- **Potenza del dispositivo** per tipo: mediana dei percorsi di navigazione (`reading`, `news_ads`, `email`).
- **Fattore per lo streaming**: potenza di `video_1080p` diviso la potenza di navigazione.
- **Fattore di attività della pagina** (richieste al minuto contro potenza): solo se ci sono almeno 12 prove e R² ≥ 0,5. Altrimenti il programma scrive "nessuna proposta": con dati deboli non si inventa un modificatore.

## Prima di adottare un valore
1. Controllare le avvertenze (poche prove, un solo dispositivo).
2. Citare la misura come fonte in `data/coefficients.json` (strumento, dispositivo, data, numero di prove) e metterla in stato `sourced`.
3. Aumentare `MODEL_VERSION` in `src/engine.js` se cambia la formula (per esempio un fattore di streaming per il dispositivo, oggi non presente nel motore).
4. Un modificatore di attività si introduce nel motore **solo dopo** una misura che lo giustifichi.

Il file `scripts/calibration-sample.synthetic.csv` contiene **dati inventati** (sono segnati `SYNTHETIC`) e serve solo a provare il programma.
