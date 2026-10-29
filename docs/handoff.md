# Handoff operativo — Ardesia Next

**Aggiornamento M1:** [plugin verificato, oggetto laboratorio e migrazione v2](m1-delivery.md). Le sezioni M0 seguenti conservano la decisione di fondazione; il nuovo comportamento M1 è descritto nell’aggiornamento e nell’ADR 0004.

29 ottobre 2026. Questo documento definisce il metodo di integrazione e i gate. Gli esiti effettivi devono provenire dalle prove del candidato e dallo stato generato.

## Regola operativa

Un solo coordinatore integra i moduli e cura GitHub/Vercel. Ogni attività ha un proprietario, file assegnati, consumer e criterio di uscita. Analisi e QA possono lavorare in parallelo; due agenti non modificano gli stessi file contemporaneamente. Nessuna attività avvia Codex.

Se una modifica oltrepassa l'ownership, il proprietario comunica al coordinatore il contratto necessario e attende l'assegnazione del file. Non risolve il problema creando un duplicato, un secondo store o un'altra app.

## Ownership

| Area | Responsabile | Coordinamento richiesto |
| --- | --- | --- |
| Architettura, manifest di workspace, lockfile, CI, stato operativo e release | Coordinatore/integratore | Ogni modifica trasversale |
| `packages/contracts` e `packages/core` | Core | Cambi di schema e API con tutti i consumer |
| `packages/lesson-os` | Continuità/Core | Visibilità, revisioni e proiezioni con Core |
| `packages/plugin-sdk` e `packages/plugin-host` | Plugin | Contratti con Core e revisione sicurezza |
| `packages/ui`, `apps/web`, design token | Prodotto/UX | Stato autorevole con Core; comportamento host con Plugin |
| Controlli indipendenti e controprove | QA | Report prima di eventuali modifiche fuori dal proprio perimetro |
| GitHub, PR, merge e Vercel | Coordinatore/rilascio | Candidato esatto e autorizzazioni del mandato |
| Fonti, ADR e matrice criteri | Architettura/documentazione | Nessuna autoapprovazione dei gate |

I ruoli non implicano agenti sempre attivi. Il coordinatore assegna file concreti prima del lavoro; una sola persona può svolgere più ruoli. Le modifiche a `AGENTS.md` e ownership restano coordinate.

## Handoff minimo di ogni attività

Il passaggio contiene:

1. Problema risolto e comportamento osservabile.
2. File modificati, contratti toccati e consumer effettivo.
3. Commit o base di lavoro; working tree sporca dichiarata.
4. Comandi/prove eseguiti, esiti e artefatti con SHA.
5. Casi non verificati, blocchi e condizioni di ripristino.
6. Prossima azione minima, senza aprire nuovi filoni.

“Compila” non significa “è approvato”; “READY” non significa “percorso completo”; una vista locale non è prova multiutente.

## PR e integrazione

Le PR sono piccole e indipendenti per quanto possibile, con motivazione, comportamento, rischio e prova. Il coordinatore verifica la SHA finale dopo ogni integrazione; un cambio di codice invalida le prove che dipendono da quel cambiamento.

Non aggiungere un'altra PR per documentare un difetto che può essere chiuso nel perimetro corrente. Le PR vanno portate a conclusione: integrate dopo il gate, oppure chiuse con motivazione e lavoro utile conservato. Non assegnare reviewer o inviare messaggi esterni senza l'autorizzazione necessaria.

Il legacy resta in sola lettura. Il recupero selettivo conserva repository, SHA, path, hash e licenza quando si copiano file. Il donor deve avere un consumer e una prova; una dipendenza installata non conta come funzionalità accettata.

## Evidenza sul candidato

Ogni risultato deve distinguere:

| Livello | Che cosa registra |
| --- | --- |
| Sorgente | Repository, branch, SHA e stato pulito/sporco |
| Verifica locale | Ambiente, comando, esito e artefatto |
| CI | Run, job, SHA testata, conclusione e required/advisory |
| Build | SHA sorgente dichiarata, output e configurazione rilevante |
| Distribuzione | Deployment, ambiente, SHA, protezione e stato |
| Percorso browser | URL/versione, flusso eseguito, viewport e limiti |
| Accettazione umana | Revisore, candidato, casi osservati e decisione |

Lo stato operativo si genera da questi dati e dalle verifiche eseguite. Non si scrive manualmente un PASS per chiudere una tabella. In caso di blocco registra l'azione fallita, il motivo preciso e il lavoro ancora utilizzabile.

I metadati del build possono identificare il commit sorgente senza modificare nuovamente il sorgente per inserirvi la sua stessa SHA. Le prove post-deploy sono artefatti associati alla build; non si attribuiscono retroattivamente a un'altra revisione.

## Gate del mandato attuale

| Traguardo | Condizione di accettazione | Evidenze che non bastano |
| --- | --- | --- |
| **M0 — Fondamento** | Repository privata indipendente; una app compilabile; package e contratti pubblici; tooling/lock/CI; stato generato; recupero motivato; preview protetta associata alla SHA e verificata | Solo documenti, mockup, config CI non eseguita, build locale o deployment READY isolato |
| **M1 — Core e primo plugin** | Contratti Core/Host verificati; primo plugin first-party con modello corretto, stato serializzabile e renderer; consumer reale; prove positive e negative | Un riferimento di tipo, una formula statica o un laboratorio montato fuori dall'host |
| **M2 — Marketplace minimo** | Modulo trovato, verificato, installato con consenso, attivato, montato, usato, salvato, riaperto e disattivato; audit e casi di manomissione/compatibilità/revoca; update/rollback verificati quando dichiarati | Card, pulsante Installa privo di effetto, firma auto-dichiarata o catalogo con soli dati dimostrativi |
| **M3 — Continuità reale** | Lavagna–lezione–laboratorio–salvataggio–ripresa collegati al Core; identità applicative e unica persistenza remota scelte e verificate; ruoli, revisioni, retry e isolamento | SSO Vercel, salvataggio nel browser, attore sintetico, secondo store per aggirare il Core |
| **M4 — Riuso dimostrato** | Secondo modulo scientifico differente sugli stessi contratti/host/Core; modifiche e costo di replica registrati | Seconda demo standalone, copia del player o promessa astratta di estensibilità |
| **M5 — Accettazione e rilascio protetto** | UX, scienza, sicurezza, prestazioni, rollback, browser remoto e prove umane richieste superate sul candidato; rilascio protetto | Numero di commit/test, giudizio estetico dell'agente, viewport simulato presentato come device fisico |

Si completa il traguardo corrente prima di ampliare il successivo. M0 può contenere tipi riservati o codice di fondazione per M1; questo non trasforma M1 in DONE. Se manca un elemento obbligatorio, lo stato indica il blocco invece di cambiare il significato del traguardo.

## Criteri di prodotto e limiti di M0

I [D01–D68](acceptance/D01-D68.json) conservano il testo della fonte del 28 ottobre e rimangono NOT_RUN come accettazione del prodotto. Il mandato corrente sostituisce l'ordine storico dei traguardi, non elimina la qualità richiesta.

I criteri specifici Poiseuille si applicano al suo modulo se adottato; altri modelli richiedono casi scientifici propri senza cancellare gli originali. Eventuali “non applicabile” vanno motivati rispetto alla promessa del candidato, mai usati per nascondere una funzione mancante.

M0 è device-only, con un writer, ruoli contrattuali, contenuti DRAFT e zero esecuzione plugin. Non ha login applicativo o database server. Penna, Safari/tablet fisici e osservazione di studenti non sono verifiche effettuabili per deduzione: restano non eseguite fino a prova reale.

## Rilascio e ripristino

Usare soltanto il nuovo progetto Vercel `ardesia-next`. Verificare protezione prima di rendere utilizzabile la preview e legare la build alla SHA. Non creare link di bypass permanenti o promuovere in pubblico per superare un problema di accesso.

Conservare il candidato precedente e la compatibilità del suo schema. Un rollback del codice non implica rollback sicuro dei dati: provare il ripristino prima di dichiararlo disponibile. Nessuna migrazione distruttiva, nuova spesa o promozione pubblica senza autorizzazione.

Se un tool o permesso blocca repository/preview, conservare scaffold, istruzioni e prove verificabili e riportare il blocco preciso. Non dichiarare esistente una risorsa non creata o verificato un percorso non eseguito.

## Misura del rendimento

Contare percorsi e funzionalità accettati, difetti rilevati e chiusi, costo fino all'accettazione e manutenzione introdotta. Commit, token, file, agenti e pagine di documentazione non sono misure di completamento.

