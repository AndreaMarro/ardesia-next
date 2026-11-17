# Independent native PDF import review — pending frozen candidate

Stable baseline read: Notebook.swift, NotebookCodec.swift, NotebookPDF.swift, NotebookDocument.swift, InkCanvas.swift, App/main.swift and README. Baseline hashes captured separately. No candidate source read or test run before author freeze.

Required checks after freeze:

1. Read complete candidate diff and authoritative contract. Match exact patch/source/bundle identities; separate author QA from reviewer evidence.
2. Strict schema1 roundtrip and unknown-field refusal unchanged; schema2 only PDF assets/references. Reject corrupt digest/content, duplicate asset identity, dangling/out-of-range page references, unexpected fields and invalid geometries. No external file dependency after import.
3. Resource limits: input ≤12 MiB, notebook ≤64 total pages and serialized JSON ≤32 MiB, including base64 overhead and existing ink/assets. No silent truncation or partial import. Duplicate import embeds identical original bytes once by SHA; document/page identities remain unique.
4. Valid import is one atomic, undoable model change; failure/cancel keeps model/selection/dirty state/undo history intact except an explicitly finalized pre-existing gesture. Undo/redo must restore both pages and referenced assets, including selection fallback. Removal/duplication/reordering must preserve or prune references safely.
5. CropBox origins/nonzero offsets, MediaBox/CropBox intersection, landscape, rotations 0/90/180/270 and mixed-size pages. Compare visible PDF content and ink alignment between canvas, save/reopen, and vector export. Check annotation appearances and font/text preservation as supported by declared contract.
6. Workbook real7-page PDF import with embedded font license; annotation and save/reopen/export. Check text/vector content survives, original source digest remains exact, font and attachment limitations honestly documented.
7. Replay real NSDocument Save/Close/Quit first-live-gesture regressions plus nested modal safety, periodic autosave during gesture, undo dirty state and write-failure preservation. Existing lifecycle scheduling must remain intact.
8. Inspect menus/error messages/README for accurate limits, imported-page behavior, deletion and file ownership; explicit authorization preserved and no misleading sync/Apple Pencil/notarization claims.

Final result must identify blockers immediately, exact coverage and untested boundaries. Only reviewer-owned evidence files may be changed. Author remains owner of any fixes; root owns integration/publication. Review deadline05:20UTC; overall stop06:30:26UTC.
