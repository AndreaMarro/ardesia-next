# Recupero circoscritto del 3 novembre 2026

## Incidente osservato

La run `ardesia-dev-20261103T021000Z-01a19f2a`, chat nativa
`01a19f2a-5687-73c2-ae66-db18abb46ed2`, termina failed alle 02:40:15 UTC
con `workspace routing discovery timed out`. Ultimo comando completato:
02:31:59 UTC; nessun finish pubblicato. Questa è la causa osservata della
mancata chiusura; la causa interna del router resta UNKNOWN.

Alle 08:45–08:46 UTC il turno è inattivo/fallito; CLI32728, server8126 e
browser8220 della run sono assenti. PostgreSQL6681 appartiene a una run
precedente e resta attivo. Nessun processo viene ucciso. La scadenza del
claim non è stata usata come prova di cessazione.

I 24 file privati della run e il test locale non tracciato
`e2e/local-diagnostic.spec.ts` sono conservati. Manifest SHA256:
`3039a472cd24a7d562157c809aead6711eee07abe1e2b2fc00370745ddf10da1`;
inventario locale `64190cfb4f983d8ede3601a03949f244c416fa12fef4274ebfded6400ca6a6e1`.
HEAD locale e remota M4 coincidono a `5460e636c2f3a48b1c2713993ca96cde9689858a`.
254 file della copia originale sono dataless iCloud; alcune letture di
file/Git restano sospese. La copia è preservata in posizione; si usa una
copia locale completa della stessa SHA. Non è dimostrato che iCloud abbia
causato l'errore interno del router. Nessun log grezzo, segreto o dump è pubblicato.

## Risultato prodotto e limiti

Sorgente M4 invariata, digest
`72b6be805877c6a5899220a99de102bcebf22ed05f68eb6829e5d011ed0e037d`:
Node24.22.1/Playwright1.56.1/Chromium1194/PostgreSQL16 loopback, dieci scenari
originali PASS, molla concorrente e quattro percorsi Poiseuille per desktop
e mobile. Nessun timeout, soglia, retry, test o implementazione modificato.
Report privato SHA256 `ec250c3e299af2a134d52b25418d1e49a5fd95470584d04dff9a33896c4e5990`.
Il vecchio FAIL8kg/6kg e i timeout di setup restano FAIL: il nuovo ambiente
discrimina un fattore, senza provare la causa precisa del vecchio esito.

La successiva suite completa sulla stessa sorgente termina1PASS/3FAIL e
77NOT_RUN dopo SIGINT controllato al solo Playwright78752: mount molla
senza pannello ready, salvataggio learner non osservato e setup marketplace
oltre30s. Report SHA256 `221b13254294d377615fcae5d43c2286fa3c69f175283a4e449ba8bce237a48e`.
Alle09:11Z load average127.13/113.85/68.49; gli stessi88test operativi
impiegano80s contro3s prima. È una condizione osservata, non prova che
la contesa spieghi ogni FAIL. Nessun timeout aumentato o FAIL cancellato.

Bundle riprodotto:289068/245760byte gzip, FAIL. Main127777, KaTeX76060,
worker molla42463, worker Poiseuille42768. L'esperimento con i normali
compressori Terser abilitati produce289632byte, peggiora e non è adottato.
Rinomina/esclusione degli asset e import dinamici non risolvono il gate totale.
Una futura release compatta richiede equivalenza wire/scientifica,
riproducibilità storica e autorizzazione esplicita dei nuovi pin. Le chiavi
private delle release erano effimere: non vengono cercate o ricreate.
Nessuna nuova chiave, firma, pin, integrazione, preview o accettazione M4.

## Difesa minima proposta, non adottata

Un errore fatale della piattaforma può impedire qualsiasi finally del
modello. Il helper nel repository non garantisce la chiusura del turno nativo.
La difesa opera nel bootstrap successivo esistente: `cycle.mjs recover`
ricostruisce esplicitamente il checkpoint interrotto, poi usa il normale
HANDOFF con la coda alla procedureRef. Nessun daemon, scheduler o altro
orchestratore. Il comando emette solo JSON: non osserva/ferma processi,
non contatta servizi e non pubblica ref.

Il coordinatore acquisisce prima il turno nativo terminale, verifica i writer
e conserva il lavoro. Fornisce una ricevuta privata con kind
`ardesia-native-terminal-recovery`, runId/threadId, status failed/interrupted,
completedAt/observedAt ISO, writersStopped:true, preservationDigest SHA256 e
reference della prova. Sono dichiarazioni del chiamante: il helper non ne
autentica verità, completezza o indipendenza. Pubblicazione comunque con
parent atteso/CAS/no force e rilettura, preservando l'intero tree corrente,
incluso vercel.json. La scadenza da sola non abilita recover.

Controprove nel test sequenziale esistente: scadenza senza prova; stato
running/completed; altro run; writer non cessati; conservazione assente;
tempi impossibili; revision errata; cambio sorgente/evidenza/criteri/scope;
coda inventata; CI pendente. Il caso valido conserva FAIL, identità e tempi
originali, registra late e lega la summary ai digest della ricevuta terminale
privata e del lavoro conservato. Se la finestra residua non supera dieci
minuti, rilascia come INTERRUPTED senza rinnovare expiresAt; altrimenti
HANDOFF dello stesso task. Non acquisisce automaticamente un writer.
Il nuovo claim usa il suo avvio reale. Questi due casi e il legame durevole
alla ricevuta sono controprove aggiunte dalla review non autrice.

Proposta distinta dal consumer M4: review non autrice e Verify della propria
sorgente precedono l'eventuale adozione. La procedureRef effettiva resta
`e947ac98e828e9e2ff6c1bb484c35fb45a93ba4b`. Rollback con nuovo commit dei soli
helper/test/nota e rettifica nello storico, conservando prove e cursore corrente.
