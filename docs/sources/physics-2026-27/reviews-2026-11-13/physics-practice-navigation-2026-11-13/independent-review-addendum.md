# Addendum indipendente — locator dei filtri

Delta esaminato: `5ee09d3276af94161a0c20a8cb19414575a37a79` → `70af28ce5f59365fd540bafbb58ab3ce6849d680`. **Nessun P1/P2 aperto rilevato nella correzione.** I due locator ora selezionano il ruolo nativo `combobox` con il nome accessibile esatto, coerentemente con l’albero accessibile registrato dal browser. UI e consumer sono immutati.

## Fallimento originale conservato

Letti `e2e.json`, `run.log`, `browser-evidence.json`, `selector-reproduction.json` e l’error-context della cartella `artifacts/physics-practice-navigation-2026-11-13/initial-browser-5ee09d3`.

La prima prova C3 desktop supera le verifiche precedenti del laboratorio e va in timeout a `kind.focus()` (riga 43), aspettando `getByLabel('Tipo di domanda', {exact:true})`. Non raggiunge quindi le successive asserzioni sui filtri. L’error-context mostra effettivamente `combobox "Tipo di domanda"` e `combobox "Livello dichiarato"`, con le rispettive opzioni: la diagnosi riguarda il criterio del locator, non l’assenza del controllo nella UI.

La riproduzione minima conservata contiene il medesimo pattern label/select/opzioni e riporta zero corrispondenze con il locator label esatto e una col ruolo/nome. Ho letto questa prova, senza rieseguirla.

Esito della sessione originale: **0 passati, 1 fallito, 1 interrotto, 2 non eseguiti**. Il caso C2 desktop ha risultato `interrupted`; il root ne riferisce l’interruzione esplicita. Il riepilogo JSON aggrega interrotto e non eseguiti sotto `skipped=3`, ma questo non costituisce un PASS né dimostra l’assenza di altri problemi C2. Le due prove mobile non hanno risultati di esecuzione.

## Delta e integrità delle prove

Il diff Git comprende soltanto una riga del test con due sostituzioni `getByLabel` → `getByRole('combobox', {name, exact:true})` e il paragrafo documentale che conserva la diagnosi e gli esiti iniziali. Ambito della regione, nomi esatti, navigazione Home/ArrowDown/Tab, focus, conteggi, ricerca, confronto degli aiuti e dei tentativi, reset, cambio unità e controlli scientifici rimangono identici. Nessun timeout, retry, skip, asserzione o dato di prodotto è modificato.

Il nuovo locator seleziona il controllo tramite la semantica accessibile realmente osservata. Non forza il focus, non usa selettori arbitrari per aggirare un controllo mancante e non elimina alcuna interazione da verificare. Il dossier non anticipa il PASS della nuova esecuzione.

## Hash della revisione finale

- Test `e2e/physics-courses.spec.ts`: `519876bc26e4c9ace36f56e936cc1e921537638e175c52f343a241052f5a36e5`.
- Dossier `practice-navigation-2026-11-13.md`: `fa03802d235bfa77bba98a509f55bf98ca4230da776d6da5057649a9ff198d36`.
- UI `CourseMaterials.tsx`: `578ff80b584e4691622974f6df49fa4eac83fe4678ddd9b8002e9768a1de94fe`.
- Stile `courses.css`: `f8bd837e7892b49b64684de0dcc898f9033b3c9034979ea487b9913b251f8ccd`.
- Consumer `CourseStudio.tsx`: `b7999d66e066d7f25a516b5efa59cbb04d616661b90b7f2ae4408892b52df40b`.

Gli hash sono calcolati direttamente dai blob del commit finale. Dei 12 file della ricevuta precedente, 10 sono identici e soltanto i due file dichiarati cambiano. Il JSON dell’addendum registra tutti gli hash finali e quelli degli artefatti originali. La ricevuta precedente rimane associata al suo `verifiedCommit`; questo addendum associa la correzione a `70af28ce5f59365fd540bafbb58ab3ce6849d680`.

Nessuna esecuzione di test, servizio o browser da parte di questo revisore, nessuna scrittura condivisa. Verify e nuova sessione E2E restano da valutare sui loro risultati effettivi.
