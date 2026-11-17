# Kit 16 novembre — aggiornamento isolato 708f5a9

Esito: generatore aggiornato e preview verificata, **bozza non inviata**. Nessuna modifica al repository condiviso, nessun messaggio/post, nessuna pubblicazione. Questo agente ha scritto e riesaminato il kit; non presenta tale riesame come nuova approvazione indipendente del proprio copy. Si appoggia alle revisioni tecniche separate delle funzionalità e del quaderno.

## Identità e backup

Originale conservato prima delle modifiche in `finalize-kit.before-708.py`, SHA-256 `4dfc0231b5a35da1b8528637b3d2b56155d1ea378688caf69392bddd16864b83`. Nuovo generatore: `bcd4bfa58d654be5da20c2ce3235c96cdae0b866f8ab79ed5cd564edde4ea061`. Diff completo: `finalize-kit-708.patch`.

ZIP e contatto sono stati estratti con `git show` dalla SHA immutabile `708f5a9c54d60043f7b06a7d87ea1e8b50f84922` e confrontati con i file reali del repository: identici al momento del congelamento. Copie locali `708-source.zip` e `708-contact.json`.

Il generatore è stato eseguito realmente: GET anonimo GitHub HTTP 200, ZIP scaricato byte-identico, **3.388.311 byte**, SHA-256 `85aa4ff305d5b56cb970aa99bab2f45557573095fa7332871b05df699f2e1fe4`. Ricevuta completa in `work/launch-kit-708-preview/public-download-evidence.json`. Non si tratta di una simulazione HTTP; il mock viene usato soltanto nel test negativo del mismatch.

## Cosa cambia

- Messaggio breve: anteprima gratuita e richiesta informazioni non vincolante; 38 lezioni, 279 problemi/verifiche nelle lezioni, cinque laboratori, quaderno PDF di 7 pagine e A/B da 31 domande. Nessun acquisto, prezzo, checkout o promessa di prontezza per il 16 novembre.
- Istruzioni: estrazione completa ZIP → `index.html`; tabella con percorso esatto di ciascuno dei cinque laboratori e indicazione del quaderno. C5 è descritto come confronto di quattro casi, coerente con la versione pubblica; non si promettono slider non presenti.
- Salvataggi: JSON del tentativo da salvare durante la prova e importare nella stessa A/B e nella stessa edizione; nessun autosalvataggio; deadline originale anche a pagina chiusa e consegna immediata se scaduta. JSON del risultato finale e ripasso HTML sono esplicitamente distinti dal file di ripresa.
- DRAFT e revisione umana pendente compaiono nei testi. Il kit non include promesse di app native, importazione PDF macOS, Core o sincronizzazione; l’import macOS resta fuori dal kit finché il coordinatore non ne conferma lo stato.
- Generatore: controlla presenza dei comandi di ripresa e dei controlli dei cinque laboratori; vincola il quaderno all’hash già revisionato di sette pagine. La ricevuta include inventario dei laboratori e identità del quaderno e del generatore. Un PDF diverso viene rifiutato prima della produzione del kit.

## Verifiche

`py_compile`: PASS. `check-708.py`: **30 controlli PASS**. Coprono inventario, edizioni, testo istruzioni, assenza di CTA di vendita, rifiuto dello ZIP precedente senza checkpoint, risorse/controlli mancanti, PDF alterato, approvazione umana alterata, archivio malformato, SHA breve, mismatch HTTP e protezione da sovrascrittura del kit esistente. Nei casi negativi di download/SHA non vengono scritti file.

`journey-708.cjs`: cinque percorsi reali nel nuovo ZIP, Chromium offline. Per ciascuno un controllo modifica il risultato visibile; link al quaderno presente e C5 raggiungibile dalla home. Nessun errore JavaScript o richiesta HTTP. Questo è un controllo delle istruzioni e del percorso, non un nuovo audit dei modelli fisici. `pdfinfo-708.txt`: 7 pagine, 88.064 byte; hash uguale alla ricevuta del quaderno revisionato.

## Consegna

Preview in `work/launch-kit-708-preview`: `testo-pronto.md`, `istruzioni-studente.md`, `README.md`, `public-download-evidence.json`, `contact.json`. Nessuno di questi testi è stato inviato. La SHA del kit finale deve essere fissata dal coordinatore dopo CI e i suoi gate: rieseguire lo script verso una nuova cartella, senza riutilizzare la ricevuta 708 per revisioni diverse. La disponibilità del download GitHub non prova deploy Vercel o accettazione commerciale.
