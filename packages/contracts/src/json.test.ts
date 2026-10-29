import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {
  CoreEventSchema, CoreSnapshotSchema, InkDataSchema, LabStateSchema, LearningEventSchema,
  NoteDataSchema, PluginEventSchema, migrateSnapshotForOpen, type JsonValue,
} from './index';

const at = '2026-10-29T12:00:00.000Z';
const event = (payload: unknown) => ({id: 'event-one', sequence: 1, documentId: 'lesson-one', documentRevision: 1,
  type: 'create-document', actorId: 'owner', occurredAt: at, payload});
const payloadOf = (payload: unknown) => CoreEventSchema.parse(event(payload)).payload;
const legacyJson = z.json();
const note = NoteDataSchema.parse({text: 'n'.repeat(100_000)});
const ink = InkDataSchema.parse({points: Array.from({length: 20_000}, (_, index) => ({x: index, y: -index, pressure: 0.5})), color: '#123456', width: 1});

describe('finite event JSON and historical wire compatibility', () => {
  it('matches the previous parser across nested wire values and all three event contracts', () => {
    let seed = 0x51a7;
    const next = () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed;};
    const sample = (depth: number): JsonValue => {
      switch (next() % (depth ? 6 : 4)) {
        case 0: return null;
        case 1: return next() % 2 === 0;
        case 2: return (next() - 2 ** 31) / 100;
        case 3: return `Dato ${next()} — α`;
        case 4: return [sample(depth - 1), sample(depth - 1), sample(depth - 1)];
        default: return {constructor: sample(depth - 1), prototype: sample(depth - 1), nested: sample(depth - 1)};
      }
    };
    const values: unknown[] = [null, false, 0, -0, 1e308, '', 'α\u0000\ud800', [], {},
      JSON.parse('{"constructor":{"prototype":1},"prototype":[true],"__proto__":{"polluted":true},"nested":{"__proto__":3,"constructor":"kept"}}')];
    for (let index = 0; index < 256; index++) values.push(sample(4));
    for (const value of values) {
      const expected = legacyJson.parse(value);
      expect(payloadOf(value)).toEqual(expected);
      expect(PluginEventSchema.parse({id: 'plugin-event', sequence: 1, pluginId: 'ardesia.ideal-spring', installationRevision: 1,
        type: 'install-plugin', actorId: 'owner', occurredAt: at, payload: value}).payload).toEqual(expected);
      expect(LearningEventSchema.parse({id: 'learning-event', sequence: 1, lessonId: 'lesson-one', studentId: 'student',
        stream: 'learner-work', learningRevision: 1, type: 'save-learner-note', actorId: 'student', occurredAt: at, payload: value}).payload).toEqual(expected);
      expect(JSON.stringify(payloadOf(value))).toBe(JSON.stringify(expected));
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.is(payloadOf(-0), -0)).toBe(true);
  });

  it('accepts complete note and ink revisions without applying scientific lab caps to events', () => {
    let deep: JsonValue = 'end';
    for (let depth = 0; depth < 32; depth++) deep = {next: deep};
    const value = {note, ink, deep};
    expect(payloadOf(value)).toEqual(value);
    expect(LabStateSchema.safeParse({schemaVersion: '1.0.0', value}).success).toBe(false);
    const legalMetadata = {constructor: 'preserved', prototype: {version: 1}};
    expect(payloadOf(legalMetadata)).toEqual(legalMetadata);
    expect(LabStateSchema.safeParse({schemaVersion: '1.0.0', value: legalMetadata}).success).toBe(false);
  });

  it.each([1, 2, 3])('opens v%i snapshots without changing historical payloads, receipts, or input bytes', schemaVersion => {
    const document = {id: 'lesson-one', ownerId: 'owner', title: 'Lezione', revision: 1, status: 'draft', createdAt: at, updatedAt: at, objects: [], connections: []};
    const metadata = JSON.parse('{"constructor":"legal","prototype":{"revision":1},"__proto__":{"ignored":true}}') as JsonValue;
    const payload = {document, note, ink, metadata};
    const receipt = {commandId: 'command-one', actorId: 'owner', fingerprint: 'a'.repeat(64), documentId: document.id, documentRevision: 1, eventId: 'event-one'};
    const original = {schemaVersion, workspaceId: 'historical-workspace', documents: [document], events: [event(payload)], receipts: [receipt],
      ...(schemaVersion === 3 ? {installations: []} : {})};
    const bytes = JSON.stringify(original);
    const opened = CoreSnapshotSchema.parse(migrateSnapshotForOpen(original));
    expect(opened.schemaVersion).toBe(4);
    expect(opened.events[0]?.payload).toEqual(legacyJson.parse(payload));
    expect(opened.receipts).toEqual([receipt]);
    expect(opened.documents).toEqual([document]);
    expect(JSON.stringify(original)).toBe(bytes);
  });

  it('isolates parsed data while preserving shared references and property order', () => {
    const shared = {value: {count: 1}}, input = {first: shared, second: shared, array: [shared]};
    const result = payloadOf(input) as typeof input;
    expect(result).not.toBe(input);
    expect(result.first).not.toBe(shared);
    expect(result.first).toBe(result.second);
    expect(result.array[0]).toBe(result.first);
    expect(Object.keys(result)).toEqual(Object.keys(input));
    shared.value.count = 2;
    expect(result.first.value.count).toBe(1);
    result.first.value.count = 3;
    expect(shared.value.count).toBe(2);
  });

  it('rejects cyclic or non-JSON data instead of allowing it to reach serialization', () => {
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    const arrayCycle: unknown[] = []; arrayCycle.push(arrayCycle);
    const symbolKey = {[Symbol('private')]: 1};
    const invalid: unknown[] = [undefined, NaN, Infinity, -Infinity, 1n, Symbol('value'), () => 1, new Date(), new Map(), new Set(),
      {value: undefined}, {value: () => 1}, [undefined], new Array(1), cycle, arrayCycle, symbolKey];
    for (const value of invalid) expect(CoreEventSchema.safeParse(event(value)).success).toBe(false);
  });

  it('never invokes getters and retains the previous omissions for hidden metadata and array extras', () => {
    let reads = 0;
    const getter = () => {reads++; return 'unexpected';};
    for (const key of ['value', 'constructor']) {
      const value = Object.defineProperty({}, key, {enumerable: true, get: getter});
      expect(CoreEventSchema.safeParse(event(value)).success).toBe(false);
    }
    const hidden = Object.defineProperty({visible: true}, 'hidden', {get: getter});
    expect(payloadOf(hidden)).toEqual({visible: true});
    const extra = Object.defineProperty([1], 'extra', {enumerable: true, get: getter});
    expect(payloadOf(extra)).toEqual([1]);
    const prototypeKey = Object.defineProperty({visible: true}, '__proto__', {enumerable: true, get: getter});
    expect(payloadOf(prototypeKey)).toEqual({visible: true});
    expect(reads).toBe(0);
  });
});
