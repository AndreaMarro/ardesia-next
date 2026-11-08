# LessonOS — ricerca riusata e decisione applicativa

8 novembre 2026. Il dossier locale del revisore `curriculum_audit` contiene fonti primarie, licenze, REA e un confronto sintetico. Questo documento registra la decisione che ne deriva; non dichiara modelli integrati o efficacia didattica.

## Dati osservabili

| Dato Core | Uso consentito dalla struttura | Informazione assente |
|---|---|---|
| Tentativo, oggetto/revisione, risposta e feedback collegato | Prova esatta, catena esplicita di correzioni | Correttezza, autonomia, singola abilità |
| Feedback e rettifiche lineari | Giudizio del docente sul tentativo, istruzione testuale corrente | Esito per criterio e rubrica validata |
| Lavoro dei corsi e aiuti aperti | Attività osservata e aiuti registrati | Assenza di aiuti esterni; indipendenza della prova |
| Parametri di laboratorio, audio e scrittura | Fonti e contesto | Comprensione, attenzione o padronanza |
| Link concettuali liberi | Memoria navigabile | Prerequisiti tipizzati e validati |

I200codici degli obiettivi sono una decomposizione editoriale, non abilità psicometriche validate. I200quesiti finali ripetuti nelle spiegazioni sono utili all’autoverifica, ma non costituiscono una misura indipendente di trasferimento. Le correzioni e gli emendamenti non vanno contati come nuove prove indipendenti o successi addizionali.

## Confronto e licenze

- BKT: [Corbett e Anderson,1994](https://link.springer.com/article/10.1007/BF01099821), abstract consultato; [pyBKT](https://github.com/CAHLR/pyBKT), MIT, blob licenza `b4306f275478362326a0a54ebfeb2972e415c7c0` verificato nel dossier originale. Probabilità latente e probabilità di risposta corretta sono distinte.
- PFA: [Pavlik, Cen e Koedinger,2009](https://pact.cs.cmu.edu/koedinger/pubs/AIED%202009%20final%20Pavlik%20Cen%20Keodinger%20corrected.pdf). Comparatore interpretabile; nessun codice donor adottato.
- [pyKT](https://github.com/pykt-team/pykt-toolkit), MIT, e [AKT](https://people.umass.edu/~andrewlan/papers/20kdd-akt.pdf): candidati sperimentali, non giustificati dai dati attuali. La separazione temporale e per studente/famiglia serve a evitare contaminazione della valutazione.
- [ts-fsrs6.0.0](https://github.com/open-spaced-repetition/ts-fsrs/releases/tag/v6.0.0), MIT, blob licenza `ba030f520ac6576497f8d43424108f9f4eaf05d6`: richiamo di item precisi e rating espliciti, non modello generale di apprendimento. Analisi statica REA su campione con sorgenti/hash ed evidenza conservati; nessuna dipendenza nuova.

Prototipo originale Python, seed20261108, script SHA256 `87ec38515d5aca4cc16de024810a4b048b3cfee58092dc6d0c84f4b36758e6db`. Confronta frequenza per abilità, BKT e PFA su dati sintetici con train/validation/test per studente; riporta Brier, log-loss, calibrazione e costi. Non è un benchmark delle librerie citate, un confronto con reti neurali/FSRS o una validazione su studenti reali. Originali e limiti sono nella consegna esterna, senza attribuire al prodotto i risultati del prototipo.

REA: ts-fsrs commit `b69d6ca2dca55579198c913fd55a43d6bf703b34`, campione FSRS-6 distinto dal default FSRS-7 della libreria6.0.0;5file/2393nodi AST, zero parse failure, semantica sconosciuta per una sorgente. Evidence `ev_d57dd13ce194c30e08db4c69117b512d29c4656e3ec2b7d1fac80fbdd8ef747a`, campione SHA256 `14b51558493cc5c1c640e5c2b217af97986163e9160cc9c1eb2080ea0a5a121d`. È analisi statica del campione, non una verifica del runtime completo.

## Applicazione concreta

Adottata una proiezione delle prove autorizzate e dei prossimi passi espliciti, senza score. La ricerca evita di aggiungere un motore di inferenza privo di input affidabili. La UI distingue l’indicazione docente dallo stato del flusso, conserva provenienza e rettifiche e dichiara la mancata stima dentro un dettaglio consultabile.

Prossima dipendenza reale: raccolta versionata di item/criteri, contesto strutturato degli aiuti e opportunità indipendenti. Solo dopo, baseline in modalità sperimentale con configurazione e split congelati, astensione esplicita, confronto di accuratezza/calibrazione/costi e valutazione dell’utilità didattica. I contratti di LessonOS continuano a vietare un secondo ledger o un’autorità dei permessi.
