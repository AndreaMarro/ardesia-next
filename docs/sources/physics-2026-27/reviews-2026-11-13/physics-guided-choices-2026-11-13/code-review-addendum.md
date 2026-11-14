# Addendum indipendente — import del test guidato

Delta verificato `24fc875e8d05eddcdc3240f4d1fbf5641073bd0f` → `dd98a8c366a46e493ae4a8ba9de7d7b4311d1006`. Il root ha già committato la correzione durante questa lettura: l’addendum è quindi legato a questa head esatta. Nessun P1/P2 aperto rilevato nel delta.

Il diff contiene soltanto la sostituzione dell’import di compileExpression nel test e il paragrafo di resoconto del fallimento. `@ardesia/plugin-host` risolve, tramite exports del package, a `src/index.ts`; la prima riga di quel file riesporta direttamente `compileExpression` da `./composition`. Il subpath precedente risolveva a `src/composition.ts`. Non vi sono wrapper o implementazioni alternative: il test continua a usare la stessa funzione.

Il checker ammette la dipendenza web→plugin-host ma consente come subpath Host soltanto `/program`; non deriva la lista dei subpath ammessi dagli exports del package. L’import dalla radice soddisfa questa politica senza ampliarla. La stessa forma è presente nei test di pressione, condensatore, interferenza e macchina termica letti nel checkout. Checker, package exports, funzione e runtime non sono modificati dal commit.

Letti gli artefatti originali `initial-boundary-24fc875/verification.json` e il log: config-source e types risultano passati, boundaries fallisce precisamente su `@ardesia/plugin-host/composition`, e il riepilogo complessivo è `passed:false`. Il dossier conserva questo esito e non anticipa il PASS della nuova Verify.

Confronto delle impronte della ricevuta precedente: **19 dei 20 file già esaminati sono identici**, inclusi modello, widget, CSS, generatore, dati distribuiti, E2E e consumer. Il ventesimo è il solo test con import corretto. Tutte le asserzioni, le azioni, i cicli di verifica e i timeout del test rimangono invariati.

Hash finali:

- `guided-choices.test.ts`: `6539006647c99ebd5127df8e058c12347e03d2e88ea2720623e00166909d97b0`.
- `guided-choices-2026-11-13.md`: `c73824ad174df351bb2a53130b211263f60114a6786006b640d094898d4a1eaa`.
- `packages/plugin-host/src/index.ts`: `4600925aebf419c411799dc532ffa4b18fc0b8f8bed2b67caf5b18f831c4c6a0`.
- `packages/plugin-host/src/composition.ts`: `2597cdd118ad126b95ef96f318e94195a3ccf9ca282e21c3a93ec4bf7f4b5fa4`.
- `tools/check-boundaries.mjs`: `a938dcf8c6a9eee5cf0a0eee5994f48e360bf80e3d5f33c841f6df924a9d83ca`.

Il JSON contiene tutti gli hash finali e quelli degli artefatti originali. Nessuna esecuzione di test o servizio, nessuna scrittura condivisa: questa è una verifica statica del binding e della politica. Il risultato della nuova Verify e dell’E2E deve provenire dai rispettivi report effettivi.
