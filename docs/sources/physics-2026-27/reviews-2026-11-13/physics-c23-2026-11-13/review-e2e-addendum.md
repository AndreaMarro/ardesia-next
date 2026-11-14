# Addendum indipendente — correzione attesa E2E C3

Revisione del delta locale rispetto a `527043ee5c52d8b210e3f66bda208dddd9722a04`. Il diff contiene soltanto `e2e/physics-courses.spec.ts` e il resoconto `c23-practice-2026-11-13.md`. Nessun P1/P2 concreto rilevato; la correzione dell’attesa è fondata sul contratto preesistente del prodotto, non sulla soppressione del fallimento.

## Evidenza originale letta

Letti integralmente i due errori nell’artefatto `artifacts/physics-c23-2026-11-13/initial-browser-527043e/e2e.json` e il relativo `run.log`. La sessione registra quattro prove: due C2 superate e due C3 fallite (desktop Chromium e mobile Chromium), zero skipped e zero flaky. Entrambi i C3 falliscono nella medesima uguaglianza alla precedente riga 56, dopo aver già verificato la presenza della risposta dopo reload.

La differenza effettiva riguarda l’aiuto consultato dopo il salvataggio: `help=[]` diventa una sola voce `{unitId:'sf-2026-u5-05',kind:'referenceFeedback',firstViewedAt:...}`; `revision` passa da 3 a 4 e `updatedAt` avanza. Non è un fallimento delle asserzioni scientifiche del laboratorio. L’asserzione finale sugli errori pagina, posta dopo quella fallita, non fu raggiunta: questo addendum non ne attribuisce un PASS alla prima esecuzione.

Hash SHA-256 del JSON originale: `bca0f75541154859c463a9b1b8c0c238dd8a21073085fd59169d166f52645196`.
Hash del log originale: `ce1ae97992c81d171e5009b83dad0da7d7e23563834c1ee94cc440daa89b1f31`.

## Confronto con il prodotto già presente

`CourseStudio.tsx:198` apre una soluzione nuova passando per `view-course-help` con tipo `referenceFeedback`, salvo aiuto già registrato. `packages/core/src/courses.ts:102–122` clona il lavoro precedente, registra l’aiuto, incrementa la revisione e aggiorna la data. Alla registrazione di ogni risposta `helpUsed` è invece uno snapshot degli aiuti già consultati; il successivo comando di aiuto non riscrive i tentativi. Il test Core preesistente «records assistance and immutable attempts» verifica proprio l’ordine risposta/aiuto/nuova risposta.

La UI in `CourseStudio.tsx:200` legge `attempt.helpUsed`, non lo stato corrente degli aiuti, per mostrare «Nessun aiuto consultato nel percorso prima della risposta». La nuova aspettativa è quindi motivata sia dal codice di dominio sia dal comportamento già osservato.

## Valutazione del delta

Il test ora richiede esplicitamente assenza di aiuti al momento del primo snapshot; dopo la soluzione richiede una sola ricevuta del tipo e dell’unità esatti, revisione aumentata di uno e array dei tentativi interamente immutato. Dopo reload confronta l’intero lavoro con lo snapshot successivo alla consultazione e verifica anche l’indicazione temporale corretta sugli aiuti. Il confronto di persistenza rimane un’uguaglianza completa; non viene sostituito da un controllo parziale su testo o quantità di elementi.

Sono invariati timeout, percorso utente, dati reali Core, prova C2, controlli numerici del laboratorio, asserzioni sulla visualizzazione della soluzione, geometria, reset e assenza di errori. Nessun skip, retry aggiunto, mock del prodotto o modifica del comportamento per soddisfare il test. Il paragrafo documentale descrive fedelmente il fallimento conservato e non anticipa un PASS del nuovo candidato.

Hash test corretto: `c03431b03c2ba648d4b5171f0ad6dc6c94a50c1bc63125ff3bb182787aa719f2`.
Hash documento corretto: `d54096545793df0967861ac110c5abf446b50cf6ad35afcfba154c07f37e2d97`.

## Limiti

Revisione statica del delta con confronto dei risultati grezzi precedenti. Non ho eseguito la nuova prova browser, né attestato Verify sul candidato corretto. L’esito resta da verificare sulla nuova revisione. Nessuna modifica condivisa effettuata da questo revisore.
