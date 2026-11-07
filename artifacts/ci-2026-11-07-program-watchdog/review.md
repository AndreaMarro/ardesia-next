# Review indipendente della correzione CI113

**PASS limitato alla patch e alle prove locali. Nessun finding aperto. CI del nuovo commit ancora NON VERIFICATA.**

Revisore `/root/board_review`, autore `/root`: contesti distinti. Il revisore ha letto sorgenti e prove, ricostruito gli hash e confrontato il diff; non ha eseguito test, avviato servizi, installato dipendenze, usato Git/remoti o modificato sorgenti/indice. Il limite read-only è istruttivo, non una ACL tecnica. Questa relazione non è un’approvazione umana scientifica/editoriale o un’accettazione del prodotto.

## Identità esatta

Candidato congelato: `0c4c2493f19cd14835d38c7d900725fae1ed4af0b2d03c3ae3b4f361f7e9fdee`, **430 file**, ricalcolato indipendentemente prima della chiusura. Verify, browser e build-info indicano tutti questa sorgente. Il campo commit dei report è la base `045fa205c5a0fad97fefa774fc6f0de8a87c1aed`, più working tree: non è il commit contenente la patch, che non è stato ancora osservato.

Il raw diff finale `work/ci-program-candidate.patch` ha SHA-256 `e0acaebaf79ac675ae408c24dac9eabe21312cdf6e413a760d95be2f9ec05a63`. L’autore lo ha prodotto contro HEAD045fa205; il revisore non ha usato Git. Tutti gli hunk corrispondono ai file attuali. Invertendo in memoria gli otto file si ricostruiscono **429 file** con digest `290f597d24ea4ef92769faab9b309069ed9e50dd2fd9f8b778c460e186b12c82`, identico alla precedente sorgente. Le cinque versioni originali di engine/session/worker/test/E2E corrispondono anche agli hash conservati nella diagnosi.

Perimetro: `program-limits.ts` nuovo, `program-engine.ts`, `program-session.ts`, `program-worker.ts`, `program.test.ts`, `e2e/programs.spec.ts`, ADR0017 e handoff del 7 novembre. Hash individuali e inventario delle prove sono in `ci-113-fix-review.json`.

## Diagnosi e correzione

La CI42403006290 sulla base045fa205 aveva **551/552** unitari passati. Lo snippet di allocazione generava correttamente l’errore guest, ma la durata sincrona di `executeProgram` era **2482,208066 ms > 2000 ms**. Quel test non avviava un Worker e quindi non misurava il suo watchdog. Il probe locale conservato riporta una callback di interruzione, 1056–1216 ms quasi interamente in evalCode e meno di1ms di teardown: è compatibile con lavoro nativo prolungato prima del controllo cooperativo, non è un tracciamento dei precisi internals C.

La lacuna distinta e reale era nel lifecycle: il primo evento riceveva15s insieme al bootstrap. La nuova sessione invia soltanto initialize+nonce, con timeout15s. Il Worker inizializza il motore e risponde ready con il nonce della sessione; solo allora il parent invia sorgente/stato/start con watchdog2s. Anche ogni evento successivo usa2s. Il bundle costruito contiene il controllo initialize/readiness/nonce corrispondente.

Non ho trovato un aumento di quote: heap16MiB, stack128KiB, interruzione cooperativa100ms, output131072byte, messaggio262144byte, watchdog2000ms, bootstrap15000ms e coda16 restano invariati. La condivisione delle costanti evita valori divergenti fra sessione e interprete.

I tick iniziano dopo ready/start; la coda accetta al massimo16 eventi anche durante il bootstrap. Il primo evento resta start e il successivo usa l’ultimo stato validato. Stop cancella timer/intervallo, nonce, pending e coda, rimuove i callback e termina il Worker una sola volta. Ack estranei, prematuri, duplicati o dopo stop non fanno ripartire la sessione. I nuovi test verificano i confini14999/15000ms e1999/2000ms, bootstrap lento con interval50ms, overflow al17° evento, errore di inizializzazione e risposta tardiva.

Lo stress originale `huge.push(new Array(100000).fill(123))` resta nel test dell’interprete e ora nel vero browser. È rimossa soltanto l’asserzione temporale al confine sbagliato per questo stress, sostituita dalle prove del watchdog della sessione. Il test di singola allocazione32MiB disabilita la callback cooperativa **solo sul runtime del test**, conserva il vero limite heap16MiB e verifica rifiuto più nuovo avvio valido. Nessun controllo di produzione viene disattivato.

## Prove locali effettivamente controllate

| Prova | Esito e confine |
| --- | --- |
| Verify |8/8, inclusi types con exit0 e build, sul digest esatto |
| Unitari |558/558, zero failed/pending;40/40 mirati al programma |
| Browser programmi |12/12, desktop Chromium e mobile emulato, prima esecuzione; zero skipped/unexpected/flaky/retry |
| Server/MCP |5/5 e15/15 nei report sul medesimo digest |
| Build runtime |5 asset verificati byte per byte contro gli hash; worker SHA-256 `629cf14bd0625c9e3cbace1534264941ff246ae0fe656c43937ca0d27d8cfe4e` |
| Binding report |Hash parsed-JSON di unit/e2e ricalcolati e coincidenti con i riepiloghi; build-info e430 file coincidenti |

Ho letto log e risultati grezzi prodotti dall’autore; non ho rieseguito le suite. I12 casi comprendono consenso, salvataggio/riapertura/export, codice ostile e ripresa, ACK perso/conflitto, revoca, isolamento fra lezioni con stessi ID e Worker indisponibile/vista nascosta. Il caso ostile conserva le asserzioni su editor utilizzabile, riavvio, viewport contenuto, assenza di richieste esterne/pageerror e successivo programma valido. L’esatta scadenza2s è provata deterministicamente nella sessione; il browser prova l’integrazione reale, senza una certificazione realtime della durata su qualsiasi dispositivo.

Toolchain osservata: Vitest5.0.5, Vite8.3.5, Playwright1.56.1, QuickJS0.32.0; server e MCP dichiarano Node24.22.1. `work/ci-program-typecheck.log` è vuoto e da solo non prova un exit code; la prova tipi è il check types del Verify. I log contengono un warning Vite sulla porta WebSocket24678 già occupata, ma gli esiti finali e tutti i test indicati sono passati. Le copie conservate del pacchetto CI113 coincidono byte per byte con i report/log letti.

## Stato non trasferibile e gate aperti

Il vecchio log CI e il probe restano conservati con i loro hash: rispettivamente `ff64b4f4ec05633169e33372bdee62a8c3391d4145f7e12aa7bc61db72e8de81` e `2a9f910c0a364a4f6cf6c0c02ff81db780e4a7a4223f23381e1c4c19921222e2`. La diagnosi precedente ha SHA-256 `246e821bb422a75c9d3ef048ff2f3a3f476eb678bf37926445c8204c613f6d9e`.

Restano da associare il commit effettivamente pubblicato a questi byte e da osservare il suo Verify/insieme completo di prove browser in CI. **Questo PASS locale non è un PASS CI.** I191 browser e42 passi REA della precedente sorgente290f597d… non sono attribuiti al nuovo digest. Non sono dichiarate certificazione generale dell’isolamento, garanzie hardware realtime, prove su dispositivi fisici/Safari/iPad/Pencil, merge o deploy. Prodotto **NOT_COMPLETE**; distribuzione **NOT_VERIFIED_FOR_CURRENT_COMMIT**.
