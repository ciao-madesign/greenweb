# Store listing (Chrome Web Store, Edge Add-ons, Firefox AMO, Opera)

Images: `store/screenshots/` (1280×800) and `store/promo-tile-440x280.png`. Privacy policy: `PRIVACY.md` (publish it at a public URL, e.g. the repository page or the site).

## Name
Digital Footprint Counter

## Short description (≤132 characters)
- EN: See the footprint of your browsing: energy, CO₂e and water, estimated privately on your device with documented sources.
- IT: Scopri l'impatto della tua navigazione: energia, CO₂e e acqua, stimati sul tuo dispositivo con fonti documentate.

## Category
Chrome and Edge: Productivity. Firefox: Other.

## Long description (EN)
Digital Footprint Counter adds a small leaf to your toolbar that estimates the energy, CO₂e, water and electricity cost behind your browsing.

• Green, yellow or red leaf with a badge for today's value (CO₂e, water or cost).
• Dashboard with session, today, 7 and 30 days, breakdown by activity and by site, and everyday equivalences.
• Methodology page: every number traces back to a formula, a range and a source.
• Regional profiles (Italy, EU, USA, China, Japan, world average), all adjustable.
• English and Italian; more languages are one file away.

Estimates, not measurements: browsers cannot see server consumption, so every value is a documented range with a reliability level. Open source (MIT).

Privacy: no account, no server, no telemetry. Only domain, request count, bytes and active time are kept on your device. Never page content, full addresses, prompts or passwords. Delete everything from Settings at any time.

## Long description (IT)
Digital Footprint Counter aggiunge una piccola foglia alla barra degli strumenti che stima energia, CO₂e, acqua e costo elettrico della tua navigazione.

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
