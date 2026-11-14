# Catalogo: una sola copia per aggiornamento

La griglia C1–C5 leggeva15volte la proiezione difensiva completa e10volte lo spazio corsi ad ogni render. Durante l'importazione, ciascun comando aggiorna lo stato del client e la progressione della UI. Le cinque schede ora condividono una singola lettura sincrona di actor, spazio corsi e stato pending. Nessuna cache fra render, modifica di API o rimozione delle copie ai confini pubblici. Il click continua a rileggere l'identità e il corso correnti.

Sul Mac M4 con Node24.22.1, Chromium desktop e PostgreSQL locale isolato, il test esistente `e2e/physics-start.spec.ts` esegue avvio C2, risposta privata, reload e ripresa. Tre esecuzioni prima:32.489/32.524/32.326ms; tre dopo:24.546/24.047/24.024ms. Mediane32.489→24.047ms, **−25,98%**. SeiPASS; fixtureC2 invariata. JSON conserva hash sorgenti, report e buildIdentity.

Questa è la durata completa del test, non il solo tempo d'importazione. Ordine prima/dopo, trecampioni e Mac condiviso: non è una prova hardware isolata o una garanzia di prestazioni remote. Il beneficio è successivo alla correzione delle migrazioni correnti; le percentuali non vanno sommate.

La review indipendente confronta la UI prima/dopo con consegna attiva/revocata, pending e account diverso, includendo un handler trattenuto dal render precedente. Il suo harness usa i veriTSX con mockReact/JSX, distinto dalle sei prove browser del coordinatore. Le validazioni, le revisioni, i comandi e il database restano invariati. Rollback: revert del solo componentecatalogo.
