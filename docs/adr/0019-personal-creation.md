# ADR0019 — Creazione personale indipendente dal ruolo didattico

Stato: preparazione locale isolata, nel mandato del7novembre2026. Nessun commit/push/deploy o accettazione remota. Le prove finali sono associate al digest, non a questo testo.

## Problema e decisione

Il percorso student aveva strumenti di studio assegnato ma non poteva creare lezioni, tipi, laboratori o corsi propri. Questo contraddiceva ROLE-002 e il mandato di creazione universale. La proprietà del contenitore autorizza l’authoring personale; il ruolo docente continua ad autorizzare assegnazioni ad altri e Studio tutor. Un account student rimane student.

`access: owner | assigned` è derivato dal server e presente nelle proiezioni/liste. Il client non invia questa autorità. I client tollerano server precedenti senza access con la vecchia distinzione teacher-owner/student-assigned; una connessione esistente rifiuta cambi di binding/access. Contratti0.9; snapshot8 e SQL006 invariati. I dati persistiti non cambiano forma.

Core autorizza documenti, installazioni, registrazioni e corsi tramite ownerId. Il server impedisce authoring in uno spazio assegnato prima di applicare comandi o restituire ricevute. Self-study è disponibile per un’edizione propria. Assegnare ad altri richiede teacher e un account learner valido. Nessun grant editoriale, di pubblicazione o commerciale deriva dalla proprietà.

## Identità importata e riservatezza

Un’importazione legacy conserva actorId, byte originali, eventi e ricevute. L’account autenticato resta distinto dall’alias. Import e provisioning riservano l’identità con lo stesso advisory lock; provisioning prende il lock accounts prima della riserva, coerentemente con autenticazione e restore. Open verifica binding e collisioni prima di proiettare dati; un alias che coincide con un altro account non può accedere come assigned. Restore verifica collisioni nella sorgente e con account extra del target sotto lock accounts/workspaces e resta vietato su un target con spazi esistenti.

La controprova concorrente accetta esattamente un vincitore import/provisioning e verifica assenza di sovrapposizioni. Non forza entrambi gli ordini di acquisizione dei lock. Le prove separate coprono alias già importato, collisione storica inserita dall’operatore sintetico e alias occupato nel target di restore.

## Esperienza e interoperabilità

Home con titoli serif, carta/gesso e pino, liste leggibili e creazione diretta. I tuoi progetti e Condivisi con te hanno contesti distinti. Il pulsante di ritorno compare soltanto quando esiste una lezione. Passare fra spazi non clona contenuti e non espone il lavoro privato.

Lavagna, Creator dichiarativo/programmabile, moduli con consenso, audio personale e corsi usano le stesse identità e ricevute. Le copie offline personali sono ammesse per entrambi i ruoli, restano ridotte e non ricostituiscono sessioni, plugin, assegnazioni o permessi. MCP stdio read-write configurato può creare tipi/corsi e leggere storia propria; assigned authoring restituisce OWNER_REQUIRED. Tutto passa da HTTP/PostgreSQL, senza secondo Core o AI obbligatoria.

## Evidenza e limiti

Ricerca REA6.8 su Excalidraw MIT, commit701b901a0f1ba3d0b390d9cdf63d112e25abac4b: action manager, view mode e persistenza. ADAPT: azioni per risorsa, stato fresco, contenuto/stato/assets distinti. REPLACE: view mode usato come sicurezza, storage globale e fallback silenzioso. Nessun codice donor copiato. Cinque file/2958 AST,514 unknown, coverage unknown; non è una prova runtime del donor. Dossier in docs/sources/personal-creation-2026-11-07.md.

Test Core, client/IndexedDB, HTTP/PostgreSQL, backup/restore, client ufficiale MCP e browser desktop/mobile esercitano le frontiere modificate. REA consumer registra azioni reali sulla build associata; il report di consegna conserva raw, limiti e tentativi falliti. Emulazione mobile non equivale a iPad/Safari/Apple Pencil. Native app, collaborazione simultanea, offline generale, publishing e marketplace commerciale, OAuth remoto e host AI commerciali restano aperti. Il gate di prodotto canonico non è sostituito.

Controprove aggiuntive: il deep-link #tutor in uno spazio personale student vuoto apre la Home e consente creazione senza crash o Tutor. I test personali usano identità sintetiche locali dedicate, lasciando intatti budget di login e credenziali dei collector; nessuna identità remota nuova. Il limite12 e il rifiuto del tredicesimo login restano testati.
