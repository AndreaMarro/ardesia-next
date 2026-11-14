# Revisione indipendente della demo C5 di interferenza

**Nessun P1/P2 concreto individuato nel codice e nell’HTML esaminati.** La verifica comprende lettura del generatore, CSS, modello canonico e rigenerazione in memoria; **non comprende una sessione browser**, test con lettori di schermo o un’attestazione completa di accessibilità.

## Revisione fissata

| File | SHA-256 |
| --- | --- |
| tools/build-physics-interference-demo.mjs | c566dac0532cac2308de06f5f1ef22ca846d87130fb204ced261f27677d8ebd9 |
| packages/plugin-host/package.json | 30ce6b3772d770a87f207ad2d4fd11d81bc6f256ad01014aa5931ba496ab07a0 |
| tools/build-physics-demo.mjs | ee7ab49efdb5867ef14d0438ede3881df5e8cbd2d1c1fdc70ffe90ec8540156d |
| apps/web/public/fisica/demo.css | 20da47760472a6d7721c1fed671d429a6c11a770ad0104add6a0fd131de9ef08 |
| apps/web/public/fisica/c5.html | e1f2da6960ca95bdffcdfb3ccf92ab4191a0048f68efaefdb2b901e0238a4982 |

La revisione scientifica del modello canonico è in `/tmp/ardesia-c5-wave/interference-review.md`. Questa revisione riguarda l’implementazione del root, non i supplementi U4/U7-01 di cui il revisore è autore.

## Coerenza con il modello

Il generatore analizza il body con `CompositionBodySchema` e usa il parser aritmetico esistente `compileExpression` a build time. Curve, cursore e risultati numerici sono ricavati dalle espressioni della definizione `physics-interference`; non è introdotto un secondo motore browser. Nei quattro stati resta A1=1 cm, f=2 Hz e t=0,125 s, coerentemente con i dati canonici attuali e con le etichette visualizzate.

| Stato | A2 | φ | Ampiezza risultante | Ordinata a 0,125 s |
| --- | ---: | ---: | ---: | ---: |
| In fase | 1 cm | 0° | 2 cm | 2 cm |
| Sfasate | 1 cm | 120° | 1 cm | 0,5 cm |
| Opposte e uguali | 1 cm | 180° | 0 cm | 0 cm |
| Opposte e diverse | 2 cm | 180° | 1 cm | −1 cm |

I quattro pannelli hanno la stessa scala e geometria. La seconda curva tratteggiata e lo spessore maggiore della somma aggiungono distinzioni non basate soltanto sul colore. La cancellazione locale non è presentata come perdita dell’energia globale; il testo distingue correttamente grafico temporale e fotografia spaziale. L’anteprima dichiara di confrontare quattro condizioni e rimanda ai cursori del laboratorio completo effettivamente presente nel pacchetto.

Ho richiamato `interferenceDemo` due volte sugli stessi dati: gli output coincidono. La sezione generata è presente **byte per byte** nel C5 attuale; SHA della sezione `a038146f2644b721c14e0455556cf1080a7788a0f98856a0a7e3b6a8cc2e9b9d`. L’HTML C5 esaminato non contiene tag script. Output della verifica: `/tmp/ardesia-c5-demo-review-checks.json`. Nessun file generato condiviso è stato scritto dal revisore.

## Interazioni e sicurezza dell’output

I quattro controlli sono radio nativi con lo stesso nome, ID distinti, label associate e fieldset con legend; il radio120° è inizialmente selezionato. Le regole CSS `:checked` mostrano il pannello corrispondente. Gli input sono ritagliati visivamente ma restano controlli nativi; il focus visibile viene reso anche sulla label. Le label hanno altezza minima48px e la griglia può scendere a una colonna. SVG fluidi, testo esplicativo e risultati testuali rendono disponibile l’informazione anche al di fuori della sola lettura del grafico. Questi sono riscontri sul codice, non risultati di una prova reale di tastiera, touch o screen reader. In particolare `aria-live` con cambiamenti di visibilità CSS non implica da solo un annuncio verificato su ogni tecnologia assistiva.

Il codice di build usa escaping per titoli e spiegazioni. I colori interpolati negli attributi SVG sono limitati dal contratto al formato esadecimale `#RRGGBB`; dimensioni della scena sono numeriche e le coordinate sono valutate con parser senza eval e controllate per finitezza. ID, condizioni e valori dei radio sono costanti del generatore. Non è stato aggiunto invio di moduli, memorizzazione di prenotazioni o promessa di vendita/validazione; la CTA esistente rimane una richiesta di informazioni tramite link e il manifest conserva DRAFT/humanApproval=false.

Restano al root i test browser sulla build effettiva, compresi JavaScript disattivato, navigazione con frecce/tab, viewport mobile e controlli di overflow. Questa review non sostituisce quei test né rivendica che siano già passati.

Rilettura finale: il root ha fissato esplicitamente A1=1 e time=0,125 nello stato di ciascuno scenario, coerentemente con le etichette, anziché ereditarli dai default. La sezione generata resta identica e coincide con il C5 aggiornato; gli SHA della tabella sono quelli riletti. Nessun nuovo P1/P2.

## Delta finale: entry pubblica composition

Riletto il delta successivo: `packages/plugin-host/package.json` aggiunge soltanto l’export `./composition` verso `./src/composition.ts`, mentre il generatore importa ora `compileExpression` da `@ardesia/plugin-host/composition`. Nessuna modifica alla logica del parser, a `src/index.ts` o agli altri export; `git diff --exit-code` sui due sorgenti esistenti restituisce0. L’export è additivo e segue il modello TypeScript già usato dagli altri entry point del pacchetto privato del monorepo. Evita il caricamento dell’entry principale senza modificarne il comportamento. Non introduce esecuzione arbitraria, nuove capacità del parser o dipendenze browser. Nessun nuovo P1/P2 individuato.

Ho importato effettivamente l’entry pubblica in Node24: caricamento riuscito, prova del parser `sqrt(A1^2+A2^2)` con1,2/0,9 restituisce1,5. La rigenerazione in memoria produce la stessa sezione della review precedente: SHA `a038146f2644b721c14e0455556cf1080a7788a0f98856a0a7e3b6a8cc2e9b9d`. Anche l’HTML C5 completo rimane identico, SHA `e1f2da6960ca95bdffcdfb3ccf92ab4191a0048f68efaefdb2b901e0238a4982`. La sezione coincide ancora con quella presente nella pagina. Risultati: `/tmp/ardesia-c5-demo-public-export-checks.json`; tabella dei sorgenti e report JSON aggiornati alla revisione finale. Nessuna scrittura condivisa effettuata.
