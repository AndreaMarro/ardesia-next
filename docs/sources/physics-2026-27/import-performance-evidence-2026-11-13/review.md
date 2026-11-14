# Review indipendente: indice delle versioni extension

**Nessun P1/P2 introdotto individuato nella lettura.** È una review statica, non un PASS dei test o del benchmark. Il nuovo caso di fallimento su `replace-object` v2 è incluso. Cortex resta sospeso; questo incarico riguarda soltanto Core/Fisica.

Base: `7efaa14844fd835b37c51eb6a153bc5a53a05595`. Sono stati letti il diff grezzo dei tre file modificati e il nuovo benchmark non ancora tracciato. Nessuna modifica al repository, a Git, servizi o cursori. `humanApproval: false`.

## Invarianti controllate

| Criterio | Evidenza e conclusione statica |
|---|---|
| Indice derivato per istanza | `createCore` costruisce una nuova Map dalla validazione delle definizioni correnti e storiche. Non entra nello snapshot e non viene esposto dal servizio. Aperture che falliscono i validatori successivi non restituiscono il Core. |
| Digest di ogni nuovo payload | `validateExtensionUse` ricalcola sempre il digest prima del lookup. Nessuna scorciatoia per digest già conosciuti. I retry idempotenti conservano il controllo del fingerprint esistente. |
| Collisioni e rimozione | La chiave typeId@version è non ambigua per la grammatica attuale. Nessuna eviction; la ricostruzione legge anche object/previous della cronologia dopo remove. Definizioni con stesso type/version e digest diverso restano vietate. |
| Commit e rollback | `await commit(next)` precede `Map.set`; commit aggiorna `state` solo dopo write riuscita. Un errore impedisce sia stato sia prenotazione della versione. Il test aggiunto controlla add fallito e replace v2 fallito seguiti da una definizione alternativa legittima. |
| Serializzazione e isolamento | Una coda per tutte le entry point del Core; set sincrono prima della risoluzione dell’operazione. Input clonato prima dell’accodamento; Map locale alla closure, non globale. Il nuovo test concorrente usa le revisioni attese per verificare la collisione dopo il primo commit. |
| Compatibilità | Nessun campo persistito, contratto, incremento di revisione, trasformazione degli oggetti o algoritmo del fingerprint è cambiato. La verifica dinamica dell’identità byte-per-byte è demandata al benchmark e ai test del root, non dichiarata eseguita qui. |

## Altri percorsi di scrittura

La ricerca dei punti che scrivono `document.objects` e introducono documenti individua add/replace nel Core e le transizioni plugin. Add/replace coprono l’unica introduzione o sostituzione delle definizioni extension; move mantiene i dati, remove lascia gli oggetti nella storia. Le transizioni plugin modificano solo `type === lab`, e la validazione della storia rifiuta extension in tali transizioni. I notebook creano documenti vuoti; corso, tutor e learning gestiscono riferimenti o record separati. Non ho individuato un percorso corrente che introduca una definizione senza aggiornare l’indice.

Il cambiamento di definizione durante replace aggiunge lineage ma lascia invariati definition e definitionDigest rispetto al payload validato; riservare la versione del comando è quindi coerente con l’oggetto effettivamente committato.

## Test letti, non eseguiti

I tre nuovi test sono sensati: rollback di add e replace v2 con controprova mediante definizione alternativa; indipendenza di un secondo Core; collisioni dopo rimozione sia in memoria sia dopo riapertura; payload alterato che riusa un digest noto; ordine di due comandi accodati e successivo comando valido. Le asserzioni controllano snapshot e storage invariati dopo fallimento, oggetti e ricevute finali. I casi esistenti coprono versionamento, cronologia corrotta, renderer opachi, stato e permessi, lineage e retry idempotente.

Ho eseguito soltanto la verifica leggera `git diff --check`, completata senza errori. Test applicativi, benchmark e browser: **NOT_RUN_BY_REVIEWER**. L’esito effettivo resta quello degli artefatti del root legati agli hash sotto.

## Benchmark: valido come confronto sintetico circoscritto

Misura apertura Core e un comando per richiesta su MemoryStorage con il pacchetto C2; un warmup e tre misure per implementazione, ordine alternato. Tiene separati openMs/executeMs/totalMs, controlla le revisioni, pretende lo stesso SHA-256 dell’intero snapshot serializzato fra le otto esecuzioni, riapre e prova retry idempotenti dopo gli inserimenti. Clock e generatore ID deterministici rendono significativo il confronto delle ricevute/fingerprint. Le verifiche successive alla misura non vengono incluse nel tempo dichiarato.

Il commento iniziale e il report escludono esplicitamente HTTP, PostgreSQL e rendering browser e non dichiarano una velocità end-to-end. Non ho letto un risultato concluso e non riporto percentuali. I limiti da mantenere nella consegna sono:

- Il risultato riguarda C2 e tre campioni; non dimostra il guadagno su tutti i corsi, workspace molto grandi o hardware Mac.
- Il digest identifica il modulo baseline, ma il suo legame al commit precedente dipende dalla ricevuta di cattura conservata dal root. Lo script da solo non autentica il commit di provenienza.
- Gli hash dei sorgenti candidate sono acquisiti a fine misura, mentre il bundle è compilato all’inizio: conservare i sorgenti invariati durante la misura. Il digest del bundle distingue comunque i byte eseguiti. Non ho rilevato una divergenza reale.
- La patch evita la seconda scansione della storia sul comando; apertura, validazione, clonazione e scrittura dell’intero snapshot restano. Non promettere che elimina tutti i costi dell’importazione.

La garanzia di rollback continua a dipendere dal contratto di write atomica dell’adapter. Il test inietta il fallimento prima di scrivere; non prova recovery da un adapter che persiste e poi rigetta. L’indice non crea un lock fra Core simultanei sullo stesso storage: restano le precondizioni esistenti di single writer/transazione. Questi sono limiti preesistenti, non regressioni introdotte dal diff.

## File esatti oggetto della review

| File | SHA-256 |
|---|---|
| `packages/core/src/index.ts` | `641070e486f0ae92d2f7afa21da6956e5e9752a5f82b4cf5f45073ff752f0471` |
| `packages/core/src/extensions.ts` | `c120a22e5b75e05dc381efa023bffd6dc1f308b8f338f7875c17b4d93f33fc6a` |
| `packages/core/src/extensions.test.ts` | `41d46009d3198209ed12dd4421938ea874554feef3d4effd74a2a37d5b059a49` |
| `tools/benchmark-physics-import.mjs` | `be17a8b5523eaf28e143ef1f3c15f4c56900771435f4ba955b8d06370ec53152` |

Il JSON affiancato contiene hash anche dei file di contesto, hash del diff grezzo, criteri ed esecuzioni effettive. Non è richiesta una modifica bloccante sulla base di questa lettura; restano necessari i controlli dinamici del root prima di una conclusione di consegna.
