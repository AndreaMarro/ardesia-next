# Review separata — continuità offline

Revisore: agente `/root/board_review`, contesto separato, sola lettura per istruzione. Le capacità dell'ambiente non costituiscono una ACL di sola lettura. Il coordinatore `/root` è rimasto l'unico autore di modifiche al codice e l'esecutore dei test. Il revisore ha letto sorgenti/diff, controprove e report; non ha eseguito le prove né pubblicato o integrato codice.

## Rilievi e correzioni osservate

- **ACK concorrente a caricamento/preparazione:** poteva sparire un tratto dalla copia locale dopo la rimozione della recovery. La copia aggiornata viene ora resa durevole prima del cleanup; la transizione drena e ricontrolla le scritture arrivate durante la lettura.
- **Errore IndexedDB dopo conferma:** comando originale mantenuto e recuperabile anche dopo avvio a freddo. Il retry identico conserva la ricevuta senza un secondo evento.
- **Bozza persa al cambio modalità:** rimosso lo switch automatico all'evento offline; cambio esplicito protetto da guard e input inerti durante l'attesa.
- **Scarto seguito da transizione fallita:** l'editor viene realmente ricreato, così una nuova bozza resta protetta.
- **Logout nell'ultimo confine asincrono:** epoch e selezione ricontrollati nei chiamanti prima della pubblicazione.
- **Tratti durante reconnect:** la riconnessione attende la catena locale, rifiuta nuovi input durante la transizione; la UI impedisce navigazione durante gesto/persistenza e congela gli input durante la verifica della sessione.
- **Shell incoerente:** cache identificata dal manifest completo dei byte, verifica SHA-256 prima dell'attivazione, conservazione della precedente installazione completa; API/plugin fuori allowlist.

Il revisore ha dichiarato nessun nuovo P1/P2 sul delta di runtime al digest3b7fd47ea5c77243c8a0c6d2bd4779437205e395be922619f56d95f31ec08226, dopo avere letto RED/GREEN e sorgenti. Ha letto Verify PASS e budget, distinguendo la regressione browser allora pendente.

## Collector QA

La prima suite completa ha dato107PASS/2FAIL nel cambio account. La successiva modifica al collector richiede un login UI B dopo il cambio di cookie, osservando il rifiuto del gate A. Il revisore non ha riscontrato indebolimento delle verifiche originali:409/SESSION_CHANGED, revisione invariata, work B vuoto e textarea B vuota. Su suo suggerimento è stata aggiunta anche l'assenza del campo Note personali prima del login B: il solo textContent non legge il valore delle textarea.

Tutte le esecuzioni sono del coordinatore; i report finali e le identità esatte sono in questa cartella. La review del delta non attesta efficacia pedagogica, hardware fisico, pubblicazione remota, sicurezza universale o accettazione dell'intero ecosistema.

## Riscontro conclusivo sulla sorgente finale

Il revisore ha riletto le ultime modifiche e gli artefatti sul digest `e7569a0c5af69f47f59467bc6dddc3afa89fcb4d6ebd7d17c8548e449b7728cb`. Riscontro favorevole per il solo incremento locale, nessun P1/P2 residuo riscontrato. Identità e hash dei report coerenti: Verify8/8,361/361 unitari,109/109 browser senza skipped/flaky,5/5 controlli server,202117/245760byte gzip. Le prove precedenti fallite restano distinte. Non è accettazione remota, dell'ecosistema completo o di hardware Apple fisico.
