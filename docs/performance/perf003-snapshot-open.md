# PERF-003 — riapertura degli snapshot correnti

Il consumer è `PostgresStore.openLocked`, che apre il Core a ogni lettura/comando
autenticato. `createCore` provava i contratti legacy v1/v2 e v3 anche per snapshot
v4: i parser percorrevano documenti ed eventi prima di scartare la versione.
La modifica riconosce esclusivamente la versione corrente e conserva la successiva
validazione completa `CoreSnapshotSchema`, il clone isolante e tutte le migrazioni
storiche. Nessun formato, regola di dominio, transazione o autorizzazione cambia.

## Evidenza di partenza e ipotesi

Prima delle misure è stato letto l'artefatto Extended originale della
[PR18](https://github.com/AndreaMarro/ardesia-next/pull/18), run
[41216361872](https://github.com/AndreaMarro/ardesia-next/actions/runs/41216361872),
artefatto13048346831: ZIP SHA256
`951b47d3701388bae809a9609831ac9599014090330c202d25e2d466b5d55f18`, CRC valido,
head174d15bb/digestde1f7e93. I suoi 100 campioni documentano la crescita da532
a732 tratti, 591→891 eventi e2013248→2807868 byte JSON PostgreSQL. LessonOS
p50=0,134ms e riapertura Store p50=316,4ms non sono una decomposizione causale.
Non è stato rilanciato Extended.

Unica ipotesi: i tentativi di migrazione scartati su v4 contribuiscono al costo
CPU della riapertura. L'esperimento usa gli stessi conteggi ai due estremi, 32
punti/tratto, 24 assegnazioni e note personali. Il seed usa comandi pubblici Core;
10 round iniziali e100 successivi aggiungono ciascuno una rinomina e due tratti.
Le fixture sono sintetiche deterministiche, non copie dei byte PostgreSQL PR18:
1775778 e2479618 byte `JSON.stringify`, hash riportati nei campioni.

## Confronto sullo stesso ambiente

Apple M1/8CPU, macOS kernel25.0.0 arm64, Node24.22.1, npm11.17.0, Vite8.3.5.
Baseline `d74b8dfa3ada65594a96604146c60df73118ccbd`, candidato con la sola modifica
di `createCore`; lockfile e contratti identici. Due runner Vite con alias espliciti
caricano i rispettivi sorgenti, senza dipendere dai link workspace dell'altro.
30 coppie per profilo dopo10 warmup, ordine baseline/candidato alternato AB/BA;
campioni grezzi e differenze accoppiate conservati. I percentili usano nearest-rank.

| Tratti | Baseline p50/p95 ms | Candidato p50/p95 ms | Mediana differenze accoppiate ms |
| --- | ---: | ---: | ---: |
|532|99,70 /105,14|44,43 /47,04|54,39|
|732|138,77 /161,27|62,59 /71,86|76,27|

Tutte le60 coppie favoriscono il candidato in questa esecuzione. I tentativi
legacy isolati hanno p50=56,10/78,42ms. Validazione corrente e clone sono misure
di calibrazione separate: non si sommano percentili per attribuire quote di costo.
Il controllo precedente con codice identico dà mediane delle differenze
accoppiate −1,07/+1,66ms; usa le stesse fixture. Le esecuzioni non costituiscono
una distribuzione di macchine, un test di capacità o una garanzia di latenza.

Confine misurato: chiamata pubblica `createCore`, lettura in-memory dello stesso
oggetto come nello storage adapter del server. PostgreSQL, autenticazione, lock,
commit, HTTP/TCP/TLS, renderer, dispositivi fisici e SLA non sono misurati.
Non si confrontano i tempi locali con quelli della macchina CI di PR18.

## Identità, correttezza e riproduzione

I [campioni del candidato](perf003-core-snapshot-samples.json) conservano il digest
del tree misurato `c873126e7771951a9622d494660ad186733b985f470032d05828f1d9cd794c94`.
La misura precede il commit e l'aggiunta di questi documenti: il campo commit
registra HEAD base d74b8dfa, non afferma che quella revisione contenga la patch.
L'hash SHA256 del Core misurato è
`ced44c257840741ff4c40ce89873b00adf29b29cd3aec484862657fa9a173f57`;
quello baseline è `023af3c79bec0d439465ee92f493ac6179765d271e372cb45ddd7b2b9ef16abf`.
La Verify obbligatoria della sorgente finale include anche documenti e campioni;
il suo esito va letto nella PR/cursore, senza trasferire PASS fra digest diversi.
Il [controllo identico](perf003-same-source-control.json) conserva la prova separata.

Per ogni fixture entrambi i Core riaperti producono lo stesso snapshot esatto,
non mutano l'input e non scrivono. I test di compatibilità riaprono v1/v2/v3/v4
senza scrivere o modificare i byte e controllano l'isolamento da mutazioni esterne.
Snapshot correnti con ricevute mancanti, revisioni o sequenze incoerenti restano
INVALID_SNAPSHOT senza riparazioni automatiche. Restano applicabili le controprove
Core/server per idempotenza, revisioni, fallimenti atomici, ownership e revoca.

```sh
# Dal checkout candidato, Node24 e dipendenze del lockfile installate:
node tools/profile-core-snapshot.mjs /percorso/checkout-baseline-d74b8dfa
```

Il comando genera solo `artifacts/core-snapshot-profile.json`; la misura non è un
nuovo gate né una modifica alla CI. Procedura adottata separata2909aa7d; questo
incremento non incorpora la proposta locale41124470, non modifica la coda o
l'accettazione M3 e non integra main/preview/staging. Rollback: nuovo commit che
ripristina il solo dispatch di apertura Core dalla base; conservare campioni,
test di compatibilità e storia. Nessuna migrazione o riparazione dati richiesta.
