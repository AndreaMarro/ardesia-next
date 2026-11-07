# Verifiche — Creator programmabile

Preparazione locale sulla base f7adf5db02913e25fbab0b1da071f650b4f78676, sorgente **ab181bddd390c15fe74a1a09f29d0dc3c3208e4936d540943779a5cbdc576e8a**, branch codex/lavagna-continuity-20261107. Nessun commit, push, deploy o accettazione globale.

| Prova | Esito |
|---|---|
| [Verify](verification.json) | 8/8 PASS |
| [Unitari](unit.json) | 520 PASS, nessun fallimento/pending |
| [Browser](browser-evidence.json), [raw](e2e.json) | 163 PASS, zero saltati/flaky/falliti, desktop e mobile Chromium |
| [Server](server-runtime.json) | 5/5, Node e PostgreSQL reali |
| [MCP](mcp-runtime.json) | 12/12, client ufficiale esterno → stdio → HTTP/PostgreSQL |
| [Budget](budget.json) | Nucleo245372/245760 gzip; motore290773/327680 gzip,698191/1048576 raw |
| Confronto precedente | JS totale302102>245760gzip: FAIL dichiarato; totale JS/WASM536145gzip |
| [Review indipendente](review-indipendente.json) | Favorevole per l’incremento locale; contesto separato, sola lettura |
| [Stato canonico](status.json) | NOT_COMPLETE; deployment non verificato per questa sorgente |

## Esperienza verificata

Crea/importa senza esecuzione implicita; avvio esplicito; interazioni e SVG generati; salvataggio reale e riapertura; modifica del codice con versione/digest nuovi; esportazione portabile; risposta persa e retry originale; conflitto senza rebase; esperimenti studente privati e arresto alla revoca; stessa identità oggetto in lezioni diverse senza trasferire consenso/stato; Worker indisponibile o pagina nascosta senza perdere l’editor. Codice ostile, ricorsione, loop, output non valido e layout moltiplicativi vengono fermati con editor recuperabile. Le prove non certificano isolamento formale o sicurezza di produzione.

La regressione completa conserva lavagna, offline, audio, feedback, dispense, corsi, compositore e plugin precedenti. [Guida ABI](../../ardesia-next/docs/programs.md), [decisione e rollback](../../ardesia-next/docs/adr/0017-programmable-creator.md).

## REA e verifica visiva

[Dossier REA](../../rea-evidence/programmable/README.md): Sandpack statico e interattivo, analisi del confine Next; catture finali su Chrome 156/macOS, desktop 1536×1024 e mobile 412×915. Entrambe completano26 azioni più avvio: riapertura, nuova versione, modifica, save, taccuino, stop. [Controlli visivi](../../design/programmable-verifica.md). REA blocca Service Worker per la cattura riproducibile; l’offline è coperto dalla suite browser separata. IAB esistente non aggiornato: prova finale manuale non rivendicata.

## Fallimenti conservati

[Prima regressione completa abf0](intermedi/abf0/e2e.log):159 PASS / 4 FAIL. Durante salvataggio i controlli dichiarativi diventavano output, ora rimangono disabilitati; la controprova font superava profondità JSON 20, ora resta nel gruppo rifiutato e sei titoli realmente presenti sono misurati entro quota. Nessun limite allentato. Log precedenti, probe QuickJS, report e screenshot rimangono in intermedi/. Non vengono promossi a PASS della sorgente finale.

## Riproduzione e limiti

Node 24.22.1, PostgreSQL 16 locale e account sintetici; database preview distinto. Comandi: npm run verify, npm run test:e2e, npm run status. [Log Verify](verify.log), [log E2E](e2e.log), [hash sorgenti](source-files.json), [manifest](manifest.json), [patch](consegna.patch), [esito](esito-consegna.json). La patch dalla base include gli incrementi precedenti; applicazione inversa controllata, [precedente](consegna-precedente/ardesia-next.patch) preservata.

Non attestati: Safari/iPad/Pencil reali, app native, host commerciali AI, grande scala, audit di produzione QuickJS/browser, efficacia didattica o revisione scientifica umana. La creazione programmabile ha un’ABI documentata: non esegue pacchetti arbitrari, rete, plugin binari o tutti i linguaggi. Nessuna accettazione remota o conclusione dell’ecosistema.
