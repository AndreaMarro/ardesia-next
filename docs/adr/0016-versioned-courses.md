# ADR0016 — Corsi, edizioni e studio personale

Stato: preparazione locale dal mandato diretto del7novembre2026. Non cambia la coda `COURSES-MARKETPLACE`, il cursore operativo o l’accettazione delle milestone. [Fonti](../sources/courses-2026-11-07.md).

Un autore deve poter costruire un percorso e provarlo, poi assegnare una versione precisa. Lo studente deve ritrovare domanda, risposta e aiuti senza ricevere modifiche silenziose al materiale. Studio e Creator usano lo stesso linguaggio visivo e lo stesso Core; nessun servizio o archivio parallelo.

## Identità e autorità

- `Course`: bozza dell’autore, con titolo, presentazione, diritti e unità ordinate. Ogni unità ha ID stabile e revisione indipendente; il Core la incrementa solo se cambia. Un ID rimosso non si riutilizza nello stesso corso.
- `CourseEdition`: immutabile, lega `courseId`, revisione e SHA-256 canonico. Fissare una versione richiede tutti i campi didattici; non certifica completezza scientifica, autore o approvazione umana. Tutto rimane DRAFT.
- `CourseDelivery`: concessione esplicita a un partecipante, distinta dai contenuti. La revoca è definitiva per quell’identità; una nuova assegnazione crea un’altra delivery. Il server verifica che il destinatario sia uno studente attivo, oppure il docente stesso per studio personale esplicito.
- `CourseWork`: risposte append-only, aiuti consultati, unità/fase corrente e scelta di condivisione. Privato per default. Il docente legge solo evidenze esplicitamente condivise e con accesso attivo; la revoca mantiene al partecipante il proprio lavoro esportabile, senza materiali del corso.

Le unità includono obiettivo, prerequisiti, spiegazione, previsione, attività, feedback di riferimento, recupero, transfer e fonti con revisione/diritti. Il feedback di riferimento è materiale consultabile, non soluzione segreta o valutazione automatica. Risposte salvate, consultazione degli aiuti e posizione non diventano voti, mastery o percentuali di competenza.

Un collegamento opzionale a lezione è `documentId + revision`. Il Core ricostruisce quella revisione dagli eventi originali: nessun fallback alla versione corrente. L’assegnazione del corso non crea un’assegnazione della lezione o un consenso di esecuzione lab. I lab collegati sono descritti staticamente; le extension dichiarative usano il renderer esistente con esperimenti transitori espliciti.

## Continuità e recupero

Gli otto comandi pubblici passano dallo stesso endpoint autenticato e dalla transazione PostgreSQL: `save-course`, `create-course-edition`, `assign-course`, `revoke-course-delivery`, `set-course-position`, `record-course-attempt`, `view-course-help`, `share-course-work`. Attore derivato dalla sessione; autorizzazione prima del lookup della receipt. Eventi con attore/ruolo, comando originale e risultato, validati anche tramite replay all’apertura. Nessun secondo ledger.

La recovery conserva comando, ID e revisione esatti. Dopo ACK perso, il callback UI correlato alla receipt adotta soltanto la base effettivamente inviata; una projection più recente non autorizza il rebase della bozza. Le modifiche successive restano aperte. Le risposte sono legate a unità/fase quando si scrive: un cursore cambiato da un’altra scheda non cambia la domanda sottostante. Durante un cambio posizione incerto l’input attende il recupero. Gli aiuti, i materiali e la condivisione non richiedono di scartare il testo aperto.

Un rifiuto osservato invalida immediatamente materiali ed evidenze condivise. La sessione e il proprio testo rimangono disponibili per l’esportazione. Una risposta tardiva di un altro dominio non può ripristinare la projection invalidata; una receipt autentica può essere riconosciuta senza riapplicarne i dati obsoleti. Account, selezione, monotonicità delle revisioni e letture esatte restano barriere distinte.

## MCP e consumer

`ardesia_search_courses`, `ardesia_read_course`, `ardesia_preview_course` e `ardesia://course-format` espongono l’authoring. Preview/apply usa gli stessi save/freeze e le stesse receipt. La lettura dell’edizione restituisce il corso storico, anche al retry dopo modifica della bozza. MCP esclude delivery e lavoro personale, anche se condiviso; non autorizza invii a studenti o pubblicazione. Client MCP ufficiale esterno collaudato sullo stesso HTTP/PostgreSQL; host ChatGPT/Claude/Gemini non attestati.

## Migrazione e rollback

Contratti0.7, snapshot7, SQL005/migration5. Le versioni1–6 si aprono aggiungendo collezioni vuote, senza scritture. Campi/eventi corsi sotto versioni precedenti sono rifiutati; non si trasformano strutture arbitrarie nei payload. SQL005 amplia il CHECK4–7 e conserva righe/revisioni. Il digest semantico dell’importazione device resta nella forma v4, escludendo le nuove collezioni vuote: non cambia l’identità degli import pregressi.

Il backup continua a verificare checksum dei byte originali, binding autore e destinatari; restore solo su target vuoto e con validazione Core. La preview locale è stata salvata prima della migrazione, poi confrontata prima/dopo per assicurare che l’apertura non riscrivesse i workspace.

Rollback applicativo prima di scritturev7: si può usare il sorgente precedente con CHECK additivo. Dopo scritturev7, il vecchio Core non le comprende: conservare backup e versione compatibile; ripristino in ambiente separato e vuoto se necessario, mai downgrade/troncamento del workspace vivo. Rimuovere l’accesso UI non equivale ad annullare i dati.

## Prove e limiti

Controprove Core su versione/hash, fonte esatta, private/share/revoke, self-study, atomicità, actor/receipt/storico corrotti e migrazioni. PostgreSQL reale con runtime limitato; MCP ufficiale esterno; E2E desktop/mobile su autore→edizione→studio→ripresa, permessi, export e ACK persi, conflitto concorrente, cursore concorrente. Report nel pacchetto di consegna, legati a digest/configurazione; i PASS intermedi non certificano le modifiche successive.

Authoring iniziale docente. Non attestati authoring learner generale, corso offline, valutazione docente nel course-work, task/esecuzioni esterne arbitrarie, runtime lab concesso dal corso, pubblicazione o vendita, quattro corsi completi, efficacia didattica e review umana. iPad/Apple Pencil/Safari e app native richiedono prove proprie. I limiti tecnici attuali (100unità,32fonti/unità,2000tentativi,300consultazioni e dimensioni wire) rifiutano esplicitamente l’operazione; niente troncamenti. Crescita ampia richiede misure e paginazione del contratto esistente, non un secondo motore di stato.
