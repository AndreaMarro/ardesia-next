# Ardesia Next — ingresso operativo

Questa pagina instrada il lavoro. **Non è un report di accettazione.** Le osservazioni seguenti sono datate 31 ottobre 2026 e devono essere confrontate con GitHub prima di scrivere; il dettaglio strutturato è in [coordination.json](../operations/coordination.json).

## Ripresa in pochi passi

1. Leggere sempre [AGENTS](../AGENTS.md). `node tools/check-operations.mjs --brief` può fare da indice iniziale; prima di scegliere o rivendicare il lavoro leggere la voce completa del task in `operations/coordination.json`, comprese scope, criteri di uscita, prove e osservazioni. Il brief non li sostituisce.
2. Confrontare main, PR aperte, head, review e CI con gli identificativi registrati. Per un'operazione remota, verificare anche target/capacità/protezione correnti. Non ripetere login o richieste già negate senza un segnale nuovo.
3. Leggere il solo playbook pertinente del [manuale operativo](operations.md) e le istruzioni dell'area. Consultare [lezioni](lessons.md) e [mappa prodotto](product-map.md) quando il rischio o il requisito le rende pertinenti.
4. Riprendere il task/PR esistente; registrare il claim prima di scrivere. Terminare un incremento e il suo riesame prima di aprirne un altro.
5. Aggiornare lo [storico unico](history.md) soltanto per cambiamenti materiali. Aggiornare lo stato prodotto con `npm run status`, mai a mano.

## Fotografia riconciliata, 31 ottobre

| Piano | Osservazione e fonte | Limite |
| --- | --- | --- |
| Sorgente | `main` = `03622b56c9756225019b7c6219d226beef8e0a6d`; [PR #16](https://github.com/AndreaMarro/ardesia-next/pull/16) merged | La coda P0 precedente è corretta; non ripararla di nuovo senza regressione riprodotta |
| Incremento benchmark | [PR #18](https://github.com/AndreaMarro/ardesia-next/pull/18), head `174d15bbad2b5d962011dabfed467c330ddc12da`; [Verify](https://github.com/AndreaMarro/ardesia-next/actions/runs/41216361836) e [esteso](https://github.com/AndreaMarro/ardesia-next/actions/runs/41216361872) success | Aperta, non integrata; 100 osservazioni per operazione nel profilo esteso. In-process esclude rete, TLS, penna fisica e rendering |
| Staging | Alias `ardesia-next-staging.vercel.app` → `dpl_5NP212LfLh1vCBYwD68KEkxqBwe3`, SHA `f2b8dd864bc476efafca435c994cfa44af768a8c`, target `staging`; SSO `all`; alias senza bypass | Metadati letti live. Digest del contenuto distribuito non verificato live in questa ricognizione |
| Database | [Osservazione del 30 ottobre](../operations/m3-environment.json): Neon configurato, PostgreSQL 18, tre identità sintetiche | Non è un nuovo controllo live del database né disponibilità delle credenziali al runner |
| M3 | `AWAITING_COMPLETE_EVIDENCE`; [gate originale](../tools/status.mjs) e [dodici controprove](../tools/m3-evidence.mjs) | OIDC, credenziali QA e restore sicuro restano prerequisiti non disponibili/verificati nell'ultimo handoff |
| Prodotto | M0–M2 conservati come baseline; M4/M5 non avviati; prodotto `NOT_COMPLETE` | Una CI verde, READY, un documento o una task completed non accettano un percorso remoto |

Main e staging restano congelati durante M3. Il candidato sorgente e il deployment attuale **non coincidono**: il riallineamento è un passaggio del [runbook](release-runbook.md), ammesso soltanto con il percorso protetto e i prerequisiti verificati. Il bundle del candidato ha 16 byte di margine sul limite 245760 gzip; il limite resta invariato.

## Fonti e precedenza

| Domanda | Fonte da aprire |
| --- | --- |
| Che cosa posso fare ora? | Mandato utente, AGENTS, task/claim e blocchi in `operations/coordination.json` |
| Che cosa esiste ora su una piattaforma? | Metadati live + codice sulla SHA citata; [inventario piattaforme](integrations.md) |
| Un gate è accettato? | Report originali dello stesso candidato e `tools/status.mjs`; non il task board |
| Che cosa vuole Andrea? | [Mappa prodotto](product-map.md), D01–D68 e fonti immutabili richiamate |
| Perché è stata presa una decisione? | ADR e [storico](history.md), con supersessioni esplicite |
| Che cosa non dobbiamo ripetere? | [Indice delle lezioni](lessons.md), poi solo il reperto pertinente |

Il dossier del 29 ottobre, le sezioni M0 di architecture/handoff e `operations/m3-environment.json` conservano osservazioni storiche. Le frasi «Neon non configurato», «runner completo assente» e «repository privata» non descrivono tutte lo stato del 31 ottobre. Non riscrivere il passato per renderlo coerente con il presente.

## Prossima azione

Il gate di prodotto prioritario resta **M3 remoto**. Se i suoi prerequisiti non cambiano, riusare il checkpoint, completare la review delle PR esistenti e scegliere soltanto un miglioramento indipendente già eleggibile dalla coda. Se le sole azioni residue richiedono accessi assenti o violano il freeze, terminare la run con il blocco preciso. M4, nuovi corsi runtime e commercializzazione rimangono subordinati ai loro gate.
