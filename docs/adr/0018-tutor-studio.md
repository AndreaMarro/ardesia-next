# ADR0018 — Lo studio del tutor, nello stesso Core

Stato: preparazione locale isolata. Il gestionale completo e i gate remoti non sono accettati da questa decisione.

Il programma generale e il programma6novembre chiedono che lezioni e nucleo gestionale crescano insieme. Il nuovo percorso collega persona → richiesta → appuntamento → revisione della lezione → consuntivo → registrazione economica. Agenda, studenti, gruppi, pacchetti e conti sono viste dello stesso patrimonio autorizzato, non un secondo gestionale con un database distinto.

## Identità e storia

Contratti0.8, snapshot8, migrazione SQL006. La lettura degli snapshot1–7 aggiunge il registro vuoto solo in memoria. La migrazione SQL amplia il vincolo; non riscrive i documenti. Nuovi campi o eventi tutor mascherati da una versione precedente sono rifiutati. Import originali e identità storiche v4 restano compatibili. Una scrittura produce atomicamente stato, evento e ricevuta nel Core/PostgreSQL esistente; l’apertura e il commit rieseguono tutta la storia tutor.

Contatto, richiesta, gruppo, pacchetto, appuntamento e pagamento hanno ID stabili e revisioni. Ogni comando porta ID e revisione attesa. Il registro è privato al docente proprietario; essere un contatto commerciale non concede accesso a materiali o risposte. Lo studente riceve uno spazio tutor vuoto. Le proiezioni non sono autorità e i retry preservano il comando originale.

Gli appuntamenti usano UTC e zona IANA. La UI mostra il fuso del dispositivo, controlla il round-trip e richiede un offset per ore locali ripetute, comprese transizioni non intere. La conferma ricontrolla sovrapposizioni del tutor con intervalli half-open: estremi adiacenti ammessi. Una lezione di gruppo ha partecipanti nello stesso appuntamento. Il gruppo non è una prenotazione di posti aperta al pubblico. La richiesta collegata non può cambiare persona invalidando un appuntamento.

Spostamenti e annullamenti richiedono motivo. Un appuntamento svolto non torna programmato o annullato: le correzioni di durata, presenze e compensi sono nuove revisioni motivate, conservando il consuntivo precedente nello storico. Non si dichiara che una presenza attesti apprendimento. Il collegamento didattico fissa una revisione alla selezione, senza aggiornamento implicito quando la lezione cambia; sono distinti lettura di quella versione e apertura della lavagna corrente.

## Tempo e conti

Minuti riservati dai programmati e minuti consumati dai consuntivi con presenza sono distinti. Un pacchetto appartiene a una persona/valuta; una sessione a pacchetto non applica anche un compenso singolo. Scadenza e capienza includono le prenotazioni, ricontrollate sotto il lock del workspace. L’assenza non consuma minuti; l’annullamento non li consuma. Un eventuale addebito per assenza o annullamento è un importo singolo esplicito, mai una policy implicita.

Prezzi dei pacchetti e compensi singoli consuntivati/annullati costituiscono obbligazioni distinte dagli incassi. Gli appuntamenti programmati non generano credito. Importi interi nelle minor units della valuta, aggregati con BigInt per evitare perdita di precisione. La dashboard non somma valute diverse e non presenta ricavi come profitto: costi, imposte e contabilità fiscale non sono implementati.

Il pagamento è una dichiarazione manuale di denaro già ricevuto: data non futura, target/revisione esatti, importo entro il residuo e riferimento non vuoto unico fra le dichiarazioni attive dell’owner. Lo storno richiede motivo, conserva la registrazione e non esegue un rimborso. Si rifiutano modifiche del contesto economico che invalidano incassi attivi. Il registro non esegue pagamenti, messaggi, prenotazioni provider o rimborsi.

## Interfaccia e interoperabilità

Studio è una vista caricata su richiesta, con agenda, elenco persone, editor, campi personalizzati, storico, esportazione JSON e calendario ICS. La bozza conserva testo e struttura anche durante un conflitto. Gli ACK tardivi aggiornano la revisione del comando confermato, senza adottare la revisione concorrente o cancellare testo successivo. I pagamenti mantengono il contesto iniziale del dialogo quando il target cambia. Gli errori di rete lasciano il comando nella recovery account-scoped esistente. Le modifiche tutor richiedono connessione; la lavagna offline precedente resta un percorso distinto.

MCP espone ricerca paginata vincolata a workspaceRevision, lettura della revisione esatta e preview/apply dei tre comandi tutor. Le letture tornano all’autorità a ogni richiesta. L’accesso in scrittura rimane esplicito nella configurazione; preview non certifica approvazione umana. Una ricevuta ripetuta restituisce il valore storico della sua revisione. Nessun nuovo provider AI o calendario è richiesto. I limiti di dimensione sono espliciti; il trasporto del workspace completo resta da evolvere per grandi carichi.

## REA e risorse

[Ricerca e limiti](../sources/tutor-studio-2026-11-07.md): REA6.8 analizza cinque sorgenti del donor Cal.diy MIT, con3138 nodi AST e641 unknown conservati. Si adattano intervalli e guardie, si sostituisce il check veloce che può chiamare disponibile uno slot riservato, e si escludono side effect automatici. Nessun codice donor copiato. La verifica del consumer è distinta dall’analisi donor.

Budget versione2: JS iniziale240KiB gzip, tutti gli asset non appartenenti al motore programmabile272KiB, motore opzionale320KiB gzip/1MiB raw. La soglia non-programmabile precedente240KiB viene superata dall’aggiunta del gestionale e rimane misurata come confronto, insieme al precedente totale JS. Nessun asset già presente è riclassificato per superare il gate. L’interfaccia tutor è lazy; i suoi contratti condivisi sono parte del nucleo. Queste metriche di distribuzione non attestano latenza Apple Pencil o prestazioni fisiche.

Verifiche richieste: unità causali e avverse, HTTP/PostgreSQL reale, MCP client ufficiale, browser desktop/mobile, recovery/conflitti, revisione indipendente e migrazione preview con confronto dei dati. Le prove devono appartenere alla stessa sorgente finale. iPad/Apple Pencil, Safari, app native, contabilità fiscale, costi, ricorrenze complesse, Google Calendar/OAuth, incassi provider e carichi produttivi restano aperti. Nessun cambio di scheduler, claim, account remoto, spesa o distribuzione pubblica.

Rollback: il codice precedente non può aprire snapshot8 già scritti. Conservare backup pre-migrazione e dati correnti; usare restore esclusivamente su destinazione vuota secondo il runbook. La patch reversibile riguarda il codice, non equivale a rollback dei dati.
