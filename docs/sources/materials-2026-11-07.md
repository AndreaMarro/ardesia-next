# Materiali — fonti e REA del 7 novembre 2026

Il programma del titolare richiede PDF e immagini nella lezione, con scrittura indipendente dall’AI, identità e originali conservati. Il patrimonio legacy è stato consultato senza modifiche: commit 5cfbdcb e specifiche delle pagine/fonti, asset immutabili, proprietà/licenza, salvataggio e riapertura. Questa preparazione estende il Core corrente e il suo PostgreSQL; non importa il vecchio backend.

## Analisi eseguita

REA CLI6.8.0 su Node24.22.1, non semplice osservazione estetica:

| Analisi | Fonte esatta | Risultato e limite |
|---|---|---|
| Ciclo PDF.js | mozilla/pdf.js v6.5.438, commit0a4153349dc473ba950fc17941c5ca7eda43c1de, Apache-2.0 | 4JS,11053 AST,0errori,2690unknown; copertura parziale, inline HTML non analizzato nella prima run. |
| Navigazione e immagini | body HTML estratto byte per byte e due file TS Excalidraw MIT | 2794AST,0errori,630unknown; copertura unknown, dipendenze fuori campione non risolte. |

Evidence: `ev_d62c0534c2194ec88362fcd32479330c63a2dd0968a6783a25bd01a288e964b3` e `ev_83629c017674ea33f180a3808e93f15ac3145fe3daec7941a9bfae1bd58e3c20`. Quindici blob verificati; licenze, manifest e raw conservati nella consegna. Nessun sorgente donor trapiantato: dipendenza pubblicata PDF.js e consumer originali.

Trasferimenti concreti: buffer originale separato dalla copia trasferita al worker; task distrutto al termine/cambio vista; pagina selezionata distinta dall’originale; navigazione prima di importare; errore esplicito su file non decodificabile. Il bundle ufficiale compatibile `legacy` è stato scelto dopo un fallimento riprodotto del moderno su Map.getOrInsertComputed; non indica riuso dell’architettura Ardesia legacy. `isEvalSupported` non esiste nella versione scelta: nessuna protezione inventata mediante quell’opzione. Rendering canvas, XFA disabilitato, nessun viewer/scripting manager.

REA runtime consumer usa account sintetici e materiali durevoli su Chrome Mac e viewport mobile. Il suo schema non supporta upload locale; cancella i download osservati e li registra come `download-cancelled`. Perciò upload, file chooser e hash dei byte effettivamente scaricati sono provati con Playwright, separatamente. I raw distinguono passi riusciti e limiti; build-info e confronto HTTP degli asset legano la sorgente al runtime senza attribuire questa garanzia a REA.

## Prove e decisione

[ADR0020](../adr/0020-original-materials.md) descrive contratto0.10, snapshot9, SQL007, backupv4, recovery e limiti. Le prove coprono hash/immutabilità, assegnazione e revoca, corso esatto, backup corrotto, import interrotto, abbandono esplicito della bozza, annotazioni traslate di oltre5000unità, offline freddo anche per lezioni non aperte e mancata persistenza dell’originale. Il riesame indipendente ha identificato problemi di lifecycle, parallelismo decoder, coordinate, recovery e copia incompleta; correzioni e controprove mantengono i rapporti originali.

Evidenze finali e confronto col mandato: [handoff](../handoffs/2026-11-07.md). Non sono provati Safari/iPad/Pencil fisica, grandi corpora reali, OCR, export PDF con originali incorporati o upload da host AI commerciali. Le soglie iniziali di risorse sono esplicite, non limiti definitivi del prodotto.
