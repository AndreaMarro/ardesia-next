# Approfondimenti C1/C4 e laboratorio sui condensatori

Continuazione isolata da `22e06d9936008fc4e4bd1d4d64ba402d74cd2b5a` (PR53). Il mandato prioritario riguarda i minicorsi; Cortex è sospeso per istruzione diretta del titolare. Nessuna modifica a Core, renderer, schemi, dipendenze, budget, main, coordinamento o servizi di produzione.

## Contenuto effettivo

Sedici lezioni approfondite:9 di strumenti/meccanica e7 di elettricità/magnetismo. Le aggiunte comprendono55.174caratteri originali; le spiegazioni risultanti hanno4.552–5.782caratteri. La lunghezza è un dato d'inventario, non una misura di qualità o completezza. Testi precedenti, obiettivi e domande restano conservati; le nuove aggiunte precedono «Punti da saper spiegare». Gli esempi aggiuntivi non sono conteggiati come nuovi quiz autonomi.

C1 sviluppa conversioni e dimensioni, proiezioni e prodotti vettoriali, grafici del moto, attrito con trazione obliqua, molla e dissipazione, impulso e separazione, equilibrio di una leva anatomica idealizzata. C4 sviluppa sovrapposizione vettoriale, cariche negative e potenziale, carica per induzione, circuiti misti, vincoli del condensatore, Lorentz e Faraday. Ogni aggiunta contiene almeno un esempio risolto passo per passo, ipotesi e un controllo del risultato.

Il nuovo laboratorio `ardesia.physics.capacitor-constraints/1` usa il contratto Creator esistente. Lo studente controlla capacità iniziale, tensione e permittività relativa e confronta due esperimenti con lo stesso stato iniziale: generatore collegato oppure armature isolate. Visualizza capacità, carica, tensione, energia, lavoro del generatore e due grafici di energia normalizzata. Distingue isolamento elettrico da isolamento energetico. Modello ideale lineare, geometria fissa, inserimento completo quasistatico, senza perdite o effetti di bordo; nessuna previsione di transitori o dispositivi clinici.

La mappatura aggiunge il laboratorio soltanto a U6-05.01/.03/.04 (capacità, dielettrico, energia), non agli obiettivi di geometria piana o associazioni serie/parallelo. Il patrimonio passa a753oggetti e17tipi di laboratorio;64/200sotto-obiettivi hanno un laboratorio specifico. Restano259quesiti legacy distinti,200verifiche e39problemi originali autonomi. Non sono migliaia di originali verificati.

Gli esperimenti nel corso sono transitori e dichiarano che i valori non vengono salvati; il ragionamento può essere annotato in un tentativo Core. Le edizioni già importate non vengono riscritte. Per osservare questi asset occorre un'importazione in uno spazio nuovo; la revisione della lezione non è da sola un identificatore del testo generato. Sono preservati DRAFT e humanApproval=false.

## Verifica e revisione

La [ricevuta aritmetica](lesson-depth-2026-11-13.json) conserva baseline, hash delle aggiunte e spiegazioni,110espressioni con risultato/tolleranza e limiti. Calcoli valutati con AST aritmetico limitato dal coordinatore; non viene eseguito testo arbitrario. Due contesti AI separati hanno scritto rispettivamente C1 e C4 e revisionato il contributo altrui. Non è revisione scientifica umana.

La revisione ha corretto l'esempio improprio di coordinata come scalare, l'ambiguità fra spazio e secondo in N·s, la punteggiatura delle componenti vettoriali e una frase che poteva suggerire stati finali identici nei due esperimenti del condensatore. La verifica del laboratorio legge il pacchetto realmente distribuito: identità della definizione, limiti degli input, conversione SI indipendente, bilancio energetico, invarianti e grafici. Il caso browser importa C4 tramite Core/PostgreSQL, modifica i controlli con tastiera e input numerico, confronta i risultati, verifica reset e documento sorgente invariato.

I risultati conclusivi di Verify e browser, con digest esatto della sorgente, sono nei report generati in `artifacts/` e nella ricevuta di consegna esterna; questo documento non anticipa PASS. Le prove precedenti restano distinte. L'ambiente è Linux x86_64 con Node24 e Chromium; Mac/iPad fisici, Safari e Pencil non provati. Il subreaper Linux già documentato permette al test dei processi figli di avere un init che raccolga gli orfani, senza modificare prodotto o test.

Il collaudo ha inoltre fatto emergere un timeout preesistente e un difetto nel limite cumulativo del runtime programmabile, analizzati e corretti senza aumentare soglie: [ricevuta della correzione WebAssembly](../program-memory-2026-11-13.md). È una modifica al bootstrap Program, separata dal laboratorio dichiarativo. I fallimenti iniziali restano conservati e non sono trasformati retroattivamente in PASS.

Restano aperti profondità integrale C2/C3/C5, ampiezza e revisione della banca originale, simulazione d'esame temporizzata, diagnostica automatica e ripasso personalizzato, verifica delle quote ministeriali di esercitazione e percorso commerciale completo. Nessuna vendita, prenotazione, pubblicazione promozionale o messaggio a potenziali clienti deriva da questo incremento.
