# Manuale operativo — indice attivo

La modalità corrente è **Codex sequenziale**: [protocollo unico](recurring-work.md), [ADR 0008](adr/0008-codex-sequential.md), [ingresso](START_HERE.md). Questo indice sostituisce le istruzioni duplicate della coppia Pro/Codex, non i requisiti del prodotto. Il testo precedente è conservato nella storia Git della PR20 alla revisione `ed251f6df304a511718f811b1b0a392dd2021461`.

## Verification and reuse
Conservare identità sorgente, comando/versione, configurazione, lockfile/toolchain, ambiente/target, fixture, esito e riferimenti originali. Artefatto letto, metadato osservato e prova riusata sono tre stati distinti. Cambio di agente non giustifica rerun. Cambio del tree, inclusi documenti, richiede Verify della head finale; aggiornamento del solo cursore/commento no. Il contratto sourceDigest resta integrale. Controprove negative, browser, PostgreSQL, firme e budget si applicano al delta, senza abbassarne le soglie. Remote/hardware/approvazioni umane non si inferiscono dalla CI.

## Acquisizione dei nuovi mandati
Prima di trasferire lavoro influenzato da una decisione nuova, registrare una sola voce nello [storico](history.md): fonte realmente vista, data, ID, decisione, ambito/limiti e supersessione precisa. Una domanda non è una decisione; una sintesi recuperata non è la chat originale. Il task richiama ID e revisione contenente la scelta. Non esportare conversazioni private e segreti. Se una fonte manca, cercare la sola lacuna che cambierebbe il task.

## Ruoli
Il root Codex conserva priorità, integrazione, decisioni architetturali e scritture remote. Gli specialisti repo-locali coprono esplorazione/architettura, review tecnica, scienza/didattica, UX e cura della memoria. Non sono account distinti né processi permanenti. Al massimo due per run e solo quando riducono rischio o lavoro; review distinta dall'autore per cambi sostanziali. I contratti sono in `.codex/agents`; il metodo riusabile è in `.agents/skills`. Nessun servizio aggiuntivo.

## Playbook
- Esecuzione/ripresa: skill `ardesia-next-execution`, un task e un consumer; [protocollo](recurring-work.md).
- Review/evidenze: skill `ardesia-next-review`, revisione esatta, casi avversi, provenienza e limiti.
- Scienza/contenuti/REA: skill `ardesia-product-slice`, [mappa prodotto](product-map.md), diritti, revisione e consumer reale.
- Apprendimento: skill `ardesia-next-learning`, incidente verificato, caso/controesempio, review, test e rollback.
- M3 remoto: [runbook originale](release-runbook.md), `e2e/README.md`, produttori e gate esistenti. Staging protetto, tre identità QA, sorgente read-only e target restore distinto, preesistente, migrato e vuoto. Non crearli/svuotarli per aggirare il prerequisito.

## Criteri tecnici invariati
SOLID ai confini reali: dominio nel Core, effetti negli adapter, recupero nel Remote Client, esecuzione nel Host/SDK. Contratti piccoli, dipendenze pubbliche, test di sostituibilità e consumer reali. Niente CQRS/microservizi/interfacce per il solo nome. Snapshot: localizzare costo con campioni comparabili prima di cambiare dati. Bundle: contare asset iniziali/differiti/plugin e mantenere soglia vigente. Crescita: misure di carico, isolamento e recovery prima di dichiarare scala.

Checkpoint materiale: task/requisito, fonti@ref, base/head/PR, risultato, prove riusate/eseguite, review, limiti, blocker cambiati, rollback e unica azione successiva. CI finale/identità stanno nella PR evitando commit ricorsivi per citare il proprio hash. Il claim protegge il coordinamento, non equivale a un lock atomico su servizi esterni.
