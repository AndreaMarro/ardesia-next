# Handoff di chiusura — 17 novembre 2026

Il lavoro della sessione del 14 novembre è consolidato in Git, compresi gli ultimi miglioramenti e i candidati non integrati. Questa chiusura risponde alla nuova richiesta diretta «Finisci il lavoro in corso fai handoff e metti tutto su github». Non riapre la finestra autonoma di cinque ore: il watchdog ha segnalato l'arresto il 14 novembre alle 06:30:26.005 UTC; l'interruzione per quota e le verifiche rimaste incomplete sono conservate.

## Versioni e pubblicazione

La PR54 è già stata integrata esternamente in `fd437db`; non è più una draft aperta. Il 17 novembre sono stati riletti il cursore a `fdc73583e2c4db28c7f22331c67902d37bc14b6a` (revision178, nessun activeRun) e main a `26e414777970d1eaddedc7069b78d4a9f6f738f2`, successivo alle PR55–57. La branch `codex/physics-closure-20261117` incorpora quel main e conserva i suoi fix database/readiness, percorso pubblico Poiseuille e media. Nessuna modifica al cursore o ai gate M5; nessun merge della PR su main o deploy produzione in questa chiusura.

I soli conflitti erano lo ZIP e il manifest generati, ricostruiti dai sorgenti uniti. La PR di chiusura raccoglierà le ricevute di Verify, CI e preview della SHA finale. Consultare la PR associata alla branch per lo stato definitivo: questa pagina non anticipa un PASS o READY non ancora osservato. La precedente CI43555267457 sulla SHA708f5a9 è stata letta nell'artefatto originale: Verify8/8,699unit,295browser,0skipped/flaky/errori.

## Ultimo incremento completato

Dopo la consegna della prova A/B, «Mostra nel ripasso» filtra tutte le risposte, errori, bianche, segnalate o corrette. Punteggio ed esportazioni mantengono tutti i31quesiti; un nuovo tentativo riparte senza filtro. Review indipendente:178controlli e48download reali invariati su A/B desktop/mobile. Label iniziale corretta; limiti del menu nativo da tastiera headless documentati.

Il test web importa il quaderno pubblico di7pagine, verifica un solo asset e i byte originali, disegna sulla pagina7 e controlla dati e rendering dopo reload. La variante rafforzata indipendente è integrata. Nel drawer il materiale è correttamente chiamato «Materiale originale». Icone e nomi riusano la mappa già presente nelle proprietà, senza cambiare selezione o permessi. La prima verifica dopo la riconciliazione superava il budget Core di50byte: il limite resta336KiB, la duplicazione è rimossa e i nuovi messaggi del filtro abbreviati. Consultare il valore finale nelle ricevute; il margine rimane molto ridotto.

Le esperienze e i risultati precedenti sono in [handoff14novembre](2026-11-14-physics-beta.md); i successivi sviluppi già pubblicati sono in [handoff16novembre](2026-11-16-product-experience.md). I conteggi non cambiano:38lezioni,279problemi/verifiche nelle lezioni, due prove da31domande, cinque laboratori e quadernoPDF7pagine. Tutto resta DRAFT/humanApproval=false.

## Companion e candidato preservato

La build stabile macOS, sorgenti e ZIP sono consegnati senza cambiamenti: penna/gomma, pagine, undo/redo, file locale, autosave dei file nominati ed exportPDF. Firma ad hoc, niente notarizzazione, sincronizzazione o qualificazione iPad/Pencil.

L'importazione PDF nativa resta **candidato non integrato**, interamente recuperabile dalla patch e dal dossier. Review indipendente PASS:18suite più8casi lifecycle; originali incorporati una sola volta conSHA256, limiti12MiB/PDF,32MiB/quaderno,64pagine, compatibilità schema1 e nuovo schema2. Root ha verificato pannello reale,7pagine aggiunte alla pagina iniziale, undo/redo, resa della prima pagina, annullamento di un nuovo import e salvataggio. Il trascinamento CUA non ha raggiunto la finestra: non viene dichiarato un difetto del prodotto, né un PASS della scrittura visibile. Restano disegno-salvataggio-riapertura visibili, layout minimo e build integrata. La build stabile e il PDF didattico continuano quindi a dichiarare correttamente che il companion non importa PDF.

## Dove riprendere

[Archivio con manifest e rapporti](../sources/closure-2026-11-17/README.md). Il candidato nativo può essere ricostruito applicando `native-pdf-import-build/candidate.patch` dopo `git apply --check`; i21hash e le istruzioni sono nel dossier. Completare le prove UI mancanti prima dell'integrazione, poi aggiornare pagina7 del PDF, guida e build. Non riapplicare la vecchia patch del filtro: la versione corretta e il codice integrato sono distinti e identificati.

Web: Node24, `npm ci`, PostgreSQL isolato e variabili M3_* secondo gli script esistenti; `npm run verify`, quindi `npm run test:e2e -- physics-review-filter.spec.ts physics-workbook-import.spec.ts physics-journey.spec.ts`. La suite CI completa resta distinta dai test locali mirati. Le prove native richiedono macOS; i testbrowser emulati non certificano penne/dispositivi reali.

Il kit viene congelato sulla SHA pubblicata e verifica il download GitHub anonimo byte per byte. È una bozza non inviata per anteprima gratuita e richiesta informazioni, senza prezzo/checkout/prenotazioni. L'obiettivo commerciale originario del16novembre è trascorso; non è attestato un lancio completo. SSO Vercel resta attivo: READY non prova un percorso Core autenticato. Usare il link allo ZIP per l'anteprima offline, non una preview protetta presentata come pubblica.

Rollback: revert del delta di chiusura, senza reset, rimozione dei dati o downgrade silenzioso dei quaderni. Il successivo lavoro utile è la verifica UI del candidato PDF; revisione scientifica umana, prove fisiche e accettazione remota del candidato restano gate separati.
