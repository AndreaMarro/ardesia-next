import { describe, expect, it } from 'vitest';
import { CoreSnapshotSchema, type Actor, type CoreCommand, type CoreSnapshot, type NewEducationalObject } from '@ardesia/contracts';
import { createCore, MemoryStorage, type StorageAdapter } from './index';

const teacher: Actor = { actorId: 'teacher-andrea', role: 'teacher' };
const stranger: Actor = { actorId: 'teacher-other', role: 'teacher' };
const student: Actor = { actorId: teacher.actorId, role: 'student' };
const create: CoreCommand = { kind: 'create-document', commandId: 'create-1', documentId: 'lesson-1', expectedRevision: 0, title: 'Oscillazioni' };
const note: NewEducationalObject = { id: 'note-1', type: 'note', title: 'Ipotesi', x: 10, y: 20, width: 240, height: 180, data: { text: 'Che cosa cambia il periodo?' } };
const source: NewEducationalObject = { id: 'source-1', type: 'source', title: 'Fonte', x: 400, y: 40, width: 250, height: 190, data: { url: 'https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums', publisher: 'OpenStax', locator: '§15.4', sourceRevision: 'accessed-2026-10-29', license: 'CC BY 4.0' } };
function deterministic(storage: StorageAdapter = new MemoryStorage()) {
  let counter = 0;
  return { storage, clock: () => '2026-10-29T00:00:00.000Z', id: () => `event-${++counter}` };
}
const add = (object: NewEducationalObject, expectedRevision = 1, commandId = 'add-1'): CoreCommand => ({ kind: 'add-object', commandId, documentId: 'lesson-1', expectedRevision, object });

describe('Core authority and persistence', () => {
  it('commits one document revision, event and receipt together and reopens identical state', async () => {
    const storage = new MemoryStorage();
    const core = await createCore(deterministic(storage));
    await core.execute(teacher, create);
    await core.execute(teacher, add(note));
    const receipt = await core.execute(teacher, { kind: 'move-object', commandId: 'move-1', documentId: 'lesson-1', expectedRevision: 2, objectId: note.id, x: 300, y: 150 });
    const reopened = await createCore(deterministic(storage));
    expect(reopened.snapshot()).toEqual(core.snapshot());
    expect(reopened.getDocument(teacher, 'lesson-1').objects[0]).toMatchObject({ id: note.id, x: 300, y: 150, revision: 2, status: 'draft' });
    expect(receipt.documentRevision).toBe(3);
    expect(core.snapshot().events).toHaveLength(3);
    expect(core.snapshot().receipts).toHaveLength(3);
  });

  it('denies reads and changes by a different owner without revealing document existence', async () => {
    const core = await createCore(deterministic());
    await core.execute(teacher, create);
    const before = core.snapshot();
    expect(core.listDocuments(stranger)).toEqual([]);
    expect(() => core.getDocument(stranger, 'lesson-1')).toThrow('unavailable');
    expect(() => core.events(stranger, 'lesson-1')).toThrow('unavailable');
    await expect(core.execute(stranger, add(note))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(core.snapshot()).toEqual(before);
  });

  it('does not treat a matching actor ID with student role as an editor', async () => {
    const core = await createCore(deterministic());
    await core.execute(teacher, create);
    await expect(core.execute(student, add(note))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(core.getDocument(teacher, 'lesson-1').objects).toEqual([]);
  });

  it('retries an identical command idempotently, including after reopen', async () => {
    const storage = new MemoryStorage();
    const core = await createCore(deterministic(storage));
    const first = await core.execute(teacher, create);
    expect(await core.execute(teacher, structuredClone(create))).toEqual(first);
    const reopened = await createCore(deterministic(storage));
    expect(await reopened.execute(teacher, create)).toEqual(first);
    expect(reopened.snapshot().events).toHaveLength(1);
    await expect(reopened.execute(teacher, { ...create, title: 'Altro contenuto' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('rejects stale writers while serializing concurrently queued commands', async () => {
    const core = await createCore(deterministic());
    await core.execute(teacher, create);
    const outcomes = await Promise.allSettled([
      core.execute(teacher, add(note)),
      core.execute(teacher, add({ ...note, id: 'note-2' }, 1, 'add-2')),
    ]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'rejected']);
    expect(core.getDocument(teacher, 'lesson-1').objects).toHaveLength(1);
    expect(core.snapshot().events).toHaveLength(2);
  });

  it('replaying an old accepted request returns its receipt without reverting newer edits', async () => {
    const core = await createCore(deterministic());
    await core.execute(teacher, create);
    const original = await core.execute(teacher, add(note));
    await core.execute(teacher, { kind: 'replace-object', commandId: 'edit-new', documentId: 'lesson-1', expectedRevision: 2, object: { ...note, data: { text: 'Nuova ipotesi verificata' } } });
    const replay = await core.execute(teacher, add(note));
    expect(replay).toEqual(original);
    expect(replay.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(replay)).not.toContain(note.data.text);
    expect(core.getDocument(teacher, 'lesson-1').objects[0]).toMatchObject({ revision: 2, data: { text: 'Nuova ipotesi verificata' } });
    expect(core.snapshot().events).toHaveLength(3);
  });

  it('preserves both durable and in-memory state on an atomic adapter write failure', async () => {
    const backing = new MemoryStorage();
    let fail = false;
    const storage: StorageAdapter = { read: () => backing.read(), write: async (snapshot) => { if (fail) throw new Error('Quota exceeded'); await backing.write(snapshot); } };
    const core = await createCore(deterministic(storage));
    await core.execute(teacher, create);
    const before = core.snapshot();
    fail = true;
    await expect(core.execute(teacher, add(note))).rejects.toMatchObject({ code: 'STORAGE_FAILURE' });
    expect(core.snapshot()).toEqual(before);
    expect(await backing.read()).toEqual(before);
    fail = false;
    await core.execute(teacher, add(note));
    expect(core.snapshot().events).toHaveLength(2);
    expect(core.snapshot().receipts).toHaveLength(2);
  });

  it('refuses invalid snapshots without overwriting the original value', async () => {
    let writes = 0;
    const damaged = { schemaVersion: 999, privateText: 'keep me' };
    const storage: StorageAdapter = { read: async () => damaged, write: async () => { writes++; } };
    await expect(createCore(deterministic(storage))).rejects.toMatchObject({ code: 'INVALID_SNAPSHOT' });
    expect(writes).toBe(0);
    expect(await storage.read()).toEqual(damaged);
  });

  it('rejects partial persistence with a missing receipt or an unbacked revision', async () => {
    const core = await createCore(deterministic());
    await core.execute(teacher, create);
    const missingReceipt = core.snapshot();
    missingReceipt.receipts = [];
    expect(CoreSnapshotSchema.safeParse(missingReceipt).success).toBe(false);
    const mismatch = core.snapshot();
    mismatch.documents[0]!.revision = 2;
    expect(CoreSnapshotSchema.safeParse(mismatch).success).toBe(false);
  });

  it('does not let callers mutate canonical objects, receipts or queued input', async () => {
    const core = await createCore(deterministic());
    const receipt = await core.execute(teacher, create);
    receipt.documentRevision = 999;
    const command = add(structuredClone(note));
    const operation = core.execute(teacher, command);
    if (command.kind === 'add-object') command.object.title = 'Injected after validation';
    await operation;
    const document = core.getDocument(teacher, 'lesson-1');
    document.objects[0]!.title = 'Mutated projection';
    expect(core.getDocument(teacher, 'lesson-1').objects[0]!.title).toBe('Ipotesi');
    expect(core.snapshot().receipts[0]).toMatchObject({documentRevision: 1});
  });

  it('never auto-approves content and rejects injected status or script URLs', async () => {
    const core = await createCore(deterministic());
    await core.execute(teacher, create);
    const approved = { ...note, status: 'approved' } as NewEducationalObject;
    await expect(core.execute(teacher, add(approved))).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
    const unsafe = { ...source, data: { ...source.data, url: 'javascript:alert(1)' } } as NewEducationalObject;
    await expect(core.execute(teacher, add(unsafe))).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
    await core.execute(teacher, add(note));
    expect(core.getDocument(teacher, 'lesson-1')).toMatchObject({ status: 'draft', objects: [{ status: 'draft' }] });
  });

  it('preserves exact cited revisions when the current source changes', async () => {
    const core = await createCore(deterministic());
    await core.execute(teacher, create);
    await core.execute(teacher, add(source));
    const cited = { ...note, provenance: { origin: 'authored' as const, sources: [{ sourceId: source.id, revision: 1, locator: 'equation 15.20' }] } };
    await core.execute(teacher, add(cited, 2, 'add-cited'));
    await core.execute(teacher, { kind: 'replace-object', commandId: 'source-edit', documentId: 'lesson-1', expectedRevision: 3, object: { ...source, title: 'Fonte aggiornata' } });
    expect(core.getObjectRevision(teacher, 'lesson-1', source.id, 1).title).toBe('Fonte');
    expect(core.getObjectRevision(teacher, 'lesson-1', source.id, 2).title).toBe('Fonte aggiornata');
    expect(core.getDocument(teacher, 'lesson-1').objects.find((object) => object.id === note.id)!.provenance.sources[0]!.revision).toBe(1);
    await expect(core.execute(teacher, { kind: 'remove-object', commandId: 'remove-source', documentId: 'lesson-1', expectedRevision: 4, objectId: source.id })).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
  });

  it('rejects unresolved sources and orphan connections without an audit side effect', async () => {
    const core = await createCore(deterministic());
    await core.execute(teacher, create);
    await expect(core.execute(teacher, add({ ...note, provenance: { origin: 'authored', sources: [{ sourceId: 'missing', revision: 1, locator: 'p.1' }] } }))).rejects.toMatchObject({ code: 'INVALID_REFERENCE' });
    await expect(core.execute(teacher, { kind: 'connect-objects', commandId: 'connect-1', documentId: 'lesson-1', expectedRevision: 1, connection: { id: 'edge-1', from: 'missing-a', to: 'missing-b', label: '' } })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(core.snapshot().events).toHaveLength(1);
  });

  it('removes edges with their endpoint and never reuses historical object identities', async () => {
    const core = await createCore(deterministic());
    await core.execute(teacher, create);
    await core.execute(teacher, add(note));
    await core.execute(teacher, add({ ...note, id: 'note-2' }, 2, 'add-2'));
    await core.execute(teacher, { kind: 'connect-objects', commandId: 'edge-1', documentId: 'lesson-1', expectedRevision: 3, connection: { id: 'edge-1', from: note.id, to: 'note-2', label: 'spiega' } });
    await core.execute(teacher, { kind: 'remove-object', commandId: 'remove-1', documentId: 'lesson-1', expectedRevision: 4, objectId: note.id });
    expect(core.getDocument(teacher, 'lesson-1').connections).toEqual([]);
    expect(core.getObjectRevision(teacher, 'lesson-1', note.id, 1).title).toBe(note.title);
    await expect(core.execute(teacher, add(note, 5, 'reuse-1'))).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
  });

  it('does not silently edit a persisted approved document', async () => {
    const core = await createCore(deterministic());
    await core.execute(teacher, create);
    const approved: CoreSnapshot = core.snapshot();
    approved.documents[0]!.status = 'approved';
    const reopened = await createCore(deterministic(new MemoryStorage(approved)));
    await expect(reopened.execute(teacher, add(note))).rejects.toMatchObject({ code: 'READ_ONLY' });
  });
});
