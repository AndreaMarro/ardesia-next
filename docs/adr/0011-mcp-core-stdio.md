# ADR0011 — MCP Core sullo stesso confine autorizzato

Stato: preparazione locale nell'ambito del mandato diretto del7novembre2026; integrazione/accettazione remota e compatibilità host separate. Nessun cambio a coda, cursore, scheduler, database o deploy condiviso.

## Decisione

`@ardesia/mcp-core` è un adapter Node stdio del protocollo MCP. Dipende soltanto dai contratti pubblici Ardesia e dall'SDK ufficiale; usa `POST /api/m3` già esistente. Non importa il Core, il server o PostgreSQL. I comandi rimangono quelli esistenti con identità esplicita, CAS e ricevuta atomica; DRAFT, provenienza e riferimenti scientifici restano applicati dal server. Nessuna dipendenza da un modello o provider AI per scrivere o leggere.

Il consumer completo è un client MCP esterno che ricerca una lezione, compone fonte/formula/collegamento e modifica lo stesso documento riapribile dalla UI. L'accesso parte in sola lettura, con sessione applicativa privata e spazi esplicitamente scelti. Il docente può abilitare la scrittura. `preview→apply` rende visibile e immutabile il comando; non attesta approvazione umana. L'interazione di approvazione di ogni host resta da collaudare. Una capability concessa al processo non è una sandbox del sistema operativo.

Le anteprime sono limitate e temporanee, senza store persistente; i soli fatti durevoli restano nel Core. Si mantiene il comando originale per la ripresa di una risposta incerta. Dopo restart l'utente/host può preparare nuovamente lo stesso ID/payload/revisione: il Core restituisce la ricevuta già salvata o un conflitto. Nessun tentativo autonomo di dedurre il commit dalla revisione corrente.

## Recupero storico e fonti

Il README Study MCP legacy alla SHA`5cfbdcb055ba3ba136f97fb56e997f06e6cf3605` è stato consultato in sola lettura. Si conservano sessione privata, envelope stretti, API autorizzata, errori redatti e prove con client ufficiale; il vecchio perimetro read-only non limita il mandato attuale. Non si trasferiscono la sua accettazione o compatibilità a Next e non si copia il server Python. Chat già recuperate e analisi REA restano in [fonti dello studio](../sources/spatial-board-2026-11-07.md): nessuna nuova esecuzione REA viene inventata per questo adapter.

Documentazione primaria letta: [SDK TypeScript](https://github.com/modelcontextprotocol/typescript-sdk), [first server](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/get-started/first-server.md), [first client](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/get-started/first-client.md). Versioni effettivamente installate e ispezionate:`@modelcontextprotocol/server`, `core`, `client`2.4.0; protocollo corrente2026-07-28 con apertura legacy gestita dall'SDK. API pubbliche e tipi installati sono stati usati per lifecycle/stdio/cancellazione; lockfile e licenze conservano risoluzioni esatte. Il client è soltanto dipendenza di verifica; server/core sono nel bundle CLI separato.

## Confini e compromessi

Ogni lettura passa dal server. L'adapter restituisce documenti autorizzati, oggetti e metadati; esclude lavoro privato studenti, consensi e learning events dalla propria superficie. Un proprietario, anche studente, consulta le revisioni storiche dei propri documenti; negli spazi assegnati legge soltanto la versione corrente autorizzata. La continuazione del 7 novembre aggiunge revisioni storiche di documenti posseduti, ricerca/lettura delle registrazioni e trascrizioni con revisioni esplicite e le API dei corsi descritte nel README. Non offre ASR, host cloud/OAuth o accesso a lavoro privato degli studenti.

Configurazione verificata a inizio richiesta, immediatamente prima di inviare un comando e prima di pubblicare un risultato. Cancellazione, revoca e EOF chiudono il trasporto locale; un comando già inviato può essere committato. File di sessione0600, no symlink/file speciali, lettura limitata anche se il file cresce. Solo endpoint fisso da config privata, niente redirect/proxy da ambiente o URL fornito dall'agente. Il token resta una sessione applicativa ordinaria: OAuth delegato, autenticazione di host cloud e scoping server dedicato sono un incremento futuro, non simulati con header del chiamante.

La ricerca scorre la proiezione corrente dello spazio. Limiti di memoria/tempo espliciti impediscono risposte indefinite, ma non certificano grande scala: serve una futura query paginata autorizzata lato API. Conformità del client SDK non equivale a compatibilità già provata con ChatGPT/Claude/Gemini. Nessuna nuova pubblicazione, inferenza a pagamento o esposizione remota viene introdotta.

## Prove e rollback

Unit su file/trasporto/permessi/storia/envelope e interruzione del prompt. Test artefatto in directory temporanea senza sorgenti o node_modules: client SDK→stdio→HTTP→Core/PostgreSQL limitato. Fault injection dopo commit, riavvio processo, retry identico, conflitto da modifica web, record studenti esclusi, revoca assegnazione/sessione/config in volo, cancellazione ed EOF. Test browser esistente resta richiesto perché lockfile/build sono parte della sorgente. L’adapter resta fuori dal browser. Le soglie della prima consegna sono storiche; la policy misurata del successivo incremento applicativo è documentata in ADR0021.

Review indipendente in sola lettura, correzioni del root e report con identità esatta. Il primo tentativo del collector MCP ha fallito per un nome errato del comando fixture `save-learner-notes`: il contratto reale è `save-learner-note`/`text`; fallimento conservato, nessun cambiamento del Core per farlo passare.

Rollback: revocare la sessione MCP e fermare il client, poi rimuovere l'adapter con una modifica successiva. Nessuna migrazione dati da annullare. Oggetti, fonti, revisioni e ricevute già creati rimangono nel Core e nella UI; rimuovere il trasporto non annulla le modifiche confermate.
