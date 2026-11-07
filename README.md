# Ardesia Next

> Continuazione del nucleo: [cinque corsi, continuità, conoscenza e MCP](docs/handoffs/core-continuity-2026-11-07.md).

> Consegna applicativa precedente del 7 novembre: [handoff oggettivo](docs/handoffs/2026-11-07.md). Distingue candidato, main, procedura, preview e accettazione; non modifica il cursore né retrodata le prove.


Una sola applicazione, un solo Core e un solo Plugin Host. Rilascio applicativo limitato a preview Vercel protette. Il mandato del 29 ottobre autorizza la pubblicazione dei sorgenti su GitHub; la visibilità effettiva e gli eventuali passaggi di accesso ancora richiesti sono registrati in `operations/m3-environment.json`.

**Riprendere il lavoro:** [ingresso operativo](docs/START_HERE.md), [coda e blocchi](operations/coordination.json), [manuale agenti e procedure](docs/operations.md), [mappa del prodotto](docs/product-map.md), [storico](docs/history.md). Repository osservata pubblica il 31 ottobre; i record infrastrutturali datati conservano la storia. `node tools/check-operations.mjs --brief` genera un handoff breve senza accettare milestone.

## Stato M3

Il codice introduce autenticazione applicativa, autorizzazioni server, persistenza PostgreSQL, assegnazioni e lavoro personale degli studenti. Il browser riceve proiezioni autorizzate e conserva navigazione, comandi da confermare e, su scelta esplicita, una copia ridotta delle lezioni personali per la scrittura offline. Il plugin Molla ideale conserva il bundle firmato e il modello scientifico M1/M2.

**M3 rimane incompleto finché il percorso remoto non supera il gate.** Le prove con PostgreSQL locale non dimostrano continuità attraverso un servizio remoto. [L'osservazione del 30 ottobre](operations/m3-environment.json) registra Neon già configurato e tre account sintetici; non ripetere il provisioning da un vecchio handoff. Il runner completo esiste in `tools/m3-acceptance.mjs`. Nell'ultimo handoff del 31 ottobre restano non disponibili/verificati il canale OIDC del runner, le credenziali QA e il restore remoto sicuro. [Issue M3](https://github.com/AndreaMarro/ardesia-next/issues/19) e [ingresso corrente](docs/START_HERE.md) distinguono questa disponibilità dall'esistenza del servizio. Main e staging rimangono congelati, su revisioni differenti finché il percorso protetto del runbook consente il riallineamento.

La baseline M0–M2 accettata è conservata in [operations/baselines/m2](operations/baselines/m2), con commit `3c2738eef34b65cfbb7ee5451f8fc5e8e6bb610d` e [CI verificata](https://github.com/AndreaMarro/ardesia-next/actions/runs/40855723200). `npm run status` verifica quei report e li indica come baseline storica; non trasferisce il loro PASS al nuovo sorgente.

## Avvio

Node 24 e il lockfile incluso:

```sh
npm ci
npm run dev
```

Aprire `http://127.0.0.1:4173`. L'API usa `ARDESIA_DATABASE_URL`, con credenziale del ruolo PostgreSQL limitato `ardesia_next_runtime`. Senza configurazione il servizio dichiara l'indisponibilità e non crea un archivio locale alternativo. Il login richiede account già predisposti dall'operatore: la UI non sceglie ruolo o identità.

Per una build completa: `npm run build`, poi `npm run preview`. Le migrazioni e gli account non vengono creati durante una richiesta HTTP. [Server: provisioning, API, backup e ripristino](packages/server/README.md).

## Continuità offline locale

Nella build compilata: **Impostazioni → Rendi disponibile offline → Usa copia offline**. Scrivi a penna, chiudi e riapri la stessa origin senza rete; i tratti restano da confermare. **Ricollegati al server**, poi riprendi esplicitamente le modifiche. La rete assente non chiude un editor con una bozza; il cambio di modalità verifica le modifiche non salvate. Copia e tratti sono esportabili dalla vista offline.

Sono incluse solo le lezioni possedute dall’account nello spazio preparato, con note e formule consultabili. Moduli, assegnazioni e dati degli studenti richiedono accesso online. [Contratto, prove richieste e limiti](docs/adr/0010-own-lessons-offline.md). Questa preparazione locale non certifica Safari, Apple Pencil o sincronizzazione concorrente fra dispositivi.

## Studio e Creator locale

La lavagna mantiene strumenti contestuali, inquadratura e un dock dedicato alla scrittura. **Crea → Crea un oggetto** apre composizione, anteprima e proprietà: inventa un tipo, combina controlli, risultati, grafici e scene, provalo e salvalo nella lezione. **Modifica struttura** produce una nuova versione; import/export conserva definizione, licenza e provenienza. Lo stesso formato è creabile tramite MCP. [Contratto aperto, migrazione e limiti](docs/adr/0015-open-creator-studio.md) · [Fonti e analisi REA](docs/sources/creator-studio-2026-11-07.md). Non è ancora esecuzione universale di codice terzo o publishing commerciale.

## MCP Core locale

Il [nuovo adapter stdio](packages/mcp-core/README.md) permette a un client MCP di cercare lezioni autorizzate, leggere revisioni esatte e, con scrittura esplicitamente abilitata, preparare/applicare gli stessi comandi del Core. Sessione privata, scope degli spazi, provenienza, DRAFT e ricevute restano verificati. `npm run build:mcp` produce il CLI autonomo; la guida include configurazione, revoca e recupero dopo risposta incerta. Nessuna inferenza AI o distribuzione remota richiesta. Questo percorso locale non certifica ancora host ChatGPT/Claude/Gemini o MCP cloud.

## Creazione personale e percorso didattico

Ogni account, anche studente, crea spazi e lezioni propri attraverso **Account e spazi**. La Home distingue i progetti personali dagli spazi condivisi. Lavagna, Creator, moduli con consenso, audio, corsi personali, copia offline e MCP usano la proprietà dello spazio e conservano il ruolo autentico. Il docente accede, crea uno spazio e una lezione, inserisce oggetti e attiva la Molla ideale attraverso verifica, installazione e consenso. **Assegna** autorizza un identificativo studente già esistente. Il docente può revocare l'accesso e consultare soltanto le evidenze che lo studente ha esplicitamente condiviso.

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

`verify` conserva gli otto controlli esistenti, inclusi ricostruzione identica del plugin firmato e budget di **311.296 byte gzip per il nucleo complessivo**, **245.760 per il JavaScript iniziale** e **327.680 gzip / 1.048.576 raw per il runtime opzionale**, incluso WASM; il PDF differito comprende anche worker/font/CMap e mantiene i propri limiti. Il vecchio limite Core278.528 è superato e il confronto rimane visibile nel report ([motivazione misurata](docs/adr/0021-core-continuity.md)). Il report conserva il costo totale, il confronto con la precedente soglia su tutto il JavaScript e il grafo iniziale/differito; nessun asset preesistente è riclassificato. [Decisione](docs/adr/0017-programmable-creator.md). Desktop e mobile sono emulazioni Chromium: non certificano dispositivi fisici.

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

Rollback: verificare prima compatibilità dello schema PostgreSQL e dei record di recupero client v2; un vecchio client non legge automaticamente le nuove chiavi. Seguire il [runbook](docs/release-runbook.md), conservare intenti/export, backup e archivio degli import. Un revert del codice non ripristina dati o intenti e non autorizza il downgrade automatico a M2. M4/M5 e l'apertura del marketplace restano fuori perimetro.

La pubblicazione autorizzata del sorgente non introduce una licenza di riuso né autorizza un deployment applicativo pubblico. [Dipendenze e licenze](docs/dependencies.md); [criteri D01–D68](docs/acceptance/D01-D68.json) conservati senza attribuire un'accettazione prodotto non osservata.

## Procedure ricorrenti Pro e Codex

Il [protocollo a due ruoli](docs/recurring-work.md) include i [prompt Pro](docs/prompts/pro-cycle.md) e [Codex GPT-6.1 Sol Max](docs/prompts/codex-cycle.md), il passaggio di consegne verificato e il budget operativo. Preparazione non equivale ad attivazione: nessuna attività viene creata o modificata da questi file.


## Audio personale e replay — preparazione locale

Nella lezione, **Audio e replay** registra la spiegazione insieme ai tratti, conserva frammenti locali e carica esplicitamente sullo stesso PostgreSQL. Riapri per ascoltare, cercare nelle trascrizioni manuali/importate e tornare alla revisione e al tempo esatti. [Uso, privacy, migrazione002, recovery e limiti](docs/adr/0012-personal-recordings.md). Nessun provider AI o test fisico implicito; i report di ogni candidato restano distinti.

## Corsi e studio personale

**Corsi** apre il laboratorio dei percorsi: crea una bozza da zero o parti dall’unità originale sulla molla, salva e fissa un’edizione. Puoi assegnarla a un account studente oppure iniziare il tuo studio personale. Risposte, aiuti e fase corrente si ritrovano alla riapertura; gli aiuti non cancellano il testo aperto. Le risposte restano private finché non vengono condivise. La revoca toglie il materiale e conserva le proprie risposte esportabili.

Le lezioni collegate sono fissate a una revisione esatta, senza assegnare automaticamente la lezione o eseguire lab. Lo stesso authoring passa dal MCP Core. Contenuti sempre DRAFT, senza voti automatici; corsi offline e marketplace commerciale restano da completare. [Identità, migrazione e limiti](docs/adr/0016-versioned-courses.md) · [Patrimonio e REA](docs/sources/courses-2026-11-07.md).

## Programmi inventati dagli utenti

Creator aggiunge **Crea un programma**: codice, anteprima con avvio esplicito, stato salvabile, nuove versioni e file portabile. Il codice puro gira in QuickJS isolato e restituisce una vista HTML/SVG verificata; il Core conserva identità, licenze e storia. Lo stesso artefatto si crea via MCP, senza avvio implicito. [Guida e ABI](docs/programs.md) · [Scelta e limiti](docs/adr/0017-programmable-creator.md).


## Cinque percorsi di Fisica e conoscenza personale

**Corsi → Fisica** importa uno dei cinque microcorsi del semestre filtro2026/2027 come lezioni e oggetti modificabili nel proprio spazio. Ogni percorso collega spiegazione, previsione, indagine, recupero, trasferimento, quesiti e verifiche a revisioni reali. Fissa un’edizione e scegli **Inizia il mio percorso**; dentro un’unità, **Apri materiali della lezione** rende disponibili laboratori e domande con risposta riferita alla versione esatta. Una importazione interrotta riprende dopo la conferma del comando pendente. Le lezioni già modificate non vengono sovrascritte. Tutti i contenuti rimangono DRAFT. [Fonti e copertura](docs/sources/physics-2026-27/README.md).

**Crea → Esplora i laboratori di fisica** offre15modelli manipolabili e riutilizzabili. **Idee** cerca nel patrimonio autorizzato, crea concept-link come oggetti Creator e mostra backlink e una mappa navigabile. **Tutor → Conti** distingue compensi maturati, costi sostenuti, tempo di preparazione e incassi per valuta; i dati mancanti sono indicati, non inventati.

Sul Mac disponibile sono eseguite prove browser/PostgreSQL; viewport mobile, campioni sintetici e client SDK non equivalgono a iPad/Pencil, parlato o host AI reali. [Limiti e prossimo passo](docs/handoffs/core-continuity-2026-11-07.md).
