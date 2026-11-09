# Diffusione e installazione

Obiettivo: chi sente parlare del progetto deve poterlo avere in **un clic**, nel proprio browser, senza account e senza leggere istruzioni.

## 1. Il percorso ideale dell'utente
1. Trova il link (sito, articolo, post).
2. Un solo pulsante "Aggiungi a <il tuo browser>" porta alla scheda dello store giusto (la pagina del sito riconosce il browser).
3. Installa con un clic. Si apre da sola la pagina di benvenuto: regione, lingua, metrica, come fissare la foglia.
4. Naviga. La foglia si colora da sola; un clic apre la dashboard.
5. Gli aggiornamenti arrivano dallo store, senza fare nulla.

Già pronti: pagina di benvenuto, sito con rilevamento del browser (`site/`), pacchetto (`npm run package`), testi e immagini per gli store (`store/`), privacy policy (`PRIVACY.md`), workflow di rilascio e di pubblicazione del sito (`.github/workflows/`).

## 2. Canali di installazione
| Canale | Copre | Costo | Note |
|---|---|---|---|
| **Chrome Web Store** | Chrome, Brave (e Edge con avviso) | 5 $ una tantum | Il canale più importante. Il permesso sui siti http/https richiede una giustificazione chiara (in `store/listing.md`); revisione di qualche giorno. |
| **Edge Add-ons** | Edge | gratuito | Stesso pacchetto, iscrizione separata. |
| **Firefox (AMO)** | Firefox desktop e, da verificare, Android | gratuito | Serve la dichiarazione sui dati (già nel manifest). Codice non minificato, quindi revisione semplice. |
| **Opera Add-ons** | Opera | gratuito | Opera installa anche dallo store di Chrome con un'estensione dedicata; è facoltativo. |
| **Safari** | Safari macOS/iOS | 99 $/anno | V2: richiede Xcode e conversione (`safari-web-extension-converter`). |
| **GitHub Releases** | Chi vuole il file | gratuito | Zip automatico a ogni tag `v*`. Per sviluppatori e per chi non usa gli store. |

Ordine consigliato: Chrome Web Store, Firefox, Edge, poi Opera. Un solo zip per tutti.

## 3. Cosa serve da te (azioni umane)
- Registrare l'account sviluppatore Chrome (5 $), Edge e Firefox con un indirizzo del progetto.
- Pubblicare `PRIVACY.md` a un indirizzo pubblico (basta il sito o la pagina del repository).
- Attivare GitHub Pages: *Settings → Pages → Source: GitHub Actions* (il workflow esiste già).
- Impostare `main` come branch predefinito del repository.
- Caricare lo zip e i testi di `store/listing.md`; inserire poi gli indirizzi degli store in `site/page.html` (variabile `STORES`).
- Test reale su Firefox e su un laptop (vedi `docs/OPEN_QUESTIONS.md`) prima della pubblicazione.

## 4. Automazione (dopo la prima pubblicazione)
- Tag `vX.Y.Z` → workflow *Release*: test, pacchetto, release GitHub con lo zip.
- Facoltativo: aggiungere ai workflow la pubblicazione automatica sugli store (token nei *secrets* del repository). Si introduce solo quando le schede esistono e il processo manuale è stato provato.

## 5. Far conoscere il progetto
Il messaggio: "Scopri l'impatto della tua navigazione. Stime oneste, nessun dato lascia il tuo computer."
- **Credibilità prima di tutto**: invitare ricercatori di sostenibilità del web e di energia a rivedere la Metodologia; citare le loro osservazioni nel sito. Un parere esterno vale più di qualsiasi annuncio.
- **Comunità giuste**: Green Software Foundation, ClimateAction.tech, The Green Web Foundation, gruppi italiani di sostenibilità digitale, Mastodon e LinkedIn.
- **Lancio**: un articolo che spiega perché stima invece di misurare e come si calcola un numero ("da 48 minuti di video a 26 g di CO₂e"); poi Show HN e Product Hunt con schermate reali; stampa di settore (tecnologia e ambiente).
- **Contributi**: traduzioni (un file), nuovi domini, revisione dei coefficienti. Etichettare le *issue* adatte ai nuovi contributori.
- **Scuole e aziende**: un foglio "come usarlo in classe / in ufficio" e le impostazioni predefinite per regione.
- **Passaparola senza tracciamento**: una scheda "il mio impatto" condivisibile, generata in locale e inviata solo se l'utente sceglie di condividerla (idea per la V2).

## 6. Come capire se funziona senza telemetria
Statistiche degli store (installazioni, attivi), stelle e download su GitHub, segnalazioni e traduzioni ricevute. Nessun dato dall'estensione.

## 7. Rischi da gestire
- **Revisione degli store**: giustificare bene `webRequest` e l'accesso ai siti; non usare affermazioni ambientali non verificabili nella descrizione (usiamo "stima").
- **Fiducia**: valori `to_verify` e `assumption` restano visibili; chi li corregge va ringraziato pubblicamente.
- **Aggiornamento dei coefficienti**: pianificare una revisione annuale dei dati (intensità carbonica, prezzi).
