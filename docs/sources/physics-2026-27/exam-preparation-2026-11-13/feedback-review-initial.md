# Review indipendente finale dei feedback per i 31 quesiti

**Un P2 da correggere; nessun P1 individuato.** Letti integralmente i 105 feedback e le 105 indicazioni di ripasso dei 21 MC, i 10 svolgimenti, i 10 controlli dimensionali e le 20 ipotesi educative. Questa review è congelata sulla proposta SHA-256 `c01dcc770ac4b895147256ecf6e4b665c2d84c1c0f6a3424be72ce2990de6d5c`; nessuna modifica alla proposta o ai sorgenti.

## P2 — u3-apparent-weight-01, seconda ipotesi educativa

La frase «40 N richiederebbe una tensione che si aggiunge al peso verso il basso» attribuisce il verso errato alla tensione. Il risultato errato T=mg+F_A=40 N nasce invece dal mettere erroneamente la **spinta** verso il basso. Con i versi reali, T=40 N darebbe 40+10−30=20 N verso l’alto, incompatibile con l’equilibrio. La chiave 20 N e lo svolgimento principale sono corretti.

Correzione minima proposta: «40 N si ottiene trattando erroneamente la spinta come una forza aggiuntiva verso il basso. In realtà tensione e spinta sono verso l’alto: T=mg−F_A=20 N.»

Percorso JSON: `/questions/24/plausibleErrorHypotheses/1/explanationAndReview`. Il root ha riconosciuto il difetto; la correzione non viene dichiarata applicata da questa review.

## Verifiche svolte

- 31 ID unici; 21 MC con cinque alternative e una sola chiave corretta ciascuno; 10 completamenti. ID, prompt, titoli, alternative, chiavi, ipotesi e provenienza corrispondono alla selezione congelata. Prompt, risposte, opzioni e provenienza coincidono anche con bank-selection.json; ricontrollati gli hash canonici dei 31 record e quelli di prompt e soluzione.
- 105 feedback distinti, ciascuno pertinente all’alternativa. DRAFT e humanApproval=false conservati; learnerDiagnosis=null per tutti i quesiti. Le 20 ipotesi sono marcate educational_hypothesis_not_student_diagnosis e non attribuiscono a uno studente una causa certa.
- **48 ricalcoli leggeri effettivamente eseguiti, tutti coerenti:** 38 espressioni della selezione ricalcolate via AST ristretto e Fraction, più 10 controlli indipendenti su equilibrio del dinamometro, conversioni Coulomb/corrente, calorimetro, radioattività, entropia, Lorentz e lente. Il JSON conserva espressioni, risultati esatti e origine di ogni verifica.
- I dieci valori di completamento sono 8, 40 J, 12 kPa, 20 N, 1/4 di giro, 40 °C, 60 J, 3 A, 10 N e 7 Bq secondo l’approssimazione ln2≈0,7 prescritta. Controllati segni, unità e ipotesi; il singolo P2 riguarda una spiegazione del distrattore, non il risultato numerico.

## Correzioni pregresse controllate

Il confronto strutturale con la proposta .initial conferma esattamente quattro differenze registrate: timestamp, notazione della moltiplicazione nell’opzione A del prodotto scalare e ripristino di feedback/ripasso dell’opzione D. Tutti i dieci completamenti sono identici fra quelle due versioni. I cinque hash della ricevuta di correzione corrispondono ai file conservati.

Scansionati 302 campi autoriali: zero residui `||`, formule del prodotto scalare complete e tutti i testi presenti anche nel Markdown. Letti i controlli del generatore locale che impongono un unico separatore e rifiutano residui; il generatore non è stato eseguito.

Lorentz: i nuovi feedback identificano correttamente D (modulo della velocità/energia cinetica), E (vettore velocità) e C (quantità di moto vettoriale). Il rinvio improprio alla «seconda opzione» non compare nei feedback nuovi. **La soluzione legacy integrale resta immutata e contiene ancora quel rinvio:** non viene affermata una correzione del sorgente condiviso.

## Limiti e chiusura del perimetro

Nessuna approvazione scientifica umana, prova con studenti o calibrazione; nessuna attestazione di copertura esaustiva, quesiti inediti o conformità all’algoritmo ministeriale. La selezione conserva formulazioni legacy talvolta poco naturali e le ipotesi ordinarie dichiarate in sourceCaveat. Il nuovo materiale è una proposta DRAFT di spiegazioni per allenamento, non UI/persistenza/prova d’esame implementata.

Esito per la consegna: correggere la sola frase segnalata e verificarne il delta sull’hash finale. Nessuna altra implementazione o riapertura architetturale è richiesta da questo report. Cortex resta sospeso. Hash delle fonti, dettagli delle 48 verifiche e finding sono nel JSON affiancato.
