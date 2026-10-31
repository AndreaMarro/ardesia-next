# ADR 0005 — Autorità remota M3

Stato: implementato e verificabile con PostgreSQL locale; accettazione remota bloccata. La fonte degli esiti è `npm run status`, non questo documento.

**Nota di continuità, 31 ottobre:** il paragrafo sul blocco provider nella decisione originale è storico. L'osservazione del 30 ottobre registra Neon configurato; il runner M3 completo è ora presente. Restano da verificare accessi del runner, controprove e restore remoto. Vedere [ingresso corrente](../START_HERE.md); la decisione architetturale rimane invariata.

## Decisione

Un monolite modulare espone `POST /api/m3` come Function Node same-origin. PostgreSQL conserva account, sessioni, snapshot Core, archivi di import e ricevute di creazione. `@ardesia/server` compone il Core esistente attraverso export pubblici. `@ardesia/remote-client` offre alle viste una facciata di lettura delle proiezioni e invia i comandi al server; non esegue un secondo Core nel browser.

La composizione non sceglie un provider non disponibile: il progetto gratuito Supabase dedicato è stato rifiutato per quota e l'accesso alle variabili Vercel è vietato dai permessi della connessione. [Osservazioni effettive](../../operations/m3-environment.json). Nessun progetto esistente è stato fermato, riutilizzato o aggiornato per aggirare il blocco.

Il deploy usa Build Output API v3: una sola build produce statici, routing e Function Node già compilata con tutti i package e il driver. Il launcher Node riceve richieste HTTP e le adatta all'handler Web pubblico. Il worker firmato è copiato come asset immutabile nella Function. La verifica locale esegue l'artefatto compilato anche senza Vite; gli export workspace TypeScript non vengono lasciati al caricamento Node in produzione.

## Identità e autorizzazione

Gli account sono predisposti dall'operatore, con password scrypt e ruolo persistito. La sessione usa un token opaco, cookie HttpOnly/Secure/SameSite=Strict e solo l'hash del token nel database. Origin esatta, content type e campi stretti proteggono le mutazioni. L'header dell'account è esclusivamente una precondizione di uguaglianza con la sessione, utile a respingere una scheda rimasta aperta dopo il cambio account.

Le richieste derivano l'attore dalla sessione e dal binding di proprietà immutabile, quindi applicano il Core. Il ruolo database runtime non può gestire utenti, ruoli o schema. Le credenziali amministrative non entrano nella Function. La protezione Vercel controlla lo staging, mentre il cookie applicativo distingue docente e studenti.

Il docente possiede la lezione; lo studente possiede il lavoro associato alla lezione assegnata. Note, tentativi, stato e consenso personale sono separati da quelli degli altri studenti e dal documento docente. Condivisione delle evidenze esplicita e revocabile: il docente riceve solo i dati autorizzati correnti. L'esportazione HTTP è filtrata, mai uno snapshot amministrativo.

## Transazione e continuità

Ogni comando blocca sessione/account e riga workspace nella stessa transazione. Carica lo snapshot, esegue il Core, scrive snapshot/evento/ricevuta insieme e conferma prima di rispondere. Il controllo di revisione distingue un nuovo comando obsoleto dal retry della medesima operazione. La serializzazione è per workspace; non si dichiara scalabilità illimitata o collaborazione in tempo reale.

Lo snapshot v4 estende v3 con assegnazioni e lavoro personale. Le migrazioni v1/v2/v3 in lettura non scrivono automaticamente. L'importazione esplicita crea un contenitore nuovo, conserva i byte originali e usa anche un digest semantico per riconoscere duplicati. Il binding dell'owner conserva gli attori storici e i fingerprint delle ricevute senza permettere al browser di scegliere una nuova identità. Il consenso del vecchio dispositivo viene ritirato con un comando Core; gli oggetti e gli eventi precedenti restano conservati.

Il client usa un'epoca di sessione e una di selezione per scartare risposte tardive. La revisione del workspace non arretra. I comandi incerti mantengono ID/payload immutabili e richiedono risoluzione prima della successiva mutazione; il salvataggio locale non è una conferma del server. Logout e cambio account cancellano la proiezione visibile e isolano il recupero pendente per account.

## Plugin invariato

Il bundle Molla ideale resta SHA-256 `713b10ce53337e5bb03f0da86afec8a1266a8229115e9d1f571cf49766814148`. Il trust store pubblico è condiviso in `packages/plugin-host/src/first-party-trust.json`. Firma, digest, versione, publisher e capacità sono ricontrollati dallo stesso Host, anche sul server. Il server esegue lo stesso worker firmato con limiti di memoria e tempo; nessuna duplicazione del modello scientifico.

Il runtime studente richiede assegnazione, installazione docente attiva e consenso personale per quel rilascio. Le operazioni aggiornano l'autorizzazione prima di usare il worker. Revoche e cambio account sospendono il runtime; le revisioni obsolete non possono riattivare un modulo.

## Ripristino e limiti operativi

`exportBackup` produce una lettura coerente; esclude password, hash delle password e sessioni. `restoreBackup` verifica digest, identità e contratti e rifiuta un target non vuoto. Il test usa un database separato e dati sintetici. Il backup logico va conservato fuori dal database: non si presume un servizio automatico incluso nel piano gratuito.

La UI offre un import limitato a 4 MiB di richiesta e 2.000.000 caratteri di snapshot; i dati più grandi richiedono una procedura operativa separata. Gli export personali non sono backup amministrativi né un round-trip di import automatico.

Per chiudere M3 servono database dedicato senza nuovi costi, credenziali runtime soltanto nella preview, migrazione/provisioning espliciti e osservazione browser remota completa sulla SHA integrata. I gate distinguono quella prova dai test locali; M4 non può iniziare prima della chiusura reale di M3.
