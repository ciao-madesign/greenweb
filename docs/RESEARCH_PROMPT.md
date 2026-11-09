# Prompt per la ricerca di stime e equivalenze

Da incollare in uno strumento di ricerca approfondita (con accesso al web). Restituisci i risultati: li inseriamo in `data/coefficients.json` e `data/equivalences.json`.

```text
You are a research assistant for an open-source browser extension that ESTIMATES the environmental footprint of web browsing (energy, CO2e, water, electricity cost), fully on the user's device. I need concrete, citable numbers from 2023-2026, preferring primary sources (papers, agency datasets, company sustainability/LCA reports). Never invent numbers: write "not found" when a value is unavailable, and flag disagreement between sources.

For EVERY item return: value (min / central / max), unit, year of the data, geography, scope (what is included and excluded), method (measured or modelled), source (title, publisher, URL), confidence (high/medium/low) and caveats.

A. DATA TRANSFER ENERGY (kWh per GB): network (fixed, mobile) and data centers separately. Compare Sustainable Web Design v4, IEA, Malmodin, Coroama, Mytton et al. 2024. Explain the criticism of the kWh/GB model and suggest a defensible range.
B. USER DEVICE POWER while browsing (watts): laptop (Apple Silicon and x86), desktop + monitor, smartphone, tablet. Typical share of each device type.
C. VIDEO STREAMING: energy per hour by resolution (SD/HD/4K) and device; network and data-center share. Sources such as IEA 2020 (Kamiya), Netflix, Carbon Trust.
D. GENERATIVE AI: energy per text prompt (ChatGPT/GPT-4o and newer, Claude, Gemini, Llama, Mistral), per image generated (Stable Diffusion, DALL-E, Midjourney), per second of generated video. Include Google 2025 (Gemini), Mistral LCA 2025, Epoch AI, Luccioni et al., OpenAI statements. Also: typical prompts per hour of chat use and images per hour of image-tool use.
E. WATER: on-site cooling (WUE) and off-site water per kWh of electricity, for US, EU, Italy, China, Japan, world. Distinguish consumption from withdrawal. Sources such as LBNL, Ren et al., Google/Microsoft reports, IEA.
F. GRID CARBON INTENSITY (gCO2e/kWh), latest full year (2024, 2025 if available): Italy, EU27, USA, China, Japan, world. Sources: Ember, IEA, EEA, national operators. State generation-based vs consumption-based and direct vs lifecycle. If available, the shape of the hourly/seasonal profile for Italy and the EU.
G. HOUSEHOLD ELECTRICITY PRICE, latest full year, with currency, taxes included or not: Italy, EU27 average, USA, China (CNY, tiered), Japan (JPY). Sources: Eurostat nrg_pc_204, EIA, NDRC/NEA, METI/ANRE, ARERA.
H. EVERYDAY EQUIVALENCES with sources: average in-use passenger car gCO2/km (EU fleet, US fleet) and new cars; typical LED bulb power; energy of one washing-machine cycle; one hot shower (litres and kWh); boiling a kettle; charging a smartphone; one km by train/bus; and the EPA greenhouse-gas equivalencies method. Suggest the 5 most intuitive equivalences for CO2e, water, energy and cost.
I. TYPICAL DATA VOLUMES: median page weight (HTTP Archive), social scrolling MB/hour, music and video MB/hour by resolution, video-call MB/hour.
J. SCOPE: how much of the footprint is usually embodied (devices, network equipment) versus operational, and whether to exclude it.

OUTPUT FORMAT
1. One table per section A-J, JSON-ready columns: id, value_min, value_mid, value_max, unit, year, region, source_url, status (sourced | to_verify), notes. Use these ids where they apply: device_power_w, network_dc_kwh_per_gb, streaming_kwh_per_hour, ai_text_wh_per_prompt, ai_text_prompts_per_hour, ai_image_wh_per_image, ai_image_images_per_hour, ai_video_wh_per_second, water_l_per_kwh, co2_g_per_kwh_{it,eu,us,cn,jp,world}, price_per_kwh_{it,eu,us,cn,jp,world}, car_g_per_km, led_w, washing_kwh.
2. A short list of conflicts between sources, with a recommended central value and why.
3. A list of items that still need verification against a primary source.
```

## Valori attuali da migliorare (priorità)
1. Intensità carbonica UE e Giappone (oggi valori del 2020) e prezzo di Cina, Giappone, mondo.
2. Acqua per kWh (oggi intervallo ampio da fonti secondarie).
3. AI: energia per prompt/immagine/secondo di video e ritmo d'uso (oggi ipotesi).
4. Potenza del dispositivo (oggi 9–50 W, ipotesi).
5. Equivalenze: auto in uso (oggi auto nuove EU), lavatrice, lampadina.
