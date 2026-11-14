# Cortex — recupero locale verificabile, prototipo 0.2

Primo strumento di sviluppo locale per Ardesia Next: trova frammenti del repository con percorso, righe e SHA-256, aggiornando una memoria SQLite persistente. Nessun servizio, modello, richiesta di rete o dipendenza Python esterna. Non è un chatbot, un sistema educativo o un secondo Core.

Il prototipo è separato dal runtime Ardesia. Legge solo file tracciati da Git, con estensioni consentite e limiti espliciti. Non modifica sorgenti, coda, permessi, database del prodotto o scheduler. Il comando Git usa argomenti costanti e non una shell, disabilita fsmonitor e hooksPath; non esegue test, hook, script o comandi trovati nei documenti.

## Uso

Richiede Python 3.10+ su Linux/macOS, Git e SQLite con FTS5. L'indice deve stare fuori dal worktree e rimane privato sul computer. Dal repository:

```bash
python3 tools/cortex/cortex.py --repo "$PWD" --db /tmp/ardesia-cortex-memory.sqlite3 index
python3 tools/cortex/cortex.py --repo "$PWD" --db /tmp/ardesia-cortex-memory.sqlite3 search 'importPhysicsCourse' --budget-bytes 8000
python3 -m unittest discover -s tools/cortex -v
python3 tools/cortex/benchmark.py --repo "$PWD" --output /tmp/cortex-benchmark.json
```

Per memoria durevole, scegliere una directory privata persistente fuori dal repository invece di `/tmp`. Il database è ricostruibile; non è fonte autorevole e non va committato. Un database si lega alla directory canonica del worktree e alla versione di schema; un altro worktree richiede un altro database. L'esito `FAIL_CLOSED` richiede di correggere la causa, non di consumare una vecchia ricerca come se fosse aggiornata.

`search` aggiorna l'indice, recupera candidati BM25 da FTS5, applica indizi lessicali di dichiarazione e restituisce righe centrate sulla corrispondenza. Il JSON contiene:

- hash Git HEAD e manifest dei file realmente indicizzati;
- file, righe, hash del file e testo dei frammenti;
- numero di byte di evidenza e stima esplicitamente euristica byte/4;
- limiti di copertura e marcatura del testo come dato non fidato.

Il budget riguarda il testo dei frammenti più intestazioni di provenienza; l'envelope JSON e i caratteri di escaping si aggiungono. Il programma non conosce il tokenizer di un modello e non attesta token cloud risparmiati. I frammenti sono righe complete della sorgente, fino a 1.800 byte comprese le intestazioni. Una riga singola che non entra nel budget viene omessa, mai tagliata o sostituita con testo inventato. Se nessun frammento entra nel budget restituisce zero risultati. Con un solo termine si riesaminano fino a 1.200 candidati e si privilegiano dichiarazioni comuni TypeScript/JavaScript/Python/Swift/Rust riconosciute da espressioni regolari; per richieste composte il limite resta 120. I percorsi test/spec/benchmark sono subordinati, salvo richiesta esplicita di test/benchmark. Non si escludono quei file: possono ancora essere restituiti. `retrieval.candidate_limit_reached` segnala saturazione del pool, non dimostra completezza quando falso. Il parser FTS resta case-insensitive; l'indizio di dichiarazione usa il nome esatto.

La selezione di righe cerca prima una dichiarazione, poi la riga con più termini della query, ed espande il contesto entro il budget. Non duplica intervalli sovrapposti dello stesso file. Una corrispondenza del solo percorso usa l'inizio del chunk. Sono indizi: stringhe multilinea o sintassi non riconosciute possono produrre falsi positivi/negativi. Non è analisi AST, non prova che tutto il corpo della funzione sia presente e non seleziona automaticamente test da eseguire.

Lo schema 0.2 richiede un nuovo database rispetto allo 0.1; il vecchio indice privato può essere conservato. I risultati sono una selezione lessicale, non l'intero grafo delle dipendenze: prima di modificare codice servono ancora AGENTS applicabili, chiamanti, contratti e test.

## Invalidazione e limiti di sicurezza

Ogni ricerca rilegge e calcola l'hash di tutti i file ammessi. Chunks e FTS sono aggiornati solo per file cambiati; file rimossi, diventati sensibili, binari o symlink sono eliminati dall'indice logico. Il costo di lettura rimane proporzionale al corpus: la scelta evita che modifiche con identici dimensione e mtime conservino contesto obsoleto. I file selezionati vengono ricontrollati prima della risposta. Non esiste un lock globale del worktree: una modifica successiva alla risposta richiede una nuova ricerca/verifica.

Si escludono binari/non UTF-8, symlink anche nelle directory superiori, submodule, file oltre 512.000 byte, cartelle generate/vendor, lockfile, file `.env*`, nomi sensibili e alcuni pattern di credenziali. I limiti complessivi sono 10.000 file e 40 MB; superarli interrompe la transazione. I file non tracciati non entrano nell'indice. Nuovi sorgenti devono essere aggiunti a Git intenzionalmente prima della ricerca.

Le euristiche sulle credenziali sono conservative ma non possono riconoscere qualsiasi segreto: **non autorizzano l'invio automatico del contesto al cloud**. Il database contiene copie di sorgenti privati e richiede lo stesso livello di protezione del checkout. `secure_delete` e rimozione logica non sono una promessa di cancellazione forense da FTS, backup o disco. Dopo una credenziale committata per errore, valgono rotazione e gestione dell'incidente, non solo reindicizzazione.

## Prove concrete

La suite verifica provenienza/righe/budget, cache invariata, modifiche con stessa dimensione e mtime, cancellazioni, segreti aggiunti dopo l'indicizzazione, segreti JSON, file non tracciati/binari/grandi, symlink di file e directory, input con sintassi FTS/SQL, isolamento fra worktree, rollback transazionale, modifica fra indicizzazione e risposta, chunk Unicode e permessi del database. Le controprove di recupero includono 135 riferimenti ripetuti in test contro una definizione nuova, dichiarazioni Python/tipi/costanti, stringhe di esempio, query italiane lontane dall’inizio del chunk, righe UTF-8, righe troppo grandi e deduplicazione degli intervalli.

`benchmark.py` ha cinque casi fissi e pubblica ambiente, hash dell'implementazione, HEAD/manifest del corpus, tempi grezzi, dimensioni e file attesi/trovati. Tre query sono simboli di codice, due richieste in italiano. È una verifica circoscritta di localizzazione; non misura correzione del codice, produttività, causalità, risparmio economico o prestazioni del Mac M4. Il benchmark deve essere rieseguito sul Mac, senza sostituire Linux a una prova hardware.

## Architetture avanzate: decisione corrente

La prima priorità verificabile è ridurre il contesto da leggere senza perdere provenienza. SQLite/FTS5 è una baseline economica e interrogabile. Non si adotta una rete perché il nome promette un world model.

| Componente | Stato concreto | Criterio per il passo successivo |
|---|---|---|
| Memoria e recupero | Implementati: indice persistente, BM25, hash, budget, invalidazione | Confronto con `rg` su ticket reali, recall dei file necessari e latenza |
| World model software | Non implementato; il manifest è identità del corpus, non un modello causale | Grafo statico di import/export e contratti, seguito da previsione dell'impatto confrontata con test reali |
| Controllore deterministico | La CLI compie soltanto index/search con limiti; non modifica codice | Wrapper su comandi di verifica esplicitamente consentiti, ricevute per hash e selezione test validata contro regressione completa |
| Modelli locali | Qwen2.5-coder1.5B via Ollama provato sul Mac M4: nessun beneficio di recupero; escluso dal percorso predefinito | [Protocollo, risultati e limiti](../../docs/sources/cortex-local-2026-11-14/REPORT.md); nuovi casi separati prima di rivalutare |
| CfC/Liquid, SSM | Non implementati o valutati | Tracce sufficienti di task e risultati; confronto con regole e classificatore semplice su split temporale |
| Timestral | Non utilizzato | Identificare implementazione/versione/licenza e task di previsione concreto; serie temporali comparabili, non singole CI |
| JEPA | Non implementato | Rappresentazione e obiettivo predittivo del software definiti, dati e test contro baseline statiche; una rappresentazione non dimostra causalità |
| Neuromorfismo/evoluzione | Non implementati | Vantaggio misurato rispetto a ricerca limitata e caching; nessuna auto-modifica di codice o policy in produzione |
| MCP/REA | Nessun server o integrazione dichiarati | Adattatore al medesimo JSON, stessi limiti e provenienza; benchmark di riuso e licenze, nessuna autorità parallela |

L'eventuale metacontrollore deve osservare esito, costo, latenza e incertezza di azioni delimitate e scegliere l'escalation, senza inventare successi. Un modello locale di piccole dimensioni può essere candidato per classificazione/reranking o patch piccole; non si dichiara equivalente a un modello cloud prima del confronto. I 16 GB vanno condivisi con sistema, IDE, browser e database: il modello locale valutato non è nel percorso predefinito, perché la controprova non ha mostrato benefici.

## Recupero storico

Nel checkout PR52 `b587102dda02c65a6b9bce63cdc38834a98d1984`, `docs/history.md` riga 465 e `docs/handoffs/confronto-programma-chat-2026-11-07.md` riportano Jev/Timestral come opzioni, non prerequisiti o runtime acquisito. La ricerca GitHub limitata a `AndreaMarro/ardesia` e `AndreaMarro/ardesia-knowledge` per Cortex trova soprattutto Cortex JS Compute Engine (CAS matematico), che non va confuso con l'infrastruttura di sviluppo richiesta ora. Questa ricerca non prova l'assenza di ulteriori documenti o conversazioni private.
