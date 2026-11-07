# Diagnosi indipendente CI113 — watchdog del programma

Contesto reviewer: `/root/board_review`, non autore. Analisi in sola lettura, nessun test/servizio/installazione/Git o modifica sorgente. Root esegue il probe e resta l’unico writer. Questa relazione non approva ancora una correzione non ricevuta.

## Esito della diagnosi

Il fallimento CI misura un confine diverso da quello del watchdog: `program.test.ts:27` chiama `executeProgram` sincronicamente nello stesso thread Vitest e pretende un wall time <2000ms. Non costruisce `ProgramSession` e non avvia alcun Worker. La prima asserzione `toThrow(/Il programma/)` è già riuscita: il fallimento successivo è2482.208066ms contro2000. Non dimostra un’evasione di autorità, memoria o cleanup; dimostra che il percorso sincrono non garantisce il tempo del watchdog esterno.

Esiste anche una lacuna runtime distinta, verificabile staticamente: `program-session.ts:27,30–36` invia il primo codice guest con `initial=true` e lascia15s per l’intero messaggio. `program-worker.ts:11` fa `executeProgram(await engine, …)` dentro quell’unico intervallo. Il timeout iniziale comprende quindi sia caricamento WASM sia il primo `update`. I successivi update hanno2s. Se il requisito è2s per ogni guest dopo bootstrap, questo primo update non lo rispetta. L’ADR0017 distingue interruzione cooperativa100ms e watchdog2s/inizializzazione15s; la separazione dei due periodi va resa effettiva.

## Evidenza letta

- PR50, commit `045fa205c5a0fad97fefa774fc6f0de8a87c1aed`, CI Verify run42403006290: identità fornite dal root e presenti nel log locale, non interrogate nuovamente da questo reviewer.551/552 unitari PASS; build/browser di quel run non attestati dal solo risultato unitario.
- `work/ci-run-113.log`, SHA256 `ff64b4f4ec05633169e33372bdee62a8c3391d4145f7e12aa7bc61db72e8de81`: ciclo infinito103ms, ricorsione4ms, getter infinito104ms; allocazione ripetuta2490ms nel riepilogo e2482.208066ms nell’asserzione.
- `work/program-memory-probe.json`, SHA256 `2a9f910c0a364a4f6cf6c0c02ff81db780e4a7a4223f23381e1c4c19921222e2`: quattro misure del root1056–1216ms, una sola callback di interruzione, quasi tutto il tempo in `evalCode`, disposal complessivo<1ms. Ho letto il report, non eseguito il probe né verificato il suo strumento oltre ai dati forniti.
- `program-engine.ts:5,9–14,18,31`:16MiB heap,128KiB stack, deadline100ms cooperativa, cleanup nel finally. La documentazione installata di QuickJS descrive callback regolari dell’interprete, non una preemption a ogni millisecondo.

Il comportamento è compatibile con lavoro prolungato in un intrinsic nativo come `Array.fill`, prima del prossimo punto cooperativo. La localizzazione precisa dentro il codice C/WASM non è provata dal solo probe e non va presentata come tracing certificato. Le misure smentiscono invece l’ipotesi che il tempo osservato sia principalmente nel disposal.

## Correzione minima proposta

Separare un handshake di inizializzazione da ogni esecuzione guest. Il Worker inizializza soltanto WASM e conferma `ready`; la sessione mantiene15s esclusivamente per quel passaggio. Solo dopo un `ready` valido invia lo start con il watchdog2000ms; tutte le interazioni seguenti conservano2000ms. Restano invariati heap16MiB, stack128KiB, interruzione cooperativa100ms, output/messaggi, consenso, nonce e coda16.

Usare una readiness distinta e consumata una sola volta, legata al nonce della sessione. Non inviare body/stato prima della readiness. Un timeout va armato prima del postMessage per evitare race con risposte rapide. Dispatch prima di ready resta in coda limitata; lo start precede gli eventi accodati. Tick non devono eludere questa fase o consumare senza limite la coda mentre il motore si carica. Stop/errore/timeout rendono inerti ready e risultati tardivi.

Non basta togliere il confronto temporale dal test sincrono. Non aumentare2000ms, non ridurre il carico, non disattivare memoria o deadline. Imporre2000ms anche al download/compilazione WASM eliminerebbe invece il bootstrap15s esplicitamente ammesso e introdurrebbe regressioni su rete/macchine lente.

## Prove richieste senza indebolire il requisito

1. Test reale dell’engine: mantenere rifiuto dello snippet originale e avvio pulito successivo. Separare questa prova dal tempo di parete del thread sincrono. Una sola `toThrow` generica non distingue limite memoria da interruzione CPU: aggiungere allocazione singola oltre16MiB, con errore e ripresa, oppure una controprova equivalente che discrimini davvero la quota.
2. Test deterministici della sessione: nessun body inviato prima di ready; inizializzazione ancora viva a14999ms e terminata a15000ms senza ready; primo start e successivi eventi ancora vivi a1999ms e terminati a2000ms se pendenti. `terminate` e failure una sola volta; nessun onResult/aggiornamento stato.
3. Readiness errata, duplicata o tardiva non può accorciare, estendere o riaprire una sessione; errori durante init terminano; coda pre-ready e durante pending resta16; eventi seguono lo stato dell’ultimo risultato accettato.
4. E2E nello stesso Worker distribuito: aggiungere lo snippet originale alla batteria ostile, verificare stop/errore, editor ancora usabile, stato valido conservato e riavvio successivo. Timer fake prova il limite esatto; il browser prova il confine reale e la continuità. Non trasformare una misura end-to-end comprensiva di download in un limite di esecuzione guest.
5. Verify della correzione esatta, regressioni consumer pertinenti e CI sul nuovo commit pubblicato. Conservare CI113 e i probe; nessuna rietichettatura del precedente PASS locale o del FAIL remoto.

## Hash del sorgente diagnosticato

| File | SHA256 |
| --- | --- |
| program-engine.ts | `7e9dd872cb7421b58e13a863b57f586293bb81d13adef4b89ae540bfc3d4c3f7` |
| program-session.ts | `941d975d4077b0db45b3c5e484fc2576d96243544428560a24e10969fa79c389` |
| program-worker.ts | `c36ff441c068741160490c8839720e4a8208b3eccbce2465ea5e4c45f0e615dc` |
| program.test.ts | `0bb350da901f728b37b6a6ea279f62d6bd291bc730d88188f65701505e434201` |
| e2e/programs.spec.ts | `55486799599b2973f2e45bc9d59ff9f449458fbd50c37661becb2ffb33e0d207` |

Stato: **diagnosi completata; correzione e prove ancora da riesaminare**. Nessuna approvazione di merge/deploy o isolamento generale di terze parti.
