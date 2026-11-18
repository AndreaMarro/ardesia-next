# Revisione C1/C2 — primo lotto

Consegna del 18 novembre 2026. `questions.json` contiene 16 riscritture individuali: 8 C1 e 8 C2, con due quesiti per ogni livello legacy base/facile/medio/difficile in ciascun corso. Queste etichette sono editoriali: non si dichiara una calibrazione su studenti.

`c1.json` e `c2.json` sono le due metà dello stesso lotto. `originals.json` conserva record legacy integrali e record Next pre-intervento, classificazioni, hash e percorso sorgente. Per 15 quesiti già selezionati in Next l’hash originale coincide con la provenienza Next. `u2-uniform-position-07` proviene dalla banca integrale ed è il solo quesito aggiuntivo: serve al secondo facile C1.

## Controlli eseguiti

- `python3 verify.py`: 130 controlli passati, inclusi struttura, hash, chiavi, unità, domini, aritmetica esatta e controprove fisiche. Il dettaglio riproducibile è in `verification.json`.
- `node render-check.cjs`: 404 formule KaTeX, zero errori (strict/error, trust false); 9 figure SVG, zero etichette fuori dal viewBox nel renderer locale a font 11. Risultati in `katex-verification.json` e `figure-bounds.json`.
- Ispezione visiva dell’anteprima desktop: grafico cinematico con intercetta e scale corrette, direzioni delle forze/accelerazioni coerenti, figure chiaramente dichiarate non in scala dove necessario. Migliorata la separazione dei due vecchi quadrati per evitare di confondere vecchie e nuove celle.
- Preview locali in `figures.html`, `figures-preview.png`, `figures-mobile-preview.png`; SVG singoli modificabili generati dagli stessi dati JSON. Non sono screenshot dell’app.

Il processo è una revisione automatica scientifica/editoriale, non una certificazione o approvazione umana. Le prove su formule simboliche includono ragionamenti algebrici espliciti; i campioni razionali non sono presentati come una prova universale. Non è stato eseguito un confronto con dispense originali autentiche di Andrea: non disponibili nel perimetro consultato. Si applicano i requisiti testuali del mandato. L’integrazione, la valutazione delle risposte nell’app, i viewport e il PDF spettano alla fase coordinata dal parent.

## Esempi prima/dopo

1. `u1-area-conversion-01`: «Quanto vale valore numerico ... in 1?» → area fisica invariata, unità quadrate e conteggio di otto celle; risposta 8 conservata.
2. `u1-scientific-scale-08`: la consegna suggeriva già il confronto dei quadrati → il confronto è spostato al secondo aiuto; convenzione logaritmica Next conservata.
3. `u2-atwood-09`: distrattori con somme di quantità dimensionalmente incompatibili → cinque espressioni dimensionali, dominio 0<a<g, spiegazione della tensione eliminata e controllo delle singole tensioni. Chiave D conservata.
4. `u2-biceps-lever-09`: formule numeriche con ±1 arbitrari → equilibrio dei momenti e braccio perpendicolare, tutti i distrattori hanno dimensione di forza. Chiave B conservata.
5. `u3-bernoulli-height-speed-09`: testo dichiarava di cercare la pressione ma chiedeva la quota → incognita h e differenza di pressione definite senza contraddizione; formula dimensionale SI e condizione per h>0. Chiave E equivalente all’originale.
6. `u3-soap-film-force-09`: si dichiarava di cercare la forza ma si chiedeva gamma → gamma esplicitamente cercata, valori numerici separati dalle unità fisiche e fattore due controllato tramite lavoro/area. Chiave A conservata.
7. `u3-apparent-weight-13`: un corpo cambiava implicitamente massa e volume e si parlava di «grandezza d’uscita» → due campioni, lettura del dinamometro e diagramma delle forze; verifica che B resti più denso dell’acqua e il filo sia in tensione. Risposta 3 conservata.

## Copertura e limiti

16 revisioni scientifiche individuali; 16 riscritture didattiche; 9 figure (4 C1, 5 C2), delle quali 5 nel prompt e 4 nella soluzione. Nessuna chiave corretta è stata cambiata; sono stati riformulati distrattori quando inutili o dimensionalmente problematici. Nessuna estensione automatica di queste riscritture al resto della banca. Primo aiuto controllato editorialmente perché orienti senza fornire il risultato; gli aiuti successivi offrono progressivamente relazione e impostazione. Per tutti i 16 lo svolgimento è un array di paragrafi leggibili in continuità.

La riproduzione richiede Python standard e Node con KaTeX/Playwright già disponibili nel repository locale. Lo script di anteprima usa Chrome installato. Tutti i file del subtask sono confinati a questa cartella; nessuna modifica Git/repository eseguita dal revisore C1/C2.

## Prosecuzione: secondo lotto

`batch2.json`: cinque ulteriori quesiti attivi, 2 C1 e 3 C2, tutti livello editoriale base. Due nuove figure. Originali completi in `batch2-originals.json`; esiti riproducibili in `batch2-checks.json` e script `verify-batch2.py`: 25 controlli passati, 79 formule KaTeX senza errori, 2 SVG entro i limiti. Anteprima desktop locale ispezionata. Totale consegnato dal revisore: 21 riscritture, 11 figure; 483 formule controllate. Risolte ipotesi sottintese su molla di massa trascurabile, equilibrio libero fra due liquidi e dissipazione viscosa. Nessuna chiave modificata.
