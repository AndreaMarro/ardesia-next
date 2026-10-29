# Componenti e dipendenze

Le versioni esatte e gli hash di risoluzione sono in `package-lock.json`; `npm ci` è il percorso di installazione.

| Componente | Motivo e consumer |
| --- | --- |
| React / React DOM | Una sola applicazione, viste degli stessi oggetti. Nessun framework server imposto prima del provider Core remoto. |
| Vite + plugin React | Build frontend e server locale; un solo bundle applicativo, nessun orchestratore monorepo. |
| TypeScript 5.9.3 | Tipi strict e API AST stabile per il controllo dei confini. La versione 7 non offriva l'API richiesta dal controllo; non è stata mantenuta solo perché più recente. |
| Zod | Validazione runtime dei contratti, snapshot, comandi e manifest. Un tipo TypeScript non valida dati persistiti o in ingresso. |
| KaTeX | Formule accessibili con HTML+MathML, `trust:false`, espansione limitata, nessun HTML arbitrario. Formula del pendolo in UI come consumer reale. |
| Lucide React | Icone coerenti, tree-shaking, nomi accessibili espliciti sui controlli. |
| Vitest | Test deterministici di autorizzazione, idempotenza, revisioni, scrittura atomica e proiezioni. |
| Playwright 1.56.1 | Suite browser riproducibile con Chromium 141 e viewport mobile emulata. Il download della release 1.64.1 restituiva un archivio vuoto; la release stabile fissata ha browser ufficiali scaricabili. Nessuna prova fisica dichiarata. |

Nessuna dipendenza di produzione per orchestrazione agentica, microservizi, state manager,
database ulteriore, autenticazione parallela, 3D o monetizzazione in M0. Il browser contiene
solo dati della preview personale. Un service backend e il suo adapter dati unico sono gate M3.

## Aggiornamento M3

`pg` 8.23.1 è il driver del solo database autorevole; resta nel server e negli strumenti, fuori dal bundle browser. `@types/pg` 8.23.1 aggiunge tipi per lo stesso driver. Terser 5.51.2 ottimizza la build senza modificare il plugin firmato. La CI usa PostgreSQL effimero per verificare transazioni e ripristino. Nessun SDK di autenticazione parallelo è introdotto. Le descrizioni M0 sopra restano storiche.

## Licenze

React/React DOM, Vite, TypeScript, Zod, KaTeX, Vitest e Lucide mantengono i rispettivi file di
licenza nei pacchetti installati; Playwright è Apache-2.0. I metadati effettivi delle versioni
installate vengono raccolti in `docs/sources/dependency-licenses.json` prima del commit.
Il codice nuovo è `UNLICENSED` per la repository privata. Non è una dichiarazione di licenza
open source del legacy o di autorizzazione alla ridistribuzione di contenuti di terzi.

## Confini e tradeoff

Il controllo AST legge import/export, incluso import dinamico, e impone il grafo di dipendenze
pubblico. SDK e domini non importano React. I contenuti esterni sono collegamenti citati, senza
riproduzione di figure o capitoli. Nessun codice di terzi viene scaricato ed eseguito come plugin.

Il budget M0 limita tutto il JavaScript compresso a 240 KiB. Questo è un gate misurato sul bundle,
non una certificazione di tempo di interazione, fluidità o latenza su dispositivi reali.

Fonti tecniche: [Vite](https://vite.dev/guide/), [TypeScript](https://www.typescriptlang.org/docs/),
[KaTeX security](https://katex.org/docs/security), [Playwright](https://playwright.dev/docs/intro),
[Vercel protection](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan).
