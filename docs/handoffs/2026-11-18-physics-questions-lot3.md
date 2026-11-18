# Fisica C1–C5, terzo lotto

18 novembre 2026, ore 18:00 CET (Europe/Rome). Prosecuzione diretta del mandato sulla banca storica. Il lavoro parte dalla revisione della PR #60, commit 9eb0d1843d0aab938420c7b6dc120cde17460b97. Il lavoro è raccolto in `codex/physics-question-review-lot3`. Il commit, la CI e la preview del terzo lotto si trovano nella [PR del branch](https://github.com/AndreaMarro/ardesia-next/pulls?q=is%3Apr+head%3Acodex%2Fphysics-question-review-lot3). Per i primi 52 quesiti restano disponibili la [PR #60](https://github.com/AndreaMarro/ardesia-next/pull/60), la [CI](https://github.com/AndreaMarro/ardesia-next/actions/runs/44338707972) e la [preview protetta](https://ardesia-next-8fa1pa6k1-andreas-projects-6d4e9791.vercel.app/fisica/esercizi-guidati.html).

## Revisione scientifica e didattica

Il terzo lotto aggiunge 40 quesiti attivi, otto per microcorso. Trentatré provengono dalla coda delle tracce segnalate. I livelli sono 10 base, 3 facile, 13 medio e 14 difficile. La selezione alterna problemi concettuali, formula inversa, confronto fra condizioni e calcolo numerico. Mantiene i livelli storici senza presentarli come difficoltà calibrate su studenti. Gli ID e i contenuti sono nei file [C1](../sources/physics-2026-27/question-review/lots/terzo-c1.json), [C2](../sources/physics-2026-27/question-review/lots/terzo-c2.json), [C3](../sources/physics-2026-27/question-review/lots/terzo-c3.json), [C4](../sources/physics-2026-27/question-review/lots/terzo-c4.json) e [C5](../sources/physics-2026-27/question-review/lots/terzo-c5.json). L’indice delle origini li collega allo snapshot immutabile. Ogni record contiene motivo, ricalcolo o controprova e soluzione. [Nuovi lotti e origini](../sources/physics-2026-27/question-review/README.md)

| Quesito | Problema osservato | Revisione |
| --- | --- | --- |
| u1-vector-angle-ratio-09 | Il testo introduceva la pendenza come incognita e chiedeva la componente orizzontale. | Un triangolo mostra dove si leggono i cateti della tangente. L'incognita è indicata subito e l'inversione è controllata con un rapporto 3/4. |
| u2-impulse-13 | Il risultato era chiesto come variazione di una generica grandezza di uscita. | Due rettangoli forza-tempo rendono visibile il fattore quattro nell'impulso. La domanda chiede il rapporto delle durate. |
| u3-droplet-fragmentation-01 | Distrattori poco diagnostici e salto fra conservazione del volume ed energia. | Raggio dimezzato, otto superfici e differenza di area. Il feedback distingue energia finale, iniziale e incremento. |
| u5-refrigerator-cop-01 | Un valore maggiore di uno poteva sembrare incompatibile con il primo principio. | Il diagramma distingue il lavoro fornito dai flussi termici. L'energia presa al vano freddo e il lavoro si ritrovano nel calore ceduto alla stanza. |
| u6-connected-plate-separation-charge-09 | Il testo delle alternative e quello della risposta concatenavano la definizione s=d/d₀ alla carica, creando un’uguaglianza incoerente. | Distanza, fattore e carica sono distinti. La chiave A resta l’equivalente della relazione esatta originale, Q₀=Qs, ricontrollata con Q=CV. |
| u7-absorbed-radiant-power-13 | La traccia chiedeva di moltiplicare una «grandezza di uscita» senza nominarla. | La consegna dichiara la potenza assorbita. Dopo il tentativo, la figura in scala mostra dove finiscono i 12 W di B: 9 assorbiti e 3 trasmessi. |
| u7-wavelength-in-medium-03 | Un’opzione sull’angolo ammetteva il caso di incidenza normale. | La consegna precisa incidenza obliqua e indici diversi. Il raccordo temporale alla superficie spiega l’invarianza della frequenza. |

Le nuove figure seguono il passaggio che chiariscono. Il grafico forza-tempo rende osservabile l'impulso come area, quello del periodo mostra lo stesso punto del ciclo a 0, 0,4 e 0,8 s. Nella radiazione si passa dallo schema dei dati iniziali alle barre in scala nello svolgimento. SVG e TikZ derivano dagli stessi record. Tutte le chiavi e i valori numerici validi sono stati conservati. Le opzioni dimensionalmente incoerenti, ambigue o con errori di testo sono state corrette nei casi descritti nelle ricevute.

## Copertura, prove e riproduzione

| Misura | Terzo lotto | Totale |
| --- | ---: | ---: |
| Record della banca sottoposti a controlli automatici strutturali | intero snapshot riletto | 4.000 |
| Quesiti con revisione scientifica AI e riscrittura didattica | 40 | 92 |
| Quesiti con almeno una figura | 13 | 40 |
| Figure | 14 | 41 |
| Quesiti verificati nell’interfaccia | 40 nuovi | 92 |
| Lezioni di lettura raggiungibili con i quesiti guidati | — | 37, di cui 33 ospitano lo svolgimento interattivo |
| Associazioni ulteriori alle lezioni | 22 | 22 |
| Quesiti nel PDF di questo lotto | 10 | Due per microcorso |

L'indice conserva una sola versione interattiva per ID e collega ogni collocazione secondaria al suo svolgimento. Il catalogo offre accesso diretto ai cinque corsi. Il totale degli ID legacy raggiungibili resta 261, di cui 259 già assegnati nelle edizioni Next riservate e due recuperati nei primi lotti. Le consegne Core restano associate alle revisioni originarie.

Dei 92 quesiti revisionati, 90 erano già assegnati e due sono stati aggiunti nei lotti precedenti. La copertura delle assegnazioni attive è 90 su 259.

Lo snapshot verificato contiene 4.000 record, senza ID duplicati o errori di schema. Le due frasi standard ricorrono assieme in 3.864 soluzioni e il primo suggerimento coincide in tutti i record. L'audit conserva le differenze testuali fra chiave e alternativa e distingue i casi legittimi. Il controllo sulle tracce simili ha segnalato 13 coppie con sovrapposizione di trigrammi almeno 0,82 nello stesso modello fisico, escludendo il blocco di convenzioni. Per esempio, le varianti sul calorimetro condividono l'impostazione ma chiedono quantità diverse. Il rapporto orienta una lettura per famiglie e non attribuisce ridondanza scientifica. Mancano gli ID del campione storico da 688 per riprodurne esattamente il conteggio. [Audit JSON](../sources/physics-2026-27/question-review/bank-audit.json)

Le ricevute documentano 62 verifiche C1/C2, 56 ricalcoli C3/C4 e 27 controlli indipendenti C5. L’integrazione ha una review separata che ha riprodotto provenienza, audit, 22 collegamenti e il percorso con due figure. [Ricevute e prove](../sources/physics-2026-27/question-review/evidence/lot3).

Il controllo browser ha provato tutti i 92 quesiti su desktop, smartphone da 360 px, viewport iPad verticale e orizzontale. Ha verificato risposta corretta ed errata, suggerimento, svolgimento, presenza delle figure, limiti del disegno e spazio per le formule. I risultati per ID e gli screenshot provengono dalle pagine vere. Gli iPad sono emulati. La CI del prodotto contiene anche una prova che parte da una lezione secondaria e apre il quesito con la seconda figura inizialmente chiusa. Il PDF A4 è stato compilato e controllato su tutte le dieci pagine, con il footer richiesto e senza titolo generale o autore. [Prove](../sources/physics-2026-27/question-review/evidence/lot3) · [PDF](../sources/physics-2026-27/question-review/sample/Quesiti-campione-lotto-3.pdf) · [TeX](../sources/physics-2026-27/question-review/sample/Quesiti-campione-lotto-3.tex)

## Qualità raggiunta e lavoro rimanente

Il riferimento di stile resta il mandato esplicito. Il corpus di dispense individuato nel passaggio precedente ha metadati d'autore diversi da Andrea e non permette di attribuirgli quello stile. Per questo lotto sono state valutate la leggibilità del ragionamento, le condizioni che giustificano la legge, la proporzione fra testo e difficoltà e la funzione del disegno. Lo studente può vedere, per esempio, perché l'impulso dipende dall'area sotto la curva e perché la frazione trasmessa non coincide con la potenza trasmessa.

Restano 3.908 quesiti legacy da rivedere individualmente, di cui 169 già attivi. La coda allegata conserva l’ordine e le segnalazioni della precedente, con gli ID nuovi rimossi e l’insieme rimanente ricontrollato contro le assegnazioni. [Coda dei 169 quesiti attivi](../sources/physics-2026-27/question-review/evidence/lot3/Coda-quesiti-attivi.csv). Continuano a servire approvazione scientifica umana, verifica fisica su iPad e prova autenticata della preview. Tutto il materiale è DRAFT.
