# Review indipendente della correzione CI114

**PASS limitato alla patch e alle prove locali. Nessun finding aperto. CI del nuovo commit ancora NON VERIFICATA.**

Revisore `/root/board_review`, autore `/root`, contesti distinti. Ho letto diff, sorgenti, log e report ed eseguito soltanto controlli di identità dei byte: nessun test, servizio, installazione, Git, operazione remota o modifica a sorgenti/indice. Ho scritto solo questa relazione e il relativo JSON. Il vincolo read-only è istruttivo, non una ACL tecnica; il verdetto non è un’approvazione umana scientifica/editoriale.

## Identità e perimetro

Sorgente congelata **`dff30dd433249225ded2f9bb5ba3af2292d9a379de5de015b14ba359bca96b91`**, **431 file**, ricalcolata indipendentemente. Tutti i report finali Verify, QA, benchmark, server, MCP e build-info indicano questo digest. Il loro campo commit è la base `474650e235a5317d74dccbed40158c908154b1cd` più working tree; non identifica ancora il futuro commit della correzione.

Diff letto: `work/ci-contracts-candidate.patch`, SHA-256 `cb104b284d276b0e2f6028dfa6a21eaea384e49be67a0e5dfeb8537c8499a6d8`. Tutti gli hunk corrispondono ai byte correnti. Invertendo in memoria i sette file si ricostruiscono esattamente **430 file**, digest **`0c4c2493f19cd14835d38c7d900725fae1ed4af0b2d03c3ae3b4f361f7e9fdee`**. Il perimetro comprende tre file contracts, il nuovo test Node, il suo import nel gate esistente, la fixture operatore e la nota di handoff. Nessun altro delta sorgente è incluso.

## Errore e correzione degli import

La CI114 aveva superato Verify e i 558 test sulla base `474650e`, poi Node **24.22.2** non trovava `packages/contracts/src/materials`, importato senza estensione da `index.ts`. L’errore avveniva durante il caricamento statico di `qa-integration.mjs`, prima del codice che apre i database. Vite risolveva questi percorsi, perciò il precedente Verify non copriva quel confine nativo.

I **13 specifier relativi** del grafo production contracts ora terminano in `.ts` e hanno tutti un file destinatario esistente. Le modifiche dei tre file contracts riguardano soltanto queste stringhe: nessuno schema, nome esportato, campo persistito, regola di migrazione o limite cambia. L’entry point pubblico rimane `@ardesia/contracts`; `allowImportingTsExtensions` e `noEmit` erano già attivi.

`tools/contracts-runtime.test.mjs` importa solo l’entry point pubblico, senza Vite o import privati. Il linking statico attraversa anche i re-export, quindi intercetta un modulo relativo irrisolvibile prima di arrivare alle asserzioni su JSON canonico, schema programma ed export del projector. Il test è importato dal gate `release-evidence`, che `tools/verify.mjs` esegue con **Node direttamente**. Il test nativo è passato sia nel log mirato sia nel Verify finale. Non ho eseguito una controprova red separata: l’errore originale della CI documenta già il caricamento nativo fallito dello stesso entry point.

## Correzione della fixture storica

Dopo la risoluzione degli import, il primo QA locale ha fallito. Il suo log generico resta conservato, senza essere promosso a successo. La vecchia fixture sottraeva alcuni campi dallo snapshot corrente, lasciando `tutorRecords` e le proiezioni dei corsi in dati etichettati v1–v3: le guardie della migrazione e gli schemi storici strict non accettano quella forma.

La fixture ora costruisce esplicitamente `schemaVersion`, `workspaceId`, `documents`, `events`, `receipts`, aggiungendo `installations` soltanto per v3. Questi campi coincidono con gli schemi storici già esistenti. I parser restano invariati. La sequenza reale install/consent/activate di v3 rimane; rimangono anche le asserzioni su archivio byte-esatto, ricevute originali, revisione, reset del consenso, rifiuto dei duplicati e mismatch di ownership. Non sono cancellati dati dell’utente: il cambiamento riguarda la costruzione di input sintetici del collector.

Il QA finale passa **quattro controprove** sul nuovo digest: backup/restore con digest identico; sessione scaduta401; indisponibilità503 e ripresa200 senza cambio dello stato; import v1/v2/v3 con byte archiviati e ricevute coincidenti, revisione1, consenso resettato, duplicato409 e ownership409. Ho ricalcolato tutti e quattro i digest interni del report. Il controllo aggiuntivo in `qa-integration.mjs` richiede ancora ricevute non vuote e confronta gli archivi originali. La prova usa il vero handler e database sintetici; resta **M3 NOT_EVALUATED**.

## Evidenze finali locali

| Prova | Risultato |
| --- | --- |
| Verify |8/8 sul digest dff30dd…, inclusi tipi, test Node, build e budget |
| Vitest |558/558, zero failed/pending; il nuovo test Node è nel gate precedente e non aggiunge un test al conteggio Vitest |
| Server e MCP |5/5 e15/15, stesso digest |
| QA operatore |4 controprove, import1/2/3, stesso digest |
| Benchmark |PASS sullo stesso digest; cinque configurazioni del carico, conflitti nello stesso workspace e32 successi senza conflitto in workspace distinti |
| Binding |431 file e reverse diff verificati; hash parsed-JSON unitari `531a827d40ef84356a9dc52b766cd0bc84cdf4eb4af267b1e0b9f2c0cabc2f0b` coincidente |

I test e i workflow DB sono stati eseguiti dall’autore; il revisore ha esaminato le prove senza rieseguirli. Il benchmark finale è una prova limitata del consumer PostgresStore, esclude HTTP/TLS/rendering e non certifica capacità o latenza di produzione. Il benchmark intermedio sul digest `ba6e618f…` resta distinto. Per il QA/benchmark finale l’autore riporta un nuovo cluster loopback PostgreSQL **16.14**, porta **55439**; non ho aperto connessioni DB. La CI usa PostgreSQL **18**, quindi la compatibilità su quell’ambiente resta nel gate remoto. Server/MCP locali riportano Node24.22.1; i log mostrano Vitest5.0.5 e Vite8.3.5.

Hash del log CI114 originale: `a3d9f0448a8248372b6026f191c4d1517e60a4e9a9ee37e4db1a82bf0806fd8c`. Hash del primo QA locale fallito: `6d72985ae5ab38d3f24e44c60631c29a3c260f556b203e312c61fba900f31bb5`. Inventario completo di sorgenti, report e log in `ci-114-fix-review.json`. Il warning Vite sulla porta WebSocket24678 già occupata è presente; i check finali indicati hanno completato con successo.

## Gate ancora aperti

Occorre associare il commit pubblicato ai byte dff30dd… e osservare l’intera CI di quel commit, compresi QA, benchmark e browser. **Questo verdetto locale non è un PASS della CI.** Non è stato richiesto o dichiarato un nuovo browser locale per la correzione circoscritta; i191 browser materiali e i12 browser programmi precedenti non sono trasferiti al nuovo digest. Prodotto **NOT_COMPLETE**, deployment **NOT_VERIFIED_FOR_CURRENT_COMMIT**; nessun merge o deploy valutato.
