# Studio, Creator e REA — fonti del 7 novembre 2026

## Richiesta e contesto

Il titolare chiede direttamente «estetica migliore», «UI E UX MIGLIORI», uso concreto e approfondito di REA e plugin inventabili in nuove forme, seguendo il programma. La precedente richiesta «Analizza anche le chat» è già documentata con copertura/limiti in [spatial-board-2026-11-07](spatial-board-2026-11-07.md): sette conversazioni, senza assumere che gli estratti siano lo storico completo. Non viene dichiarata una nuova lettura integrale delle chat per questo incremento.

- `ARDESIA_programma_generale_2026.md`, versione6novembre, letto integralmente: SHA-256 `2de0ad702c65eccb43cc9b156fc9cc44fcc45902cf934d8873d34d2404fcbb9f`.
- Allegato `Testo incollato.txt` della richiesta, SHA-256 `2cc56c4c16b1354f021a548f31c3d7d04b86a45baaed7b8ae8c4acea7c4e8304`: contiene frasi del titolare e proposte/elaborazioni di assistenti. Non si attribuiscono indistintamente tutte le formulazioni al titolare.
- La richiesta attuale adotta il programma come direzione di prodotto. I link a Google, Apple, MCP Apps, WebMCP, A2UI e standard educativi restano fonti da valutare, non integrazioni verificate o nuovi permessi.
- `AndreaMarro/ardesia-next` base `f7adf5db02913e25fbab0b1da071f650b4f78676`; legacy `AndreaMarro/ardesia` al commit `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`, consultato in sola lettura. La preparazione resta sul branch locale `codex/lavagna-continuity-20261107`.

Il programma conserva Mac/iPad/web, corsi di ogni disciplina, studio autonomo, tutor/economia, community e marketplace. MCP è una capacità di accesso autorizzato, non il centro tecnico obbligatorio della scrittura. La scelta concreta di mantenere ora Core/Host/Remote Client è una decisione implementativa rivedibile, giustificata da persistenza/diritti già funzionanti; non un vincolo richiesto dal titolare. Le nuove capacità riusano questi contratti e allargano il modello dei tipi.

## Domande REA e trasferimenti

REA6.8.0 è stato usato via CLI Node24.22.1. Browser osservato Chromium156.0.8078.80. Pacchetti scaricati dal registro pubblico con versione e SHA-512 controllati; niente accesso privato, bypass o esecuzione di bundle donor nell'app. Evidenze grezze, richieste senza segreti, screenshot, notices e sintesi sono nel pacchetto `outputs/rea-evidence/redesign/` esterno al checkout.

| Domanda concreta | Artefatto / osservazione | Decisione nell'app |
| --- | --- | --- |
| Come separare azioni della scena, strumenti e proprietà senza riempire la lavagna? | Excalidraw pubblico: Draw→Selection→Sticky→canvas→Escape→Undo→Redo→Library, snapshot DOM/AX/eventi e screenshot. Record `ev_7b6f3d3e93358a3a583d65d773f51b949f7f659b9c8e886c8d435c7cda7b97f5`. | ADAPT: rail/dock, proprietà contestuali, contesto educativo persistente. UI originale, non replica del donor. |
| Da quali stati dipende l'apparizione delle azioni? | `@excalidraw/excalidraw@0.18.1`, MIT, parent `ev_a371b497353eb559ee4b19b3ca4e25c2276caffa0cff8afbc942d088b14d8101`. Slice derivata delle sole linee24584–24586, record `ev_b86a1ea5ed02b696bce4107340f36f049ac90bdbadbf612d9a663951f4ab3a7c`, 40nodi/47relazioni. Legge viewModeEnabled, openDialog.name, activeTool.type, editingTextElement e selectedElements.length. | ADAPT del principio di visibilità contestuale; nessuna copia della funzione o di codice nel prodotto. |
| Come distinguere nuovo tipo, istanza e storia? | `@tldraw/editor@5.6.0`, ShapeUtil/HistoryManager/BindingUtil, record `ev_e3dca26af841e019f3eb107d705e54cd3cff606de4f9a9706aafdb0e659b5568`. Licenza custom tldraw. | ADAPT concettuale: typeId/definitionVersion distinti da objectId/revision/stato; implementazione originale nel Core esistente. DEFER adozione SDK/codice tldraw. |
| La nuova creazione arriva davvero alla lezione e sopravvive al reload? | Ardesia preview locale,22azioni, record `ev_d89dd4ba6072a44b8b47c0fe6f44925b341d6f5addf400001244ec2b3a9adb36`: nuova lezione, Creator, lunghezza2, salvataggio, nuova versione e riapertura. | REUSE della prova comportamentale nel perimetro osservato, affiancata da test Core/MCP/browser legati alla sorgente. |

## Limiti delle analisi

La build pubblica Excalidraw osservata è `2026-11-04T19:55:10Z-3c916c5`, diversa dal package0.18.1: non viene affermata equivalenza runtime/source. L'analisi intera del package raggiunge il cap4.000, con557file fuori scope. Le viste di riferimenti e la query dei chiamanti recuperano solo relazioni parziali; il risultato1nodo/0relazioni e492unknown non prova assenza di dipendenze. La slice focalizzata conserva origine/hash, non è il programma completo e non include gli helper esterni.

L'analisi tldraw è statica e circoscritta a3file; 988file fuori scope. La query di ownership1nodo/0relazioni è parziale. Non dimostra prestazioni, collaborazione, runtime effettivo o trasferibilità della licenza. Non è entrato codice tldraw in Ardesia.

Le catture browser registrano l'ordine di ricezione degli eventi, non causalità simultanea. I body di rete non sono richiesti; i segreti dichiarati sono oscurati. REA dichiara identità dell'artefatto runtime non disponibile: la build Ardesia viene associata con ricevuta esterna `build-info.json`, mantenendo esplicita questa distinzione. Gli errori iniziali di schema delle richieste sono conservati, non riscritti in successo. Le catture complete riportano il cleanup dei soli processi propri.

## Design e accettazione

Due concept originali1536×1024, lavagna e Creator, sono una direzione proposta dal coordinatore, non un'approvazione del titolare. Palette gesso/pino, titoli serif e controlli sans, superfici ariose, icone Lucide1.63.0 ISC già licenziate nel progetto. Il confronto visivo su desktop1536×1024 e viewport mobile412×915 mantiene differenze motivate per contenuti reali, revisioni, stati di salvataggio e controlli funzionanti.

Prove automatiche, REA e interazione manuale Mac sono riportate separatamente nel pacchetto. Un viewport mobile non è un iPad fisico; nessuna prova Apple Pencil, Safari, app nativa, efficacia didattica o compatibilità di ChatGPT/Claude/Gemini viene dedotta dalle immagini. [ADR0015](../adr/0015-open-creator-studio.md) specifica formato, migrazione, limiti e rollback.
