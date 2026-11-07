# REA e Creator programmabile — 7 novembre 2026

Domanda: permettere di inventare interfacce e comportamenti mantenendo distinti codice, consenso, stato di prova e salvataggio. Fonti prodotto: programma generale6novembre, richiesta diretta di UI/UX e plugin inventabili, allegato misto già attribuito in [Creator](creator-studio-2026-11-07.md). Le sette chat già analizzate restano nel dossier [lavagna](spatial-board-2026-11-07.md); non viene dichiarata nuova copertura.

REA6.8.0 via CLI, Node24.22.1. Documentazione CLI/browser/JavaScript consultata; non semplice raccolta di immagini.

| Fonte/analisi | Osservazione | Trasferimento |
| --- | --- | --- |
| `codesandbox/sandpack`, commit `7d60a4334980eef304d53b1c3df371ed6dbcf491`, `@codesandbox/sandpack-client@2.19.8`, Apache-2.0 | REA statico su quattro file TS del lifecycle/protocollo, 2651nodi AST, zero errori di parsing, semantica parziale. Evidence `ev_9671f0b68822fd4e9a9eae7691d31bfaf16c965c24841bdbd029285117cce862`. Due file inventariati fuori scope. Blob Git verificati. | ADAPT handshake, stato di compilazione e ricostruzione dell'anteprima; REPLACE default permessi larghi e bundler esterno. Codice originale Ardesia. |
| `https://sandpack.codesandbox.io/`, browser controllato | Scenario REA modifica componente→preview→errore sintattico→riparazione→refresh. DOM, AX, immagini ed eventi conservati, compreso il primo tentativo col selettore errato. | ADAPT anteprima nello stesso ambiente, errore recuperabile e ripresa senza perdere sorgente. La versione del sito non è equiparata al commit statico. |
| Host Next, `program-engine.ts` e `program-worker.ts` | REA statico selettivo, cap3000,20s/file. Evidence `ev_631be3b7a8a49ba38d32943cce632ebb7ce36e5006683422cbc178e79b8916b8`. Verifica osservabile di dove input, engine e validazione si incontrano. | CHECK del consumer originale. Non decompila/verifica tutto QuickJS o il WASM. |

Sandpack distingue source/channelId e marcatore, ma il suo channelId è instradamento, non autenticazione. `initialized/register-frame/compile` aiuta a capire il ciclo; `destroy` rimuove listener ma da solo non certifica arresto del codice. Questi rilievi non sono una dimostrazione di vulnerabilità sfruttabile nel servizio pubblico. Il donor non è stato copiato o installato nel prodotto.

L'analisi statica è parziale e non dimostra il comportamento del programma completo. La prova comportamentale del sito pubblico è distinta dalle fonti del package. Il raw conserva licenze, URL, hash, cap/unknown, screenshot, stderr e limiti. Nessun superamento di login, paywall o restrizioni; nessun body di rete con credenziali richiesto. Catture Ardesia successive sono solo su dati sintetici locali, con segreto di accesso dichiarato da oscurare. Lo screenshot non dimostra isolamento, correttezza scientifica o prestazioni.

Lo scenario Sandpack `ev_7d3e8366af2a43390182289f824054a706c74d30016167f6d60cff1a2996a254` completa10azioni più avvio, ma REA marca la cattura **incomplete**, sezione `events`: alcune richieste erano ancora aperte alla fine. Le transizioni visibili sono osservate; attività di rete successiva e completezza degli eventi restano ignote. Cleanup `terminated-owned-process`. L'analisi del confine QuickJS lascia11file inventariati fuori scope e non è un audit del motore.

I file completi si trovano nel pacchetto esterno `outputs/rea-evidence/programmable`, con associazione separata a build-info. Gli ID di record vengono mantenuti: non si riscrive REA per attribuirgli identità sorgente che dichiara non disponibili. Chromium e viewport mobile non costituiscono collaudo iPad/Pencil/Safari.

Decisione e consumer: [ADR0017](../adr/0017-programmable-creator.md), [guida ABI](../programs.md), contratti/Core, Host/Worker, Creator, DocumentView e resource MCP. Le prove del motore e dei percorsi reali restano separate dalla ricerca REA e sono legate alla sorgente della consegna.
