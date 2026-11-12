# Greenweb

Estensione browser gratuita e open source che **stima** l'impatto ambientale della navigazione: energia, CO₂e, acqua e costo elettrico equivalente. Tutto in locale: nessun account, nessun server, nessuna telemetria.

> Stime, non misure: il browser non vede i consumi dei server, quindi ogni valore è un intervallo documentato con un livello di affidabilità. La pagina **Metodologia** dell'estensione spiega formule, coefficienti e fonti.

- **Privacy**: si conservano solo dominio, richieste, byte e tempo attivo, sul tuo dispositivo. Mai URL completi, contenuti, prompt, cookie o password. Puoi cancellare tutto dalle Impostazioni.
- **Installazione (sviluppo)**: Chrome/Edge/Brave → `chrome://extensions` → modalità sviluppatore → *Carica estensione non pacchettizzata*. Firefox 121+ → `about:debugging` → *Carica componente aggiuntivo temporaneo* → `manifest.json`.
- **Comandi**: `npm test`, `npm run lint`, `npm run package`.
- **Contribuire**: nuove lingue (un file in `locales/`), domini (`data/catalog.json`), coefficienti con fonte (`data/coefficients.json`).
- **Licenza**: MIT © Michele Aldeni. Mantieni la nota di copyright nelle copie; una citazione è gradita (`CITATION.cff`).
