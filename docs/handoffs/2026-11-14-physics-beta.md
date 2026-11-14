# Beta Fisica - consegna del 14 novembre

Sessione autonoma di cinque ore sul Mac mini M4, isolata dalla PR53 `8fbebc1`. I sorgenti sono nella draft [PR54](https://github.com/AndreaMarro/ardesia-next/pull/54), branch `codex/physics-beta-20261114`. Il mandato autorizza pubblicazioni frequenti e preview Vercel protette. CI e deploy vengono riportati nella PR per ogni SHA; il PASS di una revisione non si trasferisce alla successiva. Main, produzione, SSO e alias canonico staging restano separati.

## Esperienze disponibili nel candidato

- Avvio e ripresa diretti di C1-C5 dal catalogo, con una sola consegna privata anche fra device e recupero delle importazioni interrotte.
- 38 lezioni pubbliche con 279 problemi e verifiche: 79 originali e 200 assessment. I 290 oggetti di pratica legacy nel Core sono distinti.
- Due prove da 31 quesiti ciascuna: 21 scelte con cinque alternative e 10 completamenti, in 50 minuti o senza timer. Il recupero rimanda alle lezioni canoniche. A/B coprono 30 lezioni primarie su 38, non ogni obiettivo del syllabus.
- Salvataggio esplicito del tentativo in JSON e ripresa dalla stessa edizione. Il file conserva risposte, segnalazioni, domanda e scadenza originale; un file scaduto mostra subito il risultato. File incompatibili o malformati vengono rifiutati. Nessun autosalvataggio nel browser: le modifiche successive al download non sono nel file. File e orologio locale non sono autenticati.
- Risultato esportabile in JSON e ripasso HTML autonomo, leggibile senza rete o JavaScript e stampabile in PDF.
- Laboratori: urti C1, Poiseuille C2, primo principio e percorsi p-V C3, campo/potenziale C4 in 3D e 2D, interferenza C5. Il video C4 dura 38 secondi, senza audio, con trascrizione, sottotitoli e sorgenti di produzione.
- Quaderno degli esperimenti in PDF: cinque schede da annotare e due pagine di confronto, con modello, previsioni, bilanci e problemi di trasferimento. [Sorgenti e review](../media/physics-workbook/README.md).
- ZIP offline completo: estrarre tutti i file e aprire `index.html`. Include lezioni, laboratori, prove, video e quaderno PDF. Limiti invariati: 256 file, 2 MiB per file, 16 MiB totali. Fonti e contatti esterni richiedono rete; lo spazio Core richiede accesso separato. Il download GitHub viene verificato anonimamente sulla SHA immutabile.
- Companion macOS AppKit/SwiftUI: penna, gomma, pagine, undo/redo, file validato e PDF vettoriale. Autosalvataggio dei file già nominati. Un PDF reale esportato dal companion è stato importato, annotato e riaperto nel Core. Nessuna sincronizzazione o seconda autorità.

## Qualità e prestazioni

Le review indipendenti hanno individuato e fatto correggere problemi concreti: runtime offline, inquadratura mobile, segno dei numeri, tratti fuori foglio, ciclo di chiusura nativo, titoli lunghi e dimensioni dei bersagli touch. [Ricevute e limiti](../sources/physics-2026-27/reviews-2026-11-14/README.md). Tutti i contenuti rimangono DRAFT/humanApproval=false.

Sono stati ricalcolati i 79 problemi originali, esaminati i 200 assessment e confrontati tutti i 279 quesiti fra sorgente, pacchetti e lettore. Due audit separati coprono il contenuto teorico sostanziale delle 38 lezioni, con regioni ed esclusioni dichiarate. Corrette la formula del prodotto scalare nel piano/in 3D e l'estensione impropria dell'ipotesi paraassiale alla legge di Snell. [Completamento dell'audit e correzione](../sources/physics-2026-27/theory-completion-2026-11-14/review.md). Non è approvazione umana, verifica audiovisiva integrale o audit dei 290 oggetti legacy.

C2 locale: evitare migrazioni inutili porta il benchmark Core/MemoryStorage da 5,885 a 4,077 secondi e il confronto browser completo da 36,575 a 32,472 secondi. La successiva lettura unica nel render del catalogo porta un nuovo confronto browser da 32,489 a 24,047 secondi. Tre campioni per versione sul Mac condiviso; percentuali non additive e nessuna garanzia remota. Comandi, revisioni, validazioni e persistenza rimangono invariati.

Il budget Core rimane 336 KiB dopo ADR0025, quello iniziale 240 KiB. Minificazione con Terser già presente e sorgenti leggibili; nessun asset riclassificato per superare i controlli. I valori finali appartengono agli artefatti della singola SHA.

Cortex 0.2 rimane deterministico. Gli esperimenti Qwen locale e grafo degli import diretti non hanno dimostrato un vantaggio e restano fuori dal percorso predefinito. Sono conservati protocollo e risultati negativi, senza promesse di risparmio token/costi, selezione automatica dei test o modello causale del progetto.

## Riproduzione e limiti

Web: Node 24, dipendenze bloccate, PostgreSQL di test isolato. Usare `npm run verify` e i test browser con i database dedicati secondo i runner esistenti. `node tools/build-physics-pack.mjs` rigenera i pacchetti; la build genera lettore, runtime, ZIP e manifest. I runtime pubblici derivano da `tools/physics-runtime/`: non modificarli direttamente.

Companion: da `native/macos-notebook`, eseguire `script/check.sh`, `script/check-lifecycle.sh` e `script/build_and_run.sh --build-only`, con cache e bundle fuori dal repository. Formato e uso sono nel README locale. Firma ad hoc sul Mac di sviluppo, non notarizzazione o qualificazione iPad/Pencil. Le bozze senza nome, le modifiche non scritte e l'undo dopo riavvio non hanno garanzie di recupero.

La preview Vercel richiede SSO. READY non equivale a smoke remoto autenticato; il browser della sessione arriva alla pagina di login. Il pacchetto statico pubblico è distinto dall'accesso al Core. Per il 16 novembre la proposta sostenibile è anteprima gratuita e richiesta informativa non vincolante: prezzo, condizioni, pagamento e consegna del servizio acquistato non sono attestati. Nessun messaggio promozionale è stato inviato.

Rollback con revert mirati, conservando sorgenti e prove; nessun aggiornamento silenzioso delle edizioni già importate e nessun reset dei dati.
