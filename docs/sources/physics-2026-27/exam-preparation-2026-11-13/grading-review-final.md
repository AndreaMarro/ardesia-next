# Review finale del prototipo di correzione per allenamento

**I due P2 sono risolti; nessun nuovo P1/P2 concreto identificato nel perimetro controllato.** Esito limitato al prototipo locale, non integrato. `humanApproval: false`. Codice esaminato SHA256 `dd2b754f2a4afc323fcd37ec1c6f8dd27cfc356cf64a720ff13570fbf873707c`.

## Evidenze riprodotte

- Test autore eseguito con Node, exit 0: 31 chiavi, 105 alternative, massimo 310 decimi; confronto dei valori legacy ammessi.
- Le **585 controprove indipendenti passano tutte**. La versione storica aveva 579 successi e 6 fallimenti: tutti e sei risultano ora risolti. Lo script delle controprove è byte-identico a quello della review storica.
- Restano verificati 250 rapporti equivalenti e 250 controesempi con numeratore diverso, senza arrotondamento floating point.
- Prima di eseguire i test, preservato `/tmp/ardesia-exam-grading-review-counterchecks.initial.json`, SHA256 `eafeea79f8534be4c2e8679ab7f3fa926c9ee2e46f818627735609f137263c2a`. Review storica e patch proposta non sovrascritte.
- `.initial.ts` e `.initial.test.mjs` corrispondono agli hash della review precedente. Nel test autore nessuna asserzione rimossa o indebolita: aggiunte regressioni sui casi corretti.

## Risoluzione dei due difetti

**GRADING-01:** discriminante e contenuto runtime della chiave vengono controllati prima della risposta, compreso il blank. Il ramo scelta richiede cinque ID A–E unici realmente presenti: lo spread rende osservabili anche i buchi dell’array. Il ramo numerico richiede una stringa exact valida. Chiavi vuote, sparse, non stringa, duplicate, nulle o di tipo sconosciuto non diventano risposte blank/correct. Gli input risposta non stringa producono ora invalid esplicito.

**GRADING-02:** un decimale senza parte intera non aggiunge uno zero fittizio al conteggio delle cifre. Sono accettate 24 cifre frazionarie scritte e rifiutate 25. La regex richiede comunque cifre nella frazione: non introduce un numero vuoto o un’accettazione parziale.

Il confronto resta esatto con BigInt e prodotti incrociati, senza eval o parseFloat. Il tipo Number compare soltanto nell’esponente limitato. I punteggi sono decimi interi: correct 10, wrong −1, invalid −1, blank 0; totali verificati 310, −31 e 145 nei casi previsti.

## Confini ancora espliciti

- Il limite di 96 caratteri si applica dopo trim, normalizzazione del meno e rilevamento blank: non è un limite ai byte grezzi; una sequenza lunga di soli spazi resta blank.
- Le 24 cifre sono cifre scritte della mantissa di ciascuna parte di una frazione; l’esponente ha un limite separato ±12. Lo zero esplicito conta come cifra; nessuna conversione di unità o tolleranza.
- `1.`/`1,` sono invalid; ` A ` resta invalid come scelta. Nei numeri virgola e punto sono separatori decimali, non delle migliaia.
- Il prototipo assegna −1 decimo anche a invalid. La selezione conserva ancora la politica UNDECIDED: un’eventuale integrazione dovrà documentare esplicitamente questa decisione di allenamento o cambiarla. Non è una norma ministeriale verificata.
- Nessuna UI, persistenza, timer, sessione completa, autorizzazione, deployment o algoritmo ufficiale è presente o dedotto. Questa review non approva scientificamente i feedback e non sostituisce revisione umana o calibrazione didattica.

## Hash e reperti

- `/tmp/ardesia-exam-grading-proposal.ts` — SHA256 `dd2b754f2a4afc323fcd37ec1c6f8dd27cfc356cf64a720ff13570fbf873707c` (3709 byte).
- `/tmp/ardesia-exam-grading-proposal.test.mjs` — SHA256 `e8eb54fd45cbe624fbae0ce80d5757c5264125b9df2abb25c0daca6d98532daf` (3666 byte).
- `/tmp/ardesia-exam-grading-proposal.initial.ts` — SHA256 `a76b6455a6aecbe491c4e1646e0eb742b86e51fa1876c5e8c58f3e3c6f19b3c8` (3200 byte).
- `/tmp/ardesia-exam-grading-proposal.initial.test.mjs` — SHA256 `78e58e42489226172ea0180e687ee37f1b1f005d73927ffff144b06cd1b59d55` (2907 byte).
- `/tmp/ardesia-exam-grading-review.md` — SHA256 `98926c898951f119880ccf30c1ef9d9021cee0aab6f44b2a25f8de0a6287e7a7` (4484 byte).
- `/tmp/ardesia-exam-grading-review.json` — SHA256 `9b2f956fb7269aae90599de285ca0cb6c2e3393d68739a4706274a1a21427738` (8270 byte).
- `/tmp/ardesia-exam-grading-review-proposed.patch` — SHA256 `1697c032fd2e0e96bafc8487fbef3e6aa41f4f2628ea0a7d1932732e3864e520` (2502 byte).
- `/tmp/ardesia-exam-grading-review-cases.mjs` — SHA256 `065f7f9d1c1a3a1f6748cdd05218f5acaa8d0d1ac42fff69c1ace9389637a46c` (5656 byte).
- `/tmp/ardesia-exam-grading-review-counterchecks.initial.json` — SHA256 `eafeea79f8534be4c2e8679ab7f3fa926c9ee2e46f818627735609f137263c2a` (51624 byte).
- `/tmp/ardesia-exam-grading-review-counterchecks.json` — SHA256 `483add6420c8898fcdb4613780ebef324f6a06443ac878ec8e852816338415e3` (50016 byte).
- `/tmp/ardesia-exam-grading-fixed-review-author.log` — SHA256 `1e7b91544d2edc204dda46a6c7ea7f720e4ba09a3084d1675167eb8e7bb9e287` (179 byte).
- `/tmp/ardesia-exam-grading-fixed-review-counterchecks.log` — SHA256 `c6ce7f317f389d93d5d3fda2e8950890d4d8a34c36579a5338314527e2d977cc` (369 byte).
- `/tmp/ardesia-exam-candidate-selection-2026-11-13.json` — SHA256 `bc180ca01c9d4f14cdab533384f60f5065cbc263256a1e4ad1f52de0dae0b04a` (145975 byte).

Rapporto strutturato: `/tmp/ardesia-exam-grading-fixed-review.json`. Nessun nuovo sviluppo avviato; attività locale conclusa.
