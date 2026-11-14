# Review scientifica indipendente C4 e laboratorio condensatore

Data: 13 novembre 2026. Reviewer: contesto `/root/curriculum`, non autore delle sette aggiunte C4 né del laboratorio. Sorgenti lette integralmente: `/tmp/ardesia-depth-c4/supplements.json`, definizione `physics-capacitor-constraints`, attività/feedback C4 corrispondenti, pacchetto distribuito e `capacitor.test.ts`. Nessuna sorgente condivisa modificata dal reviewer.

**Esito: nessun P1/P2 individuato nel perimetro esaminato.** I testi restano DRAFT; non è approvazione scientifica umana, calibrazione didattica o prova su componenti fisici.

## Identità finale

- Supplementi C4 SHA-256: `a16d08cba67b76d05c60748f48a76f013e5617907f05407f415ee1b66ca377a6`.
- File editoriale laboratori SHA-256: `c414df4bc4f229bd5fa0b4bf823cc19cb017de4a478dd72d82dd39a31c6a8f30`.
- Record laboratorio serializzato con JSON ordinato/compatto UTF-8 SHA-256: `47e6916dc0e90bd8f3406dcc4938d92ee166b9d182cf5bc7f4b517153118a7dc` (digest del reviewer, distinto dal digest del contratto Ardesia).
- La definizione nell'asset distribuito coincide esattamente con la definizione editoriale finale, inclusa la correzione del testo introduttivo.

## Revisione di contenuto

**U6-01, carica/campo:** corretta distinzione fra campo delle sorgenti e forza sulla particella. Nel punto fra sorgente positiva a sinistra e negativa a destra i due campi sono concordi:3600+225=3825 N/C. La particella negativa accelera inizialmente nel verso opposto:−2,55 m/s². Il testo limita esplicitamente l'accelerazione al punto iniziale e non prolunga un campo non uniforme come uniforme.

**U6-02, potenziale:** corretti ΔV=+45V, ΔU=−180nJ e K finale240nJ; rapporto velocità2. Bilancio totale−60nJ coerente con lo zero convenzionale. Distinto il lavoro esterno−180nJ nel trasferimento quasistatico. Accessibilità della traiettoria esplicitamente assunta, non dedotta dai soli estremi.

**U6-03, conduttori/dielettrici:** corretti ordine di messa a terra/distacco, segno positivo della sfera e perdita netta di4·10¹⁰ elettroni. La carica finale è data dalla misura assegnata, non ricavata dalla sola geometria qualitativa. Campo nullo limitato al materiale conduttore in equilibrio elettrostatico. Polarizzazione di lastra uniforme coerente con cariche legate negativa a sinistra/positiva a destra per polarizzazione verso destra.

**U6-04, circuiti:** corretti nodi, serie/parallelo e tensioni. R equivalente30Ω, corrente totale0,50A; tensione parallelo10V; correnti1/3 e1/6A; dissipazione7,50W e337,5J in45s. Controlli di nodo, cadute ed energia tramite VQ indipendenti e coerenti. Resistività distinta da resistenza geometrica e dalle variazioni termiche.

**U6-05, condensatori:** corretta definizione della carica su una sola armatura, distinzione fra Q fissata e V fissata. Con6nF/80V/κ4, isolato:480nC/20V/4,8µJ; collegato:1920nC/80V/76,8µJ. Lavoro generatore115,2µJ, incremento energia57,6µJ e restante lavoro meccanico reversibile57,6µJ coerenti. La possibilità di dissipazione è separata dal limite quasistatico senza perdite. Esempio in serie esplicita nodo intermedio inizialmente neutro: carica comune360nC e tensioni60/30V.

**U6-06, magnetismo:** x×z=−y e segno elettronico invertono correttamente la forza verso+y. F=1,28·10⁻¹⁴N, r=1,1375mm, K=7,28·10⁻¹⁸J; dimezzare B raddoppia il raggio a velocità iniziale fissata. Ipotesi non relativistiche e perdite radiative trascurate esplicite. Forza sul filo usa corrente convenzionale senza doppia inversione del segno.

**U6-07, induzione:** angolo60° riferito alla normale; area convertita in2,5·10⁻³m². ΔΦ negativo e fem positiva1V; corrente antioraria vista lungo la normale scelta, per sostenere il flusso uscente che diminuisce. I=0,125A, dissipazione0,005J. La forma temporale lineare del campo giustifica la fem costante e quindi l'uso di potenza costante; autoinduzione esclusa esplicitamente. Nessuna energia gratuita attribuita alla bobina.

## Laboratorio e test

Le espressioni distribuite lavorano con C₀ inµF, V inV: Q risulta inµC e U/lavoro inµJ. Vincoli κ≥1, C₀>0 e V₀>0 eliminano singolarità e rendono ben definiti i rapporti di energia. Collegato: Q=κC₀V₀,U=κC₀V₀²/2; isolato: Q=C₀V₀,V=V₀/κ,U=C₀V₀²/(2κ). Lavoro generatore C₀V₀²(κ−1), pari a due volte l'aumento dell'energia elettrostatica nel modello. Graficiκ e1/κ rappresentano rapporti adimensionali di energia; l'unità orizzontale è correttamente κ.

Eseguito indipendentemente `vitest run apps/web/src/courses/physics/capacitor.test.ts` dopo verifica dell'identità editoriale/distribuita finale: **3/3 PASS**, Node24.22.1. I test esercitano il vero compilatore di espressioni e l'asset servito, definizione/digest, estremi ammessi, valori SI, vincoli e rapporti. Questo esito non sostituisce un controllo browser completo del corso.

Ricalcolati inoltre tutti i **54 controlli numerici C4**, esclusivamente tramite interprete AST aritmetico limitato a costanti e operatori; **54 PASS**. La verifica scientifica sopra è aggiuntiva: non deriva soltanto dal far coincidere numeri già scritti nel file. Ricevuta dettagliata: `/tmp/ardesia-depth-review-c4.json`.

## Osservazione P3 corretta

Il testo introduttivo «Confronta gli stessi stati iniziale e finale» era ambiguo perché gli stati finali non coincidono. Il root ha sostituito con «Confronta due esperimenti con lo stesso stato iniziale: gli stati finali differiscono per il vincolo. Non sono due fasi successive dello stesso circuito». Correzione letta sia nella fonte sia nell'asset finale; osservazione chiusa.
