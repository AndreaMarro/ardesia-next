# ADR 0025 — Studio pubblico, prova e laboratorio di Fisica

14 novembre 2026. Mandato diretto di cinque ore, con pubblicazione di branch e preview autorizzata separatamente. Nessuna migrazione Core o nuova dipendenza.

Le 38 lezioni sono un’edizione di lettura dei cinque pacchetti esistenti: teoria, prerequisiti, previsione, attività, confronto, 279 problemi/verifiche originali e per obiettivo, transfer, recupero e fonti. Le copie legacy rimangono distinte. I cinque hash dei pacchetti, l’hash editoriale e gli hash delle pagine legano la provenienza; non attestano approvazione scientifica. Il lavoro persistente rimane nello spazio Core autenticato.

La prova A contiene 31 quesiti originali: 21 scelte con cinque alternative e 10 completamenti numerici, 50 minuti oppure pratica libera, punteggio +1/−0,1/0. Dati JSON inerti e testo DOM evitano codice derivato dai contenuti. Il timer usa Date.now e controlla il termine anche negli handler: una scheda sospesa applica la scadenza al rientro. Non è sorveglianza d’esame né protezione contro modifiche dell’orologio. Risposte in RAM, esportazione esplicita JSON con hash, nessuna scrittura locale/server. Spiegazioni e recupero descrivono le risposte, senza stimare padronanza.

Il laboratorio C4 riusa WebGL e Canvas del browser, senza librerie 3D. Cariche puntiformi nel vuoto, somma vettoriale di E e scalare di V, zona esclusa r<0,18 m. La superficie satura graficamente a ±60 V; la sonda conserva i valori fisici. Il fallback 2D usa lo stesso modello. Il runtime classic funziona anche da file://. La camera comprende dominio, altezza e freccia negli schermi stretti. Il modello non simula traiettorie di particelle.

Il pacchetto ZIP comprende tutte le pagine, i fogli stile e i runtime della sezione Fisica. Limiti: 256 file, 2 MiB per file, 16 MiB complessivi e profondità 8. I collegamenti a fonti/contatti e allo spazio Core richiedono rete. Nessuna promessa di account, pagamenti o sincronizzazione offline è implicata.

## Costo esplicito

La baseline pubblicata 1914a91 misura Core325894 byte gzip. Con i due runtime e le nuove risorse la prima build integrata misura339450 byte: +13556 byte (+4,16%). Il confronto con il precedente limite320KiB è conservato come FAIL. L’esame pesa circa6,1KB gzip e il laboratorio circa7,4KB; la lettura non aggiunge JavaScript. L’HTML e i dati dell’esame sono misurati separatamente nei manifest e non chiamati costo zero.

Policy v7: aggregato Core **336KiB (344064 byte)**. Il margine di questa misura è4614 byte. Rimangono invariati limite iniziale240KiB, cap Program/PDF e classificazione di ogni asset. Esame e laboratorio sono conteggiati nel Core anche se si aprono separatamente. L’ottimizzazione del raggruppamento dei moduli nella baseline aveva già recuperato circa1,5KB; non si riclassificano funzioni per far passare il limite. Le misure finali dipendono dalla head e sono registrate negli artefatti.

## Verifica e rollback

Prove indipendenti su chiavi e soluzioni non equivalgono ad approvazione umana: tutte le fonti rimangono DRAFT/humanApproval=false. Test del motore coprono formati numerici, input invalidi, punteggio negativo, bianco e zero, deadline inclusiva e isolamento dei tentativi. Il modello C4 verifica simmetrie, gradiente, sovrapposizione, scaling, esclusioni e inquadratura. Le prove browser esercitano percorso di lettura, risposte reali, export, scadenza con dialog aperto e avvio file:// senza rete. La correzione C4 conserva le prove del fallimento precedente ESM/offline e della sonda fuori campo su mobile.

Verify, CI e deploy sono esiti distinti, legati alla sorgente precisa; questo documento non li sostituisce. Safari, iPad fisico e screen reader reale non sono stati collaudati. Il rollback è un revert dei generatori, runtime e link; nessun dato degli utenti viene migrato o cancellato.

## Estensione della stessa sessione: ripresa esplicita e C3

Le prove A/B ora supportano un file di tentativo distinto dal risultato. Il download è un atto esplicito dello studente: non introduce persistenza automatica nel browser o sul server. L'importazione accetta soltanto la stessa identità/hash, con limite 64 KiB, risposte e segnalazioni valide e scadenza esatta rispetto all'inizio. Un file già scaduto viene subito consegnato. Il timer non viene sospeso dal download; dati e orologio locale restano non autenticati. La review indipendente include anche letture asincrone obsolete, errori e tentativi attivi da non sovrascrivere.

Il laboratorio C3 aggiunge il confronto fra due percorsi p-V del gas ideale monoatomico, senza dipendenze o storage. Il PDF di lavoro, inferiore a 100 KiB, è un documento statico di sette pagine incluso nello ZIP; i limiti dell'archivio restano invariati. Il suo generatore Python è separato dalla build web. Queste estensioni conservano il budget Core vigente e la classificazione di tutti i runtime.
