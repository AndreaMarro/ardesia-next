# Review indipendente importazione del quaderno pubblico

**PASS del flusso reale con una raccomandazione di copertura.** Test scritto dal coordinatore; questo agente ha letto test, fixture, server/build gate e diff App, preservato le evidenze precedenti e ripetuto la verifica da un contesto separato. Nessuna modifica al repository condiviso.

## Sorgenti congelate

- HEAD: `708f5a9c54d60043f7b06a7d87ea1e8b50f84922`, con test non tracciato e modifica App locali.
- sourceDigest e build-info coincidono: `0e79ecbe3764fe413d225a1fd673da3740a18cb784a492314859d189ee52aadb`.
- Test originale SHA-256: `f280baccaab0366cce33b8c4379442a9880cab396bdb856067f1ca2612f2c1f1`.
- App.tsx SHA-256: `29f2852fbde833b1d19cf319cb0c93369882ad8bd78a06a476b520c4a6f5f50c`.
- PDF pubblico SHA-256: `7d91231930f53ade5ac7b2661bece8605e81b295d68f217c6881d6cd4cc70043` (7 pagine; stesso artefatto revisionato e presente nello ZIP 708).

`freeze.json`, `run-identity.json` e `build-info.json` conservano le identità. Le evidenze root sono copiate in `root-test-results`, `root-audit`, `root-e2e.json` e `root-browser-evidence.json`; incluso il fallimento iniziale mobile, non sostituito dal PASS.

## Test e risultato

Run locale autorizzata sul DB browser dedicato, porta 4177, dopo conferma del coordinatore che non vi fossero test concorrenti. Output, configurazione e copie dei test restano nella directory di questa review. **4/4 PASS**, zero skipped/flaky/unexpected: test originale e variante rafforzata, ciascuno su Desktop Chromium e Pixel 7 emulato. Durata 17,1 secondi, exit 0. Fonte/build verificate prima di avviare il browser; nessuna API di successo simulata.

Le fixture creano workspace reali attraverso il server locale e i dati vengono verificati tramite export personale autenticato del Core. Il test importa il PDF effettivo, seleziona pagine 1–7, verifica i sette oggetti, l’asset unico, hash e pageCount, scarica l’originale e confronta tutti i byte. Il drawer seleziona realmente la pagina 7 prima del gesto: la correzione mobile non nasconde un errore, rende il bersaglio raggiungibile nel viewport. Il tratto salvato è ancorato all’ID della pagina 7; dopo reload conserva i dati. Tutti i sette materiali raggiungono lo stato ready.

La variante rafforzata riapre la pagina 7 dal drawer dopo reload e asserisce anche ink in viewport, path SVG non vuoto e pagina renderizzata pronta. Screenshot desktop/mobile ispezionati: il tratto è visibile sulla pagina finale. Le immagini sono in `test-results/strengthened-*/physics-workbook-import.png`.

## Rilievo di copertura

Il test originale dopo reload verifica soltanto persistenza dati del tratto e caricamento dei sette materiali; potrebbe passare anche con una regressione che non disegna l’ink. Non attribuire al solo test originale una prova del rendering del tratto dopo reload. **Raccomandazione:** integrare `strengthen.patch` (sette istruzioni, nessuna modifica al prodotto), già eseguita con PASS in isolamento. Il relativo file completo è `strengthen-proposal.ts.txt`. La verifica aggiunta colma il limite per questa build.

La minifix App è coerente: gli oggetti `material` sono chiamati «Materiale importato» anziché «Annotazione» nel drawer; ink mantiene il nome precedente e non cambia il comportamento di selezione. Nessun rilievo su tale diff.

## Limiti

È una verifica del web locale con PostgreSQL, non del companion macOS nativo, di Vercel o di dispositivi fisici. Il progetto mobile emula Pixel 7; il gesto viene generato con mouse sintetico, non touch, Apple Pencil o penna fisica. La riapertura è online su server locale, non un nuovo test offline. Lo screenshot al piccolo zoom dimostra presenza del tratto; non certifica leggibilità delle sette pagine contemporaneamente. Nessuna nuova approvazione scientifica del PDF.

Due problemi del nostro harness sono stati risolti prima del test: primo avvio dal cwd sbagliato (l’identity helper cattura cwd all’import), poi assenza della variabile DB nella nuova exec. Il secondo è preservato in `harness-db-missing.log`; nessuno dei due ha avviato un test o modificato il prodotto. Il valore DB è stato fornito dal coordinatore tramite canale autorizzato. Il server di test è terminato; nessun listener 4177 rimasto.
