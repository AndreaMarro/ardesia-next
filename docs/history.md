# Storico canonico — Ardesia Next

Registro append-only delle decisioni e dei risultati materiali. Non sostituisce Git, le PR, gli artefatti originali o `tools/status.mjs`; li indicizza. La fotografia corrente e il lavoro eleggibile sono in [coordination.json](../operations/coordination.json). Le cause/prevenzioni sono indicizzate nelle [lezioni](lessons.md). Non creare un secondo RUNLOG.

Ogni nuova voce conserva data, origine, decisione/fatto, prova, ambito e prossimo passo. Una correzione aggiunge una voce con `supersedes`; non cancella FAIL, limiti o decisioni passate. I dati delle chat sono fonti di mandato, non attestazioni di esecuzione.

## Indice storico essenziale

| Periodo | Evento | Fonte e limite |
| --- | --- | --- |
| Fino al 28 ottobre | Legacy con patrimonio scientifico, lezioni, prototipi e incidenti; rimozione eLab, consolidamento visione | [Indice canonico legacy](https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/docs/CANON-INDEX.md), [RUNLOG](https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/docs/ops/ARDESIA-RUNLOG.md). Solo lettura, nessun PASS trasferito a Next |
| 29 ottobre | M0 indipendente; Core/Plugin Host; Molla e marketplace minimo M1/M2 | [Baseline M2](../operations/baselines/m2/status.json), [M1](m1-delivery.md), [M2](m2-delivery.md). Accettazione delle rispettive revisioni, non prodotto completo |
| 29–30 ottobre | Backend M3 e autorizzazione alla pubblicazione del solo sorgente; poi Neon e tre account configurati | [ADR M3](adr/0005-m3-remote-authority.md), [osservazioni datate](../operations/m3-environment.json). Infrastruttura non equivale a prova completa |
| 30–31 ottobre | Separazione target locale/remoto, preflight protetto e controprove | [PR #14](https://github.com/AndreaMarro/ardesia-next/pull/14), [#15](https://github.com/AndreaMarro/ardesia-next/pull/15), [runbook](release-runbook.md) |
| 31 ottobre | PR #16 integrata: coda fail-closed, recupero per comando/account e protezione multi-tab | [Merge 03622b56](https://github.com/AndreaMarro/ardesia-next/commit/03622b56c9756225019b7c6219d226beef8e0a6d), [CI merge](https://github.com/AndreaMarro/ardesia-next/actions/runs/41211757548). Staging ancora sulla precedente SHA; recovery v2 richiede rollback compatibile |
| 31 ottobre | PR #18: benchmark penna e report con campioni, modalità estesa | [PR #18](https://github.com/AndreaMarro/ardesia-next/pull/18), [Verify](https://github.com/AndreaMarro/ardesia-next/actions/runs/41216361836), [esteso](https://github.com/AndreaMarro/ardesia-next/actions/runs/41216361872). Ready for review, non merge né M3 |

## OPS-20261031-01 — Assetto operativo e riconciliazione

**Mandato:** Andrea richiede organizzazione effettiva di GitHub, agenti, skill, memoria e autonomia, conservando visione, errori e decisioni degli ultimi giorni. Nessuna richiesta di nuova produzione, spesa, nuova piattaforma o riattivazione Codex.

**Base:** `03622b56c9756225019b7c6219d226beef8e0a6d`. Ownership: coordinatore per AGENTS/documenti/operations/guardia/template; revisori in lettura e autori locali con file disgiunti. Branch `pro/20261031-operating-system`. La SHA di consegna e la CI finale sono nella relativa PR, senza un commit ricorsivo per riscrivere la propria SHA.

**Fonti effettivamente consultate:** main/PR #18/run #41216361836 e #41216361872/ruleset #26087821 tramite GitHub; metadati Vercel project/alias/deployment; prompt dell'attività esistente; Personal Context sulle decisioni 27–31 ottobre; dossier Next 29 ottobre come fonte storica; legacy `5cfbdcb...` con indice, specifiche integrali, protocollo memoria, RUNLOG, MCP e REA. Il dettaglio dei reperti è collegato da [product-map](product-map.md) e [lessons](lessons.md). Non si dichiara di aver letto ogni chat o ogni commit legacy.

**Problemi verificati:** README raccontava ancora provisioning non completato; osservazione M3 datata dichiarava runner assente, mentre il runner esiste nel tree attuale; mancavano coda/claim e indice degli errori; template PR suggeriva genericamente un redeploy precedente senza la precondizione recovery v2. Il sourceDigest comprende anche i documenti: alleggerirlo per saltare CI avrebbe alterato il contratto di prova.

**Decisione:** [ADR 0006](adr/0006-operating-model.md). Un ingresso, una coda validata, uno storico, un indice di lezioni, una mappa di 18 ambiti, procedure richiamabili da skill, un solo scheduler e coordinatore remoto. Protezioni, gate, soglia bundle e runtime rimangono quelli esistenti. [Issue #19](https://github.com/AndreaMarro/ardesia-next/issues/19) rende visibile il blocco M3 con condizioni di sblocco, senza duplicare la coda.

**Supersessione documentale:** l'ingresso del 31 ottobre sostituisce le frasi di stato corrente obsolete in README/handoff. Non riscrive la fotografia del 30 ottobre, le baseline M0–M2 o i precedenti ADR. Il provisioning non va ripetuto; la disponibilità delle credenziali resta un'altra condizione.

**Verifica della guardia:** 19 controprove deterministiche eseguite sul nuovo validatore durante lo sviluppo, zero fallimenti finali e zero skip; includono identità del registro, WIP, cicli, claim, traversal, prove mancanti, falsa accettazione e CLI. Un primo tentativo di test CLI tramite subprocess incontrava EPERM nel runtime; la funzione di ingresso è ora testata direttamente, evitando quella dipendenza ambientale. Le verifiche finali del tree e la CI sono riportate nella PR. Questo controllo non autentica il contenuto dei link e non è un lock distribuito.

**Review e correzioni successive nella stessa consegna:** un revisore tecnico separato ha riprodotto task attivo senza claim, con dipendenza incompleta e con blocker irrisolto. Nuove controprove: 19 PASS / 3 FAIL prima del fix, poi 22 PASS / 0 FAIL; la guardia completa ha validato anche il registro reale. Il revisore ha rieseguito solo le tre mutazioni e confermato il rifiuto, preservando ready_for_review durante il freeze. Corretta anche l'ambiguità del bootstrap: AGENTS e voce completa del task sono obbligatori, `--brief` è soltanto indice. Review con contesto ereditato dichiarato, non approvazione umana/GitHub distinta.

**Valutazione procedurale in contesto nuovo:** un esecutore separato ha ricevuto il caso di ripresa con PR benchmark pronta, CI invariata e OIDC/QA/restore assenti. Ha letto le fonti locali, eseguito soltanto il brief e interrogazioni Git, dichiarato working tree non pubblicato/artefatti mancanti, mantenuto il blocco e non richiesto login né rilanciato suite. È una prova qualitativa di quello scenario, non garanzia di tutte le run; i nove casi in `operations/agent-evals.json` mantengono gli altri limiti.

**Valutazione della skill di apprendimento:** un secondo esecutore in contesto nuovo ha letto la skill effettiva e le procedure, senza ricevere la rubrica né leggere `operations/agent-evals.json`. Ha respinto la rimozione delle revoche, l'esclusione di `docs` dal digest e l'automodifica dello scheduler. Ha distinto il riuso di una prova valida dalla riduzione della copertura, dichiarato il placeholder di pubblicazione e rifiutato di inventare le cause di quattro rerun descritti soltanto nello scenario. Nessuna scrittura o suite eseguita dal valutato; beneficio quantitativo NOT_MEASURED. Due scenari qualitativi osservati non costituiscono una suite completa superata.

**Stato remoto osservato:** main invariata; alias staging su `dpl_5NP212LfLh1vCBYwD68KEkxqBwe3`, SHA `f2b8dd864bc476efafca435c994cfa44af768a8c`, target staging, SSO all e zero bypass nell'alias. Non letto live il digest distribuito; nessuna nuova verifica del database o dei segreti. I numeri del benchmark provengono dalla PR e dalle run, senza un nuovo download degli artefatti in questa ricognizione.

**Adozione delle procedure:** file versionati e guardia consegnati sulla PR isolata. L'aggiornamento dell'attività esistente e l'eventuale installazione di skill personali vengono confermati separatamente soltanto dopo successo e rilettura. La presenza di questi file non attiva un daemon o un MCP di prodotto. La cronologia delle successive adozioni sta nei relativi servizi e nel checkpoint della PR, non in una promessa anticipata di questo record.

**Limiti e rollback:** M3 rimane pendente; nessuna modifica di main/staging/produzione/legacy o schema dati. Ripristinare soltanto i file di governance e la versione precedente della configurazione automatica, dopo confronto con quella corrente. Non confondere questo rollback con downgrade del client o restore di PostgreSQL. Nessun nuovo costo o servizio acquistato; consumo della CI esistente non convertito in un importo non osservato.

**Prossimo gate:** accettazione remota M3 quando cambia la disponibilità reale dei prerequisiti; altrimenti chiudere la review del lavoro già pronto. Nessun terzo filone per riempire la run.

## Formato per la prossima voce materiale

`ID/data | task e requisito | base/head o PR | fonti lette | fatto e ambito | causa confermata/ipotesi | scelta e alternative | prove/link | limiti | supersedes se necessario | prossimo passo/rollback`.

Se non cambia alcun fatto, mantenere il checkpoint esistente. Gli esiti senza cambiamento possono essere comunicati nella run senza committare un nuovo diario identico.
