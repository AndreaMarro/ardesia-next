import {describe, expect, it} from 'vitest';
import {
  CoreSnapshotSchema, toObjectInput,
  type Actor, type CoreCommand, type CoreSnapshot, type JsonValue, type LabData, type LabObject, type NewEducationalObject,
} from '@ardesia/contracts';
import {createCore, MemoryStorage, type StorageAdapter} from './index';

const teacher: Actor = {actorId: 'teacher-andrea', role: 'teacher'};
type NewLab = Extract<NewEducationalObject, {type: 'lab'}>;

function labInput(): NewLab {
  return {
    id: 'lab-spring-1', type: 'lab', title: 'Molla ideale', x: 80, y: 60, width: 620, height: 600,
    data: {
      pluginId: 'ardesia.ideal-spring', pluginVersion: '1.0.0', instanceId: 'spring-instance-1',
      stateSchemaVersion: '1.0.0', bundleDigest: 'a'.repeat(64),
      publisher: {id: 'ardesia', keyId: 'release-key-1'},
      state: {schemaVersion: '1.0.0', value: {massKg: 1, stiffnessNPerM: 20, initialDisplacementM: 0.2, initialVelocityMPerS: 0, timeS: 0}},
    },
  };
}

class ObservedStorage extends MemoryStorage {
  writes = 0;
  fail = false;
  override async write(snapshot: CoreSnapshot): Promise<void> {
    if (this.fail) throw new Error('Atomic write refused');
    await super.write(snapshot);
    this.writes++;
  }
}

function options(storage: StorageAdapter = new ObservedStorage(), prefix = 'event') {
  let sequence = 0;
  return {storage, clock: () => '2026-10-29T02:00:00.000Z', id: () => `${prefix}-${++sequence}`, workspaceId: 'm1-test-workspace'};
}

const create: CoreCommand = {kind: 'create-document', commandId: 'create-lesson', documentId: 'lesson-1', expectedRevision: 0, title: 'Oscillazioni'};
const add = (object: NewEducationalObject, expectedRevision = 1, commandId = 'add-lab'): CoreCommand => ({kind: 'add-object', commandId, documentId: 'lesson-1', expectedRevision, object});
const replace = (object: NewEducationalObject, expectedRevision = 2, commandId = 'update-lab'): CoreCommand => ({kind: 'replace-object', commandId, documentId: 'lesson-1', expectedRevision, object});

async function prepared() {
  const storage = new ObservedStorage();
  const core = await createCore(options(storage));
  await core.execute(teacher, create);
  await core.execute(teacher, add(labInput()));
  return {core, storage};
}

describe('Core lab identity, state and exact revisions', () => {
  it('commits add → state edit → reopen with one identity, exact state, events and receipts', async () => {
    const {core, storage} = await prepared();
    const first = core.getDocument(teacher, 'lesson-1').objects[0] as LabObject;
    expect(first).toMatchObject({id: 'lab-spring-1', revision: 1, status: 'draft', type: 'lab'});
    const edited = toObjectInput(first) as NewLab;
    edited.data.state.value = {...edited.data.state.value as Record<string, JsonValue>, massKg: 2.5, timeS: 1.25};
    const receipt = await core.execute(teacher, replace(edited));
    expect(receipt.documentRevision).toBe(3);
    const latest = core.getDocument(teacher, 'lesson-1').objects[0] as LabObject;
    expect(latest.revision).toBe(2);
    expect(latest.data).toEqual({...first.data, state: edited.data.state});
    expect(core.events(teacher, 'lesson-1').map(event => event.type)).toEqual(['create-document', 'add-object', 'replace-object']);
    expect(core.events(teacher, 'lesson-1')[2]!.payload).toMatchObject({previous: first, object: latest});
    expect(core.snapshot().receipts).toHaveLength(3);
    expect(storage.writes).toBe(3);
    const reopened = await createCore(options(storage, 'reopened-event'));
    expect(reopened.snapshot()).toEqual(core.snapshot());
    expect(reopened.getObjectRevision(teacher, 'lesson-1', first.id, 1)).toEqual(first);
    expect(reopened.getObjectRevision(teacher, 'lesson-1', first.id, 2)).toEqual(latest);
    expect(await reopened.execute(teacher, replace(edited))).toEqual(receipt);
    expect(storage.writes).toBe(3);
    expect(reopened.snapshot().documents[0]!.status).toBe('draft');
  });

  it.each([
    {pluginId: 'ardesia.other'}, {pluginVersion: '1.0.1'}, {instanceId: 'different-instance'},
    {bundleDigest: 'b'.repeat(64)}, {publisher: {id: 'other', keyId: 'release-key-1'}},
    {publisher: {id: 'ardesia', keyId: 'release-key-2'}},
  ] satisfies Partial<LabData>[])('rejects identity changes without a state/event/receipt write: %j', async identityPatch => {
    const {core, storage} = await prepared();
    const before = core.snapshot();
    const input = labInput();
    Object.assign(input.data, identityPatch);
    await expect(core.execute(teacher, replace(input))).rejects.toMatchObject({code: 'INVALID_REFERENCE'});
    expect(core.snapshot()).toEqual(before);
    expect(await storage.read()).toEqual(before);
    expect(storage.writes).toBe(2);
  });

  it('rejects schema upgrades even when the nested state also claims the new version', async () => {
    const {core, storage} = await prepared();
    const before = core.snapshot();
    const input = labInput();
    input.data.stateSchemaVersion = '2.0.0';
    input.data.state.schemaVersion = '2.0.0';
    await expect(core.execute(teacher, replace(input))).rejects.toMatchObject({code: 'INVALID_REFERENCE'});
    expect(core.snapshot()).toEqual(before);
    expect(storage.writes).toBe(2);
  });

  it('rejects duplicate live instance IDs without introducing a second educational object', async () => {
    const {core, storage} = await prepared();
    const duplicate = {...labInput(), id: 'lab-spring-2'};
    const before = core.snapshot();
    await expect(core.execute(teacher, add(duplicate, 2, 'duplicate-instance'))).rejects.toMatchObject({code: 'INVALID_COMMAND'});
    expect(core.snapshot()).toEqual(before);
    expect(storage.writes).toBe(2);
  });

  it('keeps the pending and committed scientific state detached from caller mutations', async () => {
    const storage = new ObservedStorage();
    const core = await createCore(options(storage));
    await core.execute(teacher, create);
    const input = labInput();
    const original = structuredClone(input.data.state);
    const callerValue = input.data.state.value as Record<string, JsonValue>;
    const operation = core.execute(teacher, add(input));
    callerValue.massKg = 9;
    await operation;
    expect((core.getDocument(teacher, 'lesson-1').objects[0] as LabObject).data.state).toEqual(original);
    callerValue.timeS = 50;
    expect((core.getDocument(teacher, 'lesson-1').objects[0] as LabObject).data.state).toEqual(original);
    expect((await createCore(options(storage))).snapshot()).toEqual(core.snapshot());
    const read = core.getObjectRevision(teacher, 'lesson-1', input.id, 1) as LabObject;
    (read.data.state.value as Record<string, JsonValue>).massKg = 10;
    expect((core.getObjectRevision(teacher, 'lesson-1', input.id, 1) as LabObject).data.state).toEqual(original);
  });

  it('keeps the previous scientific state and exact revision when persistence fails', async () => {
    const {core, storage} = await prepared();
    const before = core.snapshot();
    const edited = labInput();
    edited.data.state.value = {...edited.data.state.value as Record<string, JsonValue>, stiffnessNPerM: 50};
    storage.fail = true;
    await expect(core.execute(teacher, replace(edited))).rejects.toMatchObject({code: 'STORAGE_FAILURE'});
    expect(core.snapshot()).toEqual(before);
    expect(await storage.read()).toEqual(before);
    expect(storage.writes).toBe(2);
  });
});

describe('Core generic JSON state boundary', () => {
  it.each([
    {value: {massKg: NaN}}, {value: {massKg: Infinity}}, {value: {massKg: -Infinity}},
    {value: 'x'.repeat(32_769)}, {value: {values: Array.from({length: 5_000}, () => 1)}},
    {schemaVersion: '2.0.0', value: {}},
  ])('rejects invalid or oversized state without mutation or persistence', async statePatch => {
    const {core, storage} = await prepared();
    const before = core.snapshot();
    const edited = labInput();
    Object.assign(edited.data.state, statePatch);
    await expect(core.execute(teacher, replace(edited))).rejects.toMatchObject({code: 'INVALID_COMMAND'});
    expect(core.snapshot()).toEqual(before);
    expect(await storage.read()).toEqual(before);
    expect(storage.writes).toBe(2);
  });

  it('rejects cycles, forbidden keys, hidden values and sparse array states', async () => {
    const {core, storage} = await prepared();
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    const symbol = {[Symbol('hidden')]: 1};
    const hidden = Object.defineProperty({}, 'secret', {value: 1, enumerable: false});
    const sparse = new Array(3);
    const holeWithExtraKey = new Array(2); holeWithExtraKey[0] = 1;
    Object.defineProperty(holeWithExtraKey, 'extra', {value: 2, enumerable: true});
    const forbidden = JSON.parse('{"__proto__":{"polluted":true}}') as unknown;
    const getter = Object.defineProperty({}, 'massKg', {get: () => 1, enumerable: true});
    const before = core.snapshot();
    for (const value of [cycle, symbol, hidden, sparse, holeWithExtraKey, forbidden, getter]) {
      const edited = labInput();
      edited.data.state.value = value as JsonValue;
      await expect(core.execute(teacher, replace(edited))).rejects.toMatchObject({code: 'INVALID_COMMAND'});
      expect(core.snapshot()).toEqual(before);
      expect(storage.writes).toBe(2);
    }
  });

  it.each(['x', 'è'])('applies the 32 KiB limit to the full UTF-8 state envelope using %s characters', async character => {
    const {core, storage} = await prepared();
    const encoder = new TextEncoder();
    const envelopeBytes = encoder.encode(JSON.stringify({schemaVersion: '1.0.0', value: ''})).byteLength;
    const availableBytes = 32_768 - envelopeBytes;
    const characterBytes = encoder.encode(character).byteLength;
    const value = character.repeat(Math.floor(availableBytes / characterBytes)) + 'x'.repeat(availableBytes % characterBytes);
    const input = labInput();
    input.data.state.value = value;
    expect(encoder.encode(JSON.stringify(input.data.state)).byteLength).toBe(32_768);
    await core.execute(teacher, replace(input));
    const before = core.snapshot();
    const oversized = labInput();
    oversized.data.state.value = value + 'x';
    expect(encoder.encode(JSON.stringify(oversized.data.state)).byteLength).toBe(32_769);
    await expect(core.execute(teacher, replace(oversized, 3, 'over-limit'))).rejects.toMatchObject({code: 'INVALID_COMMAND'});
    expect(core.snapshot()).toEqual(before);
    expect(await storage.read()).toEqual(before);
    expect(storage.writes).toBe(3);
  });
});

describe('Lossless M0 snapshot migration on open', () => {
  async function legacySnapshot() {
    const core = await createCore(options());
    await core.execute(teacher, create);
    await core.execute(teacher, add({id: 'legacy-note', type: 'note', title: 'Ipotesi', x: 10, y: 20, width: 200, height: 120, data: {text: 'La massa è vincolata lungo l’asse.'}}, 1, 'add-legacy-note'));
    const {installations: _installations, ...legacy} = core.snapshot();
    return {...legacy, schemaVersion: 1};
  }

  it('preserves objects, events and receipts in memory with zero writes, until the next accepted command', async () => {
    const raw = await legacySnapshot();
    const storage = new ObservedStorage(raw);
    const core = await createCore(options(storage, 'migration-event'));
    expect(core.snapshot()).toEqual({...raw, schemaVersion: 3, installations: []});
    expect(CoreSnapshotSchema.safeParse(core.snapshot()).success).toBe(true);
    expect(storage.writes).toBe(0);
    expect(await storage.read()).toEqual(raw);
    await expect(core.execute(teacher, add(labInput(), 999, 'stale-command'))).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    expect(storage.writes).toBe(0);
    expect(await storage.read()).toEqual(raw);
    await core.execute(teacher, add(labInput(), 2));
    expect(storage.writes).toBe(1);
    expect((await storage.read() as CoreSnapshot).schemaVersion).toBe(3);
    expect(core.snapshot().events.slice(0, 2)).toEqual(raw.events);
    expect(core.snapshot().receipts.slice(0, 2)).toEqual(raw.receipts);
    expect(core.snapshot().documents[0]!.objects[0]).toEqual(raw.documents[0]!.objects[0]);
  });

  it('preserves invalid M0 bytes and rejects a falsely labelled v1 snapshot containing a lab', async () => {
    const invalid = await legacySnapshot();
    invalid.receipts.pop();
    const invalidStorage = new ObservedStorage(invalid);
    await expect(createCore(options(invalidStorage))).rejects.toMatchObject({code: 'INVALID_SNAPSHOT'});
    expect(invalidStorage.writes).toBe(0);
    expect(await invalidStorage.read()).toEqual(invalid);
    const {core} = await prepared();
    const falselyLabelled = {...core.snapshot(), schemaVersion: 1};
    const falseStorage = new ObservedStorage(falselyLabelled);
    await expect(createCore(options(falseStorage))).rejects.toMatchObject({code: 'INVALID_SNAPSHOT'});
    expect(falseStorage.writes).toBe(0);
    expect(await falseStorage.read()).toEqual(falselyLabelled);
  });
});
