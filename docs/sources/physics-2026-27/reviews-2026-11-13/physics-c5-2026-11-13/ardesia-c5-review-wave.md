# Revisione indipendente C5 — onde e campi elettromagnetici

Esito: **nessun P1/P2 aperto nel candidato finale**. Due precisazioni scientifiche P2 individuate durante la lettura sono state corrette dal root e rilette sul file finale. Il contenuto rimane DRAFT; questa revisione AI non costituisce approvazione umana.

- Candidato: `/tmp/ardesia-c5-wave/supplements.json`.
- SHA256 finale: `c417d0357af6d8119595b46c493339a99ffe3d0c0bd22fe154cfd9c42f90e898`.
- SHA256 iniziale esaminato: `fd6a1f1e7e972e56ee39bc05508902e562dfb2a5f1559c9a5720cc24fa3df084`.
- Fonti di confronto: `courses.json`, `assessments.json`, `original-problems.json`, `coverage.json` nel percorso editoriale Fisica, alla base `18c6ad1f1d8b101f64f253d6915ec192587d39d1`.
- Perimetro: U4-01…05 e U7-01, sei aggiunte originali. Revisore distinto dal loro autore. Le sei aggiunte sulle radiazioni U7-02…07 scritte da questo revisore NON sono oggetto di questa approvazione tecnica.

## Verifiche eseguite

Tutti i 73 controlli numerici forniti dall’autore sono stati ricalcolati con interprete AST che accetta soltanto costanti, operazioni aritmetiche e potenze. Inoltre 15 ricalcoli indipendenti ricostruiscono i risultati dai dati fisici: valore della sinusoide e movimento della cresta, massimo della somma tramite fase ottimale e ampiezza complessa, energia intercettata mediante frazione di angolo solido, decibel tramite `math.log10`, tempi Doppler risolvendo gli incontri dei fronti, lunghezza d’onda e ritardo nella lastra, energia EM con polarizzazione lineare.

Le lunghezze sono fra 3000 e 4500 caratteri; ogni spiegazione originale più aggiunta resta sotto 10.000 caratteri. Nessun prompt finale o prompt dei problemi preesistenti è copiato letteralmente dopo normalizzazione Unicode/spazi; nessuna risposta finale lunga è riprodotta integralmente. La lettura manuale conferma dati e percorsi nuovi: zeri spaziali e sensore temporale; quadratura con ampiezze diverse; sensore spostato; somma di contributi e attenuazione; costruzione di fronti con sorgente/ricevitore mobili; ritardo della lastra e bilancio dei campi. La vicinanza dei concetti ai rispettivi obiettivi è didatticamente necessaria e non equivale a duplicare le verifiche.

## Precisazioni P2 risolte

**U4-04 — geometria nella somma di intensità.** L’assenza del termine di interferenza medio non basta da sola a giustificare una somma scalare del flusso energetico: contributi contropropaganti possono avere flussi netti che si sottraggono. Il testo finale dichiara ora stessa direzione e stesso verso e sensore perpendicolare alla propagazione. Con queste ipotesi 4·10⁻⁸+6·10⁻⁸=10⁻⁷ W/m², 50 dB, attenuazione di fattore 100 e livello finale 30 dB sono coerenti. Nessun cambiamento dei risultati numerici era necessario.

**U7-01 — ampiezza di picco e polarizzazione.** La formula I=½ε₀cE₀² richiede il campo sinusoidale linearmente polarizzato se E₀ indica il picco del modulo. Per polarizzazione circolare il modulo può essere costante e il fattore ½ non si trasferisce automaticamente. L’esempio finale specifica ora «polarizzata linearmente» e «ampiezza elettrica di picco». La formula e la verifica tramite campo efficace risultano così correttamente circoscritte.

## Valutazione scientifica per unità

- **U4-01:** distinzione spazio/tempo, mezzo ciclo fra zeri consecutivi, verso di propagazione e velocità locale coerenti. Valore a x=0,42 m e t=0,10 s verificato separatamente con la funzione e il trasporto del profilo.
- **U4-02:** somma di valori simultanei, anticipo di fase, risultante 1,5 cm e limiti 0,3–2,1 cm corretti. Il bilancio energetico globale non è dedotto dal solo grafico locale.
- **U4-03:** geometria isotropa e condizioni del sensore esplicite; unità d’area, potenza ed energia corrette. Energia incidente distinta dall’assorbita; rapporto delle ampiezze coerente nel modello didattico dichiarato.
- **U4-04:** dopo la precisazione geometrica, somme e logaritmi corretti. Livello d’intensità distinto da pressione e percezione, riferimento esplicito, λ=v/f applicata senza dedurre il livello dai soli dati cinematici.
- **U4-05:** costruzione dei fronti e tempi di arrivo corretti rispetto al mezzo fermo. Gli intervalli 0,75 s, 1,25 s e 0,80 s mostrano correttamente la differenza fra moto della sorgente e del ricevitore. Approfondimento numerico presentato come facoltativo rispetto al requisito qualitativo, senza formule cliniche.
- **U7-01:** orientazione E×B, invariabilità della frequenza, lunghezza nel mezzo e ritardo coerenti con mezzo fermo non dispersivo. Nessuna deduzione arbitraria della trasmittanza. Formula d’intensità delimitata alla polarizzazione lineare nel vuoto; area e durata convertite correttamente.

## Limiti

Questa revisione riguarda il testo e i calcoli del file esatto indicato. Non certifica l’integrazione nel repository, il rendering web, l’interazione del laboratorio, la copertura completa del corso o una validazione scientifica umana. I dati strutturati e tutti i ricalcoli sono in `/tmp/ardesia-c5-review-wave.json`; lo script riproducibile è `/tmp/ardesia-c5-review-wave-check.py`. Nessun file condiviso o servizio è stato modificato dal revisore.
