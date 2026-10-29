# Remote client

- Own only the browser transport and a disposable authorized read projection.
- Never instantiate Core, apply domain commands locally, or expose a server snapshot.
- Server identity comes from its verified cookie session; the account header is only a mismatch precondition.
- Pending commands are immutable, account-scoped recovery records, never confirmed data.
- Retry the same command ID and payload after an unknown outcome.
- Invalidate responses on account changes and refuse decreasing workspace revisions.
- All domain imports use public package exports; no server, database or authentication SDK in this package.
