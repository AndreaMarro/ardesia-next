# Independent native autosave review

Result: PASS on final source snapshot after fixing two lifecycle defects and a first-fix modal-loop regression. No reviewer changes to candidate or root sources. The review used isolated builds, AppKit/NSEvent harnesses and scratch files only; the AppKit interop skill informed lifecycle analysis.

Reviewed final source hashes are in final-source-hashes.json. Key files: NotebookDocument.swift 3c1c82b3172f027e5c7deda01bdbc3005921be5dd882b9696a63247aefb03e55; App/main.swift 3cdef91960ba1329f3ed83e97e3119ca7ff177581c808cc1d3ced1371472d421. Core model, codec, PDF and ink geometry remain byte-identical to the previously reviewed baseline. Frozen final source is in snapshot-final/.

## Findings closed

1. **P1: first live gesture lost at actual application termination.** The first candidate enabled autosave safety checks, which deferred native dirty-state updates. The application flushed the first live stroke but immediately entered superclass termination; the named document still appeared clean and the process exited 0 with zero persisted strokes. The expected model had one stroke. Reproducer real-quit/main.swift executes the actual NSApplication termination, without swizzling that method; original result in real-quit-results.json. Final result: exit 0 and the named file exactly equals the one-stroke expected model.
2. **P1: canClose blocked on native serialization semaphore.** Flushing the first live gesture immediately before synchronous canClose entered an AppKit activity wait before its safety activity could complete. This reproduced under NSApplication.run as well as a simpler harness. Original stack samples and control are retained. Final real close receives callback shouldClose=true without hanging, and persists the exact one-stroke model. Explicit Save on the same first-live-gesture boundary also passes.
3. **First-fix regression: dispatch-main continuation starved during a modal runloop.** The author observed untitled Quit without a prompt or exit. Independent no-UI nested-loop reproducer confirms the DispatchQueue.main continuation does not run while the calling main-queue block hosts a nested runloop (nested-loop-firstfix-results.json). The final implementation uses NSDocument.continueAsynchronousWorkOnMainThread after the native activity completes. This final continuation executes in the same nested-loop reproducer. The author's final CUA separately confirms untitled edit → Quit prompt → Cancel → Quit prompt again → Cancel → Close prompt → Save, two pages saved, then application exit.

The correction queues save, save-as and close behind completion of native safety/change-count activity and waits for all documents before superclass termination. It does not manually reset change counts, pump a product runloop, add arbitrary timers, create a parallel recovery archive or bypass NSDocument safe-write.

## Final verification

final-results.json records six executable suites, all exit 0:

- Native continuation inside a nested loop hosted by main dispatch resumes correctly.
- Actual named canClose, actual NSApplication terminate and actual named Save immediately after the first live stroke preserve an exact one-stroke model.
- Interception of superclass boundaries observes strokeCount=1 and edited/unautosaved=true for untitled close, named close and two sequential termination attempts. These intercepted checks are distinguished from the actual lifecycle tests above.
- The author's six-case regression harness was independently rebuilt and rerun against the frozen final sources. Named autosave/undo/redo preserve exact model values; untitled documents remain dirty with no autosave archive; periodic autosave during a held pointer preserves one continuous four-point gesture and one undo; a real EACCES writer failure preserves dirty state, in-memory changes and original bytes; restoring permissions allows successful retry; the real native periodic scheduler writes the named file (about 14.99 seconds in this run).

Author CUA evidence is work/native-autosave-build/cua-final-lifecycle.json, actual bundle build.DsFDik. Earlier author two-stroke autosave plus process-kill/reopen evidence establishes persistence of the last successful write; it does not establish recovery of changes that were never written. The reviewer did not perform those CUA interactions. Reviewer CUA only inspected application inventory while diagnosing the blocked synthetic process.

## Honest scope

Autosave is limited to documents already saved to a user-chosen named path. Native draft autosaving and version history are disabled. The configured delay is a minimum scheduling preference, not a guarantee that every change reaches disk within 15 seconds. A held gesture is excluded from periodic snapshots until released; explicit Save/close/quit include it. Unsaved unnamed drafts and changes since the last successful write can be lost on forced termination. Undo history does not survive restart. README describes these limitations and the changed named-document close behavior. No cloud sync, iPad/Pencil, notarization or universal crash recovery is claimed.

No review process remains running. Candidate source approval applies to the exact hashes above; release manifest must be regenerated to match the final native-continuation correction (the first-fix manifest still had e93d9477 when checked, and the author was notified).
