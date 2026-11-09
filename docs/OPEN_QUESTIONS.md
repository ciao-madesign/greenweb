# Punti aperti

Aggiornato con i risultati della ricerca del 9 novembre 2026: vedi `docs/RESEARCH_RESULTS.md` (cosa è stato adottato, cosa manca, priorità).

## AI
- Il browser non vede i prompt: i coefficienti AI usano un ritmo d'uso assunto per ora attiva (prompt/h, immagini/h). Da sostituire con adattatori per servizio dove possibile.
- Mancano coefficienti per modello e per tipo di operazione.
- Distinguere "chat aperta" da "generazione effettiva".
- **AI immagini e video**: nessun coefficiente remoto affidabile; la stima conta solo dispositivo e rete ed è marcata incompleta.

## Valori da verificare sul dato primario (status `to_verify`)
- Intensità carbonica UE (valore 2020 "Europa") e Giappone (2020): aggiornare con Ember/IEA.
- Prezzi elettrici: Cina (media nazionale 2021, le province fissano le fasce), Giappone (senza anno) e media mondiale. Alternative trovate ma senza anno: UE ~194 e Giappone ~438 gCO₂e/kWh (lowcarbonpower.org).
- Acqua: fattori diretto/indiretto da fonti secondarie (LBNL 2016); raffinare per paese.
- Immagini AI: valori Luccioni da fonti secondarie.
- Streaming (IEA ~0,08 kWh/h): possibile lieve doppio conteggio con il dispositivo.

## Modello
- Potenza del dispositivo (9-50 W): ipotesi; renderla configurabile (laptop/desktop).
- Intervalli x0,5 / x2 su rete e data center: ipotesi dichiarata.
- Byte non esposti (assenza di Content-Length): oggi contano come 0 e abbassano l'affidabilità.

## Traduzioni
- Cinese e giapponese: revisione da madrelingua.

## Test e distribuzione
- **Firefox**: `web-ext lint` passa (0 errori; avviso atteso sulla chiave `service_worker`, ignorata da Firefox). Non provato in un Firefox reale: verificare `webRequest`, `idle` e il permesso sui siti all'installazione.
- Misurare l'impatto su hardware reale e su Firefox (vedi `docs/EXTENSION_IMPACT.md`).
- Quando le richieste arrivano prima dell'avvio del service worker (es. avvio a freddo del browser) possono non essere contate: effetto minimo, da quantificare.
- Il tempo accumulato si salva al più ogni minuto: un worker terminato dal browser può perdere gli ultimi secondi.
- Traduzioni complete di cinese e giapponese, revisione madrelingua.
