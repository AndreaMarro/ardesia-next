# Ardesia Next — esperienza, pilota Fluidi e dimostrazione reale

Data: 16 novembre 2026. Mandato: messaggio diretto del titolare «MISSIONE INTEGRALE DI INGEGNERIZZAZIONE, ESPERIENZA EDUCATIVA E PRIMO LANCIO». Questo dossier descrive un incremento delimitato, non l'accettazione dell'intera piattaforma. Le ricevute di PR, CI e deployment fanno fede per gli stati successivi alla preparazione del candidato.

## Stato iniziale riconfermato

- `main`: `af4352e0bd810bcb1f0d2e9158d52553826971e5`, verificato con il riferimento Git remoto. PR50–56 già integrate. I 707 test unitari e 299 browser sono evidenze **PREESISTENTI** del candidato precedente, non nuove prove di questa missione.
- Preview Next `https://ardesia-next-evgd1l5pq-andreas-projects-6d4e9791.vercel.app`, deployment `dpl_A54WGJbaDfHZgfRozEvC5Gmo6yVN`, READY, stesso SHA. La visita reale porta al login Vercel.
- Staging `https://ardesia-next-staging.vercel.app` associato a `dpl_AzHJWRxYa6f5EcmsNcXrfLA5EYup`, precedente. Anche questo accesso porta al login Vercel. Nessun account applicativo QA disponibile in questo host; nessuna modifica a SSO, password, migrazioni o alias Next.
- Legacy `AndreaMarro/ardesia` main `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`, riconfermato in sola lettura. La ricognizione tecnica precedente su questo SHA rimane utilizzabile; non è una verifica runtime di ogni suo componente.
- Progetto promozionale separato esistente `ardesia-fisica-preview`, `prj_cLYaIqgzRZJFZGDcAsyvZBDzhgT8`: la pagina pubblica risponde 200 e presenta ancora quattro microcorsi. Produzione precedente `dpl_AsDQzeYsK66frDhZZfxQCceCjJQR`. La sua policy esistente protegge le preview, non la produzione statica. È il canale candidato per la nuova mini-demo; il Core rimane su un altro progetto.

## Incremento effettivo

**MODIFICATO, VERIFICATO LOCALMENTE**: `apps/web/public/fisica/poiseuille.html`, generata da `tools/build-physics-journey.mjs`.

Il pilota collega una sequenza completa: prerequisito → previsione → esperimento → ragionamento → errore intenzionale → recupero preciso → nuova applicazione → file di ripresa. Riutilizza il laboratorio normalizzato Poiseuille, il quesito originale `quiz-20261113-u3-04-a` e il problema distinto `original-20261113-u3-04-b`. Non aggiunge un secondo motore scientifico.

La scelta «un quarto» viene confrontata con r/r₀=0,50 e Q/Q₀=0,0625. Il feedback distingue area e velocità media. Il quiz successivo discrimina velocità locale, massima e media e invia al passaggio specifico su profilo, media o conversione delle unità. Il trasferimento usa due liquidi e una differenza di pressione diversa; non viene contato come nuovo apprendimento il semplice ritorno allo stesso quesito.

Il salvataggio è un download JSON esplicito: parametri, scelte, confronti, risposta e note. Nessun account, sincronizzazione, localStorage o database alternativo. I file sono legati all'edizione effettiva dei dati, delle spiegazioni e del feedback. File incompatibili, troppo grandi o fuori dominio vengono rifiutati senza cancellare il lavoro presente; un'importazione ritardata non sovrascrive modifiche più recenti. Nessun punteggio di padronanza o certificazione è introdotto.

**MODIFICATO**: landing con invito immediato alla lezione, quattro passaggi dell'esperienza, FAQ concrete e video autentico. Inviti all'azione usano i contatti già approvati in `docs/sources/launch-2026-11-13/contact.json`, senza inviare messaggi. Nessun prezzo, sconto, recensione o disponibilità inventati. La superficie rimane `noindex,nofollow`: è condivisibile, non è una campagna SEO già lanciata.

**MODIFICATO**: sei lezioni di lettura espongono il laboratorio pertinente e C4 torna alle lezioni su campo/potenziale:

| Lezione | Destinazione |
| --- | --- |
| `sf-2026-u2-04` | Urti |
| `sf-2026-u3-04` | Pilota Poiseuille |
| `sf-2026-u5-04` | Termodinamica |
| `sf-2026-u6-01` e `sf-2026-u6-02` | Campo e potenziale C4 |
| `sf-2026-u4-02` | Interferenza C5 |

La navigazione delle letture usa collegamenti relativi al catalogo, utilizzabili anche nel sito statico e nello ZIP. Lo spazio riservato viene distinto dalla pratica pubblica.

**MODIFICATO**: Vite accorpa `RemoteWorkspace` nel gruppo `foundation`. Sono dipendenze già iniziali; Tutor, Knowledge, Physics, Handout, Program e PDF conservano il caricamento differito. Nessuna soglia o classificazione di budget viene cambiata. Misura locale prima/dopo: JavaScript iniziale 223387 → 221343 byte gzip. Con il nuovo percorso, Core misurato 343934/344064 byte; margine molto stretto, da riconfermare sul candidato finale. La prima build aveva fallito correttamente con 346304 byte: non è stata dichiarata verde.

## Percorsi osservati

| Persona | Prova effettuata | Limite |
| --- | --- | --- |
| Visitatore | Landing reale, catalogo, lezione, laboratorio, quiz e recupero; desktop e mobile emulato | Accesso all'app Next remota bloccato da SSO |
| Studente pubblico | Errore intenzionale, spiegazione, problema diverso, download, chiusura e ripresa della stessa edizione | Pratica locale modificabile; nessuna attestazione né continuità tra dispositivi senza trasferire il file |
| Docente locale | Catalogo firmato, installazione/consenso/attivazione Molla, inserimento, modifica massa, salvataggio e riapertura | Database PostgreSQL isolato e identità sintetiche; non prova l'accesso remoto personale |
| Creator locale | Tipo nuovo annidato, preview, modifica valori, salvataggio, nuova versione della struttura, riapertura ed esportazione statica | Una sola identità Core conservata; nessuna accettazione commerciale implicita |

Le prove mirate hanno superato **10 casi browser**, desktop e mobile, comprendendo i tre nuovi casi del pilota e i cicli preesistenti Creator/Marketplace. Un'ulteriore acquisizione reale ha completato lavagna, taccuino, annotazione, plugin salvato e riaperto. I test mostrano una funzionalità; le immagini e i filmati permettono di giudicare anche composizione e leggibilità. Importazione PDF e assegnazione a studenti rimangono da riferire alle rispettive prove complete, non sono dedotte da questi dieci casi.

Ambiente: Node24.22.1, PostgreSQL18.6 locale dedicato, Chromium141 headless (Playwright1.56.1). Nessun dato personale remoto. Il contenitore non consente socket Unix: PostgreSQL è stato avviato su loopback TCP; Chromium usa il binario headless ufficiale. Questo limite dell'ambiente non è un difetto di Ardesia. Nessuna prova su hardware Mac/iPad/Apple Pencil.

## Inventario editoriale verificato sul sorgente

| Corso | Lezioni | Problemi originali | Verifiche puntuali | Stato |
| --- | ---: | ---: | ---: | --- |
| C1 Strumenti e meccanica | 9 | 11 | 52 | DRAFT |
| C2 Fluidi | 5 | 23 | 26 | DRAFT; una lezione pilota esaminata |
| C3 Termodinamica | 5 | 22 | 31 | DRAFT |
| C4 Elettricità e magnetismo | 7 | 9 | 33 | DRAFT; modello C4 campionato |
| C5 Onde, ottica e radiazioni | 12 | 14 | 58 | DRAFT |
| Totale | 38 | 79 | 200 | `humanApproval:false` |

Le 290 collocazioni legacy rappresentano **259 quesiti unici e 31 ripetizioni**. Le due simulazioni contengono ciascuna 31 quesiti: 21 a scelta multipla con cinque alternative e 10 a completamento. Non sono prove psicometricamente calibrate. Le 200 verifiche puntuali hanno feedback coincidente con la risposta; non vanno presentate come 200 feedback diagnostici già approfonditi.

I conteggi sono patrimonio preesistente. La nuova consegna è la connessione funzionale del percorso, non la produzione di ulteriori 38 lezioni o 79 problemi. Nessun record editoriale viene promosso automaticamente ad APPROVED.

### Dossier breve per l'approvazione umana del pilota

Materiale esatto: lezione `sf-2026-u3-04`, quiz `quiz-20261113-u3-04-a`, trasferimento `original-20261113-u3-04-b`, spiegazioni e tre recuperi in `tools/build-physics-journey.mjs`, feedback in `tools/physics-runtime/poiseuille-journey.js`.

Controlli matematici e review AI indipendente: r dimezzato → Q/16; r aumentato del20% → 2,0736Q. Nel quiz la velocità locale a R/2 vale 3/4 del massimo: 6cm/s → massimo8cm/s → media4cm/s → Q=0,040πmL/s. Nel trasferimento η=2,40mPa·s e il tempo finale è40,0s. Nessun errore dimostrato nel campione esaminato.

Il revisore umano deve accettare esplicitamente ipotesi del modello laminare, derivazione, unità, tutte e cinque le alternative e relativi feedback, pertinenza dei recuperi e adeguatezza del trasferimento. Solo dopo registrare identità/data/esito editoriale nel sistema canonico. La prova su studenti è un passaggio distinto ancora **NON VERIFICATO**.

Fonte scientifica primaria controllata: [OpenStax, University Physics1, §14.7](https://openstax.org/books/university-physics-volume-1/pages/14-7-viscosity-and-turbulence). Il PDF MUR2026 collegato nei materiali ha restituito403 nella verifica web di questa sessione: non viene dichiarata una nuova certificazione di allineamento al programma vigente. Il rinvio precedente resta una fonte da verificare con accesso al documento ufficiale.

## Plugin e patrimonio precedente

| Capacità | Evidenza attuale | Esito di questa missione |
| --- | --- | --- |
| Molla ideale1.0.0 | Release firmata, Host/SDK e route reale Marketplace | Ciclo completo installa/consenti/attiva/inserisci/salva/riapri/disattiva conserva dati, verificato localmente su desktop e mobile |
| Poiseuille1.0.0 | Seconda release firmata nel catalogo Next | Modello e demo preesistenti riutilizzati nel pilota; non dichiarato nuovo porting legacy |
| Composizioni scientifiche | 15 definizioni nel sorgente Next | Creator verificato sullo stesso Core; definizioni non equivalgono a15 plugin installabili |
| C4 WebGL | Rendering3D e fallback2D sullo stesso modello quantitativo | Interazione e misura campionate, filmato reale; non è un motore fisico generalizzato |
| Fluidi/Termodinamica legacy, Three.js | Ricognizione sorgenti sullo SHA legacy confermato | Donatori possibili; nessuna copia indiscriminata o seconda autorità |
| S19, ELABTutor, Simulation Plugin, Arduino, GLB, Ripasso/Outline | Stato dettagliato non rieseguito integralmente | **NON VERIFICATO** come integrazione Next corrente; non annunciato come recuperato |

Nel dipolo C4, q=1nC e distanza1,6m: al centro V=0 e campo≈28,086N/C. Due cariche positive uguali: campo nullo e V≈22,469V. L'altezza grafica rappresenta il potenziale, non una traiettoria; clipping±60V solo grafico, zona di esclusione0,18m, freccia campo normalizzata e sonda nel piano z=0. I limiti restano visibili.

## Media autentici e riproducibilità

`node tools/capture-physics-showcase.mjs <directory>` acquisisce il dist realmente costruito senza rete esterna, registra WebM e produce MP4 con sottotitoli italiani. Manifest con revisione base, digest sorgente, route, viewport, durata, errori e richieste esterne. La revisione base non va confusa con un commit pulito: le prime acquisizioni includono esplicitamente il digest del working tree modificato.

- Filmato principale: circa66s, UI continua, 16:9 FullHD. Nessuna interfaccia generata artificialmente.
- Clip: C4, microcorso/esercizio, lavagna/plugin; versione9:16 con layout mobile reale emulato.
- Screenshot: baseline landing/laboratorio/lettura; nuovo pilota, recupero, catalogo, C4, mobile, lavagna, taccuino, catalogo plugin e riapertura.
- `tools/capture-core-showcase.ts` usa identità sintetiche e il PostgreSQL locale attraverso le normali API. L'annotazione e la massa4kg vengono effettivamente conservate. È uno strumento di acquisizione fuori dalla suite di regressione ordinaria.
- Video principale, poster e sottotitoli sono presenti in `apps/web/public/fisica/media/` e nella landing. I materiali separati consegnati nella sessione comprendono file originali, manifest e screenshot. L'assenza di voce narrante non viene sostituita con promesse future.

Per la cattura Core usare un config Playwright locale con `testDir:tools`, `testMatch:capture-core-showcase.ts`, progetto `desktop-chromium`, `video:on`, il webserver canonico e le stesse credenziali sintetiche locali del runner. Non passare credenziali reali nella shell o nei documenti. Le prove canoniche rimangono `npm run verify`, `node tools/qa-integration.mjs`, `node tools/benchmark.mjs`, `npm run test:e2e`.

## Distribuzione, accesso e limiti

La nuova superficie può essere distribuita dal solo `apps/web/public/fisica`: HTML/CSS/JS, immagini/video e pacchetto offline. Il suo `vercel.json` impedisce connessioni applicative, frame e form e non configura funzioni, segreti, account o accesso al database. La pubblicazione statica è autorizzata dal mandato del titolare; questo non modifica `productionAuthorized:false` del Core.

Le prove locali non autorizzano a dichiarare completata la continuità remota Next. Prima di sostituire staging: candidato esatto, CI, accesso QA autorizzato, preflight, login e salvataggio/riapertura sul database remoto secondo runbook. La produzione commerciale non è accettata.

Mac: aprire la mini-demo pubblicata, oppure estrarre tutto lo ZIP e aprire `index.html`; conservare il JSON quando l'attività propone il salvataggio esplicito. iPad e smartphone: preferire l'URL pubblico in Safari/Chrome; lo stesso file JSON può essere trasferito e importato, senza sincronizzazione implicita. Il rendering mobile provato è Chromium emulato: Safari/iPadOS, penna, memoria e frame rate fisici rimangono da misurare. Il Core richiede sia autorizzazione Vercel sia account Ardesia; un login Vercel non crea l'account applicativo.

## Economia e coordinamento

Un solo integratore e autore delle modifiche. Due specialisti transitori in lettura: contenuti/plugin e review codice/bundle. Nessuna implementazione concorrente né nuova ricorrenza. Le automazioni ChatGPT Ardesia visibili risultano disabilitate. Lo stato dei quattro job Codex orari nativi sul Mac non è osservabile da questo host; il file di configurazione del2novembre non prova che siano in esecuzione. Quota/credito consumato: **UNKNOWN**. Nessun upgrade, acquisto o esperimento AI locale.

Claim canonico `mission-20261116-cycle1`, packet `mission-20261116-product-experience`, pubblicato su `ops/dual-run-state` prima delle modifiche. Il mandato16novembre riapre un incremento M5 delimitato prima delle vecchie priorità; non cambia le prove di accettazione né dichiara M5 completo. Le scadenze del ciclo e la ricevuta finale restano nel solo cursore canonico.

## Distanza dagli obiettivi e prossime azioni

| Obiettivo | Stato concreto | Prossimo ostacolo/minimo intervento |
| --- | --- | --- |
| Marketing iniziale | Landing, demo e media reali pronti | Pubblicare e verificare anonimamente la superficie statica esatta |
| Microcorso pilota | Una unità C2 completa e controllata | Revisione umana dei materiali esatti e breve prova con studenti |
| Prima vendita | Richiesta informativa non vincolante | Capacità di erogazione, prezzo/condizioni/privacy e accesso personale verificati dal titolare |
| Studente completo | Pratica pubblica con file; Core esistente | Continuità remota autenticata e percorso corso/errore/recupero su account QA |
| Docente completo | Plugin/Creator locali funzionanti | Importazione, assegnazione e ripresa remota nella stessa lezione |
| Ecosistema plugin | Due release firmate; una vita completa verificata | Qualificare il secondo plugin e scegliere un solo donatore legacy quantitativo |
| Piattaforma generale | Core/Host/Creator e molti strumenti preesistenti | Prove reali di scoperta, scrittura e continuità sui dispositivi destinazione |

1. Concludere il gate del candidato e la review indipendente, senza skip o soglie alterate; pubblicare PR con le ricevute esatte.
2. Verificare la mini-demo statica pubblica: zero autenticazione alla prima interazione, feedback/ripresa/video e link funzionanti; mantenere il precedente deployment per rollback.
3. Ottenere l'accettazione umana della singola unità C2 documentata, senza approvare tutto il catalogo.
4. Completare l'accesso QA privato Next e la continuità remota secondo runbook, prima di spostare l'alias staging.
5. Osservare almeno un utente reale svolgere previsione, errore, recupero e trasferimento; annotare difficoltà concrete senza inventare una metrica di padronanza.
6. Concordare offerta pilota erogabile: chi segue, tempi, materiali, prezzo e condizioni; nessuna offerta vincolante prima di questi dati.
7. Qualificare Poiseuille nel Plugin Host con lo stesso ciclo già provato per Molla e selezionare un solo recupero legacy motivato da valore educativo e licenza.
8. Provare scrittura, touch, Safari e riapertura su Mac/iPad/smartphone reali; distinguere difetti fisici da emulazione.

Le attività non completate qui non costituiscono promesse di esecuzione futura o nuove automazioni.

## Ripresa e completamento del 16 novembre

La nuova chat ha recuperato i file originali e le prove, preservando il checkout precedente e proseguendo in una copia isolata. Le prime acquisizioni media restano riferite al loro digest originale, non vengono ribattezzate prove del nuovo commit. Il filmato e le clip vengono riutilizzati perché il flusso mostrato non cambia; la correzione aggiunge alla landing una trascrizione testuale completa.

La revisione indipendente sul digest originale `33ca2df0334dd61c62427b76a9238ad84392cf21ad3562821f6326c6ccdf7ce1` ha riprodotto un difetto di accessibilità offline: Chromium rifiuta il VTT esterno da `file://`, pur leggendone dodici cue via HTTP. La nuova trascrizione HTML è generata dalle stesse dodici didascalie e non dipende da JavaScript, rete o supporto codec. La prova browser apre lo ZIP scaricato con rete e JavaScript disabilitati e controlla il contenuto completo. Non viene dichiarata risolta la sincronizzazione della traccia VTT in tutti i browser offline.

Le controprove indipendenti hanno inoltre osservato a 320×640 e 1440×960 la conservazione delle modifiche manuali durante un'importazione sospesa, la prevalenza dell'ultimo file selezionato quando due letture terminano in ordine inverso, il ripristino di parametri/tentativi/transfer e l'uso da tastiera. Nessun overflow, errore JavaScript o richiesta HTTP nel percorso offline esaminato. Il reviewer ha letto i sorgenti prima del dossier dell'autore; non ha fornito un'approvazione umana GitHub o scientifica.

Conservati entrambi i log precedenti: il primo tentativo locale falliva nel cleanup di processi orfani dell'ambiente; il wrapper successivo aggiunge il reaping dei discendenti, senza cambiare prodotto, test, limiti o retry. Le dieci prove mirate finali precedenti comprendono anche importazione PDF e Creator desktop/mobile. La nuova CI verifica il candidato pubblicato; numero di test e URL sono riportati nella PR per evitare di cambiare il digest soltanto per inserire il proprio hash.

La demo statica utilizza esclusivamente il progetto promozionale preesistente e i file pubblici. Il Core Next resta protetto e lo staging non viene spostato senza le verifiche remote richieste. La cronologia dei deployment conserva la versione statica precedente per il rollback. Questa consegna rende verificabile il pilota e il materiale marketing; vendita, validazione con studenti, revisione scientifica umana e prova su hardware Apple restano attività distinte.
