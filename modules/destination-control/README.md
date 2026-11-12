# Destination Control (V1.0: monitoraggio e identificazione)

Modulo di Greenweb che registra **quali destinazioni** ricevono le richieste del browser e, con un dataset locale,
le identifica (provider, rete, tipo, paese). **Spento di default**; si attiva in Impostazioni → Privacy e dati.
Nessun blocco nella V1.0 (Policy Engine: V1.1).

## Cosa fa
- `core/monitor.js`: per ogni richiesta completata registra dominio di destinazione e IP (`details.ip` di `webRequest`, quando il browser lo espone).
- `core/identity.js`: ricerca locale dell'IP in un dataset di reti (CIDR, prefisso più lungo, IPv4/IPv6).
- `core/classification.js`: campi con attendibilità separata (`verified` / `probable` / `unknown`) e fonte. Luogo fisico, elaborazione e conservazione dei dati restano **sconosciuti**: non si deducono da un IP. Il paese non supera mai `probable`.
- `core/audit.js`: registro locale `dest:<giorno>` (dominio, IP, contatori). Mai URL, parametri, cookie o contenuti. Segue la conservazione scelta, l'esclusione dei siti e "Elimina tutti i dati".
- `ui/dashboard.js`: pannello nella dashboard.

## Regole e simulazione (V1.1, parte non bloccante)
`core/policy.js` valuta le regole dell'utente sulle destinazioni già registrate e `ui/simulation.js` mostra l'esito nella dashboard: **nessuna richiesta viene bloccata**.
- Regole (Impostazioni, una per riga): `AZIONE tipo valore`, ad esempio `BLOCK provider Cloudflare` o `ALLOW domain example.com`. Azioni: BLOCK, PREFER, ALLOW, REVIEW. Tipi: domain, ip, cidr, asn, provider, country, region.
- Priorità: dominio, poi IP/intervallo, poi ASN/provider, poi paese/regione, poi il comportamento predefinito. Vince la più specifica; a parità, prefisso o dominio più lungo, poi la regola scritta per prima.
- PREFER non autorizza e non blocca. Le destinazioni non identificate seguono la scelta dell'utente (consenti per default: fail-open).
- La simulazione avvisa quando una regola su provider o paese colpisce un'infrastruttura condivisa (CDN, cloud) e quando decide su dati solo probabili o senza informazioni.
- Il dataset attuale non contiene ASN né paese: le regole `asn`, `country` e `region` non corrispondono a nulla finché non arrivano quei dati (V1.2).

## Dataset
`database/ranges.json` contiene le reti di Amazon Web Services (11.495), Google Cloud (1.153), Fastly (24) e Cloudflare (22), dagli elenchi ufficiali del 12 novembre 2026 (~2,3 MB). Google Cloud indica i soli intervalli dei clienti cloud, non tutta la rete di Google. Ciò che non è nel dataset risulta "sconosciuto": è il risultato corretto, non un errore.
Per generarlo da elenchi pubblici ufficiali già scaricati (nessuna rete nello script):

```bash
node scripts/build-destinations.mjs --aws ip-ranges.json --cloudflare-v4 ips-v4.txt --cloudflare-v6 ips-v6.txt --fastly public-ip-list.json --google cloud.json --date AAAA-MM-GG
```

Ogni dataset riporta fonte, data, licenza e attendibilità. Mancano ancora: registro ASN, geolocalizzazione, data center, dati ambientali (V1.2). Lo script non assegna l'ASN: gli elenchi dei provider non lo indicano.

## Limiti dichiarati
- Solo traffico HTTP/HTTPS del browser; altre applicazioni sono fuori controllo.
- L'IP può mancare (cache, alcuni canali): la richiesta resta contata come non identificabile.
- Un IP di CDN o cloud è condiviso da molti servizi: la classificazione del provider non descrive il sito.
- Non è stato provato su Firefox reale.
