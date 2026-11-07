# Verifiche Studio tutor

Preparazione locale verificata; nessun commit, push o deploy remoto. Base f7adf5db02913e25fbab0b1da071f650b4f78676, sorgente 097a685d9d53c9ef56f9454e72d142b32df793216a5dd950719c27d31bc0e87e.

- Verify: 8/8; 536 test unitari, zero pending/todo/fail.
- Browser: 171, zero skipped/flaky/fail; desktop Chromium e mobile emulato.
- Server: 5; MCP: 13 con client ufficiale stdio→HTTP→PostgreSQL.
- Migrazione preview 006: backup precedente conservato privatamente; hash dei dati identico prima/dopo.
- [Review indipendente originale](review-original.md): contesto separato, read-only; non è una revisione umana.
- Patch completa: 5af20e20939aa5035106f9418c0d165623859ff8629723abbfec7c73f44b99c2, controllo applicazione inversa passato.

Report raw in questa cartella, fallimenti intermedi conservati in intermedi/. Il timing WASM originale ha superato 2 s sotto concorrenza dei file (2036/2134 ms), isolato 1247 ms; fileParallelism:false mantiene invariati runtime, limiti e asserzioni. Fixture legacy e selettori accessibili corretti; le prove finali usano la stessa sorgente.

[REA e limiti](../../rea-evidence/tutor/README.md). NOT_COMPLETE nel report status.json resta distinto dall’incremento verificato. Nessuna prestazione fisica iPad/Pencil, compatibilità Safari, sincronizzazione simultanea o operazione provider attestata.
