# ADR 0002 — Fiducia esplicita e zero esecuzione plugin in M0

**Stato:** policy adottata per M0 e vincolo dei traguardi successivi.  
**Data:** 29 ottobre 2026.

## Decisione

M0 prepara SDK e policy, ma mantiene **disabilitata l'esecuzione di qualsiasi plugin**. Il primo modulo first-party viene introdotto a M1 con stato serializzabile, consumer reale e test propri. Nessun codice arbitrario di terzi viene eseguito prima che il modello di isolamento abbia prove adeguate.

Il manifest deve avere schema rigoroso e versione obbligatoria. Identità del plugin, publisher, versione del bundle, compatibilità SDK, schema dello stato, capacità richieste, licenza, provenienza e hash sono parte del contratto verificabile. Firma e integrità sono obbligatorie nel percorso di installazione.

La chiave attendibile proviene da un trust store dell'host che associa publisher e key ID; una chiave contenuta nel manifest non può autorizzare se stessa. I byte firmati e il loro legame con hash, capacità e versioni devono essere definiti in modo univoco e verificati prima di eseguire codice.

Le capacità sono negate per default. L'installazione non implica attivazione o consenso. La concessione effettiva è limitata all'intersezione fra richiesta, policy e scelta autorizzata; un aggiornamento che aggiunge capacità richiede una nuova decisione.

## Ciclo di vita da implementare progressivamente

| Passaggio | Condizione minima |
| --- | --- |
| Verifica | Manifest valido, bundle integro, firma valida rispetto al trust store, publisher non revocato e SDK compatibile |
| Installazione | Record versionato e audit; modulo inizialmente inattivo |
| Attivazione/mount | Consenso corrente e policy ricontrollati; canale limitato all'istanza |
| Uso e salvataggio | Stato serializzabile validato e limitato; scrittura tramite porta Core |
| Riavvio/riapertura | Versione, schema dello stato, riferimenti e permessi nuovamente verificati |
| Disattivazione | Esecuzione arrestata, capacità rimosse, stato e audit conservati secondo policy |
| Aggiornamento | Versione candidata verificata; passaggio atomico, migrazione esplicita e consenso per capacità aggiuntive |
| Revoca | Nessun nuovo mount; istanze in esecuzione fermate; audit mantenuto |
| Rollback | Versione precedente ancora attendibile e compatibilità dello stato dimostrata; niente downgrade silenzioso dei dati |

Questa tabella è una specifica di accettazione. In M0 nessuna riga autorizza a dichiarare marketplace o ciclo runtime completati.

## Evidenza legacy e comportamento escluso

Alla SHA legacy `5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`:

- `apps/studio/src/toolhost/installer.ts` verifica firme Ed25519, ma usa la chiave inclusa nel manifest; l'hash è verificato se dichiarato.
- `apps/studio/src/toolhost/pluginManager.ts` offre lifecycle e gate di mount, ma installa attivando subito; update e rollback di versioni non risultano implementati nel manager letto.
- `ToolFrame` conta su origin distinti predisposti fuori dal modello puro di origin server.
- `ToolLab` usa `srcDoc` con combinazione permissiva; non è una sandbox web da trasferire.

Si recuperano vocabolario, invarianti e controprove utili. Non si copia la superficie iframe come certificazione di isolamento per Vercel. [Dettaglio e permalink](../sources/legacy-review.md).

## Alternative

- **Chiave auto-dichiarata nel bundle:** rifiutata; la validità crittografica non dimostra l'identità di un publisher fidato.
- **Esecuzione immediata dei plugin first-party in M0:** rinviata; il gate M0 riguarda fondamento e preview, non un runtime incompleto.
- **Upload di bundle terzi con iframe permissivo:** rifiutato prima della dimostrazione del confine.
- **Solo moduli dichiarativi per sempre:** non imposto; i plugin eseguibili restano parte del progetto dopo le verifiche necessarie.
- **Host indipendente con capacità esplicite:** scelta; evita accessi diretti all'app e rende sostituibile il renderer.

## Conseguenze e prove

Essere first-party è una scelta di distribuzione fidata, non prova di isolamento. Firma e sandbox sono controlli distinti: nessuna firma rende innocuo un bundle.

Prima di aprire l'esecuzione di terzi servono prove browser di parent DOM, storage, rete, navigazione, canali, messaggi inattesi, payload eccessivi e revoca. Occorre verificare anche che gli strumenti di sviluppo o un fallback non aggirino il confine.

Un catalogo con card non è un marketplace operativo. L'accettazione richiede percorso effettivo di installazione, mount, uso, salvataggio, riapertura e disattivazione sulla SHA candidata, con controprove. Le proprietà ancora assenti rimangono esplicite nello stato generato.

