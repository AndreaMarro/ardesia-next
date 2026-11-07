# Scrittura immersiva: riuso verificabile e decisioni

Indagine read-only conclusa l'8novembre2026 e applicata al Board esistente. Il dossier completo, snapshot delle fonti e rapporti REA originali sono conservati nella consegna locale. [Provenienza e SHA256 delle fonti](immersive-writing-source-provenance.json), [identità e statistiche REA](immersive-writing-rea-summary.json). Gli URL upstream sono branch mobili: i byte analizzati sono quelli identificati dai digest, non future revisioni di quei branch.

## Decisioni applicate

1. **Overlay senza spostare il contenuto.** Excalidraw LayerUI/azione Zen separano canvas e controlli e nascondono il chrome con opacity/visibility. Ardesia adotta il principio nel proprio Board: dimensione fissa durante il gesto, camera preservata, controlli contestuali compatti, focus e inert. Nessun editor esterno o frammento proprietario copiato; nessun ritardo volontario al recupero dei controlli.
2. **Immersione CSS, audio montato, misure reali.** Il vecchio shell riservava116px verticali prima degli overlay: altezze960/768 davano al massimo87,92/84,90%. Il nuovo canvas occupa il viewport e misura l'area netta sottraendo i controlli. AudioSession rimane montato sotto il chrome nascosto. `useViewportHeight` di tldraw è deprecato: scartata la riduzione del viewport a height+offsetTop; il test usa VisualViewport completo e il layout100dvh/safe-area. Fullscreen non è un prerequisito. Offset reali, tastiera virtuale e Safari restano non verificati.
3. **Pagine persistenti distinte dalla camera.** TLPage/TLCamera del pacchetto MIT tlschema separano dati documentali e sessione. Questo orienta il prossimo verticale quaderni/sezioni/pagine nel Core canonico. Non si presenta l'attuale sfondo Taccuino come completamento di quel requisito e non si introduce un secondo store per simularlo.

## Fonti e licenze lette

- [Excalidraw LayerUI](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LayerUI.scss), [azione Zen](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/actions/actionToggleZenMode.tsx): MIT, copyright2020Excalidraw. Pattern di overlay/visibilità adottati; nessun trapianto di codice.
- [tldraw UI](https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/TldrawUi.tsx) e [licenza](https://github.com/tldraw/tldraw/blob/main/LICENSE.md): licenza personalizzata, produzione richiede accordo/trial applicabile. Solo riferimento di comportamento; nessuna integrazione del loro editor presumendolo MIT.
- [tlschema TLPage](https://github.com/tldraw/tldraw/blob/main/packages/tlschema/src/records/TLPage.ts), [TLCamera](https://github.com/tldraw/tldraw/blob/main/packages/tlschema/src/records/TLCamera.ts) e [licenza del package](https://github.com/tldraw/tldraw/blob/main/packages/tlschema/LICENSE.md): MIT2024tldraw. Questa licenza non si estende ai package editor/UI.
- [VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport), [Fullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen), [inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert), [safe-area/CSS env](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env): contratti API consultati, non attestazioni di dispositivo reale.

## REA eseguito

CLI6.8.0 con Node24, `analyze-javascript-application`, selezioni esplicite, max-semantic-nodes1200, max-semantic-unknowns100, timeout45000ms. Excalidraw:2file/2806nodi AST; tldraw:5file/1727nodi; snapshot App/StudioChrome:2file/4433nodi, altri5inventariati esclusi. Zero parse failure/contraddizioni riportate. Gli evidence ID e SHA256 dei tre report sono nel JSON allegato. CSS e licenze letti direttamente; nessun codice esterno eseguito. Grafi incompleti, dipendenze esterne sconosciute: non sono prove di prestazioni o sicurezza runtime.

Il dossier read-only ha SHA256 `0821b4abb2cf84508f7a3947d88b96d78cc9d8b5c4cb95590e93c0f844d17278`. Il codice successivo e le prove browser hanno identità distinte, descritte nell'[handoff](../handoffs/core-continuity-2026-11-07.md). Le misure Chromium Mac/iPad simulati superano90% negli stati provati; nessuna attribuzione a Pencil, Safari o latenza fisica.
