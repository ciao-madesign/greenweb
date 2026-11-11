# Piano di sviluppo Greenweb

Derivato dall'analisi del report esterno, verificato sul codice. Stato aggiornato al 10 novembre 2026.

Principi: nessun server, nessuna telemetria, nessun content script; meglio un intervallo onesto che un numero falsamente preciso; non appesantire l'estensione.

## Già presente (il report lo proponeva, ma esiste)
- Breakdown dispositivo / rete / data center nel motore (`src/engine.js`)
- Acqua diretta (WUE) e indiretta separate
- Intensità carbonica Ember verificata (`docs/data-checks/`)
- Esportazione CSV e cancellazione dati

## Fase 1 – Affidabilità (priorità massima)
- [x] 1. Byte non disponibili distinti da zero (richieste senza dimensione contate, affidabilità ridotta, nota in dashboard)
- [x] 2. Versionamento del modello per giorno (`model_version`, `coefficient_version`, colonne CSV). Aumentare `MODEL_VERSION` in `src/engine.js` quando cambiano le formule
- [x] 2b. Stima dei byte per le richieste senza dimensione dichiarata (`nu`): dimensione media assunta di 30 KB (10–100 KB, ipotesi dichiarata in `data/coefficients.json`), così i siti che non dichiarano la dimensione non risultano quasi gratuiti. `MODEL_VERSION` 3. Dettagli della dashboard con tempo attivo, dati e ripartizione dispositivo/rete/data center
- [x] 2c. Tempo attivo perso quando il browser sospende il service worker (scoperto dai dati reali: 0 s per Gmail e ChatGPT). Stato in `storage.session`, assenza dopo 5 minuti, `MODEL_VERSION` 4, prova `scripts/e2e-active-time.cjs` (senza la correzione 20 s su 130, con la correzione 117 s)
- [x] 2d. Contatore delle richieste non attribuibili a una scheda (lavoratori in background, `ua`/`ub`): solo conteggio, non entra nella stima; visibile nei dettagli della dashboard e nel CSV. Prova `scripts/e2e-unattributed.cjs`. Da valutare con dati reali (YouTube) se includerle nella stima
- [ ] 3. Verifica degli adattatori AI con traffico reale: **ChatGPT fatto (11/11/2026)**; mancano Perplexity, Claude, Gemini, DeepSeek e aggiornamento `status` in `data/ai_adapters.json`. Lavoro manuale
- [ ] 4. Test su Firefox reale (`webRequest`, `idle`, permessi all'installazione)
- [ ] 5. Documenti minimi: `ARCHITECTURE.md`, `CHANGELOG.md`, `CONTRIBUTING.md`

## Fase 2 – Utilità quotidiana (dopo la prima release pubblica)
- [ ] 6. Ranking dei siti (totale e per ora d'uso)
- [ ] 7. Profilo dispositivo configurabile (tipo e potenza media in W; niente user agent)
- [ ] 8. Baseline personale (media ultimi 30 giorni) e obiettivi opzionali
- [ ] 9. Pagina Privacy audit (permessi, dati salvati, dove, cosa non viene letto)
- [ ] 10. Report CSV con intervalli di stima e fonti (PDF via stampa del browser)

## Fase 3 – Solo se serve
- [ ] 11. Intensità carbonica basata sui consumi (dati statici)
- [ ] 12. Acqua per paese (richiede fonti affidabili)
- [ ] 13. Equivalenze ampliate (ognuna con fonte, data, incertezza)
- [ ] 14. What-if simulator (dipende da coefficienti affidabili)

## Scartato o rimandato
- Intensità oraria da servizi esterni: rompe "nessun server". Eventualmente solo curve statiche incluse nel pacchetto
- Dominio della richiesta (CDN, tracker) come secondo livello: più dati salvati e più complessità privacy
- Cache awareness: benefici incerti
- Nuove categorie (gaming, videochiamate, mappe): mancano coefficienti, rischio di stime inventate
- Tempo attivo più preciso: richiederebbe content script
- Safari, Android, API locale, modalità scuole: prematuro (V2)
- Report PDF dedicato, framework UI: peso senza valore proporzionato

## Note aperte
- Stima dei byte mancanti per tipo di risorsa (immagini, script, media): servono coefficienti che non abbiamo. Per ora si usa una dimensione media unica per richiesta (ipotesi)
