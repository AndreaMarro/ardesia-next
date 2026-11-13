# Consegna applicativa del 13 novembre 2026

Base recuperata: `AndreaMarro/ardesia-next` PR52 `b587102dda02c65a6b9bce63cdc38834a98d1984`, sopra PR51 e PR50. Preparazione isolata `work/physics-beta-20261113`, senza merge/deploy o modifica del coordinamento remoto. Non è la dichiarazione di una beta commerciale completa.

## Risultato implementato

- **Corsi:** 200 coppie domanda/risposta rimosse dalle spiegazioni anticipate e conservate nel feedback esplicito delle38unità. Teoria/esempi anteriori al blocco invariati; stessi ID e domande, DRAFT/humanApproval=false conservati. L'importatore preserva vecchie edizioni: per vedere la nuova preparazione occorre una nuova importazione in uno spazio nuovo. Non promette indipendenza semantica o sicurezza d'esame.
- **Anteprima:** `/fisica/index.html`, cinque pagine C1–C5 con programma, teoria, problema originale e soluzione richiudibile. Il laboratorio dimostra Q∝r⁴ a Δp/η/L fissati e dichiara le ipotesi. Nessun account richiesto per la demo; nessuna risposta registrata. Il generatore legge i contenuti editoriali esistenti ed è incluso nella build.
- **Percorso commerciale:** CTA WhatsApp con corso e richiesta non vincolante, contatti recuperati dalla landing legacy. Non invia automaticamente, non crea iscrizioni e non accetta pagamenti. Nessuna vendita/prenotazione acquisita. Il link allo spazio principale usa l'autenticazione Ardesia esistente, non un nuovo accesso dimostrativo.
- **Cortex:** `tools/cortex/`, CLI locale Python/SQLite FTS5, aggiornamento per hash, ricerca con provenienza e budget. Provato concretamente sul recupero dell'importatore usato per questa modifica. Non è ancora agente autonomo, modello locale, grafo causale o addestramento dai risultati.

Avvio con Node24 e dipendenze del lockfile: `npm run dev`; demo a `http://127.0.0.1:4173/fisica/index.html`. Senza database il solo workspace autenticato non è utilizzabile, mentre la demo non lo richiede. Build: `npm run build`. Rigenerazione esplicita dei corsi: `node tools/build-physics-pack.mjs`; demo: `node tools/build-physics-demo.mjs`.

## Prove e limiti

Il test mirato sulle tre suite Fisica passa15/15. Review indipendenti incrociate dei due specialisti: contenuti, demo e Cortex separati; l'autore della patch didattica non l'ha approvata da solo. Cortex:17unittest, inclusa controprova RED/GREEN del fsmonitor Git; nessun modello o rete. Il fsmonitor configurato nel repository poteva eseguire uno script durante `ls-files`: ora è esplicitamente disabilitato insieme a hooksPath.

Browser Chromium locale:390/820/1440px, cinque pagine, tastiera, estremi0,5 e1,5 del laboratorio, soluzioni chiuse inizialmente, CTA ispezionate senza invio, zero richieste esterne/errori; percorso senza JavaScript verificato. Screenshot mobile ispezionato; etichette SVG ingrandite dopo review. Nessuna prova Safari/iPad fisico o Apple Pencil.

Le ricevute grezze sono in `artifacts/launch-2026-11-13/` (escluse da Git), con suite finali negli artifact standard. Conservati fallimenti iniziali: sandbox EPERM; test discendenti orfani con PID1=`tail`, poi controprova PASS tramite subreaper Linux senza cambiare test o timeout; suite PostgreSQL inizialmente non eseguita per database assente. I risultati finali vanno letti nei report, non dedotti da questi test parziali. Il subreaper è un adattamento dell'ambiente di collaudo, non del prodotto.

Il pilot Cortex Linux trova5/5file attesi su cinque query; byte/4 è stima euristica e non token fatturati. Confronto su ticket reali con `rg`, M4 16GB, inferenza locale, world model, CfC/Liquid/SSM/JEPA/Timestral e automiglioramento restano non misurati. Le decisioni e i limiti sono in `tools/cortex/README.md`.

## Recupero documentale e confini

Letti ingresso/AGENTS/storia/handoff Next, PR50–52 e cursore remoto; catalogo/README/SOURCES della landing legacy alla SHA `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`; audit e file editoriali effettivi. Ricerca Drive Ardesia/Cortex e pagine personali: risultati parziali, non recupero integrale di tutte le chat. Ricerca GitHub Cortex trova soprattutto il CAS matematico omonimo; non prova assenza di altri documenti. README root `ardesia-knowledge` non disponibile tramite fetch404; non si dichiara letto quel repository per intero.

Syllabus ufficiale: https://www.mur.gov.it/sites/default/files/2026-06/Syllabus_FISICA_%20finale%202026.pdf, estrazione integrale via Exa e confronto nel nuovo audit Fisica. Sette unità rappresentate; copertura didattica integrale, quote temporali di esercitazione e revisione scientifica umana non dimostrate. I200codici sono sotto-obiettivi editoriali. Inventario attuale:752oggetti,259quesiti legacy unici (290collocazioni),200verifiche,39problemi originali,16tipi di laboratorio. Non sono migliaia di originali verificati.

Il traguardo16novembre resta un obiettivo, non una vendita garantita. Prima di un'offerta vincolante mancano consegna/calendario sostenibili, condizioni/prezzo definitivi, attivazione e prova del percorso prenotazione→accesso e decisione editoriale sulla beta. La richiesta al titolare riguarda la disponibilità reale per i primi iscritti, non una scelta tecnica ripetuta. Nessuna pubblicazione promozionale o messaggio a potenziali clienti eseguito.

## Materiale promozionale pronto per revisione

**Titolo:** La fisica comincia con un perché.

**Testo breve:** Stai preparando Fisica per il semestre aperto di Medicina? Esplora cinque percorsi tematici: modelli chiari, problemi ragionati e fenomeni da mettere alla prova. Nella demo gratuita puoi osservare come cambia la portata in un tubo e confrontare i tuoi passaggi con cinque problemi svolti. I corsi sono in preparazione: chiedi disponibilità e condizioni prima di aderire.

**Dimostrazione di60secondi:** aprire C1–C5; scegliere Fluidi; chiedere la previsione sul dimezzamento del raggio; muovere il cursore a0,5 e leggere1/16; spiegare quali grandezze sono fisse; aprire il problema sulle resistenze idrauliche; mostrare la soluzione solo dopo il tentativo; chiudere con richiesta di informazioni non vincolante. Registrazione video non prodotta né pubblicata.
