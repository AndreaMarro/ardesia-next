# Core M0

The Core is the single authority for the local workspace. Board, notebook and
reader consume the same document IDs and object IDs. This package has no React,
DOM, backend, plugin runtime or authentication provider dependency.

```ts
import { createCore, MemoryStorage } from '@ardesia/core';

const core = await createCore({ storage: new MemoryStorage() });
const actor = { actorId: 'local-teacher', role: 'teacher' } as const;
await core.execute(actor, {
  kind: 'create-document', commandId: 'create-1', documentId: 'lesson-1',
  expectedRevision: 0, title: 'La mia lezione',
});
await core.execute(actor, {
  kind: 'add-object', commandId: 'add-1', documentId: 'lesson-1',
  expectedRevision: 1,
  object: {
    id: 'note-1', type: 'note', title: 'Ipotesi',
    x: 40, y: 40, width: 280, height: 180,
    data: { text: 'Che cosa vogliamo verificare?' },
  },
});
const document = core.getDocument(actor, 'lesson-1');
```

Use `toObjectInput(existingObject)` from `@ardesia/contracts` before submitting
an edited object. Callers cannot set revision, approval, creator or creation time.
New objects and edits are drafts. M0 exposes no publication command.

## Contract

- `execute` validates the actor and command, checks owner, teacher role,
  document revision and idempotency, then writes one complete snapshot.
- `StorageAdapter.write` must atomically replace that one snapshot. If it
  rejects, it must not commit a partial replacement. The Core changes its
  in-memory authority only after success.
- Identical commands with the same command ID return the original receipt;
  reusing that ID with different arguments fails. IDs survive reopen. Receipts
  store a deterministic SHA-256 fingerprint, not a second copy of command text.
- `listDocuments`, `getDocument`, `events` and `getObjectRevision` require an
  owner context and return clones. Unavailable and other-owner IDs use the same
  error. Approved documents are immutable in M0.
- `getObjectRevision` resolves an exact historical object from the same Core
  event stream. Source citations retain the cited version after source edits.
- Removing an object removes its connections. Referenced sources cannot be
  removed. Removed object IDs cannot be reused.
- `snapshot()` is a local administration/export method. It must never be
  exposed as an unfiltered remote endpoint.

## Boundaries of this milestone

M0 is a **device-local, single-writer** preview. Actor context is injected by the
local shell; it is not authenticated. A server adapter must derive identity
from a verified session, validate authorization on every request and use an
atomic database transaction before supporting real teachers and students.
Multiple independent Core instances writing the same storage are not supported
without adapter-level coordination. No server database or second event store
is created here.

Local data is not encrypted, signed or protected against someone controlling
the device. Do not use the preview for confidential student records.
Snapshot parsing detects structural corruption and refuses to overwrite invalid
data; it is not a tamper-proof audit guarantee.

The event log and receipts are retained in the same snapshot, with a contract
limit of 50,000 events and 2,000 objects per document. Storage failures surface
to the UI. Compaction, multi-user transactions, remote backups and publication
are separate milestones.
