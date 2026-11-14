# Componenti e dipendenze

Le versioni esatte e gli hash di risoluzione sono in `package-lock.json`; `npm ci` è il percorso di installazione.

| Componente | Motivo e consumer |
| --- | --- |
| Preact 11.2.0 + compat ufficiale | Un solo runtime dell'interfaccia per le viste degli stessi oggetti. API React mantenute tramite alias espliciti condivisi da Vite e Vitest; nessuna riscrittura AST delle dipendenze. [Decisione e limiti](adr/0009-web-runtime.md). |
| Vite | Build frontend e server locale; trasformazione JSX automatica, senza plugin React o orchestratore monorepo. |
| TypeScript 5.9.3 | Tipi strict e API AST stabile per il controllo dei confini. La versione 7 non offriva l'API richiesta dal controllo; non è stata mantenuta solo perché più recente. |
| Zod | Validazione runtime dei contratti, snapshot, comandi e manifest. Un tipo TypeScript non valida dati persistiti o in ingresso. |
| KaTeX | Formule accessibili con HTML+MathML, `trust:false`, espansione limitata, nessun HTML arbitrario. Formula del pendolo in UI come consumer reale. |
| Lucide React | Geometrie delle 22 icone usate, fissate alla versione installata 1.63.0. Il renderer condiviso `apps/web/src/components/Icons.tsx` conserva i nodi SVG nel JavaScript conteggiato. Il pacchetto originale con React/ReactDOM resta soltanto in devDependencies per confrontare il markup di riferimento con quello Preact. |
| preact-render-to-string 6.8.2 | Solo test SSR del renderer effettivo, incluse formule scientifiche e icone. Non distribuito nel browser. |
| Vitest | Test deterministici di autorizzazione, idempotenza, revisioni, scrittura atomica e proiezioni. |
| fake-indexeddb 6.2.7 | Solo sviluppo/test: transazioni IndexedDB riproducibili per il Remote Client offline. Non distribuito nel browser; le prove reali di chiusura/riapertura sono nella suite Playwright. Licenza Apache-2.0. |
| Playwright 1.56.1 | Suite browser riproducibile con Chromium 141 e viewport mobile emulata. Il download della release 1.64.1 restituiva un archivio vuoto; la release stabile fissata ha browser ufficiali scaricabili. Nessuna prova fisica dichiarata. |

Nessuna dipendenza di produzione per orchestrazione agentica, microservizi, state manager,
database ulteriore, autenticazione parallela, 3D o monetizzazione in M0. Il browser contiene
solo dati della preview personale. Un service backend e il suo adapter dati unico sono gate M3.

## Aggiornamento M3

`pg` 8.23.1 è il driver del solo database autorevole; resta nel server e negli strumenti, fuori dal bundle browser. `@types/pg` 8.23.1 aggiunge tipi per lo stesso driver. Terser 5.51.2 ottimizza la build senza modificare il plugin firmato. La CI usa PostgreSQL effimero per verificare transazioni e ripristino. Nessun SDK di autenticazione parallelo è introdotto. Le descrizioni M0 sopra restano storiche.

La correzione P0 della coda richiede margine nel budget: la build usa `reduce_funcs:false`, `sequences:false` e `join_vars:false`, misurati insieme al renderer delle icone, senza opzioni `unsafe`, variazioni della soglia o esclusioni di asset. Le icone mantengono classi, alias, colori e nodi della versione fissata; provider Lucide e opzioni avanzate non usate dall'app non fanno parte dell'interfaccia locale. Quando si aggiorna Lucide, il confronto di markup deve passare oppure la nuova geometria va riesaminata esplicitamente. Le licenze complete delle geometrie sono conservate nel sorgente e nel file distribuito `THIRD_PARTY_NOTICES.txt`.

## Licenze

MCP Core locale aggiunge `@modelcontextprotocol/server` e `@modelcontextprotocol/core`2.4.0, Apache-2.0, nel solo bundle Node stdio. `@modelcontextprotocol/client`2.4.0 è dev-only per il consumer esterno di verifica. Si riusa Zod4.6.7. Nessuno di questi pacchetti entra nel bundle browser o nella Function; build-info e notices del CLI includono hash e licenze effettive. [Contratto](../packages/mcp-core/README.md).

Preact, React/React DOM, Vite, TypeScript, Zod, KaTeX, Vitest e Lucide mantengono i rispettivi file di
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

## Runtime programmabile opzionale

QuickJS/Emscripten0.32.0 (MIT) viene distribuito come Worker JS + WASM same-origin con licenze complete QuickJS e wrapper. Nessun bridge nativo o loader è installato nel guest. La copia offline può precaricare host UI ed esempio, mentre interprete/Worker/WASM si scaricano soltanto ad avvio richiesto. La soglia storica240KiB per tutto il JS resta riportata come confronto; [ADR0017](adr/0017-programmable-creator.md) introduce un budget separato320KiB gzip/1MiB raw per la nuova capacità. Il nucleo e tutti gli asset preesistenti restano nel budget240KiB. Non è una misura di latenza Pencil.

## PDF e immagini — incremento materiali

`pdfjs-dist`6.5.438 è fissato nel lockfile: engine e worker ufficiali compatibili `legacy`, stessi CMap/font/WASM distribuiti localmente. Apache-2.0, core-js3.51.0 MIT incluso dal donor; notices del pacchetto e supporti conservate. Si usa il renderer canvas, non il viewer o scripting manager. Il bundle moderno falliva nel Chromium fissato su Map.getOrInsertComputed: fallimento originale e scelta compatibile documentati in [ADR0020](adr/0020-original-materials.md).

Policy risorsev3: tetti Core272KiB e iniziale240KiB gzip, runtime programmabile320KiB gzip/1MiB raw invariati; nuovo PDF3MiB gzip/6MiB raw include engine, worker.mjs, CMap/font/WASM. Il confronto storico all-non-program-assets include Core+PDF; vecchia soglia240KiB non passa. Nessuna riclassificazione dei precedenti asset. Sono misure di distribuzione, non latenza/memoria su iPad.
