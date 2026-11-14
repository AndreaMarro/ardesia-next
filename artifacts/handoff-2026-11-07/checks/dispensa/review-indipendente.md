# Review indipendente — dispensa PDF e LaTeX/TikZ

Revisore `/root/board_review`, contesto separato, accesso in sola lettura secondo AGENTS root. Autore e runner delle suite: `/root`. Il revisore ha ricevuto sorgente, diff, criteri di accettazione e report grezzi; non ha scritto sorgenti, servizi, cursore o scheduler e non ha eseguito suite. La separazione è procedurale, non un’ACL tecnica dichiarata.

Verdetto finale ricevuto: **«Favorevole per l’incremento locale dispensa. Nessun P1/P2 residuo individuato.»** Sorgente `ef57bcc96c33bd0ff4114ef479a46b60149a2e80992f49104adbb74de55dfd11`, base `f7adf5db02913e25fbab0b1da071f650b4f78676`.

Confermati nel sorgente: revisione salvata e fonti esatte; lavoro personale studenti escluso; chiusura dopo revoca osservata; copia offline confermata e pending conservati; laboratori statici; TeX generato da grammatica controllata. Durante il riesame sono stati corretti l’accesso mobile dall’inspector, l’esportazione di frame replay parziali, le ambiguità del parser e le formule troppo larghe. Il root ha rilevato e corretto con testo/raster PDF la collisione CSS ink/fonte e la larghezza di stampa. Un sospetto sul baseURL del test studente è stato ritirato: il test passava già; non è registrato come bug reale.

Il revisore ha verificato indipendentemente:

- Digest sorgente, report unit `0c6563f6026967a1d477204c9ec69d25cc5eedc73440b19fc5a5dace27d9ad89`, report E2E `e573dfa6a476d9d93981cc3a1e1c43936732babbcf649e28a21cedb09615a824` e artefatti runtime.
- Verify **8/8**, unit **426/426**, browser **125/125**, inclusi i sei casi dispensa, senza retry/skipped/fail/flaky; budget **221516/245760 byte gzip**.
- I due `.tex` corrispondono byte per byte ai download UI finali. Log Tectonic e PDF confermano la compilazione: nessun overfull, due underfull nei metadati per documento.
- Hash dei sei PDF. Estrazione propria con Poppler, anche coordinate bbox: marcatori finali presenti, bozze private e controlli esclusi, nessuna parola fuori pagina. Raster ink/fonte, offline e TeX ispezionati, senza la precedente sovrapposizione.

L’assenza della data di acquisizione cache nel PDF non è stata considerata materiale al contratto attuale: la UI la mostra, l’export dichiara copia statica mediante revisione e data documento. Non attesta freschezza server né backup/roundtrip.

Il revisore non ha ripetuto il collaudo Mac/IAB del root, né il dialogo OS di stampa. Safari, iPad/Apple Pencil fisici e app native restano NOT_RUN. Il giudizio non costituisce accettazione scientifica, editoriale o di deployment. Prodotto **NOT_COMPLETE**, deployment **NOT_VERIFIED_FOR_CURRENT_COMMIT**.

La review del sorgente e delle prove precede il confezionamento della patch completa e di questo rapporto. I controlli finali di corrispondenza della patch, digest e manifest sono eseguiti dal root e riportati nell’esito derivato; non vengono attribuiti retroattivamente al revisore.
