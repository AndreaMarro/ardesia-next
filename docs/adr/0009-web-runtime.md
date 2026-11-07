# 0009 — Runtime web più leggero

Data: 7 novembre 2026. Preparazione locale nel mandato diretto corrente; nessuna accettazione M3 o adozione remota implicita. Aggiorna soltanto la scelta React/ReactDOM di ADR0001.

## Problema

La lavagna spaziale completa porta il JavaScript distribuito a 248727 byte gzip, oltre il limite invariato di 245760 byte. Il precedente adattatore di build riscrive internamente i sorgenti CommonJS di React con un AST e hash fissati. Ulteriore minificazione e accorpamento dei chunk matematici non forniscono margine utile.

## Decisione

Usare Preact11.2.0 con l'adattatore ufficiale `preact/compat`; import JSX e API React già impiegate restano leggibili. `tools/ui-runtime.mjs` definisce alias esatti condivisi da Vite e Vitest, inclusi client e SSR. Si rimuovono il plugin React di Vite e la riscrittura AST dei pacchetti. Il compilatore JSX automatico di Vite usa gli stessi alias.

React/ReactDOM19.3.1 e Lucide1.63.0 restano esclusivamente dipendenze di sviluppo per il confronto indipendente delle icone: il riferimento è renderizzato dal pacchetto originale, l'implementazione da Preact. `preact-render-to-string`6.8.2 serve solo ai test SSR. Un test costruisce l'entry reale e controlla nel grafo prodotto la presenza di Preact e l'assenza dei runtime React, ReactDOM e scheduler. La licenza MIT di Preact è inclusa nei notice distribuiti.

Il budget continua a contare tutti i file JavaScript distribuiti, inclusi i worker firmati. Core, contratti, protocollo di recupero, firme e byte dei plugin non cambiano. Nessun rendering viene spostato su server o AI per ridurre artificialmente il conteggio.

## Verifica e limiti

La compatibilità delle API non dimostra da sola quella del prodotto. Sono necessari typecheck, test Core/trasporto/SSR e suite browser completa: form controllati, cambi vista, sottoscrizioni, focus, pointer capture, pressione, recupero, consenso e revoca plugin. Gli esiti sono report della sorgente esatta, non una promessa generale di equivalenza con tutte le API React. Nuove librerie UI devono essere verificate con questo runtime; funzionalità concorrenti o server-specifiche di React non sono assunte disponibili.

La riduzione del bundle non misura latenza Apple Pencil o fluidità su hardware. iPad/Pencil e Safari fisici restano da provare. Rollback possibile ripristinando dipendenze, lockfile e configurazione precedenti; nessuna migrazione di dati viene introdotta da questo cambio.

Fonti consultate: [README ufficiale Preact](https://github.com/preactjs/preact), export e licenza del pacchetto installato, registry npm con versioni e integrità fissate nel lockfile. L'adattatore è ufficiale; il progetto non mantiene un fork del runtime.
