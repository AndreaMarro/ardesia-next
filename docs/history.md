# Storico canonico — Ardesia Next

Questo è l'unico indice attivo. Le prove originali sono in PR/run/artefatti, l'accettazione in `tools/status.mjs`. Non cancellare o riscrivere decisioni superate: aggiungere una supersessione circoscritta.

## Archivio e fonti
Il testo precedente, incluse OPS-20261031-01, OPS-20261101-02/03/04, è conservato **byte per byte** in [history-through-20261101.md](history-through-20261101.md). È un archivio storico, non un secondo registro corrente. La coda antecedente è [archiviata](../operations/archive/coordination-before-sequential.json). Le fonti legacy e i 116 requisiti/68 criteri rimangono indicizzati da [product-map](product-map.md); non sono stati riscritti né promossi a PASS.

## OPS-20261101-05 — incidente della prima regia
La run pianificata ha concluso BLOCKED per mancata osservabilità del vecchio task e ha dichiarato di essersi disattivata. Modello effettivo non esposto; il titolare segnalava che non era Pro. La documentazione/CI della procedura non dimostrava modello, tool e intero percorso nativo. Reperto originale: [commento PR20](https://github.com/AndreaMarro/ardesia-next/pull/20#issuecomment-6552385411). Non ricontare suite né attribuire una nuova accettazione a questo incidente.

## OPS-20261101-06 — richieste di ricorrenza e modello scelto dal titolare
Fonte: messaggi diretti nella conversazione, effettivamente disponibili nel contesto corrente. Il titolare ha riservato a sé la selezione del modello e richiesto nuovamente la ricorrenza. Le precedenti risposte hanno presentato in modo contraddittorio pausa/avvio e ricorrenza. Una regola salvata non prova un'esecuzione nel modello richiesto. Non attribuire al testo del prompt la scelta del modello.

## OPS-20261101-07 — Codex unico ogni 90 minuti
Fonte: ultimo messaggio diretto dell'utente del 1 novembre 2026: riferisce di non avere fatto partire nulla e richiede Codex in compiti sequenziali ogni ora e mezza, sistema ripulito, agenti/skill, contesto/storico sempre aggiornati e visione ben oltre M3/M4. Non si inferisce da questa frase la cessazione di processi remoti non osservati; il worker Codex nativo non viene dichiarato attivo.

**Decisione:** [ADR 0008](adr/0008-codex-sequential.md). Un solo coordinatore Codex sostituisce la coppia, una coda e un cursore esistenti, workflow sequenziale entro 55 minuti. Specialisti transitori quando utili. Il task stesso non modifica scheduler, modello o permessi. Le autorizzazioni ordinarie non vengono richieste di nuovo. Un accesso mancante blocca la sola operazione, senza bypass o solleciti ripetitivi.

**Supersedes:** attori/cadenza e dipendenza obbligatoria da Pro di OPS-02/03/ADR0007 e relativi prompt; non i gate M3, la review indipendente, il freeze di rilascio, privacy, diritti o limiti economici. L'ID storico non accessibile non è più un blocco globale. Conservare M3-TRANSITION e tutti i 18 ambiti della mappa, non fermarsi automaticamente a M4/M5.

**Ricognizione:** GitHub main `03622b56...`, PR20 head di partenza `ed251f6...`, cursore revision 3 senza activeRun; regia ChatGPT visibile disabilitata, ultimo run registrato concluso. Ricerca mirata Personal Context sulle decisioni degli ultimi giorni (riepiloghi, non tutte le chat). Letti product-map Next e apertura della specifica legacy a `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`; nessuna scrittura legacy e nessun nuovo esame dei 36 binari visuali. Clone Git nel container non disponibile per DNS: i file necessari sono stati letti col connettore; il helper originale ricostruito è stato confrontato con il Git blob `c7d9a621c138c1465fc71d415a5b629787d4e270`.

**Modifica:** estensione v2 di cycle.mjs, selezione in-run, migrazione, consegna Codex→Codex e ricevute review; prove nuove collegate alla Verify esistente. Sostituzione delle procedure duplicate, quattro skill e cinque profili locali, archivio storico conservato. Nessuna runtime app, DB, soglia, provider, produzione o gate modificati.

**Verifica:** prima esecuzione delle 16 controprove nuove sul helper precedente: 3 PASS/13 FAIL; dopo le modifiche, 16 PASS. Ulteriori controprove hanno riprodotto e corretto tre lacune (secondo incremento attivo, claim malformati, blocker duplicati): 18 PASS/3 FAIL prima, 21 PASS dopo. Un ultimo caso ha corretto il passaggio dal predecessore completato al nuovo lavoro nella medesima run: 21 PASS/1 FAIL prima, 22 PASS dopo. Non occorre consumare uno slot solo per assegnare il successore. Risultati finali e CI sono nel checkpoint PR20. Nessuna review indipendente o prova Codex nativa viene inventata. Il numero di test non è progresso didattico.

**Setup:** vecchia regia conservata sospesa; configurazione nativa Codex PREPARED, da eseguire attraverso il prompt del titolare nel suo client. La presenza di TOML/SKILL e di una RRULE nel manifest non attiva da sola alcun task. Primo ciclo: verifica tool/modello/ambiente e review di questa migrazione, poi lavoro eleggibile. Stop rapido solo se nessun risultato sicuro è realmente possibile.

**Rollback:** nuovo commit ai soli file operativi/cursore dopo cessazione delle run; preservare archive e artefatti. Nessun downgrade dati implicito.

## Acquisizione successiva
`ID/data | fonte letta | decisione e limiti | supersedes | requisito/task | sorgente/prove | risultato/limiti | unico successore`.
Aggiornare solo per cambiamenti materiali. Il cursore contiene la ripresa corrente e link a questa storia; non duplicare l'intero archivio nei prompt o nelle skill.

## OPS-20261101-08 — verifica integrata e compatibilità del formato

La prima Verify della preparazione, run 41299467188 su c90779efc67af3c8df83a39be0544d863373c46c, ha prodotto 73 PASS/1 FAIL su 74 test operativi e ha saltato le suite applicative successive. Il FAIL non viene rinominato come PASS: la controprova v1 usava 2.0.0 come versione sconosciuta, ora esplicitamente supportata. Ricostruito e confrontato il file test originale con il suo Git blob; riprodotto localmente 27 PASS/1 FAIL. La fixture sconosciuta diventa 999.0.0, senza eliminare assert o test. Aggiunta una prova che rifiuta il semplice rietichettamento v1→v2 e mantiene il caso v2 valido. Le skill repo-locali sono rinominate ardesia-sequential-* per evitare ambiguità con quelle personali storiche; nessuna skill globale modificata. La CI della nuova head è riportata nella PR; nessuna review indipendente/nativa inventata.

## Riferimenti storici conservati

<a id="ops-20261031-01--assetto-operativo-e-riconciliazione"></a>
OPS-20261031-01: [voce integrale nell’archivio](history-through-20261101.md#ops-20261031-01--assetto-operativo-e-riconciliazione).

<a id="ops-20261101-02--coppia-procodex-preparata-senza-pianificazione"></a>
OPS-20261101-02: [voce integrale nell’archivio](history-through-20261101.md#ops-20261101-02--coppia-procodex-preparata-senza-pianificazione).

<a id="ops-20261101-03--mandato-aggiornato-per-attivazione-e-continuità-del-contesto"></a>
OPS-20261101-03: [voce integrale nell’archivio](history-through-20261101.md#ops-20261101-03--mandato-aggiornato-per-attivazione-e-continuità-del-contesto).

<a id="ops-20261101-04--autonomia-pro-senza-ulteriori-richieste-di-autorizzazione"></a>
OPS-20261101-04: [voce integrale nell’archivio](history-through-20261101.md#ops-20261101-04--autonomia-pro-senza-ulteriori-richieste-di-autorizzazione).
