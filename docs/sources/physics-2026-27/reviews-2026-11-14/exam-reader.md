# Independent review — exam UI and reading edition

Reviewer: recovery_audit, 2026-11-14. Read-only review; parent owns integration. Source fingerprints and executable checks are adjacent.

## Results

Exam engine/browser reviewed candidate passes independent numeric normalization, blank-versus-zero and exact deadline counterexamples. 31 blank score 0; 31 wrong score −3.1; 31 correct score 31. At exact deadline late answer is rejected. Native radio keyboard navigation, Escape focus restoration, automatic timeout with submit dialog open after pageshow, result focus, export provenance, restart cancellation, 320px layout and no storage all pass in Chromium using file:// while offline. Export SHA matches root exam JSON. Engine/source review confirms no fetch or persistent storage, inert escaped JSON and textContent rendering. Existing author's XSS fixture and 31-answer UI tests were read; our counterexamples supplement them rather than falsely claiming independent repetition of all author checks.

Reading edition: 38 pages contain all eight pedagogical source fields and all prompts/solutions/option feedback verbatim (normalized whitespace). 279 question objects, of which 10 multiple-choice and 269 open. Options are in the prompt and pre-line CSS preserves line breaks; initial concern about missing options is withdrawn. Browser checks at 320, 390 and 1440px on first and last units pass no overflow, no storage, and offline rendering. Every relative link/anchor resolves except simulazione.html, not yet generated in root at this checkpoint. Full build must rerun integrity.

All 38 objectives match learning-objectives.json. Their distribution matches the official PDF's 38 topic bullets: U1 4, U2 5, U3 5, U4 5, U5 5, U6 7, U7 7. Wording consistently asks observable actions, model conditions, unit/sign checks and interpretation. They are summaries of topics, not a claim to enumerate every subordinate syllabus detail. This is alignment review, not human scientific approval of 279 questions or validation of student outcomes.

Original candidate ZIP: 12 unique safe entries, 249672 uncompressed bytes, all CRCs pass. It predates inclusion of reader and C4; final ZIP must be rechecked after full build.

## Actionable integration findings

1. **P1 for advertised file-open offline laboratory:** original C4 generated campo.html loads campo.js with type=module. Actual Chromium file:// blocks it with CORS origin null, leaving the laboratory noninteractive. Evidence results.json captures exact console errors. Parent assigned classic IIFE fix to cloud_audit; independently retest that fixed version before closure. This defect was in recovery_audit's own C4 candidate.
2. **P2 robustness relative to explicit bounded archive requirement:** original exam generator offlineFiles recursively reads all allowed extensions without count, file-size, total-size or directory-depth bounds. Source is local trusted build input, so this is not a remote exploit claim. Guard with clear errors before allocation. Final integration should also verify each current local href/src is represented and works when opened from extracted ZIP.
3. **P3 provenance completeness:** initial reading manifest hashes only courses.json, while 279 question objects are read from five distributed packs. Parent has already started adding sourcePacks hashes; verify generated manifest against actual pack bytes after rebuild.

## Recommended permanent integrity tests

- 38 unique lesson IDs, document references resolve, question counts match packs, required source text/answers survive escaping.
- All relative href/src targets and fragments resolve after complete generation; allow/label online-only root application links explicitly.
- Reader manifest hashes all six inputs and every generated page.
- ZIP paths unique and safe, CRCs valid, byte/count/depth caps enforced, complete current local asset graph included.
- Open extracted simulazione.html, index.html, C4 and representative reader pages via file:// with network disabled, then exercise controls rather than only checking content presence.
- Preserve engine cases for 0 versus blank, malformed numeric strings, exact deadline, deadline during modal/background resume, source hash and DRAFT export.

No Safari/iPad/Apple Pencil test, assistive technology human review or human scientific acceptance was performed. No shared source changed and no external publication.
