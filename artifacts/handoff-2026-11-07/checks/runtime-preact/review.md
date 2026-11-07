# Revisione del runtime web — 7 novembre 2026

Sorgente: `1faf8656386c1aca295e2229496f7181c665f7ee4ab9abf7dcb4a5a43ba9303d`, base `f7adf5db02913e25fbab0b1da071f650b4f78676`. Preparazione locale, nessuna accettazione M3 remota.

Reviewer distinto `/root/board_review`, contesto separato, istruzione read-only, root unico writer. Ha letto sorgenti/diff e artefatti originali; non ha eseguito nuovamente i test. Nessun P1/P2 residuo riscontrato su alias, separazione delle dipendenze di riferimento, geometrie SVG, budget e correzione server. Su suo rilievo il controllo del grafo è stato esteso a una sola radice Preact e all’assenza di Lucide/SSR dal prodotto.

Verify 8/8; 335/335 unit; 93/93 browser; server5/5; JavaScript192159/245760byte gzip. CSP e soglia immutate. I due test della vecchia riscrittura AST sono sostituiti da un controllo sul grafo reale: la differenza nel numero dei test non è un test fallito omesso.

Il primo tentativo browser è FAIL:92PASS e interruzione del collector dopo ERR_HTTP_HEADERS_SENT. Una build concorrente modificava dist durante il test; la corsa con la lettura del file è plausibile, non dimostrata perché il primo errore veniva intercettato senza log. Il server ora completa la lettura prima degli header e non li reinvia quando la risposta è già iniziata. Esecuzione finale in sequenza, dist immutabile. Report e log precedenti conservati in primo-tentativo.

Smoke dev osservato dal root via CUA/IAB, http://127.0.0.1:4181/: accesso sintetico, schermata completa senza overlay, modifica della descrizione della formula del pendolo, salvataggio rev9/oggetto4, reload con descrizione identica e “Confermato dal server”. Console dopo reload: nessun warn/error. Database preview persistente separato dai test. La review indipendente iniziale lasciava questo controllo pendente; questa osservazione è del root e non un test rifatto dal reviewer.

Apple Pencil/iPad e Safari fisici, memoria e latenza sotto carico: NOT_RUN. Xcode assente. Il bundle più piccolo non dimostra una misura di fluidità hardware.
