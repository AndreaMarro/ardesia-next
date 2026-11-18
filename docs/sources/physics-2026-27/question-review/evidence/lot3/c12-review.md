# Terzo lotto C1/C2 — ricevuta del 18 novembre 2026

Congelati `c1.json` e `c2.json`, otto quesiti ciascuno; versione unita `questions.json`. Selezione dalla coda attiva, nessuna intersezione con i primi52. Tredici dei16 erano segnalati nella coda. C1 copre sei famiglie; C2 sette famiglie. Nessuna chiave corretta è stata cambiata.

`originals.json` conserva i record Next pre-intervento e i record legacy immutabili, con SHA-256 canonico, hash dello shard, classificazione e segnalazione della coda. Tutti i16 hash originali coincidono con la provenienza conservata in Next.

`verify.py` e `checks.json`: 62 controlli passati, con aritmetica razionale e controprove distinte: determinante vettoriale, grafico forza-tempo, peso/lavoro, tensione viscosa, bilancio di galleggiamento, conservazione del volume, rapporto fra superficie e volume, forza capillare e profilo normalizzato. I controlli non sono una certificazione o revisione umana.

`render-check.cjs` e `render-checks.json`: schema Zod esatto estratto dal caricatore attuale senza eseguire la build del repository; 320 formule KaTeX valide. Preview a360×800 con CSS corrente del prodotto e wrapper MathML: nessun overflow globale, nessuna formula con scroll locale, nessuna etichetta SVG fuori viewBox o sovrapposta. Cinque figure ispezionate visivamente; rifinite le posizioni delle etichette rispetto alle linee degli assi. `preview.html` e PNG locali sono anteprime del lotto, non una verifica del percorso integrato nelle lezioni.

Le modifiche sostanziali comprendono rimozione di somme dimensionalmente incompatibili nei distrattori, dichiarazione dei moduli positivi, uso di formule dimensionali, separazione di energia superficiale finale e incremento, confronto fra pompa a pressione fissata e portata fissata, conversioni esplicite e aiuti che non anticipano la risposta al primo livello. Nel quesito sulle gocce i distrattori sono ricostruiti da errori calcolati: energia iniziale, una sola gocciolina, otto aree iniziali, fattore due improprio.

Sono state applicate le richieste esplicite del mandato stilistico. Non è stato autenticato un corpus di dispense scritto da Andrea; il precedente audit stilistico lo documenta. Restano al coordinatore integrazione app, verifica delle risposte nel prodotto, PDF, commit e distribuzione.
