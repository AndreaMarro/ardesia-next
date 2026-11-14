# Revisione indipendente — navigazione esercizi

Base confrontata: `937937788aa0abe8ae4adbece932b1a3baedb034`. Revisione statica del diff locale, del consumer reale e dei dati usati dal test. **Nessun difetto concreto P1/P2 rilevato nel perimetro.** Non è attestazione di esecuzione browser o accettazione del rilascio.

## Evidenze per requisito

- **Soluzioni:** `CourseMaterials.tsx:17` costruisce l’indice soltanto da titolo, prompt e obiettivi. Non include `solution` o provenienza. Il rendering della soluzione resta subordinato a `openSolutions.includes(object.id)` e il filtro non chiama `onReveal`. Una soluzione precedentemente aperta può restare aperta dopo aver tolto un filtro: è coerente con l’azione esplicita già compiuta, non una rivelazione nuova.
- **Conservazione del ragionamento:** search/kind/level appartengono soltanto a `CourseMaterials`. `CourseStudio` conserva separatamente answer, answerContext e questionContext. Rimuovere una domanda dall’elenco non smonta il textarea né cambia il riferimento della domanda selezionata. La selezione di un’altra domanda continua a passare dal guard `navigate`, che richiede di conservare o scartare la risposta già scritta. Nessun nuovo comando Core, scrittura di storage o modifica dei tentativi compare negli handler dei filtri.
- **Transitorietà e reset:** valori iniziali vuoti; `useEffect` azzera tutti e tre quando cambia id o revisione del documento. Nel consumer il cambio unità/edizione/percorso azzera inoltre `material`, smontando il componente. La riapertura della stessa lezione e revisione senza smontaggio conserva i filtri, mentre il reload li perde: comportamento coerente con filtri temporanei. La ricerca non cambia i documenti, le revisioni o la selezione persistita del corso.
- **Dati e diagnosi:** livelli e opzioni provengono dalle stringhe originali degli oggetti, senza convertirle o attribuire nuove difficoltà. Le tre tipologie corrispondono a quelle distribuite (`practice`, `original`, `assessment`). Il contatore indica risultati di ricerca, non completamento o padronanza; non sono introdotti voti, suggerimenti diagnostici inventati o cambi allo stato DRAFT.
- **Tastiera e layout, da sorgente:** controlli nativi search/select con etichette annidate; pulsante reset nativo; riepilogo con `role=status`; focus visibile e altezza minima 44 px ereditati dal CSS esistente. La griglia nuova usa una larghezza minima limitata al 100% del contenitore, con colonne adattabili. Nessun listener che intercetti Tab, frecce o Enter è stato aggiunto. Questo controllo del codice non sostituisce una prova di tastiera o layout mobile reale.

## Test e dati confrontati

Letto il nuovo percorso E2E e preservate le precedenti asserzioni scientifiche, sul Core, sul salvataggio e sul recupero del tentativo. L’aggiunta verifica la combinazione tipo+livello+testo, accenti e maiuscole, zero risultati, reset, mancata indicizzazione di una stringa presente soltanto nella soluzione, conservazione del testo già scritto quando la domanda viene nascosta e successivo salvataggio con l’id originale. Verifica inoltre i filtri vuoti dopo reload e riapertura materiali; nella versione finale imposta nuovamente tutti i filtri, cambia realmente dalla quinta alla prima unità, attende la nuova unità corrente e verifica il reset dopo l’apertura dei nuovi materiali. La sequenza Home/ArrowDown/Tab sul tipo richiede inoltre valore `original` e focus passato al controllo di livello. La configurazione include desktop Chromium e mobile Chromium; i timeout/retry e il comportamento del prodotto non sono modificati dal delta.

Controllo indipendente dei dati letti dal test: U5-05 contiene 29 domande (17 esercizi, 4 originali, 8 verifiche); gli originali difficili sono 2. Il motore impossibile selezionato dal testo «puo FUNZIONARE» è presente nei dati. `COP=240/60=4` compare nella soluzione del frigorifero e non nel suo titolo/prompt/obiettivi: il controllo di non indicizzazione è quindi significativo, non vacuo.

I precedenti limiti sul cambio di lezione e sul percorso tastiera sono affrontati nel test finale, con azioni e asserzioni esplicite; l’esito browser resta da acquisire. Non è esercitato direttamente il caso dello stesso id documento con una revisione diversa, che è coperto staticamente dalle dipendenze dell’effetto. Un’uguaglianza Core prima/dopo soli filtri renderebbe esplicita anche l’assenza di scritture, attualmente evidente dalla lettura degli handler e dalla conservazione del flusso esistente.

## Identificazione dei file principali

| File | SHA-256 |
|---|---|
| CourseMaterials.tsx | `578ff80b584e4691622974f6df49fa4eac83fe4678ddd9b8002e9768a1de94fe` |
| courses.css | `f8bd837e7892b49b64684de0dcc898f9033b3c9034979ea487b9913b251f8ccd` |
| physics-courses.spec.ts | `8240b291ad1e8607f3423d1012cb0a31d7bd5312997f5af3c9e5d218eb3a374c` |
| CourseStudio.tsx, consumer invariato | `b7999d66e066d7f25a516b5efa59cbb04d616661b90b7f2ae4408892b52df40b` |

Letti anche il documento `practice-navigation-2026-11-13.md` e la nuova voce in `docs/history.md`: descrivono il perimetro osservato, mantengono DRAFT, non anticipano PASS e non attribuiscono benchmark d’importazione alle precedenti durate E2E. Il JSON associato contiene gli hash degli altri file letti e il riscontro dei dati. Sono stati letti l’AGENTS di `apps/web` e le regole root già acquisite; non esiste un `e2e/AGENTS.md` in questo checkout.

## Limiti e interventi

Non ho eseguito browser, screen reader, dispositivi fisici, servizi, Verify o test condivisi. Nessun file condiviso è stato modificato; gli unici artefatti prodotti sono questo rapporto e `/tmp/ardesia-practice-navigation-review.json`. Nessun push, pubblicazione, scheduler o lavoro su Cortex. La revisione non autorizza claims di accessibilità completa, validazione scientifica umana o funzionalità commerciale conclusa.

## Identità del commit verificata

Verificato il commit `5ee09d3276af94161a0c20a8cb19414575a37a79`: tutti i 12 hash SHA-256 registrati nel JSON corrispondono ai contenuti letti direttamente da questa revisione Git tramite `git show`. Aggiunto `verifiedCommit` alla ricevuta; `observedHead` precedente è conservato come dato storico. Nessuna nuova esecuzione di test o modifica dei criteri di revisione.
