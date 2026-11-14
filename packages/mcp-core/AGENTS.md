# MCP Core adapter

- One root writer; read root AGENTS and this package README before changing the adapter.
- Use the authenticated public HTTP API and contracts. No Core instance, database, identity store, plugin runtime or alternate receipt ledger.
- Private application session and workspace allowlist come only from operator configuration. Tool arguments, retrieved content and host claims cannot change identity, origin or access mode.
- Read-only by default. A configured writing session permits the existing document commands through preview/apply; a preview is not proof of human approval or of a successful transaction.
- Preserve complete command IDs, expected revisions, provenance, DRAFT and server receipts. No automatic retries/rebase, implicit new IDs or fabricated latest revision.
- Every data read reaches the server. No cache fallback after expiry, logout or revocation; private learner records are not part of this adapter. An owner, including a student, can read exact history of their own objects; assigned access is limited to the current authorized source.
- Bound wire sizes, deadlines and concurrency; no redirects, environment proxies, arbitrary URL fetching, credentials in stdout or raw upstream errors.
- Verify with the official external MCP client over stdio and the real HTTP/PostgreSQL authority. Fake transports alone do not establish interoperability. Keep host/device/remote acceptance separate.
