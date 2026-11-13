# Diagnostica del test di pressione allocativa QuickJS — 2026-11-13

Esito: **non applicare la sostituzione proposta come correzione del blocco Verify**. Il caso a chunk di 10.000 elementi senza interrupt isola effettivamente il limite heap, ma qui una delle tre esecuzioni supera già il timeout del test di 5 secondi. Non offre quindi margine riproducibile sufficiente. Nessun sorgente condiviso, test, timeout o limite di produzione è stato modificato da questa indagine.

## Metodo

Script indipendente: `/tmp/ardesia-quickjs-memory.cjs`, Node 24.22.1, dipendenze QuickJS 0.32.0 del repository. Un modulo WASM, runtime e context nuovi per ogni caso, `memoryBytes = 16 * 1024 * 1024`, `stackBytes = 128 * 1024`, stesso ciclo cumulativo `const huge=[];while(true)huge.push(new Array(N).fill(123));`. Nel caso candidato non è installato alcun interrupt: equivale all'effetto del mock no-op proposto, senza modificare `executeProgram`. Nel confronto originale l'interrupt usa la deadline reale di 100 ms.

Dopo ogni errore sono stati disposti handle/context/runtime e creati runtime/context nuovi sullo stesso modulo WASM. Il nuovo programma restituisce correttamente `{"state":{"count":0},"view":{"tag":"p"}}`.

| Ordine | Chunk | Interrupt | Tempo eval | Tempo con recovery | Esito |
| --- | ---: | --- | ---: | ---: | --- |
| 1 | 10.000 | assente | 5644,31 ms | 5648,83 ms | InternalError: out of memory; recovery valido |
| 2 | 10.000 | assente | 4136,17 ms | 4138,04 ms | InternalError: out of memory; recovery valido |
| 3 | 10.000 | assente | 3110,62 ms | 3112,43 ms | InternalError: out of memory; recovery valido |
| 4 | 100.000 | deadline 100 ms | 2104,99 ms | 2106,14 ms | InternalError: out of memory; recovery valido |

Nel quarto caso il callback interrupt è stato invocato una sola volta. Il rifiuto finale registrato è di memoria. Questi dati non misurano il watchdog esterno: la chiamata VM sincrona nello stesso processo Node non può sostituire il Worker browser.

## Interpretazione e limiti

La proposta migliorerebbe la separazione concettuale del test di memoria dal test di tempo, ma ridurre il chunk non garantisce un'esecuzione più breve: si accumula comunque pressione sullo stesso heap e l'allocazione nativa resta costosa. Le tre misure non sono un benchmark generale e non stabiliscono causalità per l'oscillazione. Il confronto originale è eseguito dopo il warm-up: non è un confronto prestazionale controllato né prova che Verify originale ora passi. Non è stato eseguito un rerun cieco di Verify.

Il test esistente resta intatto in `packages/plugin-host/src/program.test.ts:30`. Il caso browser in `e2e/programs.spec.ts:43` mantiene `new Array(100000).fill(123)`, e `program-limits.ts:2` mantiene watchdog 2000 ms. La chiamata `setTimeout(..., PROGRAM_LIMITS.watchdogMs)` resta in `program-session.ts:37`. Il test browser hostile deve ancora essere eseguito dall'integrazione principale; questa indagine non l'ha avviato né ne rivendica il passaggio.

Non propongo una patch finale perché il criterio richiesto — isolamento heap **e** rapidità robusta senza aumentare timeout o limiti — non è soddisfatto. Il risultato corretto è riportare il blocco Verify esistente, conservando failure e test. Il successivo studio strutturale del test/VM può essere separato dal lavoro didattico, senza inferire regressioni nell'engine non modificato.

## Seconda ipotesi richiesta: ArrayBuffer cumulativi (rilievo P1 preesistente)

Ipotesi proposta successivamente: `while(true) huge.push(new ArrayBuffer(1024*1024))` con interrupt disabilitato, limite heap e stack invariati. Script `/tmp/ardesia-quickjs-cumulative-buffer.cjs`.

Tre esecuzioni infinite danno `InternalError: out of memory` e recovery pulito, ma la prima impiega **5458,54 ms**, le successive 96,96 e 94,68 ms. Anche questa ipotesi non offre un tempo cold sotto i 5 secondi. È emersa inoltre una ragione sostanziale per NON adottarla come prova del limite cumulativo.

### P1 — il limite di 16 MiB dichiarato non impedisce allocazioni cumulate superiori al limite nella build esaminata

Riproduzione in `/tmp/ardesia-quickjs-buffer-accounting.cjs` e `/tmp/ardesia-quickjs-buffer-accounting-400.cjs`, con nuovo modulo WASM a ogni processo, nuovo runtime/context per ciascun caso, `runtime.setMemoryLimit(16 * 1024 * 1024)`, stack 128 KiB e nessun interrupt. Le strutture sono mantenute in `globalThis.huge` per impedire la raccolta prima del controllo. `runtime.computeMemoryUsage()` viene interrogato dopo l'esecuzione.

| Caso | Esito | Evidenza |
| --- | --- | --- |
| Singolo `new ArrayBuffer(32*1024*1024)` | InternalError: out of memory | limite su singola allocazione effettivo nel caso testato |
| 32 buffer conservati, ciascuno `new ArrayBuffer(1024*1024)` | **successo** | 32 buffer, somma byteLength 33.554.432; memory_used_size **33.644.509** e malloc_limit **16.777.216** |
| 400 array conservati, ciascuno `new Array(10000).fill(123)` | **successo** | 400 array; memory_used_size **32.112.269** e malloc_limit **16.777.216** |

Il secondo processo conferma il comportamento su modulo fresco: singolo blocco rifiutato in 11,06 ms; 32 buffer passano in 90,75 ms; 400 array passano in 59,77 ms. La durata resta sotto la deadline nominale di 100 ms nei casi finiti misurati senza callback; ciò non costituisce una verifica di `executeProgram` col callback installato, ma dimostra direttamente che `setMemoryLimit` della dipendenza utilizzata non limita il totale osservato a 16 MiB.

L'evidenza riguarda il limite di memoria del runtime selezionato, **non una regressione causata dalle modifiche ai minicorsi**: l'engine e il test non sono stati modificati. La causa interna nella build WASM non è stata determinata. L'errore finale del ciclo infinito non dimostra il rifiuto a 16 MiB e non deve essere descritto come tale; potrebbe essere raggiunto per un limite diverso, che questa prova non identifica.

Il watchdog esterno resta rilevante per la durata e l'interruzione, ma non rende vera una garanzia sul picco di memoria cumulativo. L'E2E ostile deve restare invariato e i suoi risultati distinguersi da una prova del limite heap.

**Decisione:** nessuna patch test proposta. Il ciclo con ArrayBuffer non soddisfa i criteri di un fix robusto; cambiarne la descrizione in «heap cumulativo 16 MiB» produrrebbe una falsa garanzia. Conservare il failure Verify e documentare il rilievo runtime separatamente. Una correzione della dipendenza/runtime e un test finito specifico del limite cumulativo richiedono un intervento dedicato; non è stato effettuato in questa indagine read-only.

Precisazione per la validazione indipendente: il rilievo P1 resta **candidato in attesa della riproduzione del root**. `memory_used_size` e `malloc_size` non sono sinonimi; il secondo campo è assente nell'oggetto restituito. La conclusione minima osservata è che i payload finiti sopra indicati hanno successo nonostante il valore impostato di 16 MiB, conservando 32 MiB di byteLength e relativi oggetti. Il costo fisico/commit dei buffer, le metriche interne dell'allocatore e la garanzia esatta della dipendenza richiedono interpretazione distinta. Nessuna pubblicazione o comunicazione esterna è stata effettuata.
