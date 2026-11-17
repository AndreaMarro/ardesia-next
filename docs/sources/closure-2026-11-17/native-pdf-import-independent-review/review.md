# Independent native PDF-import review

**PASS for root integration and separate visible UI verification. No blocking defect found.** Review began 14 November 2026 and was interrupted after successful model/geometry/lifecycle checks. On 17 November, under the new bounded closure instruction, the same frozen source was reverified and the remaining real-document/size checks completed. No old deadline was restarted. Reviewer changed no production/candidate source, launched no visible app and published nothing.

## Exact reviewed candidate

- Source folder: `work/native-pdf-import-candidate`; all **21 files** match the author manifest both before the initial tests and at final closure.
- Source digest: `34c611d0590d789ac3af52c0cd485ac288921a2e9f511f5bfde1db43e9ee7e12`.
- Patch SHA-256: `7c7e60e43c1a3157c460d3e38ba2a532ea89f3978ed76cc74bfc969212c4b351`.
- Author base: `a6df5523c71113e22ea7e3e5ab35348bf8b3ad95`.
- Author bundle binary identity: `a003455e2911446bb7f3770b94bc5073967747b45a348c941aaf257f6ad6ff83`; reviewer tests compile the actual frozen sources, not a substitute implementation. Root owns final integrated build identity.

## Independent results

**13 own model/geometry suites PASS**, including 18 separate forged schema/reference/payload cases. Checked schema1 canonical output without invented fields; exact 64-page acceptance and 65-page refusal; immutable PDF deduplication with unique page IDs; malformed rotations and nonintersecting crop rejection; and preservation of an existing notebook file after an invalid atomic write.

New synthetic PDFs use nonzero MediaBox/CropBox origins and inherited geometry. Pixel probes verify color quadrant placement for rotations **0/90/180/270/−90/450**, the visible intersection of a partially out-of-media CropBox, and blank letterbox areas where source paint outside the crop must not escape. Exported text remains extractable as text. Generated partial-crop rendering was visually inspected. These cases supplement the author's ordinary crop/rotation/annotation tests.

**5 own real-NSDocument/boundary suites PASS**, completed 17 November. A successful import forms one undo group; undo/redo restores the exact model, page identities and original bytes. Duplication and reorder preserve references without copying source payloads. Deleting the last referenced page prunes its asset; undo restores both, redo prunes again. A refused import into a full notebook preserves encoded model, selected page and previous undo action. An exactly **12 MiB** valid source is accepted; the otherwise valid **12 MiB + 1 byte** source is rejected. Repeated import of a 12 MiB source stores one asset. Import of a different 12 MiB source that would exceed the **32 MiB serialized notebook** limit is refused with model, selection and history unchanged. Cached byte accounting agrees with actual canonical JSON encoding, including base64 cost.

**8 real lifecycle cases replayed successfully** on 14 November with unchanged candidate sources: Save, Close, actual process Quit and nested modal loop, each with and without the real workbook PDF. Each process exits successfully and saves the exact expected model including the first still-pressed gesture; PDF cases retain exact source bytes and SHA. The replay also exercises named autosave and import undo/redo. This is a rerun of the repository's lifecycle harness, clearly distinct from the independently authored countercases. Temporary lifecycle fixtures were cleaned up. Existing autosave scheduling/termination implementation remains unchanged by the candidate.

## Source assessment

Read the new asset/parser/import/codec/model/export code, document and canvas changes, UI/menu/README changes, and relevant author tests. Original PDF data is immutable and content-addressed; source metadata, attachments and license bytes survive in the notebook. Schema1 remains schema1 until import. Schema2 holds assets and page references, rejects unknown fields, corrupt digests, duplicate/orphan assets and dangling/out-of-range references. Deleting all imported pages does not silently downgrade schema2; older companion builds remain unable to read that document, consistent with the stated version boundary.

The pure import transaction validates and encodes the complete candidate before `replace`. Document edits also enforce serialized size. Derived PDFKit objects stay outside Sendable model values; the canvas caches the selected background, and export builds one document per source. Rendering fits the crop/rotation to fixed A4 without changing original bytes. PDFKit includes static annotation appearances; exported pages retain source/vector drawing where supported, while notebook ink remains separately editable only in the notebook. Native import does not turn the source into an interactive PDFView or execute document actions.

Author evidence reviewed: 18 core suites, annotation-appearance pixel check, real seven-page workbook with 50 strokes/5000 points, and Release build/signature checks. These are author results, not relabelled as newly independent tests. The local timing numbers are not hardware or long-session latency guarantees.

## Remaining integration boundary

Root must perform the visible Import panel workflow, cancellation/error presentation and minimum-window layout, then build/verify the integrated bundle and update public workbook/native-usage wording if accepting the feature. This review does not claim UI completion, universal PDF equivalence/conformance, stress safety for every possible compressed PDF, human scientific approval, notarization, iPad/Pencil support or synchronization. Limits and unsupported encrypted/out-of-policy inputs are explicit.

Evidence: `frozen-hashes.json`, `countercases.json`, `document-and-boundaries.json`, `lifecycle-replay.json`, `final-results.json`; independent scripts `make-fixtures.py`, `main.swift`, `document-probe/main.swift`; synthetic geometry PNGs. All reviewer work is isolated under this folder. No reviewer child processes remain active.
