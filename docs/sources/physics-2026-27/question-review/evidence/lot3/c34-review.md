# Terzo lotto C3/C4 — ricevuta

16 nuove revisioni attive, 8 per corso, selezionate dalla coda dei non revisionati. Nessuna delle 52 revisioni precedenti è stata ripresa. Sorgenti integrali immutabili copiati in `originals.json`. I file finali sono `c3.json` e `c4.json`; gli script di scrittura mantengono riproducibile la produzione.

PASS: 80 verifiche di ID attivo, presenza nella coda, assenza nei lotti precedenti, chiavi e ID opzioni; 56 ricalcoli scientifici e controprove; 313 espressioni KaTeX valide. Misurazione browser con font caricati: nessuna espressione supera i 328 px disponibili in un display da 360 px. Quattro figure renderizzate a 400×180 e ispezionate visivamente; coordinate, etichette e versi corretti. Le anteprime sono isolate, non una dichiarazione di test del prodotto integrato.

Errore originale corretto: `u6-connected-plate-separation-charge-09` mostrava nelle alternative e nel testo risposta una contaminazione `= d/d₀`, che trasformava impropriamente una carica in un rapporto geometrico. Le espressioni `exact` e la chiave A erano corrette. Ripristinate le cinque alternative Qs, 2Qs, Qs/2, Qs±1 μC; chiave e valori conservati.

Chiarimenti sostanziali: nei distrattori simbolici con offset vengono esplicitate unità o variabili numeriche; il calorimetro confronta letture Celsius, non temperature assolute; il Carnot a 3 K resta un modello ideale e mantiene il dato originale; il COP non viene confuso con un rendimento; nei condensatori sono esplicitati regolazione, generatore o isolamento; Faraday usa il modulo della media algebrica, non la media dei moduli. Tutte le risposte originali risultano valide dopo queste precisazioni.

Riproduzione: `python3 write_c3.py`, `python3 write_c4.py`, `node verify.mjs`, `node render.mjs` dalla directory del lotto (o con percorsi completi). `checks.json` conserva risultati e hash; `figures.png` il contact sheet; `math-preview.html` le espressioni misurate. Il controllo di esclusione usa i lotti precedenti, escludendo quelli con prefisso `terzo-` che il coordinatore integra in parallelo.

Revisione AI, non approvazione docente. Nessun confronto diretto con una dispensa originale di Andrea effettuato da questo agente. Nessuna modifica ai file root o a Git.

## Hash

- `c3.json`: `210d9cce14e885c67c0173b1fd090a14082061e349f70617e74e741c57d55936`
- `c4.json`: `7e8532577955c73b929a245154c1e4a3c8fcd3e985a7b1fc858f4da75bb20fe2`
- `originals.json`: `31224b4c55f52f406fd3341633767815d7d37af788f142feb5d65c4e52fbf889`
