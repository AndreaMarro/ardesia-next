# Independent review — C1 collisions, readable practice record and runtime minification

Reviewer: `/root/experience_review`, distinct from collision author `/root/cloud_audit` and report/build author `/root`. Reviewed raw sources and independently executed numerical/browser checks. No repository source, publication, database, or port4173 was modified or used. Review evidence is confined to this directory.

**Final outcome: PASS within the tested scope.** One P3 layout defect in the readable record was found, reproduced, corrected by the root author and independently retested. No outstanding scientific or functional blocker was found. This is an AI/technical review, not human scientific approval, product acceptance, Safari/device qualification or a CI/deployment result.

## C1 collision model and learning interaction

Read original `urti.js`, HTML and CSS. The model uses signed velocities and the standard two-body 1D conservation equations. Both masses remain positive, A approaches from the left with positive velocity, B is stationary or approaches from the right. The permitted controls therefore produce an actual collision. In sticking mode both velocities equal total momentum/total mass; lost kinetic energy becomes internal energy in the expressly closed, idealized model. Elastic mode conserves kinetic energy and reverses relative velocity. The text distinguishes momentum from kinetic energy, specifies neglected external impulse, and excludes real damage/safety predictions, force profiles, finite deformation duration, friction and rotation. The companion lesson link targets the existing “Impulso e quantità di moto” page.

Independent deterministic random sweep: **20,000 configurations**, covering both models with non-grid floating-point parameters throughout the permitted ranges. Assertions cover signed momentum, elastic kinetic energy, reversed relative velocity, sticking loss `½ μ (u₁−u₂)²`, uniform center-of-mass motion, no penetration through contact and containment of the complete drawn cart rectangles in the viewport. Five invalid-input counterexamples are rejected. The default example independently gives p=3kg·m/s, v=0.75m/s, K4.5→1.125J, loss3.375J. The transfer example gives p=−2kg·m/s, v=−0.5m/s, K2→0.5J, loss1.5J. Both match the text and UI.

Six browser configurations use file:// with network offline: widths320/390/1440, each with normal and reduced motion. Tested deliberately wrong predictions, correct zero-total-momentum case, elastic reversal, negative-momentum transfer, model/parameter reset, keyboard range control, contact at0.80s, animation/pause and reduced-motion endpoint switching. Controls and feedback match the numerical model; changing a parameter hides old results and disables playback until the new prediction. No page errors, HTTP requests or horizontal overflow. The actual minified integrated `urti.js` is exercised in the final browser run. The320px screenshot was inspected visually; controls, explanatory text and transfer remain readable. Screen-reader operation was not physically tested.

## Readable report: defect and closure

The record escapes every inserted text field, contains no scripts or external resources and includes a restrictive CSP. It checks exam identity, source hash, item count and item order before combining answers with explanations. This guards accidental cross-edition records; it is not a signature or certification, and the document states it is local/unauthed and not a Core backup. All31 questions retain prompt, answer, correct answer, reasoning and next step; all105 choice-option feedback texts remain available. JSON export remains a separate format.

**P3 found:** an unbroken/hostile editorial question title in `<h2>` expanded a320px viewport to452px. The content was correctly escaped as text; there was no script execution. `overflow-wrap` initially applied only to paragraphs/list items/code. Raw failure and DOM measurements are retained in `report-overflow.json`, `report-overflow.png` and `browser-before-fix.log`.

Root correction: `main` now inherits `overflow-wrap:anywhere`. The final canonical exam source SHA256 is **`7c475d788a38e2962374452eaa835ab99e4f9299b5415e1c80b5f509408138ba`**; generated runtime SHA256 **`c35117991590f8fa28ec8337add368b6ee6efd911b7e35cc57156a292cb79b62`**. Independent rerun with adversarial strings in title, prompt, explanation, recovery, choice text/feedback, source filename and numeric answers passes at320/1440px for A and B. These inputs remain literal text; the DOM has no script/img/svg/iframe/object/embed/link/a/form nodes, no network requests and no overflow. Eight edition/hash/count/order mismatches are rejected. Additional A/B checks with JavaScript disabled and network offline at320px independently count31 questions and105 option-feedback items, with no overflow (`report-no-js.json`).

Browser-generated PDFs for both adversarial records retain31 “Il ragionamento”,31 “Il prossimo passo” and21 “Capire le alternative” sections and the source SHA. First PDF page inspected. This is evidence that Chromium printing preserves content, not a guarantee about every printer or browser. Root's separate application tests exercise the actual download button; this independent review directly generates the export function output and checks it in real Chromium, rather than claiming to have repeated that button path.

## Runtime minification

Canonical campo/demo sources are byte-identical to their published7c9c061 versions; minification does not rewrite their model/UI logic. New readable sources remain under `tools/physics-runtime`, and fixed-name output generation runs before the offline ZIP is assembled. Terser is already pinned in the repository; no new runtime dependency or optional classification is introduced.

Independent Terser invocation produces byte-identical generated outputs for campo/exam/demo/urti. For campo and urti, **1,000 independent configurations each** produce identical source/minified model outputs. For both exams, **200 randomized complete answer sets** produce identical summaries and complete HTML between readable source and generated runtime. Minification equivalence is measured on these cases, not asserted as universal proof of a compiler.

Node24 gzip measurements: campo7429→6333bytes; current exam8393→7140; demo311→335; urti1882→1751. The tiny demo grows24bytes because the generated-source preamble outweighs minification; no per-file saving is falsely claimed. Actual aggregate budget and initial loading remain the coordinator's final build check. No budget policy change was found in the scoped diff.

## Provenance and reproducibility

- `checks.json`, `check.cjs`: random science sweep, randomized exam equivalence, mismatch rejections and source fingerprints.
- `minification.json`, `minification.mjs`: deterministic generated bytes, hashes, gzip and model equivalence.
- `urti-browser-results.json`, `browser-results.json`, `browser.cjs`: six collision configurations and four report configurations, final PASS.
- `source/`: frozen raw/generated sources; `exam-before-fix.js` and `urti-original.js` preserve earlier identities.
- `report-overflow.*`, `browser-before-fix.log`: P3 failure; `browser-after-fix.log`: corrected run.
- `report-a.pdf`, `report-b.pdf`, `pdf-checks.json`: printable content checks; `urti-*.png`: reviewed visual evidence.

A preliminary reviewer-only equivalence harness sampled charge/separation values below the existing C4 bounds and correctly raised RangeError; its input range was corrected to0.5–3nC and0.8–2.4m. This was a harness error, not a product failure. Failed browser harness was terminated by its specific reviewer PID before rerunning; final browser contexts and processes are closed. No server or background task remains from this review.
