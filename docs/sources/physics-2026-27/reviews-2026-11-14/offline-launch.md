# Audit indipendente percorso anonimo e lancio

Data: 14 novembre 2026. Campione congelato: HEAD `a6df5523c71113e22ea7e3e5ab35348bf8b3ad95`; ZIP SHA-256 `ff881ea88344d7a3ed89c4d85279dcf135725e4e1d980b42b9f50837f5be0d21`, 3.279.255 byte, 62 entry. Queste conclusioni riguardano il campione, non successive versioni integrate.

## Esito

PASS del percorso offline su Chromium/macOS: estrazione completa → index → ciascuno dei cinque corsi → programma → prima lezione → svolgimento → simulazione A/B → consegna → download ripasso HTML → link lezione → riapertura HTML. Ripetuto a 320 e 1280 px, senza rete né errori JavaScript. Skip link da tastiera porta al main. Prove: `journey.cjs`, `journey-results.json`, `journey.log` e HTML scaricati. Inventario: 38 lezioni, 279 problemi/verifiche, due prove da 31 quesiti.

Non risultano impedimenti al percorso di anteprima gratuita per computer. Il test mobile è un viewport Chromium su Mac: non certifica apertura da Files iOS o file manager Android. Le conclusioni non approvano scientificamente i contenuti, non attestano pagamenti, diritti di accesso, assistenza inbox, applicazioni native o vendita operativa.

## Difetti e correzioni isolate

1. Due lezioni su 38 superano la larghezza 320 px: Sovrapposizione (328 px), Radiazione elettromagnetica (335 px). `reader-wrap.patch` aggiunge wrapping nel lettore e sillabazione dei titoli. Verifica candidata: entrambe 320/320, screenshot `reader-wrap-fixed.png`. Ispezione di tutte le letture con dettagli aperti e JS disabilitato in `mobile-reader.json`.
2. Il LEGGIMI del campione guida soltanto alla prova A. `offline-entry-copy.patch` introduce index, percorsi C1–C5, A/B, ripasso HTML/PDF, estrazione completa, salvataggi espliciti e separazione dall’accesso online. Contatti dalla fonte canonica; provenienza A/B distinta. Apply check e sintassi del builder PASS al momento della proposta. L’integrazione successiva va riconciliata con il lavoro checkpoint.
3. La CTA home dice «informazioni su i cinque minicorsi». `home-cta-copy.patch` cambia in «su questi cinque minicorsi». I 12 link WhatsApp/email di home e C1–C5 coincidono con i contatti canonici (`contacts.json`). Sono state controllate destinazioni e testo, senza inviare messaggi o aprire composer.
4. Dodici link secondari nelle azioni di home/C1–C5 hanno altezza 29,7 px. `action-targets.patch` impone 44 px a questi link. Tutti i 18 target delle azioni risultano ≥44 px, senza overflow a 320 (`action-targets-fixed.json`). Nessun altro overflow nelle dieci pagine non lettore (`page-layout.json`).

Le patch sono proposte isolate: questo agente non ha modificato il repository condiviso. Il coordinatore è stato avvisato di tutti i difetti. L’eventuale adozione deve risultare dai suoi diff e dalle verifiche finali.

## Kit commerciale da congelare

`kit/finalize-kit.py` produce cinque file di kit soltanto dopo aver verificato SHA pubblicata, inventario/CRC/limiti ZIP, A/B da 31 quesiti (21+10), durata 50 minuti, stato DRAFT con humanApproval falso, export HTML e identità byte con download GitHub anonimo alla SHA indicata. Non è stato eseguito il congelamento finale: serve la SHA realmente pubblicata dal coordinatore.

Test locali in `kit/checks.json`: archivio corrente accettato; SHA invalida, archivio malformato e archivio storico senza ripasso HTML rifiutati; compilazione Python PASS. Non attribuire tali test alla verifica HTTP finale ancora da eseguire. `kit/README.md` contiene il comando completo. L’output indica anteprima gratuita e richiesta informazioni, senza promettere acquisto o consegne non verificati. Il kit usa istruzioni di salvataggio esplicito compatibili con l’eventuale checkpoint, senza prometterlo prima della sua validazione.

Per un’offerta a pagamento restano necessarie condizioni commerciali, revisione umana e modalità di consegna/accesso applicabili e reali. Il vecchio kit candidate rinvia a un archivio storico con sola A: non aggiornare le promesse mantenendo il vecchio link.
