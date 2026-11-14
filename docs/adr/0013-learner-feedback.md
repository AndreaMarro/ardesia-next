# ADR 0013 — Tentativo, feedback e ripresa

Preparazione locale isolata del mandato diretto del 7 novembre 2026, consumer di `LESSON-CONTINUITY` e primo diario per `KNOWLEDGE-DIARY`. Nessuna modifica alla coda o alle accettazioni. Le sette chat e il patrimonio selettivo sono già documentati nelle [fonti](../sources/spatial-board-2026-11-07.md); nessuna nuova analisi REA o lettura delle chat dichiarata per questo incremento.

## Percorso e autorità

Gli oggetti esistenti mantengono identità e revisioni. `review-learner-attempt` aggiunge un feedback immutabile con ID, tentativo, autore docente, tempo, esito (`revise`, `partial`, `demonstrated`), commento e passo successivo. Una rettifica deve citare il feedback più recente dello stesso tentativo. `demonstrated` valuta la risposta precisa, senza dedurne competenza generale o approvazione della fonte.

`record-learner-attempt` può citare `replyToFeedbackId`: feedback corrente di un tentativo precedente dello stesso studente, documento e oggetto. La correzione registra la propria revisione fonte, distinta da quella originale. Fonte o feedback cambiati durante la stesura richiedono rilettura esplicita, conservando il testo e il riferimento corretto. Le bozze non sono un archivio offline studente.

Il docente lavora nelle evidenze condivise del dialogo di assegnazione; lo studente riprende nel diario del proprio lavoro. `readAttemptSource`/`read-attempt-source` legge soltanto la revisione referenziata dal tentativo autorizzato, anche dopo rimozione dell'oggetto. Gli API generali dello storico rimangono owner-only. Un laboratorio storico mostra dati e versione senza eseguire la release.

Core verifica ruolo, proprietario, assegnazione attiva e condivisione prima dell'idempotenza: anche un retry già confermato è rifiutato dopo revoca. CAS sul lavoro, evento e ricevuta restano un commit atomico. Lo schema valida attore, catena del lavoro, append-only dei feedback e immutabilità dei tentativi. La revoca della condivisione conserva i dati allo studente; la revoca dell'assegnazione blocca anche la lettura studente, mantenendo i dati per un'eventuale riassegnazione. Non si introduce accesso autonomo implicito.

Il polling esistente non è collaborazione realtime. Un rifiuto fonte/feedback invalida subito la proiezione eliminabile del client e impone una nuova apertura autorizzata; recovery e sessione rimangono. Le risposte precedenti non devono ripopolare né restituire evidenze invalidate. Un editor smontato per revoca non può chiudere una nuova bozza quando arriva il vecchio ACK.

## Diario derivato

`projectLearningDiary` ricostruisce tentativi, valutazioni, rettifiche e correzioni dalla proiezione Core autorizzata; non richiede eventi docente contigui, dato che quelli privati sono omessi. I conteggi descrivono risposte in attesa, da rivedere e giudicate dimostrate. Nessun punteggio automatico, percentuale, competenza inferita o store aggiuntivo. Diario fra lezioni, tassonomie, contestazioni, ricerca/backlink e transfer su prova diversa restano da sviluppare.

## Versioni, backup e rollback

Contratto 0.5.0, snapshot v5. Migrazione v4→v5 in memoria: cambiare soltanto la versione preserva eventi, work e ricevute. `feedback` e `replyToFeedbackId` sono opzionali senza default, quindi il fingerprint dei vecchi comandi non cambia. Campi/comandi nuovi etichettati v4 sono rifiutati. La migrazione operatore003 ammette v4/v5 senza riscrivere righe. Lettura e retry non mutano v4; la prima nuova mutazione accettata salva v5.

Backup v2/v3: checksum sull'envelope originale prima di normalizzare/migrare. L'identità semantica degli import device v1–v3 resta congelata alla forma canonica v4 (`parseLegacyImport`): nessun nuovo duplicato o invalidazione degli archivi al cambio del Core. Originali, hash, metadati e ricevute restano conservati. Il nuovo export normalizza gli snapshot a v5 soltanto nel backup, senza scrivere sul database.

Il vecchio runtime non apre v5: rollback del codice non è rollback dei dati. Conservare il backup precedente; ripristino eventuale esplicito su target vuoto secondo runbook. Non cancellare feedback o retroetichettare v5. Nessuna migrazione remota eseguita da questa preparazione.

## Prove e confini

Core: autorizzazione, revoca prima del retry, CAS/storage fallito, rettifica, fonti rimosse e riapertura v4. PostgreSQL reale: sessioni, migrazione e backup misti. Remote Client: primo rifiuto, risposte tardive e recovery. E2E desktop/mobile: sessione indipendente, fonte e feedback cambiati durante la bozza, lost ACK e nuova bozza dopo revoca/ricondivisione. I report e la review indipendente del candidato sono esterni al checkout; nessun PASS precedente certifica i nuovi sorgenti.

Browser plugin non disponibile: Playwright già configurato nel repository; browser integrato per l'ispezione manuale quando eseguita. Safari, iPad/Apple Pencil fisici e app native restano NOT_RUN. Nessun ASR/AI, feedback via MCP, corso completo, gestionale o marketplace commerciale è dichiarato realizzato da questo incremento.
