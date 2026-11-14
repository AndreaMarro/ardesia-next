# Evidenze dell'incremento MCP locale

Sorgente6286f01654705b255cad2412bd3f6bb591e2e35ebe33104941ba405819d72c7e, basef7adf5db02913e25fbab0b1da071f650b4f78676. Tutti gli esiti finali qui sotto si riferiscono a questa sorgente locale, non a un deploy remoto o alla conclusione dell'ecosistema.

| Report | Esito |
|---|---|
| [verification.json](verification.json) / [log](verify.log) | Verify8/8 |
| [unit.json](unit.json) | 381/381 |
| [e2e.json](e2e.json) / [browser-evidence.json](browser-evidence.json) / [log](browser.log) | 109/109, zero skipped/flaky/fail |
| [server-runtime.json](server-runtime.json) |5/5; Function compilata, database isolato |
| [mcp-runtime.json](mcp-runtime.json) |9/9; client MCP ufficiale esterno, stdio, HTTP/Core/PostgreSQL limitato |
| [budget.json](budget.json) |202119/245760byte JavaScript web gzip |
| [build-info.json](build-info.json) / [mcp-build-info.json](mcp-build-info.json) |Identità UI e CLI |
| [anteprima-mcp.json](anteprima-mcp.json) / [manuale Mac](manuale-mac.md) |Percorso MCP→UI→MCP e interruzione login |
| [review-indipendente.md](review-indipendente.md) |Review non autrice favorevole all'incremento locale |
| [legacy-integrity.json](legacy-integrity.json) |Sei file selezionati invariati |
| [status.json](status.json) |Stato generato dall'autorità di accettazione esistente; non modificato manualmente |

Il [primo tentativo](primo-tentativo/mcp-runtime.json) conserva il fallimento del collector sulla fixture con nome errato del comando note studente. I cinque controlli precedenti erano passati, ma il run completo era FAIL. È stato corretto il collector secondo il contratto reale; non il Core. Le prove finali aggiungono le controprove di revoca in volo e prompt/FIFO emerse dalla review.

La manifest [file-hashes.json](file-hashes.json) consente di verificare l'integrità dei report copiati. È una ricevuta derivata, non un secondo gate di prodotto. Gli incrementi precedenti e le rispettive controprove restano nelle directory offline/runtime-preact; il loro PASS non viene attribuito a questa sorgente.
