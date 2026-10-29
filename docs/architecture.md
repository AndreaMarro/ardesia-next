# Architettura di Ardesia Next

**Aggiornamento M1:** [plugin verificato, oggetto laboratorio e migrazione v2](m1-delivery.md). Le sezioni M0 seguenti conservano la decisione di fondazione; il nuovo comportamento M1 è descritto nell’aggiornamento e nell’ADR 0004.

Decisione per M0 · 29 ottobre 2026. Questo documento definisce responsabilità e limiti; gli esiti di build, test, CI e distribuzione appartengono alle prove del candidato, non a questa descrizione.

## Obiettivo e perimetro della prima consegna

Ardesia Next è un monolite modulare con una sola applicazione React, Vite e TypeScript. I package sono workspace npm con punti di ingresso pubblici. Il vecchio repository è una fonte di recupero selettivo: non è la base da copiare, modificare o migrare.

La prima superficie mostra una lezione **DRAFT** sul pendolo, con formule, note e fonti. Lavagna, taccuino e lettura presentano gli stessi oggetti Core. Il pendolo è contenuto dimostrativo: M0 non implementa un laboratorio scientifico né esegue un plugin. Un riferimento a una futura istanza di laboratorio non è un renderer funzionante.

M0 usa un solo adapter di persistenza locale al dispositivo e un solo writer. Non include account applicativi, servizio remoto, database server, sincronizzazione fra dispositivi, collaborazione simultanea o approvazione editoriale. Una preview Vercel protetta limita l'accesso degli operatori; non aggiunge queste capacità.

## Confini e contratti pubblici

| Modulo | Responsabilità | Dipendenze consentite | Non possiede |
| --- | --- | --- | --- |
| `packages/contracts` | Schemi runtime, tipi, identità, revisioni, provenienza, comandi, eventi, ricevute e snapshot | Validazione dati; nessun modulo applicativo | UI, storage, autenticazione, effetti collaterali |
| `packages/core` | Validazione dei comandi, documenti e revisioni, ricevute idempotenti, eventi, porta di persistenza | Export pubblici di contracts | Renderer, provider di login, archivio alternativo dei progressi |
| `packages/lesson-os` | Proiezioni deterministiche di continuità e visibilità sui dati autorizzati | Export pubblici di contracts | Registro eventi proprio, storage, decisioni di autorizzazione |
| `packages/plugin-sdk` | Manifest e protocollo versionati, vocabolario delle capacità, stato serializzabile | Schemi e tipi pubblici necessari | React, app, database, concessione autonoma di permessi |
| `packages/plugin-host` | Policy di fiducia e compatibilità; successivo ciclo di vita delle istanze | SDK pubblico e porte esplicite | Internals dell'app, identità indipendenti, potere di approvare contenuti |
| `packages/ui` | Token e componenti di presentazione riusabili | React e soli tipi pubblici necessari | Registri educativi, autenticazione, scritture autonome dei dati |
| `apps/web` | Composition root, navigazione e viste; scelta dell'adapter | Export pubblici dei package | Secondo Core, secondo log, copie dei documenti per ciascuna vista |

Le dipendenze esterne effettive sono quelle del lockfile. La tabella definisce i confini ammessi e non autorizza l'aggiunta preventiva di una dipendenza.

Ogni package espone `src/index.ts` attraverso il proprio export pubblico. Nessun consumer importa `src/internal`, un percorso relativo di un'altra app o dettagli del provider. L'app può comporre i servizi; i servizi non importano l'app. I controlli di confine in CI devono verificare queste regole sul sorgente.

## Oggetti educativi condivisi

Un oggetto conserva ID, tipo, titolo, revisione, stato editoriale, contenuto, collocazione e provenienza. Le forme di base M0 sono nota, formula, fonte e tratto di penna. I collegamenti usano gli ID degli oggetti; non duplicano dati o ownership.

La fonte esplicita editore, localizzatore, revisione dichiarata e licenza. Le citazioni interne puntano a fonte e revisione precise. Un URL è un localizzatore: da solo non garantisce l'immutabilità del contenuto remoto. L'acquisizione di contenuti con hash e conservazione verificabile richiede un consumer e una futura procedura dedicata.

Lavagna, taccuino e reader sono viste del medesimo documento. Un cambio di vista non crea un nuovo documento, un evento educativo fittizio, un secondo stato scientifico o una nuova misura di progresso. Lo stato effimero di UI — selezione, pannello aperto, viewport — resta distinto dal lavoro salvato.

I contenuti nascono DRAFT. M0 non contiene un comando di approvazione editoriale. La proiezione studente non promuove bozze e rimuove i collegamenti a oggetti nascosti. Questa proprietà di proiezione è necessaria, ma non sostituisce l'autorizzazione server.

## Un'unica transazione logica

La porta di persistenza M0 è `StorageAdapter.read/write`. Il Core esegue il comando su una copia isolata dello snapshot:

1. Valida attore, schema del comando e identità idempotente.
2. Verifica ownership prevista dal contratto locale, riferimenti e revisione attesa.
3. Applica la modifica e costruisce evento e ricevuta.
4. Valida lo snapshot risultante.
5. Scrive **documenti, eventi e ricevute insieme** con un solo rimpiazzo atomico dell'adapter.
6. Aggiorna lo stato in memoria e restituisce la ricevuta soltanto dopo la scrittura riuscita.

Lo stesso ID di comando con lo stesso attore e payload restituisce la ricevuta già registrata. Lo stesso ID con payload differente è un conflitto. Una revisione attesa non corrente non autorizza un overwrite silenzioso.

L'atomicità è un obbligo dell'adapter; la firma TypeScript non la garantisce da sola. Un adapter che scrive tre archivi separati o modifica parzialmente i dati prima di fallire viola il contratto.

Uno snapshot persistito non valido deve bloccare l'apertura senza essere azzerato o sostituito automaticamente. Una scrittura fallita non deve essere descritta come “Salvato”. L'implementazione locale non offre compare-and-swap distribuito o merge fra tab/browser: la promessa M0 è un solo writer per workspace.

## LessonOS e autorità dei dati

Il Core possiede il registro degli eventi e le ricevute. LessonOS riceve snapshot e flussi autorizzati e produce proiezioni ricostruibili: attività, ultimo cambiamento, riferimenti e continuità. Non conserva un altro ledger e non attribuisce una padronanza.

Il metodo di snapshot completo del Core è destinato all'amministrazione locale/esportazione: non va esposto come endpoint remoto senza filtro. Quando arriverà un servizio remoto, l'attore sarà derivato dalla sessione verificata e le policy saranno applicate sul server. L'attore passato dall'app M0 è un dato di sviluppo, non un'identità autenticata.

## Plugin e catalogo

L'SDK ha un'identità di versione distinta da quella del protocollo e dello schema dello stato. Il manifest deve essere rigoroso: publisher, versione del modulo, compatibilità SDK, capacità, provenienza, licenza e integrità del bundle sono obbligatori. La fiducia deriva da chiavi fissate nel trust store dell'host, non da una chiave auto-dichiarata nel manifest.

M0 mantiene l'esecuzione disabilitata. Manifest e policy preparano M1; non certificano installazione, isolamento, firma già verificata in un percorso reale o disponibilità di un marketplace operativo. Nessun upload di codice terzo, `eval`, import dinamico da URL arbitrario o `srcDoc` legacy.

Il catalogo futuro distingue moduli eseguibili e contenuti dichiarativi, mantenendo identità, versione e provenienza comuni. Un pack non ottiene capacità esecutive perché appare accanto a un plugin. Il futuro Creator usa gli stessi contratti di pubblicazione e revisione. Vendite, recensioni, fatturati e pulsanti di checkout non vengono simulati.

Per la policy di esecuzione e il ciclo previsto: [ADR 0002](adr/0002-plugin-trust.md).

## Recupero selettivo e provenienza

Baseline legacy verificata: `AndreaMarro/ardesia@5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`. Le decisioni dettagliate e i percorsi letti sono in [recupero legacy](sources/legacy-review.md).

Si recuperano comportamenti verificabili: transazioni/ricevute del Core, revisioni esatte, proiezioni LessonOS, vocabolario del manifest, policy deny-by-default e modelli scientifici puri. Non si trasferiscono shell concorrenti, import diretti da Studio a Web, auth sintetica come auth di produzione, adapter desktop presentati come sandbox web o dipendenze eLab.

Un comportamento reimplementato viene descritto come tale. Un file copiato richiede repository, SHA, percorso, hash e diritti conservati. La mancanza di una licenza generale nel legacy non consente di presentare il codice come open source redistribuibile.

Le fonti progettuali sono state lette integralmente:

- [Atlante del 28 ottobre](https://chatgpt.com/library?file_id=libfile_09076298e4d88191810e594af70cd009&account_id=personal): 36 riferimenti, con anteprime ispezionate.
- [Documento decisionale del 28 ottobre](https://chatgpt.com/library?file_id=libfile_b59da160269c8191ad1172cf016f8f6f&account_id=personal): criteri D01–D68.
- [Lettura visuale e di prodotto](sources/visual-and-product-review.md): B03/B04 per la lavagna, A01 per la lettura, G01 per il taccuino, O01–O04 per provenienza e ritorno al contesto.

La nuova priorità è il ciclo plugin–lezione condiviso. Poiseuille resta un candidato scientifico; non diventa il modello dei dati di tutta l'applicazione.

## Tooling essenziale

React fornisce viste componibili; Vite costruisce l'unica app; TypeScript e gli schemi runtime rendono verificabili i contratti. Gli npm workspaces risolvono i package locali con un solo lockfile. Non sono introdotti Turborepo, microservizi o orchestratori: M0 non presenta un bisogno che ne compensi il costo.

Build, controlli di tipo, test deterministici dei rischi e confini dei moduli devono essere eseguiti dalla CI. Le prove devono distinguere validazione statica, test del Core, verifica browser e gate remoto. Lo stato operativo si genera dai risultati effettivi e conserva SHA, ambiente e limiti; un documento scritto a mano non trasforma NOT_RUN in PASS.

## Distribuzione e passo remoto

Il progetto Vercel dedicato è `ardesia-next` nel team dell'utente. La prima distribuzione è una preview protetta associata al commit candidato; nessuna promozione pubblica. Esistenza del progetto, protezione configurata, build READY e percorso verificato sono quattro prove distinte.

M0 non attiva un database o un provider di login. A M3 si sceglierà un unico provider remoto dopo aver verificato servizi già disponibili, costi e modello di identità. Nessun secondo database, account store, registro eventi o autorità dei progressi. Un nuovo costo o una migrazione irreversibile richiede autorizzazione prima dell'azione.

L'accettazione di M0 non equivale all'accettazione del prodotto: tutti i [D01–D68](acceptance/D01-D68.json) restano NOT_RUN fino alle rispettive prove. [Handoff e gate](handoff.md) indicano come avanzare.

