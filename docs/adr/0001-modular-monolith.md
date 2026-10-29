# ADR 0001 — Un monolite modulare, una sola autorità

**Stato:** decisione architetturale adottata per M0; verifica del candidato separata.  
**Data:** 29 ottobre 2026.

## Decisione

Usare una sola app React/Vite/TypeScript e package npm workspace `contracts`, `core`, `lesson-os`, `plugin-sdk`, `plugin-host`, `ui`. I consumer dipendono soltanto da export pubblici. Un controllo automatico verifica i confini; nessuna app importa gli internals di un'altra.

Il Core accetta i comandi e possiede documenti, revisioni, ricevute ed eventi. LessonOS produce proiezioni ricostruibili senza altro store. Lavagna, taccuino e lettura mostrano gli stessi oggetti educativi. L'host plugin riceve porte esplicite dalla composition root e non accede direttamente al provider dei dati.

M0 usa un adapter locale con un solo writer. Documento modificato, evento e ricevuta sono contenuti nello stesso snapshot e nella stessa scrittura atomica. L'architettura futura mantiene un'unica autorità remota; il provider verrà scelto a M3 dopo verifica di disponibilità e costi.

## Perché

Il legacy contiene invarianti preziose del Core, ma anche confini che attraversano le app. L'audit su `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605` ha individuato import diretti di `CoreFluidLab` da internals Studio e proiezioni LessonOS collegate a dettagli della shell. Copiare l'intero albero trasferirebbe questi vincoli nel nuovo prodotto.

Il lavoro richiesto non ha ancora bisogno di processi indipendenti o coordinamento distribuito. La modularità viene provata dai contratti e dai consumer, non dal numero di servizi.

## Alternative considerate

| Alternativa | Valutazione |
| --- | --- |
| Copia completa di Ardesia | Rifiutata: non è recupero selettivo e conserva accoppiamenti e superfici concorrenti |
| Monorepo con più app/player autonomi | Rifiutata per M0: moltiplica ingressi, composizione e autorità possibili |
| Microservizi e bus eventi separato | Rifiutata per assenza di bisogno verificato; aggiunge transazioni distribuite e gestione operativa |
| Una sola app senza confini interni | Insufficiente: sposta gli accoppiamenti dentro un unico bundle e rende più costoso il riuso |
| Monolite modulare con porte pubbliche | Scelta: unica integrazione, contratti verificabili, possibilità di estrazione futura motivata da prove |

## Conseguenze

L'integratore è unico. Le modifiche ai contratti richiedono aggiornamento dei consumer e prove di compatibilità. Un renderer scientifico non possiede autenticazione, progressi o un ledger indipendente.

Il contratto locale di ownership non è sicurezza multiutente: l'app può costruire l'attore. Il passaggio remoto richiederà sessioni autentiche, policy server e transazioni durevoli senza mantenere due autorità parallele.

Il lockfile è unico. Non si aggiunge un orchestratore di build fino a quando tempi o dipendenze effettivi ne dimostrino la necessità.

## Evidenza e accettazione

- [Audit legacy e percorsi alla SHA](../sources/legacy-review.md).
- [Architettura e responsabilità dei package](../architecture.md).
- [D01–D68 originali](../acceptance/D01-D68.json): in particolare D45–D58 per ricevute, persistenza e autorità unica; tutti ancora NOT_RUN come accettazione prodotto.

Prove richieste sul candidato: build di una sola app, import attraverso API pubbliche, stessa identità degli oggetti nelle tre viste, rifiuto di comandi invalidi/revisioni obsolete e comportamento atomico del provider locale. Questa ADR non dichiara che siano già passate.

