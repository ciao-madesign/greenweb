# Confronto con il lavoro della Green Web Foundation (18 novembre 2026)

Fonti lette per intero:
- *Carbon Emissions in Browser DevTools – Firefox Profiler and CO2.js* (Fershad Irani, 31 agosto 2023): https://www.thegreenwebfoundation.org/news/carbon-emissions-in-browser-devtools-firefox-profiler-and-co2-js/
- *How much energy does it really cost to visit a website? Part 1 – the browser* (Chris Adams, 22 ottobre 2026), citato nell'articolo come lettura collegata: https://www.thegreenwebfoundation.org/news/how-much-energy-does-it-really-cost-to-visit-a-website-part-1-the-browser/
- Codice di `@tgwf/co2` 0.16.9, letto **senza eseguirlo** (solo costanti e dati).

## Cosa descrivono
- **Firefox Profiler (dal 104)**: primo strumento di un browser a mostrare la **potenza reale del dispositivo** durante una registrazione (macOS Apple Silicon, Windows 11, Linux), letta dai contatori del sistema operativo. La Green Web Foundation ci ha aggiunto la conversione in CO₂e con CO2.js: *energia × intensità della rete elettrica*.
- **Intensità**: dati annuali di Ember inclusi nel pacchetto, **nessuna richiesta in uscita** (per non rivelare la posizione) e **nessuna posizione salvata nel profilo**, quindi nel Profiler si usa la **media mondiale**. Limite dichiarato: i risultati sovrastimano dove la rete è pulita e sottostimano dove è sporca. Vogliono risultati più locali "nel rispetto della privacy".
- **SCI for Web** (standard in consultazione pubblica, verso l'ISO nel 2027): unità funzionale esplicita; compatibilità con SCI (ISO 21031:2024); **modello dati leggibile da macchina** con il livello di dettaglio e la provenienza di ogni ingresso; **cifre per componente**, non un solo numero opaco: lato client, rete e server, ciascuno operativo e incorporato (sei riquadri, più uno facoltativo per lo sviluppo). Solo intensità basata sul luogo.
- **Tre modi di stimare l'energia del client**: *stima indiretta* (byte per un fattore, come SWD), *misura hardware* (contatore esterno, laboratori di dispositivi) e *misura software* (il dispositivo dichiara il proprio consumo). Sui byte: "la relazione non è direttamente proporzionale".
- **Esempi di misure reali** (corso TU Delft, con EnergiBridge): un blocco pubblicità ha ridotto di **oltre due terzi** l'energia su un sito pieno di pubblicità; guardando lo stesso video su YouTube, Chrome ha consumato circa **un sesto in più di Brave** (e in alcuni casi quasi il doppio).

## Somiglianze con Digital Footprint Counter
| Tema | Loro | Noi |
|---|---|---|
| Formula | energia × intensità della rete | uguale; acqua e costo con lo stesso schema |
| Dati della rete elettrica | Ember, annuali, **inclusi nel pacchetto** | Ember, annuali, inclusi nel pacchetto (`scripts/update-ember.py`) |
| Privacy | nessuna richiesta in uscita, nessuna posizione | nessuna richiesta di rete (la CSP lo vieta), nessuna posizione: la regione si sceglie a mano |
| Basata sul luogo | solo intensità basata sul luogo (SCI) | stessa scelta (generazione, non consumo) |
| Componenti separati | client / rete / server | dispositivo / rete / data center, più acqua |
| Il dispositivo non si stima dai byte | critica ai byte come proxy del client | il dispositivo si calcola dal **tempo**; il segmento "dispositivo" di SWD (0,080 kWh/GB) è escluso |
| Rete e data center | SWD (proxy a byte) | SWD, dichiarato come **allocazione** (Mytton et al. 2024) |
| Trasparenza dei dati | schema con provenienza e qualità | `data/coefficients.json` con fonti, stato, affidabilità, intervalli; versione del modello e dei coefficienti per giorno nel CSV |
| Un solo numero opaco | da evitare | sempre un intervallo min–max con livello di affidabilità |
| Codice aperto | sì | sì (MIT) |

## Verifica numerica con CO2.js 0.16.9 (lettura statica)
- **Costanti SWD v4 identiche**: data center 0,055, rete 0,059, dispositivo 0,080 kWh/GB (operativi); incorporati 0,012, 0,013 e 0,081. Usiamo gli stessi valori per rete e data center.
- **Intensità 2024 nel pacchetto di CO2.js** (Ember, versione precedente) contro il dataset attuale: Italia 287,75 contro 281,4; USA 383,55 contro 383,8; Cina 557,5 contro 559,0; Giappone 483,7 contro 484,3; mondo 472,9 contro 473,0; UE 213,0 contro 211,6. **Concordano entro lo 0,5%, tranne l'Italia (2%)**: la differenza è una revisione del dato 2024 tra due versioni di Ember e spiega il 281/288 trovato in precedenza.
- Noi usiamo il 2025 (un anno più recente).

## Differenze
- **Misura contro stima**: il Profiler legge la potenza reale; un'estensione non ha accesso ai contatori di potenza, quindi la potenza del dispositivo è un'**ipotesi per tipo di dispositivo** (9–13 W sul portatile, studio 2025). È il nostro punto più debole.
- **Cosa influenza davvero l'energia del client**: browser e pubblicità. Il nostro dispositivo dipende solo dal tempo attivo e non vede né il browser né il peso della pagina: sottostima i siti carichi di pubblicità e sovrastima i siti leggeri. Le misure citate indicano differenze molto più grandi dei nostri intervalli.
- **Ambito**: il Profiler è uno strumento per sviluppatori che registra una sessione; noi misuriamo ogni giorno, in modo continuo, per sito e per attività.
- **Luogo**: loro usano la media mondiale per non rivelare la posizione; noi lasciamo scegliere la regione (Italia di serie), con valori modificabili: è un modo di ottenere risultati locali senza geolocalizzazione.
- **Emissioni incorporate**: SCI for Web le prevede per client, rete e server; noi le escludiamo dalla V1 (documentato, ma non dichiarate trascurabili).
- **Unità funzionale**: lo standard la richiede esplicita; noi riportiamo giorno, 7 e 30 giorni, per sito e per attività, senza definirla in modo formale.
- **Acqua**: non compare negli articoli; per noi è una metrica a parte.

## Cosa possiamo prendere
1. **Calibrare la potenza del dispositivo con misure reali**: Firefox Profiler (tracce di potenza) o EnergiBridge su percorsi scriptati (leggere Gmail, un articolo con molta pubblicità, YouTube a 1080p; Chrome contro Firefox). Risolverebbe la domanda aperta sul consumo durante la riproduzione video e darebbe un fattore per tipo di attività.
2. **Un modificatore di attività del client** (richieste e byte al minuto), solo se calibrato dalle misure: oggi sarebbe un numero inventato.
3. **Allinearsi a SCI for Web** quando lo schema sarà pubblicato: unità funzionale esplicita, esportazione con provenienza e livello di dettaglio, un riquadro facoltativo per le emissioni incorporate (ammortizzate).
4. **Test incrociato con CO2.js** (solo in sviluppo, senza distribuirlo): stessi byte, stessi risultati per rete e data center. In questo ambiente non è stato possibile eseguire il suo codice: ne ho letto solo costanti e dati.
5. **Citare** CO2.js, SWD e SCI for Web nella pagina Metodologia e valutare un contatto con la Green Web Foundation, che invita chi realizza strumenti con emissioni a farsi sentire.

## Nota sulla fonte
Il confronto si basa sul testo degli articoli e sul codice del pacchetto; i giudizi su dove siamo più deboli o più forti sono miei e non vengono dagli autori.
