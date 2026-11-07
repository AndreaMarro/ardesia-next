Espansione originale della banca Ardesia — 7 novembre 2026

`original-problems.json` contiene **38 nuovi problemi aperti**, uno per ciascuna delle 38 famiglie curricolari. Sono testi e soluzioni scritti per questa consegna, separati dai 259 quesiti recuperati, dalle 200 verifiche finali e dai 38 transfer già presenti nei corsi. Il nuovo file non modifica il pacchetto congelato in `curriculum-audit/candidate/`.

Ogni record ha esattamente i campi richiesti: `{id, unitId, objectiveIds, title, prompt, solution, level, noveltyNote, status, humanApproval}`. Gli ID sono `original-20261107-u1-01` ecc.; gli `unitId` coincidono con quelli dei corsi. Tutti i record sono `DRAFT`, `humanApproval=false`. Il livello è una stima editoriale: **15 medio, 23 difficile**, non una calibrazione su studenti. Sono collegati 140 distinti sottobiettivi editoriali; non si pretende di sostituire le 200 verifiche puntuali.

I problemi richiedono inferenze o verifiche che non si risolvono cambiando soltanto dati di un esercizio diretto. Tra i casi:

- U2-01 presenta due leggi orarie compatibili con gli stessi fotogrammi e chiede un’osservazione discriminante.
- U2-03 confronta perdita energetica assoluta e percentuale, poi individua una previsione non fisica fuori dal dominio del modello.
- U3-02 mantiene invariato il blocco immerso ma cambia il supporto del filo: le letture della bilancia dipendono dal confine del sistema.
- U3-04 costruisce due modifiche diverse della rete che hanno la stessa portata totale e la stessa risposta globale alla pressione: occorre misurare i rami.
- U5-02 sceglie il regime di fase prima di calcolare la temperatura, poi attraversa la soglia di fusione con un secondo apporto energetico.
- U6-04 identifica il ramo interrotto da due misure e dimostra che il resistore superstite può dissipare più potenza mentre quella totale diminuisce.
- U6-05 distingue energia fornita dal generatore, energia immagazzinata e lavoro meccanico nell’inserimento di un dielettrico.
- U6-07 trova una f.e.m. media nulla su un ciclo ma una dissipazione positiva: media firmata e integrale del quadrato non sono intercambiabili.
- U7-04 mostra il cambiamento della composizione di un fascio misto e il fallimento di un solo coefficiente di attenuazione costante.
- U7-07 ricostruisce due rami, reale e virtuale, da un ingrandimento privo di segno e propone una verifica con schermo.

Le soluzioni sono specifiche, con calcoli, segni, interpretazione e limiti pertinenti. Non includono una rubrica ripetuta al posto del ragionamento. Il prompt più lungo è di 741 caratteri e la soluzione più lunga di 1092; il file completo è 75.437 byte.

Due problemi sono **approfondimenti con legge quantitativa fornita**, da distinguere nel profilo syllabus:

- `original-20261107-u3-05`: legge di risalita capillare fornita per interpretare bagnabilità, segno e raggio; non introduce una nuova formula obbligatoria da memorizzare.
- `original-20261107-u5-03`: resistenze termiche conduttiva e convettiva fornite per identificare il limite dello scambio.

La distinzione è esplicita nei prompt e in `mathematical-checks.json` / `corpus-comparison.json`; non è stato aggiunto un campo non richiesto ai record. Il problema Doppler rimane qualitativo. I valori esemplificativi ricevuti sono stati controllati anche con un modello quantitativo solo nell’audit interno, senza richiederlo allo studente.

`mathematical-checks.json` riporta **142 controlli numerici PASS**, distribuiti sulle 38 famiglie, oltre a conteggi, identità uniche, contratto dei record, livelli e riferimenti agli obiettivi. Le verifiche usano calcoli letterali indipendenti, frazioni esatte e funzioni matematiche limitate; non eseguono stringhe del patrimonio. I controlli relativi non usano una tolleranza assoluta che possa nascondere errori sulle piccole energie dei fotoni. Per le domande qualitative, il controllo numerico copre solo le parti numeriche e la conservazione, non certifica il ragionamento intero.

`corpus-comparison.json` documenta il confronto esplicito con:

- tutti i **4.000 quesiti** recuperati, appartenenti a 250 famiglie di modello, 212 valori di `lawFamily` e 81 etichette `reasoningTask`;
- il sottoinsieme di **259 quesiti** selezionati per i corsi;
- **76 transfer**, cioè i 38 storici e i 38 appena scritti per i corsi.

Per ogni nuovo problema conserva le leggi condivise, il numero di record preesistenti che le usano e la distribuzione dei relativi `reasoningTask`. Registra inoltre i tre testi più vicini nell’intera banca, nel sottoinsieme selezionato e fra le stesse leggi, più i due transfer più vicini. `comparison-metadata.json` contiene le dichiarazioni editoriali di legge/ragionamento e la differenza sostanziale rivendicata.

Non risultano prompt identici dopo normalizzazione lessicale, nemmeno mascherando tutti i numeri; non risultano corrispondenze esatte ai transfer. Il massimo Jaccard fra insiemi di quattro parole consecutive, con numeri mascherati, è 0,050847 verso la banca e 0,050725 verso i transfer. Questi numeri misurano soltanto sovrapposizione testuale sotto una procedura documentata. **Non certificano unicità semantica, assenza di parafrasi o novità didattica di ogni ragionamento.** Neppure una nuova etichetta `reasoningTask` dimostra una nuova competenza: le etichette sono dichiarazioni editoriali, non prove.

Sono stati confrontati anche alcuni casi strutturalmente vicini, senza affidarsi soltanto al vicino lessicale:

| Nuovo problema | Patrimonio pertinente | Differenza concreta |
|---|---|---|
| U4-03, fondo e inverso del quadrato | `u4-spherical-intensity-15`, taratura affine con riferimenti | Il nuovo problema stima un fondo fisico e richiede una prova a sorgente spenta e una previsione fuori dai dati di stima. La struttura algebrica resta affine: questa affinità non viene nascosta. |
| U6-04, guasto e potenza locale | `u6-two-parallel-resistors-06`, rimozione di un ramo a tensione costante | Il resistore aggiunto in serie modifica la tensione dei rami; i dati identificano il guasto e consentono l’aumento della dissipazione nel componente superstite. |
| U7-04, fascio a due componenti | `u7-beer-transmitted-intensity-16`, media areale fra due cammini | Il nuovo problema segue componenti spettrali lungo lo stesso cammino e verifica il fallimento di un coefficiente unico; non chiede lo spessore ignoto di una lastra a cammini diversi. |
| U7-05, decadimento e fondo | `u7-radioactive-survivors-15` e `-16`, taratura e ricostruzione della popolazione | Le differenze fra tre tassi rimuovono un fondo ignoto, poi si separano efficienza, conteggi e attività. Si combinano idee note con un nuovo problema d’identificazione. |

Una particolarità del patrimonio resta documentata: `u4-beats-envelope-03` ha etichetta di legge `temporal-interference` ma il testo è stato trasformato in una domanda Doppler qualitativa. Il confronto conserva questa incongruenza storica come dato di provenienza; non trasforma i battimenti quantitativi in requisito Doppler del syllabus.

Le domande nuove mantengono scenari didattici, modelli su carta e trasferimenti non diagnostici. Le ipotesi più delicate sono esplicite: attrito statico adattabile, assenza di trabocco, pressioni assolute, condizioni dei rami, passaggi quasistatici, perdita di energia del campo, autoinduttanza trascurabile, fasci misti, efficienza di rivelazione, soglia a singolo fotone e convenzioni delle lenti. La lettura fisica è stata eseguita dall’agente autore; **revisione scientifica umana e calibrazione su studenti: NOT_RUN**.

Per riprodurre la consegna, eseguire dalla cartella `curriculum-expansion`:

```sh
python3 author_expansion.py
python3 verify_expansion.py
python3 compare_corpus.py
```

I programmi leggono il patrimonio già copiato in `curriculum-audit/` e scrivono soltanto in questa cartella. Non accedono a database, servizi o repository applicativi. Le risposte aperte non vanno trasformate in valutazione a uguaglianza di stringhe: il prodotto può conservare tentativi, mostrare le soluzioni al confronto e supportare una valutazione esplicita dei passaggi.

**Freeze di `original-problems.json`: SHA256 `9f1f9be214ffe10a5fd242fa9e9f99a7989d10330265826de2352bd52eaca5fa`.** Entrambi i rapporti riportano questo hash. Gli hash del precedente pacchetto corsi e del relativo manifest sono rimasti invariati. L’importazione di questi problemi, i tentativi nel Core e l’esperienza Mac/iPad sono verifiche dell’integratore; non sono incluse in questo audit dati.
