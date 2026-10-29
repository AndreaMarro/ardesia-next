# Remote client

`@ardesia/remote-client` provides the browser transport for the server authority introduced in PR1. Its `core` property implements the public `CoreService` interface with synchronous reads from an authorized projection and asynchronous commands sent to the server. It imports `CoreService` as a type and never instantiates or executes a second Core.

This package is staged independently of its web integration. The existing web application and its 51 browser scenarios continue to use their existing local consumer in this PR. Application login, remote editor integration and end-to-end M3 acceptance belong to the subsequent integration work.

## Session and projection

Create a client with `createRemoteClient()`. The default endpoint is `/api/m3`; requests use the same origin and cookie credentials. `login(username, password)` and `session()` obtain the verified account from the server. Passwords and session tokens are not placed in recovery storage.

Authenticated requests send `X-Ardesia-Account` as an equality precondition against the cookie session. The header does not grant an identity or a role. Domain requests contain a command and workspace ID, not a browser-selected actor. Use `client.projection.actor` when calling the Core facade: a teacher's explicitly imported workspace can retain its historical Core actor through the server's ownership binding.

`listWorkspaces()`, `openWorkspace(id)` and `refresh()` fetch authorized data. Projection validation checks the role, owner, assignment and sharing relationships before publishing it. Teacher documents and installations belong to the bound teacher; student projections contain assigned lessons and that student's own work. Teacher access to learner work requires an active assignment and explicit evidence sharing.

The projection is disposable confirmed data held in memory. Reads return copies, and `client.state` is an immutable subscription snapshot. `subscribe(listener)` supports UI updates. A later response cannot lower the workspace revision; session and selection epochs discard responses belonging to an account or workspace selection the user has left. An observed session change or workspace access revocation removes the corresponding visible data. Consumers still need to call `refresh()` to observe server changes.

## Commands and uncertain outcomes

`core.execute`, `core.executePlugin` and `core.executeLearning` validate and send their respective public commands. The caller supplies the expected revision and command ID. The client does not change the confirmed projection until the server returns a valid receipt and projection.

Before sending, the client stores an immutable recovery request scoped to the authenticated account. The browser adapter uses keys under `ardesia-next.pending.v1.`. These records contain pending commands, including their content, rather than an authoritative workspace snapshot. If durable storage cannot be accessed, recovery is explicitly reported as memory-only. If an available durable store rejects a write, the new command is not sent.

A timeout, lost response or invalid confirmation leaves the outcome uncertain. `retryPending(commandId)` sends the exact original ID and payload so that server idempotency can recover the original receipt. A revision conflict remains recoverable with its original expected revision; the client never silently rebases a command. Another mutation in that workspace is refused until the pending request is resolved or explicitly discarded.

Recovery is restored after authentication without automatically retrying. `exportPendingRecovery()` returns the account's original recovery bytes. Invalid records are retained, and new writes remain blocked until the user explicitly calls `discardInvalidRecovery()`. `discardPending(id)` cannot remove an in-flight request. Logout clears the visible session and projection while keeping recovery isolated by account.

## Import and export

`exportPersonal()` requests the server's `ardesia-personal-v1` export and validates its account, workspace and projection. The facade's `snapshot()` deliberately refuses administrative snapshot export. Personal exports contain only authorized projected data; they are not server backups or an automatic round-trip import format.

`importLocal(...)` forwards an explicit legacy snapshot import, including `expectedAccountId`, to the server. It does not migrate or claim ownership in the browser. The server remains responsible for legacy validation, ownership binding, original-byte preservation and plugin consent withdrawal.

## Verification and limits

The package has 23 transport unit tests using controlled responses and deferred requests. They cover immutable retries after lost responses, revision and selection ordering, identity changes, private-data rejection, storage failures, corrupt recovery, session expiry, import binding, access revocation and account-scoped memory recovery.

Run the package checks from the repository root:

```sh
npx vitest run packages/remote-client/src/client.test.ts
npm run typecheck
npm run check:boundaries
```

The repository verification also runs the Core and server suites, including the PostgreSQL integration tests when `M3_TEST_DATABASE_URL` names the dedicated test database. These client unit tests do not establish deployed authentication, cross-device continuity or remote M3 acceptance. The package provides no automatic offline save, collaboration merge or background retry.
