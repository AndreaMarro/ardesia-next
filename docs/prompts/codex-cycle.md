# Prompt ricorrente — Ardesia Next / Codex GPT-6.1 Sol Max

Esegui una sola run di implementazione o review di Ardesia Next. Il profilo richiesto è **GPT-6.1 Sol con reasoning Max**, da selezionare nelle impostazioni del task: il testo di questo prompt non attesta che sia configurato. Non cambiare modello né dichiarare verificata una selezione non osservabile. Lavora sul ticket assegnato da Pro e consegna entro 55 minuti, con un'ora come limite esterno. Non usare il tempo residuo per aprire un altro filone.

## Mandato e bootstrap

Repository canonica AndreaMarro/ardesia-next; legacy AndreaMarro/ardesia e ardesia-knowledge solo fonti in lettura. La nuova autorizzazione riguarda questa run Codex configurata dal titolare: supera il vecchio divieto generale, non autorizza job Codex annidati, altri scheduler, acquisti, servizi, produzione, deploy, credenziali o modifiche al legacy.

Conserva la visione: una web app educativa centrata sulla lavagna e la lezione viva, Core/PostgreSQL autorevoli, LessonOS derivato, Remote Client, Host/SDK unici, microcorsi completi, Creator/Knowledge, marketplace, MCP Core e REA. Rispetta diritti, DRAFT, revisioni esatte, scienza, accessibilità e approvazioni umane richieste. L'AI usata per sviluppare non autorizza un provider AI nel runtime.

Leggi l'ora reale all'avvio: chiudi a +55 minuti e, se disponibile, entro scheduledFor+60. Verifica il tempo prima di operazioni lunghe. Senza orologio osservabile, sola verifica circoscritta e chiusura. Verifica checkout, remote canonico senza esporre credenziali, branch, modifiche presenti e toolchain. Non assumere filesystem, cookie o segreti della sessione Pro. Preserva lavoro altrui; usa checkout/worktree isolato se necessario.

Leggi la head di refs/heads/ops/dual-run-state e handoff.json alla medesima SHA. Verifica kind ardesia-dual-run-state, repository, schema e acceptanceEvidence:false; risolvi procedureRef e leggi AGENTS.md e docs/recurring-work.md a quella revisione. Poi leggi docs/START_HERE.md, il task completo della coda, ultimo checkpoint e sola lezione pertinente dalla source.headSha; se quei file non esistono ancora sul candidato, usa quelli a procedureRef dichiarandolo. Leggi gli AGENTS dell'area dalla sorgente effettiva. Usa tools/cycle.mjs dalla revisione del metodo, in una copia separata se non è ancora in main; non trapiantare il metodo nel candidato solo per eseguirlo.

Leggi le decisioni di mandato richiamate dal task nella revisione indicata. Non assumere accesso alle chat di Pro: se una decisione materiale necessaria manca o contraddice le fonti adottate, restituisci la lacuna precisa. Le nuove istruzioni direttamente ricevute vanno acquisite nello storico prima del passaggio secondo operations.md, entro lo scope autorizzato; altrimenti chiedi a Pro quella sola acquisizione. Nessuna ricerca globale delle chat a ogni run.

## Condizioni per lavorare

Occorre packet assegnato a codex, READY o READY_FOR_REVIEW, ancora valido e coerente con head/base/branch/consumer/scope. Codex non esegue ticket coordination, task scaduti, nuove roadmap o il compito di sbloccare account. Se manca un ticket, la head è diversa o il blocco è invariato, termina NO_ACTION/BLOCKED con il motivo; niente ricerca globale o nuova PR di comodo.

Se activeRun esiste, anche scaduto, non prenderne il posto. Acquisisci il claim con revision letta, actor codex, runId univoco e --started-at con l'ora del vero avvio prima del bootstrap; pubblica il cursore come commit figlio della head letta e push normale senza force, poi rileggi. Un conflitto ferma la scrittura. Prima di ogni pubblicazione ricontrolla owner/runId, budget, scope e head sorgente attesa. Puoi scrivere soltanto sul branch isolato assegnato e sulla ref del cursore. Main, preview/m3, staging, policy di accesso e servizi restano a Pro entro i gate esistenti.

## Implementazione o review

Se il ticket è implementation: riproduci il problema con una prova discriminante quando è un bug; implementa la correzione minima per il consumer reale; verifica il caso avverso e le regressioni pertinenti. Mantieni responsabilità e contratti: dominio nel Core, effetti negli adapter, recupero nel client, esecuzione nel Host. Nessuna nuova astrazione senza un bisogno concreto, seconda persistenza, fallback silenzioso a latest o modifica delle soglie per ottenere verde.

Se il ticket è review: esamina sorgente, diff e artefatti grezzi della revisione esatta; produci finding riproducibili per severità o assenza di finding nel perimetro, con limiti. Non modificare la soluzione salvo nuovo ticket di implementazione. Dichiara se hai visto ragionamento dell'autore; review del modello non è approvazione umana/GitHub distinta.

Prima di ogni suite confronta le prove precedenti: commit/tree/sourceDigest, comando/versione, test/configurazione, lockfile/toolchain, ambiente/target e fixture. Riusale se complete, accessibili e applicabili. Il cambio di agente non giustifica un rerun. Un metadato success non dimostra che hai letto gli artefatti. Mantieni verify sulla head finale quando cambia il tree, compresi documenti; il solo handoff non richiede una nuova CI. Conserva FAIL/PENDING/NOT_RUN e non certificare dispositivi fisici da viewport emulati.

Pubblica il cambiamento sulla stessa PR pertinente, dopo confronto della head e senza force. Verifica la run originale della nuova head e raccogli le prove disponibili. La CI può finire dopo il tuo slot: passa WAITING_CI a Pro con URL e identità, senza riavviarla. Non fare merge, deploy, restore remoto o letture di segreti. Non dichiarare M3/prodotto accettati da test locali.

## Miglioramento e consegna

Se scopri un difetto nel metodo, conserva caso, impatto e correzione proposta. Implementalo solo se assegnato e nello scope; Pro deve riesaminarlo. Non autoapprovare, modificare procedureRef, prompt/schedule, modello, autorizzazioni, costi o gate. Se un difetto impedisce lavoro sicuro, ferma quella via e restituisci il blocker con la prova. Evita refactoring del processo senza incidente osservato.

Minuti 0–8: bootstrap; 8–35: un cambiamento; 35–45: verifiche e pubblicazione; dal 45 nessuna nuova modifica; entro 50 handoff; entro 55 chiudi. Usa cycle budget e timeout dei comandi disponibili. Nessun processo/subagente con scritture previsto oltre la run. Se il lavoro non entra, conserva un risultato recuperabile e dichiara INTERRUPTED: non simulare il completamento.

Consegna in italiano: risultato/consumer, file e motivo, base/head/PR/digest, prove riusate ed eseguite, run/artefatti, limiti, rollback, durata e unico passo richiesto a Pro. Usa finish per un packet di review, WAITING_CI, BLOCKED o INTERRUPTED; non riassegnare lavoro a te stesso. finish produce soltanto JSON: pubblicalo con commit/push senza force sulla ref separata e rileggilo. Handoff sulla ref separata, checkpoint nella stessa PR, storico soltanto se il fatto è materiale. Nessun commit/commento ripetitivo se non è cambiato nulla. Non promettere lavoro fuori da questa run.
