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
| **2 Streaming preciso** (fatto, senza accesso ai dati) | Streaming più realistico, con stima per eccesso | Nessuno script nelle pagine e nessun permesso: si usano i byte e il tempo già osservati. Riferimento = media realistica arrotondata per eccesso; i flussi osservati a velocità da 4K (oltre 4 GB/h) lo alzano di 1,5 volte; una velocità bassa non lo riduce | Nessuno | Nessun rischio nuovo | Fatto. La lettura della risoluzione reale con uno script per sito resta scartata per privacy |
| **3 AI per servizio** (fatto per il testo) | Sostituisce l'ipotesi "messaggi all'ora" con conteggi reali dei messaggi inviati | Riconosce l'indirizzo della richiesta (metodo, dominio, percorso) e incrementa un contatore; il corpo non viene mai letto | Già coperto dal livello 0; in modalità Light, per sito | Medio: rivela quanto usi l'AI, in locale | Sì, opt-in per servizio. **Attivo**: ChatGPT, Claude, Gemini, Perplexity, DeepSeek (indirizzi da verificare con traffico reale); immagini e video non contati perché mancano i coefficienti |
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

## Livello 3: come funziona oggi
- Impostazioni → Privacy e dati → *Uso dell'AI*: una casella per servizio, tutte spente di default.
- Si conta una richiesta `POST` riuscita (stato 2xx) verso l'indirizzo del servizio. Nessun permesso nuovo e nessun accesso al corpo (nessun `requestBody`: c'è un test che lo vieta).
- Si salvano due numeri per giorno e servizio: messaggi contati (`p`) e tempo coperto dal conteggio (`msc`).
- Il motore usa i conteggi per il tempo coperto e l'ipotesi di messaggi all'ora per il resto; con il tempo quasi tutto coperto e almeno un messaggio visto l'affidabilità sale a "media".
- "Elimina i conteggi AI" toglie solo questi due numeri.
- **Limite**: gli indirizzi dei servizi cambiano. Se un adattatore smette di funzionare il conteggio resta a zero: in quel caso il motore **non** si fida della copertura (un falso zero sarebbe peggio) e torna all'ipotesi dei messaggi all'ora. Gli indirizzi vanno comunque verificati con traffico reale prima della pubblicazione e tenuti aggiornati (`data/ai_adapters.json`).

## Livello 2: come funziona oggi (senza accesso ai dati)
- **Nessun permesso e nessuno script nelle pagine.** Si usano solo i byte e il tempo attivo già raccolti.
- **Riferimento**: energia di rete + data center per ora di streaming = **0,10 kWh/h**. La media realistica è circa 0,077–0,08 (IEA 2019; valore centrale HD della ricerca): il riferimento è alzato di circa il 25% di proposito, per errare per eccesso. Intervallo 0,04–0,24.
- **4K**: se i byte per ora attiva superano 4 GB/h (Netflix: HD circa 3 GB/h, 4K circa 7 GB/h) il riferimento sale di 1,5 volte.
- **Mai al ribasso**: una velocità bassa non riduce la stima, perché i byte sono spesso sottostimati (server che non dichiarano la dimensione).
- **Limite**: i valori per risoluzione della ricerca includono lo schermo e non sono usati direttamente; la musica (poche centinaia di MB all'ora) è stimata con lo stesso riferimento e quindi sovrastimata.
