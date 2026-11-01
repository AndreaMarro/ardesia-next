# ADR 0008 — un coordinatore Codex, cicli sequenziali

Data: 1 novembre 2026. Mandato diretto OPS-20261101-07. Stato: implementazione preparata; attivazione nativa e prova end-to-end da attestare separatamente.

## Problema e scelta
La coppia creava dipendenze reciproche: Codex aspettava Pro, la regia aspettava un vecchio ID non osservabile, il cursore non consentiva coordinamento Codex. Il nome Pro era stato confuso con la selezione del modello. I test di repository non verificavano il runtime dello scheduler. Aggiungere un'altra automazione replicherebbe il problema.

Scelta: un solo task nativo Codex ogni 90 minuti, massimo operativo 55 minuti, un solo incremento e writer. Gli specialisti sono transitori nella stessa esecuzione. Si estende il helper esistente e si migra **lo stesso cursore Git** a schema v2. v1 resta leggibile per storia e rollback; nessuna nuova base dati, servizio, orchestratore o pipeline di accettazione.

Alternative scartate: due scheduler (coordination overhead e blocco incrociato); daemon/API/Codespaces dedicati (costi, credenziali e nuovi failure mode); un prompt enorme che rilegge tutto (tempo e deriva); un unico thread assunto come memoria completa (non trasferibile né verificabile).

## Supersessioni circoscritte
Supera ADR 0007 per attori, incarichi, cadenza e assenza di Pro obbligatorio. Il mandato diretto consente al coordinatore Codex di selezionare, implementare, raccogliere review e integrare dove la policy già lo permette. Non autorizza nuove spese, pubblicazione commerciale/produzione, bypass, credenziali, reset o accettazioni fittizie. Restano Core unico, legacy read-only, privacy, licenze, DRAFT, firme e prove originali.

L'ID storico non osservabile non viene dichiarato cancellato; non è più prerequisito globale. Concorrenza reale protetta da claim, ref attesa, branch isolato e no force. Nessun takeover automatico su scadenza. M3 blocca il suo gate, non una review indipendente già utile. Il freeze di release non viene trasformato in divieto di preparazione isolata.

## Implementazione
`cycle.mjs` supporta v2 con Codex coordinator, migrazione inactive-only, selezione del task dentro il medesimo budget, HANDOFF Codex→Codex e ricevuta di review con contesti distinti. Conserva parser, validatore, budget e contratti v1; le nuove controprove sono in `cycle-sequential.test.mjs`. La CLI non autentica i report o i reviewer e non effettua chiamate remote.

Fonti attive: START_HERE, runbook, coda, product-map, storico/lezioni. I prompt duplicati vengono sostituiti da un prompt Codex e un avviso di ritiro Pro. Lo storico precedente viene archiviato byte-identico e indicizzato dal medesimo history.md. Nessun FAIL cancellato.

Quattro skill repo-locali e cinque profili specialistici; strumenti MCP ereditati dal parent, nessun nuovo server o accesso. Config del parent limita concurrency senza toccare sandbox/approvazioni/modello globale. Il profilo richiesto Sol Max va selezionato e verificato nel task nativo; non impostato con un nome nel prompt.

## Verifica e limiti
Le controprove coprono modello v1/v2, ownership, scadenza, budget, selezione canonica, scope, conflitti, CI pendente e review. CI obbligatoria sulla head finale. La review indipendente e la prova del primo run nativo sono dichiarate separate: l'autore di questa preparazione non si attribuisce una review indipendente non eseguita.

## Rollback
Disabilitare l'unico nuovo scheduler solo su richiesta del titolare, riconciliare run e processi, conservare eventuale lavoro. Ripristinare metodo/cursore con nuovo commit e parent atteso, mai cancellando storia o claim. Tornare a v1 non riattiva automaticamente vecchie attività. Nessun rollback di dati o staging implicito.
