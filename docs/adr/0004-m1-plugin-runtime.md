# ADR 0004 — M1: first-party verificato e runtime separato

29 ottobre 2026. Implementa il gate M1 previsto da ADR 0002. Non dichiara completo il catalogo M2, l'autorizzazione server M3 o l'isolamento di codice di terzi.

## Confine esecutivo

Il composition root fornisce all'Host un registro di chiavi pubbliche Ed25519 fissate nel sorgente revisionato e un elenco esplicito di release autorizzate. Ogni voce associa **plugin ID, versione, SHA-256, publisher ID e key ID**. Il manifest non può fornire o autorizzare una propria chiave.

`createPluginHost().mount()` valida contratto e SDK, limiti del bundle, identità dell'istanza, schema dello stato, publisher, release e capacità. Copia manifest, byte, stato e consenso prima della prima operazione asincrona. Verifica SHA-256 sui byte effettivi e la firma Ed25519 tramite Web Crypto. Crea il runtime solamente dopo tutti questi controlli. Una dichiarazione di firma, una funzione di ispezione del manifest o il nome first-party non concede esecuzione.

L'adapter browser dell'Host crea un Blob direttamente dalla copia dei **medesimi byte verificati** e avvia un Worker modulo da quel Blob. Non importa una seconda URL, non usa `eval`, non monta script nella UI e non usa iframe `srcDoc`. La CSP ammette `worker-src blob:`; non occorre autorizzare `script-src blob:` nella pagina. Il Worker viene terminato e la Blob URL revocata alla chiusura o a errori di protocollo/timeout.

Il Worker evita l'esecuzione del modello nel thread della UI e non riceve DOM, Core, storage o credenziali attraverso l'Host. **Non è una sandbox completa per terzi**: un Worker fidato può comunque usare API del proprio ambiente, incluse rete e IndexedDB dove consentite dal browser. Non si dichiarano quindi confinamento generale di rete/storage o autorizzazione di codice arbitrario. Plugin di terzi, upload di bundle e URL scelte dall'utente restano esclusi.

## Firma del manifest v1

`manifestSigningBytes()` valida il manifest, rimuove il campo `signature` e produce questi byte:

1. prefisso UTF-8 esatto `ardesia-plugin-manifest/v1` seguito da newline;
2. JSON con chiavi degli oggetti ordinate lessicograficamente a ogni livello, senza whitespace aggiuntivo;
3. ordine degli array conservato, stringhe e numeri serializzati con `JSON.stringify`.

Tutti gli altri campi sono firmati, compresi hash del bundle, capacità, provenienza, SDK, schema dello stato, identità e versione. La firma è base64 canonico di 64 byte; la chiave pubblica fissata dal composition root è base64 canonico dei 32 byte raw Ed25519. Il manifest non contiene chiavi private. I test generano chiavi private esclusivamente in memoria e usano firma Node Crypto, verifica Web Crypto e un payload canonico atteso indipendente.

## Stato, capacità e protocollo

Le capacità concesse sono l'intersezione tra richiesta firmata, policy e consenso esplicito. Tutte le capacità richieste dal modulo devono essere concesse; l'Host richiede `state:read` per il primo mount e `state:write` per valutare uno stato modificato. Il mount non rappresenta un'installazione di catalogo o un record di consenso M2.

Lo stato deve essere JSON finito entro 32 KiB e profondità 16, privo di cicli, oggetti con prototipi speciali, chiavi di prototipo e valori non serializzabili. La versione deve coincidere con `stateSchemaVersion` del manifest. Il modello valida inoltre il proprio schema scientifico e i limiti dei parametri. Nessuna migrazione o normalizzazione silenziosa viene applicata.

La richiesta e la risposta usano `ardesia-plugin/1`, ID di istanza e ID di richiesta correlato con un nonce casuale della sessione. L'Host accetta una sola richiesta in corso. Risposte inattese, ripetute, di un'altra istanza, troppo grandi, con campi aggiuntivi o stato diverso da quello richiesto fanno fallire il protocollo. Le risposte sono limitate a 512 KiB, grafici a quattro serie da mille punti e il Worker ha un timeout massimo configurato entro 30 secondi. Un timeout ferma l'istanza; un errore scientifico valido non sovrascrive l'ultima valutazione riuscita.

La UI riceve soltanto DTO validati per parametri, metriche, grafico, spiegazione e disegno. Gli oggetti restituiti sono copie. La sessione Host è effimera: salvataggio, identità dell'oggetto, revisione, ricevuta ed evento rimangono del Core. La riapertura deve controllare i riferimenti del Core e ripercorrere l'intero mount crittografico usando lo stato conservato.

## Prove e limiti

I test Host coprono firma reale e byte eseguiti, payload canonico, manomissione di bundle/firma/campi firmati, publisher sconosciuto/revocato/chiave diversa, incompatibilità SDK e stato, release non autorizzata, capability negate, mutazioni durante verifica, stato immutato dopo rifiuto, esecuzione e riapertura in Worker reale, timeout, chiusura, replay e risposte non valide. Il percorso browser della molla è una prova aggiuntiva del consumer completo, non deducibile dai test unitari.

La configurazione di fiducia è catturata alla creazione dell'Host. La revoca è verificata per nuovi mount; aggiornamenti live del trust store, revoca di un'installazione già persistita, aggiornamenti/rollback, catalogo e ciclo dei consensi sono lavoro M2. Conservare questa distinzione nello stato operativo.
