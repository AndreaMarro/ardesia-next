# Verifiche — materiali e handoff

Sorgente **290f597d24ea4ef92769faab9b309069ed9e50dd2fd9f8b778c460e186b12c82**,429file. Base Git f7adf5d con working tree: il digest identifica i byte, non un commit pubblicato a posteriori.

Verify8/8,552test,191browser, server5/MCP15. Zero falliti, saltati o instabili nella run corretta. [Report](esito-consegna.json), [review indipendente](review/final-review.md), [sorgenti](source-files.json), [REA](../../rea-evidence/materials/README.md).

L’intero primo browser aveva190PASS/1FAIL: il focus veniva riapplicato su resize e annullava PageDown. Correzione sul consumo della sola selezione, test originale mantenuto, nuova suite completa. Altri fallimenti e tentativi REA sono conservati; nessuno è rietichettato. I report precedenti si riferiscono alle sorgenti originali.

Controprove: upload→preview→range→ink→spostamento+5010→download byte-identico→reload/offline; immagine/corruzione; ripresa stessi asset/ID; abbandono dopo reload con nuovo import; copia già preparata con materiale in lezione non aperta; quota storage, revoca/corso/IDOR, backup corrotto, MCP SDK ufficiale.

Budget Core276431B gzip, PDF e programma separati con costo totale conservato; vecchia soglia complessiva non passa. Quote non certificano prestazioni fisiche. Il prodotto resta NOT_COMPLETE; commit/CI/deploy distinti.
