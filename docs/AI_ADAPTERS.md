# Indirizzi dei servizi AI: stato e verifica

Il conteggio dei messaggi (livello 3) riconosce una richiesta `POST` riuscita verso l'indirizzo del servizio. Gli indirizzi sono quelli usati dalle app web e **non sono documentati**: possono cambiare senza preavviso.

## Stato all'11 novembre 2026
I servizi veri non sono raggiungibili dall'ambiente di sviluppo (servono account), quindi la conferma arriva dai rapporti di traffico reale del proprietario del progetto. **ChatGPT è `verified`**; per le altre voci restano le fonti pubbliche.

| Servizio | Regola (`data/ai_adapters.json`) | Stato | Evidenza |
|---|---|---|---|
| ChatGPT | `POST chatgpt.com/backend-api/conversation` (anche `/f/conversation`) | **`verified`** (11/11/2026) | Rapporto reale: un messaggio = una sola richiesta `POST /backend-api/f/conversation` (200), riconosciuta dalla regola. Le richieste attorno (`/f/conversation/prepare` ×3, `sentinel/chat-requirements`, `bazaar`, telemetria `ces`, `ab.chatgpt.com`) non vengono contate, come previsto |
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

## Rapporti ricevuti
**ChatGPT, 11 novembre 2026** (un messaggio inviato): 10 tipi di richiesta `POST`; solo `chatgpt.com/backend-api/f/conversation` (1×, 200) è contata (✓ chatgpt). Il test `matchAdapter: rapporto reale di ChatGPT` in `tests/core.test.js` conserva queste richieste come riferimento.
