# ADR 0003 — Preview M0 sul dispositivo, protetta per gli operatori

**Stato:** limite di prodotto adottato per la prima consegna.  
**Data:** 29 ottobre 2026.

## Decisione

La prima app è distribuibile come preview Vercel protetta del nuovo progetto `ardesia-next`. La repository è privata e indipendente da `AndreaMarro/ardesia`; nessun progetto legacy viene modificato per ospitare Next.

M0 conserva il lavoro in un solo workspace locale al browser/dispositivo, con un solo writer e un unico snapshot transazionale Core. Non crea database server, account applicativi o sessioni multiutente. I valori docente/studente sono contratti e proiezioni di sviluppo.

La UI deve dichiarare la portata del salvataggio locale e la natura DRAFT dei contenuti. Il contenuto sul pendolo illustra oggetti condivisi; non è una lezione approvata o un laboratorio plugin completato. M0 non offre una pubblicazione allo studente.

La protezione Vercel è un gate per gli operatori della preview. Non equivale all'identità dello studente, alla membership della lezione, all'autorizzazione ai dati o a un backend Core autenticato. Nessuna promozione pubblica è autorizzata da questa ADR.

## Perché

La prima consegna deve produrre un'app compilabile e verificabile senza inventare servizi pronti o creare spese. Un provider remoto non verificato renderebbe opache le promesse di salvataggio e isolamento.

L'adapter locale permette di verificare il contratto unico di documenti/eventi/ricevute e il passaggio fra lavagna, taccuino e reader. Non dimostra ripresa da un secondo dispositivo, isolamento di account reali o durata dei dati oltre il browser.

## Alternative

| Alternativa | Motivo della scelta |
| --- | --- |
| Riutilizzare credenziali sintetiche e chiamarle login | Rifiutata: non prova identità o sicurezza applicativa |
| Aprire la preview al pubblico | Esclusa dal mandato senza autorizzazione |
| Attivare subito un nuovo database/provider | Rinviata: richiede controllo delle risorse esistenti e dei costi |
| Fingere salvataggio remoto attraverso localStorage | Rifiutata: falsifica D45/D46 e la promessa all'utente |
| Adapter locale esplicito, preview protetta | Scelta per M0: risultato verificabile con limiti comprensibili |

## Conseguenze

Il browser è parte dell'ambiente di prova, non un confine di sicurezza contro il suo proprietario. Chi controlla il dispositivo può alterare dati o attore. Non usare questa preview per prove con dati reali degli studenti o per dichiarare D53/D54 superati.

Il Core deve lasciare intatto uno snapshot non valido. Una scrittura fallita non produce ricevuta di successo. L'implementazione non promette merge multi-tab o recupero remoto; la cancellazione dei dati del browser può rimuovere il workspace.

A M3 il provider remoto sarà scelto dopo verifica dell'infrastruttura già disponibile e dei costi. Un solo servizio di identità, un solo database autorevole, un solo registro eventi e una sola autorità dei progressi. L'eventuale copia locale futura sarà una cache dichiarata; non accetterà scritture educative concorrenti come seconda autorità. Nessuna migrazione irreversibile o nuova spesa senza autorizzazione.

## Prove necessarie e limiti

Per la prima preview occorre registrare commit sorgente, build, configurazione di protezione, ambiente e URL candidato. READY non dimostra da solo che la protezione sia efficace o che l'app funzioni: servono verifiche separate dell'accesso non autorizzato e del percorso consentito.

Le prove locali riguardano creazione/modifica, errore di storage, refresh e stesso oggetto nelle viste. Le prove CI e browser devono riferire SHA e limiti. Non si dichiarano penna fisica, Safari, tablet, studenti o prestazioni di rete mai provati.

D01–D68 rimangono NOT_RUN come accettazione prodotto. In particolare D46 richiede ripresa autorizzata su browser nuovo e secondo dispositivo; D53/D54 richiedono identità reali e isolamento; D65–D68 richiedono accettazione umana. [Criteri originali](../acceptance/D01-D68.json).

