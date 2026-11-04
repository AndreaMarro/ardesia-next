# Incarico ingegneristico canonico

Usare la riga della coda unica adottata, senza creare un backlog parallelo.

- Task ID, owner, consumer reale e rischio.
- procedureRef immutabile, base/source SHA, branch e scope di tutti i file del flusso.
- Dipendenze completate e blocker risolti con prove accessibili.
- Contratto readiness adottato: requiredPaths, requiredCapabilities, requiredEvidence, executionProfiles ammessi, rollback e maxObservationAgeMs.
- Osservazioni effettive recenti del runner: Node, fixture/accessi e profilo/effort dalla piattaforma; fonte, istante e limiti conservati privatamente.
- Digest task/policy/requisiti e binding alla sorgente osservata; unknown è un blocco, non un valore da inventare.
- RED/GREEN del consumer, Verify sulla head finale, review non autrice, adozione e prova reale distinti.
- Claim/CAS senza force, budget originario, ricontrollo CLI prima di mutare e chiusura recuperabile.

READY è un requisito necessario e non concede autorizzazioni. Vedere `docs/e1-task-readiness.md`.
