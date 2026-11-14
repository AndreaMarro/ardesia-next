# Review indipendente — tentativo, feedback e correzione

Revisore: `/root/board_review`, contesto separato e accesso in sola lettura secondo AGENTS root. Autore delle correzioni e runner dei test: `/root`. Il revisore ha ricevuto sorgente, diff e criteri di accettazione; non ha modificato sorgenti, servizi, cursore o scheduler e non ha eseguito suite. Questa separazione è procedurale, non una dichiarazione di ACL della piattaforma.

Perimetro: contratti e autorità Core/PostgreSQL, autorizzazioni prima dell’idempotenza, feedback e rettifiche immutabili, correzioni e fonti esatte, migrazione v4→v5, backup/import, proiezione LessonOS, recovery del Remote Client e consumer docente/studente.

Rilievi emersi e corretti dal root durante il riesame:

1. Una bozza poteva essere attribuita alla fonte aggiornata senza una scelta dello studente: baseline conservata e rilettura esplicita; riselezionare lo stesso oggetto non la azzera.
2. Una rettifica docente rendeva difficile ricollegare la correzione senza perdere testo: azione esplicita sul feedback corrente, conservando bozza e conflitto della fonte.
3. Un ACK vecchio, dopo revoca e nuova condivisione, poteva chiudere un editor successivo: invalidazione della selezione e guard dopo lo smontaggio. La controprova attende la rimozione del comando originale dalla recovery.
4. Il primo rifiuto di lettura poteva lasciare evidenze visibili: invalidazione della proiezione revocabile e nuova apertura autorizzata, conservando sessione e recovery.
5. Un refresh tardivo poteva ancora restituire dati invalidati; l’export poteva restituire una proiezione precedente alla revoca: controlli finali della selezione e della revisione workspace.
6. Scrivere prima di selezionare un oggetto poteva impedire la prima associazione: associazione iniziale esplicita con baseline. Chiudere l’inspector non può cancellare la selezione di una bozza attiva.

Sono stati riesaminati anche la migrazione PostgreSQL 003, l’identità canonica v4 degli import storici e la verifica del checksum prima della normalizzazione dei backup. Il primo errore CHECK v4 e i tentativi browser falliti restano documentati nel [rapporto delle prove](README.md).

Verdetto finale ricevuto: **«Verdetto favorevole per l’incremento locale LESSON-CONTINUITY. Nessun P1/P2 aperto dopo le correzioni riesaminate.»**

Il revisore ha ricalcolato indipendentemente:

- Sorgente `283a31d7c03badc41c50c7a724cd693b2dcbf3b59f09fac8cb1689b1ed93b840`, base `f7adf5db02913e25fbab0b1da071f650b4f78676`.
- Coerenza dei report: Verify **8/8**, unit/integration **416/416**, browser **119/119**, zero falliti, saltati, flaky o retry; inclusi i sei casi feedback desktop/mobile.
- Digest unit/browser e artefatti server/MCP; server **5/5**, MCP **9/9**.
- Budget JavaScript gzip **215467/245760 byte**.
- Patch completa coincidente con il diff, inclusi gli otto file nuovi di questo incremento; `git diff --check` e applicazione inversa di controllo riusciti. SHA256 patch: `aedb427ee0b77afdd14fa6e5964b6def6adc577efeeff4404b2f62e5789c6528`.

Ha ispezionato le schermate automatizzate desktop/mobile e verificato che il rapporto manuale corrispondesse a build e script locali. Non ha ripetuto il collaudo IAB, svolto dal root. La review precede il confezionamento di questo rapporto e dell’indice finale; il manifest verifica successivamente i file consegnati.

Restano **NOT_COMPLETE** per il prodotto e **NOT_VERIFIED_FOR_CURRENT_COMMIT** per il deployment. Safari, dispositivi fisici iPad/Apple Pencil, app native e nuova mutazione manuale del feedback sulla sorgente finale sono **NOT_RUN**. Il Mac è stato osservato tramite browser web. Nessuna accettazione remota, approvazione scientifica/editoriale o efficacia didattica viene dedotta dai test.
