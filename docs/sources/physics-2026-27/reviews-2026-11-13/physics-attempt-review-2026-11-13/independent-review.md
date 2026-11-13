# Revisione indipendente — rilettura dei tentativi

Esito: nessun P1/P2 individuato nel delta finale da `e2f9236b1eb2106ab4980768be8f24fee2dd5f48` a `d4d8456b6048aed00942b4f73a53396e04d19090`. I dieci SHA256 della ricevuta JSON coincidono con i file del commit verificato. Sorgenti condivise non modificate dal revisore.

## Comportamento verificato sul codice

`CourseStudio.tsx:53–54` seleziona i tentativi dell'unità, assegna gli indici prima del filtro e filtra esclusivamente per `stage` o `attempt.helpUsed.length`. I numeri restano quelli della cronologia dell'unità. `packages/core/src/courses.ts:115–116` acquisisce `helpUsed` al salvataggio; gli aiuti consultati in seguito non riclassificano i tentativi precedenti. Il contratto rende l'array obbligatorio. Il filtro non legge il testo libero e non attribuisce voti o padronanza.

L'evento del select chiama solamente `setAttemptFilter`; non invia comandi, non modifica `answer`, non cambia la fase e non passa da `navigate`. Il reset è nello stesso effetto già presente per edizione, delivery, unità e delivery non valida. Le edizioni sono riferimenti immutabili: non occorre aggiungere una dipendenza dalla revisione della stessa unità in un'edizione. Il filtro transitorio non altera il percorso di salvataggio o la protezione del ragionamento in bozza.

Il select ha etichetta nativa, focus e target minimo di 44 px tramite il CSS esistente; il conteggio `role=status` esplicita anche zero risultati. Il diff di CSS, editoriali, pacchetti, Core, contratti e Remote Client rispetto alla base è vuoto. «Senza aiuti» resta circoscritto agli aiuti registrati: il documento lo distingue esplicitamente dall'indipendenza da aiuti esterni.

## Prova e correzione dell'attesa

Ho letto l'intero test esteso e il relativo consumer. Rimangono le quattro risposte reali: previsione, due attività e transfer, con snapshot degli aiuti `[[], [], [referenceFeedback, recovery], [referenceFeedback, recovery]]`. Le nuove asserzioni verificano tastiera, caso vuoto con bozza conservata, tutti i sei valori del filtro, numeri 01–04, immutabilità dell'intero `courseSpace` durante il filtro, cambio unità, reset e reload. `personalProjection` esporta la proiezione tramite API, non legge un mock della UI.

Ho letto i reperti iniziali: `e2e.json` e `e2e.log` registrano due FAIL su `5e26e6e4c56eeb78dec77d26acdcebc02dc89b6b`. Entrambi si fermano sul confronto revisione attesa 11/ricevuta 10; i contesti di errore mostrano una modifica da confermare e la fase precedente ancora premuta. I fallimenti sono conservati in `artifacts/physics-attempt-review-2026-11-13/initial-browser-5e26e6e/`.

Il commit finale aggiunge solo l'attesa `aria-pressed=true` dopo l'ultimo cambio fase, prima dell'esportazione API, più la nota nel dossier. Ho verificato byte per byte che la UI sia identica a `5e26e6e` e che eliminando quella singola riga il test coincida con il precedente. Valore atteso `+3`, uguaglianza di tentativi/aiuti e snapshot dopo reload restano invariati; nessun timeout è aumentato. L'attesa è coerente: in quel punto la risposta è vuota, quindi `stage` proviene da `work.currentStage`, e il Remote Client adotta la proiezione dopo la ricevuta server. Non è un indebolimento dell'asserzione di persistenza.

## Limiti

Non ho eseguito browser, unit test o build. La correzione del test non equivale a un PASS del candidato finale: la nuova ricevuta runtime resta separata. Il browser esteso copre direttamente reset per unità e reload; reset per edizione/delivery è verificato sul codice. Non sono attestati dispositivi fisici, iPad/Apple Pencil, Safari/Firefox, screen reader o accessibilità integrale. Nessuna modifica scientifica, pubblicazione o approvazione umana è stata effettuata.

Ricevuta completa: `/tmp/ardesia-attempt-review-code-review.json`.
