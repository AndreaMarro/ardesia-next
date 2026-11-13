# Revisione indipendente — quiz guidati gruppo A

**Nessun P1/P2 individuato nel candidato esaminato.** Letti i sei prompt, tutte le 30 alternative e i relativi feedback, le soluzioni complete, mapping e note di novità. Le chiavi C/A/D/E/B/C sono univoche rispetto alle ipotesi dichiarate. Questa è una revisione AI indipendente, non un’approvazione umana; il contenuto resta DRAFT.

- Problemi: `/tmp/ardesia-choice-a/problems.json`, SHA256 `c3caae40ead4076e3261b988effb80f0eeb7556487310b10c588cc14a5c6a06b`.
- Controlli: `/tmp/ardesia-choice-a/checks.json`, SHA256 `dc86589cac579387d2ed04d8f5d7d60f1640f4edf387c4151841ec69d0ce4a5f`.
- Base delle fonti: `70af28ce5f59365fd540bafbb58ab3ce6849d680`.
- 33/33 controlli aritmetici dell’autore ricalcolati con AST numerici; 16 ricalcoli indipendenti aggiuntivi, usando anche frazioni esatte, integrazione polinomiale del profilo e area orientata del ciclo.

## Esame per quiz

**U1-01 — C.** La sottrazione di tassi precede l’integrazione temporale; 0,15 s sono 0,0025 min e i conteggi utili risultano 1500. Con l’ordine di grandezza definito esplicitamente sulla scala logaritmica, il valore è 10³. I quattro distrattori corrispondono a lordo, somma del fondo, mancata conversione secondi/minuti e scelta errata dell’ordine. Valori esatti e assenza di fluttuazioni sono ipotesi dichiarate, non pretese su un rivelatore reale.

**U2-04 — A.** p iniziale=+2 kg·m/s, p finale=+3 kg·m/s, impulso esterno necessario +1 N·s. L’unione dopo l’urto non dimostra isolamento. Il calo di energia cinetica da 17 a 1,5 J è corretto e non viene attribuito interamente a dissipazione interna senza conoscere il lavoro esterno. Nessuna alternativa scorretta diventa ammissibile nelle condizioni fissate.

**U3-02 — D.** Il carico sulla zattera richiede 300 mL di spostamento aggiuntivo, mentre sul fondo occupa 100 mL: variazione −200 mL e livello −1 cm. Il volume spostato per la sola zattera si elimina nel confronto. Sono sufficientemente espliciti acqua incomprimibile, recipiente verticale, assenza di perdite e assorbimento, galleggiamento libero e due stati di quiete. La soluzione non calcola il transitorio del trasferimento.

**U3-04 — E.** Il dato fuori asse vale 3/4 del massimo: u_max=8 cm/s, u_media=4 cm/s, Q=0,040π mL/s. Ho verificato anche tramite l’integrale radiale del profilo, distinto dall’inserimento diretto della media fornita. I distrattori separano velocità locale, massima, falsa posizione sull’asse e conversione cm/s→m/s.

**U5-02 — B.** Il primo equilibrio di A è 40 °C; estratto il blocco, la miscela delle due acque termina a 30 °C. In B i tre corpi restano insieme e terminano a 32 °C. Il controllo dell’energia rispetto a 20 °C verifica i 2000 J che escono col blocco. Le ipotesi escludono transizioni, trascinamento d’acqua e trasferimenti rilevanti nell’estrazione. Il feedback non confonde il calore trasferito con una proprietà contenuta nello stato.

**U5-04 — C.** I lavori dei tratti sono +200, 0 e −400 J, dunque W_net=−200 J. Il calore netto è uguale al lavoro, perché sul ciclo ΔU=0. Il controllo geometrico dà il modulo 200 J e il verso di compressione ad alta pressione ne fissa il segno negativo. Il segmento C→A è definito nel prompt: la sua pressione media rispetto al volume è determinata, non inventata.

## Mapping e novità

Tutti gli objectiveIds appartengono alle unità effettive di `units.json` e `coverage.json`; il contenuto chiede operazioni pertinenti ai target elencati. Sono stati confrontati i problemi originali e gli assessment delle sei unità; per la banca si sono letti i prompt dei casi più vicini e i titoli degli altri record selezionati. Non si rivendica lettura integrale del patrimonio legacy.

I nuovi quiz introducono, rispettivamente, sottrazione del fondo, diagnosi di impulso esterno da un urto misurato, passaggio del carico da galleggiante a fondo, misura fuori asse, rimozione di un corpo tra due scambi e ciclo triangolare con compressione variabile. I relativi casi preesistenti riguardano rapporti/potenze o emettitore intermittente, impulso triangolare o urto isolato, pescaggio o pesata con filo, asse/parete e media del profilo, miscela simultanea/calibrazione e cammini rettangolari/singola isobara. Non sono semplici sostituzioni numeriche. Nessun prompt precedente è copiato integralmente dopo normalizzazione Unicode/spazi.

## Limiti

Sono verificati contenuto e calcoli degli hash sopra indicati. Non sono stati verificati rendering, accessibilità, registrazione dell’aiuto Core, selezioni transitorie o salvataggio della risposta argomentata. Non viene attribuito un voto o uno stato di padronanza allo studente. Non ho modificato file dell’autore, repository, servizi o stato operativo, né approvato i miei quiz del gruppo B.

Evidenza strutturata: `/tmp/ardesia-choice-review-a.json`. Script riproducibile: `/tmp/ardesia-choice-review-a-check.py`.
