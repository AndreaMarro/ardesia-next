# ADR 0006 — Continuità operativa e apprendimento verificabile

Data: 31 ottobre 2026. Stato: adottato per il coordinamento richiesto dall'utente; integrazione del codice di guardia subordinata alla PR e al freeze M3. Non modifica i gate di prodotto.

## Contesto

La PR #16 è integrata, la #18 è pronta per review e M3 remoto resta bloccato da capacità/credenziali/restore. README, osservazioni storiche e handoff riportano epoche diverse. Il legacy aveva già un RUNLOG e regole per gli agenti; la mera presenza dei documenti non garantiva il loro uso. Ogni nuova sessione rischia di ripetere ricerche e test o di riprendere un compito già chiuso.

## Decisione

Usare la repository esistente come memoria durevole con un ingresso breve, una coda validata, un indice storico e lezioni collegate ai reperti. Conservare ADR, runbook, checker di confine e `tools/status.mjs`. Un coordinatore scrive remoto, gli specialisti ricevono scope disgiunti e un contratto di uscita. Le skill personali sono router verso queste procedure versionate; non conservano una copia concorrente dello stato o dei gate.

Riusare le prove soltanto nell'ambito della loro identità. Il sourceDigest integrale non viene alleggerito; anche questa modifica richiede CI finale e non trasferisce accettazione da main al nuovo tree. Localmente verificare ciò che cambia, evitando suite complete ridondanti.

Lo storico distingue fatti, cause confermate e inferenze. Una procedura migliora attraverso incidente → caso → patch → regressioni/review → adozione reversibile. Nessuna autopromozione di permessi, soglie, costi, pubblicazione, prompt o schedule.

## Alternative considerate

| Alternativa | Decisione |
| --- | --- |
| Nuovo orchestratore/daemon, database di memoria o flotta sempre attiva | Scartata: non risolve l'accesso M3 e aggiunge costi/autorità concorrenti |
| Prompt enorme con tutte le chat | Scartata: contesto costoso e rapidamente obsoleto |
| Solo nuovi documenti senza consumer | Scartata: ripete il difetto; scheduler, skill e guardia devono leggere gli stessi percorsi |
| Ridurre i gate o ignorare documenti nel sourceDigest | Scartata: perde il vincolo probatorio esistente |
| Chiedere una nuova autorizzazione per ogni decisione reversibile | Scartata: il mandato delega l'esecuzione; i confini di accesso e pubblicazione restano espliciti |

## Conseguenze e limiti

La coda coordina, non è un secondo registro di accettazione né un lock distribuito. Le mutazioni remote richiedono head attesa; il ruleset reale rimane invariato. Le procedure non creano OIDC, credenziali o reviewer umani. Nessun nuovo servizio, progetto Vercel, MCP server o job Codex. Durante il freeze il sistema può essere consumato dalla revisione di governance esplicitamente adottata dall'automazione, senza spostare il candidato runtime.

Rollback: ripristinare la versione precedente delle sole istruzioni/guardia/automazione interessate dopo confronto della versione corrente. Non promuovere vecchi client o toccare dati remoti. Il record della decisione resta nello storico con una eventuale supersessione.
