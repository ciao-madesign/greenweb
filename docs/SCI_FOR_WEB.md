# Allineamento con Software Carbon Intensity for the Web

Stato dello standard (dal post della Green Web Foundation del 22 ottobre 2026): in consultazione pubblica, verso l'ISO nel 2027. **Lo schema dei dati non è ancora pubblicato**: qui si allinea il metodo nello spirito dello standard, senza dichiararne la conformità.

## Corrispondenza dei sei riquadri
| Riquadro SCI for Web | Nel progetto | Stato |
|---|---|---|
| Client, operativo | Dispositivo: ore attive × potenza per tipo | Stimato (ipotesi per tipo, da calibrare: `docs/CALIBRAZIONE.md`) |
| Client, incorporato | — | Non incluso |
| Rete, operativo | Byte × 0,059 kWh/GB (SWD v4, allocazione) | Stimato |
| Rete, incorporato | — | Non incluso |
| Server, operativo | Data center: byte × 0,055 kWh/GB; streaming e AI a tempo/messaggi | Stimato |
| Server, incorporato | — | Non incluso |
| Sviluppo (facoltativo) | Non applicabile | — |

## Caratteristiche dello standard
| Caratteristica | Nel progetto |
|---|---|
| Unità funzionale esplicita | **Dominio-giorno** (un sito in un giorno di navigazione su questo dispositivo); in dashboard anche oggi, 7 e 30 giorni. Dichiarata nella pagina Metodologia e nel rapporto (`functional_unit`) |
| Compatibilità con SCI (ISO 21031:2024), solo intensità basata sul luogo | Ember, basata sulla generazione del territorio |
| Modello dati leggibile da macchina, con provenienza e livello di dettaglio | Rapporto JSON (`greenweb-report.json`): ogni coefficiente con valore, unità, stato, affidabilità, fonti e metodo; profilo regionale con riferimento; versioni del modello e dei coefficienti |
| Cifre per componente | Dispositivo, rete e data center separati, con intervalli min–max, in ogni riga del rapporto |
| Emissioni incorporate | Dichiarate **escluse**, non trascurabili |

## Cosa è stato fatto
- **Rapporto delle stime** (Impostazioni → Privacy e dati → *Esporta il rapporto delle stime*): CSV piatto e JSON con la provenienza. Codice in `src/report.js`, con test.
- **Unità di misura** dichiarata nella Metodologia.
- **Fonti** CO2.js, SWD e SCI for Web citate nei coefficienti e nella Metodologia.

## Cosa manca e perché
- **Emissioni incorporate** (riquadri incorporati): per ora esistono solo coefficienti SWD proporzionali ai byte (0,012 data center, 0,013 rete, 0,081 dispositivo kWh/GB), proprio il tipo di proxy criticato dalla Green Web Foundation per il client. Servirebbe un'allocazione per ore d'uso e vita utile del dispositivo, con fonti. Resta una possibile opzione facoltativa, spenta di serie.
- **Schema ufficiale**: quando verrà pubblicato si adatterà il rapporto (nomi dei campi, livelli di dettaglio) senza cambiare il calcolo.
- **Verifica per l'ISO**: nessuna pretesa di conformità finché lo standard non è definitivo.
