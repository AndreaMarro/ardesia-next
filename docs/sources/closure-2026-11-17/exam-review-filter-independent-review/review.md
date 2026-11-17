# Review indipendente — filtro del ripasso, chiusura 17 novembre 2026

**PASS sul candidato dopo la correzione della label. Nessun rilievo funzionale residuo.** Review di un agente distinto dall’autore, conclusa entro il mandato di chiusura. Nessuna modifica al repository condiviso, nessun DB condiviso usato, nessuna pubblicazione.

## Identità approvata

I quattro file candidati coincidono ancora con gli hash congelati dopo il label fix (`closure-identity.json`):

- `tools/physics-runtime/exam.js`: `7842ebd678ef796d66a23468fef116f4fdb98cd2b0855d8a3d253198461233f7`
- `tools/build-physics-exam.mjs`: `26b2be944dd30b6079963db2b90cfdd160b360766925ac80a57d339b47c2f212`
- `apps/web/public/fisica/exam.css`: `c3401c68935c6b71578e5839f9903711662e571ecdc35125fe6e4d15705f3edb`
- `e2e/physics-review-filter.spec.ts`: `ed377737944bc646e95b3c04bf1bf3b38fb3f13a2ee6a2c19a7b5d6809a6907b`

La rigenerazione in una directory isolata produce runtime, CSS, pagine A/B e ZIP byte-identici a quelli root (`artifact-identity-final.json`). Runtime minificato: `050c4f2c6a18b138d876e9ff668b6613a0b89ea33455b4877cf4ac8907409415`, 20.415 byte. ZIP: `517f47d0d75b6b5812d36c62c339591a917c212d4ac47dbba64c49fb94509916`, 3.389.909 byte, 65 nomi unici; runtime interno identico al pubblico.

## Comportamento verificato

`check.cjs` e `checks.json`: **178 controlli indipendenti PASS**, Chromium su macOS, pagine reali `file://`, contesti offline, A/B a 320 e 1280 px. Ogni prova contiene 11 corrette, 10 errate, 10 bianche e cinque flag distribuiti fra le categorie.

- Tutti i filtri (`all`, `wrong`, `blank`, `flagged`, `correct`) mostrano esattamente gli ID/indici attesi e il conteggio coerente. Il filtro dei flag include anche domande corrette o non risposte, senza confonderle con gli errori.
- I 31 dettagli restano nel DOM; il filtro cambia soltanto la visibilità. Testi, stato di apertura dei dettagli, punteggio, risposte e flag restano invariati.
- **48 download reali**, JSON e HTML, prima del filtro e dopo ciascuna selezione: ogni file successivo è byte-identico al corrispondente export iniziale. Tutte le 31 domande sono presenti, anche quando il ripasso visibile è filtrato.
- Il nuovo tentativo riparte da `all`; nessun flag precedente resta attivo. Gruppi vuoti mostrano il messaggio esplicito e tornare a `all` ripristina 31 righe.
- La label esatta «Mostra nel ripasso» risolve il select, il controllo riceve focus, ha altezza ≥44 px e non genera overflow a 320 px. Screenshot mobile B ispezionato: label, focus, selezione e conteggio leggibili.
- Zero errori JavaScript e zero richieste HTTP.

La prova precedente `engine-invariance.json` è riutilizzata, essendo invariato lo stesso hash runtime: **11 funzioni esportate del motore sono identiche** al sorgente prima del filtro, inclusi grading, parser dei tentativi e generatore del ripasso HTML. Il diff cambia solo costruzione/visibilità del ripasso e il relativo controllo UI; non introduce storage, rete o nuove autorità.

Il test e2e dell’autore copre correttamente A/B, gruppi, export completo e reset; il log finale root registra 6/6 PASS (quattro casi filtro e due import quaderno). È evidenza corroborante dell’autore, distinta dai 178 controlli qui eseguiti.

## Difetto iniziale e tracciabilità della patch

La label iniziale avvolgeva il select e faceva entrare le option nel nome cercato. Il fallimento è riprodotto indipendentemente e conservato in `initial-label-failure.json`; la struttura finale `div > label[for] + select` elimina la causa e passa il locator esatto.

**Attenzione alla sola patch storica:** `candidate.patch`, SHA `91ad23e8f851a87d94c687aac11f38c3eafd06edca970df0726fdce376d4d8d6`, contiene ancora la struttura iniziale. Non rappresenta i file finali approvati. È disponibile `reviewed-after-label-fix.patch`, generata dai tre file corretti contro le basi 708f5a9 verificate con `base-hashes.json`, SHA `2788048c7246f256faf7411c0f0813ce8deca61186cf0496d75aa120d406ffc3`. Nessun file root è stato modificato per correggere questa evidenza.

## Limiti e fallimenti dell’harness conservati

Una prima sequenza di molti download ravvicinati si è fermata su timeout, dopo aver già verificato export invariati per quattro filtri; `initial-download-burst-failure.json` resta conservato. Il rerun finale distanzia i download di 1,1 secondi e completa tutti i 48. Non attribuiamo al timeout una diagnosi browser definitiva non osservata.

L’harness presumeva che Home/Enter selezionasse la prima option. La stessa mancata selezione è stata riprodotta su un select HTML minimo nel Chromium headless (`keyboard-check.cjs`); il fallimento è conservato. La prova finale certifica label, focus e cambio filtro tramite il normale evento del select, **non** un’interazione completa da tastiera nel menu nativo. Non sono stati verificati dispositivi mobili fisici, screen reader, deploy remoto o una nuova revisione scientifica dei quesiti.

La prima ricostruzione del ZIP isolato includeva due copie del LEGGIMI perché il fixture proveniva da uno ZIP estratto; il LEGGIMI di input è stato rimosso prima della rigenerazione canonica. Il ZIP finale ha 65 nomi unici ed è identico a root. Nessun difetto analogo è presente nel pacchetto root.

Tutti i processi di questa review sono conclusi. Non rimane lavoro su questo incarico.
