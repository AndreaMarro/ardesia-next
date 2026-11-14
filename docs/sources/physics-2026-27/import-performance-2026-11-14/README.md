# Importazione C2 — costo della migrazione su snapshot già correnti

**Risultato: candidato piccolo con beneficio misurato, senza modificare comandi, revisioni o validazioni correnti.** Nel benchmark Core + MemoryStorage, la mediana scende da **5884,96 ms a 4077,25 ms**, riduzione **30,72%**. Questo non è ancora un miglioramento del 30,72% misurato nell'app: HTTP, PostgreSQL, proiezioni del server, controllo del pacchetto nell'importatore e rendering non sono compresi.

Consegna isolata: **`candidate-with-tests.patch`**, che contiene tre righe di implementazione e il rafforzamento di test esistenti. `candidate.patch` contiene soltanto l'implementazione già sottoposta a review indipendente. Nessun file del repository condiviso è stato modificato da questo audit.

## Perché costa

Il benchmark esistente `tools/benchmark-physics-import.mjs` riapre Core per ciascuno dei 145 comandi di C2: 5 creazioni, 139 aggiunte e 1 salvataggio del corso. Il profilo Node ha confermato che la riapertura assorbe circa 4,07 dei 5,88 secondi della baseline. L'esecuzione dei comandi richiede circa 1,82 secondi.

`migrateSnapshotForOpen` non aveva un ritorno immediato per gli snapshot correnti v11. Dopo aver saltato le condizioni v4–v10, tentava `LegacySnapshotSchema.safeParse` per v1/v2 e poi `MarketplaceSnapshotV3Schema.safeParse` per v3. I parser attraversano anche documenti, payload e definizioni extension prima di concludere che la versione è incompatibile. La funzione restituisce infine lo stesso input; subito dopo il chiamante esegue comunque `CoreSnapshotSchema.safeParse`.

Il profilo campionato attribuisce **1830,70 ms** al percorso di migrazione, circa **30,66%** dei campioni. Una seconda misura diretta della funzione invariata, sui **144 snapshot non vuoti realmente letti durante C2**, misura **1882,25 ms** complessivi e verifica che ogni chiamata restituisce esattamente lo stesso riferimento senza mutare i byte. Quest'ultima è diagnostica con una chiamata aggiuntiva per ogni lettura, non una misura dell'importazione ottimizzata.

La clonazione strutturata compare per circa 815 ms nei campioni esclusivi; i contatori strumentati misurano circa 841 ms fra apertura ed esecuzione. Non è stata rimossa: protegge i confini fra chiamante, storage, stato e comandi. I tempi storage e clone si sovrappongono e non vanno sommati. Il profilo individua anche `isExtensionJson` come grande consumatore aggregato; le validazioni di contenuto rimangono attive.

## Il candidato

All'inizio della funzione di migrazione viene restituito l'input soltanto se è un oggetto e una **proprietà propria di dati** `schemaVersion` contiene esattamente il numero `SNAPSHOT_VERSION` (oggi 11). Si usa `Object.getOwnPropertyDescriptor(...).value`:

- nessuna conversione di stringhe, numeri boxed o altre versioni;
- nessun accesso aggiuntivo al getter della versione;
- versioni ereditate o accessor seguono il percorso esistente;
- l'input non viene dichiarato valido, normalizzato, clonato o scritto dalla migrazione;
- i rami delle versioni precedenti restano identici.

Tutti i quattro chiamanti produttivi applicano ancora la validazione completa: Core, `server/store`, `server/backup` tramite preprocessore e `server/legacy-import`. Nel Core restano anche `validateExtensionDefinitions`, `validateCourseHistory`, `validateTutorHistory`, `validateNotebookHistory`, oltre alla validazione dei comandi e del commit. Il server mantiene controlli di accesso, binding e transazione.

Non sono cambiati numero e ordine dei comandi, identificatori idempotenti, revisioni N+1, fingerprint, eventi, ricevute, modelli di persistenza o cronologia. Non è stato introdotto un comando bulk, una cache globale o un riuso del Core fra transazioni.

## Confronto riproducibile

Apple M4, macOS/arm64, **Node v24.22.1** da `/Users/progettibelli/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`. Entrambe le implementazioni sono compilate con Vite e dipendenze incluse; il candidato cambia soltanto il contratto locale attraverso un alias di build. `compare.mjs` riusa il corpo del benchmark esistente contro i due moduli congelati. Un warm-up per implementazione, poi tre misure ciascuna con ordine alternato.

| Implementazione | Campione 1 | Campione 2 | Campione 3 | Mediana |
|---|---:|---:|---:|---:|
| Baseline | 5786,20 ms | 5884,96 ms | 5960,75 ms | 5884,96 ms |
| Candidato | 4058,05 ms | 4078,87 ms | 4077,25 ms | 4077,25 ms |

L'apertura mediana passa da circa **4066,24 ms a 2239,18 ms**; l'esecuzione mediana resta circa **1818,55/1823,43 ms**. L'intervento agisce quindi dove indicava il profilo, senza attribuire il beneficio a comandi saltati.

Fixture C2: SHA-256 `67917bd5b7d8c29509f94da51166cbcfda1c5156eeb0a392098aa6365944fbe0`, 139 oggetti/145 comandi. Tutti gli **otto run**, compresi i warm-up, producono snapshot identici con SHA-256 **`df5345d75a3a4e0ffbba7a41261c170c49838fe58a667fd193bbe36da5f1c2d0`**. Il benchmark verifica inoltre riapertura e retry idempotente della creazione iniziale e del salvataggio del corso. Non viene riutilizzato come baseline il vecchio dato Linux del 13 novembre.

Identità:

- `packages/contracts/src/index.ts` baseline: `789f4fbb35d99f631bfbd38d3ddbfe275e3722e0887fae6c97371de1c484459c`.
- Stessa sorgente candidata: `885cce9eeaff9ea0ae0b44a80a91f8e68f494a9d01a517bfc30a38128979d4ce`.
- Modulo baseline: `25ecb164b34aa11b324ebf9df37141f32f83d98c0a6891816a228f4a0c472914`.
- Modulo candidato: `95becc675be0447eb3e36d3537562099e1c8e4b71ec2c46334f2850967a6e470`.

## Verifiche e review

**34 casi simmetrici baseline/candidato PASS** in `migration-equivalence.json`: corrente valido, campi mancanti/sconosciuti, revisioni e ricevute incoerenti, digest extension alterato pur con schema accettabile, contenuto storico danneggiato, v1–v10 vuoti validi, v1–v10 contraffatti rinominando la versione corrente, tipi di versione non validi, getter e versione ereditata. Il caso `null` è correttamente distinto: nello storage Core significa nuovo spazio vuoto, mentre non è uno snapshot valido per il parser. In entrambi i moduli questo comportamento rimane uguale.

I test permanenti riusano le suite del repository:

- `core.test.ts`, caso «rejects partial persistence with a missing receipt or an unbacked revision»: i due snapshot v11 invalidi passano ora nel vero `createCore`, che deve rifiutarli con **zero scritture** e byte iniziali invariati.
- `extensions.test.ts`, casi già presenti per hash alterato, stato extension storico invalido e definizione rimossa manomessa: rafforzati con la stessa verifica di **zero scritture e immutabilità dell'input corrente v11**. Non sono duplicate le fixture di definizione extension.

**27/27 test PASS** nelle due suite, eseguite in copia isolata con Vitest 5.0.5 e Node24, alias verso il contratto candidato. Nessun timeout aumentato, nessuna asserzione temporale aggiunta. Le suite storiche del repository restano necessarie nel normale Verify del coordinatore; la prova locale non sostituisce il collaudo completo.

Review indipendente di `/root/deadline_guard`: **PASS**, nessun bypass individuato. Ha letto raw diff e quattro chiamanti, verificato gli hash e ricalcolato il benchmark; ha eseguito autonomamente **56 controcasi simmetrici più 3 casi getter**, includendo array, proprietà nascoste/ereditate, prototipi nulli e oggetti congelati. Evidenze in `work/import-performance-independent/`. La review non sostiene equivalenza universale degli effetti collaterali di Proxy JavaScript ostili: il confine prestazionale rilevante è JSON/JSONB serializzato.

Due errori iniziali del solo harness d'autore sono stati corretti prima della prova finale: aggiungere direttamente un'extension C2 senza le sue fonti violava `INVALID_REFERENCE`, quindi la fixture ora esegue il prefisso reale del documento; il caso storage `null` era inizialmente classificato erroneamente come apertura da rifiutare. Nessuno dei due era una regressione del candidato. Le 34 verifiche finali e i 27 test permanenti passano.

## Consegna e limiti

Il coordinatore può integrare **`candidate-with-tests.patch`** dopo i suoi controlli. La modifica di implementazione resta identica alla delta di tre righe reviewata; i test successivamente aggiunti non cambiano il modulo misurato. Rollback: rimuovere il guard; nessuna migrazione dei dati necessaria.

Artefatti principali: `comparison.json`/`compare.mjs` per il confronto; `import.cpuprofile` e `cpu-*.json` per campioni CPU; `profile-results.json` per apertura/esecuzione/clone; `migration-cost.json` per il costo isolato della migrazione invariata; `migration-equivalence.json`; `vitest.log`; patch e hash in `manifest.json`. I bundle e le copie sorgente sotto `candidate/` sono intermedi dell'audit, non nuovi file di prodotto.

Non sono state effettuate richieste di rete o operazioni su database di produzione. Il root misurerà separatamente il percorso browser/server prima di attribuire un beneficio all'esperienza completa. Gli altri costi — trasporto, JSONB, proiezioni, numero delle richieste — non sono stati alterati o valutati da questo candidato.


## Integrazione e percorso browser

Il coordinatore ha applicato il candidato al checkout condiviso e completato Verify8/8,699unit,server5,MCP16. Il test esistente `e2e/physics-start.spec.ts` è stato eseguito tre volte prima e tre dopo: avvio C2, risposta privata salvata, reload e ripresa senza duplicare edizione/consegna. Browser Chromium desktop, PostgreSQL isolato e Node24 sullo stesso Mac. Durate baseline36.575/36.463/37.707ms; candidato32.547/32.472/32.467ms; mediane36.575→32.472ms, **−11,22%**. Tutti sei tentativi PASS. Questo misura l'intero test, non solo importazione o time-to-interactive. Ordine sequenziale prima/dopo, Mac condiviso, campione piccolo: non è una promessa di prestazioni remote o un esperimento hardware isolato. JSON e hash dei report originali in `browser-comparison.json`.

I percorsi `work/…` sopra identificano gli intermedi locali della sessione, non file inclusi in questa cartella. La patch integrata è nei contratti e nei test Core; il rapporto dell'autore resta congelato come ricevuta, compresi i limiti precedenti all'integrazione.
