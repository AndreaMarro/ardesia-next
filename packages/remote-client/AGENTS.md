# Remote client

- Own the browser transport, disposable authorized projection and explicitly prepared own-lesson reading copy (ADR0010).
- Offline copies never restore a session, role authority, grants, plugin execution or learner data. Keep `offline` separate from `projection` and `account`.
- Persist an updated authorized copy before removing acknowledged recovery. Failures must retain the original command; transitions must drain concurrent writes.
- Never instantiate Core, apply domain commands locally, or expose a server snapshot.
- Server identity comes from its verified cookie session; the account header is only a mismatch precondition.
- Pending commands are immutable, account-scoped recovery records, never confirmed data.
- Retry the same command ID and payload after an unknown outcome.
- Invalidate responses on account changes and refuse decreasing workspace revisions.
- All domain imports use public package exports; no server, database or authentication SDK in this package.
