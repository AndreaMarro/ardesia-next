# Ardesia Next

Uno spazio educativo indipendente per lavagna, taccuino, lezioni e laboratori componibili.
Repository privata. **Prima consegna M0: fondazione verificabile, non prodotto completo.**

## Avvio e verifica

Node 24, npm e il lockfile incluso. Dalla root:

```sh
npm ci
npm run dev
npm run verify
npx playwright install chromium
npm run test:e2e
npm run status
```

`verify` controlla tipi, confini fra moduli, test di comportamento, build e budget JavaScript.
La CI esegue lo stesso percorso sul commit esatto della PR, aggiunge Chromium desktop e mobile
emulato, e conserva le prove con la SHA nel nome dell'artefatto. I dispositivi fisici non sono
certificati da questi test.

## Percorso realmente disponibile in M0

Apri la bozza personale, modifica nota o formula, salva, passa fra Lavagna/Taccuino/Lezione,
ricarica e ritrova gli stessi ID, contenuti e revisioni. Puoi creare una lezione, aggiungere fonti,
annotare a penna nella lavagna ampia, spostare oggetti (anche `Alt` + frecce), annullare le modifiche supportate,
leggere la storia ed esportare uno snapshot completo. I dati non validi non vengono sostituiti.

Il salvataggio è **solo su questo browser**: un unico snapshot Core, scrittura atomica e
coordinamento Web Locks fra schede. Non c'è sincronizzazione fra dispositivi, collaborazione
live, autenticazione applicativa o pubblicazione agli studenti. La protezione Vercel controlla
l'accesso alla preview e non sostituisce le autorizzazioni applicative future.

L'esempio sul pendolo è una bozza di contenuto con formula e collegamento alla fonte.
**Non è un laboratorio funzionante, un corso completo o un contenuto approvato.**

## Struttura e responsabilità

| Area | Responsabilità |
| --- | --- |
| `apps/web` | Unica applicazione e adapter di composizione |
| `packages/contracts` | DTO e schemi runtime pubblici |
| `packages/core` | Oggetti, revisioni, policy, ricevute ed eventi |
| `packages/lesson-os` | Proiezioni ricostruibili sugli eventi Core |
| `packages/plugin-sdk` | Manifest e contratti versionati, indipendenti dal renderer |
| `packages/plugin-host` | Confine di esecuzione; chiuso in M0 |
| `packages/ui` | Token condivisi |
| `tools`, `.github`, `operations` | Verifica, CI e stato generato |

Nessuna importazione fra internals di applicazioni differenti. Nessun orchestratore, database
aggiuntivo, provider di autenticazione parallelo o seconda autorità sui progressi.

## Plugin, marketplace e Creator

M0 preserva contratti e confini; **nessuna installazione o esecuzione plugin è abilitata**.
Il manifest richiede SDK, provenienza, licenza, publisher/key ID, hash e firma. Questi campi
non costituiscono da soli una verifica crittografica. M1/M2 devono aggiungere fiducia esterna,
verifica effettiva, ciclo di vita e prove browser prima di consentire il consumer first-party.
La UI dei moduli dichiara l'indisponibilità e non offre acquisti o installazioni fittizi.

Plugin e contenuti versionati condividono un catalogo contrattuale; i contenuti rimangono dati,
non eseguibili. Creator userà lo stesso contratto di pubblicazione e provenienza.

## Prove, stato e rilascio

`npm run status` genera `artifacts/status.json` dai report del sorgente corrente. Non eredita
un PASS da un commit, digest o deployment precedente. `build-info.json` espone SHA e impronta
dei sorgenti; non contiene segreti. La preview deve essere privata, READY e confrontata con
quel file, insieme a CI e richiesta anonima respinta, prima di accettare M0.

Le prove di rilascio ottenute da GitHub/Vercel vanno in `artifacts/release-evidence.json`,
non in una cronologia di stato scritta a mano. Il modello è in
[`operations/release-evidence.schema.json`](operations/release-evidence.schema.json).
Se mancano, lo stato resta `AWAITING_COMPLETE_EVIDENCE`.

Il progetto Vercel è `ardesia-next`, separato dal vecchio progetto. I deployment automatici
Git sono disattivati in configurazione. Il coordinatore rilascia solo preview protette sulla
SHA verificata. La promozione pubblica richiede autorizzazione separata.

Rollback M0: tornare alla precedente preview verificata e revert della PR. Nessuna migrazione
automatica o cancellazione dei dati del browser. Un formato futuro deve offrire export e
migrazione versionata prima di abbandonare snapshot esistenti.

## Fonti e recupero selettivo

Le fonti obbligatorie sono state lette e sono tracciate in
[`docs/sources`](docs/sources). I 36 modelli visivi sono riferimenti, non funzioni già operative.
[`D01–D68`](docs/acceptance/D01-D68.json) conserva i criteri testualmente: tutti sono `NOT_RUN`
come accettazione del prodotto. Poiseuille resta un modulo con criteri propri, non il centro
dell'architettura.

Il legacy `AndreaMarro/ardesia` è stato esaminato alla SHA
`5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`, in sola lettura. M0 recupera comportamenti e
invarianti; non copia l'intero progetto. La sandbox web legacy e gli import fra app sono esclusi.
Nessun eLab ripristinato.

Approfondimenti: [architettura](docs/architecture.md), [ADR](docs/adr),
[handoff e ownership](docs/handoff.md), [dipendenze](docs/dependencies.md),
[traguardi](operations/milestones.json).

Codice originale riservato; dipendenze e fonti mantengono i rispettivi diritti.
Non è attribuita una licenza open source al codice legacy privo di licenza generale.
