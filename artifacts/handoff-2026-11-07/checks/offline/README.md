# Continuità offline — evidenze della consegna locale

Sorgente finale: `e7569a0c5af69f47f59467bc6dddc3afa89fcb4d6ebd7d17c8548e449b7728cb`, base Git `f7adf5db02913e25fbab0b1da071f650b4f78676`, modifiche locali non committate. [Esito](../esito.json).

Report originali prodotti dagli strumenti della repository, copiati senza correggere PASS/FAIL:

- verification.json e unit.json: Verify8/8,361/361 test.
- e2e.json e browser-evidence.json:109/109 browser, zero skipped/flaky/fail;16 riguardano specificamente l'offline.
- server-runtime.json:5/5 controlli del bundle con Node/PostgreSQL/Worker reali e isolati.
- budget.json:202117byte su245760, tutti i JavaScript inclusi.
- build-info.json: identità del build; i log finali terminano in `delivery.log`.
- [Review separata](review-indipendente.md), [collaudo manuale Mac](manuale-mac.md), screenshot desktop/mobile emulato e [integrità legacy](legacy-integrity.json).

## Tentativi conservati

`primo-tentativo` e `secondo-tentativo` conservano gli errori iniziali dell'offline: superficie senza altezza, controllo nascosto sul layout piccolo e interferenza dei cookie sintetici fra scenari. `targeted` conserva il successivo12/12 sui primi sei scenari in due viewport, oltre alle controprove ACK/cache RED→GREEN.

`regressione-completa-primo-tentativo` conserva107PASS/2FAIL sul digest3b7fd47e…: il collector del cambio account presumeva un'autenticazione automatica dopo il cambio cookie via API. Il nuovo gate impone identità esplicita; il collector è stato aggiornato mantenendo i rifiuti originali e aggiungendo l'assenza del campo personale prima del nuovo login.

`pre-rinforzo-collector` conserva109/109 su02a3a779… . Il piccolo rinforzo finale del collector e la precisione dell'attribuzione in history cambiano la sorgente; Verify e browser completi sono stati ripetuti sul digest finale sopra. I file `offline-*-red.log` conservano le regressioni riprodotte; gli esiti positivi successivi restano distinti.

## Limiti

I test del client usano Core reale dietro trasporto controllato e fake-indexeddb. I test browser usano il vero server/PostgreSQL e IndexedDB del browser; rete/risposte sono interrotte dal test. I test del worker sono simulazioni al confine di installazione/cache. Nessuno di questi test misura latenza Apple Pencil o durabilità dopo spegnimento improvviso, eviction generale o eliminazione del profilo.

La review ha letto sorgenti e prove in un contesto distinto; tutte le esecuzioni sono state effettuate dal coordinatore. Questa è una consegna locale verificata, non accettazione M3 remoto, app native compilate o completamento dell'intero ecosistema.
