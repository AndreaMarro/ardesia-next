# Independent review — current snapshot migration fast path

**Verdict: PASS for the isolated three-line candidate. No blocking validation bypass or wire-format semantic regression found.** This is review of a local candidate, not integration, deployment, milestone acceptance, or a browser latency claim.

Reviewer: `/root/deadline_guard`, separate from author `/root/cloud_audit`. Scope assigned by root: inspect raw diff, all productive callers, exported contract, invalid current snapshots, arrays/prototypes/version types, historical migrations and benchmark validity. Reviewer made no product-source changes.

## Exact candidate

- Raw patch: `work/import-performance-audit/candidate.patch`, SHA-256 `5f93587316ea1900d4140bee694c0491ce20699a6879a30dea69deb68cc7585f`.
- Candidate `packages/contracts/src/index.ts` (isolated at `candidate/contracts-src/index.ts`), SHA-256 `885cce9eeaff9ea0ae0b44a80a91f8e68f494a9d01a517bfc30a38128979d4ce`.
- Baseline source SHA-256 `789f4fbb35d99f631bfbd38d3ddbfe275e3722e0887fae6c97371de1c484459c`.
- Production change adds an early identity return only when an own data property `schemaVersion` equals numeric `SNAPSHOT_VERSION` (11). It does not coerce strings/boxed numbers, invoke a version getter, migrate older schemas, normalize invalid current input or assert validity.

The function is publicly exported with `unknown -> unknown`. Its existing behavior already returns current v11 input unchanged after failed legacy parses. The optimization removes those expensive failed traversals; callers remain responsible for validation. The audit bundles were compared after excluding source-location comments: their only executable difference is the new early return. Baseline/candidate bundle hashes are recorded in `countercases.json`.

## All productive callers inspected

1. `packages/core/src/index.ts:301`: still runs `CoreSnapshotSchema.safeParse`, rejects invalid input as `INVALID_SNAPSHOT`, clones parsed state, and runs `validateExtensionDefinitions`, `validateCourseHistory`, `validateTutorHistory`, `validateNotebookHistory`. Open does not write to storage.
2. `packages/server/src/store.ts:61`: still applies `CoreSnapshotSchema.safeParse` before using ownership/assignment information and before opening the Core. No transaction, binding or access checks change.
3. `packages/server/src/backup.ts:18`: the migration is a Zod preprocessor whose output is immediately parsed by `CoreSnapshotSchema`. Restore retains checksum verification of original envelope and `createCore` content-history validation.
4. `packages/server/src/legacy-import.ts:13`: only explicit v1/v2/v3 device imports are allowed, then migration and current-schema validation run. The new v11 branch is unreachable for ordinary supported imports. Original-byte archive and semantic digest logic are unchanged.

The root schema's strict shape, document/event/revision/receipt checks and superRefine remain intact. Historical v1–v10 gates—including forged new notebook/course/tutor/material/extension/feedback fields—are unchanged. Relevant current and historical tests in Core and contracts were read. Export-only consumers cannot legitimately treat the migration helper alone as a validator, before or after this patch.

## Independent executable counterchecks

Ran `compare.mjs` under Node **v24.22.1** through the shared deadline guard. Result: **56 symmetric baseline/candidate cases + 3 getter cases PASS**. Raw results in `countercases.json`.

Compared migration reference identity, complete current-schema acceptance and parsed result, createCore success/error/output, input bytes before/after, and zero writes on open. Cases include valid current data; missing/unknown fields; orphan/duplicate documents, events and receipts; revision gaps; non-JSON payload; malformed notebook/assignment state; string/fractional/future/null/undefined/boolean/nonfinite/boxed versions; valid historical v1–10; all v1–10 relabelled with current fields; primitives; decorated arrays; null prototypes; inherited schemaVersion; inherited unexpected fields; hidden version; frozen data.

Stable, changing and throwing `schemaVersion` getters preserve existing getter-read counts and returned/throw behavior because the new branch uses an own property descriptor. Arrays carrying version11 or even a full snapshot still fail the downstream object schema. Inherited version and null-prototype behavior are unchanged.

Hostile JavaScript Proxy traps are not serialized snapshot inputs; comprehensive Proxy side-effect equivalence is not asserted. The guard introduces descriptor inspection for proxies, as any reflection optimization would. No change to the JSON/JSONB storage boundary is required by this observation.

## Benchmark evidence inspected and recalculated

Read author's full `compare.mjs` and `comparison.json`; verified module hashes against bytes and recalculated medians/reduction. Fixture: C2 fluidi, 139 objects, 145 commands. One warmup per implementation plus three measured runs each, with alternating order, same Apple M4/Node24 process. Every run reopens Core before each command; checks receipts, reopening and idempotent retries. All eight final snapshot hashes match exactly.

- Baseline median: **5884.960 ms**.
- Candidate median: **4077.254 ms**.
- Measured reduction: **30.717%**.

This is a **Core + MemoryStorage import benchmark**, excluding HTTP, PostgreSQL and browser rendering. It establishes useful reduction in repeated Core-open work; it does not establish a 30.7% improvement in full user-visible import time. Reviewer reused and inspected this benchmark; did not rerun its eight timed workloads. Independent correctness checks above were newly executed.

## Integration boundary

Root should apply only the reviewed three-line delta and retain authoritative same-candidate test/Verify requirements. This review does not substitute those checks or accept future edits. Source and evidence hashes are sufficient to detect drift; rollback removes the early return without data migration, because no persisted format or bytes change.
