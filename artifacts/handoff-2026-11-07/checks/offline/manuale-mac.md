# Collaudo manuale sul Mac — 7 novembre 2026

Interfaccia: browser IAB sul Mac corrente, origin127.0.0.1:4180. Sorgente del build osservato:3b7fd47ea5c77243c8a0c6d2bd4779437205e395be922619f56d95f31ec08226. L'ultima correzione successiva riguarda soltanto il collector QA del cambio account e lo storico; non cambia i byte JS/CSS dell'interfaccia.

Database di anteprima ardesia_local_preview, separato da *_browser e *_test. Nessun reset o provisioning durante questo collaudo.

1. Lezione «Onde e oscillazioni», revisione9, nota/formula/tratto già esistenti.
2. Impostazioni → Rendi disponibile offline → Usa copia offline. Stato locale esplicito, nessuna sessione online dichiarata; note e formula leggibili, laboratorio non eseguito.
3. Tratto disegnato con drag reale dello strumento browser: un comando da confermare.
4. Arrestato esclusivamente il server locale della preview, lasciando PostgreSQL e test separati invariati. Ricaricata la pagina: shell e lezione disponibili, primo tratto mantenuto.
5. Aggiunto secondo tratto con server spento. Nuovo reload: due tratti mantenuti, revisione della copia9. Screenshot outputs/ardesia-offline.png acquisita in questo stato.
6. Riavviato il server tramite Avvia Ardesia.command, senza seeding/reset. Ricollegati al server: entrambi i comandi ancora in attesa; successore disabilitato fino alla prima ricevuta.
7. Ripresi esplicitamente primo e secondo comando. Ricaricata la pagina: lezione revisione11, tre tratti confermati (uno precedente e due recuperati), nessun pending visibile.

Non si tratta di distacco della rete fisica, crash/power-loss, chiusura dell'intero browser, iPad/Apple Pencil o Safari. La prova automatizzata aggiunge context.setOffline(true), chiusura pagina/nuova pagina, IDs e payload esatti, controlli PostgreSQL e viewport mobile; resta emulazione.

Il binding CUA ereditato inizialmente rifiutava alcune azioni prima dell'esecuzione; riacquisita la medesima scheda con l'API documentata, il percorso sopra è stato eseguito. Nessuna modifica alle impostazioni di sicurezza.
