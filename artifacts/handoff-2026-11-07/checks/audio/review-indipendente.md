# Review indipendente — audio locale

Revisore: `/root/board_review`, contesto separato e sola lettura secondo AGENTS root. Autore/correttore e runner dei test: `/root`. Il revisore ha ricevuto sorgente, diff e criteri, senza richiesta di un verdetto favorevole; non ha modificato sorgenti, servizi o stato condiviso e non ha eseguito suite. La separazione è procedurale, non una dichiarazione di ACL della piattaforma.

Perimetro: autorità Core/PostgreSQL, contratti, autorizzazioni, byte e retry, cancellazione atomica, backup/restore, consenso, recupero locale, replay LessonOS e consumer web.

Osservazioni corrette nel corso della review:

1. Una risposta tardiva di getUserMedia/save annullata poteva fermare lo stream nuovo: invalidazione per operazione e rilascio delle sole risorse possedute.
2. Il download poteva restituire byte dopo un cambio sessione avvenuto durante l'ultimo hash: ricontrollo finale dell'autorizzazione.
3. Una risposta persa alla trascrizione poteva generare nuovi identificatori al retry: richiesta esatta conservata prima dell'invio.
4. Un ACK vecchio di un'altra scheda poteva eliminare l'intento successivo: chiave per commandId e rimozione condizionale, con controprova a due schede.
5. Il fallimento dell'ultimo frammento poteva lasciare complete=true: completamento dopo conferma delle scritture e recupero esplicito dei frammenti incompleti.
6. Replay poteva smontare editor sporco o tratto attivo: guard prima/dopo download e alla pubblicazione della scena.
7. Errori dello storico potevano mostrare la scena latest: sospensione sull'ultima scena verificata e validazione prima dell'ingresso.
8. Titolo, strip e footer potevano restare alla revisione corrente: tutti derivano ora dal documento storico durante il replay.

Il revisore ha inoltre controllato il delta del collector mobile, il pannello laterale e il ripristino dello scroll all'apertura di una registrazione. Le asserzioni storiche sono rimaste, con ulteriori controlli di geometria e visibilità del player.

Verdetto finale ricevuto: **«Revisione indipendente favorevole per l'incremento audio locale. Nessun P1/P2 residuo rilevato nel perimetro esaminato; le osservazioni precedenti risultano corrette.»**

Identità ricalcolata dal revisore: base `f7adf5db02913e25fbab0b1da071f650b4f78676`, sorgente `eed657f78653ed3a4f0cc9a0e4ec3c8ce7f5b1abf2628720ac6985cf0dabea8b`. Ha confrontato digest dei report e artefatti, manifest del bundle osservato sul Mac e patch con reverse apply check: PASS.

Prove sulla stessa sorgente: Verify8/8,403unit,113browser senza errori/skipped/flaky,server5/5,MCP9/9,budget211972/245760byte. Il collaudo Mac/IAB è stato eseguito dal root e documentato, non osservato direttamente dal revisore.

Il giudizio non comprende accettazione remota, microfono fisico, Safari, iPad/Pencil o deriva su sessioni lunghe. Stato prodotto NOT_COMPLETE; deploy NOT_VERIFIED_FOR_CURRENT_COMMIT. Nessuna approvazione scientifica/editoriale o commerciale implicita.
