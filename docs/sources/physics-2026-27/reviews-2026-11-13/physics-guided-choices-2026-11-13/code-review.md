# Revisione indipendente — confronto guidato dichiarativo

Base `70af28ce5f59365fd540bafbb58ab3ce6849d680`, diff locale del root. **Nessun P1/P2 aperto sul candidato finale esaminato.** Rilevato e riprodotto un P2 iniziale sul feedback riutilizzato, corretto dal root e ricontrollato. Questa revisione riguarda l’implementazione di un altro autore; i sei quiz del gruppo A, scritti da questo revisore, hanno ricevuto la loro revisione scientifica indipendente dall’altro agente e qui sono controllati soltanto per identità d’integrazione.

## P2 risolto: feedback precedente al ritorno sulla stessa lettera

Nella prima definizione i campi choice e submitted potevano ritornare uguali dopo A→Confronta→B→A. Il probe con la API pubblica riproduceva giudizio, feedback e soluzione ricomparsi senza un nuovo confronto. Il primo test copriva il cambio A→B ma non il ritorno.

La definizione finale usa un solo campo: 0 nessuna scelta, 1–5 selezione da confrontare, 6–10 confronto effettuato. Ogni pulsante Scegli assegna 1–5, anche ripremendo la stessa lettera, e invalida immediatamente il feedback. Confronta lascia 0 invariato, porta 1–5 a 6–10 e mantiene 6–10 a un clic ripetuto. Nessun runtime nuovo è stato introdotto. Riletti i nuovi test di ritorno e riselezione e riprodotta la correzione sui dati distribuiti.

## Ordine di apertura e stato transitorio

`CourseMaterials` renderizza il widget esclusivamente nel ramo `openSolutions.includes(object.id)` raggiunto tramite il pulsante di confronto. Nel consumer reale `CourseStudio`, se l’aiuto di unità referenceFeedback è già registrato si apre; altrimenti l’apertura è callback del comando `view-course-help`. La sottoscrizione alle ricevute filtra l’identità del comando e il percorso. Nel Remote Client le notifiche delle ricevute seguono la conferma del server, l’aggiornamento della copia autorizzata e la chiusura del recupero: non è aggiunta un’apertura ottimistica dopo il solo click.

Il widget usa `ObjectContent experiments` e l’`ExtensionExperiment` esistente: `useState(data.state)` con aggiornamenti che costruiscono un nuovo oggetto, senza comandi Core, salvataggio di tentativi o nuova memoria persistente. Il reset rimette lo stato della sorgente. La chiave include id e revisione dell’oggetto. Nascondere e ricreare il widget può perdere la scelta di prova, coerentemente con la sua natura transitoria; il ragionamento scritto rimane nello stato del consumer e il suo salvataggio resta separato. Le azioni dei quiz non scrivono nel documento del docente né nel lavoro dello studente.

## Contratto, contenuti e compatibilità

Il generatore accetta soltanto cinque alternative A–E ordinate, con testi non vuoti e distinti e feedback non vuoto; richiede che correctChoice appartenga a quelle alternative. Aggiunge le opzioni al prompt distribuito, conserva soluzione e feedback separatamente, inizializza choice=0 e traduce la chiave corretta in 1–5. Definizione e dati passano dagli schemi esistenti e conservano il digest. Le espressioni sono valutate dal parser dichiarativo pubblico; i contenuti sono valori testuali renderizzati da React, non HTML o codice da eseguire.

Riconosciuti i due typeId v1, senza alterare il ramo di rendering dei quesiti precedenti. Confronto diretto con la base: **559 oggetti domanda preesistenti conservano esattamente data**, tutti i **69 originali** precedenti sono identici e i **10 nuovi** corrispondono ai candidati congelati (6 A + 4 B). Il corpus diventa 79 originali. Le coordinate e i riferimenti di lezione sono rigenerati nel protocollo già esistente; non si dichiara che importazioni completate di versioni precedenti vengano aggiornate automaticamente.

I campi numerici usano il contratto generale di range, senza introdurre un nuovo enum: gli stati interi ammessi sono garantiti dalle inizializzazioni e dalle azioni dichiarate di questo oggetto. Questa review non attribuisce allo schema numerico generale una restrizione aggiuntiva agli interi che non possiede.

«Risposta corretta/da rivedere» confronta una scelta con la chiave dichiarata dall’autore. Non produce voto, completamento, mastery o diagnosi automatica del testo libero. DRAFT e assenza di approvazione umana rimangono espliciti.

## Esecuzione indipendente e lettura dei test

Eseguito un probe in sola lettura via `@ardesia/plugin-host/composition`, `ExtensionDataSchema`, `CompositionBodySchema` e digest su tutti i 10 oggetti distribuiti. **50 rami di feedback**, **250 sequenze cambio/ritorno**, riselezione della stessa lettera, confronto vuoto e confronto ripetuto: tutti coerenti. Esattamente una scelta corretta per oggetto, feedback e soluzione della sorgente conservati e nessuna mutazione dei dati.

Letti i quattro test di unità: contenuti/digest, tutte le alternative, assenza di feedback iniziale o obsoleto e contratto. Letto il nuovo E2E C2 sul quiz della zattera: ragionamento salvato prima dell’aiuto, widget inizialmente assente, ricevuta referenceFeedback e una revisione aggiuntiva, tentativo immutato, confronto errato/cambio/ritorno/corretto, reset, documenti e lavoro invariati durante il widget, risposta ripresa dopo reload senza attribuire retroattivamente aiuti. Sono asserzioni significative; il loro PASS browser non è attestato da questo revisore.

## Hash principali finali

| File | SHA-256 |
|---|---|
| CourseMaterials.tsx | `1633e80cfd1126f022f191524dbf4491fbdb14a586980c260290b70b04c7a9e0` |
| courses.css | `ecdeec039436bc5bd836bd2c3d236abfc55e51991293fb000d70dd43eebb605c` |
| build-physics-pack.mjs | `5e6b4fad3ad3e7b34019e3b8bd299a30927f910150fc09f449958b436961706d` |
| choice-question-definition.json | `72fc74b83ac6521b32ed4eddf9efa9242282a56b53831a103aa28213149d5bac` |
| guided-choices.test.ts | `3314c49f79a27d8c7df5f7df2b46e5570bf6d03d2220a94144785374759244e6` |
| physics-courses.spec.ts | `148fb1118ac92b915a257931802598a11ce576ea4c0b547acfb8e6ba9854d914` |

Gli hash di consumer, renderer, schemi, generatori e pacchetti effettivamente letti sono nel JSON associato. Nessuna esecuzione di browser, Verify completo o servizio; nessuna modifica condivisa da parte del revisore. Accessibilità fisica e continuità del flusso reale restano affidate alle prove sul candidato finale, senza approvazione scientifica umana o pubblicazione implicita.
