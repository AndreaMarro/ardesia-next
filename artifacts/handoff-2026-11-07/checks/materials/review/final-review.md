# Review indipendente — materiali originali

**PASS locale delimitato** sul sorgente `290f597d24ea4ef92769faab9b309069ed9e50dd2fd9f8b778c460e186b12c82`:429 file, digest confermato indipendentemente. Nessun finding implementativo aperto nel perimetro esaminato. Baseline:`81eec80ac69a13a6a13064fca63e780330a6e12de5e6881393c8d142f38b79dd` (408 file); 72 file modificati/aggiunti.

La review è del contesto non autore `/root/board_review`; root `/root` è l’unico writer. Il commit riportato dalle prove, `f7adf5db02913e25fbab0b1da071f650b4f78676`, è HEAD base: i byte del candidato non committato sono identificati dal sourceDigest. Pubblicazione e CI del futuro commit restano fatti separati, senza rietichettare questi report.

| Evidenza finale | Esito letto e verificato |
| --- | --- |
| Verify | 8/8 controlli, sul digest esatto |
| Unitari | 552/552, zero fallimenti/skip/todo; digest raw collegato a Verify |
| Server distribuito | 5/5, Node24.22.1/PostgreSQL isolato; hash funzione corrispondente |
| MCP | 15/15, client SDK ufficiale2.4.0→stdio→HTTP/PostgreSQL; hash artefatto corrispondente |
| Browser completo | 191/191, tutti primo tentativo, zero skip/flaky/retry; reportDigest verificato |
| Materiali browser | 5 scenari×desktop/mobile:10/10 nella regressione completa |
| REA consumer | 21 passi per profilo, nuove catture sul candidato finale,7 hash asset riscontrati |

## Rilievi e correzioni

MATERIAL-01…07: cleanup PDF tardivo, bozza non durevole, parser senza limite globale, raster da metadata, copia offline incompleta, coordinate focus/connessioni e bozza definitivamente rifiutata sono affrontati. I test verificano identità asset/pagine dopo risposta persa, account/CAS, abbandono dopo reload e nuovo import, storage failure e cold-open della lezione mai aperta, focus ink dopo+5010 e endpoint connessione.

MATERIAL-08 (P2) è emerso nel primo browser completo: il resize alla chiusura delle proprietà ripeteva il focus e annullava PageDown. La run su `77ba75ec…` resta **190 PASS/1 FAIL** in `work/materials-full-first`. Root ha corretto il consumo del focus per sola selezione. Le asserzioni spatial-board sono rimaste invariate; desktop e mobile ora passano nel completo191/191.

Lifecycle e geometria sono verificati staticamente più test applicabili. Il helper della coda prova una decodifica attiva e cancellazione in coda; il raster prova dimensioni avverse. Non si dichiara un corpus di PDF enormi o una prova strumentata di ogni race del Blob.

## Risorse, diritti e REA

Budgetv3 PASS: iniziale206117B gzip, Core276431B, programma292123B, PDF2590788B gzip/5178516B raw. Tutti216asset previsti sono contabilizzati e i byte raw/gzip sono stati ricalcolati senza differenze. Confronto storico Core+PDF:2867219B, vecchia soglia240KiB **FAIL conservato**; nessuna falsa continuità di metrica.

Quindici blob donor verificati tramite SHA256 e Git blob SHA; estrazione inline verificata;200 supporti PDF identici al package installato. Versione/lock e notices Apache/MIT e delle risorse sono presenti. Il raw REA dichiara identità artefatto indisponibile: il binding viene dalla lettura HTTP separata del root, riscontrata con i sette hash locali, non da una certificazione REA.

REA conserva un401 al passo0 prima del login e `download-cancelled`; non è console-zero né prova di download riuscito. Originali e annotazioni sono seeded; REA muove la pagina e naviga, mentre upload, byte scaricati e nuovi tratti sono provati separatamente da Playwright. Le catture precedenti e i due tentativi falliti sono conservati.

## Documentazione e confini

Handoff, ADR0020, storico, mappa e notices distinguono correttamente sorgente, procedura, CI, merge, deploy e accettazione. La ricerca nelle chat private è attribuita al ricercatore: questo reviewer non ne certifica una nuova lettura integrale. Il prodotto resta **NOT_COMPLETE** e nessun deploy della nuova sorgente è attestato.

Restano fuori dall’approvazione: native Mac/iPad, Safari/Pencil fisica, accessibilità completa, grandi corpora/prestazioni e sicurezza completa decoder, OCR, erasure/GC generale, collaborazione/sync completo, host AI commerciali, approvazione scientifica/editoriale umana e completamento del programma.

Nessun test, servizio, installazione, modifica sorgenti/index, operazione Git o remota svolti dal reviewer. Le prove del root sono state lette e collegate ai byte; scritti soltanto report e diff autorizzati. Il JSON conserva hash, scenari, esiti precedenti e limiti dettagliati.
