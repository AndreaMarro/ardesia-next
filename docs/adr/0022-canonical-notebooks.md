# ADR0022 — quaderni e pagine canoniche

Stato: candidato isolato del mandato diretto dell’8 novembre 2026. Nessuna adozione su main, distribuzione o accettazione didattica implicita. [Piano e prove](../handoffs/core-continuity-2026-11-07.md).

## Un catalogo, gli stessi documenti

Ogni proprietario ha un catalogo di quaderni, sezioni e pagine ordinate nel Core esistente. La pagina contiene ID, riferimento al documento, formato, sfondo e stato di archivio. Titolo, oggetti, fonti, audio e revisioni appartengono al `LessonDocument` canonico: nessuna copia dei contenuti né secondo store autorevole. La lavagna infinita resta accessibile sullo stesso documento. Un documento compare in una sola pagina del catalogo, incluse quelle archiviate.

La revisione del catalogo coordina gli spostamenti fra contenitori; la scrittura usa la revisione del documento. Creare quaderno o pagina produce anche un normale evento `create-document`, immediatamente precedente all’evento organizzativo. Una ricevuta composita copre esattamente entrambi, nella stessa `StorageAdapter.write` e nella stessa transazione PostgreSQL. Un errore, incluso il secondo ID evento duplicato, non modifica memoria o dati durevoli. Retry dopo rinomina o riordino restituisce la ricevuta originale senza riscrivere la storia.

Gli eventi organizzativi conservano il comando completo; apertura e commit verificano ricostruzione del catalogo, fingerprint, proprietario, sequenza, revisione e copertura delle ricevute. I titoli di creazione si confrontano con l’evento storico, non con il titolo attuale del documento. Le letture sono clonate. Nessun permesso è dedotto dal catalogo: il server ricava l’attore dalla sessione, consente il catalogo soltanto allo owner, anche studente, ed esclude spazi assegnati e altri proprietari.

Quote: 100 quaderni, 100 sezioni per quaderno e 500 pagine per proprietario, sempre entro i 500 documenti dello spazio. Le voci archiviate contano. I limiti di oggetti, eventi e recovery restano invariati. Archiviare conserva documenti, originali e condivisioni; ripristinare è reversibile. Collegare una lezione esistente è esplicito e richiede la revisione documentale vista nell’anteprima.

## Foglio, organizzazione e input

Formati A4, A5 e Letter, verticale/orizzontale; bianco/avorio e sfondo semplice, righe, quadretti o punti. La geometria usa 96/25,4 unità mondo per millimetro convenzionale: non misura millimetri fisici sul display. Cambiare formato non ridimensiona, sposta o taglia oggetti. Un elenco accessibile consente di raggiungere i contenuti oltre il foglio; l’anteprima mostra la geometria di massimo 100 ingombri, dichiarando il limite, senza eseguire plugin.

La libreria permette creazione, rinomina, spostamento anche da tastiera, archivio, ripristino e ricerca dei titoli nella sezione. Escape e croce proteggono le modifiche non salvate. Cambiare documento passa dai guard per bozza, gesto e registrazione. I comandi di messa a fuoco e zoom controllano i ref del gesto; gli strumenti sono disabilitati/inert durante la scrittura. La registrazione resta associata al documento di origine.

Un tratto nuovo inizia sulla carta; attraversarne il bordo continua lo stesso gesto, con lo stesso ID e tutti i campioni ricevuti. I contenuti preesistenti fuori pagina rimangono accessibili. L’immersione conserva camera e contenuto all’ingresso/uscita. L’azione esplicita **Avvicina il foglio** ingrandisce la carta fino a coprire il viewport: il resto del foglio si raggiunge con pan o due dita. I controlli scompaiono durante il tratto senza cambiare camera. Distinguere sempre area del canvas, intersezione della carta con il viewport e area dei controlli; la vista dell’intero foglio può occupare molto meno del 90% quando i rapporti d’aspetto differiscono.

L’importazione nel foglio accetta una pagina PDF per volta o un’immagine, proporzionata entro il formato. L’originale completo e il suo SHA256 restano conservati e scaricabili. Una bozza di importazione già durevole mantiene payload e ID originari, anche se proviene dalla lavagna. Non è ancora l’importazione automatica di un PDF in molte pagine del quaderno.

## Versioni, recupero e rollback

Contratti 0.12.0, snapshot 11, migrazione SQL009. La migrazione amplia il CHECK a 4–11 senza riscrivere snapshot/eventi/ricevute. Snapshot 1–10 si normalizzano in memoria con catalogo vuoto, senza scrittura o invenzione di quaderni; nuovi dati nascosti sotto una vecchia versione sono rifiutati. Il backup v4 ammette lo snapshot 11; il ripristino mantiene il divieto di destinazione non vuota. La migrazione è registrata nell’elenco eseguito dal server, con versione e digest derivati da quell’elenco.

`notebook-command` attraversa lo stesso Remote Client, coda immutabile, sessione e PostgreSQL. Il client cattura attore e selezione prima di attendere un lock e li ricontrolla prima della scrittura locale e dell’HTTP. Una risposta persa verifica lo stesso comando. La copia offline aggiornata precede la rimozione del recovery; un errore conserva l’intento.

La copia personale diventa `ardesia-own-lessons-v2`, con catalogo ridotto e documenti propri. Il reader v1 è conservato come fixture reale per verificare il rifiuto del downgrade: v1 si legge e normalizza senza write, mentre il vecchio reader non deve sovrascrivere v2. Catalogo assente da un vecchio server significa capacità sconosciuta (`null`), non catalogo vuoto autorevole. L’arricchimento della copia alla stessa revisione non può cambiare gli altri dati. Offline si consultano quaderni e si scrive con recovery; l’organizzazione richiede la rete. Non viene ricostruita una sessione o autorità Core locale.

Dopo nuove scritture, rollback soltanto a un reader compatibile o attraverso una migrazione inversa esplicita e verificata. Non rimuovere cataloghi, eventi, campi o record offline per simulare compatibilità. Esportare lavoro e recovery prima di cambiare client. MCP continua a leggere e modificare i documenti canonici attraverso le API esistenti; non espone ancora comandi organizzativi notebook.

## Risorse e limiti osservati

La quinta misura locale fallisce il tetto 304 KiB: 317.575 byte Core gzip. Le inizializzazioni Zod inutilizzate sono ora eliminabili dal bundler: il worker Program non contiene più gli schemi notebook e scende di 687 byte gzip. Dopo i guard input e l’azione di avvicinamento, il Core misura 317.738 byte e il JS iniziale 225.911 byte. La riduzione del worker è reale; non viene presentata come riduzione del Core.

La policy v5 porta esplicitamente il solo aggregato Core da 304 a **312 KiB** (319.488 byte) per il nuovo verticale: circa 6,3 KiB aggiuntivi rispetto alla consegna ink 013221f. Iniziale 240 KiB, Program 320 KiB gzip/1 MiB raw e PDF 3 MiB gzip/6 MiB raw restano invariati. Stessa classificazione, tutti i totali conservati, confronto con il vecchio limite 304 KiB ancora riportato come FAIL. È una scelta di prodotto, non una prestazione misurata né prova che ulteriori ottimizzazioni siano impossibili. Le misure finali appartengono agli artefatti della revisione effettiva.

Workload sintetico precedente sullo stesso algoritmo Core: 80 documenti, 280 comandi organizzativi, 30 tratti da 96 campioni; 390 eventi e 461.159 byte di snapshot. Commit ink p50 22,51 ms/p95 26,67 ms; riapertura 40,49 ms. Il confronto senza catalogo ha 110 eventi e p50 4,39 ms/p95 8,02 ms: il replay introduce un costo visibile. Questi tempi includono Core, validazione, fingerprint e clone di MemoryStorage; **escludono encoding JSON completo per commit, PostgreSQL, HTTP, rendering e penna fisica**. Il vecchio report usa il termine generico “serialization”: non interpretarlo come serializzazione completa del database. I tempi di preparazione non sono confrontabili a lavoro uguale (280 comandi organizzativi contro 80 creazioni semplici).

Il verticale non chiude lasso/redo, gesture native Pencil, collaborazione simultanea, ricerca OCR, import multipagina automatico, persistenza della camera, audio continuo fra documenti, export dell’intero quaderno o PDF completo. Questi limiti restano nel piano del prodotto; nessun modello cognitivo o efficacia pedagogica è attestato.

Un esperimento successivo sul medesimo workload limita a 64 eventi per finestra il calcolo indipendente dei fingerprint, mantenendo ogni verifica e il replay sequenziale. Prima: p50 22,28 ms/p95 26,18 ms, riapertura 40,47 ms; dopo: p50 20,06 ms/p95 23,93 ms, riapertura 37,19 ms. Gli snapshot finali e i 30 tratti sono identici dopo riapertura in entrambi i casi. Il controllo senza catalogo passa invece da p95 7,94 a 10,24 ms: non si rivendica un miglioramento generale. È un’osservazione sintetica su due esecuzioni, non una stima di latenza UI o un benchmark statistico. Nessuna cache autorevole, verifica saltata o fanout non limitato su 50.000 eventi; il costo di validazione resta un limite da misurare con spazi grandi.
