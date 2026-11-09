# Modalità di precisione (facoltative)

Obiettivo: stime più precise **solo se l'utente lo sceglie**, senza chiedere più di quanto serve e senza raccogliere contenuti.

## Principi
1. **Un interruttore per livello**, spento di default, con spiegazione prima della richiesta del browser: cosa leggiamo, cosa non leggiamo, dove resta il dato.
2. **Solo numeri aggregati**: contatori giornalieri. Mai testi, titoli, URL, prompt, cookie.
3. **Per sito o per servizio** dove possibile (permessi opzionali richiesti al momento, revocabili).
4. **Revoca facile**: spegnere il livello rimuove il permesso e, a scelta, i dati raccolti con quel livello.
5. **Verificabile**: codice aperto, descrizione di ogni livello nella pagina Metodologia, e una regola di sicurezza (CSP) che vieta qualsiasi connessione esterna.

## I livelli
| Livello | Cosa migliora | Come | Permesso | Rischio privacy | Consiglio |
|---|---|---|---|---|---|
| **0 Base** (oggi) | Stima da dominio, byte dichiarati, tempo | `webRequest` in sola lettura | accesso ai siti + `webRequest` | Basso: solo dominio e conteggi | Sempre |
| **1 Dati più completi** | Profilo del dispositivo (fatto). Byte inviati e andamento orario della rete elettrica: **non realizzabili ora** | Scelta manuale portatile/desktop/telefono. I browser non espongono la dimensione delle richieste nelle intestazioni: servirebbe leggere il corpo (`requestBody`), che non facciamo. Mancano i dati orari affidabili per le curve | Nessuno nuovo | Molto basso | Fatto per il dispositivo; il resto si riprende se emergono dati o API adatte |
| **2 Streaming preciso** | Risoluzione reale del video → energia per ora molto più accurata | Script minimo su siti scelti (YouTube, Netflix, Twitch…) che legge solo altezza del video, riproduzione/pausa | Permesso di sito **per sito**, opzionale | Medio-basso: non legge titoli né URL | Sì, opt-in per sito |
| **3 AI per servizio** | Sostituisce l'ipotesi "prompt all'ora" con conteggi reali di prompt e generazioni | Riconosce l'endpoint del servizio (solo metodo e percorso) e incrementa un contatore | Già coperto dal livello 0; in modalità Light, per sito | Medio: rivela quanto usi l'AI, in locale | Sì, opt-in per servizio. Il valore più alto per l'accuratezza |
| **4 Carico del dispositivo** | Potenza reale al posto dell'ipotesi 9–50 W | Un campione al minuto del carico CPU | `system.cpu` opzionale (solo Chrome/Edge) | Medio-basso: non identifica contenuti | Facoltativo avanzato |

## Da non fare
- `debugger` (mostra un avviso e dà accesso totale), lettura del flusso di risposta in Firefox (`filterResponseData`), `history`, `cookies`, URL completi, geolocalizzazione (la regione si sceglie a mano).
- Servizi esterni per l'intensità carbonica in tempo reale: richiedono rete e posizione. Si usano dati statici nel pacchetto, aggiornati con le versioni.

## Come mantenere il massimo della privacy
- **Conservazione configurabile**: 7, 30 o 90 giorni (oggi 90, fisso). I dati dei livelli avanzati con la stessa scadenza.
- **Cancellazione**: "Elimina tutto" (esiste) e "Elimina solo i dati dei livelli avanzati".
- **Pausa**: un pulsante per sospendere il monitoraggio.
- **Esclusioni**: elenco di domini mai monitorati (consigliare banche, sanità, lavoro).
- **Finestre private**: non monitorate.
- **Visibilità**: se un livello avanzato è attivo, la foglia lo segnala nel tooltip e le impostazioni elencano cosa viene letto.
- **Nessuna esportazione automatica**: eventuale esportazione CSV solo manuale e locale.
- **Garanzia tecnica**: la CSP dell'estensione consente solo connessioni ai propri file (`connect-src 'self'`), già attiva; test automatico che la verifica.

## Ordine di lavoro proposto
1. Livello 1 (nessuna richiesta) e controlli di privacy (finestre private, pausa, esclusioni, conservazione).
2. Livello 3 con adattatori per i servizi AI più diffusi (catalogo JSON aggiornabile).
3. Livello 2 per YouTube e Netflix.
4. Livello 4 solo se serve davvero, dopo aver misurato quanto migliora la stima.

Ogni livello deve arrivare con: testo di consenso, voce nella Metodologia, test che non vengano letti contenuti, e un confronto prima/dopo dell'accuratezza.
