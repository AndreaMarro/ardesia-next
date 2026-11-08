# ADR 0023 — Dispensa verificabile con materiali e scrittura

8 novembre 2026, continuazione del mandato diretto. Estende ADR0014 senza migrare dati o creare un altro documento autorevole. Il documento Core confermato resta intatto; `planHandout` deriva ordine dei blocchi e copertura separatamente. La copia offline dichiara la propria data; bozze, ink pending, audio e lavoro privato degli studenti restano esclusi.

## Esperienza

Dispensa prepara tutti i materiali prima di abilitare stampa e download. PDF.js, già distribuito e analizzato con REA, normalizza crop e rotazione della pagina scelta. Originali PDF/PNG/JPEG/WebP completi e byte-identici rimangono nello ZIP; PNG derivati sono limitati a 8 megapixel e 200 dpi rispetto alla stampa. Un avviso riporta la riduzione di risoluzione. Un decoder alla volta, acquisizione lazy nella coda, annullamento e controllo finale dell'accesso dopo il decode proteggono il percorso. Diniego a stampa/download invalida l'anteprima preparata.

Materiale e annotazioni condividono una trasformazione; lo spostamento della pagina non cambia la figura esportata. I tratti liberi condividono scala e coordinate su tavole occupate 640×800, fino a 64. I segmenti sono ritagliati solo nella geometria derivata; campioni e pressioni originali rimangono nel documento sorgente. SVG, web e TikZ riusano il modello del renderer. Un limite superato produce un errore esplicito, mai una selezione silenziosa di oggetti.

La stampa web usa A4/margini18 mm. Il pacchetto contiene `source.json`, `manifest.json`, `main.tex`, `warnings.json`, originali, raster e tavole SVG. Il manifest indica revisione, hash di ogni file e copertura di ogni oggetto. Stato Creator e provenienza usano JSON canonico: l'ordine delle chiavi non altera il TeX dopo un round-trip. Le estensioni non vengono eseguite; descrizione e stato sono conservati e l'assenza di grafici TikZ viene dichiarata. Per i documenti senza materiali resta anche il download `.tex` autonomo.

## Compilazione locale

`node tools/compile-handout.mjs --help` descrive il consumer Node24. Richiede binario Tectonic, cache locale esistente e Poppler; non installa o scarica toolchain. La CLI riserva una directory nuova, verifica lo ZIP prima di decomprimere ed estrae solo file regolari con percorsi generati, entro quote. Rifiuta link, alias, traversal, volumi/ZIP64, espansione e CRC errati. Il verificatore del checkout fidato rigenera tutti i file dal documento convalidato: hash forniti dal pacchetto e TeX alterato non autorizzano una compilazione. Il compilatore riceve il TeX rigenerato.

Tectonic usa `--only-cached --untrusted`; cache donor copiata senza scritture, ambiente ridotto, argv strutturati e timeout. In caso di arresto, il builder attende SIGKILL del gruppo posseduto anche se il leader è già terminato, prima di rimuovere lo scratch. Non viene attestata una sandbox del sistema operativo. Il report conserva hash/verificatore/toolchain/log, PDF e PNG di tutte le pagine; la revisione visiva resta esplicita. Output esistente non viene sovrascritto; un errore conserva report e log.

Limiti iniziali: 512 file, ZIP128MiB, singolo file64MiB, totale256MiB, rapporto di espansione200; 200.000 campioni sorgente, 25.000 per tavola; fino a250pagine PDF. Non sono garanzie di picco memoria o prestazioni su iPad. La compilazione di TeX modificato fuori da Ardesia richiede una propria identità e un'azione esplicita; il builder verificato non accetta quella modifica come identica al Core.

## Riuso e costo

Si riusano PDF.js6.5.438, geometria della penna e grammatica TeX già presenti; fflate0.8.2 MIT aggiunge soltanto il confezionamento ZIP. `Zip`/`ZipPassThrough` evitano un motore DEFLATE non necessario e un array aggiuntivo dell'intero archivio. Licenza integrale distribuita nei notices. REA della preparazione: `ev_1f561b5d242cccdc52363066e43c851556ac47670e6955d28971d5d13ce725e1`, 4file/4808nodi AST, zero parse failure; analisi statica incompleta, non accettazione runtime. Le decisioni concrete sono piano congelato, renderer condiviso, geometria comune e builder separato; nessuna ricerca ripetuta per inventario.

Misura intermedia: Core329780→326825byte gzip con lo streaming ZIP; JS iniziale circa220,5KB, inferiore alla baseline225908. Il limite312KiB resta FAIL nel report. Policyv6: solo aggregato Core **320KiB** (327680); iniziale240KiB e limiti/classificazione Program/PDF invariati. La dispensa è lazy ma conteggiata nel Core, senza nasconderne il costo fra runtime opzionali. Il margine finale e i totali si leggono negli artefatti della head, non in queste misure intermedie.

## Prove e confini

Controprove: originali mancanti/corrotti, hash falsificati coerenti con TeX ostile, metadata privati, sorgente esatta, annotazioni dopo spostamento, tratti negativi e attraverso tavole, saturazione dei campioni, diniego dopo ready e dopo decode sospeso, chiusura durante preparazione, offline, stato Creator senza Worker, processi ausiliari che ignorano TERM. Il test di ordine delle chiavi fallisce prima del fix; la successiva suite mirata passa17/17. Browser dispensa/materiali22/22 dopo il fix. Questi risultati non sostituiscono Verify, regressione completa e CI della sorgente finale.

La dispensa è una rappresentazione statica documentata, non ancora ricostruzione didattica da audio/ASR/OCR. Il testo dei materiali rasterizzati non è selezionabile; l'originale rimane disponibile. Export non equivale a reimportazione, qualità scientifica approvata o PDF accessibile certificato. Safari/Pencil fisica restano non provati. Rollback applicativo con normale revert dei consumer, conservando pacchetti ed evidenze; nessuna migrazione dati necessaria.
