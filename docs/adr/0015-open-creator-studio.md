# ADR 0015 — Studio e Creator di tipi componibili

Preparazione locale isolata dal mandato diretto del 7 novembre 2026: migliorare UI/UX e permettere l'invenzione di nuovi tipi, con analisi REA effettiva. [Fonti, diritti e limiti](../sources/creator-studio-2026-11-07.md). La mappa e la coda esistenti restano canoniche; questo incremento non adotta una procedura, non distribuisce sorgenti e non certifica l'ecosistema completo.

## Esperienza

La lavagna occupa lo spazio principale. Un header contiene titolo e azioni della lezione; una rail apre libreria, creazione e moduli; il dock separa selezione, penna e spostamento. Elenco oggetti e proprietà sono contestuali. L'inquadratura iniziale e «Inquadra tutto» rispettano gli ingombri dei controlli senza cambiare coordinate persistite. Audio e replay riservano spazio alla scrittura. Sui viewport stretti la rail passa in basso, i controlli mantengono nomi accessibili e la bozza resta visibile.

Il Creator dispone composizione, anteprima e proprietà in tre colonne; su mobile le sezioni scorrono verticalmente e il footer rimane raggiungibile. Si può partire da zero, annidare e riordinare componenti, definire variabili, espressioni e scene, provare i valori, importare/esportare e salvare sulla lezione reale. La bozza strutturale sopravvive a campi temporaneamente incompleti; il JSON avanzato richiede applicazione esplicita. Chiusura/cambio contesto proteggono la bozza. L'ID di creazione resta stabile dopo un ACK perso: la recovery ripete il comando originale.

## Un tipo aperto, senza un catalogo di discipline

`extension` è una nuova variante del contratto documentale 0.6.0. Ogni istanza conserva una definizione `ardesia-extension/1` con `typeId` liberamente scelto, versione, nome, descrizione, licenza, renderer, body JSON e fallback leggibile, oltre a stato e impronta canonica SHA-256. Il frontend non introduce uno switch per ogni nuova attività educativa. Renderer sconosciuti e componenti futuri conservano i propri dati e mostrano il fallback, senza scaricare o eseguire codice.

Il primo renderer `ardesia.composition/1` combina campi numerici/testuali/booleani e un albero di gruppi, testi, controlli, risultati, grafici, azioni e scene con forme. L'interprete in Plugin Host è originale e deterministico: parser/AST con arità verificate, valori finiti, nessun `eval`, `Function`, accesso a proprietà, IO o loop. Un'espressione non valida produce un errore locale leggibile; non attribuisce validità scientifica alla creazione. Il pendolo iniziale dichiara piccole oscillazioni e g=9,81 m/s²; è un esempio modificabile DRAFT, non una review scientifica dell'intero sistema.

Questo apre nuovi tipi di oggetto; non costituisce ancora un runtime universale per programmi, workflow di rete o plugin di terzi. Le release eseguibili firmate M1/M2 mantengono Host, consenso, trust store e revoca. Una futura famiglia di renderer deve aggiungere capacità autorizzate e controprove nel medesimo percorso, senza trasformare un hash in autorizzazione all'esecuzione.

## Identità, licenza e storia

Il Core valida l'impronta di ogni definizione, anche nello storico e nel restore. Le transizioni di release dei plugin possono contenere soltanto i propri laboratori: una extension nei relativi slot storici è rifiutata, anche con impronta valida. Nello stesso workspace una coppia typeId/version non può identificare payload differenti. La modifica strutturale di un'istanza conserva typeId e richiede esattamente la versione successiva; cambiare i soli valori conserva la versione della definizione e produce una revisione dell'oggetto. Importare una definizione immutata conserva versione/impronta. Derivarla avanza la versione; una typeId esplicitamente diversa avvia una nuova identità dalla versione1.

La lineage già ricevuta non è riscrivibile. Per ogni cambio di definizione il Core aggiunge automaticamente l'origine della release precedente, compresa la licenza dichiarata. Un'origine importata priva di autore non riceve un autore inventato. L'export di un oggetto aggiunge identità/revisione/creatore/data e le fonti alla revisione citata; conserva separatamente il locator della citazione e quello della fonte. Una fonte storica non disponibile è dichiarata mancante, mai rimpiazzata dalla latest. Queste sono attribuzioni dichiarate, non firme del creatore esterno, attestazioni di diritto o compatibilità legale delle licenze.

Budget espliciti del primo formato: JSON 128 KiB, 8.000 valori, profondità20, 100campi, 200componenti totali, 32origini; espressioni1.000caratteri, 400token/nodi, profondità32. Il limite di32origini può arrestare ulteriori derivazioni: il sistema rifiuta senza troncare la provenienza. Sono budget di risorse da evolvere con misure e migrazioni, non limiti alle materie o ai tipi inventabili; non è ancora dimostrata una scala generale di creazioni molto grandi.

## Stessa autorità e interoperabilità

UI e MCP usano gli stessi comandi add/replace, revisioni attese, permessi, eventi e ricevute nel Core/PostgreSQL. Nessun catalogo o store autorevole parallelo. `ardesia://extension-format` espone schema, primitive, grammatica e limiti al client MCP; un client ufficiale esterno crea un nuovo tipo annidato, ne modifica lo stato e legge la revisione precedente attraverso stdio→HTTP→PostgreSQL. Compatibilità con gli host commerciali e HTTP/OAuth remoto restano da provare. MCP non partecipa all'elaborazione di ogni gesto della penna.

La vista della lavagna è statica per non confondere selezione/spostamento con modifica; i controlli attivi si trovano nelle proprietà e nell'anteprima Creator. La dispensa HTML mostra uno stato statico privo di input/azioni; LaTeX conserva nome, descrizione, stato e licenza, dichiarando che queste interazioni/grafici non sono tradotti in TikZ. La copia offline legge la definizione, mentre creazione e modifica delle extension richiedono il percorso remoto corrente. L'ink offline precedente resta indipendente da AI e rete.

## Migrazione e ritorno

Snapshot1–5 sono letti come schema6 senza mutare i byte salvati; la prima scrittura accettata produce la nuova busta. Una extension mascherata in un vecchio schema viene rifiutata. La migrazione SQL004 amplia il vincolo da4/5 a4/5/6 senza riscrivere workspace. Il restore logico ora apre e valida ogni snapshot con il Core anche senza registrazioni audio.

Prima della migrazione della preview è stato acquisito un dump locale e verificata l'invarianza dei dati. Il vecchio codice non sa leggere snapshot6: dopo nuove scritture non basta tornare al precedente binario. Occorre un lettore compatibile o un ripristino autorizzato su destinazione vuota, conservando separatamente i dati successivi; nessun downgrade silenzioso o reset della preview è previsto.

## Verifica e limiti

Prove mirate su integrità, collisioni, versione, lineage/licenza, migrazioni e restore; parser con injection/budget/rinomina lessicale; grafici con estremi grandi/piccoli e coordinate finite. Browser desktop/mobile: nuovo tipo annidato, campi incompleti, modifica valori/struttura, reload, export/import con fonte storica, derivazione/licenza, protezione JSON e ACK perso. Regressione completa mantiene offline, audio, dispensa, lavoro studente, revoca e plugin firmati. Report e review indipendente appartengono al digest esatto, nel pacchetto locale esterno.

REA ha osservato comportamento pubblico di Excalidraw, analizzato artefatti distribuiti Excalidraw/tldraw e ripercorso l'app reale. Il trasferimento riguarda separazione degli strumenti, proprietà contestuali, identità della definizione e stato dell'istanza; nessun codice donor è incorporato. Concept e screenshot finali vengono confrontati esplicitamente. App native, Safari/iPad/Apple Pencil, latenza fisica, collaborazione simultanea, esecuzione terzi, pubblicazione commerciale e interoperabilità dei provider restano non dimostrati. Microcorsi, gestionale tutor e community rimangono parti fondamentali del programma, non sostituite dal Creator.
