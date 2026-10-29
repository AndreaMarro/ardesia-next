# M2 — Marketplace first-party

Il percorso reale è **Moduli → verifica → installa → salva autorizzazioni → attiva → aggiungi molla → salva → ricarica → disattiva**. L'installazione nasce inattiva; nessuna capability è selezionata automaticamente. Firma Ed25519, SHA-256, trust store, SDK e release autorizzata sono ricontrollati prima dell'esecuzione.

## Autorità e confini

- Il catalogo versionato vive in `apps/web/public/plugins/catalog.json`. Descrive una sola release reale della molla; non concede fiducia. Manifest, publisher, licenza, provenienza, compatibilità e stato sono espliciti.
- `kind: plugin` e `kind: content` hanno contratti distinti. Pack, lezioni, manuali, risorse, workflow e template non ricevono entrypoint, capability o runtime. Nessuna voce commerciale o contenuto fittizio è pubblicato.
- Il trust store e le release ammesse rimangono in `release-trust.json`; `revocations.json` può soltanto negare publisher/release. Viene letto prima delle verifiche e delle aperture. Una revoca osservata è monotona nella sessione e ferma il runtime; non modifica i dati scientifici.
- Esiste un solo Plugin Host. La verifica preliminare non crea Worker. Il mount usa copie degli stessi byte verificati, richiede consenso completo e ricontrolla le policy. Disattivazione e revoca invalidano anche aperture e richieste in corso.
- Il Core conserva installazioni, consensi, versioni e storico nel medesimo snapshot, con coda, sequenza eventi, ricevute e scrittura atomica condivise con le lezioni. Nessun database aggiuntivo. Una modifica dello snapshot da un’altra scheda arresta il runtime della scheda obsoleta, che richiede una ricarica senza riscrivere i dati.

## Migrazione e aggiornamenti

Snapshot Core v3: apertura v1/v2 in memoria, senza riscrivere il dispositivo. Il primo comando valido salva atomicamente v3. Laboratori M1, ID, stati e revisioni rimangono disponibili; installazione e consenso devono essere forniti esplicitamente prima dell'uso in M2. Dati non validi e scritture fallite non vengono sostituiti.

Il Core implementa transizioni di release con policy esplicita, medesimo schema dello stato, verifica di tutti gli esperimenti e aggiornamento atomico delle revisioni. Un rollback conserva lo stato scientifico più recente. Ogni cambio di release lascia il modulo inattivo e richiede nuovo consenso. **La release distribuita autorizza zero transizioni** (`transitions: []`): non esistono versioni di aggiornamento o rollback offerte all'utente. Il controllo aggiornamenti verifica il catalogo e rifiuta versioni non autorizzate.

## Verifica e gate

`npm run verify` controlla contratti, confini, test Core/Host/SDK, bundle firmato invariato, build e budget. `npm run test:e2e` produce rapporti della stessa SHA/digest: 14 percorsi M1 e 24 percorsi M2 desktop/mobile, oltre alle regressioni dello spazio.

Le controprove comprendono firma e bundle alterati, consenso insufficiente, publisher revocato, SDK incompatibile, stato invalido, aggiornamento non autorizzato, revoca persistita ed errore di salvataggio. Il percorso di verifica/installazione/consenso dimostra zero Worker prima dell'attivazione.

`npm run status` accetta M2 soltanto con M1 valido sulla stessa fonte, suite complete, controprove browser e osservazioni remote autenticate conformi a `operations/release-evidence.schema.json`. Un exit code zero del generatore non basta: `M2` deve essere `ACCEPTED` e i gate `m2Evidence` devono essere `PASS`.

## Rilascio e ripristino

Il candidato viene integrato tramite PR e CI sul commit esatto, poi distribuito dal branch `preview/m2` sulla medesima SHA. Il target reale deve essere `staging`, protezione Vercel `all`, repository privata. Si confrontano build-info e digest remoti e si osserva il ciclo completo prima di registrare l'accettazione.

Per fermare un modulo: disattivazione o revoca, mantenendo reader v3 e stato salvato. Non retrocedere uno snapshot v3 al reader M1. La preview M1 precedente resta separata; la continuità è limitata alla stessa origin. Esportare una copia dei dati prima di cambiare origin. Nessuna produzione pubblica viene modificata.

## Limiti espliciti

Persistenza solo nel dispositivo, single writer con Web Locks; nessuna sincronizzazione, autenticazione applicativa o autorità docente–studente remota. Il Worker first-party non è una sandbox generale per terzi. Nessun pagamento, commissione, recensione simulata, upload o pubblicazione di codice arbitrario. `productAcceptance: NOT_COMPLETE`; M3–M5 rimangono non avviati.
