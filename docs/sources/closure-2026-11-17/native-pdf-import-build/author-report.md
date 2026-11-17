# Native PDF import candidate — frozen for independent review

Base `a6df5523c71113e22ea7e3e5ab35348bf8b3ad95`; source `work/native-pdf-import-candidate`. No root repository mutation, app launch, user-app kill, network, dependency installation, Xcode installation, watchdog change, publishing or database action occurred. `git apply --check` passes on `candidate.patch`.

## Behavior and boundaries

- Menu/button Importa PDF (`⇧⌘I`) selects one regular PDF ≤12 MiB and appends its pages as noneditable A4 backgrounds. It preserves CropBox, rotation and aspect ratio, including displayed annotation appearances. A new notebook's initial blank page remains: importing the real seven-page workbook yields eight pages.
- An immutable source asset holds original `Data`, SHA-256 and derived page count. Reimporting identical bytes reuses one asset; page references are zero-based. Source attachments, metadata and license survive because bytes are unchanged. Export creates static pages with backgrounds plus editable notebook ink drawn above; original PDFs remain in the notebook, not as interactive PDF views/actions.
- Schema 1 is still read/written as schema 1 until import; schema 2 adds strict assets/background refs. Unknown fields, corrupt hashes, missing/out-of-range refs, duplicate or unreferenced assets are rejected. Older companion builds reject schema 2; no silent downgrade occurs.
- All PDF input validation and complete canonical notebook encoding pass before `replace`, producing one undo group. The original file/model/history remain untouched on invalid input. Last-reference deletion prunes the source asset; undo restores it with the page.
- Bounds: input 12 MiB, notebook 32 MiB including base64, 64 total notebook pages, existing ink limits unchanged. PDF box coordinates must be finite within ±1,000,000 pt; positive sides ≤14,400 pt; rotation multiple of 90° within ±360,000. Header/end/xref envelope, encryption, inherited geometry, visible crop intersection and content scanner are checked. This is system-parser validation with tested corrupt cases, not a universal PDF conformance certification.
- No PDF decode/hash/base64 work per pen point or canvas draw. PDF payloads use Swift Data COW. Exact serialized asset byte cost is cached as an integer; edits encode only the small structural/ink portion to enforce 32 MiB. The canvas owns one derived PDFDocument/PDFPage for its selected background. Export owns one derived document per asset. No CoreGraphics/PDFKit objects are in Sendable model values or shared across threads. C scanner/operator/content resources are explicitly released.

## Verification

- `core-checks.json`: **18 PASS / 0 FAIL**. Legacy/new codec roundtrips, original bytes/digest/dedup, invalid/corrupt/encrypted inputs, exact base64 accounting, page/32 MiB bounds, schema strictness, annotation appearance, vector text, all four right-angle rotations, nonzero crop origin, letterboxing/clipping and ink overlay. Real workbook with 50 strokes/5,000 points roundtrips and exports eight pages.
- `lifecycle-checks.json`: **8 PASS / 0 FAIL**, baseline and real-PDF Save/Close/real Quit/nested modal loop. Each PDF case also proves import undo/redo and named autosave/undo. The exact saved model contains the pending gesture and exact source PDF bytes/digest. Offscreen synthetic events only; all temporary child fixture directories are removed.
- Native canvas measure with the real 88,064-byte workbook: 50 complete strokes / 5,000 points applied in **0.1773 s total**; complete canvas draw **0.00637 s**. Debug harness, one local run on this Mac; not hardware latency certification. `pdf-canvas.png` is an actual InkCanvasView capture with deliberate synthetic stress strokes.
- `build-release.log`: Release bundle built, plist linted and ad-hoc signing verified. No GUI launch. Bundle and binary SHA are in `final-manifest.json`.
- `final-fixtures-v2/`: model/PDF roundtrip outputs plus first/last imported page PNGs. Deliberate test strokes are not a finished student annotation or scientific content.

`core-checks.stderr.log` contains one CoreGraphics diagnostic caused by deliberately invalid PDF fixtures; all expected rejections passed. First author iterations found and fixed crop-with-no-visible-intersection acceptance and rendering transform errors, plus a test synchronization issue where explicit autosave ran before AppKit marked the rename dirty. No native lifecycle implementation was changed to accommodate the test; it now waits for the real dirty state.

## Reproduction

From the workspace root, run through the existing deadline guard while the session is active:

```sh
python3 work/deadline/guard.py run -- env ARDESIA_NOTEBOOK_BUILD_ROOT="$PWD/work/native-pdf-import-build" work/native-pdf-import-candidate/script/check.sh --pdf-input "$PWD/work/lab-workbook/Quaderno-degli-esperimenti-C1-C5.pdf"
python3 work/deadline/guard.py run -- env ARDESIA_NOTEBOOK_BUILD_ROOT="$PWD/work/native-pdf-import-build" work/native-pdf-import-candidate/script/check-lifecycle.sh --pdf-input "$PWD/work/lab-workbook/Quaderno-degli-esperimenti-C1-C5.pdf"
```

Remaining checks: independent review, visible Import panel/workflow and minimum-window layout by root. No claim of acceptance, human review, publication, notarization, iPad support or sync. Root owns integration, final UI QA and any workbook wording/hash update after acceptance.
