# Review indipendente del prototipo di correzione per allenamento

**CHANGES_REQUESTED: due P2 riprodotti, nessun P1.** Prototipo locale non integrato, `humanApproval: false`. Nessuna UI, persistenza, simulazione d’esame completa o algoritmo ministeriale è stata implementata o attestata da questa review. Nessuna modifica ai file del root.

## Riscontri da correggere

1. **P2 — Chiavi runtime invalide non sempre generano errore prima del blank.** Con `{kind:'choice', correctOptionId:'', optionIds:['','B','C','D','E']}` e risposta vuota si ottiene `{kind:'blank', pointsTenths:0}`. La chiave è impossibile da rispondere correttamente. Succede anche con ID composto solo da spazi, ID non stringa e array sparso. `{kind:'not-a-key', exact:'1'}` entra addirittura nel ramo numerico e assegna 10 decimi a `1`. Validare discriminante e contenuto runtime della chiave prima di qualsiasi trattamento della risposta. Per il set A–E confermato dal root è possibile imporre cinque ID unici A–E. Attenzione: `Array.some` salta i buchi; usare spread/Array.from o una verifica equivalente.
2. **P2 — Limite di 24 cifre errato per il decimale senza zero iniziale.** `'.' + '7'.repeat(24)` contiene 24 cifre scritte ma viene dichiarato invalid: `decimalPart` antepone uno zero fittizio prima del conteggio. Il fallback della parte intera deve essere stringa vuota; la regex garantisce già che la frazione contenga cifre.

Diff proposto: `/tmp/ardesia-exam-grading-review-proposed.patch`. Non applicato né dichiarato verificato: il root applicherà il delta e richiederà il successivo controllo.

## Test effettivamente eseguiti

Il test autore è stato rieseguito con Node, exit 0: 31 chiavi, 105 alternative MC, 21 stringhe legacy accettate e massimo 310 decimi. Il log finale originale riporta lo stesso esito. Il log iniziale conserva un fallimento «Missing expected exception»; senza i byte della versione iniziale non viene ricostruita o attribuita una causa storica ulteriore.

Il controllo indipendente contiene **585 casi: 579 riusciti, 6 falliti**, tutti riferibili ai due difetti sopra. Comprende 250 coppie razionali equivalenti e 250 variazioni di un’unità del numeratore: 500 verifiche aritmetiche esatte complessivamente coerenti. Sono state controllate anche le soglie, whitespace, separatori, input malformati, segni, zero e punteggi aggregati. File riproducibile: `/tmp/ardesia-exam-grading-review-cases.mjs`; risultati dettagliati: `/tmp/ardesia-exam-grading-review-counterchecks.json`.

BigInt evita perdita di precisione delle risposte; il confronto usa prodotti incrociati esatti. `Number` serve soltanto all’esponente di massimo due cifre, limitato a ±12. Nessun eval o parseFloat parziale. Le prove su interi di 24 cifre adiacenti, potenze limite e rapporti con grandi numeratori non mostrano arrotondamento o overflow. Il denominatore zero è rifiutato anche come `-0`, `0.000e12` o `+0e-12`.

Blank, invalid e wrong sono distinti: i punteggi sono rispettivamente 0, −1 e −1 decimi; correct vale 10. Trentuno risposte corrette totalizzano 310 decimi, tutte errate −31, sedici corrette e quindici errate 145, senza somme decimali floating point.

## Confini e decisioni da esplicitare

- I 96 caratteri sono misurati **dopo trim**. Una stringa interamente vuota/spazi resta blank anche oltre 96: comportamento esplicito del test autore, non limite del payload grezzo.
- Le 24 cifre sono quelle della mantissa scritta per ciascuna parte della frazione; l’esponente ha un limite separato. Nessuna tolleranza o conversione di unità è prevista.
- `1.` / `1,` e scelte come ` A ` sono rifiutate secondo la grammatica attuale; virgola e punto sono decimali, non separatori delle migliaia.
- La selezione dichiara ancora la politica invalid-input UNDECIDED; il prototipo applica già −1 decimo. Occorre registrarla come decisione di allenamento prima dell’integrazione, senza attribuirla al Ministero.
- La selezione comprende 31 identità uniche, 21 MC e 10 completamenti numerici, tutti DRAFT e humanApproval=false. L’accettazione ufficiale di forme equivalenti resta ignota; una review del parser non certifica conformità ministeriale, accuratezza scientifica di nuovi feedback o completezza dei corsi.

Gli hash esatti dei sorgenti, della selezione, dei log e delle controprove sono nel JSON. Il prototipo recensito è SHA-256 `a76b6455a6aecbe491c4e1646e0eb742b86e51fa1876c5e8c58f3e3c6f19b3c8`, rimasto invariato durante i controlli.
