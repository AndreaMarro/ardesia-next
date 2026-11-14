import {describe, expect, it} from 'vitest';
import {RecordingCaptureSchema, type RecordingCapture} from '@ardesia/contracts';
import {createCore, MemoryStorage, validateRecordingCapture, applyRecordingCommand} from './index';

const actor = {actorId: 'teacher', role: 'teacher' as const};
async function fixture() {
  const core = await createCore({storage: new MemoryStorage()});
  await core.execute(actor, {kind: 'create-document', commandId: 'c1', documentId: 'lesson', expectedRevision: 0, title: 'Lezione'});
  await core.execute(actor, {kind: 'add-object', commandId: 'c2', documentId: 'lesson', expectedRevision: 1,
    object: {id: 'ink', type: 'ink', title: 'Tratto', x: 0, y: 0, width: 200, height: 200,
      data: {width: 2, color: '#203e62', points: [{x: 1, y: 1, pressure: .4}, {x: 20, y: 20, pressure: .9}]}}});
  const capture: RecordingCapture = {format: 'ardesia-recording-v1', recordingId: 'take', documentId: 'lesson', title: 'Spiegazione',
    capturedAt: '2026-11-07T10:00:00.000Z', baseRevision: 1, endRevision: 2, durationMs: 2500, mimeType: 'audio/webm',
    parts: [{index: 0, bytes: 64, sha256: 'a'.repeat(64)}],
    timeline: [{eventId: core.events(actor, 'lesson')[1]!.id, atMs: 2000, timing: 'captured',
      ink: {objectId: 'ink', objectRevision: 1, sampleTimesMs: [1000, 2000]}}]};
  return {core, capture};
}
describe('Core recording references', () => {
  it('authorizes exact owned history without mutating the lesson or creating another journal', async () => {
    const {core, capture} = await fixture(), before = core.snapshot();
    const valid = validateRecordingCapture(core, actor, capture); valid.timeline[0]!.atMs = 2200;
    expect(capture.timeline[0]!.atMs).toBe(2000); expect(core.snapshot()).toEqual(before);
  });
  it('refuses another teacher or student even if they know every recording and event ID', async () => {
    const {core, capture} = await fixture();
    for (const stranger of [{actorId: 'other', role: 'teacher' as const}, {actorId: 'other-student', role: 'student' as const}]) {
      expect(() => validateRecordingCapture(core, stranger, capture)).toThrow();
    }
  });
  it('requires the complete interval and exact event/stroke/sample identities', async () => {
    const {core, capture} = await fixture();
    for (const invalid of [{...capture, endRevision: 3}, {...capture, timeline: []},
      {...capture, timeline: [{...capture.timeline[0]!, eventId: 'foreign'}]},
      {...capture, timeline: [{...capture.timeline[0]!, ink: {objectId: 'ink', objectRevision: 2, sampleTimesMs: [1000, 2000]}}]},
      {...capture, timeline: [{...capture.timeline[0]!, ink: {objectId: 'ink', objectRevision: 1, sampleTimesMs: [1000]}}]}]) {
      expect(() => validateRecordingCapture(core, actor, invalid)).toThrow();
    }
  });
  it('rejects missing media parts, illegal types, nonfinite or decreasing times and samples outside the marker', async () => {
    const {capture} = await fixture();
    for (const invalid of [{...capture, parts: []}, {...capture, parts: [{...capture.parts[0]!, index: 1}]}, {...capture, mimeType: 'text/html'},
      {...capture, durationMs: Infinity}, {...capture, durationMs: 500},
      {...capture, timeline: [{...capture.timeline[0]!, ink: {objectId: 'ink', objectRevision: 1, sampleTimesMs: [2000, 1000]}}]},
      {...capture, timeline: [{...capture.timeline[0]!, ink: {objectId: 'ink', objectRevision: 1, sampleTimesMs: [1000, 2100]}}]}]) {
      expect(RecordingCaptureSchema.safeParse(invalid).success).toBe(false);
    }
  });
});


describe('Core recording lifecycle', () => {
  it('commits ordered metadata, exact parts, transcript versions, immutable retry receipts and irreversible erasure', async () => {
    const {core, capture} = await fixture(), before = core.snapshot(), now = '2026-11-07T10:01:00.000Z';
    const prepare = {kind: 'prepare-recording', commandId: 'prepare', recordingId: 'take', expectedRevision: 0, capture};
    const prepared = await applyRecordingCommand(core, actor, null, prepare, [], now);
    expect(prepared.state.summary).toMatchObject({status: 'uploading', revision: 1});
    const finish = {kind: 'finish-recording', commandId: 'finish', recordingId: 'take', expectedRevision: 1};
    await expect(applyRecordingCommand(core, actor, prepared.state, finish, [], now)).rejects.toMatchObject({code: 'INVALID_REFERENCE'});
    const ready = await applyRecordingCommand(core, actor, prepared.state, finish, capture.parts, now);
    const edit = {kind: 'edit-recording-transcript', commandId: 'edit', recordingId: 'take', expectedRevision: 2,
      origin: 'manual', cues: [{id: 'cue', fromMs: 0, toMs: 1000, text: 'Forza elastica'}]};
    const saved = await applyRecordingCommand(core, actor, ready.state, edit, [], now);
    expect(saved.state.transcripts).toHaveLength(1);
    expect((await applyRecordingCommand(core, actor, saved.state, edit, [], now)).receipt).toEqual(saved.receipt);
    await expect(applyRecordingCommand(core, actor, saved.state, {...edit, cues: []}, [], now)).rejects.toMatchObject({code: 'IDEMPOTENCY_CONFLICT'});
    await expect(applyRecordingCommand(core, actor, saved.state, {...edit, commandId: 'new'}, [], now)).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    const erased = await applyRecordingCommand(core, actor, saved.state, {kind: 'erase-recording', commandId: 'erase', recordingId: 'take', expectedRevision: 3}, [], now);
    expect(erased.state).toMatchObject({capture: null, transcripts: [], summary: {status: 'erased', revision: 4}});
    const retry = await applyRecordingCommand(core, actor, erased.state, prepare, [], now);
    expect(retry.state.summary.status).toBe('erased'); expect(retry.receipt).toEqual(prepared.receipt);
    await expect(applyRecordingCommand(core, actor, erased.state, {...edit, commandId: 'resurrect', expectedRevision: 4}, [], now)).rejects.toMatchObject({code: 'NOT_FOUND'});
    expect(core.snapshot()).toEqual(before);
  });
});
