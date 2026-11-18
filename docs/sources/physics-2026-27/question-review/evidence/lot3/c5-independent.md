# C5 terzo lotto — review indipendente, 18 novembre 2026

Esito: nessun difetto bloccante scientifico, di chiave o di rendering individuato negli otto quesiti esaminati. Revisore automatico distinto dall’autore; questa review non riguarda le proprie riscritture C1/C2 e non costituisce certificazione umana.

Confrontati tutti gli ID con gli originali immutabili in `work/question-review/source`. Dati, vincoli numerici e risposte valide sono conservati. Le modifiche ai distrattori sono dichiarate e dimensionalmente coerenti. Per la frequenza del pacchetto di fotoni è corretta la sostituzione della notazione originaria ambigua f14 con una frequenza fisica, senza modificare il rapporto richiesto.

## Calcoli e modelli

- Fotoni: energie 33 e 132 in unità di 10^-20 J, rapporto 4 con conteggio e frequenza entrambi doppi.
- Eco: distanze 30 e 20 m, percorsi 60 e 40 m, tempi 6 e 2 s, rapporto 1/3. Le velocità ideali sono conservate senza attribuirle ai tessuti biologici.
- Assorbimento inverso: E è la formula generale corretta; la controprova 8 = 6 + 2 W funziona. La C coincide con E soltanto al valore particolare tau = 1/2, ma non è identicamente corretta per il parametro assegnato in forma generale; non rende ambigua la domanda sulla formula.
- Variazione dell’assorbimento: quote trasmesse 1/2 e 1/4, rapporto 1/2; entrambe le potenze assorbite rimangono inferiori agli ingressi.
- Interferenza: somma di segnali cosinusoidali con medesima fase, ampiezze positive e mezzo lineare. Le chiavi C e 3/2 sono corrette; non si sommano impropriamente le intensità.
- Rifrazione: frequenza conservata per interfaccia ferma nel modello lineare ordinario; velocità di fase e lunghezza d’onda cambiano. Incidenza obliqua e indici diversi rimuovono l’ambiguità dell’angolo invariato all’incidenza normale. La soluzione esplicita l’ipotesi di linearità.
- Periodo/frequenza: cinque cicli occupano due secondi, quindi 5/2 Hz. Nel grafico i tre attraversamenti della stessa fase sono equidistanti e coerenti con 0 / 0,4 / 0,8 s.

## Due stadi del diagramma di assorbimento

Il prompt mostra gli ingressi 8 e 12 W e lascia le uscite come domande. Non anticipa 9 e 3 W. Lo svolgimento introduce barre in scala: origine x = 74 per entrambe; lunghezze 160 e 240 per 8 e 12 W, scala uniforme 20 unità SVG/W. Le partizioni hanno lunghezze 80 + 80 e 180 + 60, corrispondenti esattamente a 4 + 4 W e 9 + 3 W. Didascalie e testi alternativi distinguono chiaramente schema iniziale non in scala e confronto finale in scala.

Ispezionati visivamente entrambi gli stadi, il diagramma dell’eco e il grafico periodico. Etichette leggibili e direzioni coerenti. Il rettangolo «Strato A/B» è compatto, ma il testo rimane al suo interno nel renderer verificato.

## Evidenze riproducibili e limiti

`c5-independent.py` produce `c5-independent-checks.json` con hash esatto del lotto revisionato e controlli di chiavi, calcoli e geometria. `c5-render.cjs` produce la preview con CSS corrente del prodotto e valida lo schema effettivo: 8 record, 105 formule KaTeX valide, viewport 360×800 senza overflow globale né formule che richiedano scroll locale, nessuna etichetta fuori viewBox o sovrapposta.

La preview locale non sostituisce il controllo dopo integrazione nelle lezioni. Non sono state effettuate prove su hardware mobile o screen reader reali. Le evidenze sono salvate soltanto nella cartella assegnata; nessuna modifica Git o al repository da parte del revisore.
