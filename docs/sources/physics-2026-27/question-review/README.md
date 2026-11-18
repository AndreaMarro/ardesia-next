# Quesiti guidati di Fisica

Il primo lotto contiene 40 quesiti, due per ciascun abbinamento fra cinque percorsi e quattro livelli storici. Dodici quesiti attivi aggiuntivi sono nei file con prefisso \`secondo-\`. I due lotti condividono generatore, criteri e controlli. Le etichette di difficoltà provengono dalla banca e non sono misure ottenute con studenti.

Ogni record conserva il proprio ID. [L'indice delle origini](origins.json) lega ogni riscrittura al commit sorgente \`5cfbdcb055ba3ba136f97fb56e997f06e6cf3605\` di [AndreaMarro/ardesia](https://github.com/AndreaMarro/ardesia/tree/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605/packages/engine/lessonos/study/content/physics-semestre-2026-bank/questions), al percorso dello shard, al blob Git e all’hash JSON canonico del record. La canonizzazione usa chiavi ordinate, UTF-8 e separatori senza spazi. I campi \`reason\` e \`check\` descrivono le differenze e le controprove. Le figure appartengono al record e usano coordinate con origine in alto a sinistra. La build genera SVG e TikZ dagli stessi segmenti e dalle stesse etichette. Le chiavi e i valori numerici sono preservati, alcune alternative errate sono state riscritte.

Le edizioni personali esistenti conservano il loro contenuto congelato. Gli esercizi nuovi si trovano nel percorso di lettura delle lezioni, raggiungibile da **Il percorso completo → Apri gli esercizi guidati** nei cinque microcorsi. Si può aprire una soluzione anche senza script. La valutazione nella pagina corrente dà un feedback formativo e non crea una risposta registrata.

## Riproduzione

Scaricare la directory della banca dal commit indicato e ottenere l'albero Git completo dello stesso commit con \`gh api 'repos/AndreaMarro/ardesia/git/trees/5cfbdcb055ba3ba136f97fb56e997f06e6cf3605?recursive=1'\`. Il primo argomento del controllo è la directory che contiene \`manifest.json\` e \`questions/\`. Con Python e \`jsonschema==4.25.1\`, nel checkout Next:

\`\`\`sh
python tools/audit-physics-bank.py /path/physics-semestre-2026-bank \\
  --tree /path/source-tree.json \\
  --output docs/sources/physics-2026-27/question-review/bank-audit.json \\
  --origins docs/sources/physics-2026-27/question-review/origins.json
npm run build
npm run verify
npm run test:e2e -- physics-reviewed.spec.ts physics-journey.spec.ts
\`\`\`

Il generatore LaTeX richiede Node 24 e le dipendenze bloccate del progetto. Tectonic 0.17.0 compila la dispensa con il bundle LaTeX standard e font Latin Modern.

\`\`\`sh
node tools/build-physics-reviewed-pdf.mjs Quesiti-campione-Ardesia.tex
tectonic --untrusted Quesiti-campione-Ardesia.tex
pdftoppm -r 110 -png Quesiti-campione-Ardesia.pdf pagina
\`\`\`

I dieci ID sono in [pdf-sample.json](pdf-sample.json). Il [PDF](sample/Quesiti-campione-Ardesia.pdf) e il [sorgente LaTeX/TikZ](sample/Quesiti-campione-Ardesia.tex) sono salvati insieme. La stampa ha un quesito per pagina, due per percorso. Il footer esatto è presente in tutte e dieci le pagine.

Il controllo browser su tutti i record si può ripetere avviando \`python3 -m http.server 4181 --bind 127.0.0.1 --directory apps/web/public\`, creando una cartella vuota per le ricevute e usando \`node docs/sources/physics-2026-27/question-review/evidence/run-grid.cjs /path/receipts\`. I test di CI esercitano il percorso sul server Next.

Il dettaglio numerico dell’audit e le ricevute dei revisori descrivono ciò che è stato provato e l’identità dei file al momento di ogni prova. Le misure indipendenti precedenti alle correzioni di impaginazione conservano quel perimetro. Il report finale segnala i limiti dell’edizione corrente.
