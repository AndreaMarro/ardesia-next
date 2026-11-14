# Ardesia Quaderno — companion macOS

Un quaderno **nativo AppKit/SwiftUI**, autonomo e utilizzabile offline. Scrive un formato locale modificabile e produce un PDF vettoriale multipagina che Ardesia Next può importare come materiale. Non è una WebView e non contiene un secondo Core.

## Uso

- Penna, sei colori, cinque spessori; mouse/trackpad e pressione quando fornita da un evento tablet macOS. La pressione non è stata provata con una tavoletta fisica.
- Gomma a tratto: elimina tratti completi incontrati dal gesto. Annulla/Ripristina conservano fino a 40 gruppi di modifiche durante l'apertura del documento.
- Pagine A4 con carta a puntini, righe o bianca; rinomina, duplica, riordina e rimuovi pagine. La rimozione richiede una conferma e resta annullabile.
- Mano o barra spaziatrice trascinata per spostare il foglio. Scroll e zoom dal 35% al 250%; pinch quando disponibile sul dispositivo.
- **Scegli la destinazione con ⌘S la prima volta.** Dopo il primo salvataggio, NSDocument salva automaticamente nello stesso file i tratti conclusi e le altre modifiche. Puoi usare ⌘S per salvare subito il file `.ardesiaquaderno`. Il formato JSON contiene pagine, identità, colori, punti e pressione. L'apertura rifiuta versioni, campi o valori non supportati e non modifica l'originale.
- `⇧⌘S` salva una copia con nome. I pannelli macOS chiedono conferma prima di sostituire un file. NSDocument usa il suo normale salvataggio sicuro; il codec standalone e l'export PDF usano scrittura atomica.
- `⇧⌘E` esporta tutte le pagine in PDF. Il PDF conserva la geometria vettoriale; **per modificare i tratti originali conserva anche il quaderno**.

Scorciatoie: `⌘N` nuovo quaderno, `⌘O` apri, `⇧⌘N` nuova pagina, `⌘1/2/3` penna/gomma/mano, `⌘Z` annulla, `⇧⌘Z` ripristina, `⌘+ / ⌘−` zoom, `⌘0` dimensioni reali.

L'autosalvataggio riguarda **solo i quaderni già salvati con un nome** e usa NSDocument, senza un archivio parallelo. Il timer di AppKit ha un ritardo minimo configurato di 15 secondi; macOS decide l'istante effettivo, quindi non è una garanzia di salvataggio entro 15 secondi. L'indicazione «Salvataggio automatico sul Mac» appare dopo una scrittura riuscita. Se la scrittura fallisce, AppKit segnala l'errore, le modifiche restano in memoria e il documento resta da salvare.

Un autosalvataggio periodico **non interrompe il tratto ancora premuto**: salva il modello già committato; il tratto corrente diventa salvabile al rilascio. ⌘S, chiusura e uscita includono il gesto corrente. Per i file nominati la chiusura può salvare automaticamente, senza il precedente pannello Salva/Non salvare; usa Annulla prima di chiudere per rimuovere una modifica. Le bozze senza nome continuano a richiedere una destinazione e non hanno recupero automatico. Non sono offerte cronologia delle versioni o ripristino di una versione precedente.

Dopo un arresto improvviso si può riaprire l'ultimo file scritto correttamente; i cambiamenti successivi e un gesto non concluso possono andare persi. Non si promette il recupero delle bozze senza nome, delle modifiche non ancora scritte, né dell'undo dopo un riavvio. Nessuna rete, account, microfono o consenso Speech viene utilizzato.

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

`script/check-lifecycle.sh` aggiunge quattro regressioni macOS del vero NSDocument: Salva, Chiudi e uscita reale dopo il primo gesto ancora premuto, più il salvataggio dentro un ciclo modale annidato. Richiede Python 3 e gli stessi Command Line Tools; non richiede XCTest. Compila le sorgenti reali del companion e ricava la classe `NotebookApplication` esattamente da `App/main.swift`, senza una seconda implementazione di test. Se il confine con `AppDelegate` cambia, il controllo rifiuta la compilazione finché l'estrazione non viene aggiornata.

```sh
./script/check-lifecycle.sh
```

I test invocano metodi NSView/NSDocument con eventi sintetici su una finestra non mostrata; non inviano input al sistema né pilotano altre app. Ogni caso usa un processo proprio e file nuovi fuori dal repository. Il processo di uscita deve terminare realmente con codice zero; il runner confronta i byte salvati con il modello atteso contenente esattamente un tratto. Un blocco oltre 12 secondi, un callback mancante o un file incompleto fa fallire lo script. Il runner ferma soltanto i gruppi di processi che ha avviato e cancella fixture e binari temporanei anche in caso di errore/interruzione; conserva solo la cache Swift nella cartella di build. Non chiude l'app dell'utente e non modifica le sue preferenze. Le prove con finestre visibili e pannelli Annulla/Salva restano una verifica CUA separata.

Per produrre una fixture sintetica in una **nuova** cartella:

```sh
./script/check.sh --fixture-directory /percorso/esterno/nuovo
```

Nella sessione di sviluppo sono stati inoltre provati la vera app tramite CUA (scrittura, gomma, undo/redo, file Save/Save As/Open, PDF, titoli, duplicazione, carta, pan/zoom), i metodi NSDocument/NSView in un harness AppKit indipendente e il vero `inspectMaterial`/PDF.js sul PDF esportato. I report della sessione restano evidenze esterne al sorgente; la verifica finale d'importazione completa nella piattaforma è distinta dal semplice parsing del PDF.

Limiti espliciti: 64 pagine, 4.000 tratti, 250.000 punti complessivi, 20.000 punti per sottotratto, JSON/PDF fino a 32 MiB. Le uscite/rientri dal foglio separano i sottotratti senza inventare linee lungo il bordo e rimangono un solo gesto annullabile. Non sono qualificati latenza hardware, lezioni lunghe, sincronizzazione, OCR, testo digitato sulla pagina, selezione/lasso o importazione di PDF nel companion.
