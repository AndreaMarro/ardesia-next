# Evidenze REA

Tool: `rea-agents@6.8.0` da npm ufficiale; runtime Node24.22.1. Documentazione consultata: README e `docs/cli.md`, `docs/javascript-application-workflows.md`, `docs/browser-observation.md` di https://github.com/morluto/rea .

| Analisi | Evidenza | Limiti |
|---|---|---|
| perfect-freehand1.2.3 ESM | `perfect-freehand-summary.json` e `perfect-freehand.bundle.json` | Statica, cap1500nodi raggiunto,24file non selezionati; nessuna prova di esecuzione o latenza. |
| Demo ufficiale | `demo-observation.json` | DOM/accessibilità/eventi rete del sito pubblico; niente misura hardware. |
| Interazioni demo | `demo-interaction-v3.json` |4step completati: ingresso/caricamento, scelta EaseInQuad, Reset; ritorno Linear osservato. Nessuna azione di disegno disponibile nello schema usato. |
| Tentativi non validi | `demo-interaction.json`, `demo-interaction-v2.json` | Fallimenti di schema conservati, non contati come interazioni riuscite. |
| ReplayEngine legacy | `legacy-replay-summary.json`, `legacy-replay.bundle.json` | Analisi selettiva statica con cap2000; relazioni fuori scope/runtime non provate. |

Origine donor: https://github.com/steveruizok/perfect-freehand ; demo collegato dal README https://perfect-freehand-example.vercel.app/ . Licenza [MIT](perfect-freehand-LICENSE.txt), copyright Stephen Ruiz Ltd. Nessuna nuova dipendenza/copertura donor nel runtime Next. Implementazione del contorno a capsule originale.

Legacy: `AndreaMarro/ardesia@5cfbdcb055ba3ba136f97fb56e997f06e6cf3605`, file `apps/studio/src/store/ReplayEngine.ts`, consultato senza modifiche.

Comando di analisi usato, con percorsi locali risolti nel workspace:

```sh
node rea.mjs analyze-javascript-application <directory> \
  --source-path <file> --max-semantic-nodes <1500-o-2000> \
  --max-semantic-nodes-per-file <1500-o-2000> \
  --analysis-timeout-ms 45000 --detail summary \
  --evidence_output <bundle.json> --format json
```

I JSON delle osservazioni browser includono scenario, parametri, versione Chrome156, artefatti, stati e limiti effettivi; non è necessario ricostruirli da una descrizione. I processi browser lanciati da REA sono stati chiusi da REA. Nessun login o contenuto privato è stato inviato al demo.
