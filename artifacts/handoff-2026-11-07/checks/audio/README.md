# Verifiche — audio personale e replay

Incremento locale sulla base `f7adf5db02913e25fbab0b1da071f650b4f78676`, sorgente `eed657f78653ed3a4f0cc9a0e4ec3c8ce7f5b1abf2628720ac6985cf0dabea8b`. Sorgenti non committati, nessun deploy. [Guida alla prova](../../AUDIO-REPLAY.md).

| Prova | Esito | Evidenza originale |
|---|---|---|
| Verify | 8/8 PASS | [verification.json](verification.json), [log](verify.log) |
| Unit e integrazione PostgreSQL | 403/403 PASS | [unit.json](unit.json) |
| Browser desktop/mobile emulato | 113/113 PASS, zero skipped/flaky/fail | [e2e.json](e2e.json), [collector](browser-evidence.json), [log](browser.log) |
| Runtime server Node/PostgreSQL | 5/5 PASS | [server-runtime.json](server-runtime.json) |
| Client MCP ufficiale via stdio | 9/9 PASS | [mcp-runtime.json](mcp-runtime.json) |
| JavaScript gzip, worker inclusi | 211972/245760byte | [budget.json](budget.json) |
| Collaudo Mac/IAB | ricerca→replay→play→seek→lavagna | [manuale-mac.json](manuale-mac.json), [fixture](anteprima-audio.json) |
| Review separata | favorevole, nessun P1/P2 residuo rilevato | [review](review-indipendente.md) |
| Stato canonico | locale PASS; prodotto NOT_COMPLETE | [status.json](status.json) |

Node24.22.1, PostgreSQL16 locale, Playwright1.56.1. Browser automatici:1440×960 e Pixel7 emulato; Mac/IAB1280×720. Il plugin Browser con relativa skill non è presente: suite Playwright già configurata nel repository; interazione manuale nel browser integrato tramite CUA. Nessuna dipendenza browser aggiunta per questo collaudo.

## Comportamenti verificati

- MediaRecorder reale alimentato da AudioContext sintetico: consenso, scrittura temporizzata, upload con risposta persa, riapertura e retry dello stesso comando.
- Replay dal diario Core: modifiche e cancellazioni, campioni della penna, seek indietro; titolo, elenco e revisione storici. Nessun fallback alla scena corrente in caso di errore. La bozza dell'editor e un tratto attivo impediscono l'ingresso nel replay.
- Trascrizioni manuali/importate versionate, ricerca e riferimento esatto; risposta persa dopo commit e ripresa dopo reload senza seconda versione. Chiave di recupero per comando: un ACK vecchio di un'altra scheda non elimina l'intento successivo.
- Controlli account/spazio/proprietà anche dopo download e hash; studenti e utenti estranei esclusi dall'audio personale. Manifest SHA256 e finalizzazione completa solo dopo conferma dei byte.
- Cancellazione atomica di audio e trascrizioni, rollback con errore imposto; tombstone e ricevute impediscono resurrezioni. Backupv3 con media, restore validato e compatibilità di lettura backupv2.
- Pannello laterale su desktop e limitato in altezza su mobile; superficie dentro il viewport e non sovrapposta. Un risultato apre il player visibile senza ereditare lo scorrimento dell'archivio.

La prova manuale ripete ricerca **quadruplica**→0:16→play→Home/revisione3 senza tratto→ritorno alla revisione4 modificabile. Console senza errori o warning applicativi, nessun overlay. Voce sintetica locale Alice; nessun microfono reale, ascolto umano qualificato o ASR. Gli screenshot salvati sotto appartengono ai test automatici; quelli CUA sono stati osservati nei risultati degli strumenti.

## Errori conservati e limiti

`attempt-01..04` conservano tentativi mirati e correzioni del collector/riproduzione. `attempt-full-01` conserva111PASS/2FAIL dovuti ai font KaTeX inline bloccati dalla CSP: risolto emettendo file font separati, senza allargare la policy dei font. `attempt-full-02` conserva112PASS/1FAIL: il test cliccava il controllo di aggiornamento nascosto dal layout mobile; ora riapre la lezione persistita e conserva la prova titolo corrente→storico. `attempt-collector-fix` conserva Verify e il rifiuto preventivo del runner su build non aggiornato. `attempt-layout` conserva113PASS sul digest0ccb3262, prima dell'ultimo miglioramento dello scorrimento. Nessuno di questi report viene attribuito alla sorgente finale.

Il log Verify conserva un avviso di conflitto della porta WebSocket HMR24678 durante l'esecuzione contemporanea al server preview. HTTP/PostgreSQL, bundle e client MCP hanno superato le proprie prove; l'anteprima compilata usa aggiornamento manuale. Gli avvisi NO_COLOR/FORCE_COLOR del runner sono anch'essi conservati.

Microfono reale, Safari, iPad/Apple Pencil, latenza/drift su sessioni lunghe e sospensione restano NOT_RUN. Audio via MCP, ASR, ricerca globale, condivisione audio, streaming progressivo e cattura a freddo dalla copia offline ridotta non sono implementati. I byte vengono interamente verificati prima del playback. Il test locale non accetta il deployment remoto o l'ecosistema completo.

La patch completa passa `git diff --check` e `git apply --check --reverse`. [Legacy](legacy-integrity.json): sei file selezionati invariati rispetto alla consultazione iniziale. [Manifest dei file consegnati](manifest.json).

![Desktop Chromium, stream sintetico e trascrizione del test](desktop-chromium-replay.png)

![Viewport mobile Chromium emulato, stessa sorgente](mobile-chromium-replay.png)
