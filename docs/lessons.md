# Lezioni operative: indice degli errori e delle difese

Ricognizione del 31 ottobre 2026. Questo file è un indice tematico dello [storico canonico Next](history.md) e delle fonti legacy in sola lettura. Non è un secondo RUNLOG e non riscrive gli incidenti. Leggere solo le lezioni pertinenti al cambiamento; la procedura di esecuzione e miglioramento delle skill è in [operations](operations.md).

Le fonti legacy sotto sono fissate a `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`; i fatti Next descrivono la base `03622b56c9756225019b7c6219d226beef8e0a6d`. «Chiusura richiesta» indica l'evidenza necessaria quando si tocca quel confine, non un nuovo test da ripetere a ogni run né un PASS già assegnato. I casi storici non si attribuiscono alla nuova app senza riproduzione.

## L01 — Un plugin non può diventare una seconda applicazione

- **Evento/fonte:** il [canone eLab][elab] documenta shell, auth, memoria, AI, report e lavagna duplicati dentro `plugins/elab-tutor`. La [ricostruzione §31][spec] registra la successiva rimozione runtime con #332.
- **Causa verificata:** copia dell'app nella directory plugin senza passare per il confine Host; non soltanto nomi poco chiari.
- **Regola preventiva:** Core/Host/identità unici, export pubblici, plugin guest senza store o autorizzazioni proprie. Non reintrodurre eLab sotto il nome «Sim»; distinguere gli strumenti indipendenti.
- **Chiusura richiesta:** controllo dei confini e percorso dal consumer tramite Host; revisione dipendenze/diritti. In Next: [architettura](architecture.md), [recupero](sources/legacy-review.md), D56/D57/D64.
- **Quando leggere:** nuovo plugin, donor, modifica di responsabilità, refactor di Core o UI.

## L02 — Codice e primitive verdi non provano il consumer

- **Evento/fonte:** [CANON-INDEX legacy][canon] descrive Host costruito ma non montato; la demo `srcDoc` bypassava il percorso firma/installazione.
- **Causa verificata:** percorso di prodotto separato dal componente testato. «Molti test» non dimostra integrazione o sicurezza della route effettiva.
- **Regola preventiva:** ogni incremento dichiara consumer e comportamento raggiungibile; la stessa pipeline verificata deve essere quella usata dall'utente.
- **Chiusura richiesta:** install→verify→consent→mount→use→save→reopen→disable e controprove pertinenti. [M1](m1-delivery.md), [M2](m2-delivery.md), D58/D62.
- **Quando leggere:** nuova capacità, UI di catalogo, installazione, adapter o integrazione di componenti.

## L03 — Una fotografia storica non è lo stato corrente

- **Evento/fonte:** [CANON-INDEX][canon] e [Architecture Canon][architecture] marcano superati i percorsi multi-repository e gli stati di giugno. I documenti Next M0–M2 conservano il precedente perimetro device-only/privato.
- **Causa verificata:** documenti validi al momento della scrittura convivevano con cutover e nuove decisioni; leggere senza data/SHA produce una contraddizione apparente.
- **Regola preventiva:** distinguere mandato/ADR, stato generato, osservazione datata e archivio. Non eseguire comandi o riaprire provisioning da un vecchio handoff senza verificarne il presupposto.
- **Chiusura richiesta:** SHA/base, PR, CI e target correnti identificati oppure UNKNOWN; supersessione motivata nello [storico](history.md), non cancellazione del passato. D61.
- **Quando leggere:** ingresso di sessione, handoff contraddittori, cambio milestone, provider o branch.

## L04 — Lo storico deve essere usato, non solo scritto

- **Evento/fonte:** [RUNLOG 28/10][runlog], «integrazione audit dello storico»: la task citava AGENTS ma non direttamente RUNLOG/NEXT; `completed` non provava la lettura. Il [protocollo memoria][memory] richiedeva già richiamo mirato.
- **Causa verificata:** rinvio indiretto nella configurazione. **Non verificato:** che gli agenti avessero omesso ogni lettura; il log non lo dimostra.
- **Regola preventiva:** ingresso breve con fonti correnti esplicite, ultimo handoff e lezioni pertinenti; dichiarare i riferimenti effettivamente usati e il motivo della scelta del task. Non rileggere tutto l'archivio.
- **Chiusura richiesta:** un run collega fonti, decisione e risultato; task conclusi non ricreati, nuovo handoff allineato. [Storico](history.md), [operazioni](operations.md), NFR-DOC-001/002.
- **Quando leggere:** modifica del prompt automatico, handoff, nuova sessione o duplicazione di lavoro.

## L05 — Una memoria esterna non deve bloccare il lavoro

- **Evento/fonte:** [health report 2/7][memory-health]: timeout, CPU/RSS elevati e restart/consolidation ripetuti. [Protocollo 24/10][memory]: servizio esterno UNKNOWN, cache facoltativa; Git e prove sono autorità.
- **Causa verificata:** quei sintomi sul vecchio host. Il danno dell'indice è un'ipotesi documentata, non una causa provata; nessun guasto presente è deducibile da luglio.
- **Regola preventiva:** contesto minimo e indici Git sono sufficienti; nessun daemon/vector DB/MCP aggiunto per sostituire un protocollo non seguito. Valutare beneficio, costi e manutenzione prima di attivare servizi.
- **Chiusura richiesta:** run utile completabile dalle fonti canoniche senza cache; eventuale servizio ha health reale, fallback, owner e autorizzazione. Nessuna attivazione è implicita qui.
- **Quando leggere:** proposta di memoria agentica, orchestratore, nuovo scheduler o connettore.

## L06 — Un verde diverso non cancella un fallimento

- **Evento/fonte:** [RUNLOG 26/10][runlog], PR309: percorso browser locale fallito; successiva fixture non pronta; CI su altro runner poi verde. FAIL conservati, causa non attribuita alla contesa osservata.
- **Causa verificata:** esiti su fonti/ambienti differenti. **Non verificata:** causa precisa del blocco browser locale; il PASS altrove non la stabiliva.
- **Regola preventiva:** chiave dell'evidenza con SHA/tree, comando, test/configurazione e ambiente; riuso solo dello scope invariato. Nessun rerun identico come cura o nuova etichetta flaky senza diagnosi.
- **Chiusura richiesta:** controprova che discrimina l'ipotesi o limite dichiarato; test proporzionato al delta e gate obbligatori sul candidato esatto. FAIL/NOT_RUN/CANCELLED restano distinti da PASS. D58/D61.
- **Quando leggere:** CI intermittente, stress del runner, cambio dipendenze, uso di evidenza precedente.

## L07 — Il test deve distinguere due realtà diverse

- **Evento/fonte:** [RUNLOG 26/10, B-05][runlog]: 53 test precedenti non coprivano `revisionId:null`; il confronto leggeva latest, restituendo 0 m/s anziché 1 m/s della revisione originale. RED HTTP200 invece di422, poi correzione e controprova.
- **Causa verificata:** parametro opzionale consentiva fallback alla revisione corrente in un consumer che esigeva una revisione esatta.
- **Regola preventiva:** usare identità, attori e revisioni con risultati realmente diversi; il test non deve specchiare la stessa assunzione dell'implementazione. Missing/foreign/stale/null non sono casi equivalenti.
- **Chiusura richiesta:** vecchia revisione resta risolvibile; riferimento assente/invalido rifiutato; nessuna fuga a latest; RED/GREEN e consumer pertinenti. D28/D43/D50/D54/D58.
- **Quando leggere:** fonti, feedback, storico, import, retry, serializer o modifiche di schema.

## L08 — Simulazione DOM e attesa del nodo non provano l'interazione nativa

- **Evento/fonte:** [protocollo memoria, R1 24/10][memory]: jsdom verde non rilevava perdita di focus con disabled/pending. [RUNLOG 27/10, PR327][runlog]: nodo presente prima del passive effect che spostava il focus.
- **Causa verificata:** differenza browser/jsdom nel primo caso; attesa della presenza anziché dell'effetto richiesto nel secondo. Sono difetti distinti, non un unico «flaky».
- **Regola preventiva:** attendere la condizione applicativa; verificare nel browser i confini nativi pertinenti. Non aumentare timeout o cambiare il gesto per ottenere verde senza diagnosi.
- **Chiusura richiesta:** focus/tastiera/errori/salvataggio nel percorso reale, test unitario quando discrimina il rischio; D29/D30/D36/D40. Emulazione mobile non certifica device fisici.
- **Quando leggere:** focus, dialoghi, pending/disabled, touch, penna o test asincroni.

## L09 — Le evidenze possono esporre informazioni

- **Evento/fonte:** [RUNLOG 26/10, correzione ricevuta RED B-05][runlog]: repr di fixture con token sintetici in log pytest compresso; secret scan ad alta confidenza PASS non dava quella garanzia. Redazione datata e digest originale conservati.
- **Causa verificata:** serializzazione della fixture nei log; nessuna credenziale di produzione identificata in quell'incidente. Non inferire una compromissione reale dal solo token sintetico.
- **Regola preventiva:** artifact allowlist, dati sintetici, log minimizzati e redazione prima della pubblicazione; mai DB/accessfile, credenziali, HAR o dump grezzi nel repo pubblico.
- **Chiusura richiesta:** ispezione dei file effettivamente pubblicati, anche compressi, e ricevuta di eventuale redazione senza cancellare la storia. D55/D60, NFR-SEC-003.
- **Quando leggere:** nuovi artifact, screenshot/log/trace, report di errore, export o PR pubbliche.

## L10 — SSO, URL e provider READY non sono accettazione remota

- **Evento/fonte:** [RUNLOG 26–28/10][runlog] distingue preview503, runtime loopback, servizi statici e successiva prova hosted sintetica. In Next, [M3 osservazioni](../operations/m3-environment.json) distingue infrastruttura verificata da accettazione pendente.
- **Causa verificata:** protezione della piattaforma, identità applicativa, storage e flusso utente sono confini differenti. Un link o un health endpoint copre solo il proprio confine.
- **Regola preventiva:** preflight autorizzato prima delle credenziali o scritture; stesso target e SHA, cookie applicativi indipendenti, nessun bypass/guardia indebolita per far passare il test.
- **Chiusura richiesta:** [runbook](release-runbook.md), [e2e](../e2e/README.md): docente/studenti, isolamento/revoca, tutte le controprove e restore remoto sicuro. M3 resta pendente finché il gate completo non accetta.
- **Quando leggere:** backend, deployment, OIDC, QA remoto, backup/restore o proposta di chiudere M3.

## L11 — Ogni promessa di scala deve avere un limite misurato

- **Evento/fonte:** [ADR legacy change tolerance][growth] registra scan calendario O(edizioni×4), liste non paginate, ruolo globale e limiti delle migrazioni1/2. [ADR M3 Next](adr/0005-m3-remote-authority.md) serializza per workspace e salva snapshot.
- **Causa verificata:** algoritmi e contratti descritti; non è dimostrato che abbiano già causato un incidente di carico. La scala illimitata sarebbe un'inferenza ingiustificata.
- **Regola preventiva:** rischio con trigger, budget e misura prima del refactor; mantenere adapter piccoli e Core unico. Ottimizzare il percorso reale senza aggiungere infrastruttura per ipotesi.
- **Chiusura richiesta:** campioni conservati, dimensione dati/ambiente e costo per fase; regressioni di autorizzazione/continuità. La [PR18](https://github.com/AndreaMarro/ardesia-next/pull/18) misura scritture isolate: non include rete, TLS o rendering. D57–D59.
- **Quando leggere:** snapshot grandi, paginazione, prestazioni, multitenancy o nuova dipendenza/provider.

## L12 — Scienza, UX, deploy e approvazione umana restano separati

- **Evento/fonte:** [RUNLOG finale CHIUSURA1A][runlog]: 0/57 obiettivi umanamente accettati; hardware/pilota non provati. Input→rAF17,4ms non misura paint/FPS; axe0 conservava incomplete manuali. In Next la [matrice](acceptance/D01-D68.json) non promuove i criteri da CI.
- **Causa verificata:** differenti oggetti di misura/approvazione; un test tecnico non osserva persone, dispositivo o validazione editoriale. Non serve presumere frode per riconoscere il limite.
- **Regola preventiva:** modello/renderer separati, DRAFT preservato, aiuto distinto dall'autonomia; attestazione umana riferita a versione e perimetro. Nessun agente firma al posto di Andrea/docente/studenti.
- **Chiusura richiesta:** criteri scientifici del modulo, UX nel percorso e prove D40/D59/D65–D68 con persone/device quando richiesti; `productAcceptance` distinto dalle milestone tecniche.
- **Quando leggere:** nuova simulazione/contenuto, report di qualità, benchmark, claim di completezza o rilascio.

## Manutenzione dell'indice

Una nuova evidenza significativa entra nello [storico](history.md) con fonte, ambito, causa verificata/ipotesi, correzione e limiti. Aggiornare la lezione pertinente con il collegamento; aggiungerne una solo se il rischio è diverso. Non duplicare log o retrodatare PASS. L'esistenza della regola non prova che un agente l'abbia eseguita: verificare il comportamento nella consegna e nelle valutazioni delle [procedure](operations.md).

[spec]: https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/docs/product/ARDESIA_specifiche_integrali_ricostruite_2026-10-28.md
[canon]: https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/docs/CANON-INDEX.md
[architecture]: https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/docs/ARCHITECTURE-CANON.md
[elab]: https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/docs/ELAB-AS-PLUGIN-CANON.md
[runlog]: https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/docs/ops/ARDESIA-RUNLOG.md
[memory]: https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/docs/ops/AGENTMEMORY-SEMANTIC-PROTOCOL.md
[memory-health]: https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/docs/ops/AGENTMEMORY-HEALTH-STATUS.md
[growth]: https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/docs/adr/ADR-0006-change-tolerance-and-growth.md
