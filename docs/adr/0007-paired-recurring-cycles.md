# ADR 0007 — Pro e Codex, due fasi dello stesso incremento

Data: 1 novembre 2026, Europe/Rome. Stato: procedure preparate; mandato di attivazione aggiornato da OPS-20261101-03. L'esito effettivo della configurazione è nel checkpoint della PR20.

## Contesto e mandato

Il titolare richiede una procedura per ChatGPT Pro e una per Codex GPT-6.1 Sol Max, circa ogni tre ore sfalsate, ciascuna chiudibile entro un'ora. Richiede prompt e strumenti pronti, senza impostare le attività. Visione, gate M3, legacy in sola lettura, assenza di nuovi acquisti e di produzione implicita rimangono.

Il precedente divieto generale di Codex è superato per questa coppia configurata dal titolare. La migrazione del registro 1.0.0→1.1.0 lo esprime con due fatti distinti: `ownerScheduledCodexAllowed:true` e `agentLaunchedCodexJobsAuthorized:false`. Nessun agente avvia job annidati o acquista crediti. La precedente attività delle 06:00 conserva il proprio mandato finché il titolare non la sostituisce. Non si modifica retroattivamente OPS-20261031-01.

**Aggiornamento del mandato:** il messaggio successivo «imposta tu le attività» delega al coordinatore la configurazione e la scelta motivata fra uno o due scheduler. Supera soltanto il precedente divieto di attivazione in questa consegna. La scelta resta due ruoli sullo stesso incremento; il worker Codex viene pianificato soltanto dove modello, effort e ambiente sono realmente selezionabili. La regia può essere configurata da sola per la ricognizione, senza autoapprovazioni o scritture prima della riconciliazione del processo precedente. Le esecuzioni future non ricevono il potere di modificare i propri orari.

## Decisione

- Pro mantiene direzione, selezione del prossimo incremento, review, integrazione e piattaforme; Codex implementa e verifica un ticket circoscritto o svolge una review indipendente del lavoro Pro.
- Una consegna Pro può assegnare il successivo ticket a Codex oppure mantenere a Pro un nuovo incarico di sola coordinazione. L'helper conserva l'identità del predecessore; la storia Git e la PR conservano le prove. Non affidare a Codex un'operazione riservata a Pro per aggirare un limite del flusso.
- Un solo task prodotto attivo; non due roadmap. La coda rimane `operations/coordination.json`; storia e lezioni rimangono quelle esistenti; il gate rimane `tools/status.mjs`.
- Un piccolo `handoff.json` su `ops/dual-run-state` conserva solo l'incarico corrente, il proprietario della run e riferimenti alle prove. La ref non è un branch applicativo, non viene mai unita a main e non contiene workflow. Mantiene `git.deploymentEnabled:false` per evitare deploy da push.
- Il passaggio usa un commit figlio della ref letta e push normale senza force. Un conflitto ferma lo scrittore. Questa proprietà protegge l'aggiornamento del cursore, non costituisce un lock atomico su GitHub, Vercel e database.
- Nessun takeover sulla sola scadenza. Una run non terminata richiede riconciliazione e prova di cessazione, altrimenti il lavoro resta in lettura.
- Budget operativo 45 minuti di lavoro, 55 per la chiusura e cinque di margine. Una run può terminare molto prima. Il prompt e la CLI non garantiscono un timeout globale del servizio: CI e servizi possono continuare indipendentemente, con stato WAITING_CI e senza nuove scritture dell'agente.
- Miglioramenti procedurali richiedono un incidente verificato, caso e controesempio, review separata di un non autore e prove sulla nuova revisione. Codex rimane opzionale: quando assente, è ammesso soltanto un revisore già disponibile e autorizzato nella sessione Pro, in sola lettura e nel medesimo budget, come definito dal protocollo; nessun nuovo actor del cursore, job esterno o autoapprovazione. Il puntatore `procedureRef` si adotta separatamente solo dopo questi riscontri; prompt, schedule, accessi, costi, gate e produzione non si auto-modificano.

## Avanzamento del prodotto

Il mandato di continuità permette a Pro di preparare il successore circoscritto quando i gate originari e le dipendenze sono realmente soddisfatti: non serve ricominciare una discussione generale a ogni ciclo. Prima di una nuova fase deve riconciliare e versionare le variazioni sostanziali di coda/policy con le prove del gate. Il congelamento attuale non viene rimosso da questa ADR. M4, microcorsi, Creator, marketplace e MCP restano sequenziati nella mappa prodotto; nessuna autorizzazione commerciale o alla produzione nasce dal completamento di una run.

`M3-TRANSITION` rende esplicito il lavoro di chiusura: baseline e prove originali, stato del candidato distinto dalla milestone storica, evoluzione coerente del motore esistente e delle guardie di fase, un successore eleggibile. I task differiti rimangono visibili nel brief. Le decisioni materiali dalle chat vengono acquisite nello storico esistente prima di HANDOFF con fonte, ID e revisione; un solo scheduler non garantirebbe da solo questa continuità.

## Alternative e limiti

Una seconda memoria esterna o un orchestratore aggiungerebbero accessi e dipendenze senza risolvere i prerequisiti M3. Il solo body di una issue è semplice ma non offre il confronto atomico della ref Git. Mettere ogni checkpoint nel tree candidato invalida il digest e genera CI ripetuta. La ref dedicata riusa il servizio esistente con un costo di coordinamento contenuto.

Il modello e Max devono essere disponibili e selezionati nel futuro task. Due orari sfalsati non garantiscono assenza di overlap. Le due sessioni non condividono automaticamente filesystem o credenziali. Senza accesso comune al cursore e possibilità di aggiornamento senza force, la coppia non è pronta a scrivere.

## Prove e rollback

Controprove del validatore, budget e transizioni; esercizio di due push concorrenti su una repository temporanea; review separata dei due prompt; CI sulla revisione finale. Esercizi di modello sono qualitativi, non run schedulate osservate. Esiti effettivi nella PR.

Per rollback, fermare prima nuove run e riconciliare quelle attive; ripristinare la precedente revisione delle procedure con nuovo commit e review. Conservare handoff e FAIL nella storia Git. Non cancellare claim attivi, non forzare ref e non usare il rollback del metodo come rollback del database o del client.

## Fonti

- [Operazioni](../operations.md), [lezioni](../lessons.md), [mappa prodotto](../product-map.md).
- [Scheduled tasks](https://learn.chatgpt.com/docs/automations), [modelli](https://learn.chatgpt.com/docs/models), [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol).
