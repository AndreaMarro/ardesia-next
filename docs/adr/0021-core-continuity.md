# ADR0021 — continuità della scrittura e patrimonio riutilizzabile

Stato: candidato locale del mandato diretto7novembre2026. Fonte, CI, distribuzione, hardware e accettazione restano fatti distinti. Nessuna variazione a cursore, scheduler o seconda autorità.

## Scrittura

Lavagna e taccuino condividono Board, identità e geometria. Un gesto conserva un ID, pressione e campioni; checkpoint locale ogni750ms, handoff su pagehide/visibility e gomma geometrica a tratto. Il dito naviga salvo opt-in. Non è un motore nativo PencilKit, non include lasso e non promette i campioni precedenti al primo checkpoint in caso di arresto improvviso.

Le copie interrotte sono limitate ad account/spazio/lezione. Un Web Lock dura per tutta la proprietà del gesto: una scheda sospesa non perde il lock per timeout. Il recupero tenta ifAvailable, rilegge sotto lock e cancella solo byte uguali a quelli consegnati. Conferma Core oppure comando immutabile già durevole permette di rimuovere il checkpoint prima di rilasciare il lock, anche dopo risposta HTTP persa. Logout/revoca non richiedono di riacquisire una factory autorizzata per il cleanup. Senza Web Locks l’export resta disponibile e il recupero in-place è rifiutato; un errore di quota non produce una finta conferma. Limiti2000oggetti/500comandi restano invariati.

L'estensione immersiva dell'8novembre usa CSS fixed e overlay, senza Fullscreen obbligatorio o remount. Compensa il cambio d'origine una volta all'ingresso/uscita, mai al pointerdown/up. I controlli diventano invisibili/inert durante il gesto; prima il focus passa alla superficie. I ref di gesture bloccano camera/trasformazioni da tastiera durante tratto, gomma, pan e touch. Il chrome resta montato per conservare registrazione e stato; il capture espone uno stato reale distinto dal più ampio guard audioBusy. La vista Taccuino attuale non soddisfa ancora quaderni/sezioni/pagine: il mandato richiede una struttura persistente futura, non un'altra appearance. [Fonti, licenze e REA](../sources/immersive-writing-2026-11-08.md).

## Oggetti, corsi e conoscenza

Quindici modelli fisici sono definizioni ordinarie `ardesia.composition/1`: parametri SI, risultati, grafici e scene, esportabili e modificabili nel Creator. Due rappresentazioni spaziali usano coordinate3D e proiezione ortografica, non WebGL. Ipotesi/limiti e controlli scientifici non equivalgono ad approvazione didattica.

I cinque corsi importano lezioni, fonti, note, laboratori e domande nello stesso Core. Command ID e prefisso già salvato consentono ripresa senza duplicazione. Un pending deve essere risolto; contenuto già modificato viene rifiutato anziché sovrascritto. Le edizioni fissano le revisioni effettive delle lezioni. Ogni risposta a una domanda conserva ID/revisione di domanda e lezione; un callback tardivo non può trasferire il contesto a un’altra unità. Apertura dei materiali attende il completamento del cambio unità.

I concept-link sono oggetti Creator con definizione stabile `ardesia.knowledge.link`/1. Stato dell’istanza contiene relazione e riferimenti esatti. Ricerca, backlink e mappa sono proiezioni dei documenti/eventi già autorizzati: endpoint non disponibili restano tali, senza fetch o fallback a latest. La mappa naviga dal nodo selezionato con vicini paginati; i backlink espongono e aprono revisioni fissate. Ricerca UI/MCP usa lo stesso estrattore puro del contenuto, inclusi stato e prosa dei tipi aperti, escludendo il codice. Le anteprime storiche sono readonly e la loro identità React comprende documento/oggetto/revisione. Nessun archivio parallelo.

## Dati tutor

Contratti0.11.0, snapshot10, SQL008. Costi diretti/minuti di preparazione sono opzionali e non ricevono default persistiti. Apertura di snapshot9 modifica solo l’envelope in memoria; il comando successivo salva10. Snapshot1–9 falsamente contenenti i nuovi campi vengono rifiutati, senza perdita degli originali. Il golden v9 e le ricevute precedenti conservano i fingerprint. SQL estende il CHECK4–10, senza riscrittura dei dati. Economia derivata con BigInt, gruppi contati una volta, quote pacchetto con arrotondamento cumulativo, valute e incassi distinti. [Dettagli](../sources/tutor-economics-2026-11-07.md).

## Risorse e compromessi misurati

La soglia Core precedente272KiB fallisce sul primo candidato:302.212byte gzip. Il JS iniziale215.874byte resta sotto240KiB. La policy esplicita passa a304KiB per il costo di continuità, corsi, laboratori e conoscenza; iniziale240KiB, programma320KiB gzip/1MiB raw e PDF3MiB gzip/6MiB raw restano invariati. Il report mantiene il confronto272KiB e tutti i totali, senza riclassificare asset. La metrica v3 conserva il formato e la suddivisione; questa è la quarta revisione della policy. I JSON didattici, richiesti soltanto all’importazione, hanno dimensioni raw/gzip e digest propri in distributed-assets.json. Non sono un costo nascosto nel JS.

La prova Core con tutti i cinque corsi iniziali (713oggetti/38lezioni) ha misurato6.352.080byte di proiezione e230,4s in memoria su Mac, sotto il limite8MiB del client. È un limite prestazionale evidente, non una misura di trasporto o scala remota: importazione e ricostruzione dell’intero spazio crescono col patrimonio. Prima di aumentare le quote servono comandi di importazione e letture autorizzate più efficienti, senza introdurre un secondo Core. La successiva espansione originale e i workload browser sono riportati nell’handoff con la loro identità.

## Rollback e prove

Il nuovo reader legge il passato; il vecchio strict reader non legge record economics v10. Dopo nuove scritture rollback solo a codice compatibile oppure migrazione inversa esplicita e verificata, mai rimozione manuale di campi/storia o restore sopra dati esistenti. Le copie offline/checkpoint sono esportabili prima di cambiare client. Lezioni importate e link restano oggetti portabili anche senza le viste specializzate.

Test discriminanti coprono lock concorrenti, risposta persa, cleanup revocato, due link diversi, callback di domanda tardivo, golden v9, retry/import interrotto, numerica dei laboratori e studio reale browser/PostgreSQL. [Handoff](../handoffs/core-continuity-2026-11-07.md) distingue risultati eseguiti da prove native/host non disponibili.
