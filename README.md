# Ardesia Next

Una sola applicazione, un solo Core e un solo Plugin Host. Questo candidato integra il client remoto di PR2 con la UI e con l'API Node compilata. Il server autentica gli account, applica i comandi del Core in transazioni PostgreSQL e restituisce soltanto proiezioni autorizzate.

## Avvio e configurazione

Usare Node 24 e il lockfile incluso:

```sh
npm ci
npm run dev
```

La UI e `/api/m3` sono disponibili allo stesso origin, `http://127.0.0.1:4173`. Configurare `ARDESIA_DATABASE_URL` con una credenziale del ruolo PostgreSQL runtime limitato. Il database deve essere migrato e gli account predisposti dall'operatore prima dell'avvio. Senza configurazione il servizio dichiara l'indisponibilità; la UI permette comunque di esportare gli originali locali precedenti. [API, provisioning, migrazioni, backup e ripristino](packages/server/README.md).

`npm run build` produce gli statici e una Function Node 24 con package workspace, driver PostgreSQL e asset del Worker firmato già inclusi. Il risultato usa Build Output API v3; il runtime non richiede un loader TypeScript o Vite. `npm run preview` avvia il server locale della build. In una preview configurata, `ARDESIA_APP_ORIGIN` oppure l'URL Vercel determina l'origin autorizzato.

## Comportamento della UI

Il docente accede con un account predisposto, crea uno spazio e una lezione, modifica gli stessi oggetti in lavagna, taccuino e lettura, e assegna la lezione a identificativi studente esistenti. Il laboratorio richiede verifica del rilascio, installazione, consenso e attivazione. Il contenuto resta una bozza.

Lo studente apre le lezioni assegnate e concede il proprio consenso alla release del laboratorio. Note, tentativi e parametri appartengono al suo lavoro personale. Il docente può leggerli soltanto dopo una condivisione esplicita e revocabile. L'accesso assegnato può essere revocato dal docente.

La UI distingue salvataggio confermato, attesa, esito incerto e conflitto. Una bozza mantiene la sua base quando arriva un aggiornamento; un contenuto concorrente non viene sovrascritto usando automaticamente la revisione più recente. Le bozze di oggetti rimossi restano disponibili fino allo scarto esplicito. La revoca del consenso arresta il Worker e conserva i parametri locali ancora da salvare. I comandi pendenti sono separati per account e possono essere ritentati con ID e payload originali. [Contratto del client e recupero](packages/remote-client/README.md).

Gli snapshot locali v1/v2/v3 non vengono importati o cancellati automaticamente. L'importazione richiede una conferma di proprietà e dell'account destinatario, crea uno spazio separato e conserva l'originale e lo storico. I consensi precedenti devono essere rinnovati. L'export personale contiene soltanto dati autorizzati; il backup amministrativo è un'operazione distinta.

## Verifiche locali

I test usano PostgreSQL reale su database loopback dedicati. Servono un operatore di test con `CREATEDB` e `CREATEROLE`, un database con suffisso `_test` e uno con suffisso `_browser`:

```sh
export M3_TEST_ADMIN_DATABASE_URL=postgresql://test_operator@127.0.0.1:5432/postgres
export M3_TEST_DATABASE_URL=postgresql://test_operator@127.0.0.1:5432/ardesia_m3_test
export M3_BROWSER_DATABASE_URL=postgresql://test_operator@127.0.0.1:5432/ardesia_m3_browser
node tools/setup-test-databases.mjs
npm run verify
npx playwright install chromium
npm run test:e2e
```

`verify` mantiene otto controlli, include una prova della Function compilata con Node nativo e PostgreSQL isolato, verifica la ricostruzione del Worker firmato e applica il limite di **245.760 byte gzip a tutto il JavaScript distribuito**. Il grafo iniziale e il codice differito sono misurati separatamente ma contano entrambi nel limite.

La suite browser comprende le **51 prove M0–M2 adattate al server** e **sei prove degli editor concorrenti**, sui progetti Chromium desktop e mobile. Il runner genera credenziali sintetiche; le richieste attraversano l'API reale. Le controprove e le sostituzioni dei precedenti controlli locali sono documentate in [e2e/README.md](e2e/README.md). Le tracce browser sono disattivate per evitare di registrare credenziali. Le viewport emulate non costituiscono una verifica su dispositivi fisici.

## Stato dell'integrazione e limiti

**L'accettazione remota M3 resta incompleta.** Le prove locali non attestano una preview collegata a un servizio remoto. Il tentativo di creare un database Supabase dedicato gratuito è stato bloccato dal limite dei due progetti già attivi; la connessione Vercel non dispone del permesso necessario per accedere alle variabili del progetto. Nessuna risorsa esistente viene riutilizzata o modificata per aggirare questi blocchi.

PR4 raccoglierà il percorso completo con docente e due studenti in sessioni indipendenti, le controprove browser di continuità e recupero e i gate di accettazione M3. Questo candidato include la UI e il consumer API, senza dichiarare quei gate superati. Gli strumenti di stato M0–M2 rimangono quelli della baseline fino a quell'integrazione.

Rilascio limitato a preview protette, con CI sulla SHA effettiva. Nessuna produzione, spesa, bypass di protezione o modifica del repository legacy è inclusa. Per il rollback conservare backup e originali importati, ripristinare il candidato precedente verificato e non migrare automaticamente gli snapshot v4 all'indietro.
