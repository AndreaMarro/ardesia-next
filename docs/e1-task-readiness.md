# E1 — readiness nel consumer canonico

Stato del candidato: implementato in isolamento; Verify della head pubblicata, review indipendente, adozione e prova sul cursore reale vanno osservate separatamente. Non dichiara E1 completato.

La preparazione originale `docs/sources/engineering-e0e7/02_Preparazione_E1.zip` rimane byte per byte invariata (SHA256 `0ec5611ccdabab9fdff33ebaf01572c9d57e8956e8ccf9c5c5285bff70bb4470`). I suoi RED/GREEN e mutanti Node22 sono storia, non prove Node24 di questo candidato. Il nuovo RED sul vero assign accettava una selezione senza osservazioni; il wiring deve farlo fallire. Il controllo sugli array rifiuta anche prototipi ereditati, senza eseguire accessors/toJSON.

## Contratto adottato e osservazioni

La coda unica `operations/coordination.json` schema1.2 aggiunge il solo campo opzionale `readiness` al task. Il campo contiene consumer, rischio, percorsi completi, capability richieste, verifiche, profili ammessi, rollback e durata massima delle osservazioni (300000ms). Owner, dipendenze e criteri restano nel task canonico. I contratti iniziali riguardano ENG-E1 e OPS-004. Un task schema1.2 senza contratto non avvia implementazione; i task futuri richiedono intake e adozione circoscritti, senza allentare dipendenze. Schema1.1 resta leggibile e mantiene la semantica storica; una coda locale1.1 non può sostituire la coda1.2 al procedureRef immutabile.

`taskReadinessRequirements` deriva taskId e procedureRef dal contratto canonico e seleziona esclusivamente uno dei profili approvati. I profili max e xhigh del medesimo modello consentono il contesto manuale e quello nativo già autorizzati; nessun comando cambia le impostazioni della piattaforma. Un profilo diverso, effort UNKNOWN o stato non verificato fallisce.

Il coordinatore è il runner esistente: legge il ref/cursore remoto, esegue i controlli effettivi di Node/fixture/accessi e legge il profilo effettivo dal contesto della piattaforma. Conserva privatamente comando, fonte, risultato e istante. Soltanto dopo costruisce il JSON osservato. Non deduce accessi da vecchi PASS o il profilo dalla configurazione desiderata. Un JSON coerente non autentica accessi o modello: una ricevuta autoasserita non sostituisce queste osservazioni e non autorizza scritture. Se la piattaforma non espone il profilo, questo resta unknown e blocca l'implementazione. Non leggere chat o credenziali per costruirlo.

Il JSON osservato ha esattamente taskId, procedureRef, sourceSha, policyDigest, taskDigest, requirementsDigest, observedAt, capabilities (`id`,`status`) e executionProfile (`id`,`effort`,`status`). I digest canonici di readiness sono distinti dal sourceDigest del prodotto. sourceSha deve coincidere con Git HEAD letto dal consumer al momento del controllo. observedAt è UTC con millisecondi; il contratto non ammette osservazioni future o scadute.

## Consumer e ricontrollo

`cycle.mjs assign` e `finish --outcome HANDOFF` validano la coda al procedureRef immutabile, tutti i criteri, scope dell'intero consumer, dipendenze/blocker/claim e readiness per le implementazioni1.2. Entrambi ricevono `--observations FILE`; senza osservazioni il consumer rifiuta il lavoro. Review, brief e validate restano leggibili.

Prima di ogni mutazione il runner rilegge il claim remoto con expected revision/parent SHA e usa:

```sh
node tools/cycle.mjs budget STATE --actor codex --run RUN --seconds SECONDS --observations OBSERVED
```

Il comando mantiene il controllo originale di owner e budget, rilegge la coda immutabile e Git HEAD e ricontrolla le osservazioni1.2. Emette `readinessChecked:true` solo dopo esito positivo. Una modifica di source/procedure/policy/task/requirements o l'età invalida il vecchio READY e richiede nuove osservazioni. `cycleBudget` esportato è il calcolo temporale puro: il consumer CLI aggiunge la readiness; chiamare solo il calcolo non è il preflight di scrittura. L'esito non è un lock distribuito, una verifica di permessi o un watchdog: restano necessari claim pubblicato/riletto, CAS senza force e il vincolo temporale fino alla mutazione. Non copre modifiche esterne tra controllo e scrittura.

Reconcile usa lo stesso controllo; recover/HANDOFF richiede osservazioni quando seleziona di nuovo implementazione1.2. Le chiusure WAITING_CI/INTERRUPTED che preservano il lavoro non richiedono un falso profilo disponibile. Nessun nuovo store, runner, backlog o gate di accettazione.

## Verifica e adozione

Le prove Node24 coprono helper, assign, HANDOFF e budget CLI con casi avversi per task ignoto, consumer fuori scope, dipendenze, fixture/accesso, profilo/effort, binding e tempo. Questi fixture sono sintetici e non attestano disponibilità reale. Verify include i test tramite `check-config.mjs`. La review deve leggere raw source e criteri sul medesimo candidato. Solo Verify pubblicata e review non autrice permettono l'adozione esplicita; successivamente una prova sul vero cursore completa l'evidenza E1. Se CI è pendente la chiusura è WAITING_CI.

Rollback: nuovo commit che ripristina helper/schema/wiring precedenti e adozione esplicita dopo verifica, senza cancellare ricevute, dati scientifici o claim. Nessuna pubblicazione, promozione DRAFT, modifica scheduler/provider/permessi o accettazione M3/M4 discende da readiness.

## Controprova QA logout

L'intake OPS-20261104-04 aggiunge il solo scenario/helper `e2e/remote-continuity.spec.ts` ai percorsi richiesti e le fixture PostgreSQL/Chromium alle osservazioni. La UI elimina subito il lavoro privato durante logout: il suo heading non prova revoca server. Il caso controllato trattiene il vero logout prima dell'inoltro, osserva UI chiusa e una vecchia-cookie lettura ancora200; dopo rilascio richiede risposta specifica logout200/oktrue/signedOut e una sola vecchia-cookie lettura401. Il helper attende e valida quell'ACK. Nessuna revoca è simulata, nessun polling401 o retry/soglia modificati; gli eventi allegati escludono credenziali e cookie. RED/GREEN e prove finali restano negli artefatti esatti, non implicano device fisici o nuova accettazione remota.
