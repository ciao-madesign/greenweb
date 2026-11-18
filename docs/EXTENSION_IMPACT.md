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
| A riposo, 30 s | 0,01–0,02 s di CPU (~1–2 s/ora) |
| 20 richieste/s per 60 s (1200 richieste) | 0,70–0,83 s di CPU, cioè ~0,6–0,7 ms per richiesta (due esecuzioni, dopo i controlli di privacy) |
| Storage dopo la prova (1 dominio) | 162 byte |
| Storage, caso peggiore stimato (150 domini × 90 giorni × ~60 B) | ~0,8 MB |

## Stima energetica
Navigazione intensa: 5.000–20.000 richieste/ora → 3–14 s di CPU/ora, più ~1–2 s/ora a riposo.
Con 10–25 W per secondo di CPU attiva (ipotesi): **0,01–0,1 Wh all'ora**.
Il dispositivo, nello stesso intervallo di tempo, è stimato a 12 Wh/ora (portatile, valore centrale): l'estensione pesa **circa 0,1–1 %** di ciò che misura.

## Limiti della misura
- Una sola esecuzione, in un ambiente condiviso e senza interfaccia: va ripetuta su hardware reale (laptop con batteria).
- La memoria residente (~105–146 MB) comprende il runtime del browser per l'estensione: non è tutta attribuibile al nostro codice.
- Firefox non è stato misurato.
- Il costo per richiesta è dominato dal recapito degli eventi `webRequest` (intestazioni di risposta), non dal nostro calcolo.

## Nota (11 novembre 2026)
Ogni minuto, al salvataggio, si scrive anche un piccolo stato (dominio della scheda attiva e orario) in `storage.session`, memoria temporanea del browser: serve a non perdere il tempo quando il browser sospende il service worker. Costo trascurabile. Le misure sopra sono precedenti a questa modifica.

## Destination Control (12 novembre 2026, Chromium headless, preliminare)
Stessa prova di carico (1.200 richieste in 60 s), modulo spento e acceso. Il modulo registra solo dominio e IP in memoria; il dataset delle reti non viene caricato dal service worker (solo da dashboard e impostazioni).

| | Modulo spento | Modulo acceso |
|---|---|---|
| CPU a riposo (30 s) | 0,010 s | 0,030 s |
| CPU sotto carico (60 s) | 0,87 s | 0,96 s |
| Memoria | 147 MB | 149 MB |

Differenza sotto carico: circa +0,09 s ogni 1.200 richieste (+10%, entro il rumore della misura). Non verificato su hardware reale né su Firefox.
