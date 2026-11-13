# Revisione indipendente del laboratorio di interferenza

Nessun P1/P2 individuato nelle formule scientifiche, nelle unità e nella costruzione del grafico esaminate. Revisione di codice/modello del root; il revisore non è autore del laboratorio. Il testo supplementare C5 prima metà, invece, è opera di questo revisore e necessita della separata revisione assegnata a un altro agente.

Definizione letta: `docs/sources/physics-2026-27/editorial/lab-definitions.json`, SHA-256 `3b0b1e7d9d50eb4bec630c02b8dc2029a28493cb934b31b164c202aed509d4da`.
Test letto: `apps/web/src/courses/physics/interference.test.ts`, SHA-256 `3cb9e0e836da441c6248a7f2c41e5473c38f1b114161b227cd3702b672ef3200`.

Il modello somma due oscillazioni scalari nello stesso punto e con direzione comune, frequenza 2 Hz, fase relativa costante e risposta lineare. La fase in gradi viene convertita in radianti. Le ampiezze sono centimetri sia nelle formule sia nei risultati; le tre curve usano 25 pixel/cm, asse zero a y=140, tempo 0–1 s mappato su x=50–550. Le curve hanno due periodi e 48 segmenti ciascuna. L'intero campo ammesso A1/A2≤2 cm rimane nella scala ±4 cm; la formula dell'ampiezza include una protezione numerica `max(0,...)` coerente vicino alla cancellazione.

A t=0,125 s e fase120°, i valori iniziali sono y1=1 cm, y2=−0,5 cm, somma=0,5 cm e ampiezza risultante=1 cm. Non vengono confuse ampiezza massima e ordinata istantanea. La cancellazione per ampiezze uguali e180° è locale e persistente nel tempo; il testo non la interpreta come energia globale scomparsa. Le esclusioni dichiarate — battimenti, onde stazionarie come campo spaziale e mappa di intensità — sono coerenti col perimetro del modello temporale. Per fase intermedia l'identità verificata è R=hypot(A1+A2cosφ,A2sinφ), equivalente alla formula distribuita.

Il test letto esercita schema, digest, limiti dei campi, stati noti, periodicità, disuguaglianze triangolari, coordinate condivise, cancellazione e finitezza. Ho inoltre eseguito una verifica indipendente mediante parser AST ammesso e funzioni matematiche, senza `eval`: 120 stati e 34.560 estremi di segmenti, errore massimo delle ordinate rispetto alle sinusoidi analitiche 2,85·10⁻¹⁴ pixel. Script `/tmp/ardesia-c5-wave/review-interference.py`; risultati `/tmp/ardesia-c5-wave/interference-review-checks.json`.

Il disegno con segmenti è un'approssimazione della sinusoide: con ampiezza massima4 cm, la maggiorazione dell'errore di interpolazione lineare è circa0,0343 cm, meno di0,86pixel alla scala impostata. Il marcatore usa la funzione analitica e può perciò differire dal segmento di una frazione di pixel; non è un errore fisico significativo in questa rappresentazione.

Limiti: nessun test browser o no-JavaScript eseguito da questo revisore; la demo pubblica a quattro stati non era ancora disponibile per la lettura durante questa verifica. Non si afferma validazione umana, revisione scientifica integrale del corso, accuratezza di un campo energetico completo o garanzia di accessibilità di ogni rappresentazione. Nessuna scrittura su sorgenti condivisi o pubblicazione effettuata.
