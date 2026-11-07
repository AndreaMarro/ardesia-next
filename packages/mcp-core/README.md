# MCP Core — primo percorso locale

Un client MCP può cercare lezioni, leggere oggetti e revisioni esatte e comporre modifiche tramite la stessa API della lavagna. Il pacchetto non apre PostgreSQL, non istanzia il Core e non esegue plugin o inferenza AI. Il server applicativo rimane l'autorità per identità, autorizzazioni, eventi e ricevute. [Decisione e limiti](../../docs/adr/0011-mcp-core-stdio.md).

## Configurazione

Richiede Node24, build corrente, API Ardesia raggiungibile e un account applicativo già esistente. Dalla radice del repository:

```sh
npm ci
npm run build:mcp
node packages/mcp-core/dist/ardesia-mcp.mjs configure \
  --origin http://127.0.0.1:4180 \
  --config /percorso/privato/ardesia-mcp-session.json
```

Il terminale chiede utente, password nascosta e quali spazi autorizzare. Il file viene creato con permessi0600 e non sovrascritto; contiene una sessione applicativa, mai una credenziale database. Non incollarlo in chat o nel repository. EOF/Ctrl-C interrompono la configurazione, rimuovono il file incompleto e tentano la revoca della sessione appena acquisita. Un kill del processo o un guasto durante il cleanup possono impedirne la revoca immediata: resta valida la scadenza server, senza refresh automatico.

L'accesso è **in sola lettura** per default. Per consentire i comandi negli spazi propri, configurare esplicitamente con `--write`, per entrambi i ruoli. Gli spazi assegnati restano in sola lettura; `OWNER_REQUIRED` rifiuta authoring nel contenitore altrui. Studio tutor richiede anche il ruolo docente. Questa scelta autorizza l'host locale a scrivere negli spazi selezionati: l'anteprima non è un meccanismo di approvazione umana e non certifica l'interazione offerta dall'host.

Configurazione tipica del client MCP, sostituendo i due percorsi assoluti:

```json
{
  "mcpServers": {
    "ardesia": {
      "command": "/percorso/node24/bin/node",
      "args": ["/percorso/ardesia-next/packages/mcp-core/dist/ardesia-mcp.mjs", "serve", "--config", "/percorso/privato/ardesia-mcp-session.json"]
    }
  }
}
```

Usare direttamente Node: il banner di `npm run mcp` senza `--silent` contaminerebbe stdout, riservato al protocollo. La chiave `mcpServers` è una convenzione di vari host, non una prova di compatibilità con uno specifico prodotto. Il test consegnato usa il client ufficiale MCP TypeScript2.4.0. ChatGPT, Claude, Gemini e piattaforme educative non sono stati collaudati come host di questo incremento; l'accesso cloud via HTTP/OAuth è un percorso ancora da costruire.

Revoca:

```sh
node packages/mcp-core/dist/ardesia-mcp.mjs logout --config /percorso/privato/ardesia-mcp-session.json
```

La revoca riguarda questa sessione, indipendente da quella del browser. Il file viene eliminato dopo conferma server o sessione già scaduta/revocata. Se la rete manca, viene conservato per riprovare. Modificare/rimuovere il file interrompe i successivi tool; viene ricontrollato anche prima dell'invio di una scrittura e prima della restituzione dei dati. Una scrittura già inviata può essere stata committata: nessuna revoca locale equivale a rollback.

## Strumenti e percorso

| Strumento | Comportamento |
|---|---|
| `ardesia_list_workspaces` | Intersezione tra accesso server corrente e spazi configurati. |
| `ardesia_search` | Titoli, note, formule e locatori delle fonti correnti in uno spazio. Query vuota per elenco; pagine successive vincolate a `workspaceRevision`. |
| `ardesia_read_document` | Lezione corrente completa; `revision` opzionale è una precondizione di uguaglianza. |
| `ardesia_read_object_revision` | Revisione obbligatoria esatta, anche storica o rimossa per il proprietario; negli spazi assegnati, limitata alla versione corrente. |
| `ardesia_search_courses` | Cerca corsi/edizioni autorizzati senza lavoro personale. |
| `ardesia_read_course` | Legge la bozza o l’edizione esatta e il suo corso storico. |
| `ardesia_preview_course` | Prepara save/freeze di un corso, con scrittura abilitata, stesso percorso preview/apply. |
| `ardesia_preview_command` | Solo con scrittura abilitata: restituisce comando canonico, account/attore, spazio, stato precedente e digest, senza mutare il Core. |
| `ardesia_apply_command` | Applica soltanto ID e digest di un'anteprima dello stesso processo; Core ricontrolla identità, diritti, riferimenti e revisione. |
| `ardesia_discard_preview` | Libera l'anteprima temporanea; non annulla un comando già confermato. |

`ardesia://guide` dichiara capacità e limiti. I risultati espongono gli stessi dati JSON in `structuredContent` e nel contenuto testuale. Testi delle lezioni, URL e fonti restano dati non affidabili come istruzioni: non cambiano permessi, destinazioni o modalità.

Esempio di comando da preparare, con ID nuovi espliciti e la revisione appena letta:

```json
{
  "workspaceId": "ID-SPAZIO",
  "command": {
    "kind": "add-object", "commandId": "ID-COMANDO", "documentId": "ID-LEZIONE", "expectedRevision": 3,
    "object": {
      "id": "ID-OGGETTO", "type": "formula", "title": "Energia elastica",
      "x": 400, "y": 0, "width": 340, "height": 220,
      "provenance": {"origin": "imported", "sources": [{"sourceId": "ID-FONTE", "revision": 1, "locator": "equazione 1"}]},
      "data": {"latex": "E_p=\\frac{1}{2}kx^2", "description": "Molla ideale nel regime lineare; k in N/m, x in m, E in J."}
    }
  }
}
```

La fonte deve essere un oggetto esistente alla revisione citata. Il Core crea identità di provenienza e stato DRAFT; l'AI non assegna approvazioni. Sono disponibili gli otto comandi documentali già esistenti, inclusi collegamenti e rimozioni. Consensi, assegnazioni, trasferimenti di denaro e installazioni di plugin eseguibili non sono aggirati attraverso questo adapter.

## Nuovi tipi componibili

La resource `ardesia://extension-format` espone lo schema JSON, le primitive e la grammatica del formato `ardesia-extension/1`. Un client può inventare una nuova `typeId`, comporre una definizione con `renderer: "ardesia.composition/1"` e crearla come oggetto `type: "extension"` attraverso `ardesia_preview_command`/`ardesia_apply_command`. L'artefatto compare nella stessa lezione e si modifica nel Creator; non è soltanto testo restituito al chiamante.

`data` comprende `definition`, `definitionDigest`, `state` ed eventuale `lineage`. Calcolare SHA-256 sulla definizione convalidata serializzata in JSON canonico (chiavi ordinate ricorsivamente); il Core ricalcola e verifica l'impronta. L'helper pubblico `extensionDefinitionDigest` e la resource descrivono il contratto. La modifica dei valori conserva la versione della definizione; la modifica della struttura richiede la versione successiva e la revisione attesa dell'oggetto. Il Core aggiunge l'origine precedente con la licenza e rifiuta collisioni della coppia tipo/versione o riscrittura della lineage. L'impronta garantisce integrità, non autentica il creatore esterno.

Primitivi attivi: gruppi, testi, controlli numerici/testuali/booleani, risultati, grafici di espressioni, azioni sullo stato e scene2D con forme. Componenti/renderer sconosciuti sono conservati con fallback, senza interpretarne il payload o scaricare codice. Il parser esclude `eval`, IO e accesso a proprietà. Il JSON è limitato a128KiB,200componenti,100campi,32origini; i limiti completi e la migrazione snapshot6 sono in [ADR0015](../../docs/adr/0015-open-creator-studio.md). La raggiunta capacità del formato causa rifiuto esplicito, non perdita di storia.

Il test runtime con client ufficiale, HTTP e PostgreSQL crea un tipo annidato non predefinito, modifica lo stato e rilegge la revisione precedente. Non prova ancora workflow esterni arbitrari, plugin terzi eseguibili, pubblicazione marketplace o compatibilità operativa degli host ChatGPT/Claude/Gemini. Non richiede alcun provider AI per funzionare.

## Risposte incerte e conflitti

Conservare il comando canonico restituito dall'anteprima, soprattutto `commandId` e `expectedRevision`. L'anteprima dura10minuti e vive solo in memoria. Un retry entro la sua validità restituisce la ricevuta originale del Core. Dopo riavvio o scadenza, preparare di nuovo **lo stesso comando completo**: il Core distingue il retry già committato dal comando obsoleto nuovo. L'anteprima segnala una revisione diversa, senza riscrivere il comando e senza dichiararlo valido.

Non esistono invio automatico, nuovo ID automatico, rebase o replay di una coda MCP al riavvio. Il client deve conservare il comando per poter recuperare una risposta persa; se lo perde, l'adapter non dispone di un archivio alternativo. Cancellazione/timeout/risposta invalida non sono una prova di rollback. Un nuovo comando obsoleto riceve `REVISION_CONFLICT`; riusare l'ID con payload diverso riceve `IDEMPOTENCY_CONFLICT`.

## Limiti operativi e verifica

Quattro richieste attive per connessione, deadline complessiva15s,32anteprime, input4MiB, risposta HTTP8MiB, risultato MCP4MiB prima della doppia rappresentazione. Ricerca letterale Unicode, senza embedding o chiamate provider. L'API attuale restituisce lo spazio completo: spazi oltre il limite vengono rifiutati, non troncati con un falso successo. Per scalare serve paginazione autorizzata lato API, da misurare con workload reali.

Nessun proxy da ambiente, redirect, URL arbitrario da tool, cache di autorizzazioni o diagnostica privata del server. HTTP ammesso solo su loopback con porta esplicita; HTTPS verifica il certificato. Il file privato è una sessione applicativa ordinaria, non un token OAuth con scope server dedicati: l'allowlist aggiuntiva è applicata da questo adapter. Non esporre stdio come servizio di rete tramite un wrapper non autorizzato.

La build produce un artefatto Node autonomo con SDK server/core e Zod, hash e licenze; non entra nel browser o nella Function. `npm run verify` comprende il test di runtime MCP nel gate build. `node tools/mcp-runtime.test.mjs` richiede `M3_TEST_DATABASE_URL` su PostgreSQL loopback dedicato con suffisso`_test`; crea e rimuove soltanto il proprio DB/ruolo casuale, senza toccare preview o dati utente. Prove: client ufficiale esterno, PostgreSQL limitato, ricerca/storia/provenienza, conflitto concorrente, risposta persa+restart, isolamento/revoca studenti, modifica config durante richiesta, cancellazione e EOF. Gli esiti fanno fede solo con digest sorgente e artefatto corrispondenti.

## Corsi versionati

`ardesia://course-format` descrive CourseInput e comandi `save-course`/`create-course-edition`. Le edizioni legano revisione e digest; le unità mantengono ID e revisione propri. `ardesia_apply_command` accetta anche le anteprime corsi e conserva il comando originale dopo esito incerto. Al retry di un’edizione restituisce il corso di quella versione, anche se la bozza è cambiata. Il Core applica autorizzazione, DRAFT, completezza strutturale e integrità.

Questo adapter non restituisce delivery, risposte o aiuti, anche se condivisi nella web app; non assegna studenti né pubblica. La prova esterna verifica save/retry, freeze/retry dopo modifica, lettura esatta e privacy/revoca. [ADR0016](../../docs/adr/0016-versioned-courses.md).

## Programmi nuovi, senza avvio implicito

La resource `ardesia://extension-format` espone ora anche ABI `ardesia.program/1`, schema body/eventi, tag ammessi e un esempio completo. Il client può creare e modificare codice e stato attraverso gli stessi preview/apply. Il test con client esterno verifica il roundtrip su HTTP/PostgreSQL e la storia dello stato; nessun codice gira nel server MCP. Il consenso per eseguire si concede nella vista del prodotto, per la versione e la lezione correnti. [Guida completa](../../docs/programs.md).


## Studio tutor

`ardesia_search_tutor` cerca le schede private del docente con pagine vincolate alla revisione dello spazio. `ardesia_read_tutor` richiede ID e revisione esatta e restituisce anche evento e motivo delle correzioni. `ardesia_preview_tutor` prepara save/record-payment/void-payment per lo stesso `ardesia_apply_command`; configurazione in scrittura obbligatoria. Gli studenti non ricevono il registro. Il pagamento è solo una dichiarazione manuale: nessun incasso, rimborso, messaggio o provider calendario eseguito. [Contratti e limiti](../../docs/adr/0018-tutor-studio.md).

## Originali dei materiali

`ardesia_read_material` richiede workspaceId, documentId, objectId e revision esatti della pagina corrente; senza index restituisce il manifest, con index il chunk base64 verificato. Usa HTTP/ACL correnti e confronta i metadata della pagina col manifest canonico, senza DB diretto o URL arbitrari. Il test esterno SDK/HTTP/PostgreSQL verifica originale e hash. Upload binario da MCP resta escluso; audio e trascrizioni sono consultabili con gli strumenti descritti sotto. [ADR0020](../../docs/adr/0020-original-materials.md).


## Audio, trascrizioni e lezioni esatte

`ardesia_search_recordings` cerca registrazioni e trascrizioni correnti nello spazio posseduto, opzionalmente in una lezione. `ardesia_read_recording` richiede la revisione corrente esatta e restituisce manifest, timeline paginata e metadati della trascrizione. `ardesia_read_transcript` richiede revisioni esplicite di registrazione e trascrizione, con pagine di cue. `ardesia_read_recording_part` legge il chunk originale base64 dopo verifica di binding/digest e ricontrollo dell’autorizzazione. Non effettua fetch di URL arbitrari.

`ardesia_read_document_revision` ricostruisce una lezione posseduta alla revisione richiesta, anche storica, attraverso gli eventi autorizzati. Non sostituisce una revisione mancante con quella corrente. `ardesia_preview_transcript` prepara una trascrizione importata attraverso lo stesso preview/apply e comando Core; tempi, provenienza e revisioni vengono verificati. Nessuna trascrizione automatica o inferenza cloud viene eseguita.

Il test di runtime usa il client MCP ufficiale, bundle stdio, HTTP e PostgreSQL con identità limitata: ricerca dei cue, paginazione, bytes originali, revisione storica, import della trascrizione, isolamento e revoca. I bytes audio sono sintetici: il test non attesta riconoscimento del parlato, microfono reale o host Claude/ChatGPT. Claude sul Mac era installato ma non autenticato; nessuna sua configurazione o sessione è stata modificata.
