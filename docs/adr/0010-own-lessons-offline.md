# 0010 — Lezioni personali disponibili offline

Data: 7 novembre 2026. Preparazione locale autorizzata dal mandato diretto ecosistema. Estende la continuità del Remote Client; non modifica autorità Core/PostgreSQL, gate remoti o procedure di integrazione.

## Percorso completo

Il docente prepara lo spazio dalle Impostazioni, apre la copia locale, scrive, chiude e riapre senza rete. I nuovi tratti restano visibili come modifiche da confermare. Al ritorno della rete, la riconnessione verifica sessione, account, ruolo, attore originale e spazio; l'utente recupera o riprende ogni comando. Soltanto la ricevuta Core conferma la modifica e libera il successore. Nessuna riscrittura del CAS, fusione silenziosa o invio automatico.

## Dati e identità

`OfflineSnapshot` è una copia di lettura ridotta e versionata delle sole lezioni possedute dal docente: ID, revisioni, attore, contenuti e provenienza originali. Non contiene sessione, cookie, grants, installazioni, assegnazioni, lavoro degli studenti o eventi. `client.offline` è distinto dalla proiezione confermata e da `client.account`, entrambi null offline. I moduli scientifici sono consultabili come schede inerti, senza esecuzione o consenso ricostruito.

IndexedDB serializza confronto e aggiornamento della copia con un gate persistente: generazione, account, ruolo, logout e spazio attivo. Un tab vecchio non può abbassare la revisione o riaprire il gate dopo logout. BroadcastChannel accelera la chiusura visibile; i controlli durevoli restano necessari. Un ruolo cambiato, account diverso o revoca osservata401/403/404 impediscono il fallback. Una revoca remota avvenuta mentre il dispositivo è scollegato non è osservabile; questo limite non viene nascosto.

Le annotazioni offline usano esclusivamente i comandi immutabili versione2 della recovery esistente, con pressione/campioni, predecessore, ID e revisione attesa. `queueOfflineInk` restituisce `kind: queued`, mai una ricevuta. Se manca spazio, il contenuto rimane esportabile in memoria, con avviso che la chiusura lo perderà. Copie incompatibili e recovery corrotte sono rifiutate senza sovrascrivere gli originali.

La conferma server aggiorna la copia autorizzata prima della rimozione del comando dalla recovery. Se la scrittura IndexedDB fallisce, il comando rimane recuperabile con lo stesso ID, anche dopo riavvio. Apertura e prima preparazione attendono che la catena di scritture sia stabile anche dopo il caricamento della copia: un ACK concorrente non può far sparire il tratto. L'aggiornamento della copia non può abbassare una revisione già salvata da un altro tab.

La perdita di rete lascia l'editor aperto. Il passaggio esplicito offline usa la protezione delle bozze non salvate e blocca gli input durante la transizione asincrona. Il solo avvio a freddo tenta il fallback dopo un errore di rete; un errore di autenticazione non equivale a disconnessione.

## Interfaccia disponibile senza rete

Il service worker precache include soltanto HTML statico, asset UI con hash, font e build-info. API, autenticazione, health, query, origini esterne e revoche/plugin restano fuori. Il nome della cache include il digest dell'intero manifest dei byte, oltre alla sorgente: due build della stessa sorgente non condividono una cache di installazione. Ogni asset viene verificato SHA-256 prima di attivare; installazione incompleta o risposta di un altro build conserva la versione completa precedente. Nessun `skipWaiting`; l'aggiornamento può richiedere la chiusura delle altre schede.

La preparazione verifica la corrispondenza col modulo dell'interfaccia caricata e la presenza degli asset, tentando la riparazione di una cache parzialmente eliminata soltanto con i byte originali. La CSP aggiunge esclusivamente `'self'` al `worker-src blob:` preesistente; non autorizza script inline. Il worker è contato nel budget JavaScript invariato.

## Verifica, limiti e rollback

Controprove del client con Core reale e IndexedDB in memoria: riavvio, ACK concorrenti, prima preparazione, quota, retry identico senza doppio evento, conflitti reali, selezione/epoch, account/ruolo, logout tra tab, revoca osservata e corruzione. Test del worker: installazione interrotta, byte incoerenti, allowlist, eviction/riparazione. Browser Chromium desktop e mobile emulato: ciclo completo con PostgreSQL locale, due tab, logout, revoca, corruzione, bozza non salvata e input bloccati durante una vera transazione IndexedDB sospesa. I report della sorgente esatta sono la prova, non questo ADR.

Non sono provati Safari/iPad/Apple Pencil fisici, crash o spegnimento durante un gesto, perdita del profilo browser, collaborazione simultanea, cifratura locale o durabilità illimitata contro eviction. La copia occupa spazio nel profilo del browser; esportazione e backup server restano distinti. Un solo spazio offline attivo per account sul dispositivo in questo incremento; copie precedenti non vengono cancellate ma non costituiscono una libreria offline navigabile. Nessuna nuova libreria di sincronizzazione o database autorevole.

Rollback: distribuire un client compatibile con la recovery versione2 e le copie versione1, mantenendo il gate di logout; recuperare/esportare i comandi prima di tornare a un reader precedente. Non eliminare IndexedDB, localStorage o tutte le cache per fare rollback. Le cache della UI sono eliminate solo durante l'attivazione di una nuova shell completa e soltanto nel namespace Ardesia.
