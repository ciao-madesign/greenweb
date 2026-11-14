# Store listing (Chrome Web Store, Edge Add-ons, Firefox AMO, Opera)

Images: `store/screenshots/` (1280×800) and `store/promo-tile-440x280.png`. Privacy policy: `PRIVACY.md` (publish it at a public URL, e.g. the repository page or the site).

## Name
Greenweb

## Short description (≤132 characters)
- EN: See the footprint of your browsing: energy, CO₂e and water, estimated privately on your device with documented sources.
- IT: Scopri l'impatto della tua navigazione: energia, CO₂e e acqua, stimati sul tuo dispositivo con fonti documentate.

## Category
Chrome and Edge: Productivity. Firefox: Other.

## Long description (EN)
Greenweb adds a small leaf to your toolbar that estimates the energy, CO₂e, water and electricity cost behind your browsing.

• Green, yellow or red leaf with a badge for today's value (CO₂e, water or cost).
• Dashboard with session, today, 7 and 30 days, breakdown by activity and by site, and everyday equivalences.
• Methodology page: every number traces back to a formula, a range and a source.
• Regional profiles (Italy, EU, USA, China, Japan, world average), all adjustable.
• English and Italian; more languages are one file away.

Estimates, not measurements: browsers cannot see server consumption, so every value is a documented range with a reliability level. Open source (MIT).

Privacy: no account, no server, no telemetry. Only domain, request count, bytes and active time are kept on your device. Never page content, full addresses, prompts or passwords. Delete everything from Settings at any time.

## Long description (IT)
Greenweb aggiunge una piccola foglia alla barra degli strumenti che stima energia, CO₂e, acqua e costo elettrico della tua navigazione.

• Foglia verde, gialla o rossa con badge del valore di oggi (CO₂e, acqua o costo).
• Dashboard con sessione, oggi, 7 e 30 giorni, ripartizione per attività e sito, equivalenze quotidiane.
• Pagina Metodologia: ogni numero rimanda a formula, intervallo e fonte.
• Profili regionali (Italia, UE, USA, Cina, Giappone, media mondiale), tutti modificabili.
• Italiano e inglese; altre lingue con un solo file.

Stime, non misure: il browser non vede i consumi dei server, quindi ogni valore è un intervallo documentato con un livello di affidabilità. Open source (MIT).

Privacy: nessun account, nessun server, nessuna telemetria. Si conservano sul dispositivo solo dominio, numero di richieste, byte e tempo attivo. Mai contenuti, indirizzi completi, prompt o password. Puoi cancellare tutto dalle Impostazioni.

## Single purpose
Estimate and display the environmental footprint of the user's web browsing.

## Permission justifications
- **webRequest + access to http/https sites**: observe (read-only, non-blocking) the number and declared size of requests and which tab they belong to, to estimate data transfer. Nothing is modified, and only the domain is stored.
- **Optional AI message counting**: if the user enables it for a service, a successful POST request to that service's address increments a counter. The request body is never read and no content is stored.
- **idle**: stop counting active time when the user is away (no input for 5 minutes or screen locked).
- **storage**: keep statistics and settings locally.
- **alarms**: one wake-up per minute to save data and refresh the badge.
- No remote code, no data transmitted, no content scripts.

## Data use declarations
- Collects: none transmitted. Stored locally: website activity (domain, counts, bytes, time).
- Not sold, not shared, not used for unrelated purposes, not used for creditworthiness or lending.

---

# Firefox AMO: scheda definitiva (aggiornata 2026-11-14)
Basata sulla guida Mozilla "Creating an appealing add-on listing". Sostituisce, per Firefox, i testi sopra, che non citano le funzioni più recenti.

## Campi
| Campo | Valore | Motivo (dalla guida) |
|---|---|---|
| Nome sulla scheda | Greenweb – Browsing Footprint | Nome unico e descrittivo; "Greenweb" da solo non dice cosa fa. Il nome del manifest resta "Greenweb". Il nome breve (slug) segue il nome. |
| Sommario EN (126) | Estimate the energy, CO₂e and water footprint of your browsing, privately on your device. No account, no server, no telemetry. | Il più breve possibile, senza usare tutti i 250 caratteri. |
| Sommario IT (119) | Stima energia, CO₂e e acqua della tua navigazione, in privato sul tuo dispositivo. Nessun account, server o telemetria. | idem |
| Categoria | "Il mio componente aggiuntivo non rientra in alcuna delle categorie" | Funzione principale: impronta ambientale, non privacy/sicurezza. Una categoria sbagliata fa più male che bene. Rivalutare "Privacy e sicurezza" solo se Destination Control diventa centrale. |
| Sperimentale | Sì, fino alla 1.0 | Dati `to_verify`, adattatori AI non verificati, non ancora provata su Firefox reale: meglio dichiararlo che prendere recensioni negative immeritate. |
| Piattaforme | Solo Linux, macOS, Windows | Il funzionamento su Firefox per Android non è verificato. |
| Tag (max 10) | carbon footprint, co2, energy, sustainability, emissions, water footprint, green, data usage, bandwidth, privacy | Parole che le persone cercano, usate in modo naturale. |
| Supporto | Email del progetto (pubblica) · sito: https://github.com/ciao-madesign/greenweb/issues · pagina iniziale: https://github.com/ciao-madesign/greenweb | Dare tutti e tre; almeno l'email. |
| Licenza | MIT | |
| Privacy policy | Sì: incollare il testo di `PRIVACY.md` nella scheda (anche se è pubblicata altrove) | Linguaggio semplice, testo nella scheda. |
| Lingua predefinita | en-US, con scheda italiana localizzata | Chi usa altre lingue vede l'inglese. |

## Descrizione (EN)
See what your browsing costs the planet, without giving up your privacy. Greenweb adds a leaf to your toolbar that turns green, yellow or red with the estimated CO₂e, water and electricity cost of what you do online. Everything is computed on your device.

**Why you may like it**
- *Know where it comes from:* a dashboard for today, 7 and 30 days, by activity (streaming, social, AI, browsing) and by site, total or per hour of use.
- *Trust the numbers:* every value is a range with a reliability level, and a Methodology page traces it to a formula and a source. Missing data is shown as missing, never as zero.
- *Make it yours:* regional profiles (Italy, EU, USA, China, Japan, world), your own device power and external monitor.
- *Check the privacy yourself:* a Privacy page reads the extension's permissions and stored data live.

**Optional: Destination Control (off by default)**
See which providers (cloud, CDN) receive your requests, using a dataset bundled in the extension. No lookup service is contacted. You can write rules and simulate their effect; nothing is blocked.

**Private by design**
No account, no server, no telemetry, no content scripts. Only domain, request count, bytes and active time stay on your device. Never page content, full addresses, search terms, prompts or passwords. Private windows are never tracked. Pause, exclude sites, export or delete everything from Settings.

Estimates, not measurements: a browser cannot see server consumption. Open source (MIT): https://github.com/ciao-madesign/greenweb

## Descrizione (IT)
Scopri quanto costa al pianeta la tua navigazione, senza rinunciare alla privacy. Greenweb aggiunge una foglia alla barra degli strumenti che diventa verde, gialla o rossa in base a CO₂e, acqua e costo elettrico stimati di ciò che fai online. Tutto è calcolato sul tuo dispositivo.

**Perché può piacerti**
- *Capire da dove arriva:* una dashboard per oggi, 7 e 30 giorni, per attività (streaming, social, AI, navigazione) e per sito, in totale o per ora d'uso.
- *Fidarsi dei numeri:* ogni valore è un intervallo con un livello di affidabilità e una pagina Metodologia lo riporta a formula e fonte. I dati mancanti sono mostrati come mancanti, mai come zero.
- *Personalizzare:* profili regionali (Italia, UE, USA, Cina, Giappone, mondo), potenza del tuo dispositivo e di un monitor esterno.
- *Verificare la privacy da soli:* una pagina Privacy legge dal vivo i permessi dell'estensione e i dati memorizzati.

**Facoltativo: Destination Control (spento di default)**
Vedi quali provider (cloud, CDN) ricevono le tue richieste, con un dataset incluso nell'estensione. Nessun servizio di ricerca viene contattato. Puoi scrivere regole e simulare cosa farebbero; nulla viene bloccato.

**Privacy fin dal progetto**
Nessun account, server, telemetria o script nelle pagine. Sul dispositivo restano solo dominio, numero di richieste, byte e tempo attivo. Mai contenuti, indirizzi completi, termini di ricerca, prompt o password. Le finestre private non vengono mai monitorate. Dalle Impostazioni puoi mettere in pausa, escludere siti, esportare o cancellare tutto.

Stime, non misure: il browser non vede i consumi dei server. Open source (MIT): https://github.com/ciao-madesign/greenweb

## Note di versione 0.1.1 (EN / IT)
- EN: First public release. Footprint dashboard, site ranking, Methodology and Privacy pages, optional Destination Control (simulation only).
- IT: Prima versione pubblica. Dashboard dell'impronta, classifica dei siti, pagine Metodologia e Privacy, Destination Control facoltativo (solo simulazione).

## Schermate
Le 5 in `store/screenshots/` sono 1280×800 (formato consigliato), senza testo sovrapposto; vanno ordinate come una storia: dashboard, scuro, metodologia, impostazioni, benvenuto. Da aggiungere: la pagina Privacy e il pannello Destination Control. Le didascalie (localizzabili) vanno scritte nei campi della scheda, non sull'immagine.

## Da non fare
Non chiedere recensioni dentro l'estensione e non precompilarle. Rispondere alle recensioni dalla scheda.
