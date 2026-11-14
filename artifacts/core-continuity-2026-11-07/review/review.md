# Independent review — core continuity, audio/MCP and science

Reviewer context: `/root/core_review`, non-author, read-only by instruction (not an ACL). Base: `a4835aad79a15c13a14c10c5aa51cfda98c546b3`. Uncommitted candidate examined on 7 November 2026. Exact frozen-source SHA-256 manifest: `source-manifest.json`; raw tracked diff: `tracked.diff`; complete frozen contents including new files: `frozen-sources.txt`.

The parent allowed isolated report/reproduction files here, no shared source changes, push, cursor changes or database operations. App.tsx and RemoteWorkspace.tsx were initially inspected for the ink wiring; the parent then announced additional Knowledge routing in those two files. That later routing and CourseStudio/curriculum content are excluded from this receipt.

## Findings

### P2 — Recovery has no exclusive ownership, and uses stale UI snapshots

Relevant source: `apps/web/src/components/Board.tsx:81–90, 95–103, 240`; `packages/remote-client/src/index.ts:946–955`; `packages/remote-client/src/ink-drafts.ts:35–45`.

`inkRecovery.read()` enumerates every checkpoint in the account/workspace/lesson, without distinguishing a live writer or another recovery. Board excludes only its own `stroke.current.id`. Its recovery button later loops the previously rendered `recovered` array without rereading storage or claiming the gesture.

Two reproduced cases:

1. Two offline clients load the same interrupted checkpoint into their UI state. Client A queues it durably and removes the checkpoint. Client B then uses its stale array, as the current Board handler does, to queue the same object again. Cold recovery contains two distinct command IDs with the same object ID and expected revision. First resume succeeds; second fails `REVISION_CONFLICT`, remains pending and blocks subsequent edits. This does not duplicate a server object because Core CAS rejects it; it does duplicate the recovery operation and leaves a user-visible blocked queue.
2. In two concurrently visible clients, A is still writing a gesture and B reads its checkpoint as “interrupted”. B confirms the partial object. A appends samples and finishes, but its command fails `REVISION_CONFLICT`; the server has only the partial object. The final samples remain in the immutable pending record, so this reproduction is not evidence of irreversible byte loss. Normal retry cannot finish the original gesture once the partial object/revision has already been committed.

Reproductions, using real Core plus in-memory transport/storage only:

- `cross-tab-offline-recovery.ts`: observed two commands, one server object, one remaining pending command, `REVISION_CONFLICT`.
- `cross-tab-live-draft.ts`: observed one saved point versus two final points, final writer `REVISION_CONFLICT`, retained final pending bytes.

Correction criterion: exclusive ownership for the active gesture and recovery; reread under that exclusivity before submitting; stale or already handed-off checkpoints must produce no new command. Keep ownership through durable handoff, and do not delete a newer checkpoint after an awaited operation. Include crash/released ownership and unavailable-lock capability in the tests. A timeout lease alone can expire while a tab is suspended and recreate the race.

### P2 — Explicit finger writing cannot use the selected eraser

Relevant source: `apps/web/src/components/Board.tsx:133–146`.

After enabling “Scrivi con un dito”, choosing “Gomma a tratto” still excludes all `pointerType === 'touch'` at line 133. The touch event falls through to pan. The same user can draw using a finger but cannot erase that ink with a finger, both online and offline; the selected eraser silently performs another operation.

Reproduction: choose Penna, enable finger writing, choose Gomma, pointer-down on an ink sample with pointerType `touch`. `onErase` is called zero times; the mouse control at the same coordinates calls it once. The isolated `board-touch.test.tsx` invokes the real Board handler with hook/DOM stubs: mouse PASS, touch expected-erasure FAIL. This is a synthetic event-routing proof, not browser or hardware validation. Two initial harness attempts failed before reaching the behavior (Vitest mock import resolution, then hook alias resolution); the final harness reaches the handler and has the discriminating result.

Correction criterion: apply the explicit touch opt-in to erasing as well, retaining palm rejection when it is not enabled and when another pen gesture owns the interaction. Add an event-routing/browser case for opt-in finger erasure and the no-opt-in control.

## Other reviewed areas

No additional actionable defect identified in the frozen audio/MCP diff. Workspace-wide recording search keeps the account filter and checks each source document; the adapter requires owned scope, retains explicit configured read/write mode, validates media identity and exact revisions, and uses existing Core receipts. Transcript preview keeps the command immutable and imported; the recorded runtime test covers same-command retry and prior transcript versions. This is source review, not a fresh HTTP/PostgreSQL interoperability run.

The fifteen scientific lab definitions were checked for formula signs, units and interval assumptions, including projectile scaling, kinetic friction, hydrostatics, continuity, Poiseuille/Reynolds, gas work, calorimetry, Coulomb force units, resistor combinations, wave propagation, total internal reflection, decay/Bq and normalized EM fields. No concrete formula defect found in the stated model domains. This is technical review, not human scientific/editorial approval. Poiseuille intentionally displays the equation outside laminar validity and labels that limitation.

Creator integration imports declarative lab data through the existing schema/digest/version/lineage path. No new arbitrary HTML, URL fetch, executable bundle or implicit program execution path was identified. The workbench's experimental values are explicitly local/unsaved and its export uses the reusable template data.

## Verification and limits

- Node 24.22.1: 41 tests PASS across `ink-drafts.test.ts`, `offline-client.test.ts`, `board-geometry.test.ts`, `science/labs.test.ts`, cache disabled.
- Initial default-Node run used Node 22.22.3, outside the repository's Node 24 engine: 61 tests PASS, including the above and 20 MCP adapter tests. The adapter test file creates and tears down ephemeral loopback HTTP fixture servers; this was discovered after execution. No PostgreSQL or shared application service was started. This initial run is retained as a limitation, not substituted for supported-toolchain runtime evidence.
- Two isolated multi-client counterexamples executed successfully under Node 24.22.1 and exposed the first finding.
- Synthetic Board handler control/counterexample under Node 24: 1 PASS / 1 FAIL, exposing the second finding.
- `git diff --check` returned success at inspection.
- No browser session, production/preview access, microphone, physical Pencil/iPad/Safari test, DB integration or new native acceptance was performed by this reviewer. Parent-reported Chromium E2E passes are not reclassified as reviewer-executed evidence.
- Read root and applicable scoped AGENTS, entry/procedure material and relevant product-map/history context. The local remote-tracking cursor was read at immutable `f9fc78bace152493520701d50e4857376a34e8c0` (revision 167, no activeRun; procedure `e83c98098bb4da0324a97460776b1898b5a05ee5`). It was not fetched to claim live remote state.

Disposition: corrections and independent recheck needed for the two P2 findings. This review does not approve native behavior, external MCP hosts, deployment or milestone acceptance.
