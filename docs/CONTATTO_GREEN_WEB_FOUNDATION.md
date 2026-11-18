# Bozza di messaggio alla Green Web Foundation

Da inviare dal modulo di contatto del loro sito (https://www.thegreenwebfoundation.org/contact/). L'articolo invita chi sviluppa strumenti che mostrano emissioni a farsi sentire. **Il messaggio non è stato inviato.**

---

Oggetto: Digital Footprint Counter, estensione open source che usa le stesse basi di CO2.js e SWD

Ciao,

stiamo sviluppando Digital Footprint Counter, un'estensione per browser (MIT, nessun server, nessuna telemetria) che stima energia, CO₂e, acqua e costo della navigazione di una persona, sul suo dispositivo.

Usa gli stessi fattori di rete e data center di SWD v4 (0,059 e 0,055 kWh/GB, dichiarati come allocazione), con l'energia del dispositivo calcolata dal tempo attivo (non dai byte), e i dati annuali di Ember inclusi nel pacchetto, senza richieste di rete. Ogni valore ha fonte, stato e intervallo, e l'esportazione ha la provenienza e le versioni.

Il nostro punto più debole è la potenza del dispositivo, oggi un'ipotesi per tipo (9–13 W sul portatile). Stiamo preparando una calibrazione con Firefox Profiler / EnergiBridge e ci piacerebbe confrontarci su: (1) come riportate la potenza lorda e netta, (2) se esistono misure di riferimento per la riproduzione video, (3) lo stato dello schema dati di SCI for Web, per allineare l'esportazione.

Codice e documentazione: https://github.com/ciao-madesign/greenweb (confronto con il vostro lavoro in docs/CONFRONTO_GREEN_WEB_FOUNDATION.md).

Grazie,
[nome]
