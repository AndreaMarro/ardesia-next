# Ardesia Next

Una sola applicazione, un solo Core e un solo Plugin Host. Rilascio applicativo limitato a preview Vercel protette. Il mandato del 29 ottobre autorizza la pubblicazione dei sorgenti su GitHub; la visibilità effettiva e gli eventuali passaggi di accesso ancora richiesti sono registrati in `operations/m3-environment.json`.

## Stato M3

Il codice introduce autenticazione applicativa, autorizzazioni server, persistenza PostgreSQL, assegnazioni e lavoro personale degli studenti. Il browser riceve proiezioni autorizzate e conserva soltanto navigazione e comandi ancora da confermare. Il plugin Molla ideale conserva il bundle firmato e il modello scientifico M1/M2.

**M3 rimane incompleto finché il percorso remoto non supera il gate.** Le prove con PostgreSQL locale non dimostrano continuità attraverso un servizio remoto. Neon Free è il candidato selezionato, con piano gratuito da confermare nell'account prima del provisioning. Il dashboard Vercel permette di gestire le variabili di Next, mentre il connettore continua a restituire 403. L'autorizzazione iniziale Neon e la conferma di accesso GitHub sono ancora richieste al titolare. Le osservazioni precise e i passi residui sono in [operations/m3-environment.json](operations/m3-environment.json).

La baseline M0–M2 accettata è conservata in [operations/baselines/m2](operations/baselines/m2), con commit `3c2738eef34b65cfbb7ee5451f8fc5e8e6bb610d` e [CI verificata](https://github.com/AndreaMarro/ardesia-next/actions/runs/40855723200). `npm run status` verifica quei report e li indica come baseline storica; non trasferisce il loro PASS al nuovo sorgente.

## Avvio

Node 24 e il lockfile incluso:

```sh
npm ci
npm run dev
```

Aprire `http://127.0.0.1:4173`. L'API usa `ARDESIA_DATABASE_URL`, con credenziale del ruolo PostgreSQL limitato `ardesia_next_runtime`. Senza configurazione il servizio dichiara l'indisponibilità e non crea un archivio locale alternativo. Il login richiede account già predisposti dall'operatore: la UI non sceglie ruolo o identità.

Per una build completa: `npm run build`, poi `npm run preview`. Le migrazioni e gli account non vengono creati durante una richiesta HTTP. [Server: provisioning, API, backup e ripristino](packages/server/README.md).

## Percorso docente e studenti

Il docente accede, crea uno spazio e una lezione, inserisce oggetti e attiva la Molla ideale attraverso verifica, installazione e consenso. **Assegna** autorizza un identificativo studente già esistente. Il docente può revocare l'accesso e consultare soltanto le evidenze che lo studente ha esplicitamente condiviso.

Lo studente accede con il proprio account, apre la lezione assegnata e concede le capacità richieste dal laboratorio. Note, tentativi e parametri appartengono al suo lavoro personale; gli ID della lezione, dell'oggetto e dell'istanza scientifica restano stabili. Un secondo login indipendente recupera il lavoro dal server. Le richieste dirette con ID conosciuti applicano le stesse autorizzazioni.

La UI distingue conferma, attesa, esito incerto e conflitto. Una risposta persa può essere ritentata con lo stesso comando e la stessa ricevuta; un conflitto richiede una scelta esplicita. Uscita e cambio account sospendono i runtime del plugin e rimuovono la proiezione visibile. Il recupero pendente resta separato per account.

## Dati precedenti

Gli snapshot browser v1/v2/v3 non vengono cancellati o associati automaticamente. La schermata account offre l'esportazione dei byte originali e un'importazione esplicita verso l'account autenticato, con conferma di proprietà. L'importazione crea un nuovo spazio, archivia l'originale, conserva ID, revisioni, provenienza e ricevute e respinge i duplicati anche con diversa formattazione JSON. Il consenso del dispositivo precedente deve essere rinnovato.

L'esportazione personale contiene solo la proiezione autorizzata. Il backup completo è un'operazione amministrativa separata, senza password o sessioni, e il ripristino richiede un database vuoto con identità predisposte coerenti.

## Verifiche riproducibili

Servono due database PostgreSQL locali dedicati. La CI li prepara come servizio effimero; i test falliscono se manca un database reale.

```sh
export M3_TEST_ADMIN_DATABASE_URL=postgresql://test_operator@127.0.0.1:5432/postgres
export M3_TEST_DATABASE_URL=postgresql://test_operator@127.0.0.1:5432/ardesia_m3_test
export M3_BROWSER_DATABASE_URL=postgresql://test_operator@127.0.0.1:5432/ardesia_m3_browser
node tools/setup-test-databases.mjs
npm run verify
npx playwright install chromium
npm run test:e2e
npm run status
```

Usare un operatore di test con `CREATEDB` e `CREATEROLE`. Le suite limitano il reset a database loopback con suffisso `_test` o `_browser`, e le richieste applicative usano un login PostgreSQL senza privilegi amministrativi. Le credenziali sintetiche vengono generate dal runner; le tracce browser che potrebbero registrarle sono disattivate.

`verify` conserva gli otto controlli esistenti, inclusi ricostruzione identica del plugin firmato e budget di **245.760 byte gzip per tutto il JavaScript distribuito**. Il report separa il grafo del caricamento iniziale dal codice differito, contando entrambi nel limite. Desktop e mobile sono emulazioni Chromium: non certificano dispositivi fisici.

La prova M3 richiede inoltre un report browser remoto, il database realmente remoto e configurato, tre identità applicative, sessioni indipendenti, controprove di sicurezza/recupero, CI e preview protetta sulla stessa SHA e impronta dei sorgenti. Un record mancante, obsoleto o riferito a un'altra build non produce `ACCEPTED`.

## Confini e rilascio

| Area | Responsabilità |
| --- | --- |
| `packages/core`, `packages/contracts` | Unico dominio, autorizzazioni, oggetti, lavoro personale, revisioni, eventi e ricevute |
| `packages/server` | Sessioni applicative, transazioni PostgreSQL, adapter Core, proiezioni autorizzate e operazioni amministrative |
| `packages/remote-client` | Facciata del Core remoto, conferme, ordine delle risposte e recupero dei comandi |
| `packages/lesson-os` | Proiezioni ricostruibili dagli eventi autorizzati |
| `packages/plugin-sdk`, `packages/plugin-host` | Contratti, firma, SHA-256, fiducia e ciclo di vita dello stesso plugin |
| `apps/web`, `server/m3.ts` | Unica UI e composizione dell'API same-origin |
| `tools`, `.github`, `operations` | Verifiche, CI, prove e stato generato |

La [decisione M3](docs/adr/0005-m3-remote-authority.md) descrive transazioni, isolamento e limiti. La [procedura di rilascio](docs/release-runbook.md) impone preview protetta, branch di preview e verifica della SHA effettiva. Nessuna produzione, dominio pubblico, bypass SSO, spesa o modifica del legacy è autorizzata da questa consegna.

Rollback: usare la precedente preview M2 verificata e revert delle PR interessate. Non eliminare dati remoti né migrare v4 all'indietro automaticamente; conservare backup e archivio degli import. M4/M5 e l'apertura del marketplace restano fuori perimetro.

La pubblicazione autorizzata del sorgente non introduce una licenza di riuso né autorizza un deployment applicativo pubblico. [Dipendenze e licenze](docs/dependencies.md); [criteri D01–D68](docs/acceptance/D01-D68.json) conservati senza attribuire un'accettazione prodotto non osservata.
