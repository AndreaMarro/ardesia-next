# Ardesia Quaderno — companion macOS

Un quaderno **nativo AppKit/SwiftUI**, autonomo e utilizzabile offline. Scrive un formato locale modificabile e produce un PDF vettoriale multipagina che Ardesia Next può importare come materiale. Non è una WebView e non contiene un secondo Core.

## Uso

- Penna, sei colori, cinque spessori; mouse/trackpad e pressione quando fornita da un evento tablet macOS. La pressione non è stata provata con una tavoletta fisica.
- Gomma a tratto: elimina tratti completi incontrati dal gesto. Annulla/Ripristina conservano fino a 40 gruppi di modifiche durante l'apertura del documento.
- Pagine A4 con carta a puntini, righe o bianca; rinomina, duplica, riordina e rimuovi pagine. La rimozione richiede una conferma e resta annullabile.
- Mano o barra spaziatrice trascinata per spostare il foglio. Scroll e zoom dal 35% al 250%; pinch quando disponibile sul dispositivo.
- **Salva con ⌘S** il file `.ardesiaquaderno`. Il formato JSON contiene pagine, identità, colori, punti e pressione. L'apertura rifiuta versioni, campi o valori non supportati e non modifica l'originale.
- `⇧⌘S` salva una copia con nome. I pannelli macOS chiedono conferma prima di sostituire un file. NSDocument usa il suo normale salvataggio sicuro; il codec standalone e l'export PDF usano scrittura atomica.
- `⇧⌘E` esporta tutte le pagine in PDF. Il PDF conserva la geometria vettoriale; **per modificare i tratti originali conserva anche il quaderno**.

Scorciatoie: `⌘N` nuovo quaderno, `⌘O` apri, `⇧⌘N` nuova pagina, `⌘1/2/3` penna/gomma/mano, `⌘Z` annulla, `⇧⌘Z` ripristina, `⌘+ / ⌘−` zoom, `⌘0` dimensioni reali.

Il salvataggio è esplicito. Non viene promessa una recovery dopo crash/kill o un autosalvataggio. Chiudere la finestra o uscire dall'app include il gesto corrente nella normale decisione Salva/Non salvare/Annulla; un arresto improvviso prima del salvataggio può perdere modifiche in memoria. Nessuna rete, account, microfono o consenso Speech viene utilizzato.

## In Ardesia Next

Apri la lezione o il quaderno nella piattaforma, scegli l'importazione materiali e seleziona il PDF. Il consumer già presente (`apps/web/src/materials/MaterialImport.tsx` e `files.ts`) conserva l'originale con digest, permette la selezione delle pagine e usa i comandi e le autorizzazioni della piattaforma. Puoi annotare le pagine importate.

Il trasferimento è **manuale tramite PDF**. Non sincronizza tratti, account, permessi, revisioni, lezioni, audio o corsi. Il `.ardesiaquaderno` non è uno snapshot Core e non deve passare dall'importer legacy o dal recovery ink del browser. Nel PDF importato i tratti originari fanno parte del materiale; non diventano singoli oggetti ink editabili sul web.

## Compilazione

Richiede macOS e Swift 5.9+ con SDK macOS 13+. Nessuna dipendenza da scaricare. Verificato sul Mac mini M4 con Swift 6.1.2/CLT e SDK macOS 15.5; nessuna prova su Intel o macOS 13 reale.

```sh
./script/check.sh
./script/build_and_run.sh --build-only
./script/build_and_run.sh --verify
```

Il build è Release. Il percorso `.app` compare a fine comando. Cache e bundle sono creati fuori dal repository, nella cartella temporanea del sistema per default. Per conservarli in una cartella di lavoro esplicita:

```sh
ARDESIA_NOTEBOOK_BUILD_ROOT=/percorso/di/lavoro/esterno ./script/build_and_run.sh --build-only
```

Ogni build produce un bundle nuovo. Lo script non uccide un'app con documenti aperti: salva e chiudi prima del rilancio, oppure usa `--build-only`. Il Run di Codex usa lo stesso script; sono disponibili anche `--debug`, `--logs` e `--telemetry`.

Il bundle è firmato **ad hoc per uso locale**, non notarizzato né preparato per distribuzione pubblica. Può essere aperto dal percorso di build o copiato manualmente in una cartella applicazioni; non modifica le protezioni di macOS. La distribuzione ad altri Mac richiede una pipeline di firma/notarizzazione separata. Non è un'app iPadOS e non supporta Apple Pencil tramite PencilKit.

## Verifiche riproducibili

`script/check.sh` esegue `NotebookChecks`, un test runner con errori e exit code non zero. Si usa un eseguibile perché i soli Command Line Tools installati non includono XCTest (`swift test` ha restituito `no such module 'XCTest'`). Non si presenta tale tentativo come riuscito.

Le verifiche coprono roundtrip di dati e identità, limiti/NaN/infinito, JSON malformato e campi sconosciuti, conservazione dei byte originali dopo un tentativo di scrittura invalido, hit-test geometrico della gomma, clipping al foglio, numero/dimensioni/rendering delle pagine PDF e budget del consumer.

Per produrre una fixture sintetica in una **nuova** cartella:

```sh
./script/check.sh --fixture-directory /percorso/esterno/nuovo
```

Nella sessione di sviluppo sono stati inoltre provati la vera app tramite CUA (scrittura, gomma, undo/redo, file Save/Save As/Open, PDF, titoli, duplicazione, carta, pan/zoom), i metodi NSDocument/NSView in un harness AppKit indipendente e il vero `inspectMaterial`/PDF.js sul PDF esportato. I report della sessione restano evidenze esterne al sorgente; la verifica finale d'importazione completa nella piattaforma è distinta dal semplice parsing del PDF.

Limiti espliciti: 64 pagine, 4.000 tratti, 250.000 punti complessivi, 20.000 punti per sottotratto, JSON/PDF fino a 32 MiB. Le uscite/rientri dal foglio separano i sottotratti senza inventare linee lungo il bordo e rimangono un solo gesto annullabile. Non sono qualificati latenza hardware, lezioni lunghe, sincronizzazione, OCR, testo digitato sulla pagina, selezione/lasso o importazione di PDF nel companion.
