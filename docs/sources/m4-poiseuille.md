# M4 — prima unità Poiseuille, fonti e limiti

Consultazione del 2 novembre 2026, a partire dal task M4-REUSE della procedura `c4d38a612a73bc28df434c2d36d36025cf1b1adc`. Consumer previsto: docente e studente che confrontano pressione imposta e portata imposta nello stesso laboratorio. Questo incremento prepara modello/worker e prova il confine Host/Core; non collega ancora il consumer web o PostgreSQL.

## Fonti effettivamente lette

- Pomerenk et al., *Hydrodynamics of finite-length pipes at intermediate Reynolds numbers*, Journal of Fluid Mechanics 959, A28 (2023), [DOI 10.1017/jfm.2023.99](https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/hydrodynamics-of-finitelength-pipes-at-intermediate-reynolds-numbers/D7BBD977E0A615A3194E664D8752E1CB), §§1, 2 e 4. Fonte primaria sperimentale: Δp = 32μLU/D², Re = ρUD/μ, sviluppo d'ingresso e dipendenza della transizione dai disturbi. Pagina dichiara CC BY 4.0; nessun testo, codice o figura importato.
- [NPTEL, Viscous Incompressible Flow, lecture 4, pagina 4](https://archive.nptel.ac.in/content/storage2/courses/101103004/module5/lec4/4.html), materiale ufficiale: parete senza slittamento, profilo parabolico e velocità sull'asse doppia della media. Revisione e licenza non esposte nella pagina letta; nessuna riproduzione del materiale.
- Criteri originali Next [D09–D18](../acceptance/D01-D68.json), già conservati, non rinominati o accettati da questa preparazione. Nessun donor legacy è copiato o modificato.

Equazioni e spiegazioni sono nuove implementazioni del bilancio viscoso e dell'integrazione degli anelli di area: `u(r) = Δp(R²-r²)/(4μL)`, `Q = πR⁴Δp/(8μL)`, `ū = Q/(πR²)`, `u(0) = 2ū`. L'inversione `Δp = 8μLQ/(πR⁴)` è una condizione al contorno distinta, non una seconda persistenza o un altro solver.

Il grafico campiona il diametro con coordinata s da −R a R; la distanza radiale fisica è r = |s| ≥ 0. Didascalia e spiegazione distinguono queste coordinate.

## Stato e attività DRAFT

Schema `1.0.0`: raggio R e lunghezza L in m, viscosità **dinamica** μ in Pa·s, densità ρ in kg/m³; esattamente una forzante fra Δp in Pa e Q in m³/s. Le due forme hanno parametri numerici compatibili con la vista SDK `1.0.0`; nessun campo nascosto di modalità viene perso nella ricostruzione dei parametri. Riferimento di stato, ID, versione, digest del bundle, edit e revisione restano nel medesimo oggetto Core.

Prerequisiti: pressione, portata volume/tempo, area del cerchio, velocità media e prefissi SI. Obiettivo: identificare la grandezza fissata e spiegare perché lo stesso raddoppio del raggio produce conseguenze diverse. Previsione prima della modifica, confronto numerico, spiegazione del profilo, feedback all'errore Q×4 a pressione fissata, recupero tramite Q = Aū, poi transfer a μ e L raddoppiate con Q fissata. La vista contiene le spiegazioni; non registra ancora risposte, aiuti, esito o padronanza e non costituisce una lezione approvata.

Fixture sintetica: R = 0,001 m, L = 1 m, μ = 0,001 Pa·s, ρ = 1000 kg/m³, Δp = 800 Pa. Q = π×10⁻⁷ m³/s, ū = 0,1 m/s, u(0) = 0,2 m/s, Re = 200. R×2 a Δp fissa: Q×16, area×4, ū×4, Re×8. A Q fissa: Δp÷16, ū÷4, Re÷2. μ×2 e L×2 a Q e R fissi: Δp×4. I test usano anche forzante 8 Pa, integrazione indipendente su 10.000 anelli e controllo delle due pareti e del mezzo raggio. Tolleranze numeriche esplicite nei test; nessun confronto con un'unica stringa formattata.

Ipotesi: fluido newtoniano incomprimibile a viscosità costante, regime stazionario laminare completamente sviluppato, tubo diritto cilindrico rigido orizzontale, parete ferma/no-slip. L misura la distanza fra sezioni già sviluppate, oltre l'ingresso. Re = ρ|ū|2R/μ è un indicatore; Re < 2000 non prova sviluppo o laminarità. L'attività rifiuta Re ≥ 2000 come esclusione prudenziale, senza dichiarare una soglia universale o una validazione del fluido reale. La stima d'ingresso della fonte non è usata per certificare il tratto. D17 e la review fisica umana restano pendenti.

Forzanti negative invertono flusso/profilo; a zero il fluido è fermo. R, μ, L e ρ hanno limiti finiti strettamente positivi. Nessuna conversione implicita, clamp, default o fallback alla revisione più recente. Stato malformato, entrambi i controlli, schema incompatibile, non finiti e caso fuori dominio sono rifiutati. Nessuna animazione o densità di traccianti può suggerire una portata diversa. Non descrive turbolenza, sangue reale, stenosi, elasticità del tubo, ingresso o CFD generale.

## Riuso, diritti e seguito

Codice originale privato/UNLICENSED secondo la repository; il worker incorpora Zod con notice MIT conservata. La firma della release candidata è Ed25519, con chiave effimera solo in memoria del processo di preparazione; la sola chiave pubblica/pin è confinata alla fixture candidata. Nessuna chiave o release è aggiunta al trust store o catalogo distribuito. Non è una nuova identità/accesso a un servizio né approvazione del publisher per l'app.

`tools/check-signed-plugins.mjs`, eseguito nel check Verify esistente `signed-plugin`, ricostruisce il worker, confronta i byte, verifica firma/pin e revisione scientifica Git, poi usa Worker reale e API pubbliche Host/Core. Il rapporto `artifacts/m4-preparation.json` lega SHA/digest, fixture, esiti e misura `git diff` dalla base assegnata; la verification ne conserva il digest. Core, contratti, SDK, Host e persistenza vengono confrontati con la base, senza numeri di tempo/costo inventati. Numero di righe e byte generati non misurano efficacia didattica o costo totale di M4.

Su checkout CI shallow il controllo recupera con fetch Git in sola lettura remota esclusivamente la SHA sorgente firmata e la SHA base assegnata (timeout30s per comando), mai una branch mobile, prima di confrontare i file e misurare il delta. Con gli oggetti già presenti la verifica non richiede rete. Il consumer attende l'effettiva conclusione di tutti i Worker prima di riportare zero runtime vivi.

M4 resta `AWAITING_WEB_CONSUMER` soltanto quando la preparazione ha Verify esatta; mai ACCEPTED per questa fixture. Il packet autorizza plugins/SDK/Host/tools/docs: workspace package/lockfile, UI, server e prove browser richiedono un successivo perimetro canonico coerente. Nessun package workspace è registrato in questo incremento. Prima di integrare, preservare le correzioni runtime `d0aa2014` già su main, assenti dalla base amministrativa. Nessun merge, deploy, nuova produzione o modifica degli account.

Rollback: nuovo commit che rimuove soltanto preparazione e collegamento al check/report M4, preservando baseline originale M3, prove, cursore e dati. Nessuna migrazione o release esistente viene sostituita. Review scientifica/editoriale umana, UX browser, hardware e PostgreSQL di questo secondo dominio rimangono da osservare.
