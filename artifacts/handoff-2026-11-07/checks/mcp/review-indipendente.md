# Review indipendente — MCP Core locale

Revisore: `/root/board_review`, contesto separato espressamente incaricato di sola lettura secondo AGENTS root. Autore/correttore e runner dei test: `/root`. Il revisore non ha scritto sorgenti, eseguito test, modificato servizi o pubblicato stato. La separazione è procedurale, non una dichiarazione di ACL della piattaforma.

Sono stati forniti sorgente/diff e criteri di accettazione, senza richiedere un verdetto favorevole. Esaminati packages/mcp-core, build e collector esterno, confini/dipendenze, README/ADR0011 e report originali.

Osservazioni iniziali:

1. Apertura di una configurazione FIFO poteva bloccarsi prima dello stat. Corretto con O_NONBLOCK, controllo regular-file e lettura limitata anche se il file cresce; controprova automatica FIFO senza writer.
2. EOF/Ctrl-C del prompt lasciavano la Promise pendente, impedendo cleanup del file/sessione. Corretto con abort esplicito; cinque prove del prompt e collaudo PTY riportato dal root.
3. Configurazione controllata soltanto all'inizio: grant locale ritirato durante la lettura preliminare poteva comunque inviare una scrittura o restituire dati. Aggiunti controlli prima del POST mutante e prima dell'output; il collector esterno trattiene la risposta, cambia la configurazione e verifica il rifiuto, senza invio del comando.

Verdetto finale ricevuto: **favorevole per l'incremento MCP locale; nessun P1/P2 residuo rilevato**.

Il revisore ha ricalcolato e confrontato:

- Sorgente6286f01654705b255cad2412bd3f6bb591e2e35ebe33104941ba405819d72c7e, basef7adf5db02913e25fbab0b1da071f650b4f78676.
- Artefatto MCP201f1f6dd7e975c7630b030cba2d8c869fc22dfcb49b726f226f152409d97640.
- Digest dei report unit/browser e identità di Function/plugin.
- Verify8/8, unit381/381, server5/5, MCP9/9 e browser109/109, senza skipped/flaky/fail; budget202119/245760byte.

Il percorso MCP→UI→MCP è documentato dal root nella ricevuta aggiuntiva e non osservato direttamente dal revisore. Il verdetto non certifica host cloud, hardware fisico, accettazione remota M3, efficacia pedagogica o completamento dell'intero ecosistema.
