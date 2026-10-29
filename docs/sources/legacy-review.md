# Ardesia Next — recupero selettivo dal codice reale

Data osservazione: 29 ottobre 2026. Audit in sola lettura. Nessun file o riferimento remoto modificato.

## Ancora verificata

- Repository sorgente: https://github.com/AndreaMarro/ardesia
- Branch main: `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`.
- Commit: merge PR #336, “Integra Fluidi e termodinamica: corso, laboratori e runtime remoto protetto”; 28 ottobre 2026, 20:06:52 UTC.
- Albero Git completo letto dal connector: 5.725 voci, `truncated=false`.
- Clone shell non disponibile: connessione al proxy di rete `browser-proxy:8889` fallita. File selettivi letti via GitHub alla SHA esatta e conservati nella directory di ricerca locale `legacy-audit`; non è un clone completo.
- Non sono stati eseguiti test locali del progetto legacy. Le prove remote qui sotto sono osservate sulla SHA indicata, non trasferibili automaticamente alla nuova repository.

## Integrato, testato, distribuito

| Stato | Evidenza osservata | Limite |
| --- | --- | --- |
| Integrato | Main è il merge #336 sopra indicato | Non equivale a prodotto completo |
| CI della stessa SHA | [ci 40760356271](https://github.com/AndreaMarro/ardesia/actions/runs/40760356271), conclusione success; job studio, web, engine, API, MCP, hygiene, e2e advisory success | Non prova sandbox di terzi o UX su dispositivi fisici |
| S19 della stessa SHA | [S19 40760356288](https://github.com/AndreaMarro/ardesia/actions/runs/40760356288), job s19 success | Non prova installazione attraverso Plugin Host |
| Readiness della stessa SHA | [studio-preview-readiness 40760356350](https://github.com/AndreaMarro/ardesia/actions/runs/40760356350), job no-deploy-check success | Il nome del job dichiara che non effettua deployment |
| Status Vercel | Status GitHub `Vercel – ardesia-closure1-acceptance` success, https://vercel.com/andreas-projects-6d4e9791/ardesia-closure1-acceptance/GzZXV74BvFcLaxoELVjZkng6yY4W | Da solo non certifica che quella SHA sia produzione, protezione o percorso completo operativo |

## Dieci decisioni di recupero

Tutti i percorsi seguenti si riferiscono alla SHA `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`.

### 1. Study Core: recuperare le invarianti, ridurre l'accoppiamento

Fonti:

- `packages/engine/lessonos/study/store.py`
- `packages/engine/lessonos/study/transactions.py`
- `packages/engine/lessonos/study/submissions.py`
- `packages/engine/lessonos/study/context.py`
- `docs/adr/ADR-0004-study-core-and-provider-boundaries.md`

Codice reale: StudyStore usa la stessa connessione del legacy SQLiteStore; le transazioni pedagogiche registrano ricevuta ed evento nello stesso commit. La chiave di idempotenza è scoped per attore e operazione; payload differente sulla stessa chiave è un conflitto. Le revisioni delle fonti e le consegne sono congelate con riferimenti esatti. Le autorizzazioni non si ricavano dalle proiezioni.

**Decisione:** riutilizzare questi comportamenti nei contratti pubblici Core, con test di accesso, revisioni e retry. Non importare in Next il grosso adapter storico con migrazioni e riferimenti diretti alle tabelle legacy. Un unico adapter di persistenza scelto dalla composition root. Nessun nuovo registro progressi nel frontend.

### 2. LessonOS: recuperare proiezioni e riferimenti, non un secondo log

Fonti:

- `apps/studio/src/lessonos/eventlog.ts`
- `apps/studio/src/lessonos/continuityProjection.ts`
- `packages/engine/lessonos/study/context.py`

Esistono envelope V2, eventi con provenienza, proiezioni di continuità, risoluzione di fonti, stato delle evidenze e azioni successive. La proiezione Studio importa anche JournalRecorder/sessionState/roomPaths: non è un package indipendente.

**Decisione:** LessonOS deve ricevere gli eventi Core e produrre viste ricostruibili. Estrarre DTO puri per scope, riferimenti e continuità; vietare un secondo authority store. Le revisioni esatte non devono essere promosse silenziosamente alla head corrente.

### 3. SDK: recuperare vocabolario tipizzato e versionamento

Fonti:

- `apps/studio/src/sdk/index.ts` — `CONTRACT_VERSION = "1.3.0"`
- `apps/studio/src/toolhost-protocol/manifest.ts`
- `apps/studio/src/toolhost-protocol/capabilities.ts`

Esistono manifest strict, capability chiuse, distinzione protocol/SDK, descrittore macchina derivato e semantica SemVer.

**Decisione:** package autonomo `plugin-sdk`, export pubblici espliciti. In Next SDK, licenza, provenance e hash del bundle devono essere obbligatori. Il manifest legacy li lascia in parte opzionali per compatibilità: non preservare questa eccezione in un progetto nuovo. Nessuna dipendenza SDK da React o apps/.

### 4. PluginManager e Host: recuperare lifecycle e isolamento delle istanze

Fonti:

- `apps/studio/src/toolhost/pluginManager.ts`
- `apps/studio/src/toolhost/host.ts`
- `apps/studio/src/toolhost/policy.ts`
- `apps/studio/src/__tests__/PluginManager.test.ts`
- `apps/studio/src/__tests__/ToolHostHardening.test.ts`

Funzioni reali: installazione, enable/disable, revoke overlay, canMount, suspend/restore serializzato, stato per istanza, cap massimo di 1 MiB, audit mantenuto dopo uninstall. Il protocollo non offre fs/shell/Node. La policy interseca richieste e permessi e rifiuta escalation.

**Decisione:** conservare questi contratti e i test negativi, sostituire dipendenze da store Studio con porte Core. Installazione inizialmente disabilitata fino a consenso esplicito. In legacy install() abilita immediatamente. Update e rollback di versione non esistono nel PluginManager letto: non dichiararli recuperati.

### 5. Firma e integrità: recuperare la verifica, introdurre trust esplicito

Fonte: `apps/studio/src/toolhost/installer.ts`.

L'installer verifica Ed25519 sui byte originali del manifest; calcola SHA-256 del bundle e confronta l'hash se dichiarato; registra firma e fingerprint; tenta cleanup su scritture incomplete. La chiave pubblica viene dal manifest stesso.

**Decisione:** la firma prova coerenza con una chiave, non fiducia nel publisher. Serve trust-store configurato dall'host, con publisher/key ID fissati; firma e hash obbligatori, revoca e verifica prima del mount. Rendere atomico il cambio della versione attiva, conservare versione precedente e stato compatibile per rollback. Queste ultime funzionalità sono lavoro nuovo.

### 6. Sandbox: non recuperare l'attuale superficie web

Fonti:

- `apps/studio/src/toolhost/ToolFrame.tsx`
- `apps/studio/src/toolhost/originServer.ts`
- `apps/studio/src/design/ToolLab.tsx`
- `apps/studio/e2e/toolhost-srcdoc-bypass.spec.ts`

ToolFrame usa `allow-scripts allow-forms allow-same-origin` contando su origin distinto per plugin. OriginServer è esplicitamente un modello request/response senza socket: il bind vero è demandato a shell desktop/dev-proxy. ToolLab usa invece `srcDoc` con `allow-scripts allow-same-origin`; la suite di characterization è scritta per osservare lettura del DOM del parent. Il codice corrente conferma questa combinazione; non è stata rieseguita qui la prova browser.

**Decisione:** scartare ToolLab/ToolFrame come implementazione della sandbox web Next. First-party espliciti inizialmente; niente upload o esecuzione di terzi. Un futuro frame opaco con canale e CSP controllati richiede prova browser del confine, test di parent DOM/storage/network/navigation, capacità negative e revoca live. Non dichiarare isolamento solo sulla base dei test headless.

### 7. Modelli fluidi e termodinamica: miglior recupero immediato

Fonti:

- `apps/studio/plugins/fluid-thermo/models.ts`
- `apps/studio/plugins/fluid-thermo/definitions.ts`
- `apps/studio/plugins/fluid-thermo/types.ts`
- `apps/studio/plugins/fluid-thermo/snapshot.ts`
- `apps/studio/plugins/fluid-thermo/models.test.ts`

Il kernel numerico è puro TypeScript e dipende solo da definitions/types. Controlla chiavi, dominio numerico, unità SI, valori finiti e limiti dichiarati. Include idrostatica, Pascal, Archimede, continuità, Venturi, Poiseuille, reti idrauliche, capillarità e modelli termici. Poiseuille dichiara profilo analitico completamente sviluppato e rifiuta Reynolds > 2300; non è CFD o simulazione particellare. Snapshot separa configurazione, riferimenti e risultato ricalcolabile.

**Decisione:** selezionare un modello piccolo (idrostatica o oscillatore recuperato altrove) come primo plugin; Poiseuille resta uno dei modelli possibili, non centro dell'architettura. Copiare il solo kernel necessario con provenance puntata alla SHA; renderer implementato sul nuovo SDK e stato serializzabile. Testare valori noti, unità, dominio e salvataggio/ripresa. Non importare l'intera UI Lab/3D prima che abbia un consumer.

### 8. Studio e Web: scartare le shell concorrenti

Fonti:

- `apps/studio/src/App.tsx`
- `apps/studio/src/study/StudyApp.tsx`
- `apps/web/src/features/science-library/CoreFluidLab.tsx`

Studio seleziona molte viste attraverso parametri URL; StudyApp include accesso sintetico e banco DRAFT locale. CoreFluidLab in Web importa direttamente `../../../../studio/src/study/contracts` e `sessionBoundary`.

**Decisione:** una sola app con viste docente e studente; session boundary e DTO condivisi in package pubblici. Vietare import da internals di altre applicazioni con un controllo automatico. Non trasferire layout, demo, selettori di vista e shell di login divergenti.

### 9. S19/Kirchhoff: conservare il contratto, differire il runtime

Fonti:

- `plugins/s19-circuit-lab/s19_circuit_lab/adapter.py`
- `plugins/s19-circuit-lab/s19_circuit_lab/core.py`
- `plugins/s19-circuit-lab/s19_circuit_lab/engine.py`
- `plugins/s19-circuit-lab/README.md`
- `handoffs/swarm-v2/S19/ACQUISITION_PACKET.md`
- `handoffs/swarm-v2/S19/dependency-provenance.json`

S19 conserva input dichiarativi, validazione stretta, fingerprint del circuito, salvataggio e riapertura tramite risorse/revisioni Core; la consegna passa dallo stesso submit. Il solver è Kirchhoff fissato a `b35a8b5da0616f00a7764397bda0e6b95aca3c95`, verificato come checkout pulito editable e tramite frozen imports. Supporto S19 esposto: DC R/V/I indipendenti. README dichiara ToolHost firmato e AC/Laplace fuori tranche.

**Decisione:** candidato successivo dopo M3, utile per provare un modulo diverso; recuperare schema degli input e comportamento Core, non il runtime Python editable/Git in una preview frontend. Per M4 minimo preferire un secondo modello semplice senza nuovo servizio; S19 non va etichettato come plugin installabile già pronto. Non recuperare eLab.

### 10. CoursePack e marketplace: conservare provenienza e separazione contenuti/codice

Fonti:

- `packages/engine/lessonos/study/coursepack.py`
- `apps/studio/src/toolhost/marketplace/marketplaceItem.ts`
- `apps/studio/src/toolhost/marketplace/localCatalog.ts`

CoursePack controlla risposte numeriche e unità ma impone ancora `DRAFT` e reviewer nullo; review_manifest restituisce `scientificApproval: NOT_RUN`. Marketplace è un'unione plugin/content-product; il plugin riusa il manifest, contiene disponibilità esplicita e metadati provenance. LocalCatalog enumera pacchetti locali installati/verificati; non è un marketplace remoto né un checkout commerciale.

**Decisione:** catalogo unificato di risorse versionate e moduli eseguibili, con medesima provenienza e revisione. Nessun pagamento o prezzo operativo nella prima app. Un DRAFT può essere usato come bozza privata chiaramente identificata, mai esposto come approvato. Creator futuro deve usare gli stessi contratti di pubblicazione, non una nuova authority.

## Licenze e provenienza

- Nessun file LICENSE generale trovato all'albero root; il tentativo di lettura `LICENSE` ha restituito 404. `package.json` root non dichiara licenza.
- Il recupero del codice originale dell'utente è autorizzato dal mandato; non dedurne che sia open source o redistribuibile a terzi.
- I file originali copiati devono conservare source repository, SHA, path e hash. Le dipendenze devono conservare le proprie licenze.
- Three.js 0.186.1 è accompagnato da notice MIT in `apps/studio/plugins/fluid-thermo/THIRD_PARTY_NOTICES.txt`; non necessario per il primo plugin 2D.
- S19 usa React Flow 12.10.1 MIT; DOMPurify con opzione Apache-2.0 secondo l'acquisizione esistente. Il dossier specifica nessuna licenza generale di Kirchhoff e nessuna acquisizione dei file eLab.
- Queste osservazioni non sono una nuova revisione legale delle dipendenze.

## Minimo operativo per M0/M1

M0: una app React/TypeScript, pacchetti contracts/Core/plugin-sdk/plugin-host/LessonOS, un lock, build riproducibile, CI mirata, boundary check, stato generato, ownership e preview privata legata alla SHA. Contratti runtime e pubblicazione devono dichiarare esplicitamente ciò che è ancora indisponibile.

M1: primo modello scientifico pure-first-party, stato serializzabile con schema versione, host iniettato e capability ristrette; prova di parametro -> risultato -> salvataggio -> riapertura e test negativi su autorizzazioni/versioni. Nessuna affermazione di isolamento di codice terzo.

M2: catalogo piccolo di bundle first-party con pin di fiducia e integrità obbligatori; installare, consentire, montare, salvare, riprendere, disattivare. Update/rollback restano non-DONE finché non ci sono prove.

## Fonti di navigazione

Base dei permalink: https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/

[Kernel manifest](https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/apps/studio/src/toolhost-protocol/manifest.ts) · [Installer](https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/apps/studio/src/toolhost/installer.ts) · [PluginManager](https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/apps/studio/src/toolhost/pluginManager.ts) · [Study Core](https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/packages/engine/lessonos/study/transactions.py) · [Modelli](https://github.com/AndreaMarro/ardesia/blob/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/apps/studio/plugins/fluid-thermo/models.ts).

