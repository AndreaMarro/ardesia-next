# Collaudi sul Mac — MCP

## MCP→lavagna→MCP

La [ricevuta originale](anteprima-mcp.json) identifica build, documento, oggetti e sei ricevute del Core. Il client ufficiale2.4.0 ha avviato l'artefatto Node separato, con sessione sintetica privata della preview localhost4180 e nessuna inferenza AI. Ha creato la lezione «Energia elastica · da MCP alla lavagna»: fonte fissata alla README del modello Ardesia nella base Git, formula LaTeX, nota di previsione, esercizio e collegamento. Document revision6; quattro oggetti e un collegamento. La fonte è un riferimento al progetto, non codice copiato o una licenza aperta inventata.

Il root ha aperto la stessa lezione nella UI IAB del Mac. La prima shell era ancora la versione3b7fd47e… del collaudo offline: dopo chiusura e riapertura della scheda, Impostazioni→Versione dell'interfaccia ha mostrato6286f01654705b255cad2412bd3f6bb591e2e35ebe33104941ba405819d72c7e. Il root ha cambiato il titolo della nota in «Prima di calcolare · la tua previsione», premuto Salva e osservato «Confermato dal server», documento7 e oggetto2.

Un nuovo processo MCP in sola lettura ha riletto documento7 e oggetto2; la revisione1 dell'oggetto conserva titolo originale e provenienza identica. Le sessioni MCP temporanee sono state revocate e i file privati rimossi. [Immagine della lavagna](../../ardesia-mcp-lavagna.jpg). La scheda3/browser2 è stata lasciata come risultato consultabile.

## Interruzione configurazione

Sul CLI compilato della sorgente30652225cc42d0ce69f4fff2cdce900f07f1160d5bc3d5ea0426aa3b5f0aa975, prima del successivo refactor del prompt in modulo separato:

- Query di soli conteggi nel database sintetico preview:2sessioni non revocate,0revocate.
- Avvio `configure` in un vero PTY dello strumento Terminale; username sintetico, password non eco; autenticazione riuscita e lista degli spazi mostrata.
- Ctrl-C alla scelta spazi: processo terminato con exit1, file incompleto assente. Conteggi successivi2non revocate/1revocata: la nuova sessione è stata revocata senza revocare quelle esistenti.
- Nuovo configure sullo stesso percorso riuscito fino alla prima domanda; Ctrl-D prima del login ha terminato e rimosso di nuovo il file.

La sorgente finale sposta lo stesso comportamento in prompt.ts e lo prova automaticamente con EOF, Ctrl-D, Ctrl-C, password nascosta e rifiuto non-TTY. Il collaudo PTY storico non viene rinominato come eseguito sul nuovo hash; i test finali hanno identità propria nei report.

## Limiti

IAB sul Mac, non Safari fisico e non app nativa. Nessuna prova iPad/Apple Pencil, latenza hardware, host commerciale MCP o endpoint MCP cloud. I dati e le credenziali usati sono sintetici locali; nessun dato personale degli studenti è stato letto o esportato. Il contenuto didattico è DRAFT e non è stato sottoposto ad approvazione umana scientifica/editoriale.
