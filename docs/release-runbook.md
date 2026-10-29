# Preview protetta: procedura operativa

## Candidato

Integrare tramite PR solo dopo il controllo GitHub `verify`. Verificare nuovamente CI e tree sulla SHA del merge. Per il progetto Vercel `prj_GGKjCPG4cdgaQDQQMJoFvsy2ffSd` mantenere autenticazione su **tutti** i deployment e sorgenti non pubbliche.

La richiesta API deve fissare `gitSource.type=github`, `repoId=1437761277` e `sha` alla revisione verificata. Creare o aggiornare **`preview/m0` alla stessa SHA di `main`** e usare questo branch come `gitSource.ref`, con **`target: staging`** esplicito. Nelle prove del 29 ottobre, `ref: main` è stato classificato dal provider come `production` sia con target omesso sia con staging esplicito; il branch preview alla stessa SHA ha prodotto il target corretto. I due candidati production, sempre protetti, sono stati esclusi dall'accettazione e rimossi. La stringa `preview` non è accettata da questa API. Verificare sempre la risposta effettiva.

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

Non dichiarare un rollback dei dati: M0 non esegue migrazioni. I contenuti restano nello specifico browser e nella specifica origin della preview; esportare lo snapshot prima di cambiare origin.
