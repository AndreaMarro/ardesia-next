# Beta Fisica — consegna locale del 14 novembre

Sessione autonoma di cinque ore sul Mac mini M4, isolata dalla PR53 `8fbebc1`. Sorgenti nella draft PR54, branch `codex/physics-beta-20261114`. Il titolare autorizza pubblicazioni frequenti e preview Vercel protette; main, produzione, SSO e alias canonico staging restano separati. La CI e il deploy di ciascun incremento sono riportati nella PR con la loro SHA, senza trasferire il PASS a commit successivi.

## Esperienze consegnabili

- Avvio e ripresa diretti C1–C5 dal catalogo, con una sola consegna privata anche fra device e recupero delle importazioni interrotte.
- 38 lezioni pubbliche leggibili con 279 problemi/verifiche (79 originali + 200 assessment). I 290 oggetti di pratica legacy rimangono distinti nel Core.
- Prove A/B: 31 quesiti ciascuna, 21 scelte con cinque alternative e 10 completamenti; 50 minuti o pratica libera. Feedback e ripasso verso le lezioni canoniche. Export JSON e HTML autonomo leggibile/stampabile, senza salvare il tentativo automaticamente.
- Esperimenti pubblici: urti C1, Poiseuille C2, campo/potenziale C4 in 3D/2D, interferenza C5. Il video C4 di38secondi conserva trascrizione e sorgenti di produzione; non ha audio.
- ZIP completo per uso offline: estrarre tutti i file e aprire `index.html`. Risorse locali, limiti256file/2MiBperfile/16MiBtotale; contatti e fonti esterni richiedono rete. Il download GitHub immutabile viene verificato anonimamente ad ogni pubblicazione utile.
- Companion macOS AppKit/SwiftUI: penna, gomma, pagine, undo/redo, file locale validato ePDF vettoriale. Autosalvataggio dei file già nominati; PDF reale importato e annotato nel Core. Nessuna sincronizzazione o seconda autorità.

## Qualità e prestazioni

Review indipendenti hanno trovato e fatto correggere problemi reali: offline ESM, inquadratura mobile, input±oltre80caratteri, geometria del tratto fuori foglio, ciclo di chiusura nativo e overflow del ripasso. [Ricevute e limiti](../sources/physics-2026-27/reviews-2026-11-14/README.md). Tutti i contenuti restano DRAFT/humanApproval=false.

I79problemi originali sono stati ricalcolati;200prompt/risposte di verifica esaminati;7teorie approfondite;279quesiti confrontati fra sorgente, pack e lettore. Precisata la formula del prodotto scalare nel piano e in3D. Non è una review umana né esaustiva di ogni frase/risorsa legacy.

C2 locale: evitare migrazioni inutili porta il benchmark Core/MemoryStorage da5,885 a4,077s e il test browser completo da36,575 a32,472s. La successiva lettura unica nel render del catalogo porta un nuovo confronto browser da32,489 a24,047s. Tre campioni perversione, Mac condiviso; percentuali non additive, nessuna garanzia remota. Comandi, revisioni, ricevute, validazioni e persistenza restano invariati.

Il budget Core rimane336KiB dopo ADR0025; iniziale240KiB e classificazioni invariati. La minificazione usa Terser giàpresente e conserva sorgenti leggibili. I valori finali appartengono agli artefatti della singola SHA.

Cortex0.2 rimane deterministico. Gli esperimenti Qwenlocale e grafo importdiretti sono conservati con risultati negativi rispetto alla promozione nel flusso predefinito; nessuna promessa di token/costi risparmiati, selezione automatica dei test o worldmodel causale.

## Riproduzione e limiti

Toolchain web: Node24, dipendenze bloccate, PostgreSQL locale isolato. Usare `npm run verify` e i test browser con i database di test dedicati secondo i runner esistenti. La rigenerazione dei pacchetti è `node tools/build-physics-pack.mjs`; la build genera lettore, runtime, ZIP e manifest. Non modificare direttamente i runtime pubblici generati: sorgenti in `tools/physics-runtime/`.

Companion: da `native/macos-notebook`, `script/check.sh`, `script/check-lifecycle.sh` e `script/build_and_run.sh --build-only`. Build/cache fuori repository; formato e uso nel README locale. Firma ad hoc sul Mac di sviluppo, non notarizzazione o qualificazione iPad/Pencil. Le bozze senza nome, le modifiche non ancora scritte e l'undo dopo riavvio non hanno garanzie di recupero.

Preview Vercel resta SSO. READY non equivale a smoke remoto autenticato, eseguito solo se realmente disponibile. La distribuzione dello ZIP statico è distinta dall'accesso al Core. Per il16novembre è preparata un'anteprima con richieste informative non vincolanti; prezzo, condizioni, pagamento e consegna del servizio acquistato non sono attestati. Nessun messaggio promozionale è stato inviato.

Rollback con nuovi revert mirati, conservando sorgenti e prove; nessun aggiornamento silenzioso delle edizioni già importate e nessun reset dei dati.
