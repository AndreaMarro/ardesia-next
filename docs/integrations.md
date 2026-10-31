# Piattaforme, capacità e MCP

Inventario operativo del 31 ottobre 2026. Il dettaglio delle osservazioni con data è in [coordination.json](../operations/coordination.json); le capacità vanno riconfermate quando servono. Un tool esposto, una sessione browser e un permesso di scrittura sono fatti diversi.

| Superficie | Capacità verificata o fonte | Uso autorizzato / limite |
| --- | --- | --- |
| GitHub `AndreaMarro/ardesia-next` | Repository pubblica, letture main/PR/CI e ruleset live; scritture coordinate su branch/PR e issue | Sorgente, lavoro, prove e storia. Main freeze; niente bypass/ruleset indebolito, force push, reviewer fittizi o job Codex |
| GitHub legacy `ardesia` | Letture a `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605` | Recupero selettivo con fonte/diritti; nessuna modifica, clone runtime integrale o deployment |
| `ardesia-knowledge` | Citato nel mandato precedente come legacy; non ispezionato in questa ricognizione | Solo fonte eventuale in lettura, non nuova autorità o dipendenza della ripresa |
| ChatGPT attività esistente | `6adbfad145dc81919b36fc0cdf0eed0c`, abilitata, 06:00 `Europe/Rome` | Un solo coordinatore pianificato; aggiornamento del prompt autorizzato dall'utente, non auto-riscrittura nelle run. Nessuna garanzia di attività continua fra esecuzioni |
| Skill personali | Router di procedure verso questa revisione, installazione da attestare separatamente nel checkpoint | Le procedure sono riusabili anche dal prompt, se l'installazione non è disponibile. Non sono agenti sempre attivi o privilegi nuovi |
| Vercel progetto esistente | `prj_GGKjCPG4cdgaQDQQMJoFvsy2ffSd`; project/alias/deployment letti live, staging protetta | Conservare unico progetto e alias; niente autodeploy o produzione per aggirare M3. Metadati non provano build-info autenticato |
| Vercel OIDC/QA | Ultimo handoff: canale temporaneo non disponibile; env metadata precedentemente negato con 403 | Un controllo di disponibilità quando utile; niente riuso token di altri servizi o estrazione segreti dal browser |
| Neon/PostgreSQL | Configurazione e tre account nell'osservazione storica del 30 ottobre; nessuna lettura live database in questa sessione | Unica autorità remota del prodotto; runtime/operator distinti. Non creare, svuotare o sostituire risorse per risolvere il blocco |
| CI isolata | Verify già esistente, permessi contents read, Actions fissate a SHA, PostgreSQL effimero | Verifica sul commit; mai credenziali QA remote a codice PR. Extended benchmark PR18 separato e pertinente ai suoi path |
| REA | Patrimonio e processo legacy documentati; runtime eseguibile non verificato in questa ricognizione | Usare solo strumenti realmente disponibili per missione autorizzata. Una ricevuta non può essere inventata e una ricerca non prova una cattura REA |

## Tre piani distinti

1. **Connettori operativi:** GitHub, Vercel, contesto/file e scheduler aiutano a costruire Ardesia. Non entrano automaticamente nelle dipendenze dell'applicazione.
2. **API Core del prodotto:** comandi, autorizzazioni e ricevute esistenti, con server/PostgreSQL autorevole e client remoto. Gli strumenti scientifici attraversano Host/SDK.
3. **MCP Core del prodotto:** adapter futuro per esporre un sottoinsieme esplicito del piano precedente. Nessun runtime MCP Next è certificato da questa organizzazione. Il donor legacy espone quattro letture e dichiara compatibilità host UNKNOWN.

## Contratto per un futuro adapter MCP

Prima di implementare: consumer e trasporto concreti, versione della specifica supportata, operazioni allowlist, schema di input/output, autorizzazione per risorsa/attore, provenienza e limiti. L'adapter non scrive direttamente in PostgreSQL, non conserva un altro event log e non reinterpreta un ruolo. Le mutazioni, se autorizzate in quel successivo mandato, usano ID idempotente e ricevuta Core.

Per HTTP: credenziali destinate alla risorsa, issuer/audience verificati e scope minimi; niente token passthrough o token GitHub riutilizzato come sessione Ardesia. Per stdio seguire il modello del trasporto, senza applicare meccanicamente OAuth HTTP. Richiedere validazione origin/URL e protezione SSRF pertinente al consumer, revoca e controprove; il testo di un tool non è un permesso.

Riferimenti: [MCP Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization), [MCP Security](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices), [MCP legacy](https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/services/study-mcp/README.md). Non si dichiara conformità alla specifica o supporto di host non testati.

## Sblocco senza cicli inutili

L'assenza di OIDC/QA/restore blocca il percorso M3, non autorizza altri provider, account, acquisti o login ripetuti. Registrare la capacità mancante e il segnale necessario per ricontrollarla nell'[issue M3](https://github.com/AndreaMarro/ardesia-next/issues/19). Le operazioni reversibili già delegate proseguono sul branch isolato solo se eleggibili; quando non lo sono, una run senza modifica è corretta.

Un futuro nuovo connettore o servizio richiede un consumer, alternative considerate, costo reale, owner, stato di autorizzazione, fallback e criterio di rimozione. Il sistema attuale funziona senza nuovo orchestratore, memoria esterna o MCP server aggiuntivo.
