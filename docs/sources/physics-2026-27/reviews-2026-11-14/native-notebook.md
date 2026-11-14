# Independent native companion review

Reviewer recovery_audit. Reviewed original source, raw corrections and final source fingerprints in reviewed-final-source-hashes.json. Source owned by deadline_guard; this reviewer changed only isolated harnesses/snapshots. AppKit interop skill applied. No CUA interaction by this reviewer; author performed separate actual-app checks.

## Findings and closure

1. **P2 — eraser could delete untouched edge ink; pen fabricated border lines.** The original InkCanvasView clamped raw pointer coordinates to page bounds. Real NSEvent harness: start(1,10), move(-100,10), move(-100,200) removed a stroke(5,150)→(20,150) although the pointer stayed100pt outside. Same pen path wrote(1,10),(0,10),(0,200). geometry-results.json preserves failure. Correction uses raw eraser sweep and Liang–Barsky clipped pen fragments. Counterexample now preserves ink; three exits/reentries produce three disjoint fragments in one callback/undo batch. Fixed results retained.
2. **P2 — pending gesture omitted from close decision.** Real NSDocument.canClose on a clean document with live canvas gesture returnedtrue without prompting; close() then appended the stroke after the decision. geometry-fixed-lifecycle-failure.json records dirtyfalse/count0 at decision and count1 after close. Final correction flushes before superclass canClose and before standard application terminate, and explicit UndoManager groups make dirty state synchronous. Independent runtime interception at the superclass boundary verifies each sees count1+editedtrue. This interception avoids opening a synthetic dialog or terminating the test process; it is not a claim of end-to-end CmdQ UI acceptance.
3. **P1 regression during correction — direct application initializer crashed.** NotebookApplication() followed by NSWindow raised NSInternalInconsistencyException: Creating more than one Application. Stack entered NSApplication.sharedApplication from NSWindow. Author changed actual entry point to NotebookApplication.shared, before all windows/controllers, with runtime subclass precondition. Independent harness using that exact singleton form passes and observes concrete subclass at terminate boundary. Author separately rechecks actual bundle startup.
4. **Dirty count overcount, author-discovered and independently checked:** original manual changeDone plus NSDocument UndoManager observation kept reverted documents dirty. Final source removes duplicate count increment. Batchappend→undo returns exact original model and isDocumentEditedfalse; redo returns changes and dirtytrue. No manual counter reset used by the reviewer.

## Verified behavior

- Actual InkCanvasView event geometry at magnifications0.35,1,2.5 preserves page positions. Hand pan at250% converts50screenpx to20pagept with expected x/y signs.
- Erase/undo restore exact strokes; multiple clipped fragments form one undo operation. A20001point gesture respects20000points/stroke and total remaining budget.
- Actual NSDocument safe-write followed by URL reopen reproduces identical model. Malformed reads preserve existing model; successful reopen clears prior undo actions. Save/export finish callback is synchronous; asynchronous document writes explicitly disabled.
- Fourteen malformed/missing/future-field decode counterexamples rejected. IDs, pages, pressure and colors survive exact roundtrip. Valid64page/250000point boundary notebook roundtrips in7717570JSONbytes.
- PDF two asymmetric pages: page1 red dot(30,40), page2 blue dot(300,700). Independent CoreGraphics bitmap assertions confirm top-down model orientation and no transform accumulation across pages. Poppler page1 inspected. pdfimages lists no raster images. PDF is4116bytes; A4 dimensions595×842. The same renderer is used on canvas and PDF, with deliberate paper-coordinate bounds.
- Consumer source acceptsPDF≤32MiB and≤1000pages; companion caps64pages and rejects exportedPDF>32MiB. Author evidence separately runs real inspectMaterial+PDF.js on two-page fixtures. No nativeJSON import into Core is asserted: the bridge is ordinary PDF material, preserving the editable native file separately.

## Scope and limitations

This is a local macOS document companion, not another Core: no account, sync, server, student model or LessonOS state. NSDocument autosavesInPlace=false and controller autosavingDelay=0 were measured. Saving is explicit; crash recovery/autosave is not provided or claimed. History is limited40operations and lives in the open document. ForceQuit/power-loss before explicitsave can lose unsaved work.

Native source targets macOS13+, uses AppKit/SwiftUI/CoreGraphics and no fetched dependency. Build is ad-hoc signed, not notarized; distribution trust on a fresh Mac is not tested here. No iPad, ApplePencil, Safari, real screen-reader or pressure tablet hardware acceptance. Author actual-app startup/save/close checks remain separate evidence. No user data or source file was modified by this review.

## Evidence

- geometry-results.json: original outside-page failure.
- geometry-fixed-lifecycle-failure.json: first corrected geometry plus original close-decision gap.
- final-results.json: final AppKit harness; superdecision interception described above.
- core-results.json, asymmetric.pdf, asymmetric-page1.png: codec and vectorPDF evidence.
- main-before.swift, main-before-lifecycle.swift, main.swift, core/main.swift, ApplicationClass.swift: executable harness sources.
- snapshot*, reviewed-final-source-hashes.json: source traceability.
