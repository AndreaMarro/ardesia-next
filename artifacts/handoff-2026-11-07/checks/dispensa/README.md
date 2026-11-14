# Verifiche — dispensa PDF e LaTeX/TikZ

Percorso locale: lezione confermata → dispensa → stampa/PDF → sorgente LaTeX/TikZ modificabile. [Guida](../../DISPENSA.md). Sorgente finale `ef57bcc96c33bd0ff4114ef479a46b60149a2e80992f49104adbb74de55dfd11`, base `f7adf5db02913e25fbab0b1da071f650b4f78676`, branch `codex/lavagna-continuity-20261107`. Nessun commit o deploy remoto.

| Prova | Esito | Evidenza originale |
| --- | --- | --- |
| Verify | 8/8 PASS | [Report](verification.json), [log](verify.log) |
| Unit e integrazione | 426/426 PASS | [Report](unit.json) |
| Browser Chromium | 125/125 PASS, zero skipped/fail/flaky | [Evidenza](browser-evidence.json), [report](e2e.json), [log](browser.log) |
| Runtime server / MCP | 5/5 e 9/9 PASS | [Server](server-runtime.json), [MCP](mcp-runtime.json) |
| JavaScript gzip, worker incluso | 221516/245760 byte | [Budget](budget.json) |
| Compilazione dei download LaTeX | 2/2 riuscite | [Toolchain](tex-toolchain.json), [desktop](tex-desktop/compiler.log), [mobile](tex-mobile/compiler.log) |
| PDF browser / offline / TeX | 6 / 2 / 5 pagine per viewport | [Ispezione](pdf-inspection.json), PDF e raster in questa cartella |
| Review indipendente | Favorevole nel perimetro locale, nessun P1/P2 residuo | [Rapporto](review-indipendente.md) |
| Stato canonico | Verifiche PASS; prodotto NOT_COMPLETE; deploy NOT_VERIFIED_FOR_CURRENT_COMMIT | [Report](status.json), [log](status.log) |

## Ambiente e copertura

Node 24.22.1, PostgreSQL 16 locale, Playwright 1.56.1 e Chromium. Desktop 1440×960; mobile Pixel 7 emulato 412×839, scala 2.625. Browser plugin non disponibile: usato il workflow Playwright già configurato. Mac manuale separato: browser integrato di Codex, 1280×720. Origine dei test `http://127.0.0.1:4173`, preview persistente `http://127.0.0.1:4180/`, database distinti. Nessuna fixture di persone reali.

I sei nuovi casi browser coprono apertura con bozza non salvata, fonte storica diversa dalla corrente, lab statico senza nuovi worker, pressione, formula estesa, download reale, stampa A4, ritorno alla bozza, lavoro privato dello studente escluso, chiusura dopo revoca osservata, riapertura a freddo offline e tratti pending conservati. La suite completa riesegue anche lavagna, offline, audio/replay, feedback e lifecycle dei plugin.

Il percorso manuale finale è **lezione assegnata → Dispensa → revisione/provenienza → avviso Unicode → chiusura → stesso lavoro personale**, con identità build letta dal browser. [Osservazioni Mac](manuale-mac.json). Il vecchio service worker serviva la shell precedente: ricaricare e chiudere le schede dell’origin ha attivato quella finale, senza cancellazione di dati.

| Controllo UI | Esito osservato |
| --- | --- |
| Identità pagina | URL locale, titolo Ardesia e build-info corrispondenti |
| Pagina non vuota | Lezione assegnata e dispensa della revisione 3 presenti |
| Overlay del framework | Nessuno osservato |
| Console | Nessun errore o warning applicativo nel flusso manuale; collector principale E2E pulito |
| Layout | Nessun overflow orizzontale nel controllo; schermata Mac e screenshot mobile ispezionati |
| Interazione | Apertura, avviso e ritorno conservano revisione del lavoro 5 e due tentativi |

Le immagini CUA sono state osservate nel tool. I PNG salvati qui sono screenshot e raster prodotti automaticamente, non catture manuali CUA. La selezione iniziale del riepilogo avvisi per ruolo non trovava il nodo; il testo effettivamente osservato ha consentito di espanderlo. Nessuna modifica dell’app per questo limite del tool.

## PDF e compilazione reale

[PDF desktop](desktop-handout.pdf) · [PDF mobile](mobile-handout.pdf) · [PDF offline desktop](desktop-offline-handout.pdf) · [PDF offline mobile](mobile-offline-handout.pdf) · [LaTeX desktop](desktop-lesson.tex) · [LaTeX mobile](mobile-lesson.tex).

I PDF provengono dalla stampa della pagina effettiva (`page.pdf`, media print, A4 CSS). Il pulsante Stampa è verificato con uno stub di `window.print`, separatamente dalla produzione dei PDF. Il dialogo di stampa OS non è stato collaudato. Poppler legge pagine e testo; nei PDF completi sono presenti `FINE DELLA SPIEGAZIONE`, `FINE FORMULA` e la fonte OpenStax esatta, mentre la bozza privata è assente. I raster controllati includono prima pagina, tratto con pressione, fine del testo, provenienza finale e copia offline. Le formule estreme vengono ridotte: integrità del contenuto non implica leggibilità a dimensione normale di una formula arbitrariamente lunga.

Tectonic 0.17.0, release ufficiale aarch64, compila **i file scaricati dalla UI finale** con `--untrusted --keep-logs`. Binario, archivio e URL sono identificati in [tex-toolchain.json](tex-toolchain.json); cache confinata a `work/tex-toolchain/cache`, fuori dal runtime dell’app. [PDF compilato desktop](tex-desktop/desktop-lesson.pdf) e [mobile](tex-mobile/mobile-lesson.pdf): 5 pagine ciascuno. Nessun overfull; due underfull in metadati per documento nell’ultimo passaggio TeX. I log conservano anche il primo passaggio e il marker `ARDESIA_MATH_SCALED`. Nessuna dipendenza TeX aggiunta all’app.

Il primo collector PDF extracodice cercava erroneamente il notice offline dentro la pagina stampata: [fallimento conservato](pdf-collector-first.txt). L’app mostra data/limite della copia offline a schermo; il PDF conserva revisione e data documento, senza la data di acquisizione cache. Il collector corretto verifica questi dati effettivamente previsti, formula e fonte. Nessun cambiamento sorgente o nuova esecuzione della suite per correggere quella sola aspettativa del collector.

## Tentativi precedenti

- [attempt-01](attempt-01/): Verify positivo, mirato browser **2/6**. Distinti errori collector (JSON TeX con separatori di interruzione, transizione/scroll offline non attesi) dal difetto reale del comando coperto dall’inspector mobile. Il comando contestuale è ora accessibile. Prima compilazione reale fallita per riga vuota in display TeX, log conservato.
- [attempt-02](attempt-02/): mirato **6/6**, ma PDF desktop troncava la formula e il tratto si sovrapponeva alla fonte. Il controllo testo/raster ha trovato i difetti: collisione CSS fra sezione ink e SVG, misura della formula basata sul viewport. La compilazione TeX intermedia passava, ma non viene trasferita alla sorgente finale.
- [attempt-03](attempt-03/): mirato **6/6**, PDF corretti a 6 pagine e marker presenti. Sorgente intermedia, precedente all’ultimo test di riapertura offline e ai documenti finali. Non sostituisce le 125 prove finali.

## Integrità e limiti

[Esito derivato](../esito.json) · [Manifest](manifest.json) · [Hash sorgenti](source-files.json) · [Integrità legacy](legacy-integrity.json). Il sorgente rimane congelato dopo Verify e suite finale; i documenti di consegna sono esterni al checkout. Patch completa controllata con `git diff --check` e `git apply --check --reverse`.

Non cambia lo schema Core né il ledger: LessonOS proietta, i consumer risolvono solo dati autorizzati, i lab restano statici. L’export non è un roundtrip di backup e non chiude `PORTABILITY-RECOVERY`. La revoca ferma l’accesso osservato nell’app, non richiama file già scaricati. Le simulazioni, i contenuti DRAFT e le review umane mantengono la propria identità e i propri limiti.

Safari, iPad/Apple Pencil fisici, app native e stampa OS restano NOT_RUN. Collaborazione generale, ASR, corsi completi, Creator universale, tutor economico, pagamenti e marketplace commerciale rimangono nella [mappa prodotto](../../ardesia-next/docs/product-map.md). La review riguarda solo l’incremento locale. Nessun push, merge, deploy o cambiamento di scheduler/cursore.

![Dispensa desktop, screenshot Playwright finale](desktop-handout.png)

![Dispensa mobile emulata, screenshot Playwright finale](mobile-handout.png)
