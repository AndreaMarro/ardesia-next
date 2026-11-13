# Memoria cumulativa del runtime Program

Durante la verifica dell'incremento Fisica, il test preesistente con `Array(100000).fill` ha superato il timeout unitario di5s. Il primo Verify ha concluso673/674test; l'esecuzione isolata ha riprodotto il timeout. Entrambi i fallimenti sono conservati nelle ricevute. Nessun test, timeout o limite di produzione è stato rimosso o aumentato.

L'indagine separata ha rilevato un difetto preesistente della dipendenza: `setMemoryLimit(16MiB)` non impediva la somma di molte allocazioni più piccole. Il coordinatore ha riprodotto il caso finito attraverso `executeProgram` reale, con interrupt attivo:32buffer da1MiB mantenuti contemporaneamente e risultato valido in84,54ms. Il contatore `memory_used_size` è una stima separata dal contatore dell'allocatore; il risultato è sostenuto dal comportamento del programma e dal sorgente dell'allocatore, non soltanto dalla metrica.

## Fonti e causa

Dipendenza invariata: `@jitl/quickjs-wasmfile-release-sync@0.32.0`, che identifica Bellard QuickJS2025-09-13+`f1139494`. Nel [sorgente esatto](https://raw.githubusercontent.com/bellard/quickjs/f1139494d18a2053630c5ed3384a42bb70db3c53/quickjs.c), `js_def_malloc_usable_size` restituisce0 nel ramo Emscripten. La verifica dell'allocazione confronta la dimensione richiesta con il contatore, ma quest'ultimo accumula soltanto l'overhead quando usable size è0. Il rifiuto di un singolo blocco grande non dimostra quindi un limite cumulativo corretto. Il problema e la rettifica dell'ipotesi iniziale sono discussi pubblicamente in [issue271](https://github.com/justjake/quickjs-emscripten/issues/271) e [issue255](https://github.com/justjake/quickjs-emscripten/issues/255).

## Correzione effettiva

`program-module.ts` è la factory comune al Worker di produzione e ai test. Ogni modulo riceve una nuova `WebAssembly.Memory` con iniziale e massimo entrambi di256pagine:16.777.216byte. La dipendenza esistente supporta questa iniezione mediante `newVariant`; il Worker conserva il proprio URL WASM, nonce e handshake. Le sessioni non condividono la memoria. Un tentativo di crescita oltre il massimo viene rifiutato dalla piattaforma WebAssembly.

Il limite ora riguarda **tutta la memoria lineare del modulo WASM**, compresi engine e stack: non promette16MiB netti di heap al programma. Restano invariati il limite richiesto alla VM, stack128KiB, deadline cooperativa100ms, watchdog esterno2s, bootstrap15s e limiti di output/messaggi. La correzione non ripara l'allocatore interno e non costituisce un limite al consumo RSS complessivo del browser, alle strutture JavaScript esterne o alla somma di più Worker. Programmi che consumavano memoria oltre il limite dichiarato possono ora ricevere un errore.

## Controprove

I nuovi test usano la factory di produzione, verificano dimensione e rifiuto di `memory.grow`, e disabilitano solo l'interrupt nella prova di memoria:32buffer da1MiB e400array da10.000elementi devono essere rifiutati per memoria, senza confondere il risultato con un timeout. Controllano un nuovo runtime dopo OOM, l'OOM catturato dal programma e due moduli con memorie distinte. Il caso originale illimitato resta invariato. Il browser aggiunge il caso finito32×1MiB alla prova ostile esistente, mantenendo recupero del programma ordinario e interfaccia utilizzabile.

Due indagini AI indipendenti precedono la patch; il coordinatore integra la factory, un revisore separato verifica diff e comportamento del helper reale. Prove grezze e risultati conclusivi sono negli artifact dell'incremento, legati alla sorgente esatta. La prima esecuzione della build separata senza URL PostgreSQL ha fallito esplicitamente per configurazione; la successiva con database locale configurato ha superato server e MCP. Non è prova di deploy o di hardware Apple.

Il laboratorio dei condensatori usa il renderer dichiarativo: questo difetto non deriva dai contenuti Fisica. La correzione evita di presentare come affidabile un tetto cumulativo non applicato nel Creator programmabile. Non sono stati pubblicati messaggi o segnalazioni a terzi durante l'indagine.
