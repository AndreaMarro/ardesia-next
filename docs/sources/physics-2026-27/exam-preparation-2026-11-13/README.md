# Preparazione dell’allenamento: consegna, non funzione integrata

Questa cartella conserva il lavoro già avviato prima della richiesta del titolare di terminare le attività, fare handoff e chiudere l’obiettivo. **Non viene importata dall’applicazione e non contiene una simulazione completa utilizzabile.** Non sono presenti UI, timer, sessione persistente o integrazione dei risultati nel Core. Tutto il materiale didattico resta DRAFT, `humanApproval=false`.

## Materiale consegnato

- [Selezione](selection.json): 31 identità legacy già esistenti, 21 quesiti con cinque alternative e 10 completamenti numerici. Tutti C1–C5 e U1–U7, 26/38 lezioni; distribuzione editoriale, non ministeriale. Nessun nuovo quesito conteggiato.
- [Feedback](feedback.json): 105 spiegazioni specifiche, 105 indicazioni di ripasso, 10 svolgimenti e controlli dimensionali, 20 ipotesi educative esplicitamente distinte dalla diagnosi di uno studente. [Versione leggibile](feedback.md).
- [Prototipo del correttore](ardesia-exam-grading-proposal.ts): razionali BigInt, frazioni e decimali equivalenti, confronto esatto e punteggi in decimi interi. Nessuna esecuzione di espressioni arbitrarie, conversione di unità o tolleranza implicita.
- [Regole d’esame ricontrollate](exam-rules-recheck.md): guida istituzionale Sapienza 2026/27, 31 quesiti, 21+10, 50 minuti, +1/−0,10/0. Il confronto numerico del prototipo è una decisione di allenamento; non è l’algoritmo ministeriale, che non è stato accertato.

## Politica del prototipo

Una risposta vuota vale 0; corretta +1; errata −0,10. Un input non vuoto ma invalido è distinto internamente dall’errore numerico e vale −0,10 nella proposta. Un’eventuale UI dovrà spiegare questa regola e segnalare il formato invalido prima della consegna. Nessuna UI con questo comportamento è stata realizzata.

Le alternative richiedono ID A–E esatti. Nei numeri, punto e virgola sono separatori decimali; non sono separatori delle migliaia. Sono ammessi frazioni e notazione scientifica, senza scrivere l’unità. Limiti: 96 caratteri dopo trim/normalizzazione, 24 cifre scritte della mantissa per ciascuna parte della frazione, esponenti da −12 a +12. Il meno Unicode è normalizzato; denominatore zero e input come `1.` o `1,` sono invalidi. Il punteggio massimo grezzo è 31, non una conversione attestata in voto ufficiale.

La selezione conserva come fotografia storica `trainingComparator: NOT_IMPLEMENTED` e politica `UNDECIDED`; lo stato successivo del solo prototipo è quello descritto qui. Questi metadati non devono diventare un’altra fonte dello stato operativo.

## Prove riproducibili

Dalla radice del repository, con Node24 e le dipendenze del lockfile:

```sh
node docs/sources/physics-2026-27/exam-preparation-2026-11-13/grading.test.mjs
node docs/sources/physics-2026-27/exam-preparation-2026-11-13/grading-counterchecks.mjs /tmp/physics-grading-report.json
npx tsc --noEmit --strict --target ES2023 --module ESNext --moduleResolution Bundler --skipLibCheck docs/sources/physics-2026-27/exam-preparation-2026-11-13/ardesia-exam-grading-proposal.ts
```

Il test autore controlla 31 chiavi e 105 alternative, oltre a equivalenze e input malformati; **585/585 controprove indipendenti** passano. Il correttore è byte-identico al prototipo riesaminato; i due script qui sono adattati a percorsi relativi. Le controprove restituiscono exit nonzero in presenza di fallimenti e scrivono soltanto il report indicato come argomento. [Review finale del correttore](grading-review-final.md), [risultati portabili](portable-counterchecks.json), [adattamenti e hash](portability.json).

La [review indipendente dei feedback](feedback-review-final.md) chiude il P2 sul peso apparente dopo 48 ricalcoli nella revisione completa e ricontrollo del solo delta. I tre bilanci del delta non sono ricontati come altre verifiche distinte. Non sostituisce approvazione scientifica umana o calibrazione con studenti.

## Errori conservati e limiti

Le versioni `initial`, `before-physics-fix` e le review iniziali sono reperti storici, **non materiale da mostrare allo studente**. Conservano due P2 del correttore poi risolti, il separatore che troncava una formula e la spiegazione errata del verso di una forza nel feedback del dinamometro, corretta prima della consegna finale. [Correzione fisica](feedback-physics-correction.json).

I nuovi feedback Lorentz sono corretti; la soluzione legacy integrale in `editorial/bank-selection.json` contiene ancora il rinvio impreciso alla «seconda opzione». La chiave D resta corretta. Il sorgente legacy non è stato modificato: il problema è consegnato esplicitamente per una futura revisione, senza riaprire sviluppo dopo la richiesta di chiusura.

Nessuna pretesa di domande nuove, completezza del syllabus, segretezza d’esame, difficoltà calibrata, approvazione umana o beta commerciale. [Manifest degli artefatti](manifest.json).
