# ADR 0014 — Dispensa dalla lezione salvata

> Esteso da [ADR0023](0023-complete-handout.md): il documento sorgente conserva l’ordine originale, il piano deriva l’ordine di lettura; materiali, ZIP e builder locale sono ora implementati. I limiti sotto descrivono la prima versione.

Preparazione locale isolata del mandato diretto del 7 novembre 2026: lezione → dispensa leggibile → stampa/PDF → sorgente LaTeX/TikZ modificabile. Consumer di portabilità della mappa prodotto; non chiude il roundtrip di `PORTABILITY-RECOVERY`. La coda e il cursore condivisi non cambiano. Le chat e le analisi REA già lette restano attribuite nelle fonti del precedente incremento.

## Un documento, più uscite

`projectHandout` in LessonOS è una proiezione pura del `LessonDocument` confermato e delle revisioni esatte delle fonti. Convalida e clona i dati; ordina gli oggetti per y/x/ID, conservando identità, revisione, stato, contenuto, collegamenti e provenienza. Non aggiunge un formato persistente al Core né modifica schema, eventi, ricevute o database.

Il docente prepara la revisione corrente tramite la facciata Core autorizzata. Le fonti storiche sono risolte per ID+revisione tramite `getObjectRevision`, incluse quelle rimosse dal documento. Il frame audio può contenere ink parziale: il comando dispensa è disabilitato durante replay e registrazione. Non si esporta `viewDocument` come falsa revisione salvata.

Lo studente esporta solo il documento assegnato: non l’overlay dei propri laboratori, note, tentativi o feedback. Una revoca osservata o una nuova revisione smonta la dispensa. La copia offline usa esclusivamente i documenti confermati dell’ultima copia, con data e limite visibili; l’ink pending resta nella recovery. Studente e offline non ricevono accesso allo storico generale: una fonte esatta mancante è dichiarata, mai sostituita dalla latest. Riferimenti ulteriori nella provenienza delle fonti sono conservati, senza pretendere di averne risolto tutta la catena.

La dispensa è congelata all’apertura. Aprirla non scarta né salva gli editor; il comando è disponibile anche nell’inspector sui viewport piccoli. Il consumer non chiama `exportPersonal` e non esegue `LabContent`: lo stato del laboratorio e la sua identità sono dati statici. Un file scaricato è sotto il controllo dell’utente e non può essere richiamato da una revoca successiva.

## PDF e LaTeX/TikZ

La stampa usa il browser, senza provider o compilatore remoto. Un consumer dedicato attende i font, adatta formule larghe, impagina un A4 e conserva il contorno dei tratti con pressione. CSS di stampa e misura delle formule usano la stessa larghezza di 174 mm (margini 18 mm). La disposizione spaziale viene trasformata in ordine di lettura; collegamenti e metadati rimangono in appendice. Gli avvisi dichiarano le trasformazioni e ciò che non è incluso.

Il download `.tex` è autonomo: `article`, Latin Modern, AMS, TikZ, `graphicx` e `geometry`; nessun file multimediale esterno. TikZ riceve solo geometria numerica normalizzata e RGB convalidato, con lo stesso modello di pressione del renderer. Le formule troppo larghe sono ridotte condizionalmente con `sbox`/`resizebox`. Nessuna ricostruzione scientifica o modifica del contenuto è inferita.

Il TeX utente non viene eseguito. Un parser riconosce una grammatica matematica limitata, costruisce un AST ed emette codice canonico; KaTeX controlla solo la sintassi risultante. Non sono ammessi definizioni, espansione di macro, ambienti, letture di file, primitive del motore, commenti o codifica `^^`. `text`/`operatorname` accettano testo semplice; contenuto annidato o macro richiedono fallback, senza riscriverne silenziosamente la matematica. Titoli, URL, JSON, licenze e fallback sono sempre escaped; nessun raw verbatim o commento eseguibile. I costrutti non supportati restano sorgente testuale con avviso. Caratteri non rappresentabili nel profilo LaTeX sono conservati come codice Unicode, mentre la stampa browser mantiene il testo originale.

## Prove, limiti e rollback

Unit: fonte storica vs corrente, fonte mancante, conflitto di identità, input privato rifiutato, clone, injection TeX, profondità, testo/Unicode, pressione e coordinate grandi, rifiuti di autorizzazione. E2E: docente con bozza aperta, fonte modificata, lab statico, formula larga, download reale, stampa multipagina, studente con nota privata e revoca, riapertura offline e pending ink conservato. Le fonti e gli artefatti rimangono sintetici. Il compilatore Tectonic viene usato solo come strumento locale di verifica del file effettivamente scaricato dalla UI, con versione/hash e modalità `--untrusted`; non diventa una dipendenza runtime.

Le prime prove hanno distinto difetti del collector da difetti reali: accesso coperto dall’inspector mobile; collisione CSS fra sezione ink e SVG; misura della formula sulla larghezza viewport invece della pagina; riga vuota nella prima display TeX. Le prove corrette includono raster e testo estratto dai PDF, non solo il click sul pulsante. Fallimenti e report intermedi restano fuori dal checkout, con la propria identità.

La stampa non è un backup o un formato di reimportazione. Non include audio, allegati PDF/immagine non ancora supportati, tracce personali o runtime interattivi. Safari, stampa da dispositivi fisici iPad/Apple Pencil e app native restano NOT_RUN; la preview Mac è web. Contenuti DRAFT e review scientifiche/editoriali restano distinti dalla verifica tecnica. Nessun deploy remoto è eseguito. Rollback: rimuovere il consumer e gli export derivati con una normale modifica dei sorgenti; nessun rollback dati o migrazione necessari per questo incremento.
