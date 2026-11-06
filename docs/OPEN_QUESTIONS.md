# Punti aperti

## AI
- Il browser non vede i prompt: i coefficienti AI usano un ritmo d'uso assunto per ora attiva (prompt/h, immagini/h). Da sostituire con adattatori per servizio dove possibile.
- Mancano coefficienti per modello e per tipo di operazione.
- Distinguere "chat aperta" da "generazione effettiva".
- **AI video**: nessun coefficiente remoto affidabile raccolto; la stima è marcata incompleta.

## Valori da verificare sul dato primario (status `to_verify`)
- Intensità carbonica UE (valore 2020 "Europa") e Giappone (2020): aggiornare con Ember/IEA.
- Prezzi elettrici Cina (CNY, stima) e Giappone (senza anno) e media mondiale.
- Acqua: fattori diretto/indiretto da fonti secondarie (LBNL 2016); raffinare per paese.
- Immagini AI: valori Luccioni da fonti secondarie.
- Streaming (IEA ~0,08 kWh/h): possibile lieve doppio conteggio con il dispositivo.

## Modello
- Potenza del dispositivo (9-50 W): ipotesi; renderla configurabile (laptop/desktop).
- Intervalli x0,5 / x2 su rete e data center: ipotesi dichiarata.
- Byte non esposti (assenza di Content-Length): oggi contano come 0 e abbassano l'affidabilità.

## Traduzioni
- Cinese e giapponese: revisione da madrelingua.
