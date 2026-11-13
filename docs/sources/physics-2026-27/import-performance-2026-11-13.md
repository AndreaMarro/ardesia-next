# Importazione Fisica: meno scansioni della cronologia Core

L'importazione dei cinque corsi richiede 838 comandi ordinari: 38 creazioni, 795 oggetti e 5 salvataggi di percorso. Le prove browser della consegna `7efaa148` hanno reso visibile il costo delle importazioni complete. Questo incremento elimina una scansione ripetuta delle definizioni Creator; non cambia contenuti, numero delle richieste, revisioni, eventi, ricevute, contratti o formato dei pacchetti.

## Implementazione

All'apertura il Core già valida ogni definizione distinta, ricostruendo la corrispondenza `typeId@version → digest` anche dalle revisioni rimosse. Ora conserva quella mappa nella propria istanza, invece di scartarla e rileggere tutta la cronologia al successivo add/replace. Il digest del nuovo payload viene sempre ricalcolato. Una release entra nell'indice soltanto dopo il commit durabile, dentro la stessa coda; un errore di scrittura non ne riserva l'identità. La rimozione di un oggetto non rimuove la sua release storica.

L'indice è derivato, privato e ricostruito a ogni apertura: non è un'altra memoria persistente, una cache globale o un'autorità per l'approvazione scientifica. Il server continua a riaprire il Core per ogni richiesta nella transazione PostgreSQL. Nessuna migrazione e nessun cambiamento del client, del recupero o dei riferimenti alle edizioni.

La [valutazione architetturale](import-performance-evidence-2026-11-13/architecture.md) descrive perché creare direttamente lezioni popolate richiederebbe un cambiamento esplicito del replay e della compatibilità. Il raggruppamento delle richieste rimane un lavoro distinto, non una capacità dichiarata da questo incremento.

## Misura riproducibile

Il [report grezzo](import-performance-evidence-2026-11-13/benchmark.json) confronta il Core `7efaa14844fd835b37c51eb6a153bc5a53a05595`, compilato prima della modifica e collegato alla [ricevuta della baseline](import-performance-evidence-2026-11-13/baseline-receipt.json), con i file candidati identificati dai rispettivi SHA256. C2 contiene 139 oggetti e richiede 145 comandi. Ogni comando riapre un Core su `MemoryStorage`, come sequenza logica del server; HTTP, PostgreSQL e rendering sono esclusi.

| Misura | Precedente | Candidato |
|---|---:|---:|
| Mediana di tre importazioni, dopo un riscaldamento per implementazione | 13.538,85 ms | 12.531,19 ms |
| Intervallo dei campioni misurati | 13.502,23–13.689,69 ms | 12.336,56–13.379,86 ms |

Riduzione della mediana: **7,44%** in questa misura locale, con ordine alternato. È un campione piccolo e non una promessa sui tempi dell'app. Gli otto passaggi, inclusi i riscaldamenti, producono snapshot, eventi e ricevute identici: SHA256 `6646dbe3590f9c96adc419c8c6ac70c1346b30735235c81372b1c2b76c839bdf`. Il benchmark verifica anche riapertura e retry delle ricevute storiche. Ambiente: Node24.22.1, Linux x64, AMD EPYC 9V74; non Mac mini.

Lo [strumento](../../../tools/benchmark-physics-import.mjs) compila il Core mediante Vite con dipendenze incluse. Per un nuovo confronto, acquisire prima il modulo sulla sorgente precedente con lo stesso strumento e toolchain, poi eseguire sul candidato:

```sh
node tools/benchmark-physics-import.mjs --capture /tmp/physics-core-before.mjs
# Dopo la modifica del Core:
node tools/benchmark-physics-import.mjs --compare /tmp/physics-core-before.mjs /tmp/physics-import.json
```

Il comando di acquisizione è il punto iniziale di un nuovo esperimento: eseguirlo dopo la modifica non ricostruisce la baseline storica. Il report conserva hash dei moduli, fixture, sorgenti, campioni e ambiente. Le misure non sono una nuova soglia di CI.

## Verifica e continuità

Tre nuove prove coprono scrittura fallita sia su add sia su replace, successiva definizione alternativa ammessa, isolamento fra Core, collisione dopo rimozione/riapertura, bytes alterati con digest noto e richieste accodate. Le due suite mirate Core/extension hanno superato 27 test sul candidato. La [review indipendente](import-performance-evidence-2026-11-13/review.md) è una lettura del diff e dei percorsi di mutazione; non sostituisce l'esecuzione delle prove.

Verify e browser vengono eseguiti sulla head finale dopo questa documentazione; gli esiti e l'identità della sorgente sono nella PR53. Il caso browser pertinente importa un corso completo, interrompe e riprende l'importazione, fissa le lezioni esatte e salva un tentativo riferito alla domanda. La CI completa precedente `7efaa148` aveva superato 690 unit test e 271 prove browser nella [run43427821815](https://github.com/AndreaMarro/ardesia-next/actions/runs/43427821815); quel PASS non viene trasferito alla nuova head.

Rollback con un nuovo commit che ripristina i tre file Core/test precedenti. I dati scritti restano compatibili e non richiedono riscrittura. Cortex resta sospeso; nessuna distribuzione in produzione, revisione scientifica umana o vendita è attestata da questo lavoro.
