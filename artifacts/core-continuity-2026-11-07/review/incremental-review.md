# Independent incremental review — continuity fixes, Knowledge, courses, Tutor

Reviewer: `/root/core_review`, independent non-author. This is a read-only recheck requested by `/root`, following the initial `review.md`; that earlier report and its failing counterexamples remain intact. Base commit: `a4835aad79a15c13a14c10c5aa51cfda98c546b3`. Candidate is uncommitted; this review is tied to bytes, not a claimed new commit.

## Disposition

No unresolved actionable finding in the reviewed incremental scope. The reproduced ink ownership/cleanup/handoff, touch eraser, second concept-link and late course-question receipt defects are closed on the captured candidate, within the evidence limits below. The answer-prefix length correction is also consistent with the 10,000-character command contract. This is not native/device, external MCP host, deployment, milestone, or human educational approval.

## Source identity and scope

Frozen at 2026-11-07T21:38:10.654850+00:00. `incremental-source-manifest.json` records 78 dirty candidate files, SHA-256 c7459c358671af9ce0b946bf2481bf2820925de994ea24388e1b6208446a325f. `incremental-frozen-sources.txt` contains their complete contents, including new files; `incremental-tracked.diff` contains the raw tracked diff. Whole dirty-candidate capture supplies identity, not an assertion that every captured line received a full review. A final comparison found zero changed hashes and zero new dirty paths since capture.

Reviewed increment:

- Board/Remote Client ink checkpoint ownership, lock lifetime, cleanup, recovery and durable handoff; touch eraser; offline integration.
- Knowledge definition, authorized derived graph, search, UI connection path and App/RemoteWorkspace routing.
- Physics import/resume, catalog/material question UI, CourseStudio provenance context and answer limit; packaged asset contract/digest/provenance validation.
- Optional Tutor cost/preparation contracts and editor, pure economics projection and UI, Core history/receipt compatibility, snapshot migration 9→10 and server migration registration/SQL.

The initial MCP/audio, Creator and science source files remain byte-identical to the initial report, including `packages/mcp-core/src/{adapter,index}.ts`, server recording/request adapters, `Creator.tsx`, and the science workbench/model definitions. The earlier bounded source conclusions therefore remain applicable. No new MCP/runtime run was performed here. Initial Node 22/ephemeral HTTP-fixture limitations remain recorded in the first report and are not silently relabeled as supported-toolchain evidence.

## Reproductions and closure

1. **Multi-tab live/stale ink recovery.** Storage now holds a Web Lock for a live gesture, uses `ifAvailable` for recovery, rereads under the lock and removes only the unchanged recovered bytes after successful handoff. A stale recovery list cannot submit a second command after removal. Six storage tests include live-writer exclusion, two stale consumers, incomplete recovery retention and explicit unavailable-lock export behavior. Source review confirms quota failure no longer releases live ownership. These are deterministic lock-model tests, not a native-browser scheduling proof.
2. **Touch eraser.** The explicit finger-writing opt-in now governs erasing. Actual Board handler harness passes both mouse and opted-in touch cases; no DOM/browser or physical pen was involved. Source retains rejection of non-opted-in touch and competing pointers while a pen owns the gesture.
3. **Cleanup after authorization invalidation.** Board retains the `InkDraftAccess` handle on the active Stroke; cleanup uses that handle and releases listeners/timer in `finally`. `board-invalidated-cleanup.test.tsx` passes with the recovery factory rejecting after pen-down: no throw and one release. The old failure was `OFFLINE_UNAVAILABLE` with zero releases.
4. **Lost HTTP response at durable handoff.** `InkDraftAccess.release` removes an exact checkpoint only when it matches authorized committed data or a durable immutable pending command, before unlocking. It releases without requiring fresh authorization if revocation intervenes. `uncertain-handoff-fixed.ts` uses real Core, fake fetch, shared browser-storage model and TestLocks: first client `NETWORK_ERROR`, one durable original pending command; second client submits zero commands and has zero pending; server retains one object. The original `uncertain-handoff-lock.ts` remains as the pre-fix defect assertion.
5. **Second distinct Knowledge link.** Definition initial fields/fallback now remain constant for type/version `ardesia.knowledge.link`/1; endpoints are instance state. `knowledge-two-links-fixed.ts` uses real Core: a→b and a→c both commit, leaving two link objects. The old second add returned `INVALID_REFERENCE`. Graph tests also verify two links and unresolved unauthorized/exact-revision endpoints.
6. **Late question receipt after remote unit change.** Question selection is stored with object, unit identity/revision and lesson revision and is derived only for the displayed matching unit. The actual CourseStudio handler harness changes work from A/doc revision8 to B/doc revision14 before A's delayed receipt: the saved B answer no longer includes the crossed `question-a r1 · lezione r14` reference. Explicit phase navigation clears selection. The prefixed reference is reserved from textarea `maxLength` and the save condition, preserving the command's 10,000-character total limit.

Original repros are retained; corrected-outcome scripts are separate. Earlier mock-resolution and JSX-hook harness setup failures occurred before the product behavior and are not counted as product defects. The CourseStudio case previously reached the handler and captured the crossed-reference command; its current pass is a discriminating recheck.

## Import and Tutor observations

`import-resume.ts` passed with the complete packaged Thermodynamics course and real in-memory Core: five documents, interrupt after seven committed writes, refusal while the simulated pending barrier is unresolved, retry of the same Core command/receipt, successful completion, and a second full import with no mutation. The narrow Remote Client façade simulates pending state; this is not a full HTTP/offline recovery or PostgreSQL transport test.

The economics projection derives only from authorized current Tutor records. Package cents use BigInt and stable cumulative rounding; completed attendance consumes package minutes, group time/cost/preparation count once, currencies remain separate, and cash receipts remain distinct from earned revenue. Current package revisions deliberately recompute allocation, and the UI explains that current-revision basis. Missing cost/preparation inputs remain absent in persisted commands and are explicitly shown as zero assumptions in the projection. Core's existing whole-minute appointment contract and reference/balance checks justify the projection's time/ownership assumptions. No concrete arithmetic or authority defect found.

The golden v9 fixture opens as v10 without writing storage or altering historical commands/receipt fingerprints. Re-executing its historical command returns the original receipt; a new cost/preparation command persists via the existing atomic Core path and reopens exactly. Relabeled v8/v9 snapshots containing new economics fields reject without replacing bytes. Server migration 008 extends the existing check to snapshot10 while retaining4–9; the runner registers it as DB migration8 and leaves old rows/events/receipts unchanged. This SQL/runner conclusion is source review only; no reviewer DB migration was executed.

## Reviewer-executed verification

Toolchain: Node 24.22.1, Vitest 5.0.5, cache disabled. Tests invoked directly to avoid application/DB service scripts.

- 40 PASS: offline-client25, ink-drafts6, board-geometry7, Knowledge graph1, physics asset validation1.
- 34 PASS: Tutor Core12, Tutor economics7, contracts JSON8, Tutor values4, Tutor compatibility3.
- 4 PASS in external synthetic handler config: Board touch2, invalidated cleanup1, course question race1.
- 3 standalone Core-based scripts PASS: uncertain handoff, two Knowledge links, resumable Thermodynamics import. Experimental Node loader warnings are present and not test failures.
- `git diff --check` PASS. Final captured-source hash comparison PASS.

Total: 78 Vitest assertions/cases passed across13 files, plus3 standalone scenarios. These numbers exclude the earlier initial-review runs and parent-executed E2E. The parent reported running browser E2E; that is separate evidence and was not executed or certified by this reviewer.

No shared source edits, push, cursor writes, database operation, browser/native run, microphone/physical Pencil/iPad/Safari interaction, deployed service access, scientific human approval or acceptance promotion was performed. Only reviewer artifacts under the authorized sibling `work/core-review/` were created.
