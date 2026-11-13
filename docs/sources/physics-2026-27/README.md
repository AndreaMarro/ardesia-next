# Cinque microcorsi di Fisica — fonti, copertura e limiti

> I conteggi storici sottostanti restano attribuiti alle rispettive consegne. Per lo stato cumulativo del 13 novembre (795 oggetti, 79 problemi originali, 19 tipi di laboratorio) leggere il [nuovo handoff](../../handoffs/2026-11-13-physics.md) e le [ricevute preservate](reviews-2026-11-13/README.md).

Il catalogo importa5corsi e38lezioni nel Core, con751oggetti ordinari e revisioni effettive. Il programma recuperato aveva4corsi: Fluidi/Termodinamica sono ora separati, mantenendo tutti i200sotto-obiettivi editoriali. I200codici non sono200obiettivi ufficiali MUR: dettagliano le sette unità del syllabus2026/2027.

| Corso | Syllabus | Lezioni | Sotto-obiettivi |
|---|---|---:|---:|
| Strumenti e meccanica | U1 + U2 | 9 | 52 |
| Fluidi | U3 | 5 | 26 |
| Termodinamica | U5 | 5 | 31 |
| Elettricità e magnetismo | U6 | 7 | 33 |
| Onde, ottica e radiazioni | U4 + U7 | 12 | 58 |

Ogni unità comprende spiegazione, esempio svolto, previsione, indagine guidata, feedback, recupero, trasferimento e fonti. La mappa lega ogni obiettivo alla lezione, alla pratica di famiglia e alla verifica puntuale.61obiettivi hanno laboratori digitali specifici; per gli altri non si inventa una simulazione equivalente.15tipi di laboratorio sono oggetti Creator modificabili e portabili, con domini e limiti espliciti. Le rappresentazioni3D sono proiezioni ortografiche, non un motore WebGL.

## Quesiti e ampliamento

-259quesiti unici recuperati, collocati290volte nelle lezioni pertinenti: selezione della banca4k, non nuovi quesiti.255core syllabus e4approfondimenti con legge fornita.
-200verifiche puntuali, una per sotto-obiettivo, con risposta/feedback;38nuove applicazioni di trasferimento nei campi dei corsi.
-38problemi aperti originali aggiuntivi, uno per famiglia:15medio/23difficile,140obiettivi collegati. Non sono i38transfer ricontati. Due approfondimenti quantitativi (capillarità e scambio termico) forniscono le leggi nel testo e non le spacciano per nuove formule obbligatorie.

Le soluzioni dei problemi originali ricostruiscono dati, segni, bilanci, inferenze e limiti. Il confronto copre4.000quesiti,259selezionati e76transfer (storici+nuovi): nessun prompt identico anche mascherando numeri. Somiglianza lessicale, leggi/task condivisi e casi strutturalmente vicini sono conservati nel rapporto; **unicità semantica non certificata**. I livelli sono stime editoriali, non calibrazione su studenti.

## Provenienza e verifiche

`source-registry.json` conserva le fonti realmente lette e distingue controlli attuali da osservazioni ereditate. `recovery-audit.md` è il rapporto congelato dello specialista: riferimenti a percorsi originali e i suoi NOT_RUN descrivono quel momento, non lo stato dell’integrazione. `expansion-audit.md` documenta i38problemi successivi. Il commit legacy è `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`, consultato in sola lettura. Le27shard/53.236.609byte della banca sono state verificate contro hash e conteggi ereditati; non sono distribuite integralmente nel runtime.

I manuali privati citati dal patrimonio non sono stati ritrovati nella ricerca circoscritta: non si afferma una lettura integrale nuova e non si riproducono loro pagine/esercizi. I fascicoli storici sono riferimenti analizzati, non una chiave ufficiale inventata. Le fonti MUR2026/2027 e le regole universitarie consultate sono nel registro. La concordanza byte-per-byte attuale fra PDF MUR e mirror non è stata ricertificata.

REA6.8 è stato usato sul modello fluidi legacy senza eseguirlo; evidence e hash sono in `rea-fluid-models.json`. Ha informato vincoli, unità e distinzione fra Q fissata e Δp fissata. Nessuna vecchia dipendenza o secondo motore è stato trapiantato.

Cinque video Khan sono collegamenti facoltativi, con attività prima/dopo e cautela pertinente. Il coordinatore ha poi verificato titolo/autore e avanzamento della riproduzione nel browser anonimo: `media-resources.json` supera il precedente NOT_RUN dello specialista **solo per disponibilità e avvio**. Visione audiovisiva integrale resta NOT_RUN; nessun video, audio o transcript è copiato. Lingua/doppiaggio dipendono dal lettore.

Le ricevute in `source-checks/` comprendono94controlli aritmetici dell’authoring iniziale,100ricalcoli su98quesiti selezionati,18casi editoriali protetti, schema/riferimenti e142controlli numerici sui38nuovi problemi. Due errori ereditati nella visualizzazione dei condensatori sono corretti con provenienza in `editorial-corrections.json`. Questi controlli non sostituiscono la revisione scientifica umana: tutti i contenuti rimangono DRAFT e humanApproval=false.

## Rigenerazione e integrità

Gli input editoriali congelati sono in `editorial/`; le dimensioni/digest dei cinque JSON distribuiti sono in `distributed-assets.json`. Il manifest originario conserva i propri hash; non viene fatto passare per impronta dei dati trasformati. `distributed-coverage.json` aggiunge le identità e revisioni reali delle lezioni e degli oggetti importati, inclusi problemi originali e laboratori. La stessa mappatura è leggibile nell’oggetto «Copertura degli obiettivi» di ogni lezione.

Dalla root con Node24 e dipendenze installate: `node tools/build-physics-pack.mjs`, poi `npx vitest run apps/web/src/courses/physics/physics.test.ts`. Il generatore non legge la rete, non scrive nel database e non applica approvazioni. Il test valida schema, provenienza, digest, definizioni e riferimenti della copertura. I JSON vengono richiesti soltanto quando l’utente importa il corso; raw/gzip sono riportati separatamente dai budget JS. L’import usa normali comandi Core e rifiuta contenuti già modificati.

Restano aperti revisione umana, calibrazione didattica, prove complete con studenti e confronto aggiornato coi manuali non disponibili. [Esperienza integrata e limiti tecnici](../../handoffs/core-continuity-2026-11-07.md).

## Aggiornamento 13 novembre 2026

La PR52 aveva portato il totale a752oggetti,39problemi originali e16tipi di laboratorio (i conteggi precedenti descrivono la consegna storica). La continuazione separa200domande e risposte anticipate dalle38spiegazioni: teoria ed esempi restano byte-identici; il confronto completo è nel feedback esplicito. Le verifiche restano disponibili negli stessi oggetti, senza aggiungere quesiti o affermare indipendenza semantica. Le nuove importazioni ricevono il contenuto corretto; i corsi già importati rimangono nella loro edizione, senza aggiornamento silenzioso. [Audit attuale](audit-2026-11-13.md).
