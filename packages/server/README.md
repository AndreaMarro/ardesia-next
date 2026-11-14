# M3 server adapter

`@ardesia/server` composes the existing Core with PostgreSQL transactions and
application authentication. Every confirmed workspace is one Core snapshot in
one database row. The browser receives permission-filtered projections, never
the administration snapshot. The package has no memory or disk fallback for
remote data.

## Public composition

```ts
import {
  createDatabasePool, createFirstPartyPolicy, createPostgresStore,
  createApiHandler,
} from '@ardesia/server';

const pool = createDatabasePool(process.env.ARDESIA_DATABASE_URL!);
const pluginPolicy = createFirstPartyPolicy({artifactRoot: '/reviewed/public'});
const store = createPostgresStore({pool, pluginPolicy});
export const handler = createApiHandler({
  store,
  allowedOrigins: ['https://the-exact-protected-preview.vercel.app'],
});
```

Non-loopback database connections require certificate-verified TLS. Explicit downgrade settings and custom hostname-verification callbacks are rejected; configure the provider CA when needed. Loopback-only test connections can use plaintext.

The configured `artifactRoot` contains the reviewed `plugins/` directory, catalog,
revocations, manifest and unchanged signed worker. The existing Plugin Host
verifies its SHA-256, Ed25519 signature, pinned release and public trust store.
Scientific state is evaluated by that worker in a bounded Node worker thread;
the model is not reimplemented. Third-party bundles and undeclared transitions
remain forbidden.

Missing configuration must compose `createApiHandler({store: null, ...})`. Health
then returns HTTP 503 with `configured: false`; every command fails closed.
Deployment protection remains separate from the application cookie.

Configured connections are ready only when every recorded migration and digest
matches the canonical SQL registry shipped in the server. Missing, unreadable,
changed or newer migration metadata returns HTTP 503 `SERVICE_UPGRADE_REQUIRED`;
health, login and authenticated workspace operations never migrate the database.
The check is repeated inside each data transaction under the shared form of the
operator's migration lock. Origin, strict request validation and unauthenticated
rejections retain their existing order. Connectivity failures remain generic.
Authenticated logout still revokes its session and expires the cookie during an
upgrade; it uses the original session contract and grants no data access.

SQL010 grants the runtime only `SELECT(version,digest)` on `schema_migrations`.
It changes no workspace, account or credential and grants no migration writes.
Run the canonical operator migration explicitly before deploying this server.
A successful health result attests the migration registry and database access;
it does not replace a login, save/reopen or product acceptance test.

## Database provisioning and migrations

Only use a **dedicated Next database**. `migrate(pool)` is an explicit operator
operation; it refuses recognizable legacy `public.study_*` databases. It applies
the checked-in SQL transactionally, records its digest and refuses migration
drift. No request handler invokes migrations or account provisioning.

The migration creates the private `ardesia_next` schema and a non-login group
`ardesia_next_runtime`. Provision a separate PostgreSQL login with membership in
this group and use that login for the server DSN. Keep the migration owner DSN
outside the application runtime. The group cannot create tables, provision
accounts, alter credentials/roles or disable accounts. Its only account UPDATE
privilege is `last_login_at`; PostgreSQL requires a column UPDATE privilege for
the account row locks used during authentication.

`provisionTestAccounts(operatorPool, [{id?, username, displayName, role, password}])`
creates synthetic application accounts. It never silently overwrites an existing
username. Passwords require 16–256 characters and are stored with scrypt
N=131072/r=8/p=1, random 128-bit salt and a 512-bit result. The HTTP API has no
signup, password-provisioning or role-selection action.

`revokeAccountSessions(operatorPool, accountId)` revokes all application sessions
for an account. Operator account disable/credential changes require a separate
explicit maintenance operation; there is no administrative browser endpoint.

## HTTP contract

One same-origin JSON endpoint: `POST /api/m3`.

- Success: `{ok: true, result}`.
- Failure: `{ok: false, error: {code, message}}`, with a matching HTTP status.
- Every POST requires the exact configured `Origin` and `application/json`.
- Every authenticated action except session discovery requires
  `X-Ardesia-Account: <account.id>`. This is an equality precondition against the
  verified cookie identity, never an identity selector. A stale tab after an
  account switch receives `SESSION_CHANGED`.
- Session cookies are opaque 256-bit tokens: `__Host-ardesia_session`, HttpOnly,
  Secure, SameSite=Strict, Path=/, expiry eight hours by default. Only token hashes
  are stored. Loopback development can explicitly use `secureCookies: false` and
  the separate `ardesia_dev_session` name.
- Unknown request fields and client-supplied actor/role/owner fields are rejected.
- Responses are private/no-store; driver errors, SQL, credentials and stacks are
  never returned.

| Action | Additional fields | Result |
| --- | --- | --- |
| `login` | `username`, `password` | `{account: {id, role, displayName}, expiresAt}` and session cookie |
| `session` | none | Verified account and expiry |
| `logout` | none | `{signedOut: true}` and cookie deletion |
| `list-workspaces` | none | Authorized `{workspaceId, title, workspaceRevision}[]` |
| `create-workspace` | `commandId`, `title` | Empty owned workspace projection; either account role |
| `open-workspace` | `workspaceId` | Authorized projection |
| `command` | `workspaceId`, `command` | `{receipt, projection}` using `Core.execute` |
| `plugin-command` | `workspaceId`, `command` | `{receipt, projection}` using `Core.executePlugin` |
| `learning-command` | `workspaceId`, `command` | `{receipt, projection}` using `Core.executeLearning` |
| `read-attempt-source` | `workspaceId`, `documentId`, `attemptId`, optional `studentId` | Exact object revision referenced by an authorized attempt; no general student history access |
| `import-local` | `expectedAccountId`, `commandId`, `title`, `snapshotText` | New owned workspace projection; either account role |
| `export-personal` | `workspaceId` | `ardesia-personal-v1` envelope with the authorized projection |

A projection contains `workspaceId`, `title`, monotonically increasing
`workspaceRevision`, server-derived Core `actor`, `documents`,
`assignedDocuments`, `installations`, `events`, `assignments`, `learnerWork`,
`learningEvents` and `labAccess`. Teacher evidence is included only when the
student currently shares it and the assignment remains active. The lab access
DTO discloses the authorized release/status to the student without disclosing
the teacher's complete installation or consent record.

## Transactions, identity and recovery

The account/session rows are checked and locked inside each data transaction.
Each workspace is loaded under `SELECT ... FOR UPDATE`; the same PostgreSQL
client handles the Core's storage write, receipt/event commit and final COMMIT.
Concurrent requests therefore do not execute against independent stale Core
instances. Optimistic revisions still reject stale user commands. Identical
retries return the original Core receipt with the current authorized projection.
Failed writes roll back the snapshot, event and receipt together.

Login limits are persisted independently of failed authentication transactions:
12 attempts per username in 15 minutes and 80 total attempts per minute. Password
derivation concurrency and waiting requests are bounded within each process.

Device imports are explicit v1/v2/v3 migrations into **new database containers**.
They validate Core integrity, require a single device owner, reject remote
identity collisions and cannot establish approval authority. An immutable
server-side owner binding preserves historical actor IDs, provenance and receipt
fingerprints. Original source text and its SHA-256 are archived; a second semantic
digest prevents duplicate imports disguised by JSON whitespace/key order.
Existing object/instance/revision identities and historical receipts are kept.
Non-revoked plugin installations receive a Core `withdraw-plugin-consent` command,
which disables the module and requires explicit consent in the authenticated
workspace. The source browser storage is never deleted or silently linked.

Import source text is bounded at 2,000,000 characters and HTTP requests at 4 MiB.
An oversized import is rejected with the original device data preserved; larger
imports need a separately reviewed operator migration. The personal export is a
privacy-filtered recovery record, **not** a full server backup or a supported
automatic round-trip import.

## Backup and restore

`exportBackup(operatorPool)` makes a consistent repeatable-read logical backup
of Core snapshots, identity bindings, import archives, creation receipts and recording media.
The version-3 backup contains account IDs/roles and disabled-account timestamps required for validation; it excludes passwords,
password hashes, session tokens and rate-limit records. Its SHA-256 detects
corruption; it does not authenticate an untrusted backup's author.

`restoreBackup(operatorPool, backup)` validates the digest, Core contracts,
complete referenced identities, owner bindings and imported source digests.
It accepts complete v2 backups without media and v3 with verified recording manifests and bytes. It requires an empty migrated target and independently provisioned accounts with
the exact saved IDs and roles, and refuses overwrites. Restore is one transaction.
Restore preserves disabled status from both source and target, revokes affected sessions and refuses older backups without that account status. It never re-enables an account.

Both functions require operator privileges and have no HTTP endpoint. Store
backups outside the database and exercise restore on synthetic data; do not
assume provider-managed backups on a free plan.

## Verification and limits

Run the integration suite with `M3_TEST_DATABASE_URL` pointing at a dedicated
loopback PostgreSQL database whose name ends in `_test`. The suite deliberately
fails without a real database. It resets only its `ardesia_next` schema, creates
a restricted runtime login, and creates/drops a separate temporary restore
database. Its operator test connection needs CREATEROLE and CREATEDB.

```sh
M3_TEST_DATABASE_URL=postgres://test_operator@127.0.0.1:5432/ardesia_test \
  npx vitest run packages/server/src/server.integration.test.ts
```

These tests prove local PostgreSQL behavior. They do not establish remote service
provisioning, a Vercel-to-database connection, protected-preview browser acceptance
or M3 acceptance. Those require the separately observed release gates.

## Operator CLI

The thin CLI consumes the public exports above. Supply `ARDESIA_OPERATOR_DATABASE_URL` through a secure environment, outside the frontend and repository. Provisioning input is an array of `{id?, username, displayName, role, password}` synthetic account records; keep that credential file outside Git and test artifacts.

```sh
node tools/database.mjs migrate
node tools/database.mjs provision /secure/path/accounts.json
node tools/database.mjs backup /secure/path/new-backup.json
node tools/database.mjs restore /secure/path/backup.json
node tools/database.mjs revoke-sessions account-id
```

Backup output is created with mode `0600` and refuses an existing path. Restore targets must be empty and independently provisioned. The CLI emits a bounded error code, not driver messages, credentials or SQL. These operations are explicit; no deployment request invokes them.


Personal recording actions share the existing authenticated endpoint and workspace transaction:
`list-recordings`/`search-recordings` require documentId (search also query), `read-recording` requires recordingId,
`recording-command` accepts the public Core recording command, and `put-recording-part`/`read-recording-part` require recordingId and index (put also base64).
Only the lesson owner can access any of these operations; assignments do not grant access. Migration002 is explicit and additive.
See [ADR0012](../../docs/adr/0012-personal-recordings.md) for media identity, recovery, erasure and restore boundaries.

Course actions `course-command` and `read-course-lesson` use the same authenticated transaction and exact history. `courseSpace` projects author drafts/editions, explicit deliveries and only authorized personal work. Active student accounts are checked on assignment; self-study is explicit for either owner role. Revoked participants may export their own answers but cannot read course material. Migration005 expands the snapshot CHECK to4–7 without rewriting existing rows. Snapshot7 and owner/participant binding are validated on restore; see [ADR0016](../../docs/adr/0016-versioned-courses.md).

## Material originals (SQL007, backupv4)

Authenticated `prepare-material`, `put-material-part`, `finish-material`, `read-material` and `read-material-part` share the workspace transaction/lock. Owners upload; assigned readers need a current referenced page, course readers an exact authorized edition/unit. Revocation is checked on every read. Original and chunk SHA256, header/MIME, immutability and quota are checked; header validation is not full sanitization. Bytes are separate from snapshot9/events in the same PostgreSQL authority. Backupv4 validates bytes plus current/historical references before empty-target restore, with explicit v2/v3 compatibility. [ADR0020](../../docs/adr/0020-original-materials.md) lists caps, retained originals and rollback limitations.


## Tutor economics (SQL008, snapshot10)

The eighth checked migration expands the workspace CHECK to4–10 without rewriting stored rows, events or receipts. Contracts0.11.0 add optional incurred direct costs and preparation minutes to appointments. Snapshot9 opens as10 in memory only; the next mutation persists10. Historical command fingerprints remain unchanged. Older strict readers do not understand new economics records; roll back only to a compatible build or an explicit verified reverse migration. [Decision and golden fixture](../../docs/adr/0021-core-continuity.md).

## Canonical notebooks (SQL009, snapshot11)

The ninth registered migration expands the snapshot CHECK to4–11 without rewriting data. `notebook-command` derives its actor from the verified owner session and commits catalog/document/events/composite receipt in one existing workspace transaction. Assigned readers cannot inspect or change the owner's catalog. Backup v4 accepts11; restore still refuses nonempty targets. Historical snapshots normalize without a write. After new notebook writes, use a compatible reader or an explicit verified reverse migration, never remove history to downgrade. [ADR0022](../../docs/adr/0022-canonical-notebooks.md) describes CAS, quotas and client/offline compatibility.
