# ADR 0024 — Prossimi passi dalle prove osservate

8 novembre 2026. Prosecuzione del mandato diretto, senza migrazioni, dipendenze o nuovo registro autorevole.

## Esperienza e confine

Lo studente vede «Prossimo passo» prima di aprire il diario; il docente vede le risposte condivise ancora da rivedere. La proiezione pura `projectLearningEvidence(authorizedWork)` convalida e copia lo snapshot già autorizzato dal Core. Non legge storage, orologio, eventi privati o fonti aggiuntive e non assegna competenze.

Le catene usano esclusivamente `replyToFeedbackId`. Due risposte allo stesso oggetto senza questo collegamento restano indipendenti. Il feedback corrente segue l’ordine convalidato della storia, non il timestamp. Una correzione collegata al feedback corrente sostituisce la richiesta iniziale con l’attesa relativa alla nuova risposta; il feedback sulla correzione determina il passo successivo della catena.

Una rettifica successiva alla correzione non ricolloca retroattivamente quest’ultima: la scheda invita a rileggere il feedback aggiornato, il diario conserva e collega quello originale. La rettifica conclusiva `demonstrated` senza istruzione resta provenienza, senza creare una richiesta fittizia. La priorità è deterministica: rettifiche con indicazioni, richieste di correzione, altre indicazioni esplicite, attese; a parità vale l’ordine dei tentativi. Gli altri passi sono consultabili.

«Dimostrato» riguarda il singolo tentativo. Il testo del prossimo passo è quello del docente; l’attesa è uno stato del flusso. Un’indicazione libera dopo un esito dimostrato non viene tradotta in un comando sull’oggetto corrente: può riguardare un altro compito. «Riprendi il feedback» riusa il percorso esistente di correzione, con protezione di bozza, fonte cambiata/rimossa e rettifica concorrente.

Il diario apre la prova scelta e mantiene collegamenti in entrambe le direzioni. La fonte storica passa ancora da `readAttemptSource`, su azione esplicita. Oltre all’epoch asincrono, la visibilità controlla sincronicamente Core, attore/ruolo, documento, studente, revisione del lavoro, tentativo e revisione della fonte: ID e contatori coincidenti fra lezioni non autorizzano il riuso della fonte visualizzata. Revoca o cambio snapshot rimuovono la scheda; una risposta tardiva non la ripopola.

## Scelta cognitiva e riuso

La [ricerca](../sources/lessonos-evidence-2026-11-08.md) distingue conoscenza, previsione di successo e richiamo mnemonico. I dati attuali non hanno rubriche/abilità validate né contesto strutturato degli aiuti; `partial` non è un errore binario e `demonstrated` non è padronanza generale. L’output dichiara `not-estimated` e motivi circoscritti, consultabili in «Su quali prove si basa». Un collegamento a feedback non prova che lo studente abbia utilizzato un aiuto. Nessun prior arbitrario, punteggio o nuovo esercizio viene inventato.

Il confronto sintetico e l’analisi REA già raccolti sono riusati per questa decisione. BKT/PFA/FSRS non sono dipendenze del prodotto; il confronto non giustifica un modello neurale, una prestazione didattica o un adattamento automatico. Servono prima item e criteri esatti, opportunità indipendenti, aiuti dichiarati/osservati e tempi affidabili.

## Risorse, prove e rollback

Il primo candidato supera il limite Core320KiB. La shell offline ora ricava i percorsi dalle chiavi dei digest e codifica gli stessi32byte SHA-256 in base64: ogni risorsa resta inclusa e verificata. La chiave della cache deriva ancora dall’intero manifesto; i client precedenti terminano con la propria build. Non cambiano algoritmo, isolamento API, gestione dei byte alterati, limiti o classificazioni degli asset. La misura intermedia scende da328760 a326455byte Core; i valori finali sono nei report della head.

Controprove: correzione in attesa senza richiesta duplicata, catena e tentativi indipendenti, rettifica conclusiva, indicazione relativa ad altro oggetto, conservazione di bozza/storia, revoca con fonte tardiva e collisione fra lezioni. Il controllo limitato alla sola revisione del lavoro riproduce la fonte sbagliata in entrambi i browser; il nuovo controllo deve superare la stessa prova. La shell generata rifiuta un singolo byte cambiato in ciascun asset della fixture e non intercetta API, query o origini esterne. Verify/browser/CI restano risultati separati sulla sorgente esatta.

Rollback: revert dei consumer e della proiezione; dati e feedback non vengono riscritti. Il builder e worker offline vanno ripristinati insieme. Nessuna accettazione scientifica, stima calibrata, memoria semantica o sincronizzazione nativa è implicata da questo incremento.
