# Riesame indipendente materiali — follow-up

Sorgente osservato: `43d28b6c2d0402435e27594a9055046d1bcabe9c4cd492e270d2f7209e37bf29`. Non congelato.
Baseline: `81eec80ac69a13a6a13064fca63e780330a6e12de5e6881393c8d142f38b79dd` (408 file, confermata indipendentemente nel primo passaggio).

**Esito: correzioni verificate staticamente; nessun PASS finale.**

Le cause dei sei rilievi preliminari sono affrontate. Il nuovo MATERIAL-07, segnalato durante questo riesame, è stato corretto con abbandono esplicito della bozza e download dell’originale. Le esecuzioni finali devono ancora essere consegnate e collegate al sorgente congelato.

| Rilievo | Riesame statico |
| --- | --- |
| MATERIAL-01 | MaterialView.tsx:40 checks disposed after both lazy import and original.arrayBuffer; :50 destroys the task in finally; cleanup aborts queue signal and cancels render/task. |
| MATERIAL-02 | Manifest, original Blob and stable page objects are persisted before upload. IndexedDB account/generation checks and exact manifest/object CAS prevent replacing an existing intent. Reopen restores the draft; App add skips only already present identical objects; draft clears after onAdd confirms. |
| MATERIAL-03 | Board culls material and ink objects. MaterialView uses IntersectionObserver and resets offscreen canvas to 1x1. A shared serial promise queue covers render and inspection decoders; PDF task is destroyed after each render. |
| MATERIAL-04 | materialRasterSize receives decoded PDF viewport or bitmap dimensions, validates finite positive geometry and caps actual target width/height to 1600/2000 before assigning the canvas. |
| MATERIAL-05 | updateOfflineCopy enumerates material references across every snapshot document, verifies/downloads/persists originals first, and only then saves the snapshot and offlineSavedAt. Failures retain rejection for offline transitions and ACK cleanup. |
| MATERIAL-06 | Board focus and connection endpoints resolve materialPosition. Focus records selection only after the object exists. Derived reading/course views render anchored annotations as page-relative SVG overlay. |
| MATERIAL-07 | MaterialImport.tsx:46-51 now exposes an explicit abandon step and download of retained original; clearMaterialDraft only deletes the matching asset intent. The UI explains existing pages, pending commands and server originals remain. |

## Osservazione aperta di precisione del report

`tools/check-budget.mjs:26`: il confronto storico etichettato `all-non-program-assets-gzip` usa ora `coreGzipBytes`, che esclude anche PDF. Il costo PDF è presente nei budget v3, ma quel confronto va mantenuto fedele (core + PDF) oppure rinominato e affiancato al confronto storico.

## Prove lette, ancora non accettate

Sono presenti cinque scenari browser: import PDF e originale, ink/focus con spostamento +5010 e connessione, cold offline, immagine/corruzione, ripresa upload, aggiornamento offline della lezione mai aperta e abbandono della bozza rifiutata. Il test di ripresa non confronta ancora esplicitamente gli ID prima/dopo; quello di abbandono non riapre la bozza prima dello scarto e non completa un nuovo import. Sono lacune di controprova, non ulteriori difetti statici confermati.

Le unit source coprono coda/raster, bozza durevole/account e fallimento dello storage degli originali prima del salvataggio dello snapshot. Nessuna esecuzione è stata svolta o accettata da questo riesame.

## Limiti

Nessun test, servizio, installazione, modifica sorgente/index, operazione Git o remota. Scritto soltanto `followup.*`. Restano necessari digest congelato, raw/evidence finali con associazione alla build, primi tentativi e fallimenti conservati, controllo budget/docs/licenze. Nessuna approvazione della baseline personale si trasferisce ai materiali; nessuna dichiarazione di completezza del prodotto o deploy corrente.

Il JSON contiene hash dei file osservati e delta dalla baseline.
