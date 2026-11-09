# Indirizzi dei servizi AI: stato e verifica

Il conteggio dei messaggi (livello 3) riconosce una richiesta `POST` riuscita verso l'indirizzo del servizio. Gli indirizzi sono quelli usati dalle app web e **non sono documentati**: possono cambiare senza preavviso.

## Stato al 10 novembre 2026
Non è stato possibile provare i servizi veri (servono account e gli indirizzi non sono raggiungibili dall'ambiente di sviluppo). La ricerca nelle fonti pubbliche dà questo quadro; **nessuna voce è ancora `verified`**.

| Servizio | Regola (`data/ai_adapters.json`) | Stato | Evidenza |
|---|---|---|---|
| ChatGPT | `POST chatgpt.com/backend-api/conversation` (anche `/f/conversation`) | `reported` | `/backend-api/conversation` è descritto da documentazione della comunità e da un'analisi del traffico (Keysight, 2023). La variante `/f/conversation` non ha conferme |
| Perplexity | `POST perplexity.ai/rest/sse/perplexity_ask` | `reported` | Usato da due progetti non ufficiali (risposta a flusso di eventi) |
| Claude | `POST claude.ai/api/organizations/{id}/chat_conversations/{id}/completion` | `unconfirmed` | Le fonti trovate descrivono solo creazione e lettura delle conversazioni |
| Gemini | `POST gemini.google.com/.../StreamGenerate` | `unconfirmed` | Nessuna fonte recente |
| DeepSeek | `POST chat.deepseek.com/api/v0/chat/completion` | `unconfirmed` | Nessuna fonte; l'API ufficiale è su un altro dominio |

## Come verificare con il proprio browser (un minuto)
1. Impostazioni → Privacy e dati → *Uso dell'AI*.
2. Attiva il servizio e premi **Verifica**: per 60 secondi l'estensione elenca le richieste di invio verso quel solo dominio (metodo, indirizzo senza parametri con gli identificativi nascosti, stato).
3. Nel servizio invia un messaggio. Nella tabella compare la richiesta; la spunta ✓ indica che la regola attuale la riconosce.
4. Controlla anche il contatore **Oggi: N** accanto al servizio: dopo l'invio deve salire.
5. Se la richiesta compare ma senza spunta, premi **Copia il rapporto** e apri una segnalazione con il testo: basta per correggere la regola.

La verifica è in memoria e dura un minuto; non si legge alcun contenuto e non si salva nulla.

## Per chi mantiene i dati
- Quando una regola è confermata con traffico reale, cambia `status` in `verified` e aggiungi data e browser nelle `evidence`.
- Se un servizio cambia indirizzo il conteggio resta a zero e il motore torna all'ipotesi dei messaggi all'ora (non c'è un falso zero).
- Prova con un servizio simulato: `node scripts/e2e-ai.cjs <cartella-profilo>`.
- Verifica periodica consigliata insieme all'aggiornamento trimestrale dei dati.
