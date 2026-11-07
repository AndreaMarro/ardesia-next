# Nucleo Ardesia — piano operativo del 7 novembre 2026

Mandato diretto del titolare: completare il nucleo fino al Creator universale, provandolo con cinque microcorsi completi di Fisica per Medicina. Questo piano accompagna il lavoro applicativo della chat; non è un nuovo motore di accettazione né una modifica dei job ricorrenti. Il prodotto resta **NOT_COMPLETE** finché le esperienze e le prove richieste non sono presenti.

## Baseline verificata

- PR50 aperta in bozza, head `a4835aad79a15c13a14c10c5aa51cfda98c546b3`; Verify115 `42405364837` completata con successo, osservata via GitHub. Il resoconto della PR riporta 558 test e 191 scenari browser; qui riusati come baseline, non rieseguiti o attribuiti a sorgenti successive.
- Checkout precedente pulito; nessuna PR successiva osservata. Main `f7adf5d`. Cursore `f9fc78bace152493520701d50e4857376a34e8c0`, revisione167, `activeRun:null`, procedura `e83c980`. Nessun ritorno ai vecchi blocchi M3/M4.
- Continuazione isolata `codex/core-continuity-20261107` da a4835aa. Il mandato diretto autorizza preparazione applicativa, piano e handoff GitHub; non modifica di per sé coda/cursore/scheduler, accettazione umana o distribuzione.
- Letti handoff locale e remoto e confronto-programma-chat; programma originale del 6 novembre letto integralmente. Legacy consultato in sola lettura. Non si riapplicano patch cumulative.

## Esperienze e dipendenze

| Ordine | Esperienza da consegnare | Dipendenza reale e criterio osservabile | Stato iniziale |
|---|---|---|---|
| 1 | Scrivere una lezione su Mac/iPad, chiudere e riaprire offline senza perdita | Toolchain/dispositivi effettivi, flush locale e ripresa; pressione, palmo, gomma, selezione, zoom e materiali. Misure reali separate da emulazione | Audit in corso; native/Pencil non provati |
| 2 | Cercare voce e scrittura, leggere fonti esatte da un client AI e produrre una ricostruzione modificabile | Audio/trascrizioni/revisioni tramite l'API autorizzata; anteprima/applicazione, revoca e retry; integrazione host effettiva distinta dal client SDK | Audio web presente; audio MCP e host aperti |
| 3 | Studiare cinque microcorsi con continuità fra spiegazione, esperimento, ragionamento e verifica | Riconciliazione quattro corsi/200 obiettivi, syllabus ufficiale dell'anno pertinente, provenienza dei materiali e banca; attività originali e revisione scientifica | Inventario e mappatura in corso |
| 4 | Manipolare laboratori 2D/3D, misurare, formulare previsioni e trasferire il modello | Modelli/limiti fisici espliciti, parametri/unità/formule/grafici collegati; esperimenti e video verificabili per obiettivo | Molla/Poiseuille e Creator esistenti; copertura insufficiente |
| 5 | Riutilizzare la stessa conoscenza fra lezioni, archivio, mappe e corsi | Riferimenti esatti, backlink autorizzati, ricerca e provenance; nessun secondo archivio autorevole | Connessioni locali presenti; grafo trasversale incompleto |
| 6 | Organizzare lavoro tutor e comprenderne l'economia | Richieste→agenda→lezione→consuntivo→pagamento/documento; costi/compensi separati da ricavi e incassi | Nucleo tutor presente; economia estesa aperta |
| 7 | Creare tipi, plugin, strutture e workflow da UI e client AI | Creator già presente: estendere solo limiti dimostrati, preservare versioni, consenso di esecuzione e portabilità; prova consumer→Core→riapertura | Dichiarativo/QuickJS presenti; universalità e host non accettati |

Gli ordini indicano priorità di prodotto. Una dipendenza hardware o di accesso blocca la relativa prova, non la preparazione indipendente degli altri percorsi. Community e marketplace rimangono nell'orizzonte senza sottrarre priorità a questi risultati.

## Metodo di verifica e consegna

Un integratore mantiene il checkout; specialisti transitori delimitati recuperano contenuti e verificano in modo indipendente. Riutilizzare fonti/prove ancora applicabili. REA MCP/CLI deve accompagnare le decisioni di riuso con versione, licenza e limiti. Usare database sintetici dedicati e prove mirate prima del gate finale. Correttezza didattica, hardware, codice, CI, pubblicazione e distribuzione restano fatti distinti. Ogni incremento aggiorna qui risultato, limiti e prossimo passo; originali e fallimenti rimangono conservati.

## Risultati della continuazione

La continuazione implementa queste esperienze sul Mac disponibile. Il titolare ha esplicitamente risposto «Procedi con il Mac disponibile»: prove native/Pencil non vengono sostituite da emulazione. La scelta è registrata una volta in history.md.

| Esperienza | Risultato nel candidato | Limite ancora reale |
|---|---|---|
| Scrittura | Checkpoint del gesto, lock fra schede, handoff durevole, gomma a tratto, taccuino scrivibile e ripresa offline; stessa identità Core | PointerEvents/SVG; ultimo checkpoint750ms, niente lasso/PencilKit.2000oggetti/500pending invariati; native/iPad/Pencil/Safari NOT_RUN |
| Audio e MCP | Ricerca registrazioni/trascrizioni, timeline e cue paginati, lettura byte originali, documento storico esatto e preview/apply di trascrizione | Nessun ASR automatico, host cloud/OAuth o prova del parlato. Claude installato ma non autenticato; host Claude/ChatGPT effettivi NOT_RUN |
| Cinque corsi |38lezioni,200sotto-obiettivi editoriali,259quesiti recuperati,200verifiche,38transfer e38problemi originali aggiuntivi;751oggetti Core | Tutto DRAFT. Revisione umana/calibrazione NOT_RUN; manuali privati non reperiti. Copertura documentata non equivale a competenza accettata |
| Laboratori e video |15tipi Creator con parametri, misure, grafici e scene;61obiettivi collegati in modo specifico.5video con titolo/autore e avvio verificati |3D ortografico, non WebGL. Nessuna promessa di laboratorio per tutti200obiettivi; visione integrale video NOT_RUN |
| Conoscenza | Ricerca, link concettuali, backlink e mappa navigabile; riferimenti storici esatti e proiezione autorizzata | Mappa limitata ai primi8nodi; ricerca/backlink completi. Non è indicizzazione semantica/embedding o archivio parallelo |
| Tutor | Costi diretti, preparazione, ricavi maturati, quote pacchetti, margini e tariffe orarie derivati; valute/incassi distinti | Dati mancanti dichiarati; nessuna fiscalità completa, pagamento reale o integrazione calendario esterna |
| Creator | Modelli/corsi/link/domande riutilizzano composizione e programmi esistenti, import/export e versioni | Runtime QuickJS esplicito già presente; workflow esterni universali e marketplace commerciale non qualificati |

Contratti0.11.0/snapshot10/SQL008 preservano vecchi record, eventi e fingerprint. Il golden v9 verifica apertura senza write e retry identico; rollback a un vecchio reader strict non è compatibile dopo nuove scritture. [Decisioni e compromessi](../adr/0021-core-continuity.md), [fonti didattiche](../sources/physics-2026-27/README.md), [MCP](../../packages/mcp-core/README.md).

## Verifica eseguita e difetti incontrati

Ambiente: Mac mini M4/16GB, Node24.22.1, Chromium Playwright, PostgreSQL su due database loopback dedicati. Browser plugin non disponibile; usato runner Playwright del repository. Test di pagina verificano contenuto/azioni, overflow e errori runtime; screenshot desktop/mobile sono stati osservati. CUA è stato usato separatamente per la disponibilità/avvio dei cinque video, senza modificare sessioni AI.

- Reviewer non autore:78test Vitest e3scenari real Core PASS sul manifest incrementale78file `c7459c358671af9ce0b946bf2481bf2820925de994ea24388e1b6208446a325f`. Nessun finding residuo in quel perimetro; non è review dell’intero patrimonio o approvazione umana.
- Runtime MCP precedente di questo incremento:16casi PASS con SDK ufficiale→bundle stdio→HTTP→PostgreSQL;20test adapter PASS. Il gate finale riesegue il runtime sulla sorgente pubblicata. Audio sintetico, non parlato reale.
- Browser mirati:20/26PASS dopo SQL008,6fallimenti di locator conservati (opzioni penna non aperte, select label, titolo Fluidi abbreviato). Correzione dei locator:12/12 ink/knowledge/map PASS desktop/mobile.
- Il corso completo ha poi esposto un race reale: apertura materiali durante il cambio unità. Controllo di attesa/cancellazione corretto;2/2scenari Fluidi PASS con import interrotto al settimo commit, retry immutabile,5lezioni, edizione, studio, manipolazione e risposta riferita alla domanda.
- Il primo26casi aveva fallito al create-workspace: il nuovo snapshot10 non era ancora nel CHECK SQL. Migrazione008 aggiunta, senza riscrittura dati;33test server/PostgreSQL PASS nella verifica dedicata successiva.
- Due tentativi preliminari Verify hanno eseguito562test e saltato29perché la shell non aveva M3_TEST_DATABASE_URL: fallimento conservato e non contato come PASS. L’esecuzione con database configurato è richiesta per il gate definitivo.
- Importazione dei cinque corsi prima dell’espansione:38lezioni/713oggetti,6.352.080byte di proiezione e230,4s in Core memoria; non è misura HTTP/PostgreSQL né prestazione accettata. Il costo crescente rende necessaria una futura ottimizzazione prima di aumentare le quote.

Il workload iniziale sul Mac ha superato120tratti/11.520campioni/120ricevute:100online e20offline, chiusura/nuova pagina e riconferma esplicita, uguaglianza dei dati Core, zero duplicati/errori. Durata30,9s; ricevuta online p50 144ms/p95 1338ms sotto carico accelerato, riapertura offline216ms, copia finale415.897byte serializzati (esclusi media/cache/overhead). Non è una latenza di rendering o prova di durata reale della lezione.15/16scenari notebook/handout/program PASS nello stesso run: il caso residuo richiedeva di scartare esplicitamente la bozza dell’Inspector prima di cambiare lezione; il test è aggiornato mantenendo il controllo di isolamento.

Il workload e la regressione finale producono ricevute con ambiente, SHA e sourceDigest. I risultati definitivi vanno letti dai report `verification.json`, `e2e.json`, `browser-evidence.json`, `lesson-workload.json` e dalla CI della PR di continuazione: questa nota non presume un PASS futuro. La consegna esterna e l’handoff della PR riportano il risultato sulla SHA realmente pubblicata senza retrodatare queste prove intermedie. Fallimenti, report indipendenti e screenshot sono conservati nel pacchetto di consegna.

## Chiusura operativa e prossimo passo

Completare review del delta, gate completo e browser sulla sorgente finale; pubblicare il branch di continuazione e la PR in bozza sopra PR50. Verificare la CI fino a esito. Questa pubblicazione non è merge o deployment; main, procedura e preview protetta mantengono le revisioni osservate. Nessuna modifica a coda, cursore, scheduler, account reali o servizi condivisi.

Il mandato complessivo rimane NOT_COMPLETE. Dopo l’integrazione autorizzata attraverso il runbook, priorità alle esperienze oggi non provate: app/dispositivo Apple reale e lunga sessione di scrittura, qualità/continuità audio con parlato, host AI autenticati effettivi, revisione scientifica umana dei corsi e misure su spazi grandi. M3 remota deve avere le proprie prove originali, senza trasformare i test locali in accettazione.
