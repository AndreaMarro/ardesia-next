# Revisione indipendente dell’integrazione — 18 novembre 2026

Perimetro: sorgenti `tools/build-physics-reviewed.mjs`, `tools/physics-reviewed-content.mjs`, `tools/physics-runtime/practice.js`, CSS pubblicato, test `e2e/physics-reviewed.spec.ts`; prodotto statico a `http://127.0.0.1:4181/fisica`. Read-only sul repository. Nessuna nuova revisione indipendente dei contenuti C1/C2 scritti dallo stesso revisore.

## Risultati verificati

- Catalogo effettivo: 52 quesiti. Visitati tutti i lesson file coinvolti, aperti quesiti e svolgimenti e provate tutte le 52 form con una risposta corretta e una errata: 104 verifiche, nessun errore di valutazione e nessun pageerror JavaScript.
- Il parser numerico accetta decimali con virgola/punto, frazioni e notazione scientifica. Dal codice risultano respinti valori non finiti, denominatori nulli e underflow dei singoli operandi. La tolleranza è relativa all’atteso, senza una tolleranza assoluta che renderebbe indistinguibili quantità molto piccole.
- Chiavi choice e unità/risposte razionali preservate e controllate dal caricatore. Gli ID opzioni, il collegamento alla lezione e l’unità syllabus sono verificati prima del rendering. MathML viene generato in build con KaTeX strict/error e trust false; testi e attributi sono escaped.
- No JavaScript: su pagina C4, apertura del quesito e della soluzione tramite Enter funziona con i dettagli nativi; lo svolgimento è visibile, le formule sono già nel documento, il pulsante di controllo rimane disabilitato e compare l’istruzione alternativa. Prova su Chromium con JavaScript disabilitato, non hardware Apple.
- Le opzioni sono radio native con fieldset/legend e nomi accessibili; i dettagli sono utilizzabili da tastiera. Il feedback precedente viene cancellato al cambio risposta. Il codice di pratica non registra dati dello studente.
- ZIP offline: confronto byte per byte di practice.js, practice.css, esercizi-guidati.html e sf-2026-u6-02.html col pubblico corrente, tutti coincidenti. Non si dichiara una verifica completa su tutti i dispositivi offline.

## Difetti concreti segnalati al coordinatore

### P2 — Formule lunghe fanno scorrere l’intera pagina su smartphone

Con viewport 390×844 e svolgimento aperto, il CSS `overflow-wrap:anywhere` sui paragrafi non contiene i blocchi MathML. Sono emersi nove quesiti su otto pagine:

- u3-two-liquid-floating-01: catena della frazione, bordo destro circa 421 px.
- u3-poiseuille-flow-08: rapporto delle pressioni, circa 416 px.
- u3-venturi-area-ratio-01: ultimo `=6 kPa`, circa 429 px.
- u5-isothermal-work-16: catena del lavoro, circa 463 px.
- u5-calorimeter-capacity-09: bilancio termico, circa 397 px.
- u6-connected-plate-separation-charge-13: rapporto delle cariche, circa 465 px.
- u6-work-potential-difference-08: differenza dei potenziali, circa 405 px.
- u6-parallel-capacitors-06: unità μJ nel calcolo, circa 405 px.
- u6-plane-capacitance-08: unità V/m, circa 395 px.

Il coordinatore è stato avvisato e sta correggendo. Occorre contenere le formule con scorrimento locale accessibile oppure spezzare le catene di uguaglianze, mantenendo tutte le unità visibili. Il solo bounding box del nodo `math` non intercetta sempre il problema: in alcuni casi i discendenti MathML eccedono il box. Il criterio riproducibile aggiuntivo è `document.documentElement.scrollWidth > innerWidth + 1` con tutte le soluzioni aperte. La revisione non considera questo punto chiuso finché non viene ripetuto il probe sul nuovo CSS.

### P2 — Etichette SVG: problema individuato e già corretto

Nel renderer reale a 17 px si sovrapponevano le due etichette di unità nella griglia; tre etichette uscivano dal bordo superiore (s(m), p(kPa), v). Segnalato subito al coordinatore. Il successivo passaggio HTTP su tutti i 52 record non trova più né sovrapposizioni testo/testo né etichette fuori dal viewBox. Le anteprime degli autori con font minore non erano sufficienti a verificarlo nel prodotto.

## Riproduzione e limiti

`integration-probe.cjs` è un probe locale read-only: richiede Playwright già installato nel repository e Chrome locale; accetta come primo argomento una base URL. Verifica tutti i form, gli overflow globali a 390 px, le etichette SVG e un percorso no-JS da tastiera. Non scrive nel repository.

Non è una revisione scientifica umana; non sono stati usati screen reader reali. I due e2e dedicati coprono un percorso scelta/suggerimento/soluzione/laboratorio e le equivalenze numeriche; no-JS, tutti i quesiti e i limiti dei disegni sono stati controllati dal probe separato. Nessun blocco rilevato per compilazione, risposte o accesso alle soluzioni; il difetto residuo segnalato riguarda la leggibilità mobile delle formule lunghe.

## Aggiornamento dopo correzione

Secondo probe HTTP sul nuovo wrapper matematico: a 390×844, 52 form / 104 verifiche, zero pageerror, zero etichette SVG fuori dai limiti o sovrapposte e zero overflow globale, con tutte le soluzioni aperte. No-JS ancora positivo. Il coordinatore segnala separatamente 7 espressioni da rifinire a 360 px e sta dividendo le catene: il risultato pulito a 390 px non copre quella larghezza minore. La verifica finale a 360 px rimane quindi al coordinatore prima della pubblicazione.
