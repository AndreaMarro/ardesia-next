# Codex sequenziale — protocollo operativo

Versione ARDESIA-SEQ-2, 1 novembre 2026. [ADR 0008](adr/0008-codex-sequential.md), mandato OPS-20261101-07. Sostituisce l'alternanza Pro/Codex: **un coordinatore Codex sceglie, implementa, raccoglie review e integra entro i gate**. Non occorre un altro task per assegnargli lavoro. I ruoli specialistici sono incarichi temporanei, non scheduler autonomi.

## 1. Configurazione una tantum, distinta dalle run
La precedente regia ChatGPT visibile rimane disabilitata e conservata, non duplicata come finto Codex. Il titolare riferisce di non avere avviato il worker: non dedurre dal nome di un task che Codex/Sol Max sia configurato. Nel client nativo scegliere repository, modello/effort disponibili, ambiente e accessi effettivi. La configurazione locale non trasferisce cookie, credenziali o conversazioni da ChatGPT.

Il prompt di setup può creare **un solo task nativo Codex**, dopo una prova controllata, con intervallo esatto di 90 minuti. Richiedere rilettura del task, inclusi ambiente, ricorrenza e destinazione. Non sostituire con due scheduler orari né con ChatGPT generico. Se il client non espone intervalli di 90 minuti o il contesto desiderato, indicare il limite: niente cadenza inventata o arrotondata. L'API di questa chat non seleziona il runtime Codex.

Preferire esecuzioni nuove con contesto versionato; il singolo thread infinito non è l'archivio. Un progetto/worktree locale deve essere effettivamente disponibile al runner; un task web non eredita il filesystem locale. Non modificare sandbox, credenziali, rete o approvazioni per fare funzionare la demo. Errori di accesso vanno distinti dai difetti del codice.

55 minuti di budget per run lasciano 35 minuti fra slot di 90 minuti. Nessuna garanzia di watchdog globale viene dedotta dal testo. Slot saltati non si recuperano in raffica. Una run non crea, modifica, ferma o rilancia task, neppure quando è BLOCKED.

## 2. Un'unica memoria operativa
- `operations/coordination.json`: backlog e dipendenze canonici. `deferred` non è un ordine di implementazione.
- `handoff.json` sulla stessa ref `ops/dual-run-state`: un solo incarico attuale, claim, riferimenti alle prove, prossimo passo. v2 `ardesia-sequential-state`, actor `codex`, `acceptanceEvidence:false`. Nome storico conservato; mai merge o deploy della ref.
- `docs/history.md`: indice unico delle decisioni/incidente/esiti materiali, con archivio storico immutato. `docs/lessons.md`: indice delle prevenzioni, non un altro registro.
- `docs/product-map.md` e D01–D68: visione e criteri originali. I report e `tools/status.mjs` restano l'accettazione di prodotto.

Le prove grandi rimangono negli artefatti/PR originali. Nel cursore solo riferimenti, identità, esito e limiti. La retention degli artefatti non è infinita: preservare le prove indispensabili nell'archivio già autorizzato prima che scadano, senza segreti né nuovi servizi. Se un artefatto è scaduto non dichiararlo letto o riutilizzabile.

## 3. Bootstrap e selezione
All'avvio registrare ora reale, runId e scadenza +55, prima delle letture. Entro otto minuti leggere ingresso, cursore, task completo, ultimo checkpoint e solo la lezione/ADR pertinente. Verificare checkout, dirty state, remote, toolchain, ref sorgente/procedura e capacità richieste dal task. Non fare login ripetuti e non cercare tutte le chat.

Ordine di lavoro: regressione P0/P1 dimostrata; risultato/CI lasciati dalla run precedente; review o completamento della PR già pronta; gate reale della fase; primo incremento indipendente eleggibile. Conservare ciò che è già corretto. Il solo cambio di agente/sessione non invalida le prove.

La coda può avere più consegne pronte in attesa di integrazione, ma un solo incremento in lavorazione. Un task di review non è un nuovo filone implementativo. Separare dipendenza tecnica, disponibilità di una prova e permesso di merge: non inventare una dipendenza dal merge di documenti per poter analizzare il bundle. Un blocker di release non autorizza merge, ma non blocca automaticamente la preparazione isolata già autorizzata.

Se il packet v2 è coordination oppure il predecessore è COMPLETE_INCREMENT con le prove richieste, Codex può selezionare e iniziare il lavoro **nella stessa run**, senza aspettare uno slot di Pro. `assign` non rinnova il tempo né modifica la coda. Il task deve esistere, lo scope deve essere contenuto, le dipendenze implementative completate e i blocker applicabili risolti. Un nuovo task motivato va registrato nella coda, non in un secondo file privato.

## 4. Claim e concorrenza
Leggere ref+JSON alla medesima SHA; validare; emettere claim con revision attesa, actor codex, runId e startedAt reale. Pubblicare come figlio della head letta con expected SHA/no force, poi rileggere. Prima di source/service writes ricontrollare claim, budget, task, scope e head. Un conflict ferma quella mutazione, non autorizza overwrite o retry cieco.

Un activeRun esistente, anche scaduto, non può essere rubato. Per recupero servono prove accessibili di cessazione, riconciliazione dei branch/processi/job e conservazione del lavoro. Una CI pendente può essere conservata come WAITING_CI se non scrive sui sorgenti. La scadenza temporale o l'assenza da un elenco limitato non dimostrano cessazione.

Il vecchio ID di automazione non osservabile resta un fatto storico NON VERIFICATO, **non un interruttore globale del progetto**. Proteggere le risorse concretamente contese tramite claim/ref; in caso di dubbio su un perimetro, review in lettura o patch locale non pubblicata per quel perimetro. Non usare una dichiarazione nel prompt come prova di assenza di altri writer.

## 5. Esecuzione, review e consegna
Un incremento ha consumer, requisito, comportamento osservabile, allowedPaths, caso avverso, verifica finale e rollback. Per bug RED discriminante prima e GREEN dopo; per refactoring equivalenza; per prestazioni workload comparabile. No nuova astrazione senza necessità, nessun secondo Core o store, nessuna implementazione scollegata dalla UI/consumer.

Il root è l'unico writer remoto. Usa al massimo due specialisti pertinenti già disponibili nella sessione; in generale uno alla volta. `ardesia_architect`, `ardesia_reviewer`, `ardesia_science`, `ardesia_ux`, `ardesia_memory` hanno istruzioni repo-locali. I limiti di lettura nelle istruzioni non sono ACL: le capacità effettive dipendono dal parent. Non dichiarare separazione tecnica non osservata.

L'autore non si autoapprova cambiando cappello. Il reviewer riceve sorgente/diff/test e criteri grezzi, non il ragionamento dell'autore né la risposta attesa. Registra contesti distinti, SHA esatta, riferimento e limiti. v2 richiede una ricevuta coerente per COMPLETE_INCREMENT, ma il validatore non autentica l'indipendenza. Se lo strumento subagent non è disponibile, lascia review pending oppure usa una run realmente nuova e non autrice; il tempo trascorso da solo non crea indipendenza. Le approvazioni scientifiche/editoriali umane restano umane.

Una run successiva acquisisce la CI originale, non la rilancia. Finire un task non implica merge o accettazione M3. HANDOFF consente Codex→Codex per un incarico successivo, mai Pro obbligatorio. Non scartare un'implementazione aperta o una CI pendente per aprire un nuovo lavoro: lascia il risultato nella PR e nel parent Git, completa o dichiara il blocco.

## 6. Prove da riusare e prove da ripetere
Riuso solo con sorgente/commit/digest, comando, versione, lockfile, ambiente e fixture applicabili e accessibili. Dichiarare chi ha letto i byte e chi riusa la verifica. Metadato success non significa artefatto letto. Una nuova head sorgente (anche documentale) mantiene Verify obbligatorio; il solo cursore/commento non cambia il digest. Conservare FAIL/PENDING/NOT_RUN, skip, flaky e limiti. Non alterare digest, soglie o gate per risparmiare test.

Nuove prove remote solo per target, identità, configurazione o comportamento interessati. Benchmark isolati escludono ciò che non misurano: rete/TLS/penna fisica/rendering non si inferiscono. Non attribuire miglioramenti a differenze di macchine o sottrazioni di mediane.

## 7. Avanzamento oltre M3 e M4
Il mandato comprende tutta la mappa, non solo la fondazione. Rimane una sequenza di dipendenze reali:
1. M3: dodici controprove originali sul candidato remoto protetto e restore sicuro; output del gate originale ACCEPTED.
2. M3-TRANSITION: conservare baseline/prove e separare accettazione storica da verifiche del nuovo candidato; aggiornare coerentemente motore e guardie, senza rietichettare vecchi report.
3. M4: secondo dominio sullo stesso Core/Host, modello scientifico verificato, costo del riuso misurato e contratto di evidenza nel motore esistente.
4. Unità verticali nei 18 ambiti: lezione→tentativo→feedback→ripresa; microcorso completo; Knowledge/Diario; audio/replay; Creator; marketplace; gestione docente; portabilità; MCP Core e REA selettivo.
5. M5 e successive release: UX/scienza/sicurezza/performance/device/umanità richieste sul candidato; nessuna produzione implicita. M5 non cancella gli ambiti della visione ancora aperti.

I quattro corsi restano Strumenti/meccanica, Fluidi/termodinamica, Elettricità/magnetismo, Onde/ottica/radiazioni; 52/57/33/58 sotto-obiettivi editoriali storici, non accettazioni Next. Un'unità include fonte/revisione/diritti, prerequisiti, spiegazione, previsione, attività, feedback, recupero e transfer. I contenuti rimangono DRAFT finché la review richiesta non esiste. Creator, commercializzazione e pagamenti non derivano automaticamente dal catalogo first-party M2.

Quando una fase è realmente accettata, Codex aggiorna la coda e seleziona il successore senza chiedere una nuova autorizzazione operativa ordinaria. Non rimane fermo su un gate già dimostrato. Nuove spese, privilegi, pubblicazione commerciale/produzione e prove umane non vengono auto-autorizzati. Se una capacità manca, il blocco è circoscritto: proseguire solo su lavoro indipendente eleggibile; non dichiarare completato ciò che manca.

## 8. Contesto aggiornato e apprendimento
Nuova istruzione materiale direttamente vista → voce nello storico con ID, data, fonte, ambito, task interessati, supersessione esatta. Aggiornare solo le righe coinvolte di coda/mappa e citarne la revisione nel packet. Una chat non accessibile non è una fonte letta. Non importare conversazioni private o dati personali nel repo pubblico. Le ricerche Personal Context sono riepiloghi parziali, non una lettura integrale delle chat.

Riordinare lavoro eleggibile in base a dipendenze e valore osservabile, non a quantità di file. Dopo due cicli senza avanzamento per causa sconosciuta fare una sola diagnosi circoscritta; se il blocker è già spiegato, attendere il suo trigger senza ripetizioni. Non creare nuovi registri o agenti per nascondere un blocco di credenziali.

Miglioramento del metodo: incidente reale → causa/ipotesi → piccola patch → caso e controesempio → review separata → verifiche della stessa revisione → adozione e rollback. Non riscrivere schedule, modello, permessi, missione, soglie o gate dalle run. Non più di dieci minuti per una proposta non bloccante; prima il prodotto. Dopo ogni dieci incrementi utili, compattare soltanto indici e istruzioni operative ridondanti, conservando fonti e decisioni originali. Il numero dieci è una scelta operativa, non una metrica di efficacia già provata.

## 9. Strumenti e chiusura
La CLI legge JSON locale ed emette JSON; non scrive file, non autentica prove e non contatta GitHub. Tenerla nel checkout della revisione adottata, separata dal candidato applicativo se necessario.

```sh
node tools/cycle.mjs validate /tmp/ardesia-state.json
node tools/cycle.mjs brief /tmp/ardesia-state.json
node tools/cycle.mjs claim /tmp/ardesia-state.json --revision REV --actor codex --run RUN_ID --started-at ACTUAL_START_ISO
node tools/cycle.mjs assign /tmp/claimed.json --revision REV --actor codex --run RUN_ID --packet /tmp/task.json --queue operations/coordination.json
node tools/cycle.mjs budget /tmp/assigned.json --actor codex --run RUN_ID --seconds 300
node tools/cycle.mjs finish /tmp/assigned.json --revision REV --actor codex --run RUN_ID --outcome WAITING_CI --packet /tmp/result.json --summary 'Risultato e limite osservati'
```

REV e RUN_ID sono quelli realmente letti, non costanti. Prima migrazione v1→v2: `migrate STATE --revision REV --procedure-ref SHA --packet PACKET`; ammessa solo senza activeRun, con nuova decisione adottata, writer riconciliati e storia conservata. Il packet iniziale è READY/coordination/codex, non una falsa accettazione prodotto. Non rilanciare la migrazione a ogni slot.

Entro 45 minuti terminare nuove modifiche; entro 55 rilasciare claim e consegnare task/consumer, base/head/PR, prove eseguite/riusate, review, stato di pubblicazione, limiti, rollback e unico passo seguente. Se nulla cambia, NO_ACTION breve senza nuovi commit/commenti. Nessuna disattivazione autonoma dello scheduler.

## Fonti primarie per il setup
- https://learn.chatgpt.com/docs/automations — task nativi, contesti, intervalli e verifica del primo run.
- https://learn.chatgpt.com/docs/build-skills — `.agents/skills`, frontmatter e caricamento progressivo.
- https://learn.chatgpt.com/docs/agent-configuration/subagents — `.codex/agents`, impostazioni ereditate e specializzazione.
Documentazione consultata il 1 novembre 2026; le capacità effettive del client devono comunque essere osservate.
