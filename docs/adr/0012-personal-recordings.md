# ADR 0012 — Audio personale e replay delle revisioni

Stato: incremento locale del mandato diretto del7novembre; prove esatte nel pacchetto esterno di consegna. Nessuna accettazione hardware, remota o pubblicazione commerciale implicita.

## Un percorso completo nella stessa lezione

Il docente apre Audio e replay, esprime il consenso, registra e scrive. MediaRecorder salva frammenti nel recupero IndexedDB dello stesso account/spazio; al termine un caricamento esplicito porta audio e manifest al server. La pagina continua a scrivere senza AI. È possibile esportare audio e riferimenti, riprendere un upload dopo riapertura, ascoltare, cercare le trascrizioni della lezione e tornare al tempo trovato.

Il primo consumer riguarda registrazioni personali del proprietario della lezione. Assegnare una lezione non condivide l'audio con gli studenti. Nessun riconoscimento automatico o chiamata a provider: trascrizioni manuali/importate, versionate e dichiarate tali. Import JSON: array di `{fromMs,toMs,text}`; l'import crea una nuova versione completa. La ricerca usa solo titolo e ultima trascrizione; le precedenti si consultano scegliendo la versione.

## Autorità e byte

Contratti `ardesia-recording-v1` e `ardesia-recording-state-v1`; Core valida comandi, ownership, revisioni, ID, manifest e riferimenti esatti agli eventi della lezione. La registrazione è un aggregato media del Core, non un secondo diario della lavagna. Non duplica documenti, eventi, scene o stato dei laboratori. Il server compone le stesse operazioni nella transazione autenticata con lock workspace, seguita dal lock recording. Ogni lettura, parte e comando ricontrolla sessione/account e proprietà.

Migrazione additiva002: metadati in `recordings`, byte in `recording_parts`, nello stesso PostgreSQL. Mai audio base64 negli snapshot di ogni tratto. Parti immutabili con indice, lunghezza e SHA256; il manifest completo viene verificato prima di ready. La digest media identifica MIME e manifest canonico, non pretende di essere l'hash diretto dell'intero file. Upload e finish ripetibili con gli stessi ID; un payload diverso non può riusare la ricevuta. L'erasure elimina le parti e tutte le trascrizioni nella stessa transazione e conserva il tombstone/ricevute; un retry precedente non resuscita i byte.

Backup logico v3 include registrazioni e parti nella stessa lettura repeatable-read; restore verifica digest, parti, identità, cue e riferimenti Core prima di scrivere nel target vuoto. Il reader conserva compatibilità v2 senza media; v1 privo dello stato account resta rifiutato. Non modificare001 già applicata. Il downgrade applicativo conserva002 e i dati; usare il backup v3 per non perdere media, senza drop o migrazioni inverse automatiche.

## Tempo e replay

I campioni penna mantengono timestamp monotoni separati dai punti persistiti; anche interpolazione e segmentazione conservano la corrispondenza. Il replay deriva geometria, pressione, note, fonti, connessioni, modifiche e cancellazioni dalle revisioni Core originali. Nessun fallback latest: anche titolo, elenco degli oggetti/fonti e revisione visualizzata derivano dalla scena storica; editing disabilitato fino all'uscita esplicita. Eventi non catturati come campioni sono marcati `observed`: il tempo di osservazione della conferma non è presentato come tempo preciso del gesto remoto.

La revisione iniziale è riletta all'avvio effettivo del media, dopo il permesso. Un tratto non confermato impedisce la finalizzazione: prima va risolto attraverso la recovery esistente. Le revisioni intervenute fino alla conferma tardiva del tratto sono incluse, con tempi osservati e limitati all'intervallo; non si inventa sincronizzazione di collaboratori esterni. Il reader compilato valida la storia una volta e riusa la scena immutabile fra campioni; non riparsa tutto il documento a ogni fotogramma. Seeking indietro ricostruisce la revisione richiesta. Scala lunga e drift hardware restano da misurare.

## Consenso e conservazione

Nessuna richiesta microfono al caricamento. Annullamento, consenso ritirato e unmount invalidano le risposte getUserMedia tardive e fermano le tracce. Una richiesta vecchia libera solo le proprie risorse. La policy permette `microphone=(self)` e `media-src 'self' blob:` per il consumer richiesto; camera/geolocalizzazione/pagamenti e script restano limitati. L'autorizzazione browser rimane necessaria.

I frammenti vengono scritti ogni secondo circa; il browser può ritardare i callback. Crash/sospensione prima dell'ultimo flush non garantiscono l'ultimo segmento. `complete` segue la conferma delle scritture locali; gli incompleti offrono esportazione dei frammenti disponibili, senza promessa di file riproducibile completo. Se IndexedDB fallisce durante la cattura, l'audio in memoria resta esportabile finché la pagina è aperta. Bozze audio non archiviate restano account-scoped e non vengono cancellate da una risposta incerta. Il recupero locale non è cifratura contro altri utenti dello stesso profilo browser.

Le richieste di trascrizione sono conservate prima dell'invio con una chiave per comando. Un ACK tardivo di una scheda non può rimuovere l'intento successivo di un'altra. Download ricontrolla il contesto dopo l'ultimo hash. Replay rispetta editor sporco e tratto attivo; se la storia diventa incoerente, sospende l'audio sull'ultima scena verificata.

## Limiti espliciti

Trascrizione automatica, condivisione delle registrazioni, ricerca globale fra tutti gli spazi, esposizione audio via MCP, capture a freddo nell'interfaccia offline e streaming progressivo dei file grandi sono futuri incrementi. I media non sono ancora inclusi nella copia offline ridotta di ADR0010. La registrazione avviata conserva localmente mentre la rete è assente; l'archiviazione richiede accesso e conferma dei tratti. Il player scarica e verifica tutto l'audio prima della riproduzione.

Per proteggere memoria/trasporto: parti512KiB, fino a1024parti (512MiB), durata24h,10.000marker/cue; upload oltre questi limiti mantiene l'originale esportabile. Ricerca sull'aggregato della singola lezione,100risultati con totale dichiarato: nessuna promessa di indicizzazione globale su larga scala. Il server continua a serializzare per workspace. Registrazione reale Mac/Safari, iPad/Apple Pencil, privacy del sistema operativo, drift, sospensione prolungata e sessioni lunghe restano NOT_RUN finché osservati.

Patrimonio: sette chat e sorgenti legacy già lette, con copertura in [fonti lavagna](../sources/spatial-board-2026-11-07.md). L'analisi REA6.8 del ReplayEngine già conservata ha guidato il legame eventi/tempo e cancellazioni; nessun motore legacy copiato, nessuna nuova analisi REA dichiarata.
