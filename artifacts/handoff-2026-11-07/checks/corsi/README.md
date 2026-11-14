# Verifiche — Studio dei corsi

Incremento locale sulla base `f7adf5db02913e25fbab0b1da071f650b4f78676`, sorgente `081188333e269835da397aeed2959ce7a80f3d72552f1893c167f19f895f5458`. Branch locale `codex/lavagna-continuity-20261107`, modifiche non committate. Nessun deploy o accettazione globale.

| Prova | Esito |
|---|---|
| [Verify](verification.json) | 8/8 PASS |
| [Unitari](unit.json) | 485 PASS, 0 falliti/pending |
| [Browser](browser-evidence.json), [raw](e2e.json) | 151 PASS, 0 saltati/instabili/falliti, desktop e mobile Chromium |
| [Server](server-runtime.json) | 5/5, Node reale, PostgreSQL limitato, Worker firmato |
| [MCP](mcp-runtime.json) | 11/11, client ufficiale esterno, stdio, HTTP/PostgreSQL |
| [Budget](budget.json) | 243286/245760 byte JavaScript gzip, include differiti/plugin |
| [Stato canonico](status.json) | Prove locali PASS, prodotto NOT_COMPLETE, deploy non verificato per questa sorgente |
| [Migrazione preview](preview-migration.json) | SQL 005/migration 5, workspace prima/dopo identico prima delle nuove scritture |
| [Review indipendente](review-indipendente.md) | Favorevole per l’incremento locale, contesto separato, sola lettura; perimetro e limiti nel [verbale](review-indipendente.json) |

Copertura: autore senza lezione, bozza/edizione/revisioni esatte, self-study e assegnazione, materiali storici senza grant lab implicito, privacy/condivisione/revoca/export, aiuti con risposta aperta, ACK perso e retry identico, autore concorrente senza rebase silenzioso, cursore concorrente senza cambiare domanda, risposta tardiva cross-domain senza ripristinare materiale revocato. La regressione comprende lavagna, offline, audio, feedback, Creator, dispense e plugin preesistenti.

[Mac manuale](manuale-mac.json) e [REA](../../rea-evidence/corsi/README.md) sono prove distinte. Le catture di rilascio 081188 rileggono unità/fase/risposta in due nuove istanze browser; il flusso di creazione dd3 e il suo primo reload fallito rimangono attribuiti alla sorgente precedente.

## Fallimenti conservati

[Prima regressione completa dd3](intermedi/dd3/e2e.log): 149 PASS/2 FAIL nel collector login. [Contatori osservati](login-budget-dd3.json): B 13/A 9 per progetto, limite 12/900 s. Il test corsi ora usa l’account A sintetico già previsto; nessuna modifica ad autenticazione, limite o collector. Screenshot/report originali in `intermedi/dd3/`. Sono conservati anche i log iniziali delle fixture/migrazioni e typecheck, distinti dalle prove finali.

Review read-only separata da autore/test runner: sette controesempi sostanziali corretti prima della consegna, più contesto nell’export non inviato. Il controllo sorgente/hash non è una prova di esperienza con utenti reali o di efficacia didattica.

## Riproduzione e limiti

Node 24.22.1, macOS 15.6, PostgreSQL 16 loopback, account sintetici isolati, retries browser 0. I comandi di progetto sono `npm run verify`, `npm run test:e2e`, `npm run status`; le variabili DB/account sono configurate fuori dal repository. Preview e DB test sono separati. [Contratto e rollback](../../ardesia-next/docs/adr/0016-versioned-courses.md).

[Patch](consegna.patch), [esito](esito-consegna.json), [hash sorgenti](source-files.json), [manifest](manifest.json). La patch include gli incrementi precedenti dalla base; [patch Studio/Creator precedente](consegna-precedente/ardesia-next.patch) conservata. `git diff --check` e applicazione inversa controllano la patch corrente.

Non attestati: revisione umana, efficacia didattica, iPad/Pencil/Safari fisici, app native, host AI commerciali, corsi offline, authoring learner generale, scala elevata, collaborazione simultanea e piattaforma commerciale completa. Nessun voto/mastery/approvazione prodotto inventati.
