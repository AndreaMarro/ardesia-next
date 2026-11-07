# Review indipendente — incremento locale Studio/Creator

Reviewer: `/root/board_review`, contesto distinto dall'autore, con precedente confronto sulla specifica. Root unico writer. Revisore read-only per istruzione, non per ACL; non ha eseguito suite né scritto sorgenti. Ha ricevuto diff grezzo e criteri, senza un verdetto prescritto.

Verdetto finale ricevuto: **favorevole al solo incremento locale Studio/Creator; nessun P1/P2 residuo individuato**. Non certifica l'intero prodotto o la distribuzione.

Sorgente ricalcolata dal reviewer: `08874b3cbf54a4da020bbcc6c7e3a7cbe6dbd2d02a2a75021a5a87b2863fd689`. Diff grezzo confrontato con quello corrente; report unit/E2E e artefatti server/MCP verificati per impronta. Verify8/8,472unit,139browser senza retry/skip/flaky/errori, server5/5, MCP10/10; budget234080/245760byte.

## Rilievi risolti

1. Rinomina di variabile che alterava una chiamata builtin: distinzione lessicale fra variabile, funzione, stringa ed esponente.
2. Derivazione di una definizione importata senza avanzamento di versione: baseline di import, nuova versione o nuova typeId esplicita.
3. Perdita della licenza precedente: lineage con definitionLicense, origine minima senza autore inventato, append automatico Core e fonti esatte nell'export.
4. Componenti sconosciuti interpretati o riscritti: props e children opachi, compiler/rinomina limitati alle primitive note, fallback conservato.
5. Cattura della variabile locale di un grafico: rinomina globale conflittuale rifiutata prima di cambiare la composizione.
6. Migrazione che scambiava JSON lab per oggetti wire: visita dei soli slot autorevoli, preservazione dei dati opachi. RED4FAIL poi GREEN.
7. Input extension attivi durante save: fieldset disabilitato, guardia callback e modifica struttura congelata; controprova browser con risposta rallentata e revisione successiva.
8. Oggetti nascosti negli slot di transizione plugin: controlli su `payload.objects[].object/previous`, rifiuto esplicito delle extension in quelle transizioni anche con hash valido. RED2FAIL, poi56/56test mirati; fixture con transizione reale, hash valido/errato e snapshot4/5/6, nessuna scrittura all'apertura.

Il reviewer ha letto la ricevuta IAB come evidenza del coordinatore. Le catture REA finali sono state completate successivamente al suo raccordo e non rientrano nel suo verdetto. Sono verifiche separate del coordinatore, con record grezzi e limiti propri.

Stato canonico: **NOT_COMPLETE**, deployment **NOT_VERIFIED_FOR_CURRENT_COMMIT**. Restano esclusi Safari/iPad/Apple Pencil fisici, app native, plugin eseguibili arbitrari, interoperabilità degli host commerciali, accettazione scientifica/editoriale e scala generale. Il digest precedente46630870 aveva esiti propri archiviati in `pre-history-fix/`; nessun PASS è trasferito alla sorgente finale.
