# Ardesia Next — lettura delle fonti e decisioni di trasferimento

Verifica del 29 ottobre 2026. Questa nota è una lettura delle fonti fornite dall'utente, con raccomandazioni per il nuovo mandato; non certifica l'implementazione o la distribuzione di funzioni.

## Fonti esaminate e limiti della prova

- Documento decisionale: `Ardesia_documento_decisionale_2026-10-28(3).md`, Library `libfile_b59da160269c8191ad1172cf016f8f6f`, 67.154 byte dichiarati, 609 righe lette integralmente.
- Atlante: `ARDESIA_atlante_visivo_36_modelli_2026-10-28(1).html`, Library `libfile_09076298e4d88191810e594af70cd009`, 3.717.734 byte dichiarati. HTML completo letto, 36 schede estratte e tutte le 36 anteprime JPEG incorporate ispezionate visivamente. Le anteprime sono riduzioni dei PNG; non si rivendica l'esame dei PNG originali a piena risoluzione.
- Il documento del 28 ottobre osservava legacy main `85963b1d7e8a8ec14ee3f7353f9c681b3ff208f7` e PR #328 aperta. Questi sono dati storici e devono essere sostituiti nell'audit operativo da una verifica corrente separata.
- I 68 criteri D01–D68 sono riportati senza riscritture in `criteria.json`, insieme a riga originale, requisito, prova e posizione nella fonte. Tutti iniziano con `NOT_RUN`; l'estrazione non attribuisce PASS.

## Gerarchia delle decisioni

Il mandato esecutivo Ardesia Next del 29 ottobre prevale sul precedente mandato esclusivamente decisionale. Sono quindi superati il divieto storico di rifondazione e il rinvio di ogni fondamento marketplace. Restano validi l'autorità unica dei dati, la qualità del percorso, la conservazione delle revisioni, il divieto di eLab, la distinzione DRAFT/approvato e l'obbligo di prova sul candidato effettivo.

Le sigle M0–M6 nel vecchio documento avevano significati diversi. Per Next si usano soltanto M0–M5 del mandato attuale: non si sommano due roadmap e non si presenta un criterio storico soddisfatto attraverso una rinomina.

## Riesame della scelta Poiseuille

La scelta precedente era razionale rispetto al repository esistente: il documento individuava in S20/Poiseuille la catena locale più completa fra fonte, previsione, esperimento, consegna, feedback e ripresa. Il punteggio 81/100 era un giudizio ponderato, non una misura sperimentale; Kirchhoff risultava 72/100. Il vantaggio era soprattutto nella composizione esistente, non in una superiorità architetturale intrinseca di Poiseuille.

Next deve dimostrare invece host, oggetti condivisi, installazione controllata e continuità sotto un'unica autorità. Concentrarne l'architettura su tubo/raggio/portata contraddirebbe il mandato plugin-native. La raccomandazione è:

1. Costruire M0 come fondamento indipendente con applicazione compilabile, dipendenze motivate, confini verificabili e stato generato.
2. Per M1, scegliere un modello first-party piccolo, deterministico e serializzabile. La molla/legge di Hooke è un candidato con costo scientifico e grafico limitato; il recupero effettivo va deciso dopo l'ispezione del sorgente e delle licenze. Nessuna dichiarazione di recupero già riuscito.
3. Portare quel modulo attraverso il ciclo M2/M3: catalogo, verifica, installazione, attivazione, montaggio, interazione, salvataggio, riapertura e disattivazione.
4. Per M4 usare un modello differente. Il kernel analitico Poiseuille resta candidato forte; S19 DC è una valida alternativa se isolabile senza portare con sé editor/topologia legacy. Il secondo modulo deve usare lo stesso host, Core, identità e registri.
5. Conservare i casi scientifici specifici D09–D12, D17–D18 per il modulo Poiseuille se adottato, con il loro testo originale. Non convertirli artificialmente in requisiti universali o in PASS per un altro laboratorio.

Questo riesame mantiene la disciplina di chiusura del documento precedente e sposta il primo oggetto da accettare sul ciclo plugin/lezione richiesto ora. Non autorizza nuovi corsi, tre laboratori contemporanei o infrastrutture prive di consumer.

## Direzione visiva derivata dalle immagini

La composizione di riferimento più coerente è B03/B04 con lettura A01 e continuità G01. Il centro è un canvas/pagina di lezione luminoso con oggetti educativi, strumenti contestuali compatti, fonti raggiungibili e una sola attività principale. I pannelli secondari si aprono per il compito; non si mantiene una tripla colonna su ogni dispositivo.

Elementi da trasferire:

- **B01–B04:** oggetti raggruppabili e collegabili, toolbar vicina al lavoro, inspector dell'oggetto selezionato, distinzione fra fonte/nota/evidenza. Le connessioni sono viste di oggetti identificati; non creano copie o cambiano ownership.
- **G01–G02:** annotazione e laboratorio nello stesso taccuino; passaggio pagina/lavagna sugli stessi identificativi. Non sono necessari anelli, texture carta, adesivi o un planner per realizzare il comportamento.
- **A01:** titoli editoriali leggibili, misura di riga controllata, spiegazione/formula/esempio nello stesso flusso. Una fonte precisa si apre senza perdere il contesto.
- **O01–O04:** backlink e ritorno alla revisione esatta. Il grafo è una proiezione consultabile e contestuale, non un secondo archivio o la schermata obbligatoria d'ingresso.
- **R01–R10:** continuità lezione → prova → nota → pack → ripresa. In R06 il dettaglio di installazione comprende permessi e compatibilità; R10 esplicita manifest, firma, hash e collaudo.
- **AN01–AN02:** evidenze ispezionabili e separazione proposta/revisione/approvazione. Percentuali di comprensione, fiducia o qualità nelle immagini sono dati di mockup, non formule da implementare.
- **P03/P04 ed E01:** publisher, contenuto/modulo versionato, provenienza e gate prima della pubblicazione. Creator usa il contratto di pubblicazione comune; una vetrina commerciale non fa parte della prima consegna.

Palette proposta, da tradurre in token e verificare nell'app: superfici chiare, inchiostro navy per titolo/azioni, accenti scientifici limitati e semanticamente distinti; serif nei titoli editoriali e sans leggibile nei controlli. Le immagini mescolano bianco e carta tenue: occorre scegliere una sola palette, senza trattare ogni schermata come un tema.

Non trasferire avatar di collaboratori inesistenti, contatori inventati, stati “sincronizzato/approvato” non provati, percentuali decorative, rating, ricavi, feed, sconti, XP, eLab rinominato o un cockpit neon. X01/X02/MO01 documentano alternative, non l'obbligo di sommare dodici direzioni.

## Marketplace e Creator: conservazione selettiva

Il vecchio atlante collocava R06/R10/P01–P05/E01–E03 a P2. Il mandato corrente anticipa i contratti e il ciclo operativo di installazione, non il mercato commerciale.

Un unico catalogo può descrivere plugin eseguibili e contenuti versionati con identità, versione, publisher, licenza, provenienza, stato editoriale, compatibilità e integrità. La forma di installazione deve distinguere un bundle eseguibile da un pack dichiarativo. Un pack non riceve capacità di codice perché appare nello stesso catalogo.

Manifest, verifica di integrità/firma, trust store, compatibilità SDK, permessi negati in assenza di consenso e audit precedono mount. Il layout di una card non è evidenza di sicurezza. Il percorso minimo di accettazione è trovare → ispezionare → verificare → installare disattivato → concedere capacità → attivare → usare → salvare → riaprire → disattivare, con controprove di incompatibilità, manomissione e revoca. Aggiornamento/rollback conservano lo stato e devono avere prove proprie.

Creator è, inizialmente, il consumatore futuro di questi contratti; non un'altra autenticazione, database, pipeline editoriale o autorità di approvazione. I pulsanti di vendita/pubblicazione non compaiono finché non hanno un comportamento reale autorizzato.

## Mappa completa dei 36 riferimenti

Le priorità sotto sono quelle dell'atlante storico, conservate per tracciabilità. Il mandato attuale decide l'ordine operativo. Le prove sono obiettivi da verificare, non funzionalità operative.

| ID | Titolo dell'atlante | Stato storico | Prova originale |
|---|---|---|---|
| R01 | Collage iniziale: tutor, grafo, studente e schemi | SINTESI / non una nuova feature | I quattro ingressi riusano la stessa Lesson e risorse. |
| R02 | Collage: lezione, pack, marketplace, officina | SINTESI / visione compositiva | Una lezione genera pack citabile senza un secondo store. |
| R03 | Cruscotto docente e coda evidenze | P1 / regia basata su evidenze | Indicatori e link provengono da ricevute reali, nessuna percentuale artificiale. |
| R04 | Grafo di concetti, fonti, prove ed errori | P1 / proiezione del Core | Aprire un nodo risolve la revisione esatta; revoca e revisione non risuscitano contenuti. |
| R05 | Lezione live con simulatore, fonte, aiuto, evento | P0 / solo schema, eLab escluso | Inserire laboratorio indipendente, annotare, usare ricevuta Core, salvare e riaprire. |
| R06 | Catalogo plugin, pack e workflow | P2 / mercato commerciale rinviato | Non mostrare card acquistabili senza installazione/permessi reali; eLab eliminato. |
| R07 | Costruzione pacchetto studio e ripasso | P1 / dopo la lezione completa | Export riapre fonti/revisioni/attività realmente autorizzate, con omissioni dichiarate. |
| R08 | Studio schemi dalle fonti, con approvazione | P1 / schemi proposti, non certificati | Separare proposta, modifica manuale e approvazione umana; link alle fonti esatte. |
| R09 | Traiettoria di apprendimento personale | P1 / privato e osservazionale | Lo studente vede eventi, errori e transfer propri; non percentuali di competenza inventate. |
| R10 | Officina creator, manifest e sicurezza plugin | P2 / strumento creator, non primo rilascio | Un plugin firmato prova ciclo install/mount/save/reopen senza permessi extra. |
| B01 | Lavagna spaziale con gruppi, prove, relazioni | P0 / riferimento per W0 | Gruppo/connessione non cambia l’ownership; nota e prova riaprono la fonte esatta. |
| B02 | Mappa lezione estesa e inspector oggetti | P1 / estensione a W0 | Trascina e collega card senza duplicare oggetti; pannello legge dati, non crea autorità. |
| B03 | Workshop: penna, frecce, evidenze, suggerimenti | P0 / modello principale W0 | Annotazione a penna e commento ancorati a versione, con salvataggio/redo/reopen. |
| B04 | Progettazione: mappa, flusso, timeline, vista studente | P0/P1 / focus per W0, viste avanzate dopo | Passaggio Lavagna↔Aula conserva contesto, fonti, stato e permessi. |
| O01 | Vault personale e grafo | P1 / conoscenza privata | Grafo proiettato da eventi e fonti; no dati fittizi per riempire spazio. |
| O02 | Grafo di lezione in tema scuro | P1 / vista alternativa | Navigazione concetto→evidenza→sorgente accessibile; scuro opzionale. |
| O03 | Editor+grafo+backlink+strumenti | P1 / split contestuale, non default | Selezione del nodo e ritorno al documento senza perdita della revisione. |
| O04 | Documento, grafo e plugin in un contesto | P1 / composizione delle viste | Apri un plugin dal grafo senza nuove identità o provider di memoria. |
| A01 | Reader di lezione editoriale leggibile | P0 / lettura della lezione W0 | Testi, formule, fonte e attività leggibili; navigazione per tastiera/touch. |
| G01 | Taccuino scritto a mano con esperimento integrato | P0 / riferimento per W0 | Stesso oggetto vivo nel quaderno e nella lavagna; nota e esperimento si riaprono. |
| G02 | Quaderno di ripasso personale | P1 / integrazione study | Stessa fonte in pagina/pack senza copia; nessuna mastery o serie gamificata inventata. |
| AN01 | Analytics docente e priorità di recupero | P1 / indicatori auditabili | Solo conteggi da prove, aiuti e tentativi verificati; no percentuali non calibrate. |
| AN02 | Governance degli schemi e qualità delle inferenze | P1 / gate scientifico | Un grafo proposto non si auto-approva; fonte/operatore/revisione sempre ispezionabili. |
| P01 | Home ecosistema e attività creator | P2 / visione, non home W0 | Mostrare servizi ed eventi esistenti; mai allestire feed o fatturato di fantasia. |
| P02 | Social discovery, tutor, materiali | P2 / marketplace e rete futura | Profilo e raccomandazione spiegabili con consenso e provenienza. |
| P03 | Vetrina contenuti/strumenti di autore | P2 / distribuzione futura | Solo pack con versioni, licenze, publisher e diritti verificati. |
| P04 | Marketplace plugin in stile card | P2 / installazione reale prima della UI | Card mostra dati reali, compatibilità, permessi, install e rollback verificati. |
| P05 | Profilo pubblico del docente | P2 / rispetto identità e privacy | Pubblicazione consapevole, contenuti e review realmente attribuiti. |
| E01 | Filiera: idea→produzione→verifica→utilizzo | P2 / visione di sistema | Ogni contenuto pubblicato ha fonte, revisione e risultato del gate. |
| E02 | Centro operativo e metriche creator | P2 / no cockpit iniziale | Ricavi, attività e prestazioni da ledger, mai dati inventati. |
| E03 | Rete, collaborazioni e contenuti | P2 / social network futuro | Ruoli, membership e pubblicazioni autorizzate, senza esporre fonti private. |
| X01 | Esperimento visivo dark neon | ESPLORAZIONE / non baseline | Non assumere cockpit e neon come design system obbligatorio. |
| X02 | Esperimento neo-brutalista | ESPLORAZIONE / non baseline | Accessibilità e leggibilità prima del trattamento tipografico decorativo. |
| X03 | Grafo gamificato: XP e livelli | ESPLORAZIONE / rinviare o evitare | Nessuna percentuale di competenza o XP non sostenuti da misure. |
| MO01 | Moodboard dodici direzioni | ESPLORAZIONE / scegliere una direzione | Il prodotto usa un unico design system, non dodici temi paralleli. |
| D01 | Variante home social feed | DEFER / duplicato | Non introdurre un feed come ingresso principale per la lezione. |

## Uso di D01–D68 nel nuovo rilascio

I criteri non vanno ridotti a una spunta sul repository. Per ogni rilascio occorrono versione candidata, componente, tipo di prova, risultato, limite e responsabile. L'archivio contiene il requisito originale; la matrice di accettazione del candidato può aggiungere applicabilità motivata.

- D01–D08 proteggono identità e qualità editoriale; D01 e D07 citano esplicitamente il precedente verticale.
- D09–D18 definiscono la correttezza scientifica. D09–D12, D17–D18 restano specifici Poiseuille; D13–D16 esprimono invarianti anche utili ad altri modelli.
- D19–D32 riguardano comportamento e microtesti. D21/D26 contengono esempi di Poiseuille da mantenere nel suo test plan, con criteri equivalenti espliciti per gli altri modelli.
- D33–D41 riguardano UX e accessibilità. D35 cita viewport 360/390, 820, 1440 px; D40 richiede dispositivi reali prima di promettere penna/Safari/tablet. Una simulazione del viewport non sostituisce questa prova.
- D42–D52 riguardano media e persistenza. Un salvataggio locale dimostrato non è D46; D46 richiede browser nuovo e secondo dispositivo autorizzato.
- D53–D64 riguardano ruoli reali, isolamento, autorità unica, qualità e rilascio. La protezione Vercel dell'operatore non costituisce identità/ruoli applicativi degli studenti.
- D65–D68 richiedono revisione visiva e persone reali: restano NOT_RUN finché eseguiti. Non possono essere approvati dall'agente.

Nel documento originale 100 ms p95 per controlli, 60 fps desktop/30 tablet e tre secondi alla prima azione erano budget proposti, non misure. Nessun valore viene promosso a risultato raggiunto.

## Decisione operativa raccomandata

Accettare ora soltanto la prima consegna M0 quando repository indipendente o scaffold-bloccato dichiarato, app compilabile, CI, ownership, confini e preview protetta sulla SHA esatta hanno prove disponibili. Mostrare separatamente lo stato di M1–M5. Il ciclo remoto con identità reali, gli update/rollback, il secondo modello e le prove umane rimangono traguardi distinti. Questa delimitazione evita che la completezza del catalogo documentale nasconda il numero di esperienze effettivamente accettate.

