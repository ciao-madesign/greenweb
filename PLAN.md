# Digital Footprint Counter – Piano di sviluppo V1

Estensione browser open source (WebExtensions, Manifest V3) che stima l'impatto ambientale della navigazione. Locale, senza backend, senza account, senza telemetria.

## Principi
- **Semplicità**: poche componenti, JavaScript puro, HTML + CSS, nessuna libreria.
- **Leggerezza**: nessun polling, aggregazione in memoria, salvataggio periodico.
- **Privacy**: solo dominio (mai URL), nessuna lettura del contenuto delle pagine.
- **Trasparenza**: ogni stima ha fonte, affidabilità e intervallo min–max.
- **Credibilità prima della quantità**: meglio poche attività osservabili stimate bene.

## Cosa il browser può misurare
Dominio, byte trasferiti (quando disponibili), tempo di scheda attiva. Non vede i consumi dei server né il tipo di operazione AI. Tutto il resto è stima dichiarata.

## Semplificazioni scelte
1. **Un solo modello di calcolo**: `Energia (Wh) = byte × coeff. rete/data center + tempo × potenza dispositivo per categoria`. CO₂e, acqua e costo sono conversioni dell'energia.
2. **Si salva l'energia (Wh)**, non le tre metriche. Le conversioni si calcolano alla visualizzazione, così cambiare profilo ricalcola anche lo storico.
3. **Aggregazione per dominio e giorno** in memoria, scritta su `storage.local` ogni ~minuto. Nessun conteggio per singola richiesta.
4. **Un catalogo JSON** (domini → categoria, coefficienti con fonte, data, affidabilità, profili regionali). Separato dal codice.
5. **Tempo di utilizzo** da scheda attiva + `idle`. Nessun content script.
6. **`storage.local`** al posto di IndexedDB (bastano aggregati giornalieri).
7. **Indicatore**: badge nativo (testo + colore) e tre icone statiche (verde/giallo/rosso).
8. **Dashboard**: una pagina HTML, grafici in CSS/SVG. **Metodologia** generata dallo stesso catalogo JSON.
9. **Compatibilità**: layer minimo `browser.*`/`chrome.*`; Chrome, Edge, Brave, Firefox in V1; Opera da verificare; Safari V2.

## Profili regionali
Sei profili: **Italia (predefinito)**, UE, USA, Cina, Giappone, media mondiale. Ognuno contiene:
- intensità carbonica della rete (gCO₂e/kWh);
- tariffa elettrica e valuta;
- fattore idrico dell'elettricità (L/kWh).

L'utente sceglie il profilo e, in "Avanzate", può modificare i singoli valori. Fonti previste: Ember, IEA (carbonio); Eurostat, ARERA, EIA, agenzie nazionali (tariffe). I valori esatti si verificano durante lo sviluppo, con fonte e data.

## Lingue
- File `locales/<codice>.json` per lingua, caricamento senza librerie. Aggiungere una lingua = aggiungere un file.
- Lingua del browser all'inizio, modificabile nelle impostazioni; fallback inglese.
- Formati con `Intl` (numeri, date, valute), anche per cinese e giapponese.
- Solo font di sistema; CSS con proprietà logiche per supportare lingue RTL.
- Al lancio: italiano e inglese curati. Cinese e giapponese supportati dalla struttura, traduzione da far rivedere a madrelingua. Altre lingue da contributi.
- Categorie, avvisi e descrizioni dei coefficienti sono chiavi traducibili; le fonti restano in lingua originale.

## Stato
Fasi 1–5 completate (V0.1.0). Restano da chiudere i punti aperti sotto e la verifica su Firefox reale e hardware reale.

## Fasi
### Fase 1 – Scheletro e monitor
- Manifest, service worker, layer di compatibilità.
- Conteggio byte e tempo per dominio, classificazione base da catalogo.
- Salvataggio periodico su `storage.local`.
- Struttura delle lingue (it, en).

### Fase 2 – Catalogo e motore
- Catalogo coefficienti con fonti, data, affidabilità.
- Sei profili regionali.
- Calcolo energia e conversioni (CO₂e, acqua, costo) con intervalli min–max.

### Fase 3 – Indicatore e impostazioni
- Badge colorato con valore, tooltip, clic → dashboard.
- Scelta metrica, profilo, lingua, soglie configurabili.

### Fase 4 – Dashboard e Metodologia
- Sessione, giorno, settimana, mese.
- Analisi per attività e per sito.
- Equivalenze quotidiane con fonti e ipotesi.
- Pagina Metodologia generata dal catalogo.
- Cancellazione di tutti i dati.

### Fase 5 – Rifinitura
- Test su Chrome e Firefox.
- Misura dell'impatto dell'estensione stessa.
- `docs/OPEN_QUESTIONS.md`, README, licenza open source.

## Punti aperti (da approfondire)
- **AI**: in V1 coefficiente generico per categoria (testo, immagini, video), affidabilità **bassa**, intervallo ampio. Da approfondire: coefficienti per modello/operazione, adattatori per servizio, distinzione apertura chat vs generazione.
- **Streaming**: byte spesso non disponibili; stima con durata × bitrate tipico, dichiarata.
- **Acqua**: fattori molto variabili; sempre come intervallo.
- **Traduzioni CJK**: revisione da madrelingua.

## Criteri di completamento V1
- Funziona su Chrome, Edge, Brave, Firefox senza interferire con la navigazione.
- Tre metriche, indicatore, dashboard, Metodologia, tutto locale.
- Ogni stima ha fonte e affidabilità.
- Consumo di risorse dell'estensione verificato.
