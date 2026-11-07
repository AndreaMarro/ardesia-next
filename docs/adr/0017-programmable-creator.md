# 0017 — Esperienze programmabili nel Creator

7 novembre 2026. Preparazione locale dal mandato diretto UI/UX, REA e creazione universale. Completa un percorso privato di creazione e utilizzo; non accetta l'intero programma o un marketplace pubblico.

## Comportamento

Creator conserva l'editor visuale e aggiunge **Crea un programma**: codice, anteprima avviabile, stato modificabile, salvataggio, riapertura, nuova versione e file portabile. Lo stesso oggetto passa dal MCP Core ufficiale. Non esiste un elenco di algoritmi o discipline: il codice può inventare comportamento e struttura entro l'ABI documentata in [programmi](../programs.md).

La definizione resta `ardesia-extension/1`, con `typeId` libera, revisione, digest, licenza e lineage esistenti. Il renderer `ardesia.program/1` interpreta JavaScript puro e restituisce stato JSON e una vista HTML/SVG passiva. Il Core conserva anche definizioni future o malformate come dati opachi, verificandone integrità; solo il confine di esecuzione applica ProgramBodySchema. Nessuna migrazione SQL o riscrittura di storia v7.

Importare, salvare, leggere, assegnare o usare MCP **non avvia codice**. Avvia questa versione concede un permesso temporaneo nella vista e nella lezione correnti. Modificare la definizione, cambiare lezione, chiudere la vista, osservare una revoca o interrompere revoca l'esecuzione. Si conserva l'ultimo stato valido; l'autore salva esplicitamente, lo studente sperimenta in privato senza modificare la lezione del docente. L'avvio a stato invariato non rende sporca la bozza.

## Scelta del motore

QuickJS/Emscripten0.32.0, MIT, in un Worker dedicato, senza loader, bridge nativi, rete, DOM o API Core disponibili al codice guest. Contesto nuovo per interazione, heap16MiB, stack128KiB, interruzione cooperativa100ms, watchdog esterno2s (inizializzazione15s), coda16, messaggi262144byte e risultati131072byte. Stack più ampi hanno prodotto abort del motore nei probe di ricorsione: conservati i fallimenti, scelta128KiB verificata con errore guest e nuovo avvio pulito. Queste quote non certificano tempo reale o una prova formale di isolamento.

Il parent valida ogni vista prima di renderizzarla: tag, attributi, eventi, stili, geometrie, profondità e numero di nodi. Niente HTML grezzo, URL, CSS libero, form, script o iframe. Input/change solo su controlli, valori tipizzati, niente SVG/tabelle annidati, niente font relativi moltiplicativi. Contenimento CSS e tipografia delle intestazioni esplicita riducono anche il lavoro fuori dalla VM. Audit del motore/browser a scala di produzione ancora da fare.

Alternative: iframe con JavaScript della pagina avrebbe lasciato CPU/memoria senza le quote richieste; Sandpack usa un bundler esterno e privilegi di preview più larghi. WebAssembly guest generico, moduli npm, rete autorizzata, pacchetti binari e altri linguaggi sono evoluzioni del Host, non possibilità già presenti. REA ha studiato concretamente lifecycle, errori e protocollo Sandpack, con risultati e limiti in [fonti](../sources/programmable-creator-2026-11-07.md). Nessun codice Sandpack copiato.

## Costo e distribuzione

Il motore separato non viene scaricato fino all'avvio. La copia offline può precaricare il piccolo host UI e il modello iniziale, ma esclude interprete/Worker/WASM. L'ink non usa il motore. CSP ammette `wasm-unsafe-eval`, senza abilitare JavaScript `unsafe-eval`; asset solo same-origin, build con licenze complete incluse.

Il precedente budget di240KiB per **tutto** il JS non è più soddisfatto e rimane riportato come confronto FAIL. La nuova policy versione1 mantiene240KiB per tutti gli asset preesistenti e aggiunge un budget esplicito di320KiB gzip/1MiB raw per il nuovo runtime opzionale, comprensivo di WASM. Totali, costo iniziale, differito e confronto storico restano nel report. Non vengono riclassificati asset esistenti per farli sparire. Questo cambiamento di perimetro è una scelta tecnica del mandato corrente, non un PASS retroattivo.

## Verifiche e ripristino

Prove su motore vero, output ostile, messaggi tardivi, body immutabile, eventi e quote; Core roundtrip opaco; browser desktop/mobile con consenso, risposte perse, conflitto, stessa identità oggetto in lezioni diverse, revoca e salvataggio; client MCP esterno→stdio→HTTP→PostgreSQL. I risultati appartengono esclusivamente alla sorgente indicata nei report esterni. Ricerca/analisi statica non equivale a esecuzione né a verifica scientifica.

Ripristino: conservare il candidato e la patch precedenti, fermare le anteprime e tornare al codice precedente, senza modificare dati. Il renderer precedente mostra il fallback e conserva il body opaco; nessuna conversione distruttiva. Mac verificabile come web, mobile emulato; Safari/iPad/Pencil, app native, host commerciali ChatGPT/Claude/Gemini, prestazioni su grandi programmi e certificazione indipendente di sicurezza restano aperti.
