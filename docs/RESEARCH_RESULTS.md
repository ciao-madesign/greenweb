# Risultati della ricerca (9 novembre 2026) e cosa abbiamo adottato

La ricerca è stata fornita dal proprietario del progetto e **non è stata riverificata** da noi sulle fonti primarie. Gli stati dei valori nei file `data/` riflettono le sue etichette (`sourced`, `to_verify`).

## Cosa è cambiato nel modello
| Tema | Prima | Ora |
|---|---|---|
| Rete + data center | 0,114 kWh/GB, intervallo ×0,5/×2 | Due coefficienti separati: rete 0,059 (0,030–0,100) e data center 0,055 (0,030–0,100), dichiarati come **allocazione**, non come misura (Mytton et al. 2024) |
| Dispositivo | 20 W unico | **Per tipo**, scelto dall'utente nelle Impostazioni: portatile 12 W (5–25), portatile Apple 7 W (3–15), desktop+monitor 45 W (20–100), tablet 5 W, telefono 2,5 W. Predefinito: portatile. Non si deducono i watt dallo user agent |
| Streaming | 0,077 kWh/h | Riferimento **0,10 kWh/h** (media realistica 0,077–0,08 arrotondata per eccesso), ×1,5 se la velocità dei dati indica 4K (oltre 4 GB/h); quota di data center 48% per l'acqua. Gli intervalli per risoluzione della ricerca non sono usati: includono il dispositivo |
| AI testuale | 0,24 Wh, 10 prompt/h | **0,30 Wh** (0,10–1,00), 30 prompt/h (10–60, ipotesi) |
| AI immagini | 2,9 Wh (fonte secondaria) | **Non stimata** (come il video): conta solo dispositivo e rete, con asterisco |
| Acqua | 4 L/kWh sull'energia totale | **Sul sito** (data center, 0,30 L/kWh) + **nella produzione dell'elettricità** (4,52 L/kWh, valore USA usato come sostituto per tutte le regioni). Consumo, mai prelievo |
| Intensità carbonica | IT 331, US 369, CN 562, JP 426 | IT 284, US 384, CN 528, JP 477 (estrazione provvisoria Ember 2025, con intervalli). UE e mondo invariati |
| Prezzi | IT 0,32; JP 35,9 | IT 0,311 (0,29–0,34), JP 32,80 (30–35, FEPC), US 0,1648. Cina e mondo invariati |
| Equivalenze | auto 106,4; LED 10 W; lavatrice 1 kWh | auto 106,7 g/km (auto nuove UE 2024), LED 9 W (DOE), lavatrice 0,55 kWh (da verificare) |
| Soglie del semaforo | 150 / 400 Wh al giorno | 100 / 300 Wh al giorno (8 ore di portatile ≈ 96 Wh) |

CO₂e e costo ora propagano gli intervalli dei profili (i valori inseriti a mano dall'utente li sostituiscono).

## Non adottato (dati insufficienti)
- Energia per immagine e per secondo di video generato.
- Acqua per kWh specifica di UE, Italia, Cina, Giappone, mondo.
- Intensità carbonica 2025 di UE e mondo; prezzo UE 2024 medio ponderato (resta il valore Eurostat H2 2024), prezzo cinese per provincia.
- Emissioni per km delle auto in uso (UE e USA): l'equivalenza usa le auto nuove e quindi sovrastima leggermente i chilometri.
- Quota di tempo di navigazione per tipo di dispositivo.
- Carbonio incorporato (dispositivi, rete): escluso dal contatore, ma **non** dichiarato trascurabile.

## Conflitti tra fonti e scelte
Rete e data center: 0,059 / 0,055 per compatibilità con SWD v4. AI testuale: 0,24 (Google) / 0,30 (Epoch) / 0,34 (OpenAI) → 0,30. Acqua del data center: 0,36 (LBNL) / 0,30 (Microsoft) → 0,30. Acqua della rete elettrica: 4,52 (consumo), mai 47,45 (prelievo). Italia: 281 / 288 g/kWh → da ricalcolare da un'unica release del dataset.

## Da fare (in ordine)
1. Ricalcolare da un'unica release Ember: IT, UE27, USA, Cina, Giappone, mondo (2024 e 2025).
2. Acqua per kWh per paese; misure reali del consumo del dispositivo (Apple Silicon e x86).
3. AI: valori per fornitore (Claude, Mistral, Llama), immagini e video; ritmi d'uso reali.
4. Equivalenze: auto in uso, lavatrice, doccia, bollitore, ricarica dello smartphone.
5. Metadati per ogni voce (versione del metodo, tipo di misura, validità, ultima verifica, ipotesi): consigliati dalla ricerca, ancora da introdurre.
6. Revisione trimestrale delle fonti.

## Dati d'uso utili per le versioni future
Peso mediano di una pagina (HTTP Archive 2024): desktop 2.652 KB, mobile 2.311 KB. Video Netflix: SD 1 GB/h, HD 3 GB/h, 4K 7 GB/h. Videochiamata: da 0,27 a 1,7 GB/h per direzione secondo la risoluzione.
