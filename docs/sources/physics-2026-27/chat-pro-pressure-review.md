# Prima unità di Fluidi — contributo della chat Pro

**Risultato del lavoro di una chat Pro.** Mandato diretto di Andrea del 8 novembre 2026. DRAFT; nessuna approvazione scientifica/editoriale umana, vendita o pubblicazione attribuita a questo contributo.

## Base e perimetro

Base immutabile: `3e37dfb986670251b4fea5f96bd81f37b960e291`, candidata della PR51. Il modello dei corsi, Core, Host, Creator, Remote Client e il lavoro precedente restano contributi preesistenti; questa chat Pro rivendica soltanto il delta descritto qui. Il documento è una ricevuta di integrazione editoriale, non un cursore, una coda o un secondo piano operativo.

Il mandato chiede previsione, tentativo, feedback, recupero e nuova applicazione sullo stesso contenuto/versione. La prima unità era già consistente; l'attività su forza/area era però collegata al laboratorio idrostatico e la verifica riproponeva domande già spiegate. Il delta corregge questi punti senza introdurre nuove API o migrazioni.

Identità conservate: corso `sf-2026-fluidi-v1`, unità `sf-2026-u3-01`, lezione `sf-2026-fluidi-v1:sf-2026-u3-01`, obiettivi `U3-01.01`–`.04`. La nuova lezione importata ha revisione **20**, invece di 19, perché contiene un problema aggiuntivo. Non è un incremento artificiale della revisione delle edizioni già salvate.

## Contenuto e laboratorio

Il laboratorio **Pressione nel pistone** è una normale estensione `ardesia-extension/1`, renderer `ardesia.composition/1`, versione 1. È dichiarato in `editorial/lab-definitions.json`, validato e incorporato dal generatore vigente. Non aggiunge JavaScript al runtime dei laboratori, un secondo registro persistente o un motore specifico per il corso.

Controlli: forza **normale** compressiva in N, area in cm², pressione esterna in kPa. Modello: pistone orizzontale guidato senza attrito, equilibrio, pressione uniforme e nessuna componente del peso lungo l'asse. Il bilancio è `(p_ass − p_ext) A = F_n`. Il controllo della forza non rappresenta il modulo di una forza obliqua.

| Stato | Forza normale | Area | Pressione esterna | Differenza | Assoluta |
|---|---:|---:|---:|---:|---:|
| A | 60 N | 20 cm² | 100 kPa | 30 kPa | 130 kPa |
| B | 60 N | 10 cm² | 100 kPa | 60 kPa | 160 kPa |
| C | 30 N | 10 cm² | 100 kPa | 30 kPa | 130 kPa |
| D | 60 N | 20 cm² | 90 kPa | 30 kPa | 120 kPa |

Il laboratorio copre specificamente pressione `.02` e condizioni del modello statico `.04`. Non misura la densità `.03`, che mantiene spiegazione ed esercizi. Il laboratorio idrostatico rimane nella seconda unità di Fluidi e negli altri collegamenti già esistenti.

Il recupero tratta conversione dell'area, pressione/densità, riferimento assoluto/relativo e componente normale. La nuova applicazione combina forza obliqua a 60° dalla normale, densità di un campione e un vincolo inverso sulla pressione assoluta. Il problema `original-U3-01-pro-transfer-v1` è aggiunto ai 38 originali esistenti, che restano invariati. La provenienza dichiara la novità rispetto all'attività e all'esempio dell'unità; non attribuisce al nuovo problema un confronto sistematico col patrimonio legacy mai eseguito.

La soluzione della nuova applicazione è separata dal feedback dell'attività e compare nella normale interfaccia dei corsi dopo **Confronta con la soluzione**. Rimane nei dati portabili e può essere letta con il Creator: è materiale di studio consultabile, non una chiave segreta d'esame. Gli aiuti sono tracciati per unità e tipo; la nuova apertura non produce una misura autonoma della competenza né un dettaglio distinto per ciascuna soluzione se l'aiuto di riferimento era già stato consultato.

## Compatibilità e aggiornamento

Le altre quattro unità/documenti di Fluidi e i quattro asset degli altri corsi devono restare identici alla base. I conteggi attesi sono ancora 5 corsi, 38 unità, 200 sotto-obiettivi editoriali e 259 quesiti selezionati; diventano 39 problemi originali e 16 tipi di laboratorio effettivamente incorporati. Questi conteggi non attestano approvazione scientifica o apprendimento.

**Un corso già importato non viene aggiornato automaticamente.** L'importatore restituisce il corso esistente e protegge le modifiche del docente. Per provare questo pacchetto, creare uno spazio nuovo, importare Fluidi e fissare una nuova edizione. Una vecchia importazione parziale incompatibile resta protetta: non cancellare materiali per forzarne la ripresa. Nessuna migrazione implicita, riattribuzione di tentativi o modifica retroattiva delle edizioni.

Il rollback del pacchetto riguarda il catalogo per le importazioni future; non elimina il lavoro già salvato nei singoli spazi. Core, Host, schema del database, autorizzazioni, limiti di bundle e CI non sono modificati.

## Verifica riproducibile

`node tools/build-physics-pack.mjs` genera asset, catalogo e mappa delle risorse a partire dagli input editoriali. Non modificare manualmente il solo JSON distribuito. Una seconda generazione deve lasciare gli stessi byte.

`apps/web/src/courses/physics/pressure.test.ts` misura le espressioni della definizione **effettivamente distribuita**: stati A–D, forza nulla, limiti dell'intervallo, area nulla rifiutata, bilancio della prova obliqua, digest e separazione del feedback. I test esistenti dei laboratori, dei corsi e dell'importazione rimangono attivi.

`e2e/pressure-unit.spec.ts` esegue con browser, API e PostgreSQL reali: importazione, edizione, previsione, variazioni del laboratorio, tentativo errato conservato, feedback, recupero, correzione, nuova applicazione, consultazione esplicita della soluzione e riapertura. Verifica che i controlli esplorativi non modifichino la lezione fissata e che i quattro tentativi conservino fase, revisione e aiuti. La suite esistente `e2e/physics-courses.spec.ts` continua a controllare l'importazione interrotta e il laboratorio idrostatico della seconda unità.

I comandi sono `npm run verify` e `npm run test:e2e -- e2e/pressure-unit.spec.ts e2e/physics-courses.spec.ts e2e/courses.spec.ts`, nell'ambiente locale con database dedicati. Per il gate finale usare il workflow Verify sulla SHA esatta del contributo. Risultati, eventuali errori e limiti vanno riportati nelle ricevute di esecuzione e nella PR; questo documento non anticipa un PASS sulla futura commit.

La revisione tecnica AI comprende una seconda risoluzione dei soli quesiti, fissata prima di mostrare soluzioni e codice al revisore. Non sostituisce lettura umana, prova con studenti, accettazione M5 o prove con penna fisica.

## Prova privata del docente

Nel nuovo spazio: **Corsi → Fluidi → Aggiungi al mio spazio → Fissa un’edizione → Inizia il mio percorso**. Usare la prima unità, salvare una previsione, passare a **Metti alla prova** e aprire i materiali. Variare una grandezza alla volta nel laboratorio. Conservare il primo tentativo, consultare il confronto e il recupero, aggiungere una correzione. Passare a **In un altro contesto**; dopo aver salvato la risposta, aprire il problema originale dedicato e la sua soluzione. Ricaricare e riprendere per controllare la conservazione del lavoro.

L'accettazione del docente riguarda chiarezza della spiegazione, difficoltà, tempi e utilità del recupero. Il presente contributo non attiva offerte, iscrizioni, messaggi, pagamenti o campagne. Prezzi, calendario, condizioni e pubblicazione restano le decisioni commerciali separate indicate nel mandato.
