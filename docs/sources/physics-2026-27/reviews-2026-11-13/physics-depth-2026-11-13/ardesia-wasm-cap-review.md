# Revisione tecnica indipendente della mitigazione WASM — 2026-11-13

**Esito nel perimetro esaminato: nessun difetto concreto P1/P2 individuato.** La nuova factory impone un limite alla memoria lineare dell'intero modulo WASM, includendo l'overhead del motore. Il valore rimane 16 MiB e nessuna soglia o timeout è aumentato. Questo esito riguarda la mitigazione specifica e non costituisce approvazione generale di sicurezza o attestazione di compatibilità browser.

Il revisore aveva svolto la precedente indagine sull'allocazione cumulativa; **non ha scritto questa soluzione né il nuovo test**. La presente revisione dell'implementazione del collega è indipendente. Sono stati letti sorgenti e diff raw, incluso il file nuovo non ancora tracciato `program-module.ts`. Nessun sorgente condiviso è stato modificato durante la revisione.

## Sorgenti fissati alla lettura

| File | SHA-256 |
| --- | --- |
| packages/plugin-host/src/program-module.ts | 809a4f0b2cc8449ea1bb3078d077738ddddeaac52584722e0ed231fa599a6f2e |
| packages/plugin-host/src/program-worker.ts | ee29e9162bfecf48176f3054d2dafe02e3986932d985ee761c70b5fb90d9df3e |
| packages/plugin-host/src/program.test.ts | 11b388a50bdd220ee29768d81f41e02ce2cc8cb41ce5023228e96090a60e4bcc |
| packages/plugin-host/src/program-limits.ts | 742c3336ec4a69ca4b34a908640128f8f654f0aa495a3a6261f338bd8edbfd33 |

## Verifica della soluzione

`createProgramModule` costruisce **dentro ogni chiamata** una nuova `WebAssembly.Memory({initial:256, maximum:256})`; 256 pagine WASM da 65536 byte equivalgono a 16777216 byte. L'opzione `wasmMemory` è supportata da `newVariant` nella dipendenza QuickJS 0.32.0 utilizzata e passa questa memoria all'istanza WASM. Non si affida al solo conteggio per-runtime che ha motivato l'indagine precedente.

`program-worker.ts` usa la factory nel percorso di inizializzazione reale, passando il medesimo URL WASM già usato prima. Il promise `engine` resta locale al Worker e il controllo `sessionNonce !== undefined` impedisce una seconda inizializzazione nello stesso Worker. `ProgramSession` crea un nuovo Worker per esecuzione/sessione e lo termina nei percorsi di stop/failure. Non è stata introdotta una cache condivisa di memorie o runtime.

Il limite riguarda la memoria lineare WASM, **non la memoria totale del processo browser o tutti gli oggetti JavaScript del Worker**. Il commento nuovo in `program-limits.ts` distingue correttamente messaggi/output JS e lifecycle esterno. Il numero di byte utili all'ospite è inferiore a 16 MiB, perché engine, stack e altre allocazioni WASM usano lo stesso spazio: è il comportamento richiesto, non un aumento del budget.

Il nuovo test usa la factory di produzione, controlla la memoria effettivamente restituita dal modulo, nega `grow(1)`, disabilita soltanto l'interruzione cooperativa nel runtime sotto prova, richiede il rifiuto sia di 32 buffer da 1 MiB sia di 400 array da 10000 elementi (allocazioni singolarmente inferiori al limite) e controlla una nuova esecuzione pulita. La revisione finale include inoltre il caso in cui il guest intercetta OOM e il caso di due moduli con memorie distinte. Il ciclo finito rende esplicito il controesempio: nella vecchia configurazione le 32 allocazioni potevano completarsi. La verifica non può risultare verde soltanto grazie alla deadline cooperativa. Restano intatti il test originale con `new Array(100000).fill(123)`, quello della singola allocazione da 32 MiB e i limiti di 100 ms/2000 ms. Il mock della factory è ripristinato nel `finally` prima del controllo di recovery.

## Probe indipendente eseguito

Script: `/tmp/ardesia-wasm-cap-review.cjs`.
Output integrale: `/tmp/ardesia-wasm-cap-review.raw.jsonl`.

Il probe legge e transpila i **sorgenti reali** `program-module.ts` e `program-limits.ts` tramite TypeScript, senza riscriverne logica o costanti. Carica le dipendenze installate del repository e crea due moduli distinti. Il codice di prova usa direttamente runtime/context QuickJS nuovi, gli stessi limiti heap/stack e **nessun interrupt installato**; quindi non sostituisce la verifica completa di `executeProgram` svolta dai test di integrazione del root.

Risultati osservati:

| Prova | Risultato | Durata eval locale |
| --- | --- | ---: |
| Due chiamate alla factory | Memory e ArrayBuffer distinti; entrambi 16777216 byte | — |
| `firstMemory.grow(1)` | RangeError, memoria invariata | — |
| Programma JSON normale | risultato corretto | 9,63 ms |
| 32 ArrayBuffer da 1 MiB conservati | InternalError: out of memory | 31,83 ms |
| 400 array da 10000 numeri conservati | InternalError: out of memory | 38,37 ms |
| Singolo ArrayBuffer da 32 MiB | InternalError: out of memory | 0,77 ms |
| Ciclo originale array da 100000 con fill | InternalError: out of memory | 12,63 ms |

Dopo **ogni** caso sono stati disposti handle/context/runtime e verificati: un nuovo runtime sullo stesso modulo restituisce `state.count = 0`; un runtime sul secondo modulo restituisce `state.count = 8`; la memoria del primo resta esattamente 16777216 byte. Tutte le asserzioni sono passate, exit code 0. I tempi sono osservazioni diagnostiche su questa macchina, non benchmark generale né garanzia temporale; il cap della memoria deriva dalla configurazione e dal rifiuto effettivo della crescita.

## Limiti residui della revisione

Non sono state eseguite da questo revisore la suite completa, la build di produzione o l'E2E browser. Il root le sta verificando separatamente; i loro risultati non sono anticipati in questo rapporto. Il probe copre recovery ordinario dopo OOM, non ogni possibile errore interno di QuickJS o fallo della piattaforma. Non sono stati valutati browser/versioni/hardware non disponibili, né il consumo complessivo di molte sessioni simultanee.

Entro questi limiti, l'evidenza disponibile è sufficiente a verificare il requisito tecnico specifico: memoria lineare WASM fissa a 16 MiB per istanza Worker, overhead incluso, crescita vietata, rifiuto cumulativo e recovery senza rilassare le protezioni esistenti.

La versione finale del test è stata riletta dopo l’aggiunta dei casi array/catch/isolation. Nessun nuovo P1/P2 individuato. Unicamente il commento «Each 1 MiB allocation» descrive il caso ArrayBuffer ma non quello array: una formulazione «Each allocation» sarebbe più precisa; è una nota editoriale P3, senza effetto sulle asserzioni.
