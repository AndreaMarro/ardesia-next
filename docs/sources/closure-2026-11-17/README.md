# Chiusura e recupero del 17 novembre 2026

Questo archivio conserva il lavoro rimasto locale alla fine della sessione del 14 novembre, le review completate il 17 e il generatore del kit. I report originali mantengono date, hash e limiti: un PASS sulla vecchia base non è un PASS automatico della nuova integrazione. Il manifest elenca i byte archiviati; build-info.json storico è incluso esplicitamente.

- `exam-review-filter-independent-review/review.md`: filtro integrato, 178 controlli e 48 export; patch corretta distinta dal primo tentativo.
- `workbook-import-independent-review/review.md`: import web reale di sette pagine, annotazione, riapertura; rafforzamento del rendering integrato nel test definitivo.
- `native-pdf-import-build/candidate.patch`: **candidato non integrato** del companion, base a6df552, digest 34c611d0. `git apply --check` prima di applicarlo. Non è la build stabile distribuita.
- `native-pdf-import-independent-review/review.md`: 18 suite indipendenti e replay di 8 casi lifecycle; `native-pdf-root-ui.json` delimita le prove visibili e quelle mancanti.
- `Ardesia-Quaderno-Mac-Apple-Silicon.zip`: companion stabile già integrato, firma ad hoc, non notarizzato; non importa PDF. Sorgenti e istruzioni in `native/macos-notebook`.
- `core-budget-candidate/REPORT.md`: esperimenti negativi, nessuna ottimizzazione proposta per adozione.
- `safari-native-audit/receipt.json`: verifiche Safari realmente svolte su file locali.
- `prior-ci-708.json`: CI della precedente SHA, 699 unit e 295 browser; identità dell'artefatto originale conservata.
- `launch-kit/finalize-kit.py`: genera testi non inviati soltanto dopo confronto byte per byte dello ZIP pubblico alla SHA indicata. Usare su una cartella vuota. La nuova CI/deployment e il kit finale sono collegati dalla PR di chiusura, non dedotti dai report storici.

Sono esclusi cache, dipendenze, DB, credenziali, build sperimentali e copie rigenerabili. Le patch preservano i sorgenti non integrati; gli script delle prove conservano percorsi originali da adattare quando riprodotti altrove. Nessun contenuto umano o gate prodotto è approvato da questo archivio.
