# Remote client

`@ardesia/remote-client` provides the browser transport for the server authority introduced in PR1. Its `core` property implements the public `CoreService` interface with synchronous reads from an authorized projection and asynchronous commands sent to the server. It imports `CoreService` as a type and never instantiates or executes a second Core.

The web application uses this facade for authenticated reads and writes. Integration tests and local browser tests do not establish remote M3 acceptance: that still requires the original evidence gate on the observed deployment and database.

## Session and projection

Create a client with `createRemoteClient()`. The default endpoint is `/api/m3`; requests use the same origin and cookie credentials. `login(username, password)` and `session()` obtain the verified account from the server. Passwords and session tokens are not placed in recovery storage.

Authenticated requests send `X-Ardesia-Account` as an equality precondition against the cookie session. The header does not grant an identity or a role. Domain requests contain a command and workspace ID, not a browser-selected actor. Use `client.projection.actor` when calling the Core facade: an account's explicitly imported workspace can retain its historical Core actor through the server's ownership binding.

`listWorkspaces()`, `openWorkspace(id)` and `refresh()` fetch authorized data. Projection validation checks the role, owner, assignment and sharing relationships before publishing it. The server supplies `access: owner | assigned` independently of role. Owned documents/installations and course drafts belong to the bound actor, including a student owner with an imported alias. Assigned projections contain only assigned lessons and that student's authorized work; clients cannot promote access through input. Teacher access to learner work requires an active assignment and explicit evidence sharing.

The online projection is disposable confirmed data held in memory. The separately prepared offline reading copy described below is never restored as this projection or as a session. Reads return copies, and `client.state` is an immutable subscription snapshot. `subscribe(listener)` supports UI updates. A later response cannot lower the workspace revision; session and selection epochs discard responses belonging to an account or workspace selection the user has left. An observed session change or workspace access revocation removes the corresponding visible data. Consumers still need to call `refresh()` to observe server changes.

## Commands and uncertain outcomes

`core.execute`, `core.executePlugin` and `core.executeLearning` validate and send their respective public commands. The caller supplies the expected revision and command ID. The client does not change the confirmed projection until the server returns a valid receipt and projection.

Before sending, the client stores an immutable recovery request scoped to the authenticated account. The browser adapter uses keys under `ardesia-next.pending.v1.`. These records contain pending commands, including their content, rather than an authoritative workspace snapshot. If durable storage cannot be accessed, recovery is explicitly reported as memory-only. If an available durable store rejects a write, the new command is not sent.

A timeout, lost response or invalid confirmation leaves the outcome uncertain. `retryPending(commandId)` sends the exact original ID and payload so that server idempotency can recover the original receipt. A revision conflict remains recoverable with its original expected revision; the client never silently rebases a command. Another mutation in that workspace is refused until the pending request is resolved or explicitly discarded.

Recovery is restored after authentication without automatically retrying. `exportPendingRecovery()` returns the account's recovery records, retaining original bytes inside an exportable envelope if individual storage rows are corrupt. Invalid records are retained, and new writes remain blocked until the user explicitly calls `discardInvalidRecovery()`. `discardPending(id)` cannot remove an in-flight request. Logout clears the visible session and projection while keeping recovery isolated by account.

The browser adapter stores one value per command at `ardesia-next.pending.v1.<encoded-account>/<encoded-command>`. Each client has its own adapter and updates only changed records; cleanup never removes another tab's newly created IDs. A validated read establishes the normalized baseline, while export is read-only and cannot authorize cleanup. Recovery follows predecessor dependencies rather than relying on localStorage enumeration order. The older per-account array remains readable and is never rewritten during ordinary saves; per-ID tombstones suppress confirmed or explicitly discarded legacy records without modifying that array. Custom `PendingStorage` adapters must provide their own concurrency guarantees; the simple in-memory test adapter is a single-client fixture.

## Queued editor intents

`client.edit(actor, documentId, input, base?)` is the editor's write entry point. It captures the actor, account, workspace, command ID, payload and optional object base before waiting. Its requests share the existing pending Map and account-scoped recovery storage; `apps/web` has no separate write queue or confirmed-data store. The Core service, server commands and plugin contracts are unchanged.

An intent reserves its expected document revision when it enters the sequence. Only a positive, matching predecessor receipt releases its dependency. Before first dispatch, the client checks the original session/selection, actor, optional object base and reserved revision. A refreshed projection cannot rebase the intent. Rejection, conflict, lost response, logout or workspace change stops automatic dispatch of all following intents.

Recovery entries distinguish `queued` (waiting for an automatic acknowledgement), `blocked` (never sent; explicit action required), `pending` (in flight), and the existing uncertain/conflict/rejected outcomes. New editor entries use version 2 in the existing recovery namespace; the reader remains compatible with version 1 and the legacy array. Reload converts queued entries to blocked, without dispatching them. Older clients cannot read the new per-command keys: code rollback requires a compatible reader or completed recovery/export before changing clients. Do not delete those keys or rely on an old client's empty pending list as proof that all drafts were confirmed.

`retryPending(id)` recovers a request already attempted, with its unchanged command ID, account and payload. It does not restart stopped successors. `resumePending(id)` explicitly attempts one never-sent intent, keeping its original command ID and expected revision. The predecessor must have been confirmed. Discarding a predecessor does not release its successors: export those drafts for manual reconciliation with the lesson, then explicitly discard the old intents. Neither action performs a silent merge or rebase.

If recovery persistence fails, editor intents remain blocked and exportable using the existing account-scoped memory fallback. This fallback survives logout/login in the same client, takes precedence over stale durable bytes, and is reported as `recovery: 'memory'`; it does not survive closing or reloading the page. The UI asks for an export before closing. A successful later persistence clears the memory override. Aggregate confirmation requires an empty pending set, including after refresh, rejected requests or a predecessor's successful retry.

## Explicit own-lesson offline copy

`makeAvailableOffline()` persists a versioned, reduced reading copy of the account's own documents in IndexedDB; the web consumer first verifies its complete static service-worker shell. No credentials, authorizations, installations, assignments, learner data or events enter that copy. It preserves original object identity, revisions and provenance. See [ADR0010](../../docs/adr/0010-own-lessons-offline.md).

`openOffline()` exposes `client.offline` with `status: offline`; `account` and `projection` stay null. `queueOfflineInk(documentId, ink)` persists an immutable blocked command in the existing account-scoped recovery and returns `kind: queued`. All server facade operations still require a verified session. The UI shows pending ink separately and keeps laboratory cards inert.

`reconnect()` drains captured local ink, then verifies the server session and original workspace/actor before dispatch is possible. It does not send pending commands; explicit retry/resume retains their IDs, CAS and predecessors. A confirmed server mutation updates the authorized offline copy before recovery cleanup. Failed cache persistence retains the original command across cold boot. Opening and first preparation recheck the complete write chain after reading, including epoch/selection immediately before publication.

The IndexedDB gate serializes generation, identity, role, logout and active workspace across tabs. Observed401/403/404 disables fallback. An explicit offline logout prevents automatic cookie-session restoration on reload until a fresh login; it retains recovery bytes. If local logout persistence fails, the client still attempts remote logout and reports the local failure. Remote revocation cannot be observed while disconnected.

One offline workspace is active at a time. Copy availability requires supported, writable browser storage; eviction, profile deletion and hardware power loss are not guaranteed against. A failed pending write stays explicitly memory-only and exportable. Neither corrupt copy nor recovery is silently overwritten. The static shell excludes APIs and plugin data; a new build must install completely with matching content hashes before replacing the previous shell.

## Import and export

`exportPersonal()` requests the server's `ardesia-personal-v1` export and validates its account, workspace and projection. The facade's `snapshot()` deliberately refuses administrative snapshot export. Personal exports contain only authorized projected data; they are not server backups or an automatic round-trip import format.

`importLocal(...)` forwards an explicit legacy snapshot import, including `expectedAccountId`, to the server. It does not migrate or claim ownership in the browser. The server remains responsible for legacy validation, ownership binding, original-byte preservation and plugin consent withdrawal.

## Verification and limits

Transport tests cover immutable retries after lost responses, revision and selection ordering, identity changes, private-data rejection, storage failures, corrupt recovery, session expiry, import binding, access revocation and account-scoped memory recovery. Editor tests use the real Core behind a controlled transport, including competing commits, preserved receipts, queued payloads, session changes and recovery storage failures. Browser queue tests exercise the actual local PostgreSQL handler, retain an acknowledgement or lose its response after commit, and verify reload and explicit recovery.

Run the package checks from the repository root:

```sh
npx vitest run packages/remote-client/src/client.test.ts
npx vitest run apps/web/src/workspace*.test.ts
npm run typecheck
npm run check:boundaries
```

The repository verification also runs the Core and server suites, including the PostgreSQL integration tests when `M3_TEST_DATABASE_URL` names the dedicated test database. These client unit tests do not establish deployed authentication, cross-device continuity or remote M3 acceptance. The package provides the explicit prepared own-lesson copy above, without collaboration merge, general offline domain execution or background retry.

Course recovery uses the existing immutable pending envelope and server receipt. `subscribeReceipts` notifies transient UI after confirmation, including explicit retry; it adds no durable cache. The editor keeps the acknowledged input/revision as its base, even when the response projection is newer. An observed course refusal redacts disposable materials/shared evidence, preserving own exports. Late responses from other domains cannot restore invalidated course data. Course content and work are not copied into the own-lesson offline snapshot.

## Materiali originali

`materials()` carica/legge originali immutabili con hash di manifest/chunk/file; conserva bozza e ID pagina nell’IndexedDB esistente prima dell’upload. Reload riprende il medesimo intento. Abbandono esplicito cancella solo la bozza corrispondente, dopo possibilità di scaricare il file. `offlineMaterials()` legge solo gli originali riferiti dalla copia personale e dal gate/account correnti. La nuova revisione offline diventa durevole solo dopo tutti i byte; quota/guasto conserva snapshot precedente e recovery. Nessun secondo Core. [ADR0020](../../docs/adr/0020-original-materials.md).
