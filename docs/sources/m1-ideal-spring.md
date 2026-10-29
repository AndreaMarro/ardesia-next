# M1 — Provenienza della molla ideale

29 ottobre 2026. Repository sorgente consultato in sola lettura: `AndreaMarro/ardesia`, revisione `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`. Non sono stati modificati file o deployment del progetto precedente.

## Recupero selettivo verificabile

| Fonte esatta | SHA-256 del contenuto UTF-8 consultato | Decisione |
| --- | --- | --- |
| [spring.py](https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/packages/engine/lessonos/study/spring.py) · 1.751 byte | `9b4838c4474de7189077630d86195504b8951a584340e571e1bdd566162f54a7` | Recuperate legge di Hooke, energia elastica, unità SI e necessità di rifiutare input non fisici. |
| [test_spring_activity.py](https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/packages/engine/tests/study/test_spring_activity.py) · 1.879 byte | `e1a8a5ef639371b64f53c940b1c5ce0a677bab1824baaba5d052ea1f308a49bf` | Conservati i cinque esempi numerici indipendenti e il principio delle controprove su tipo, finitezza e limiti. |
| [test_public_spring_projection.py](https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/packages/engine/tests/study/test_public_spring_projection.py) · 1.587 byte | `ac21a7e14bb30c940146ad6691ef60c9b91937c58c0d8d8b329dbe9cf2b06229` | Recuperato il controllo energetico indipendente tramite il lavoro; la tabella precalcolata di 63 casi non è stata importata. |
| [PublicSpringModel.tsx](https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/apps/web/src/components/PublicSpringModel.tsx) · 3.402 byte | `5d1f941662f0ffaf4c04fc39ae334b34d0766fe4103d51f7c59a890b15e73f95` | Verificata la separazione tra risultati scientifici e loro rappresentazione. Nessun componente React è stato copiato. |

Il donor è un modello **statico**: una forza applicata positiva produce `x = F/k`, con `U = kx²/2`. Non contiene la dinamica di un oscillatore. M1 reimplementa questi invarianti e aggiunge esplicitamente una nuova soluzione analitica del moto armonico; non attribuisce al legacy una funzionalità che non possedeva.

Nei cinque esempi recuperati, `F` è la forza esterna che mantiene l’equilibrio. Nel nuovo esperimento libero, la **forza elastica** iniziale è `−F`: i test distinguono i segni. Gli esempi `(F, k, x, U)` sono `(0,20,0,0)`, `(4,20,0.2,0.4)`, `(4,40,0.1,0.2)`, `(6,80,0.075,0.225)` e `(10,20,0.5,2.5)` in unità SI.

Non sono stati trasferiti il player legacy, un secondo store, adapter di autenticazione, rendering HTML, dipendenze o route autonome. Il consumer del recupero è il worker `plugins/ideal-spring/src/worker.ts`, eseguito attraverso il Plugin Host; il salvataggio dello stato passa dal Core.

## Fonti scientifiche della nuova dinamica

Sono state consultate le sezioni originali dell’editore:

- OpenStax, *University Physics Volume 1*, [15.1 — Simple Harmonic Motion](https://openstax.org/books/university-physics-volume-1/pages/15-1-simple-harmonic-motion): forza di richiamo, equazione del moto, pulsazione, periodo e frequenza.
- OpenStax, *University Physics Volume 1*, [15.2 — Energy in Simple Harmonic Motion](https://openstax.org/books/university-physics-volume-1/pages/15-2-energy-in-simple-harmonic-motion): energia elastica, energia cinetica e conservazione dell’energia meccanica.

La soluzione con posizione e velocità iniziali indipendenti è la combinazione lineare seno–coseno dell’equazione `m x″ = −kx`. Equazioni e spiegazioni sono state scritte per questo plugin; non sono state copiate illustrazioni o parti di testo del libro.

## Licenza, qualità e limiti

Nell’albero completo del donor alla revisione indicata non risulta una licenza generale alla radice. Le licenze di componenti vendor presenti altrove non concedono diritti sull’intero progetto. Il recupero richiesto avviene all’interno dei repository privati del medesimo proprietario; il nuovo package resta `private: true` e `UNLICENSED`. Non viene presentato come codice open source redistribuibile.

Le formule sono valutate analiticamente, senza integrazione numerica a passi e senza errori di accumulo del tempo. I test includono controlli indipendenti di derivate e di conservazione dell’energia, oltre ai casi SI recuperati. I risultati dei comandi e delle prove browser devono essere letti negli artefatti della revisione candidata; questo documento non costituisce un esito automatico di accettazione.

Il modello è lineare, orizzontale, privo di attrito e con molla senza massa. Non tratta smorzamento, gravità lungo l’asse, forzanti, urti, deformazioni plastiche, limiti elastici misurati o una molla reale di lunghezza data. La vista rimane DRAFT. La verifica matematica e software è distinta dall’approvazione pedagogica umana e non dimostra completamento di M2 o M3.
