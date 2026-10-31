# Preview protetta: procedura operativa

## Candidato

Integrare tramite PR solo dopo il controllo GitHub `verify`. Verificare nuovamente CI e tree sulla SHA del merge. Per il progetto Vercel `prj_GGKjCPG4cdgaQDQQMJoFvsy2ffSd` mantenere autenticazione su **tutti** i deployment. Il mandato del 29 ottobre autorizza separatamente la pubblicazione del solo sorgente GitHub: quando la visibilità osservata è `public`, la release evidence deve includere il record `sourcePublication` previsto dallo schema. La richiesta non prova che il cambio di visibilità sia già stato eseguito. Le baseline private storiche restano immutate; la protezione della preview, le SHA, i digest e tutte le controprove M3 restano obbligatori.

La richiesta API deve fissare `gitSource.type=github`, `repoId=1437761277` e `sha` alla revisione verificata. Creare o aggiornare **`preview/m3` alla stessa SHA di `main`** e usare questo branch come `gitSource.ref`, con **`target: staging`** esplicito. Nelle prove del 29 ottobre, `ref: main` è stato classificato dal provider come `production` sia con target omesso sia con staging esplicito; il branch preview alla stessa SHA ha prodotto il target corretto. I due candidati production, sempre protetti, sono stati esclusi dall'accettazione e rimossi. La stringa `preview` non è accettata da questa API. Verificare sempre la risposta effettiva.

Vercel riserializza `vercel.json` prima della build. Il file è quindi versionato come `JSON.stringify(JSON.parse(source))` seguito da una newline, e CI ne impone il formato. Questo conserva l'impronta dei byte reali: non canonicalizzare silenziosamente il digest, non escludere la configurazione e non sostituire il digest atteso con quello distribuito. La controprova iniziale ha riprodotto la discrepanza cambiando soltanto la serializzazione di questo file (910 → 826 byte), con gli altri 77 file identici al tree Git.

Non promuovere o aggiungere domini pubblici. L'autodeploy Git resta disattivato in `vercel.json`; non è necessario un trigger automatico per recuperare il sorgente Git esatto.

## Prove successive alla build

1. Leggere il deployment: progetto, repository, SHA, stato READY e target del provider devono coincidere con il candidato. Rifiutare `production`.
2. Leggere `/build-info.json` attraverso la sessione Vercel autorizzata. Confrontare sia SHA sia `sourceDigest` con i report CI, senza creare link pubblici di bypass.
3. Eseguire una richiesta anonima senza seguire redirect e conservare status/Location. Un redirect SSO è una risposta di protezione: può essere accettato solo verso `https://vercel.com/sso-api` con destinazione nella stessa origin della preview. Una pagina HTTP200 anonima non supera il gate.
4. Eseguire nel browser remoto il percorso lavagna → taccuino → salvataggio → ricaricamento. Conservare prova e limiti separati dalle prove locali/emulate.
5. Registrare i risultati osservati in `artifacts/release-evidence.json` secondo lo schema, quindi generare `npm run status` con `ARDESIA_COMMIT_SHA` esatto. Non modificare il sorgente per inserire la sua stessa SHA.

Gli artefatti CI e lo stato generato nella descrizione della PR conservano le prove del candidato. La chiusura M0 non approva M1–M5 o i criteri D01–D68.

## Esito negativo e ripristino

Un errore di build, un target inatteso, una discrepanza SHA/digest o un accesso anonimo alla pagina impediscono l'accettazione. Annullare un deployment ancora in costruzione; per un candidato nuovo errato già terminato, rimuovere esclusivamente quel deployment dopo averne registrato l'identità. Non modificare il vecchio progetto Ardesia.

La nota storica M0 sul salvataggio per browser non descrive M3. In M3 PostgreSQL è autorevole: il rollback del codice richiede compatibilità con lo schema e i dati correnti. Un backup verificato e un restore provato in un database distinto e vuoto sono requisiti separati; un alias precedente non ripristina i dati. Conservare deployment, report, archivio e URL del candidato precedente finché serve al ripristino.

La coda editor introdotta nella correzione P0 della PR #16 conserva anche intenti non inviati, con record di recupero versione 2 e chiavi per comando nello stesso namespace per account. Il reader legge anche il vecchio array e lo conserva; le chiavi distinte impediscono a due schede aggiornate di cancellare gli intenti l'una dell'altra. Un client precedente non legge le nuove chiavi: un rollback richiede un reader compatibile oppure recupero/esportazione completati prima del cambio client. Non interpretare la sua lista vuota come conferma del server e non cancellare dati di recupero per abilitare il rollback. Se il browser segnala recupero solo in memoria, l'esportazione è necessaria prima di chiudere o ricaricare la pagina. Questo formato non cambia snapshot o schema PostgreSQL.


## Gate M1

Prima della distribuzione eseguire anche il rebuild del bundle firmato e tutti i percorsi `e2e/plugin-lab.spec.ts`. La prova browser remota deve creare una molla, modificarne un parametro, salvare e riaprire l’oggetto conservando ID, istanza, stato e revisione. Registrare il blocco `m1Browser` nella release evidence secondo lo schema. Il solo READY o un vecchio screenshot M0 non accetta M1.

## M2

Usare `preview/m2` alla SHA esatta del candidato, con gli stessi controlli di target/protezione qui descritti. Il build-info dichiara M2. Dopo il ciclo marketplace autenticato, compilare anche `m2Browser` secondo lo schema, importare gli artefatti originali CI della stessa SHA, eseguire `npm run status` e leggere i gate effettivi. Non accettare M2 senza M1 valido, 24 flussi M2 e prove remote. Il precedente snapshot v3 richiede un reader v3 anche in un rilascio di ripristino; disattivare il modulo conserva i dati.

## Gate remoto M3

Prima della prova configurare un database dedicato e credenziale runtime limitata soltanto nella preview; mantenere separata la credenziale dell’operatore. Eseguire migrazione e provisioning sintetico esplicitamente. Un deployment READY senza database non chiude M3.

`artifacts/m3-remote-evidence.json` deve contenere le osservazioni effettive di tre account, sessioni browser indipendenti, continuità degli ID e dello stato, rifiuti di accesso, revoche, conflitto, retry, scadenza, indisponibilità e ripristino/import. Il suo digest deve essere legato al release report. Il contratto verificabile è `tools/m3-evidence.mjs`; le fixture nei test del gate non sono prove di rilascio. Non registrare password, cookie o token.

`npm run status` confronta report unitari/browser, SHA, digest sorgente, CI, build-info e protezione. La baseline M0–M2 è conservata separatamente e non sostituisce prove della build corrente. In assenza di infrastruttura o osservazioni remote il risultato M3 resta `AWAITING_COMPLETE_EVIDENCE`.

La build M3 produce Build Output API v3 in `.vercel/output`: statici, routing e Function Node con tutti i workspace compilati. `framework:null` e nessun `outputDirectory` lasciano al provider il riconoscimento esplicito di quell’output. Le protezioni HTTP sono riportate nelle route generate; la protezione SSO resta una proprietà del progetto. Il bundle server e gli asset del worker non sono pubblicati nella directory statica.

## Congelamento del candidato e procedura permanente

Durante la raccolta M3 mantenere fermi `main`, `preview/m3` e l’alias `https://ardesia-next-staging.vercel.app`. Una correzione indispensabile richiede una nuova SHA e nuove evidenze; le prove precedenti restano storiche. Le PR non critiche possono completare la CI sul proprio branch senza avanzare staging. Il produttore completo e i suoi prerequisiti sono descritti in `e2e/README.md`; la regressione remota resta separata e non accetta M3.

| Passaggio | Controllo necessario prima del successivo |
| --- | --- |
| PR → main protetta | `verify` sulla head esatta, revisione dei cambiamenti, poi CI sulla SHA del merge; nessun segreto remoto nel codice delle PR |
| main verificata → candidato | SHA, sourceDigest, artifact e release identity coerenti; progetto Vercel esistente, ref preview autorizzato e target staging effettivo |
| candidato → alias staging | SSO su tutti i deployment, nessun nuovo bypass; conservare deployment precedente e associazione alias per rollback |
| staging → smoke e accettazione | Preflight, contesti indipendenti e controprove; piattaforma/build identici prima e dopo; segreti soltanto nell’ambiente autorizzato |
| accettazione → eventuale produzione | Gate scientifici, autenticazione/autorizzazioni, dati, costi, restore e accettazione di prodotto; URL canonico stabile deliberato nel progetto esistente |
| promozione → verifica | Verifica dell’URL canonico, identità della build, protezione prevista, continuità e osservazione degli errori; rollback del codice distinto dal restore dei dati |

`git.deploymentEnabled=false` resta intenzionalmente attivo durante il congelamento. L’automazione futura dello staging dovrà consumare soltanto un evento CI `success` per un **push su main protetta della repository canonica**, ricontrollare che la SHA verificata sia ancora il candidato autorizzato e usare un environment limitato al branch fidato. Un evento `pull_request` o un artifact caricato da un fork non può ottenere credenziali né attivare il rilascio. Install/build di codice PR non devono essere spostati in un job privilegiato tramite `pull_request_target`.

Finché mancano l’ambiente segreto autorizzato e la verifica completa, non abilitare questa automazione né l’autodeploy Git. La preparazione della procedura non crea un trigger funzionante e non promuove produzione. L’accettazione M3 e quella del prodotto rimangono decisioni derivate dai report del candidato, non dal successo di una distribuzione.
