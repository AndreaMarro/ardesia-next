# Revisione indipendente C2 — 15 problemi progressivi

**Esito sul file finale: nessun P1/P2 aperto.** Tre precisazioni scientifiche individuate durante la lettura sono state corrette dall’autore e verificate nel candidato finale. Tutti i problemi restano DRAFT e `humanApproval:false`; una revisione AI indipendente non è approvazione scientifica umana.

Candidato `/tmp/ardesia-c23-c2/problems.json`, SHA256 `cfda7b01dfa0266cf7cad60781411750d932268dd00206b1ebbdaa31eb148b70`.

Controlli `/tmp/ardesia-c23-c2/checks.json`, SHA256 `72ad870366526fc73a455bf1386c57bce71ce1bfbfc79894d75899afc9a3ffec`.

Base delle fonti di confronto: `dc2985eb0fb0ce648e0eec6b9fc4026870e4b32e`. Letti tutti i 15 prompt, le 15 soluzioni, le note di novità e la provenienza; confrontati con coverage, assessment e sei problemi originali C2 già presenti. Il revisore non è autore di questi problemi; i problemi C3 scritti dal revisore non sono valutati in questo rapporto.

## Controlli

- 95/95 espressioni dell’autore ricalcolate tramite AST che ammette soltanto numeri e operazioni aritmetiche: tutte entro la tolleranza dichiarata.
- 24 ricalcoli indipendenti dai dati fisici, oltre alle espressioni fornite: tara/pesata inversa, risultante di pressione, massa della miscela, due strati idrostatici, pressa a quote variabili, colonne manometriche, accumulo, Bernoulli con quota, media quadratica, dissipazione volumetrica di Couette, viscosimetria, soluzione nodale della rete, potenza nei resistori, lavoro superficiale, volume/area della coalescenza e capillare interrotto.
- Tutti gli objectiveIds esistono nella copertura della rispettiva unità. La relazione semantica è stata letta, non dedotta dalla sola correttezza sintattica degli ID.
- Ogni unità contiene esattamente un problema facile, uno medio e uno difficile; ciascuna soluzione comprende diagnosi dell’errore e un controllo o ricostruzione del risultato.
- Nessun prompt finale o dei problemi precedenti è copiato integralmente dopo normalizzazione Unicode/spazi. La revisione manuale conferma cambi di scenario o struttura del ragionamento, oltre ai numeri.

## P2 risolti nel file finale

1. **U3-05-a, unità dell’energia.** La frase originaria “un joule è un newton per metro” era inappropriata nel controllo dimensionale e poteva essere letta come N/m. Ora sono esplicite le identità `1 J = 1 N·m` e `1 N/m = 1 J/m²`.
2. **U3-03-a, accumulo volumetrico.** Il prompt autonomo non dichiarava il fluido incomprimibile a densità costante, necessario per usare direttamente la differenza di portate volumetriche come accumulo. Ora lo dichiara. Bilancio 0,30 L in 90 s e velocità 0,40 m/s verificati.
3. **U3-04-b, capillare viscosimetrico.** “Le quote dei terminali non cambiano” non garantiva quota uguale fra ingresso e uscita; con due liquidi diversi una testa gravitazionale non nulla avrebbe richiesto anche le densità. Ora il capillare è esplicitamente orizzontale con terminali alla stessa quota. Il rapporto di Poiseuille può isolare η senza quel contributo: η=2,40 mPa·s e tempo previsto 40,0 s.

## Controllo scientifico e novità

**U3-01:** la tara rende la densità una quantità intensiva verificabile con due pesate; la piastra introduce forze con segni diversi su aree disuguali, e non pretende di determinare il momento senza geometria; la miscela distingue conservazione della massa da additività del volume e calcola correttamente 4% di contrazione contro 4,17% di aumento relativo della densità. Questi casi non riproducono il precedente pistone con una sola pressione né la sua variante con forza obliqua.

**U3-02:** lo strato superiore stabile e l’assenza di capillarità giustificano la somma dei contributi idrostatici. Nella pressa il dislivello cresce della somma dei due spostamenti e corregge la forza in modo coerente. Le due colonne misurano la stessa differenza di pressione: non vengono trattate come due equazioni indipendenti per le pressioni assolute. Sono casi differenti dal corpo immerso e dal cambiamento del confine della bilancia già presente.

**U3-03:** l’accumulo non viola la conservazione della massa nel modello ora esplicito; la dilatazione con salita fornisce correttamente p₂−p₁=−2000 Pa, controesempio alla regola che ignora la quota; la sequenza temporale distingue media di v² e quadrato della media, con differenza 45 Pa che non viene spacciata per una perdita misurata. Nessuna pulsazione regolare viene equiparata automaticamente a turbolenza e non si applica Bernoulli stazionario alle medie senza ipotesi. Il riferimento vascolare è delimitato e non diventa diagnosi.

**U3-04:** il profilo fra piastre è lineare perché fornito in geometria Couette e non confuso con Poiseuille; sforzo alla parete ferma non nullo e potenza alla parete ferma nulla sono correttamente distinti. La viscosità è ricavata eliminando il fattore geometrico, ora con quota chiarita. La rete con resistenza comune dimostra il diverso effetto sulla portata totale e sul ramo superstite: dopo la chiusura Q₁ cresce di 7/6 mentre il totale diminuisce. La pressione fissata dalla pompa è distinta da quella interna sui rami.

**U3-05:** il lavoro della pellicola conta due interfacce; la coalescenza conserva volume, dimezza la superficie totale e non afferma che l’energia sia scomparsa; la prova capillare interrotta al bordo non viene scambiata per equilibrio né usata per dedurre pompaggio continuo. Le leggi quantitative di approfondimento sono fornite. Questi scenari differiscono dalla prova già presente sul segno dell’angolo di contatto.

## Limiti

Non è stata eseguita integrazione nel repository, verifica degli import, rendering della demo o validazione dei laboratori. Il rapporto copre soltanto i problemi e i calcoli dell’esatto candidato indicato; non dichiara completata la copertura integrale degli obiettivi o dell’intero corso. Nessun file condiviso, file autore altrui o servizio è stato modificato dal revisore.

Evidenza strutturata: `/tmp/ardesia-c23-review-c2.json`. Script riproducibile: `/tmp/ardesia-c23-review-c2-check.py`.
