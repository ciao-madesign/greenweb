# Impatto dell'estensione stessa

Obiettivo: il monitoraggio deve consumare molto meno di ciò che misura.

## Scelte di progetto che riducono il lavoro
- Nessun content script, nessuna rete, nessun polling: un solo allarme al minuto.
- I campioni si accumulano in memoria e si scrivono ogni ~20 s, non a ogni richiesta.
- Un record di storage per giorno (`day:AAAA-MM-GG`): ogni salvataggio legge e scrive solo il giorno corrente (pochi KB), non tutto lo storico.
- Si conservano 90 giorni; la dashboard ne usa al massimo 30.
- Catalogo e coefficienti sono JSON locali caricati una volta per avvio del worker.

## Misura (Chromium headless su Linux, singola esecuzione)
Script: `node scripts/measure-impact.cjs <cartella-profilo>` (richiede Playwright). Legge i tempi CPU del processo dell'estensione da `/proc`.

| Scenario | Risultato |
|---|---|
| A riposo, 30 s | 0,01 s di CPU (~1 s/ora) |
| 20 richieste/s per 60 s (1200 richieste) | 0,70 s di CPU, cioè ~0,58 ms per richiesta |
| Storage dopo la prova (1 dominio) | 162 byte |
| Storage, caso peggiore stimato (150 domini × 90 giorni × ~60 B) | ~0,8 MB |

## Stima energetica
Navigazione intensa: 5.000–20.000 richieste/ora → 3–12 s di CPU/ora, più ~1 s/ora a riposo.
Con 10–25 W per secondo di CPU attiva (ipotesi): **0,01–0,09 Wh all'ora**.
Il dispositivo, nello stesso intervallo di tempo, è stimato a 20 Wh/ora (valore centrale): l'estensione pesa **circa 0,05–0,5 %** di ciò che misura.

## Limiti della misura
- Una sola esecuzione, in un ambiente condiviso e senza interfaccia: va ripetuta su hardware reale (laptop con batteria).
- La memoria residente (~105–114 MB) comprende il runtime del browser per l'estensione: non è tutta attribuibile al nostro codice.
- Firefox non è stato misurato.
- Il costo per richiesta è dominato dal recapito degli eventi `webRequest` (intestazioni di risposta), non dal nostro calcolo.
