# Independent review — permanent native lifecycle regressions

**PASS.** Reviewer `/root/experience_review` is separate from author `/root/deadline_guard`. Reviewed raw three-file patch, runner, Swift harness, real production sources and the original RED/GREEN evidence. Independently recompiled and ran all three product variants in a separate build root. No repository source, visible UI, user application, user document, database or shared browser server was modified or controlled.

## Scope and identity

Candidate adds `script/check-lifecycle.sh`, `Tests/NotebookLifecycleChecks/main.swift`, and README usage. All other16 baseline files were independently compared byte-for-byte with the current root companion and match. Every19-file manifest entry and the three-file patch digest match the supplied manifest. Runner SHA256: `bf7ca89890bd5f046cba1ca72183ae0c217338de6399f9a45ddbc4c0869b4be0`; test source: `6c632666d57a133f7df58b09fac6ceb558254aab63c527033949fbf9fb6896be`. Patch: `58f73184b9d220444c228ce0fd27ccc41a8bc8cc492cce8b24c07a65b6a9f5ff`.

The compiler consumes the real NotebookCore, stores and views. The application subclass is extracted from the real main.swift exact prefix before the unique AppDelegate boundary. The script checks both uniqueness and the real subclass declaration; it does not provide a second mock implementation. Static extraction logic was inspected; the short-lived generated extraction had already been removed when the independent provenance collector ran, so that collector records null rather than pretending to have read it afterward.

The Swift harness invokes actual NSView/NSDocument methods with synthetic NSEvent values on a window that is not shown. It neither posts system input nor uses AppleScript/accessibility APIs. It runs the actual NSApplication event loop and real termination; the product AppDelegate/menu/activation entry point is deliberately excluded. The tests exercise native API behavior, not GUI automation or CUA. Visible save/cancel panels remain outside this regression harness.

## Meaningful assertions

Each case begins with a newly created named document and an uncommitted live first gesture. The fixture requires zero committed strokes before the tested action. After the real finishGesture commits, its production-codec bytes are captured separately as the expected result. The parent requires exactly one expected stroke, successful case exit and byte-identical saved file, preventing empty/empty or exit-only false positives.

- Save must persist the gesture and clear unautosaved changes.
- Close requires a real callback permitting close with disk equal to the document, then invokes close.
- Quit must exit via actual NSApplication. A zero process exit with an incomplete file fails independently in the parent.
- Nested Save runs inside a main-dispatch callback with a nested run loop and must complete before that loop's deadline. This specifically discriminates the DispatchQueue continuation starvation regression.

These assertions protect lifecycle persistence. They do not independently validate the drawing model/codec's mathematical correctness, which remains covered by the separate core checks and review.

## Independently reproduced RED/GREEN

Same test runner and Swift harness bytes were verified in all historical copies. All three were recompiled from their own actual product sources, using the reviewer's separate cache/build directory on Apple M4/macOS15.6.

| Product source | Result | Observed evidence |
| --- | --- | --- |
| Final autosave implementation | GREEN4/4, runner exit0 | Save/Close/Quit/Nested each process exit0 and exact one-stroke bytes |
| Original defective autosave implementation | RED0/4, runner exit1 | Save/Close/Nested process timeouts124 after12s; Quit exits0 but saved bytes differ |
| Intermediate DispatchQueue continuation | RED3/4, runner exit1 | Save/Close/Quit pass; Nested exits1 with callback timeout and saved-byte mismatch |

Raw independent results: `green.json`, `red-initial.json`, `red-dispatch.json`. The author's evidence hashes were also checked and match, but the final review does not rely only on those reports.

## Cleanup and isolation

The runner uses TemporaryDirectory beneath an explicit external build root, with separate new case directories. Compilation/test commands use argument arrays, no shell interpolation. Each spawned compiler/test owns a new process group. Compilation timeout is180s, case timeout12s. Timeout/interruption cleanup targets only that child's group, escalates TERM→KILL after2s if needed, and waits for exit; there is no kill-by-name or operation on the user's companion.

The independent original-RED run exercised three actual timeout cleanups. Final filesystem/process observation found no lifecycle fixture directory and no live owned LifecycleChecks process. Only the explicitly reusable Swift module cache remains. SIGINT/TERM/HUP handlers and exception cleanup were source-reviewed; this review did not separately inject every signal, and hard-killing the parent cannot guarantee Python cleanup. The candidate report already distinguishes that limit.

No blocker found. This suite is a manually invoked macOS regression command documented in README, not evidence of Linux CI execution, periodic-autosave timing, unnamed-document prompts, crash recovery, pressure hardware, old-macOS or notarization qualification.

## Evidence

`production-identity.json`:16 exact baseline comparisons. `provenance.json`: manifest and evidence hashes. `green.json`, `red-initial.json`, `red-dispatch.json`: independent result matrices. `final-state.json`: no owned fixture/process leftovers. All source paths outside this review directory were read-only.
