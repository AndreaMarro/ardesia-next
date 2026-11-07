Pacchetto curricolare Ardesia — consegna del 7 novembre 2026

Il pacchetto `candidate/` riconcilia i quattro corsi storici in cinque corsi `CourseInput`, conserva le identità dei 38 nuclei e dei 200 sottobiettivi editoriali e aggiunge 38 indagini guidate originali, estensioni esplicative, recupero e applicazioni. Tutto resta **DRAFT, humanApproval=false**. Il lavoro è circoscritto a questa cartella: nessuna modifica al repository applicativo condiviso, database, servizi, checkout o repository legacy; nessun push.

| Corso | Unità del syllabus | Nuclei | Sottobiettivi editoriali | Quesiti selezionati | Obiettivi con target lab digitale |
|---|---|---:|---:|---:|---:|
| Strumenti e meccanica | U1 + U2 | 9 | 52 | 58 | 19 |
| Fluidi | U3 | 5 | 26 | 54, di cui 3 approfondimenti | 8 |
| Termodinamica | U5 | 5 | 31 | 58, di cui 1 approfondimento | 7 |
| Elettricità e magnetismo | U6 | 7 | 33 | 41 | 9 |
| Onde, ottica e radiazioni | U4 + U7 | 12 | 58 | 48 | 18 |
| Totale | U1–U7 | 38 | 200 | 259 | 61 |

I 200 sono la decomposizione editoriale Ardesia, non 200 obiettivi ufficiali enumerati dal MUR. La separazione è fra Fluidi e Termodinamica; nessun obiettivo viene perso o rinumerato. Gli ID `U1-01.01` ecc. e `final-U1-01.01` ecc. restano quelli del patrimonio. I nuovi ID di corso sono `sf-2026-strumenti-meccanica`, `sf-2026-fluidi`, `sf-2026-termodinamica`, `sf-2026-elettricita-magnetismo`, `sf-2026-onde-ottica-radiazioni`; le unità sono `sf-2026-u1-01` ecc.

I principali file da integrare sono:

- `candidate/courses.json`: cinque wrapper `{id, academicYear, syllabusUnitIds, status, humanApproval, input}`. **Solo `input` è un CourseInput**; il wrapper editoriale non va passato direttamente a `save-course`. `lesson` è `null`: il responsabile dell’integrazione deve creare e agganciare la lezione con revisione esatta.
- `candidate/units.json`: identità e provenienza del nucleo, lista obiettivi, `experimentId`, `labIds`, `exerciseIds` e `finalAssessmentIds`.
- `candidate/coverage.json`: 200 righe di navigazione obiettivo → spiegazione → indagine della famiglia → esercizi della famiglia → verifica finale puntuale. `complete=false` e `scientificAcceptance=HUMAN_REVIEW_PENDING` sono intenzionali. Un esperimento o esercizio della famiglia non prova di per sé ogni suo sottobiettivo.
- `candidate/assessments.json`: 200 verifiche finali originali con prompt, risposta, feedback, ID e hash del record fonte. Il testo visualizzato ha spazi normalizzati; l’hash dichiara la fonte prima della normalizzazione.
- `candidate/experiments.json`: 38 procedure guidate su carta o con materiali quotidiani sicuri, osservazioni attese, previsione e recupero. Le attività digitali sono opzionali e subordinate al modello effettivamente implementato.
- `candidate/bank-selection.json`: 259 quesiti esistenti, con soluzioni dettagliate e verifiche ereditate; non è una nuova banca di 259 quesiti. `candidate/bank/{courseId}.json` offre gli stessi record in cinque shard da circa 354–537 KB; `bank/index.json` contiene dimensioni e hash. Caricare lo shard necessario evita di includere l’intera selezione nel bundle principale. Gli shard duplicano il file aggregato: non sono ulteriori quesiti.
- `candidate/transfer-applications.json`: 38 applicazioni originali già incluse nei `transfer` dei corsi, estratte per riuso come oggetti. Non contarle una seconda volta e non affermarne unicità semantica rispetto alla banca: alcune competenze e situazioni coincidono con il patrimonio.
- `candidate/media-resources.json`: cinque collegamenti facoltativi Khan Academy/YouTube, uno per corso, con obiettivi, previsione, attività successiva e limiti di verifica. Sono anche nelle fonti delle rispettive unità.
- `candidate/source-registry.json`, `editorial-corrections.json`, `topic-coverage.json` e `manifest.json`: provenienza, due correzioni documentate, 147 raccordi tematici ereditati e hash dei file.

La banca usa `format: multiple_choice | completion`. Le opzioni sono `[{id, text}]`; per scelta multipla la chiave è `answer.correctOptionId`. Per completamento `options=[]` e la risposta contiene `exact`, `accepted`, `unit`, `text`. Le formule testuali e `answer.exact` sono dati: **non eseguirle come codice**. Le risposte autore non vanno mostrate prima del passaggio di confronto scelto dal prodotto. Una risposta aperta o simbolica non è correttamente valutata dal solo confronto testuale.

Il loader portabile `loader.mjs` riceve `{z, CourseInputSchema}` pubblici dell’app e restituisce `load(rawBundle)`. Il bundle contiene `{courses, units, coverage, assessments, experiments, exercises, topics}`. Valida i contratti e i collegamenti, non scrive storage e non crea comandi. `exercisesForUnit(id)` esclude per impostazione predefinita `provided_law_extension`; l’inclusione richiede `{includeExtensions:true}`. La validazione diretta è riproducibile con `validate_candidate.mjs <percorso-repository-ardesia-next>` e Node 24.

Le modifiche editoriali finali includono 200 coppie **Domanda / Risposta commentata**, eliminazione delle ripetizioni identiche answer/feedback nel confronto finale e spazi normalizzati soltanto nei campi di visualizzazione. I controlli proteggono numeri decimali, `I0`, `x0`, `mL`, `kPa`, `eV`, `log10`, prodotti, potenze e segni. Tutte le 259 risposte macchina `exact` e `accepted` coincidono con la fonte.

Due quesiti sui condensatori, `u6-connected-plate-separation-charge-09` e `-13`, inserivano la definizione completa `s=d/d₀` dentro prodotti e denominatori, producendo false uguaglianze. Le formule visualizzate ora usano `s`, definito separatamente. Nel `-13` si chiarisce inoltre che A e B sono prove preparate indipendentemente: la tensione è fissa durante ciascuna separazione, ma può differire fra le due preparazioni. La risposta esatta `3/2` è invariata: Q_A=12/2=6 µC, Q_B=3 µC, s_B=9/3=3, s_B/s_A=3/2. Fonte e correzione restano entrambe tracciabili.

Le evidenze nuove, separate dall’approvazione scientifica, sono:

| Controllo | Esito e limiti | Ricevuta |
|---|---|---|
| Contratto pubblico CourseInput, 5/38/200 identità, riferimenti, opzioni e scope | PASS; 9 alterazioni intenzionali correttamente rifiutate | `source-checks/candidate-validation.json` |
| Aritmetica delle indagini e applicazioni originali | 94 controlli PASS su 36 famiglie numeriche; le attività qualitative non diventano per questo certificate | `source-checks/authoring-arithmetic.json` |
| Sottoinsieme numerico della banca selezionata | 100 controlli PASS su 98 quesiti; 161 quesiti senza nuovo controllo numerico completo; 34 controlli simbolici/dimensionali ereditati non rivalidati | `source-checks/selected-bank-arithmetic.json` |
| Qualità editoriale | 18 casi protetti, idempotenza dei campi, 200 coppie domanda/risposta, nessun blocco finale duplicato: PASS | `source-checks/editorial-text-review.json` |
| Integrità | Hash dei 17 file del manifest e 259 risposte macchina invariati rispetto alla fonte: PASS | `source-checks/final-integrity.json` |
| Lettura AI di contenuto | Letti i 200 prompt/risposte finali e i 38 esempi svolti con pratica e trasferimento ereditati; non è revisione umana né campionamento su studenti | Questo rapporto |

La selezione contiene 255 quesiti `syllabus_core` e quattro `provided_law_extension`: risalita capillare quantitativa, frammentazione superficiale e adiabatica con formula fornita. I livelli ereditati sono 175 base, 19 facile, 30 medio, 35 difficile; sono stime editoriali, non calibrazione empirica. Sono presenti 254 coppie dichiarate `(lawFamily, reasoningTask)` per 259 record e cinque coppie condivise, elencate nella ricevuta. Una firma diversa non dimostra unicità semantica. L’ampliamento sostanziale e verificato della banca con molti problemi realmente nuovi resta lavoro aperto: questi dati non lo simulano gonfiando il conteggio.

Il recupero ha usato il commit live verificato `AndreaMarro/ardesia@5cfbdcb055ba3ba136f97fb56e997f06e6cf3605` del 28 ottobre 2026. Sono stati conservati in `sources/` i quattro CoursePack, i 38 nuclei e 200 sottobiettivi, le tre matrici di copertura, la tassonomia, il catalogo, il blueprint dei due appelli storici, le fonti e le specifiche dei laboratori. Le 27 shard della banca comprendono 4.000 quesiti e 53.236.609 byte: SHA256 e conteggi coincidono con il manifest ereditato (`source-checks/bank-shards.json`). Il fatto che la banca sia integra non ne certifica l’unicità o la correttezza scientifica. I checkout locali vecchi in `~/ardesia` e `~/ardesia-monorepo` sono rimasti intatti; nessuno dei 53 MB va copiato indiscriminatamente nel prodotto.

Il PDF ufficiale MUR 2026/2027 è stato letto come testo dal web tool, con tutte le unità U1–U7. Il download Python diretto ha restituito 403; il PDF collegato dall’Università di Catanzaro è stato scaricato (306.024 byte, SHA256 `2650dee32028c3414d67952c4be63db511fa184b10395b921caa9b76adb4c60f`). L’uguaglianza dei byte MUR/mirror risulta già registrata il 28 ottobre nel patrimonio; non è stata nuovamente dimostrata per i byte MUR del 7 novembre. UniBo e le regole Sapienza sono state rilette. Il registro distingue il controllo attuale da quello ereditato e conserva URL e dettagli.

I manuali privati Valdes, Ragozzino/Velotta, Scannicchio e FisicaTB non sono stati ritrovati nella ricerca circoscritta per nome su Documents/Downloads/Desktop. Il registro storico documenta indici e campioni, non una lettura integrale nuova: nessuna pagina o esercizio dei manuali è stato riprodotto. I fascicoli 2025 sono citati tramite l’analisi storica di mirror privati, senza attribuire loro una chiave ufficiale MUR. La richiesta di un confronto aggiornato con tutti i testi ed eserciziari effettivi rimane parziale finché quei file non sono disponibili.

Per i cinque video sono stati verificati indice e alcuni estratti, ma l’accesso diretto YouTube è fallito o ha restituito 429 e le pagine Khan non hanno restituito corpo leggibile. **Playback e visione audiovisiva integrale: NOT_RUN.** Non sono stati copiati video, miniature o trascrizioni. La termodinamica segnala esplicitamente la conversione fra lavoro fatto sul gas e lavoro fatto dal gas. Ogni link è facoltativo; la lezione funziona anche senza il video.

REA 6.8 è stato impiegato in modo selettivo sull’unico file copiato `apps/studio/plugins/fluid-thermo/models.ts`, senza esecuzione: ricevuta `rea-fluid-models.json`, evidence ID `ev_5fef67a9604addb9f94c0ef3234c6aaac7e5b6acd3a0bbef98da18df9752c00d`, artifact hash `015668519ad5b7b999b16f4575e77f1e7debb7a956a42599edf09d7472b28406`. I budget semantici erano limitati; dipendenze ed esecuzione non sono incluse. L’analisi ha informato la separazione fra Q fissata e Δp fissata, parametri SI, domini e misure/curve collegate. Nessun vecchio codice di simulazione è stato incorporato nel pacchetto.

I 15 ID di laboratorio sono **target di integrazione**, non esistenza o comportamento verificati: vettori 3D, proiettile, energia, oscillatore, idrostatica, continuità, Poiseuille, gas ideale, calorimetria, Coulomb, circuito, onda, rifrazione, decadimento, onda EM 3D. La mappa restringe i collegamenti alle capacità dichiarate: continuità non equivale a Bernoulli, rifrazione non equivale a lenti, Poiseuille non equivale a reti; 61 sottobiettivi hanno collegamenti digitali specifici. Una vista ortografica parametrica non va presentata come prova di motore WebGL o validazione di ogni comportamento 3D. Il responsabile dell’app deve verificare e rifinire i collegamenti sulle implementazioni effettive.

Per rigenerare il pacchetto, dalla cartella dell’audit eseguire in ordine `python3 assemble_candidate.py`, `python3 augment_candidate.py`, quindi `python3 check_arithmetic.py`, `python3 check_selected_bank.py`, `python3 check_editorial_text.py` e `node validate_candidate.mjs <repository>`. I primi due comandi riscrivono soltanto `candidate/`; gli altri scrivono le ricevute in `source-checks/`. Il nodo di validazione deve essere quello compatibile con il workspace (usato Node 24), e legge il contratto/zod già installati senza installare dipendenze o scrivere nel repository.

Il pacchetto finale è congelato. Hash SHA256:

- `courses.json`: `da4b771fcd2859e85adcfa9080c00673c2fc15dcae208ce36d460dc58d2228f1`
- `bank-selection.json`: `fdd548b9e404d40613560e150959198d4477fef8fbf1e5ec24e4116d4eab46f4`
- `assessments.json`: `43069e16472f620bad88d7a1b0478cf3fa8e7001e75144150f91444ca03288b5`
- `coverage.json`: `018e320595808d61f8982ccbfef93565e47486e576dd8d850c749a330587c13e`
- `manifest.json`: `a5bc08c8a3c0bffa39f4999efa991e49ef58978391c3faead8fca75c5efc7d45`

La consegna conclude il recupero e l’adattamento dati affidato a questo audit. La verifica dell’esperienza importata, dei tentativi nel Core, dei laboratori, del caricamento offline, dell’iPad/Pencil reale, della calibrazione su studenti e l’accettazione scientifica umana appartengono all’integrazione e alle verifiche successive, non a questi test verdi.
