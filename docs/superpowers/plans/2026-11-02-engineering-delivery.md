# Ardesia Next — Piano di ingegnerizzazione dello sviluppo

**Versione:** proposta 1.0 — 2 novembre 2026.  
**Stato:** piano da approvare; nessuna modifica al repository, alle automazioni, ai provider o ai permessi eseguita in questa attività.  
**Destinazione proposta dopo approvazione:** `docs/superpowers/plans/2026-11-02-engineering-delivery.md`, collegato dall'ingresso canonico esistente, non trasformato in un secondo backlog.

> Per l'esecuzione: applicare il piano per incrementi verificabili, con implementazione e review in contesti distinti. Le skill `superpowers:executing-plans` o `superpowers:subagent-driven-development` possono guidare l'esecuzione nel runner che le espone. Non sostituiscono i permessi, il protocollo adottato o le verifiche della repository.

## Obiettivo

Ridurre il tempo fra un requisito pronto e una funzionalità effettivamente utilizzabile nella preview protetta. Far collaborare Codex, Pro e, solo dopo qualificazione, OpenCode, mantenendo un solo punto di integrazione, qualità scientifica, sicurezza, persistenza e controllo dei costi.

Il risultato atteso non è un nuovo framework di agenti: è Poiseuille realmente utilizzabile, seguito da una prima unità didattica completa e poi da un microcorso. Numero di agenti, commit e rapporti non sono metriche di progresso del prodotto.

## Architettura proposta

Regia e controllo qualità Pro asincroni; Codex responsabile della consegna e dell'integrazione; al massimo due attività agentiche pesanti concorrenti in copie isolate, compresi i revisori. Un solo processo pubblica cambi ai sorgenti e modifica main, staging, coda e cursore. I permessi restano separati dalle capacità del modello.

Si evolvono Git, gli strumenti `tools/cycle.mjs`, `tools/check-operations.mjs`, `tools/status.mjs`, la CI e i registri esistenti. Nessun nuovo database di orchestrazione, daemon di memoria, scheduler autonomo di OpenCode o autorità applicativa parallela.

**Stack già osservato:** monorepo TypeScript/React/Vite, Node 24, Vitest, Playwright, PostgreSQL, GitHub Actions e preview Vercel. Versioni effettive fissate da `.nvmrc`, manifest e lockfile; nessun aggiornamento di dipendenze implicito nel piano.

## Specifica e vincoli globali

La richiesta corrente propone nuovamente collaborazione ricorrente Pro–Codex: supersede come direzione progettuale l'esclusività del coordinatore Codex, ma non rende già adottato un protocollo concorrente. Serve un passaggio di adozione verificato.

- Repository canonica `AndreaMarro/ardesia-next`; legacy `AndreaMarro/ardesia` soltanto in lettura.
- Una web app, un Core/PostgreSQL autorevole, un Remote Client e un Host/SDK condiviso. LessonOS rimane una proiezione.
- Nessuna nuova spesa, piano, trial oneroso, credenziale, pubblicazione pubblica o operazione distruttiva autorizzata da questo piano.
- Gli account, i dati remoti e i restore popolati esistenti si preservano. Nessun bypass delle protezioni.
- Un solo integratore/publisher remoto; niente force-push o reset distruttivi per accelerare la convergenza.
- Nessuna run modifica il proprio scheduler, modello, budget o privilegi; queste sono operazioni di configurazione controllate.
- Autore e revisore distinti per cambi sostanziali; nessuna identità umana o approval GitHub simulata.
- Prove, modello richiesto, configurazione osservata, runtime effettivo e limiti sono registrati separatamente. Un prompt non prova il modello.
- Le prove storiche rimangono legate a SHA, configurazione, ambiente e perimetro originali. Un artefatto non letto non diventa verificato.
- Le approvazioni scientifiche/editoriali umane e le prove fisiche restano separate dalla CI; i contenuti non approvati restano DRAFT.

## 1. Baseline e diagnosi

Osservazioni lette in questa attività:

| Elemento | Osservazione | Conseguenza |
|---|---|---|
| Cursore | Revisione 106, `procedureRef=c4d38a612a73bc28df434c2d36d36025cf1b1adc`, ultima chiusura `BLOCKED`, `activeRun=null` all'istante di lettura | Rileggere prima di qualsiasi futura scrittura; l'osservazione non è un lock |
| M4 | PR #37, head `062e3d58ed9fa9e5444e402e26a9760f797d3c96`; preparazione Poiseuille documentata | Preservare modello, test e prove; non rifare la preparazione |
| Limite M4 | `M4-CONSUMER-SCOPE`: file UI/server/e2e necessari esclusi dal perimetro; consumer web/PostgreSQL non provato | Correggere la definizione dell'incarico, senza attribuire l'accettazione al solo modello |
| Integrazione | `main=d0aa2014b131335d5c278543cea35098dcefdfd3`; confronto con procedura c4d: 30 commit avanti, 2 indietro, rami divergenti | Riconciliare la genealogia senza perdere le correzioni runtime di main; non fare merge indiscriminato |
| CI | `Verify` esegue installazione, PostgreSQL, verifica, QA, benchmark e browser su ogni PR | Classificare l'impatto; non trattare i soli rapporti come cambi applicativi, ma neppure le policy come semplice documentazione |
| Configurazione agenti | `.codex/config.toml` limita a due thread figli; modello/effort sono demandati al task nativo | Verificare disponibilità e configurazione nel runner prima del routing |
| Automazioni ChatGPT | La vecchia «Ardesia — regia ritirata» è disabilitata nell'elenco accessibile | Non riattivarla con il vecchio mandato; predisporre una nuova configurazione solo dopo il collaudo |

La CI e le review di #37 sono **registrate nelle fonti**; in questa attività non sono state rieseguite né rilette tutte le suite e tutti gli ZIP. Il confronto Git e il codice della CI sono stati letti direttamente.

### Scelta fra alternative

**Solo Codex sequenziale:** meno concorrenza, ma concentra definizione, esecuzione, review e amministrazione nello stesso flusso.

**Molti agenti e scheduler indipendenti:** aumenta il lavoro aperto e i conflitti prima di provare un aumento delle consegne. Non raccomandato.

**Scelta proposta — regia asincrona e integrazione unica:** Pro prepara decisioni e verifica rischi; Codex consegna; specialisti isolati producono patch/evidenze; l'integratore applica transizioni controllate. La regia non deve essere l'autorizzazione obbligatoria di ogni piccola modifica.

## 2. Ruoli e ricorrenze

### Responsabilità

| Ruolo | Compito | Output verificabile | Cosa non fa |
|---|---|---|---|
| Pro — regia | Priorità, dipendenze reali, preparazione di 2–3 incarichi completi, analisi dei blocchi materiali | Proposta di decisione riferita alla revisione esaminata, scope, criteri, rischio e successore | Nessun merge/deploy o aggiornamento concorrente della coda |
| Codex — delivery | Implementare, testare, raccogliere review indipendente, integrare e verificare il percorso autorizzato | PR/candidato, prove, esito di integrazione e prova nella preview | Non cambia unilateralmente policy, scheduler o criteri |
| Reviewer indipendente | Cercare difetti sul diff esatto e sui requisiti grezzi | Finding riproducibili o esito con perimetro e limiti | Non approva il proprio codice né si basa soltanto sul resoconto dell'autore |
| Specialista scienza/contenuti | Recupero selettivo, calcoli indipendenti, ipotesi, unità, attività e feedback | Unità versionata DRAFT e casi di verifica | Nessuna approvazione umana inventata |
| OpenCode pilota | Una seconda analisi o patch delimitata con un solo provider qualificato | Patch o report conforme allo stesso contratto | Nessun accesso a main, DB, staging, scheduler o segreti applicativi |

Le proposte Pro possono vivere in un thread GitHub dedicato e identificato; sono input, non un'altra coda autorevole. L'integratore controlla revisione, autorizzazioni e novità prima di applicarle. Pro può anticipare il lavoro leggendo una SHA immutabile mentre Codex lavora: non serve il lock globale per leggere.

### Cadenza proposta, non configurazione già applicata

| Processo | Avvio iniziale | Budget e risultato |
|---|---|---|
| Codex delivery | Conservare inizialmente il task ogni 90 minuti | 55 minuti massimi dal vero avvio; chiusura/checkpoint osservabili; successione nello stesso slot quando possibile |
| Pro regia | Ogni 6 ore; esempio 01:20, 07:20, 13:20, 19:20 Europe/Rome | 20–30 minuti ordinari, massimo 45 per un problema reale; nessun delta = uscita breve |
| Review di consegna | Alla disponibilità di un candidato, non aspettando la regia periodica | Contesto nuovo; modello secondo rischio; evento nativo solo se disponibile e collaudato, altrimenti richiesta nel ciclo delivery |
| Qualità, costi e apprendimento | Un passaggio nella regia serale già prevista | Analizzare dati incrementali, aggiungere una difesa concreta soltanto per un errore reale |
| Aggiornamento tecnologico | Un passaggio nella regia settimanale | Al massimo una proposta sperimentale utile e misurabile; nessun auto-upgrade |
| OpenCode | Nessuna ricorrenza autonoma nel pilota | Invocazione delimitata dal flusso approvato, con tetto di risorse e timeout |

Un eventuale passaggio Codex da 90 a 60 minuti avviene solo dopo aver misurato durata, disponibilità quote e assenza di sovrapposizioni. Non basta cambiare il timer: prima si riducono attese e riconciliazioni dentro lo slot.

ChatGPT e Codex hanno meccanismi di scheduling e contesti differenti. I task locali richiedono macchina accesa, app e progetto disponibili; il task web non eredita cartelle o credenziali locali. L'eventuale trigger GitHub è una capacità da osservare nell'account, non da presumere. Non si combina implicitamente una ricorrenza temporale con un trigger evento nello stesso task quando la piattaforma non lo supporta.

### Autonomia senza bloccare tutto

Il mandato approvato deve consentire a Codex di scegliere il prossimo incarico READY, ritentare soltanto errori transitori classificati entro un limite, completare una PR e svolgere verifiche già autorizzate. L'assenza di Pro non blocca i normali incarichi pronti.

Cambi di sicurezza, spesa, produzione, autorità o struttura dati richiedono il gate pertinente. Se manca, si blocca quella mutazione e si sceglie lavoro indipendente. Nessuna sostituzione silenziosa del profilo Pro richiesto.

## 3. Selezione dei modelli

Separare sempre **ambiente** (Chat/Work/Codex/OpenCode), **modello**, **modalità di ragionamento**, **effort** e **permessi**.

| Profilo proposto | Impiego iniziale | Escalation |
|---|---|---|
| GPT-6.1 Sol, High | Implementazione ordinaria delimitata e test | Extra High/Max supportato per problemi di concorrenza, persistenza o revisioni difficili |
| GPT-6 Astra, Medium/High | Regia complessa, architettura, diagnosi non risolta, review critica | Effort superiore solo se il compito e il confronto misurato lo giustificano |
| GPT-6 Pro in Chat, basato su Astra | Analisi progettuale/scientifica approfondita e sintesi di decisioni | Non confonderlo con Astra standard nel runner; verificare mode/modello del task |
| GPT-6.1 Terra o altro profilo leggero disponibile | Triage, classificazione, estrazione, inventario, editing strettamente delimitato | Nessuna promozione autonoma di evidenze né review finale di un confine critico |
| Un modello esterno via OpenCode | Seconda opinione o task delimitato del pilota | Accesso a produzione mai derivato da un buon benchmark |

Questa è una **ipotesi di assegnazione**, non una graduatoria dimostrata su Ardesia. Le raccomandazioni del fornitore non sostituiscono un confronto sul progetto. Effort `high`, `xhigh` e `max` non vanno trattati come nomi intercambiabili; usare solo valori supportati dalla coppia ambiente/modello.

Il modello del task principale rimane quello configurato nella piattaforma. La selezione per sottocompito usa profili di subagent o esecutori separati supportati e già autorizzati; non pretende di cambiare il modello principale mediante una frase nel prompt. Non modificare globalmente le impostazioni del client durante una run.

Ogni ricevuta conserva modello richiesto, configurazione effettiva osservabile, versione dell'esecutore, effort/modalità, inizio/fine, test e consumo. Se il backend non espone il modello effettivo, registrare UNKNOWN: non dedurlo dal testo. Per un gate che richiede un profilo verificato, UNKNOWN non è soddisfacente.

### Qualificazione economica e tecnica

Confrontare inizialmente 2–3 profili su 6–10 casi storici delimitati: retry con risposta persa, revisione errata, autorizzazione, scope incompleto, regressione browser e modello scientifico. Medesimi input, toolchain, limite di tempo e test; non fornire all'agente la patch risolutiva. Prima correttezza e rispetto dei limiti, poi tempo totale e consumo, includendo review e correzioni.

Budget iniziale: quote già disponibili, **zero nuovo consumo a pagamento autorizzato**. Work e Codex possono condividere la quota prevista dal piano; le API non si presumono incluse. Nessun fallback a pagamento quando una quota finisce. Una riserva proposta del 20% della capacità pianificata è destinata a review critiche e recovery, se la quota è osservabile. Il numero non è una misura dell'account attuale.

## 4. Contratto unico del lavoro e dello stato

### Incarico READY

Prima dell'implementazione servono: risultato visibile per l'utente; baseline; file e dipendenze necessari per l'intero percorso; owner; classe di rischio; criteri positivi e negativi; ambiente e credenziali richiesti; piano di test; eventuale migrazione; possibilità di rollback; modello/esecutore ammessi.

Per Poiseuille la catena è: modello → manifest/trust/catalogo → Host → UI → salvataggio PostgreSQL → riapertura → studente e autorizzazioni → test browser. I file realmente necessari devono risultare dal diff e dall'analisi delle dipendenze; nessun `packages/**` indiscriminato per risolvere il problema.

Un task con scope insufficiente non parte come sviluppo parziale dichiarato completo. Produce una sola richiesta di ampliamento circoscritta e continua su lavoro indipendente, quando disponibile.

### Registri: meno duplicazioni, non meno controllo

`operations/coordination.json` conserva mandato, contratti, priorità e dipendenze. La ref operativa già esistente conserva claim e ricevute di esecuzione. `tools/status.mjs` resta l'autorità dell'accettazione prodotto.

Nel protocollo successivo lo stato di esecuzione deve avere un solo punto autorevole; gli eventuali riepiloghi nella coda diventano proiezioni generate, non una seconda dichiarazione manuale di DONE. Il passaggio necessita migrazione, lettura compatibile del protocollo precedente e test di interruzione. Non rimuovere OPS-004 prima che il nuovo percorso sia verificato.

Stati di lavoro proposti: READY → CLAIMED → IMPLEMENTED → VERIFIED → REVIEWED → INTEGRATED → DEPLOYED → ACCEPTED. Sono dimensioni distinte: un componente può essere VERIFIED senza essere DEPLOYED. WAITING_CI e BLOCKED conservano il riferimento al risultato esistente. Non richiedere un commit sorgente per ogni transizione.

### Concorrenza e guasti

Un solo integratore possiede i token di pubblicazione e i canali remoti autorizzati. I worker isolati producono patch/commit locali: l'integratore controlla perimetro e base prima di pubblicarli. Inizialmente un incremento applicativo più una preparazione di contenuti/review indipendente. Non modificare lo stesso contratto o file condiviso con due writer.

Riutilizzare il confronto della SHA attesa e i claim esistenti; estendere le guardie, non creare un nuovo servizio distribuito. Una scadenza non prova la cessazione del processo. Per riprendere una scrittura condivisa servono cessazione verificata oppure un meccanismo di esclusione effettivamente applicato al punto di scrittura. Il solo numero nel JSON non è fencing tecnico.

Duplicati di trigger, callback tardive e riavvii devono essere innocui e testati. Un watchdog è «verificato» soltanto dopo una prova reale di arresto dei processi figli e di conservazione del checkpoint.

## 5. Riduzione del costo di CI e amministrazione

### Prima fase: risparmi senza cambiare i gate

Conservare le verifiche obbligatorie. Raggruppare aggiornamenti amministrativi della stessa consegna; eseguire controlli mirati prima della CI; riusare installazioni/cache per identica toolchain e lockfile; acquisire la run originale anziché rilanciarla; eliminare commenti e commit senza delta; non riaprire M3 storica per un semplice cambio del candidato.

Il requisito di verificare la nuova integrazione rimane: un merge su una base diversa può cambiare il comportamento. Non si «risparmia» attribuendo una prova alla SHA sbagliata.

### Seconda fase: CI proporzionata, dopo qualificazione

| Classe | Esempio | Verifica minima proposta |
|---|---|---|
| R0: descrizione/risultato non eseguibile | Nota di stato, riferimento ad artefatto | Schema, diff consentito, integrità dei riferimenti, privacy, coerenza con ricevuta |
| R1: comportamento locale delimitato | Componente UI o renderer senza modifica di autorità | Tipi/confini, unitari pertinenti, browser interessati, controlli del candidato previsti |
| R2: confine critico | Auth, Core, schema, contratti, firme, lockfile, CI, permessi, scheduler, prompt/skill operativi, scelta automatica del modello | Suite completa pertinente, controprove, review indipendente e prove remote quando richieste |
| Sconosciuto/misto | Diff non classificabile o dipendenza incerta | Trattare come R2 |

R0 non può modificare autorizzazioni, criteri, scope o promuovere autonomamente accettazioni. Una transizione di stato è amministrativa a basso rischio soltanto quando applica un contratto già autorizzato e viene validata dall’helper; altrimenti è R2. Il classificatore non può fidarsi dell'etichetta dell'autore. `AGENTS.md`, skill, workflow, configurazioni e politica dei task sono comportamento eseguibile anche quando sono Markdown/JSON.

Per i primi dieci cambi campionati il classificatore lavora in **shadow mode**: propone il profilo, ma gira ancora la verifica completa. Aggiungere controprove dedicate per dipendenze transitive, file rinominati/cancellati, symlink, lockfile, config e modifica dello stesso classificatore. Nessun caso critico può essere declassato; questa soglia è un criterio di pilota, non una prova universale di correttezza.

La riduzione effettiva è una modifica separata di CI e del contratto di evidenza, revisionata e adottata. I test non eseguiti restano NOT_RUN o non applicabili con motivazione, mai PASS. Suite di regressione e collaudi sul candidato finale di rilascio rimangono distinti dall'amministrazione.

## 6. OpenCode: pilota, non terza regia

OpenCode è un ambiente agentico multi-provider, non un modello. Il primo uso proposto è review o generazione di test su una copia isolata di una SHA pubblica, con dati sintetici. Provider, modello e versione sono fissati; si seleziona un solo candidato fra le opzioni realmente disponibili, senza aggiungere servizi per curiosità.

Condizioni tecniche: nessuna credenziale Git di scrittura, Vercel o DB; nessuna cartella personale o `.env` applicativa; rete limitata al provider/fonti approvati; credenziale del solo provider custodita nel canale previsto; condivisione di sessioni e plugin esterni non approvati disabilitati; timeout e budget; output limitato a patch/report.

Il profilo Plan non è da solo una sandbox: la documentazione indica che la shell segue la configurazione dei permessi. Occorre impedire le scritture indesiderate anche attraverso shell e strumenti esterni, preferibilmente con isolamento del filesystem e assenza di token privilegiati. Non basta scrivere «read-only» nel prompt.

Controprove: lettura di segreti, modifica di un file fuori scope, push, comando che scrive tramite shell, richiesta di rete fuori policy e istruzione malevola dentro una issue. Il pilota si ferma se una di queste azioni riesce.

Prima confronto offline/isolato, poi al massimo un task reale non critico. Se tempo totale, qualità o consumo non migliorano, OpenCode rimane escluso dal percorso produttivo. Non si copiano cookie/token di altri client né si presume che una sottoscrizione autorizzi qualunque integrazione.

## 7. Memoria degli errori e qualità del prodotto

Usare `docs/history.md`, `docs/lessons.md` e `operations/agent-evals.json`, già presenti. Un incidente produce: fonte/versione → riproduzione → causa provata o ipotesi → correzione minima → controprova → regola pertinente. La regola deve diventare test o guardia quando possibile; non una nuova pagina da rileggere interamente a ogni ciclo.

| Errore documentato | Difesa verificabile |
|---|---|
| Host/plugin costruito ma non raggiungibile dalla UI | Accettazione attraverso il percorso utente reale |
| Componenti che duplicano Core, auth o memoria | Test dei confini e prova con secondo plugin |
| Report riferito a revisione diversa | Binding SHA/configurazione/ambiente e rifiuto di evidenza obsoleta |
| Retry/ACK tardivo che corrompe il lavoro | Test con identità e risultati realmente differenti, idempotenza e conflitto |
| Chiusura completata ma non adottabile | Interruzioni simulate a ogni passaggio e recupero dalla ricevuta durevole |
| Blocchi ripetuti o vecchio scheduler non osservabile | Bloccare il perimetro reale, trigger esplicito, nessuna ri-indagine senza novità |
| Segreti finiti in log/artefatti | Allowlist, minimizzazione e ispezione dei byte pubblicabili |
| Viewport emulato scambiato per prova su penna/tablet | Gate hardware distinto e dichiarazioni limitate a ciò che è osservato |

Non si promette di non sbagliare mai. Si pretende che gli errori documentati abbiano una difesa testabile e che una ricorrenza dell'errore riveli una lacuna da correggere, senza riscrivere tutta l'orchestrazione.

Per il prodotto: test su browser e viewport reali/emulati dichiarati; tastiera/focus e accessibilità; fisica con casi indipendenti e unità; privacy e revoca; persistenza e ripresa; carico con numero di tratti, studenti e dimensione documenti espliciti. Latenza backend, rete e sensazione della penna sono misure diverse.

La prima unità completa deve comprendere fonte/versione, obiettivo, prerequisiti, spiegazione, previsione, manipolazione, esercizio, feedback, recupero e prova diversa. Una singola unità non va chiamata microcorso completo. Il primo microcorso raggrupperà le unità concordate del patrimonio Fluidi/Termodinamica, senza aspettare Creator, marketplace commerciale, audio completo e ogni dominio futuro.

## 8. Piano di attuazione per incrementi

Tutti i file nuovi indicati sotto sono **proposti**, non esistenti o già implementati. Prima della patch rileggere stato, file effettivi e policy adottata. Nessuna numerazione autorizza a saltare i gate.

### E0 — Convergenza e sblocco utile

**Responsabile:** Codex integratore; review Astra/Sol in contesto distinto.  
**File/oggetti:** genealogia PR esistenti; `operations/coordination.json`, `docs/history.md`, `docs/release-runbook.md` soltanto per la decisione pertinente.  
**Consuma:** main d0aa, procedura c4d, preparazione #37 e ricevute originali.  
**Produce:** baseline riconciliata e perimetro M4 completo autorizzato.

- [ ] Rileggere cursore, main, PR e run; identificare writer effettivi senza assumere che il precedente `activeRun=null` sia ancora attuale.
- [ ] Ricostruire dipendenze e disposition delle PR: conservare/integrare/supersedere con motivo; nessuna chiusura per semplice anzianità.
- [ ] Preparare l'integrazione in un nuovo branch da main corrente; preservare le correzioni runtime d0aa e le prove storiche. Non rebase forzato dei rami esistenti.
- [ ] Estendere esplicitamente il task M4 soltanto ai file effettivamente necessari per consumer, catalogo, persistenza e prove; non usare OPS-004 per auto-ampliare la propria autorità.
- [ ] Eseguire verifiche sul candidato integrato, review e adozione previste; completare il consumer Poiseuille prima di moltiplicare gli esecutori.

**Esito richiesto:** nuovo plugin raggiungibile nell'app, salvataggio/riapertura PostgreSQL, permessi studente e regressione molla; M4 non è ACCEPTED senza le proprie prove.  
**Rollback:** commit correttivo e ritorno all'ultima preview verificata, senza retrocedere o cancellare dati.

### E1 — Contratto READY e controllo preventivo

**File:** `tools/check-operations.mjs`, relativi test, `operations/coordination.json`, template engineering/PR; nuovi `tools/task-preflight.mjs` e `tools/task-preflight.test.mjs` solo se il controllo non entra chiaramente nell'helper esistente.  
**Interfaccia proposta:** `validateTaskReadiness(task, observedContext) -> {ready, blockers, missingPaths, requiredEvidence}`. Una funzione pura valida; il runner acquisisce osservazioni. Nessun provisioning implicito.

- [ ] Scrivere test RED: task M4 richiede UI ma la UI è fuori scope; dipendenza incompleta; profilo richiesto non disponibile; fixture o accesso mancanti.
- [ ] Eseguire i test e conservare il rifiuto discriminante.
- [ ] Implementare validazione e segnalazione unica del blocco; distinguere lettura preparatoria da mutazione autorizzata.
- [ ] Provare task valido e task sconosciuto, cambi di policy e riuso illegittimo di un vecchio READY.
- [ ] Review, Verify della head, adozione e prova su un incarico reale.

**Esito:** nessun incarico dichiarato pronto se non può raggiungere il consumer promesso.

### E2 — Chiusura e ripresa senza PR amministrative ricorsive

**File:** `tools/cycle.mjs`, `tools/cycle.test.mjs`, `tools/cycle-sequential.test.mjs`, `tools/check-operations*`, `docs/recurring-work.md`; schema del cursore esistente.  
**Consuma:** contratto immutabile, ricevute e expected SHA.  
**Produce:** una transizione idempotente e proiezione di stato, con vecchio reader mantenuto durante il passaggio.

- [ ] Test RED: trigger duplicato, ACK vecchio, due claim, arresto dopo pubblicazione PR ma prima della chiusura, riga già chiusa e task riaperto.
- [ ] Definire un solo proprietario di ogni campo di stato; mantenere distinta l'accettazione prodotto.
- [ ] Implementare la minima estensione dell'helper; non nuovi store o motori di stato.
- [ ] Provare migrazione/rollback e interruzione in ciascun passaggio; un timeout non abilita takeover.
- [ ] Dimostrare due consegne reali consecutive senza duplicare implementazione o test validi e senza una nuova catena amministrativa per ogni consegna.

**Esito:** la chiusura verificata rende eleggibile il successore senza un secondo progetto di riconciliazione.

### E3 — Profili modello e revisori

**File:** `.codex/config.toml`, agenti esistenti in `.codex/agents/`, `.agents/skills/ardesia-sequential-*`, `operations/agent-evals.json`; metadati osservabili in `operations/codex-automation.json`.  
**Interfaccia proposta:** `selectExecutionProfile(taskRisk, taskKind, verifiedCapabilities, budget) -> profile | blocked`. Mappa di preferenze esplicita, non negoziazione aperta fra agenti.

- [ ] Test: modello mancante, effort non supportato, quota esaurita, autore uguale al reviewer, modello effettivo UNKNOWN.
- [ ] Configurare solo i profili verificati; nessun fallback silenzioso e nessun aumento di privilegi.
- [ ] Eseguire il piccolo confronto sui casi storici entro le quote autorizzate.
- [ ] Separare risultati di accuratezza, violazione dei vincoli, tempo e consumo; scegliere profili per categoria, non per voto unico.
- [ ] Review della policy e una run reale con ricevuta osservabile.

**Esito:** il nome del modello richiesto corrisponde a una configurazione verificabile o a un limite dichiarato, non a una promessa nel prompt.

### E4 — CI più rapida senza falsi PASS

**File:** `.github/workflows/verify.yml`, `tools/verify.mjs`, `tools/status.mjs` e test pertinenti; eventuali nuovi `tools/check-impact.mjs`/test.  
**Interfaccia proposta:** `classifyChange(baseSha, headSha, dependencyManifest) -> {risk, requiredChecks, rationale}`; default R2.

- [ ] Misurare durata e quota dei passi CI esistenti senza rilanciare suite soltanto per fare statistica.
- [ ] Applicare caching e riduzione delle duplicazioni compatibili con i gate attuali.
- [ ] Scrivere i casi avversi del classificatore, compresa modifica del classificatore stesso.
- [ ] Dieci delte in shadow mode con verifica completa; verificare dipendenze transitive e fail-closed.
- [ ] Adottare eventuale profilo ridotto soltanto con nuova policy e schema evidenze revisionati; gate remoto e suite di release invariati per i rischi pertinenti.

**Esito:** meno costo amministrativo misurato e nessuna affermazione di test eseguito quando non lo è.

### E5 — Ricorrenze Pro–Codex e concorrenza limitata

**File:** `docs/prompts/pro-cycle.md`, `docs/prompts/codex-cycle.md`, `docs/recurring-work.md`, `AGENTS.md`, configurazione/metadati osservabili del task nativo. Configurazione piattaforma separata dalla patch.  
**Consuma:** E1–E3, policy adottata e strumenti reali.  
**Produce:** due processi complementari, non due integratori.

- [ ] Inventariare le sole automazioni Ardesia pertinenti, conservando quelle ritirate; non toccare task personali estranei.
- [ ] Eseguire manualmente il prompt Pro sul nuovo contratto; verificare che produca decisioni utilizzabili e non scritture concorrenti.
- [ ] Configurare/rileggere nome, modello/mode/effort ove esposti, timezone, cadenza, progetto, strumenti e permessi.
- [ ] Prima attivare Pro con il Codex esistente invariato; collaudare contemporaneità in lettura e consumo idempotente delle decisioni.
- [ ] Provare quota finita, app spenta, evento duplicato, run lunga e scheduler inattivo. Nessuna auto-riattivazione o task annidato.
- [ ] Dopo almeno tre cicli osservati, valutare un secondo lavoro isolato e solo dopo la riduzione dell'intervallo Codex.

**Esito:** Pro assente non ferma i task READY ordinari; task critici mantengono il proprio gate. Nessun processo pubblica due volte lo stesso risultato.

### E6 — OpenCode opzionale

**File proposti:** configurazione di progetto `.opencode/` o `opencode.json` soltanto dopo verifica della versione; risultati in `operations/agent-evals.json`; nessuna dipendenza runtime del prodotto.  
**Output:** patch/report con task, base/head, modello/versione, test e limiti.

- [ ] Verificare provider autorizzato, modalità d'accesso, privacy, licenza e budget; senza autorizzazione al costo l'esperimento resta rinviato.
- [ ] Isolare filesystem, credenziali, rete e permessi; testare i tentativi vietati anche via shell.
- [ ] Confrontare un piccolo campione con il profilo già adottato, usando gli stessi test.
- [ ] Consentire un solo task reale non critico, con review esterna all'autore.
- [ ] Integrare solo se il beneficio netto è misurato. In caso contrario rimuovere il percorso senza cambiare il prodotto.

**Esito:** un'opzione sostituibile, non un'altra autorità o ricorrenza permanente.

### E7 — Prova del metodo sul prodotto

**File:** quelli identificati dal contratto M4 e dalla prima unità; `e2e/`, componenti web e contratti effettivamente necessari, con scope preciso approvato.  
**Consuma:** Poiseuille e patrimonio legacy selezionato.  
**Produce:** unità completa assegnabile, persistente e riapribile, distinta da microcorso completo e da approvazione umana.

- [ ] Scegliere un obiettivo reale e fonte/versione; importare soltanto il materiale necessario, con provenienza e diritti.
- [ ] Test RED del percorso completo docente→studente→attività→tentativo→feedback→ripresa.
- [ ] Implementare il minimo percorso con gli stessi Core/Host/LessonOS; nessuna seconda applicazione.
- [ ] Verificare scienza, casi limite, isolamento, revoca, errori/retry e browser sulla stessa versione distribuita.
- [ ] Raccogliere in un unico checkpoint le prove umane/hardware necessarie, senza fingere esecuzioni. Continuare sui lavori indipendenti quando manca il checkpoint.

**Esito:** il metodo ha prodotto valore utilizzabile, non soltanto più velocità nel chiudere ticket interni.

### Comandi di verifica disponibili e ambiente

I comandi seguenti esistono nella baseline esaminata; sono una ricetta per l'esecutore, **non comandi eseguiti in questa attività**. Prima occorre il checkout isolato della revisione assegnata, Node 24 conforme a `.nvmrc` e database locali dedicati come nella CI. Non usare mai URL di database staging/produzione per la preparazione delle fixture locali.

```sh
npm ci
npm run typecheck
npm run check:boundaries
# Solo dopo la configurazione dei database locali dedicati prevista dal repository:
node tools/setup-test-databases.mjs
npm run verify
node tools/qa-integration.mjs
node tools/benchmark.mjs
npm run test:e2e
npm run status
```

Non lanciare l'intera sequenza dopo ogni singola modifica: test discriminanti durante il lavoro, pipeline obbligatoria sulla head finale, lettura dei risultati originali nelle run successive. `status` può terminare senza attribuire ACCEPTED: verificare i campi e le prove, non soltanto l'exit code. Il benchmark non è da ripetere per ottenere un numero migliore; la sua presenza nella pipeline vigente resta fino all'adozione esplicita di E4.

## 9. Misure e regole di arresto

Registrare tempi di attesa, bootstrap, implementazione, test, review, integrazione e rilascio; task di pari classe di rischio; difetti scoperti dopo integrazione; costi/quote quando osservabili. Lavoro di lettura utile non va confuso con burocrazia, e build completata non con risultato fruibile.

Obiettivi **proposti**, non prestazioni già raggiunte:

| Indicatore | Soglia iniziale di valutazione |
|---|---|
| Tempo mediano READY→preview verificata | Riduzione almeno del 30% dopo un campione di 10 incrementi comparabili; risultati esplorativi, non prova statistica definitiva |
| Coordinamento amministrativo sul tempo attivo | Tendere sotto il 20%, esclusa l'implementazione iniziale della correzione del processo |
| Nuove PR implementative simultaneamente aperte | Massimo 3 dopo la riconciliazione storica; se la review accumula ritardo fermare nuove partenze e integrare |
| Lavori pesanti concorrenti | Massimo 2 oltre al coordinamento leggero; reviewer occupa uno slot |
| Incarichi avviati con scope già insufficiente | Zero nei casi coperti dal preflight |
| Violazioni critiche del perimetro, segreti pubblicati, prove falsamente promosse | Zero nei controlli definiti; un caso interrompe il pilota sul perimetro interessato |
| Task pronto in attesa del turno Pro ordinario | Zero, salvo review critica richiesta dal contratto |
| Ripetizione di un blocco noto senza cambiamento del prerequisito | Nessun nuovo ciclo investigativo o spam; una sola escalation materiale |

Con pochi campioni usare mediana e intervallo, non percentili estremi presentati come robusti. Un throughput maggiore ottenuto scegliendo solo task più semplici non è un miglioramento dimostrato.

Rollback del metodo se compaiono doppie scritture, perdita di dati, errore critico nei controlli, crescita incontrollata del lavoro aperto o consumo oltre il limite autorizzato. Conservare ricevute e risultati corretti. Non ripristinare vecchi dati o vecchi scheduler senza riconciliazione.

## 10. Ordine pratico e decisione raccomandata

**Prima:** E0 ed E1, preservando #37 e rendendo il lavoro completabile.  
**Poi:** E2 ed E3; la preparazione editoriale della prima unità può procedere su scope indipendente approvato.  
**Quindi:** E5 con la cadenza Codex invariata; E4 in shadow mode senza indebolire i gate.  
**Infine:** E6 solo con beneficio e budget dimostrabili. E7 misura il risultato durante il percorso, non dopo mesi di perfezionamento del metodo.

Non sospendere l'intero prodotto per costruire la fabbrica. Ogni cambiamento organizzativo deve risolvere un blocco osservato e tornare subito a una consegna didattica. Non assegnare date certe al microcorso prima di misurare due o tre incrementi completi con il nuovo metodo.

**Decisione proposta:** approvare il disegno ibrido, non ancora la sua esecuzione indiscriminata. La prima implementazione deve essere circoscritta a convergenza, scope M4 e contratto READY. Nuovi provider, spese, produzione e mutazioni degli scheduler restano passaggi separati.

## Fonti di controllo

Fonti repository lette tramite connettore GitHub; osservazioni mutevoli da rileggere all'esecuzione:

- R1: cursore operativo, ref `ops/dual-run-state`, revisione 106: `https://github.com/AndreaMarro/ardesia-next/blob/ops/dual-run-state/handoff.json`.
- R2: PR #37, head `062e3d58ed9fa9e5444e402e26a9760f797d3c96`: `https://github.com/AndreaMarro/ardesia-next/pull/37`.
- R3: confronto main/procedura: `https://github.com/AndreaMarro/ardesia-next/compare/d0aa2014b131335d5c278543cea35098dcefdfd3...c4d38a612a73bc28df434c2d36d36025cf1b1adc`.
- R4: lezioni operative alla procedura c4d: `https://github.com/AndreaMarro/ardesia-next/blob/c4d38a612a73bc28df434c2d36d36025cf1b1adc/docs/lessons.md`.
- R5: CI alla procedura c4d: `https://github.com/AndreaMarro/ardesia-next/blob/c4d38a612a73bc28df434c2d36d36025cf1b1adc/.github/workflows/verify.yml`.
- R6: configurazione agenti e package.json alla stessa revisione: percorsi `.codex/config.toml`, `package.json`.
- R7: lettura Automations.peek: vecchia regia Ardesia ritirata disabilitata; non è una lettura del task nativo Codex né della sua configurazione modello.

Documentazione primaria consultata il 2 novembre 2026; disponibilità nel singolo account da verificare:

- O1: `https://learn.chatgpt.com/docs/automations`.
- O2: `https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt`.
- O3: `https://learn.chatgpt.com/docs/agent-configuration/subagents`.
- O4: `https://developers.openai.com/api/docs/guides/reasoning`.
- O5: `https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex`.
- O6: `https://openai.com/index/introducing-gpt-6-1-terra/`.
- C1: `https://opencode.ai/docs/agents/`.
- C2: `https://opencode.ai/docs/permissions/`.
- C3: `https://opencode.ai/docs/providers/`.
- C4: `https://opencode.ai/docs/cli/`.

## Verifica di completezza del piano

Il piano copre regia Pro ricorrente, delivery Codex, profili modello, revisione indipendente, OpenCode condizionato, convergenza Git, scope, CI, incidenti, costi, prodotto e rollback. Nessun test nuovo è dichiarato eseguito. La review di questo piano è una verifica interna di coerenza, non una revisione indipendente da parte di un altro agente o di una persona.
