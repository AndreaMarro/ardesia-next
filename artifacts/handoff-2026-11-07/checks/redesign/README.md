# Verifiche — Studio e Creator

Incremento locale sulla sorgente **`08874b3cbf54a4da020bbcc6c7e3a7cbe6dbd2d02a2a75021a5a87b2863fd689`**, base `f7adf5db02913e25fbab0b1da071f650b4f78676`, branch `codex/lavagna-continuity-20261107`. Modifiche non committate o pubblicate. I report non accettano automaticamente milestone o produzione.

| Controllo | Risultato sulla sorgente finale |
| --- | --- |
| Verify | [8/8 PASS](verification.json) |
| Unit/integrazione | [472 PASS](unit.json) |
| Browser desktop/mobile | [139 PASS](e2e.json),0skip,0flaky,0failure; [impronta e identità](browser-evidence.json) |
| Server reale | [5/5 PASS](server-runtime.json), PostgreSQL locale e Worker firmato |
| MCP reale | [10/10 PASS](mcp-runtime.json), client ufficiale esterno→stdio→HTTP→PostgreSQL |
| Tutto il JavaScript gzip | [234080/245760byte](budget.json), soglia invariata |
| Review distinta | [Favorevole sul solo incremento](review-indipendente.md) |
| Interazione Mac/IAB | [Ricevuta manuale](manuale-mac.json), desktop1280×720 e viewport412×915 |
| REA | [Analisi donor, consumer e catture](../../rea-evidence/redesign/README.md), con limiti espliciti |
| Stato canonico | [NOT_COMPLETE](status.json), deploymentNOT_VERIFIED_FOR_CURRENT_COMMIT |

La suite comprende nuovi tipi annidati, valori e nuova versione della struttura, import/export/licenza/fonte storica, componenti futuri, conflitti di variabili, bozza JSON, salvataggio lento/ACK perso, migrazioni e integrità dello storico. Mantiene i consumer precedenti di offline, audio/replay, tentativi/feedback, dispensa, permessi/revoca e plugin firmati. I test di grafico coprono estremi enormi, microscopici e costante zero. Il pendolo iniziale rimane esempio DRAFT.

[Screenshot/download dei test Creator](creator-browser/) · [confronto design](../../design/verifica-finale.md) · [manifest](manifest.json) · [file sorgenti e hash](source-files.json) · [esito strutturato](esito-consegna.json).

## Fallimenti e limiti conservati

I [log intermedi](attempts/) conservano errori del collector, regressioni e controprove RED. La prima suite estesa ha dato120PASS/13FAIL: sovrapposizioni responsive, stato bozza mobile, selettori/titolo obsoleti e click sulla nuova rail. La successiva133PASS/2FAIL ha isolato un selettore `svg circle` ambiguo dopo l'aggiunta delle icone, corretto al solo SVG della scena. Il candidato466 ha poi passato470unit/139browser: i [suoi report](pre-history-fix/) restano separati, perché la review ha richiesto l'ultima correzione dello storico. La fonte finale ha eseguito nuovamente l'intera Verify e la regressione.

I log riportano un avviso Vite sulla porta HMR24678 già occupata dalla preview propria e gli avvisi NO_COLOR/FORCE_COLOR del runner. Le suite runtime e browser completano con exit0; non vengono soppressi per produrre report più puliti. La preview reale usa un database distinto dai fixture. [Migrazione della preview](preview-migration.json): righe preservate, dump preventivo; [legacy](legacy-integrity.json): sei file selezionati verificati invariati, non un audit di tutto il repository.

Questo incremento non ricompila con Tectonic i PDF della consegna precedente: quelle prove rimangono storiche in [dispensa](../dispensa/README.md). La nuova suite browser rigenera i percorsi di esportazione e controlla l'extension statica, senza rivendicare TikZ per ogni interazione.

iPad/Safari/Apple Pencil fisici, app native, collaborazione simultanea, plugin terzi arbitrari, pubblicazione marketplace, host ChatGPT/Claude/Gemini e performance a grande scala restano non dimostrati. Il programma complessivo — corsi, gestionale tutor, community e marketplace — resta aperto. La nuova shell offline richiede reload e chiusura delle vecchie schede dopo l'aggiornamento di contratto; non cancellare i dati per aggiornarla.
