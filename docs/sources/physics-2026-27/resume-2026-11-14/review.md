# Review indipendente — salvataggio e ripresa esame

**Esito: PASS, nessun rilievo bloccante sul candidato congelato.** Review di un agente distinto dall’autore `cloud_audit`, con lettura del diff e controlli propri. Nessuna modifica al repository condiviso e nessuna pubblicazione.

## Identità verificata

- Patch: `3cb6553275c1461e9db8c2c06cad9e60ec526bfea50ff715f9bc11c67f6959ce`
- Runtime sorgente: `a990c5c87ab3757c4e521e5a1203a831126c73130a38c6798fa82fa466a853c5`
- Runtime minificato/offline: `935603f9b031b9d5a4e35347506a25ca1decd7e15723a2b1a11e3de7c1a63252`
- ZIP candidato: `43d3368f68319174455bfb0ee169b55d589528e105c3d2e43f107b82232e526d`

I file sorgente, builder e CSS coincidono con gli hash della provenienza della patch. Il runtime pubblico e quello estratto dallo ZIP hanno byte identici. La minificazione ripetuta indipendentemente dal sorgente congelato riproduce esattamente i byte pubblici (`identity.cjs`).

## Validazione del parser

`parser.cjs`: 4.262 controlli sul sorgente e 4.262 sul minificato, **8.524 PASS**, compresi 8.000 round-trip generati con tutte le 31 risposte, indici e insiemi di flag variabili, A/B e modalità libera/a tempo.

Verificati confini 65.536 byte accettati e 65.537 rifiutati, limite UTF-8 distinto dalla lunghezza JavaScript, risposta di 80 caratteri accettata/81 rifiutata, tutti i campi obbligatori, nessun campo extra, tipi/schema/kind, ID prova e hash esatti, modalità, timestamp sicuro non futuro e non negativo, deadline originale, indice 0–30, esattamente 31 ID di risposta, scelta appartenente ad A–E o vuota, flag validi/unici, edizione incrociata rifiutata. Un file scaduto viene correttamente riconosciuto come sessione scaduta; non accetta risposte alla deadline.

Il parser conserva stringhe non numeriche di lunghezza ammessa: scelta intenzionale coerente con il comportamento del campo esistente, che le mostra come correggibili e le valuta errate alla consegna. Il formato non è firmato e non costituisce una prova autenticata. La presenza dell’hash lega il tentativo alla sorgente editoriale ma non impedisce la modifica volontaria del file locale.

## Verifica browser indipendente

`browser.cjs`: **101 controlli PASS** in Chromium/Playwright, pagine reali estratte dal candidato, URL `file://`, contesti offline. A/B a 320 e 1280 px.

- Avvio, risposta scelta/numerica, flag, navigazione all’ultima domanda, download JSON reale, chiusura, nuova apertura e import: stato e JSON riesportato identici. Le modifiche successive non alterano il file già scaricato.
- Etichetta input/descrizione errore e focus sulla domanda ripresa; nessun overflow orizzontale in intro e prova. Screenshot `invalid-mobile.png` ispezionato: testo errore leggibile e controlli disponibili a 320 px.
- File malformato, campo errato, prova A/B sbagliata, hash diverso e file troppo grande lasciano utilizzabile la schermata iniziale. File valido successivo elimina l’errore. Import programmatico mentre il tentativo è attivo o il risultato è visibile non li sovrascrive.
- Ripresa con un millisecondo residuo conserva la deadline; una modifica alla deadline non entra nelle risposte. File esattamente scaduto termina subito e focalizza il risultato. Anche una lettura iniziata prima ma completata dopo la deadline termina immediatamente; elapsedSeconds resta 3000 e deadline resta quella originaria.
- Due letture completate in entrambi gli ordini: vince l’ultima selezione. Un’ultima selezione invalida non lascia riapparire il file valido precedente. Cancellazione della selezione invalida la lettura pendente. Fallimento asincrono permette riprova con lo stesso nome. Avvio manuale durante lettura pendente non viene sovrascritto, neppure dopo consegna e ritorno all’intro.
- Nessuna richiesta HTTP e nessun errore JavaScript. Strumentazione su Storage getItem/setItem, IndexedDB, fetch, XHR, beacon e Cache API: nessuna chiamata del percorso. Lettura statica coerente: nessun autosalvataggio, sincronizzazione, browser storage o invio remoto introdotto. I soli download sono espliciti.

## Limiti e integrazione

Il browser è Chromium su macOS; viewport mobile non equivale a prove su dispositivi reali iOS/Android e l’upload Playwright non certifica il selettore file del sistema operativo. Non è stata effettuata una nuova revisione scientifica dei quesiti, dei contenuti C1–C5 o del ripasso HTML, già oggetto di altri incarichi. Non sono stati verificati distribuzione Vercel/GitHub, autenticazione Core o accettazione commerciale.

Il codice usa 50 minuti fissi nel formato checkpoint; ciò è coerente con `parseData`, che ammette soltanto prove da 50 minuti. Se cambia durata/schema in futuro, occorre versionare o adattare questa regola insieme al parser.

Il coordinatore deve rigenerare gli asset e lo ZIP integrati, completare Verify/build/CI applicabili e collegare le prove alla revisione finale pubblicata. Questa review non si trasferisce automaticamente a modifiche successive della funzionalità. Le istruzioni del LEGGIMI della patch descrivono correttamente salvataggio manuale, stessa edizione, deadline originale e carattere modificabile/non certificante del file.

La prima inizializzazione del nostro harness parser usava l’ordine degli attributi HTML sbagliato; la sola estrazione del fixture è stata corretta prima delle esecuzioni PASS. Nessuna correzione al prodotto è stata necessaria.
