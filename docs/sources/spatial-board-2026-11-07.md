# Lavagna spaziale — preparazione locale del 7 novembre 2026

Mandato diretto: costruire Ardesia da Next, conservando il patrimonio storico senza imporne l'architettura; consultare anche le chat. Base `f7adf5db02913e25fbab0b1da071f650b4f78676`; branch locale `codex/lavagna-continuity-20261107`. Questa preparazione non integra main, non adotta una procedura e non accetta M3 remoto.

## Incremento

La stessa lezione Core si naviga con coordinate spaziali, zoom ancorato, trascinamento, pinch e tastiera. Penna e strumenti restano disponibili sotto 760 px. Il campionamento coalesced conserva pressione e coordinate; il preview live usa requestAnimationFrame senza setState per campione. Le viste confermate derivano lo stesso contorno dai campioni originali. Il tratto può essere segmentato con campione di raccordo per rispettare lo schema esistente, senza eliminare la coda di un gesto lungo.

I tratti in attesa provengono esclusivamente dalla recovery del Remote Client, filtrata per account, workspace e documento: restano visivamente distinti, non entrano nella proiezione confermata o nel taccuino, non creano un secondo store e non possono rendere verde lo stato del salvataggio. Il recupero dopo risposta persa continua a usare comando/ID/ricevuta originali. Cancellazione di puntatore conserva i campioni realmente ricevuti; la penna preempie un contatto touch iniziale.

Il mondo resta vincolato allo schema corrente (coordinate ±999999, oggetti segmentati entro le dimensioni valide, zoom 10–800%). Non è una promessa matematica di infinità. Culling limitato all'ink: le note hanno altezza di contenuto e non vanno eliminate usando solo il loro minHeight. L'area di selezione dell'ink ha almeno 44 px sullo schermo anche per un punto.

## Fonti e attribuzione

Chat effettivamente lette, sintetizzate senza esportare i messaggi privati:

- «Rifondazione Ardesia Next», `6ae28cc4-d6c4-83ed-9e48-1d0b681a4d3d`: 2 turni completi.
- «Riscrittura progetto Ardesia», `6ae20377-7cb0-83ed-ae34-833def951f8a`: 4 turni completi.
- «Confronto lavagne condivisibili», `6adde977-0848-83ed-9d3b-cc339f2e95e0`: 2 turni completi.
- «Stato lavoro Ardesia», `6ae8b224-6884-83ed-aaac-d843c5304467`: ultimi 4 turni, storia precedente non integralmente letta.
- «Analisi prestazionale persistenza ink», `6ae74924-75b4-83eb-8b54-271088e7dfea`: unico turno completo.
- «Impostare sistema Ardesia Next», `6ae61750-5194-83eb-ac9f-9b486560a51c` e «Ardesia — Pro e convergenza», `6adeeb1c-1890-83ed-8064-3d2936ecba38`: ultimi 4 turni ciascuna, copertura parziale.

Le prime tre consolidano lavagna centrale, strumenti contestuali, stessi oggetti nelle viste, Creator sugli stessi contratti, estensioni e contenuti versionati, recupero selettivo e consegne verificabili. Mac/iPad/offline sono requisiti espliciti del mandato attuale, non citazioni retroattive di quelle chat. Suggerimenti storici degli assistenti su B03/B04/G01 o librerie candidate restano suggerimenti, non decisioni del titolare. Le misure storiche di persistenza ink escludono rete/render/device: non misurano latenza Apple Pencil.

Legacy consultato in sola lettura al commit `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`: specifiche integrali ricostruite, AudioRecorder, SessionAudioRecorder, ReplayEngine e README Study MCP. Replay mantiene relazione eventi/tempo e gestione degli oggetti cancellati; il MCP storico è un adapter di lettura dell'API autorizzata, non un archivio autonomo. Nessun file di `AndreaMarro/ardesia` è stato modificato; nessun motore legacy importato in runtime.

## REA effettivamente eseguito

REA CLI `rea-agents@6.8.0`, Node `24.22.1`; consultati README, CLI, JavaScript application workflows e browser observation di `morluto/rea`.

1. `analyze-javascript-application` di `perfect-freehand@1.2.3`, sorgente ESM selezionata, cap 1500 nodi: evidenza padre `ev_22a1fb114f69d6d75025197056645178b5eafe6f2fefe0e72656d17cdd3b3d0a`. MIT, tarball pubblico. Analisi statica parziale, non prova di esecuzione; 24 file non selezionati.
2. `capture-browser-observation` e `capture-browser-scenario` sul demo pubblico ufficiale `https://perfect-freehand-example.vercel.app/`, Chrome 156. Scenario riuscito: caricamento → selezione EaseInQuad → Reset Options → ritorno a Linear. Evidenza `ev_f9f37b01bef48e791b9a8d2ca3c976908ff4f97f7fc99da4c7cb9b5608a3e8fa`. DOM, accessibilità ed eventi di rete osservati; nessuna misura fisica della scrittura. Due richieste iniziali non valide sono conservate come fallimenti di schema.
3. Analisi statica selettiva di ReplayEngine legacy, cap 2000: evidenza padre `ev_5c4576d00d98e328c73a7b1d4f9aff726c4b2e5415e94436245695f74b9bcf8c`. Relazioni fuori dai file selezionati e comportamenti runtime restano ignoti.

Evidenze integrali e licenza sono nel pacchetto locale di consegna `outputs/rea-evidence`, esterno al checkout. Il trasferimento concreto è la separazione campioni/contorno, pressione/geometria e configurazione contestuale. Il contorno a capsule di Next è implementazione originale: nessuna nuova dipendenza o copia del donor nel bundle. Replay è patrimonio per l'incremento audio successivo, non una feature già integrata.

## Limiti e verifiche richieste

E2E con PostgreSQL locale e account sintetici distingue ACK positivo, risposta persa, conflitto, riapertura e ripresa esplicita. PointerEvent sintetici verificano la gestione della pressione, non palm rejection o latenza hardware. Mac verificabile tramite browser sul computer corrente; iPad/Apple Pencil e Safari fisici restano NOT_RUN. Xcode non disponibile: nessuna app nativa compilata.

Il primo incremento mantiene la scrittura locale nella pagina già aperta durante interruzioni di trasporto. Non implementa avvio a freddo offline, cache documentale, sync concorrente offline, audio/trascrizione, MCP write adapter, corsi completi, gestionale tutor o vendite. Il successivo incremento locale [ADR0010](../adr/0010-own-lessons-offline.md) aggiunge copia documentale e avvio a freddo offline; i restanti domini rimangono nella mappa prodotto canonica. Non si moltiplicano autorità o backlog.

Un ulteriore incremento locale [ADR0011](../adr/0011-mcp-core-stdio.md) aggiunge il percorso MCP stdio leggibile/modificabile sui comandi Core esistenti. Riusa il contesto storico già letto; non dichiara nuove analisi REA, nuovi accessi alle chat o compatibilità host a partire dalle sole prove del client SDK.

Il server di sviluppo mantiene la stessa CSP: Fast Refresh è disattivato per evitare il preambolo inline bloccato; dopo una modifica si ricarica la pagina. Produzione, permessi e policy rimangono invariati.
