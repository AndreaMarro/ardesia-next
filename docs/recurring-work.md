# Due procedure ricorrenti: Pro e Codex

Versione: ARDESIA-DUAL-1. Mandato del 1 novembre 2026, Europe/Rome. **PREPARATE, NON PIANIFICATE DA QUESTA CONSEGNA.**

Il titolare configura una run ChatGPT Pro e una Codex **GPT-6.1 Sol, effort Max**. Il modello si seleziona nel client; il prompt non lo cambia. Questa coppia usa lo stesso prodotto, la stessa coda e le stesse evidenze. [ADR 0007](adr/0007-paired-recurring-cycles.md) registra autorizzazioni e supersessioni; [operazioni](operations.md), [lezioni](lessons.md) e [mappa prodotto](product-map.md) conservano il metodo precedente.

## 1. Prima attivazione, una sola volta

Il titolare deve sostituire o mettere in pausa la precedente attività `6adbfad145dc81919b36fc0cdf0eed0c` prima di attivare la coppia. Pro verifica la configurazione e che una run precedente non sia ancora attiva; se non può attestarlo, mantiene la nuova coppia senza scritture di prodotto. Questa consegna lascia quella attività invariata.

Entrambe le sessioni devono poter leggere la repository e il cursore, aggiornare la ref del cursore senza force e leggere il tempo reale. Codex deve avere checkout, Node/toolchain del progetto, branch isolato e possibilità di pubblicare soltanto i branch assegnati. Le credenziali e le connessioni si verificano nell'ambiente di ciascuna run: non vengono ereditate automaticamente dalla chat o dal computer dell'altro ruolo. Nessun acquisto, nuovo token o nuovo servizio è implicito. Il mancato accesso di un ruolo non autorizza a prestargli segreti dell'altro.

Esempio di cadenza, da scegliere nell'interfaccia: Pro 00:00,03:00,06:00,…; Codex 01:30,04:30,07:30,…, **Europe/Rome**. Sono otto run per ruolo al giorno se estese alle 24 ore; nessun obbligo di consumare un'ora per run. Lo sfalsamento lascia 35 minuti tra chiusura ordinaria e slot successivo, ma ritardi e crash richiedono comunque il protocollo di ownership. Nessuna run cambia i propri orari o recupera in raffica gli slot saltati.

Il primo Pro riconcilia la transizione, gli accessi e il lavoro già pronto. Il primo Codex non inventa un nuovo incremento: senza ticket valido restituisce NO_ACTION in pochi minuti. OIDC/QA/restore mancanti non diventano disponibili grazie alla pianificazione.

## 2. Le tre fonti, senza duplicazioni

| Fonte | Autorità |
| --- | --- |
| `operations/coordination.json`, ADR e mappa prodotto | Roadmap, dipendenze, vincoli e criteri; aggiornamenti sostanziali versionati nel normale incremento. |
| `handoff.json` su `ops/dual-run-state` | Solo il cursore del lavoro corrente, proprietario temporaneo, ticket, riferimenti alle prove e prossimo passo. `acceptanceEvidence:false`. |
| Commit/PR/run/artefatti e gate originale | Evidenza tecnica e accettazione, nel loro ambito. Un campo PASS del cursore non autentica un artefatto. |

Lo storico materiale resta `docs/history.md`; i commit della ref del cursore conservano i passaggi tecnici. Nessun secondo backlog, RUNLOG o motore di accettazione. Le issue rimangono viste leggibili del blocco; nessun commento identico a ogni tick.

La ref di coordinamento contiene soltanto handoff, README e disabilitazione dei deploy Git. **Mai unirla a main, aprire una PR applicativa da essa o distribuirla.** Non contiene workflow e i suoi push non richiedono la CI del candidato. Non escludere nuovi file dal sourceDigest: sono due tree diversi, con scopi diversi.

## 3. Bootstrap e lettura minima

1. Leggere l'ora reale e fissare la chiusura entro 55 minuti dall'avvio effettivo. Se è disponibile l'ora programmata, usare anche il limite `scheduledFor + 60 minuti`; un avvio tardivo non estende quella finestra. Se manca il tempo reale, sola ricognizione circoscritta e chiusura.
2. Leggere la head di `ops/dual-run-state` e il suo `handoff.json`. Verificare repository, kind, schema, `acceptanceEvidence:false` e campi con `tools/cycle.mjs` dalla revisione di metodo già adottata. La CLI è locale e non esegue rete o scritture. Se il contesto Pro non ha Node, può ricostruire la forma con il suo runtime JSON disponibile e la specifica; deve dichiarare CLI_NOT_RUN e non inventare un'esecuzione del validatore. Se non riesce a verificare in modo affidabile forma, revisione o tempo, resta in lettura.
3. Risolvere `procedureRef`: leggere istruzioni/AGENTS e questo documento a quella SHA. La revisione del metodo e quella del prodotto sono distinte. Un semplice nuovo commit sul branch della PR non viene adottato automaticamente. Per la prima adozione il checkpoint della PR #20 conserva il riferimento verificato; per le successive serve la ricevuta di review descritta sotto.
4. Leggere la voce completa del task, l'ultimo checkpoint materiale e solo la lezione/ADR pertinente dalla `packet.source.headSha`. Se quel candidato precedente non contiene ancora la governance, come la PR #18, usare esplicitamente i file a `procedureRef` e dichiarare questa provenienza transitoria. Un nuovo task introdotto dopo quella revisione deve essere nella coda versionata della sorgente prima dell'HANDOFF. Non copiare il metodo nel candidato per il solo bootstrap e non inventare una seconda coda. Verificare live main, source head/PR, CI e capacità coinvolte. Il brief è un indice, non sostituisce il ticket e i criteri di uscita.
5. I file delle prove e gli AGENTS dell'area provengono dalla revisione sorgente realmente lavorata. Il vecchio divieto Codex è superato solo per la run configurata dal titolare; il vecchio ZERO-LLM runtime non autorizza provider nell'app.

Il fallback alla revisione del metodo recupera istruzioni e task già definiti, non attesta lo stato live del prodotto. La ripresa normale deve stare nei primi otto minuti. Se manca una decisione, fare una ricerca delimitata dal suo nome e dalla fonte indicizzata; non rileggere tutte le chat, tutti i donor REA o tutte le specifiche. Una fonte storica non ripristina eLab o un'architettura superata.

## 4. Ownership: confronto della ref e nessun takeover automatico

Per iniziare una mutazione utile, acquisire `activeRun` con id univoco e actor. Il claim richiede la `revision` appena letta e `startedAt` osservato al vero avvio, prima del bootstrap; `claimedAt` registra invece l'acquisizione. Il tempo già speso nella ricognizione non viene restituito al budget; validare il nuovo JSON, creare un commit il cui padre sia esattamente la head della ref letta e pubblicare **senza force**. Con GitHub usare anche expected SHA; con Git usare push normale, senza rebase o retry cieco. Due commit concorrenti dallo stesso padre divergono: soltanto uno può avanzare la ref.

Dopo la pubblicazione rileggere la ref e verificare il proprio runId. Prima di ogni scrittura al branch sorgente o piattaforma rileggere proprietario, runId, scadenza, incarico e head del branch. Se qualcosa diverge, sospendere quella scrittura e riconciliare. Un reject non autorizza a copiare il proprio JSON sopra quello più recente.

Il claim sulla ref non recinta atomicamente altri servizi. La sicurezza dipende anche dal rispetto del protocollo da entrambi i runner. Se `activeRun` esiste, anche scaduto, l'altro ruolo non lo cancella e non prende il posto del precedente. Pro può recuperarlo soltanto dopo prova accessibile che il runner è terminato, riconciliazione di branch/PR/processi/job e conservazione dell'eventuale lavoro. Una CI ancora in esecuzione può essere mantenuta come WAITING_CI se non scrive sulla repository; un agente o processo di pubblicazione ancora attivo impedisce il recupero. Registrare quella prova nel checkpoint e usare un nuovo commit senza force. Senza prova, restare bloccati.

Un ticket scaduto **senza activeRun** può essere riconciliato da Pro: non autorizza a eseguirne il lavoro prodotto. Codex non lo inizia. Questo impedisce che un incarico vecchio venga applicato a una nuova scena.

## 5. Budget di ogni run

| Minuti dall'avvio | Pro | Codex |
| --- | --- | --- |
| 0–8 | Stato live, handoff, gate, differenze materiali. | Ticket, branch/head, scope, prove riusabili e capacità locali. |
| 8–35 | Review o sblocco concreto; decisione/integrazione permessa; ticket seguente circoscritto. | Un consumer e un cambiamento verificabile; RED/GREEN quando corregge un bug. |
| 35–45 | Prove pertinenti e review del risultato. | Test mirati, pubblicazione della head e CI prescritta. |
| 45–50 | Nessuna espansione; risultato, limiti e prossimo passo. | Nessuna nuova modifica; verifica disponibile e risultato recuperabile. |
| 50–55 | Pubblicare handoff, rilasciare claim e concludere. | Pubblicare handoff, rilasciare claim e concludere. |

Controllare tempo e `cycle budget` prima di operazioni lunghe e almeno dopo ogni blocco di lavoro. Usare timeout dei comandi/strumenti quando disponibili; nessun processo o subagente con scritture previsto oltre la run. Non aprire un task la cui verifica nota non può entrare nel tempo residuo. Se una prova necessaria richiede più tempo, scegliere una fetta più piccola o lasciare la prova esterna tracciata.

La CI esistente ha un proprio timeout di 20 minuti; il suo risultato può arrivare dopo la chiusura dell'agente. In quel caso lasciare **WAITING_CI**, head e run URL; la prossima run legge lo stesso run, senza riavviarlo. Uno slot chiuso non significa incremento o prodotto accettato. Un lavoro incompleto si conserva come INTERRUPTED/BLOCKED, con checkpoint e motivo; non si finge un completamento entro un'ora.

**Limite tecnico:** le fonti ufficiali consultate non attestano un timeout globale di 60 minuti per ogni task nel client dell'utente. Il metodo mira a 55 minuti e controlla il budget delle operazioni; un arresto forzato dell'intero servizio richiede una capacità del runner realmente disponibile. Non prometterla sulla base del prompt.

## 6. Contratto del ticket e della consegna

I `blockers` del packet sono impedimenti all'attività assegnata: READY, READY_FOR_REVIEW e COMPLETE_INCREMENT li richiedono vuoti. Un freeze che impedisce soltanto il merge resta visibile nella coda/policy e non impedisce un ticket di review in sola lettura.

Il `packet` ha un id e un taskId della coda, prossimo actor, disposition, kind, validità, sorgente esatta, obiettivo, allowedPaths, criteri di uscita, evidenze, blocker e nextAction. Non contiene una nuova roadmap o autorizzazioni ai servizi.

- Pro assegna un solo incremento con consumer, base/head, branch isolato, scope, comportamento atteso, controprova, verifiche da fare/riusare, condizioni di stop e rollback. Le condizioni importanti sono nei criteri e nel checkpoint della stessa PR, non in una chat invisibile all'altro ruolo.
- Un successore riservato a Pro, come il coordinamento dell'accettazione M3, usa `HANDOFF` con `nextActor:pro`, `kind:coordination`, `disposition:READY` e `allowedPaths:[]`. Solo Pro può pubblicarlo. È un incarico per la successiva run Pro: non avvia una seconda run né rinnova il budget corrente. Il task deve essere nella coda; la sostituzione conserva l'identità precedente in `lastRun.packetId`, la sintesi e il packet completo nel parent Git. Registrare prima l'esito e le prove del predecessore nella PR/coda; HANDOFF non lo dichiara completato o accettato.
- Codex implementa o recensisce quel ticket; non riassegna task, non modifica il metodo per semplificarsi il test, non integra main e non accede a Neon/Vercel/operator secrets. Può pubblicare il branch assegnato e il cursore solo con claim valido. Miglioramenti ulteriori diventano proposte motivate a Pro.
- Pro riesamina la revisione esatta, confronta le prove e decide il successore entro il mandato. Se è autore di una modifica sostanziale al metodo o al prodotto, la passa a Codex per review separata. Non dichiara indipendente un autore che si approva da solo.
- Per cambiare fase dopo un gate accettato, Pro riconcilia le policy e la coda con l'evidenza originale prima di assegnare la nuova implementazione. Nessun merge durante l'attuale freeze; produzione e attività commerciali mantengono i propri mandati.

| Esito | Significato e seguito |
| --- | --- |
| READY / HANDOFF | Incarico valido per Codex oppure successiva coordinazione Pro, senza dichiarare già prodotto il risultato. |
| READY_FOR_REVIEW | Head/digest, verify PASS e risultato pronti per l'altro ruolo. |
| WAITING_CI | Head pubblicata, run originale pendente; Pro ne acquisisce l'esito. |
| BLOCKED | Prerequisito concreto; prossimo controllo legato a un cambiamento. |
| COMPLETE_INCREMENT | Microincremento con verifiche e review riferite alla stessa identità; non M3/prodotto ACCEPTED. |
| INTERRUPTED | Lavoro conservato ma criterio non raggiunto; ripresa esplicita. |
| NO_ACTION | Solo esito della run, senza commit/commenti identici se lo stato non è cambiato. |

## 7. Riuso delle prove e memoria

Confrontare repository, commit/tree/sourceDigest, comando/versione, test/configurazione, lockfile/toolchain, ambiente/target e fixture. Una prova completa e accessibile con stessa identità e ambito si riusa. Il passaggio Pro↔Codex e l'aggiornamento del solo cursore non invalidano il candidato. File runtime, test, lockfile o documenti nel tree sorgente cambiati richiedono la CI prescritta sulla head finale. Nessun rerun solo perché è cambiato il modello o perché un report è vecchio di poche ore.

Il campo `access:artifact` descrive una lettura effettivamente compiuta e registrata dal precedente verificatore; chi riusa dichiara quel riuso, non di aver riscaricato i byte. Metadato success e artefatto letto restano distinti. Conservare FAIL, PENDING, NOT_RUN e i limiti; niente falsi PASS da schema valido. La CLI verifica la forma/identità dichiarata, non l'autenticità dei riferimenti.

La PR contiene risultato, delta, review, CI e limiti. Lo storico registra soltanto decisioni, incidenti e passaggi materiali. Lezioni aggiornate solo quando cambia ciò che un agente deve fare. Per incidenti, preservare la sequenza: sintomo, causa confermata/ipotesi, correzione e verifica. Il tentativo fallito non viene cancellato da un successivo verde.

## 8. Avanzamento verso la visione

Pro sceglie il primo task eleggibile della coda dopo regressioni P0/P1 dimostrate. PR18 e PR20 già pronte non diventano nuovi filoni. Se M3 è bloccato e non esiste un incremento indipendente autorizzato, entrambe le run possono terminare presto.

Quando i gate permettono il passaggio, i risultati richiesti sono unità verticali: un secondo modello sullo stesso Host/Core; un obiettivo di microcorso con spiegazione, attività, feedback, recupero e transfer; un pack DRAFT componibile/salvabile/riapribile; un item marketplace attraverso consenso/uso/riapertura/disattivazione; una lettura MCP utile a un host verificato; un donor REA motivato da un consumer. Ogni unità conserva diritti, revisioni, privacy e review. Non confondere numero di quiz, file, agenti o test con l'apprendimento o la chiusura del prodotto.

## 9. Miglioramento e riorganizzazione controllati

Un incidente verificato o lavoro ridondante misurato attiva il curatore. Una normale run non ricomincia l'audit del sistema. Correzioni minime con caso, controesempio e rollback; regole di sicurezza e accettazione invariate. Per migliorie non bloccanti riservare al massimo dieci minuti di analisi/proposta e completare prima l'incremento; un difetto del protocollo che impedisce lavoro sicuro diventa esso stesso il task prioritario.

Codex può proporre e implementare una correzione assegnata; Pro la riesamina. Se Pro è autore, Codex esegue la review. Test mirati e CI sulla nuova revisione precedono l'adozione. Solo Pro cambia `procedureRef`, con claim attivo, dopo avere letto review dell'altro ruolo e CI coerenti con la nuova SHA; registra precedente/nuova SHA e prove nella PR e nello storico, poi pubblica il cursore con confronto della ref. `finish` preserva quel puntatore: non lo cambia implicitamente. Questo aggiornamento esplicito è distinto dal completamento di un ticket e richiede una revisione del cursore nuova, validata.

Sono riordinabili i task ancora eleggibili della stessa fase in base a dipendenze, regressioni e valore utente. Non sono auto-modificabili missione, gate, soglie, modello scelto, budget, credenziali, costi, pubblicazione, schedule o prompt salvati. Nessuna nuova flotta di agenti. Se una riorganizzazione richiede quei cambiamenti, consegnare una proposta concreta senza applicarla.

Misurare dati reali dai checkpoint: minuti alla ripresa, durata lavoro/verifica, motivi di rerun, regressioni, blocchi e risultati utente. Non inventare percentuali di efficienza. Due cicli senza progresso per una causa non ancora spiegata richiedono una sola diagnosi delimitata. Un blocker già spiegato e invariato attende il proprio trigger: non genera nuovi audit, test o documenti a ogni coppia di run.

## 10. Strumenti pronti e pubblicazione del cursore

Eseguire la CLI dalla revisione delle procedure verificata, anche quando il checkout runtime è ancora sulla main precedente:

```sh
# Da acquisire al vero inizio della run, prima delle letture.
ARDESIA_RUN_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
node tools/cycle.mjs validate /tmp/ardesia-cycle.json
node tools/cycle.mjs brief /tmp/ardesia-cycle.json
node tools/cycle.mjs claim /tmp/ardesia-cycle.json --revision 0 --actor pro --run pro-UNIQUE --started-at "$ARDESIA_RUN_STARTED_AT"
node tools/cycle.mjs budget /tmp/ardesia-claimed.json --actor pro --run pro-UNIQUE --seconds 300
node tools/cycle.mjs finish /tmp/ardesia-claimed.json --revision 1 --actor pro --run pro-UNIQUE --outcome HANDOFF --packet /tmp/next-packet.json --summary 'Risultato verificato e prossimo incarico'
```

I numeri 0/1 e l'id sono esempi da sostituire con quelli letti, non valori fissi. Claim/finish emettono JSON su stdout: salvarlo in un file temporaneo fuori dal tree candidato. Nessuna scrittura remota è effettuata dalla CLI. Pubblicare solo `handoff.json` su un checkout separato della ref di coordinamento, dopo confronto del padre remoto; fare commit e push normale della ref, senza force. In alternativa usare gli strumenti GitHub create-tree/create-commit/update-ref con parent ed expected SHA esatti. Verificare il risultato remoto prima di agire sul prodotto.

Il source checkout non contiene lo stato vivo del cursore. Non copiare automaticamente l'intera ref del metodo nel candidato per poter eseguire lo script. Usare una copia separata della revisione delle procedure; niente segreti nei file temporanei o nel cursore pubblico.

## Fonti ufficiali e limiti

- [Attività pianificate](https://learn.chatgpt.com/docs/automations): modello/effort del task, contesti e permessi; web senza cartella persistente tra run.
- [Modelli](https://learn.chatgpt.com/docs/models) e [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol): Max e disponibilità del client; nessun modello imposto dal solo testo.
- [Configurazione](https://learn.chatgpt.com/docs/config-file/config-reference): timeout specifici degli strumenti non attestano un timeout globale del task.
- [Preparare prima una run](https://developers.openai.com/training/walkthroughs/scheduled-tasks): prova del prompt e verifica delle prime esecuzioni.
