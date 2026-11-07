# Verifiche — tentativo, feedback e correzione

Incremento locale `LESSON-CONTINUITY`: risposta dello studente → feedback docente → rettifica → correzione collegata → ripresa dal diario LessonOS. [Guida per provarlo](../../LEZIONE-FEEDBACK.md).

Sorgente finale: `283a31d7c03badc41c50c7a724cd693b2dcbf3b59f09fac8cb1689b1ed93b840`. Base `f7adf5db02913e25fbab0b1da071f650b4f78676`, branch locale `codex/lavagna-continuity-20261107`, modifiche non committate né pubblicate.

| Prova sulla sorgente finale | Esito | Evidenza |
| --- | --- | --- |
| Verify | 8/8 PASS | [JSON](verification.json), [log](verify.log) |
| Unit e integrazione | 416/416 PASS | [Report](unit.json) |
| Browser Chromium desktop/mobile | 119/119 PASS, 0 skipped/fail/flaky | [Evidenza](browser-evidence.json), [report](e2e.json), [log](browser.log) |
| Runtime server | 5/5 PASS | [Report](server-runtime.json) |
| Runtime MCP | 9/9 PASS | [Report](mcp-runtime.json) |
| JavaScript gzip, worker incluso | 215467/245760 byte | [Budget](budget.json) |
| Review separata | Nessun P1/P2 aperto nel perimetro | [Rapporto](review-indipendente.md) |
| Stato canonico | Verifiche PASS, prodotto NOT_COMPLETE, deploy NOT_VERIFIED_FOR_CURRENT_COMMIT | [JSON](status.json), [log](status.log) |

Le prove usano Node 24.22.1, PostgreSQL 16 locale e Chromium di Playwright 1.56.1. Il viewport mobile è emulato. I sei casi feedback coprono il percorso completo, risposta persa e bozza obsoleta, ACK tardivo dopo revoca e nuova condivisione, in entrambi i viewport. I test Core/server/Remote Client verificano anche riferimenti esatti, isolamento, autorizzazione prima dei retry, migrazione e import storici. La regressione completa include gli incrementi lavagna, offline, MCP e audio precedenti.

## Collaudo Mac e anteprima persistente

[Rapporto manuale finale](manuale-mac.json), sulla stessa sorgente, nel browser integrato di Codex sul Mac a 1280×720: identità letta da build-info → apertura studente della lezione assegnata → tentativi salvati → lettura della fonte esatta della correzione.

Controlli osservati: URL/titolo e build corretti, contenuto significativo, nessun overlay di errore del framework, console senza errori o warning, nessun overflow orizzontale, interazione di lettura funzionante e schermata ispezionata. Il bundle osservato è `/assets/index-Cw1m1Vcj.js`. Non è stata ripetuta manualmente una nuova scrittura di feedback sulla sorgente finale: quella mutazione è coperta dagli E2E.

La preview è [http://127.0.0.1:4180/](http://127.0.0.1:4180/), con database separato dai test. La [migrazione della preview](preview-migration.json) conserva hash e revisioni dei workspace preesistenti. La [fixture sintetica](anteprima-feedback.json) è stata creata sulla precedente sorgente `d8ec9098…77cb7` e riaperta sulla build finale; il report di creazione conserva la propria identità storica.

Il service worker ha inizialmente servito il vecchio bundle: ricaricamento e chiusura di tutte le schede dell’origin hanno attivato la build verificata, senza cancellare dati. Le immagini CUA sono state osservate, ma non salvate. I quattro PNG seguenti provengono da Playwright sulla sorgente finale e sono stati ispezionati visivamente:

- [Feedback docente desktop](desktop-chromium-teacher-feedback.png)
- [Diario studente desktop](desktop-chromium-learner-diary.png)
- [Feedback docente mobile emulato](mobile-chromium-teacher-feedback.png)
- [Diario studente mobile emulato](mobile-chromium-learner-diary.png)

## Tentativi precedenti conservati

- [attempt-01](attempt-01/): Verify positivo sulla sorgente `a6af6e6d…efa73`, precedente alla correzione della restituzione di dati dopo revoca. Non è la prova finale.
- [attempt-02](attempt-02/): sei E2E feedback falliti sulla sorgente `b740aeac…043c5`. Il collector leggeva prima dell’ACK e non attendeva la conferma server della checkbox controllata. Corrette le attese, mantenendo i vincoli dell’interfaccia.
- [targeted](targeted/): successiva prova mirata **6/6**, sorgente `d8ec9098…77cb7`; non sostituisce la regressione finale. Il log PostgreSQL intermedio **24/24** è conservato separatamente, senza attribuirgli il digest finale. Il precedente rifiuto CHECK v4 è registrato nello storico e nel transcript della lavorazione; è stato risolto con migrazione 003, senza alterare 001 o le righe pregresse.
- [attempt-03](attempt-03/): suite completa **117/119**, sorgente `d8ec9098…77cb7`. Il nuovo flusso portava l’account studente A a 13 login, oltre il limite di 12; [contatori PostgreSQL osservati](attempt-03/login-limits.json). Il collector feedback usa ora l’account B già provisionato. Rate limit, contatori e policy non sono stati indeboliti. La suite finale sulla nuova sorgente passa **119/119**.

Il warning CLI sulla porta HMR 24678 già occupata dalla preview è distinto dalla console dell’app. I report falliti restano falliti; nessun PASS viene trasferito tra sorgenti diverse.

## Integrità e confini

[Esito corrente derivato](../esito.json) · [hash dei sorgenti](source-files.json) · [manifest dei file consegnati](manifest.json) · [integrità legacy](legacy-integrity.json). `git diff --check` e `git apply --check --reverse` della patch completa passano. I sei file legacy selezionati conservano gli hash iniziali; nessuna modifica al repository storico. Contesto delle sette chat e analisi REA già eseguite restano nelle [fonti attribuite](../../ardesia-next/docs/sources/spatial-board-2026-11-07.md) e nelle [evidenze REA](../../rea-evidence/README.md).

Snapshot v5 e contratto 0.5.0: campi feedback opzionali senza default; apertura e retry di v4 non riscrivono lo storico. La prima nuova mutazione salva v5. Gli import device mantengono identità canonica v4; i backup verificano il checksum prima della normalizzazione. Un rollback al runtime v4 non apre nuovi dati v5: seguire il runbook senza cancellare feedback o cambiare etichette.

Safari, iPad/Apple Pencil fisici e app native restano da provare; Xcode non è disponibile. Il diario non è ancora globale e non implementa tassonomie degli errori, transfer o retest su prove diverse. Feedback e lavoro studente richiedono il server; la copia offline riguarda le lezioni possedute dal docente. Feedback via MCP/AI, ASR, collaborazione generale fra dispositivi, corsi completi, gestionale tutor, pagamenti e marketplace commerciale restano nella [mappa prodotto canonica](../../ardesia-next/docs/product-map.md). Nessun push, merge, deploy o cambiamento di scheduler/cursore condiviso è stato effettuato.
