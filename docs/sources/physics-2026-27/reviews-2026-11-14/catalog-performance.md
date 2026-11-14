# Independent review — PhysicsCatalog render projections

**PASS.** Reviewer `/root/experience_review` is not the change author. Scope is the small `PhysicsCatalog.tsx` diff which reads actor, courseSpace and pending state once per synchronous render, then shares those values across five cards. No repository file was modified by the review.

Read real RemoteClient getters: `projection` returns a defensive clone; `getCourseSpace(actor)` still runs `requireActor` and returns a defensive clone. The optimization keeps both calls and introduces no persistence, memo, cross-render cache, authority change or validation bypass. `personalPhysicsDelivery` only searches the supplied space. JavaScript cannot interleave account/revocation callbacks inside this synchronous component invocation, so sharing one snapshot within it preserves the existing display semantics.

Reviewed refresh path: RemoteWorkspace uses `useSyncExternalStore(client.subscribe, () => client.state)`. CourseStudio/PhysicsCatalog are not memoized here; the account/workspace provider keys remain unchanged. Subsequent renders reread the current actor, authorized space and pending state. Null projection behavior is not newly broadened: parent availability guards remain as before, and the old component also dereferenced actor while rendering its fixed five entries.

An independent semantic harness compiles the real before/after TypeScript sources, with explicit mocked React hooks/JSX and cloned client data. It compares identical render trees for active delivery, revoked delivery, pending recovery and a changed account. Read counts per render are projection15→1, courseSpace10→1, state10→1. These are call counts from a controlled harness, not application latency or allocation benchmarks. Sources and hashes are frozen in `source-before.tsx`, `source-after.tsx` and `source-identity.json`.

The mutation handler is unchanged and keeps its own fresh reads. A retained click handler from the previous render was invoked after changing the mock account and course; it obtains the new actor/course at click time and passes that course to `onImported`. No render-captured actor or space is used for the authority-sensitive action.

Evidence: `check.cjs`, `results.json`. This is a source/semantic review with mocks, not real DOM, account-server or browser acceptance. Root's existing end-to-end regression and before/after browser measurements remain separate. No new performance percentage is inferred here. Rollback is the narrow JSX/local-variable diff; no data migration is involved.
