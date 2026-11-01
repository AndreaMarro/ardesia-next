# Cursore Pro/Codex — Ardesia Next

Preparazione della coppia richiesta dal titolare il 1 novembre 2026. La presenza di questa ref **non attiva attività pianificate**. La precedente attività delle 06:00 rimane invariata finché il titolare non la sostituisce o mette in pausa e ne verifica la cessazione.

`handoff.json` contiene soltanto incarico corrente, proprietario temporaneo e riferimenti alle prove. Non è una roadmap, un gate o una prova di accettazione. La coda e lo storico restano nel sorgente; il metodo adottato è individuato da `procedureRef`.

- [Protocollo e prompt](https://github.com/AndreaMarro/ardesia-next/blob/a8914c305b582e9ec46d5b6bf0b54eefe3ff2321/docs/recurring-work.md).
- [Checkpoint di preparazione, review e CI](https://github.com/AndreaMarro/ardesia-next/pull/20).
- [Blocco remoto M3](https://github.com/AndreaMarro/ardesia-next/issues/19).

Questa ref contiene solo README, handoff e disabilitazione del deploy Git. **Mai unirla a main, usarla come sorgente applicativa, aprire una PR applicativa da essa o distribuirla.** Nessun workflow.

Ogni aggiornamento valido è un nuovo commit figlio della head appena letta, pubblicato senza force e con expected SHA quando disponibile. Rileggere il risultato remoto. La scadenza non autorizza takeover; un runner precedente richiede prova di cessazione e riconciliazione. Nessun segreto in questo registro pubblico.

Il budget parte dal vero avvio: lavoro entro 45 minuti, chiusura entro 55. Il registro non è un watchdog né un lock atomico fra piattaforme.
