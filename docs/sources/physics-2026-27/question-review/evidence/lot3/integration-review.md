# Review indipendente dell’integrazione — terzo lotto

Esito: PASS nel perimetro verificato. Nessun difetto azionabile trovato nel diff dei tre strumenti richiesti o nel percorso browser controllato. Questa è una review dell’integrazione; non ripete né presenta come indipendente la revisione scientifica dei quesiti C3/C4 scritti dallo stesso agente.

## Evidenze

- Letto il diff e il contesto completo di `tools/physics-reviewed-content.mjs`, `tools/build-physics-reviewed.mjs` e `tools/audit-physics-bank.py`.
- `integration-probe.mjs` ha eseguito 22 controlli, tutti superati, sul prodotto servito da `http://127.0.0.1:4182/fisica/esercizi-guidati.html`: 92 record caricati e validati; 92 link di catalogo; 92 target primari univoci; tutti i 22 collegamenti dalle lezioni secondarie presenti; nessuna seconda copia interattiva nelle lezioni collegate.
- Navigazione reale dalla lezione U7-01 al quesito `u7-absorbed-radiant-power-13` in U7-04: il collegamento apre il quesito. La figura di consegna è subito visibile. Quella di soluzione resta nascosta prima e dopo una risposta corretta; viene mostrata aprendo esplicitamente lo svolgimento. I due marker SVG hanno ID distinti. Feedback della risposta 0,5 corretto.
- Browser Chromium, viewport 360 px: nessun overflow orizzontale nel catalogo o nel quesito a due figure, nessun errore JavaScript non gestito. Ispezionato lo screenshot `integration-two-stage-360.png`: testi e due diagrammi leggibili, formule brevi, controlli accessibili senza scorrimento orizzontale.
- In fixture isolata sotto questa cartella, il caricatore rifiuta una `solutionFigure` senza figura di consegna e una provenienza che omette una lezione secondaria. La fixture integra la copia completa dei record: il controllo positivo carica tutti i 92 prima delle mutazioni.
- Audit completo ricalcolato in sola lettura sul sorgente immutabile: 4000 record e 27 shard verificati contro checksum e blob del tree. Dopo normalizzazione della serializzazione JSON, il report è identico al report integrato. Tutte le 92 origini coincidono con la ricostruzione dagli originali, compresi hash, chiavi, livelli e collocazioni.
- Le 13 coppie segnalate come testi simili sono state ricalcolate con una seconda implementazione: tokenizzazione, trigrammi, rimozione del blocco di convenzioni, confronto all’interno del modello fisico e soglia Jaccard 0,82. Coppie e punteggi coincidono. Il metodo segnala candidati editoriali; non dimostra equivalenza fisica e non cerca parafrasi tra modelli diversi.

## Copertura e limiti

Il manifest riporta correttamente DRAFT e `humanApproval:false`. I 92 record sono un sottoinsieme revisionato dei 4000 originali, non un’attestazione scientifica globale. Gli ID già assegnati attivamente sono 90 su 259; i due aggiunti fuori dalle assegnazioni precedenti sono `u2-uniform-position-07` e `u5-isobaric-work-06`. La verifica di navigazione percorre tutti i collegamenti tramite analisi DOM e un percorso interattivo rappresentativo, non invia una risposta per ciascuno dei 92 quesiti. La review non copre approvazione docente, prestazioni su dispositivi reali, PDF/offline o semantica completa dei testi simili.

I test e le fixture scrivono soltanto in `work/question-review/terzo-c34`. Nessun file root o stato Git è stato modificato dal revisore. Le prove riproducibili sono `integration-probe.mjs`, `integration-probe.json` e `integration-audit-checks.json`.

## Identità dei file verificati

- `tools/physics-reviewed-content.mjs`: `812e701ebb53765e71cce23486b354a7d951bbc5abb3ca20907bd9eeefb1e4bc`
- `tools/build-physics-reviewed.mjs`: `904c6cc4157855cfe56a84f8f219ba2e7746c4cbdb621a0969aaa133c0d5c0bd`
- `tools/audit-physics-bank.py`: `0d6710e4dbc4dc9a956f84b230b176deeb044b052aa421217c140b1f2cb221ba`
