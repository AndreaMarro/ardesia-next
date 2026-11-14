# Ardesia Next — ingresso unico

> Beta locale del14novembre: [esperienze, riproduzione e limiti](handoffs/2026-11-14-physics-beta.md).

> Consegna C1–C5 del 13 novembre: [stato concreto e riproduzione](handoffs/2026-11-13-physics.md).

> Consegna applicativa del 7 novembre: [handoff oggettivo](handoffs/2026-11-07.md). Distingue candidato, main, procedura, preview e accettazione; non modifica il cursore né retrodata le prove.


**Modalità corrente dopo adozione: quattro attività orarie, un solo integratore Codex.** Mandato diretto `OPS-20261102-17`: Ingegnerizzazione :00, Sviluppo/integrazione :10, Sviluppo isolato :25, Review :45; GPT-6.1 Sol/xhigh. [Contratto e limiti](hourly-delivery.md), [metodo](recurring-work.md), [configurazione](../operations/codex-automation.json). Sostituisce solo la configurazione unica90min di [ADR0008](adr/0008-codex-sequential.md), senza creare un altro coordinamento. Le ricevute native distinguono attivazione da esecuzione riuscita.

Il mandato [E0–E7 del 2 novembre](history.md#ops-20261102-16--mandato-di-ingegnerizzazione-e0e7) acquisisce il [piano originale](superpowers/plans/2026-11-02-engineering-delivery.md). M4/Poiseuille resta il lavoro applicativo assegnato; ENG-E1 segue nella coda canonica. Pro complementare e OpenCode sono evoluzioni condizionate: l’integrazione resta sequenziale e i loro piloti restano da qualificare. Il setup orario autorizzato successivamente non li dichiara conclusi. La missione copre tutti i18 ambiti oltre M4/M5. [Originali E1 e confini](sources/engineering-e0e7/README.md).

Il titolare deve poter vedere e provare gli incrementi applicativi nella [preview Vercel protetta](https://ardesia-next-staging.vercel.app). Deploy e link verificabile fanno parte della consegna; si conserva l’ultima versione funzionante. [Regole](hourly-delivery.md#prodotto-visibile-su-vercel).

## Ripresa breve
1. Leggi AGENTS e il cursore Git `ops/dual-run-state/handoff.json`, fissando la SHA della ref. v2 usa sempre actor `codex`; il nome storico della ref resta per evitare copie e link rotti.
2. Carica il metodo alla `procedureRef`; il task completo e gli AGENTS dell'area alla sorgente assegnata. Per un candidato precedente alla governance usa il fallback esplicito alla procedura, mai fingere che i file fossero sul candidato.
3. Leggi solo decisioni e lezioni richiamate dal task. Riconcilia main, PR/head, claim e CI realmente coinvolti. La ricerca estesa nelle chat/legacy serve solo per una lacuna che cambia la decisione.
4. Riprendi lavoro non concluso o CI pendente; altrimenti seleziona il primo task eleggibile, con consumer, perimetro, criterio di uscita e rollback. Un freeze di integrazione non impedisce una review in lettura.
5. Chiudi con un solo risultato e passo successivo. Registra in Git i cambiamenti materiali, non un diario identico a ogni slot.

## Fonti autorevoli
| Domanda | Fonte |
|---|---|
| Che prodotto stiamo costruendo? | [Mappa dei 18 ambiti](product-map.md), [D01–D68](acceptance/D01-D68.json), fonti originali richiamate |
| Quale lavoro viene prima? | `operations/coordination.json` e i suoi criteri/dependenze, non vecchi messaggi di stato |
| Chi sta scrivendo e cosa resta? | Cursore live, head/claim/processi osservabili |
| Perché una scelta? | [Storico](history.md) e ADR; archivio precedente conservato |
| Quali errori evitare? | [Lezioni](lessons.md), poi il solo reperto pertinente |
| Un gate è accettato? | Report originali del candidato e `tools/status.mjs`, mai il cursore |
| Quali integrazioni posso usare? | [Integrazioni](integrations.md), accessi effettivi della run e runbook |

## Baseline osservata il 1 novembre 2026
Main `03622b56c9756225019b7c6219d226beef8e0a6d`; PR20 è il metodo in preparazione, PR18 è il benchmark già pubblicato a `174d15bbad2b5d962011dabfed467c330ddc12da`. Non integrare ordinariamente durante il freeze M3. Cursore precedente revision 3 senza activeRun; regia ChatGPT visibile disabilitata, ultimo run registrato concluso. Nessun worker Codex nativo dichiarato avviato dall'utente. Queste sono fotografie, non prove del futuro.

M3 remoto resta da accettare: OIDC, credenziali QA e restore sicuro sono capacità distinte da verificare, non database da riprovisionare. Non certificare staging/digest da una vecchia fotografia. Margine bundle storico 16 byte; misurare sulla revisione modificata. Non ripetere l'esteso PR18 per un cambio del metodo.

**Il primo Codex deve verificare il setup nativo e riesaminare questa migrazione**, poi riprendere la coda. Non serve un login a un vecchio task per assegnare un lavoro indipendente: una risorsa realmente contesa rimane protetta dai controlli correnti. La configurazione del task nativo è PREPARED/NOT_RUN finché non vengono osservati modello, ambiente, cronologia e una vera esecuzione utile.
