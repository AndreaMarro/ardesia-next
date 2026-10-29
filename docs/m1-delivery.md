# M1 — Plugin scientifico verificato e oggetto educativo persistente

29 ottobre 2026. Questo documento descrive il candidato M1; l’accettazione effettiva è prodotta da `npm run status` sulle prove della SHA consegnata. M2 e M3 restano fuori dal perimetro.

## Percorso utente

Aprire **Moduli → Aggiungi molla alla lezione**. L’app scarica il manifest e il bundle della sola release inclusa. L’Host controlla identità, fiducia, capacità, compatibilità, firma e integrità prima di avviare il Worker. Solo dopo una valutazione scientifica riuscita il Core crea l’oggetto laboratorio DRAFT.

Il pannello consente di modificare massa, rigidità, posizione iniziale, velocità iniziale e tempo, con unità SI. **Aggiorna grafico** valuta l’esperimento senza salvarlo. **Salva laboratorio** verifica i parametri e registra lo stato tramite un comando Core, con nuova revisione dell’oggetto e della lezione. Non è necessario aggiornare il grafico prima di salvare. Lavagna, Taccuino e Lezione leggono la stessa identità. La riapertura ricontrolla il manifest, il bundle e lo stato; un errore conserva i dati originali.

## Confine di esecuzione

- Trust store e allowlist sono nella composition root revisionata, separati dal manifest ricevuto. Nessuna chiave auto-dichiarata viene accettata.
- Il payload Ed25519 include tutti i campi del manifest tranne la firma stessa, con JSON ordinato e separazione di dominio `ardesia-plugin-manifest/v1`.
- SHA-256 si applica ai byte eseguibili effettivi. Gli stessi byte copiati e verificati diventano il modulo del Worker Blob; non si effettua un secondo download al momento dell’esecuzione.
- Le sole capacità autorizzate per questo modulo incluso sono `state:read` e `state:write`. Non sono disponibili porte per leggere altri oggetti, storage indipendente o operazioni Core dirette dal plugin.
- Protocollo con ID di istanza e richiesta, validazione delle risposte, limiti di dimensione, timeout e arresto del Worker. Il renderer riceve DTO scientifici e testo, senza HTML o componenti eseguibili provenienti dal plugin.
- Il Worker separa l’esecuzione dal DOM dell’app. Non è dichiarato sandbox completa per codice di terzi: le primitive browser presenti in un Worker restano quelle della piattaforma. Esecuzione terzi, revoca attiva, installazioni, update/rollback dei moduli e consenso persistito appartengono a M2 e ai suoi gate.

Dettaglio: [ADR 0004](adr/0004-m1-plugin-runtime.md). Riferimenti tecnici: [Web Cryptography — Ed25519](https://www.w3.org/TR/webcrypto/#ed25519), [Vite library mode](https://vite.dev/guide/build#library-mode).

## Provenienza e riproducibilità della release

Il commit sorgente del primo bundle è [`026b12b57de3aa6a91dfb6ae48bc8e49a9a5e1e3`](https://github.com/AndreaMarro/ardesia-next/commit/026b12b57de3aa6a91dfb6ae48bc8e49a9a5e1e3). Contiene modello, worker, SDK, Host e tooling necessari. La distribuzione firmata è introdotta in un commit successivo, evitando un riferimento circolare alla propria SHA.

Bundle: `apps/web/public/plugins/ideal-spring/1.0.0/plugin.js`; SHA-256 `713b10ce53337e5bb03f0da86afec8a1266a8229115e9d1f571cf49766814148`. Il manifest conserva versione, schema, licenza e commit sorgente. Il controllo di build ricostruisce il Worker con il lockfile fissato e confronta i byte con quelli firmati. La build dell’app fallisce se differiscono.

`tools/sign-plugin.mjs <SHA sorgente>` è una procedura di rilascio esplicita, mai eseguita automaticamente da CI o build. Genera in memoria una chiave privata Ed25519 non esportabile, firma una release e scrive soltanto chiave pubblica e pin revisionabili. La chiave privata non viene salvata. Una successiva release richiede nuova revisione di sorgenti, firma e trust store. Il repository rimane privato e il codice originale è UNLICENSED; il bundle conserva separatamente l’avviso MIT di Zod.

Il recupero legacy è selettivo: legge di Hooke, energia elastica e cinque casi SI della molla statica. L’oscillatore dinamico è implementato ex novo, senza presentare il vecchio modello come dinamico. [Fonti e digest donor](sources/m1-ideal-spring.md).

## Core e migrazione

Il contratto diventa `0.2.0` e lo snapshot `2`. L’oggetto `lab` contiene ID del plugin, versione, ID dell’istanza, digest del bundle, publisher/chiave, versione dello stato e JSON scientifico. L’identità della release non può cambiare con un ordinario comando di modifica. Il Core conserva anche le revisioni precedenti dello stato.

Uno snapshot M0 valido viene convertito in memoria da v1 a v2 senza alterare documenti, eventi o ricevute e senza scrivere all’apertura. Il primo comando accettato salva atomicamente v2. Snapshot non validi o versioni sconosciute vengono rifiutati senza sovrascrittura. La chiave del browser resta `ardesia-next.core.v1` per trovare i dati preesistenti; la versione autorevole è quella interna allo snapshot.

La migrazione non è reversibile verso M0 quando sono presenti laboratori. Per interrompere M1 conservare l’app capace di leggere v2 e disabilitare nuovi mount tramite policy; esportare lo snapshot prima di cambiare origin o distribuzione. Tornare al solo reader M0 sulla medesima origin non è un rollback dei dati supportato.

## Prove e stato operativo

`npm run verify` esegue otto controlli: formato configurazione, tipi, confini, controprove del gate, test unitari, riproducibilità/firma del bundle, build e budget JavaScript. Il budget include anche il Worker distribuito separatamente. Il report unitario è legato alla verifica tramite digest del suo contenuto JSON normalizzato.

`npm run test:e2e` esegue il percorso M0 e sette scenari M1 su Chromium desktop e mobile emulato: uso/salvataggio/riapertura, bundle manomesso, firma manomessa, capability non consentita, versione di stato incompatibile, stato scientifico invalido e parametri rifiutati senza perdita del salvataggio. Le controprove di manomissione osservano che nessun Worker viene avviato. La preview locale applica gli stessi header CSP di Vercel.

Per la verifica locale il Browser collegato non era disponibile nella conversazione; sono usati i test Playwright del repository già previsti dalla CI. Il server locale richiede l’autorizzazione dell’ambiente ad aprire la porta 4173. Non sono simulate prove su iPhone, Safari o penne fisiche.

`npm run status` non accetta M1 con i soli test locali: richiede CI, SHA/digest esatti, preview protetta e una prova remota di modifica, salvataggio e riapertura con identità e revisione conservate. Le prove post-deploy sono artefatti associati alla build e nella PR, non un nuovo commit per inserire la propria SHA. `productAcceptance` resta `NOT_COMPLETE`.

## Esposizione precedente e limiti

La [verifica circoscritta M0](security/m1-exposure-review.md) copre storia raggiungibile, log e artefatti disponibili; non identifica una credenziale da ruotare. Non determina la durata della precedente visibilità pubblica né esclude copie esterne.

Il salvataggio rimane locale al browser e alla origin. Nessun account applicativo, database remoto, ruolo studente reale, marketplace, aggiornamento automatico o approvazione editoriale è introdotto. M1 è il primo consumer scientifico reale degli stessi contratti; non è l’accettazione complessiva del prodotto.
