import {describe, expect, it} from 'vitest';
import {CoreSnapshotSchema, migrateSnapshotForOpen, type Actor, type CoreSnapshot, type LearningCommand} from '@ardesia/contracts';
import {createCore, MemoryStorage, type CoreService} from './index';

const teacher: Actor = {actorId: 'teacher', role: 'teacher'};
const learner: Actor = {actorId: 'learner', role: 'student'};
const other: Actor = {actorId: 'other', role: 'student'};
class Storage extends MemoryStorage {
  writes = 0; fail = false;
  override async write(value: CoreSnapshot) {if (this.fail) throw Error('disk'); await super.write(value); this.writes++;}
}
async function fixture() {
  const storage = new Storage(); let serial = 0;
  const core = await createCore({storage, id: () => `event-${++serial}`, clock: () => '2026-11-07T10:00:00.000Z'});
  await core.execute(teacher, {kind: 'create-document', commandId: 'document', documentId: 'lesson', title: 'Energia', expectedRevision: 0});
  await core.execute(teacher, {kind: 'add-object', commandId: 'object', documentId: 'lesson', expectedRevision: 1,
    object: {id: 'exercise', type: 'note', title: 'Energia elastica', x: 0, y: 0, width: 300, height: 200, data: {text: 'Se raddoppia x, come cambia E = kx²/2?'}}});
  for (const student of [learner, other]) await core.executeLearning(teacher, {kind: 'assign-lesson', commandId: `assign-${student.actorId}`, documentId: 'lesson', studentId: student.actorId, expectedRevision: 0});
  const attempt: LearningCommand = {kind: 'record-learner-attempt', commandId: 'answer', documentId: 'lesson', expectedRevision: 0,
    expectedDocumentRevision: 2, objectId: 'exercise', attemptId: 'attempt-1', answer: 'Raddoppia.'};
  const receipt = await core.executeLearning(learner, attempt);
  return {core, storage, attempt, receipt};
}
const revision = (core: CoreService) => core.getLearnerWork(learner, 'lesson')!.revision;
const share = (core: CoreService, shared = true) => core.executeLearning(learner, {kind: 'share-learner-evidence', commandId: `share-${revision(core)}`,
  documentId: 'lesson', expectedRevision: revision(core), shared});
const feedback = (core: CoreService, overrides: Record<string, unknown> = {}): LearningCommand => ({kind: 'review-learner-attempt', commandId: 'review',
  documentId: 'lesson', studentId: learner.actorId, expectedRevision: revision(core), attemptId: 'attempt-1', feedbackId: 'feedback-1',
  outcome: 'revise', comment: 'La dipendenza è quadratica.', nextStep: 'Sostituisci 2x nella formula.', ...overrides} as LearningCommand);

describe('lesson feedback and correction continuity', () => {
  it('links immutable teacher feedback and a new learner answer to the exact evidence', async () => {
    const {core, storage} = await fixture(); await share(core);
    const command = feedback(core); const receipt = await core.executeLearning(teacher, command);
    expect(core.getLearnerWork(learner, 'lesson')!.feedback).toEqual([expect.objectContaining({id: 'feedback-1', attemptId: 'attempt-1', authorId: 'teacher', outcome: 'revise'})]);
    await core.executeLearning(learner, {kind: 'record-learner-attempt', commandId: 'correction', documentId: 'lesson', expectedRevision: revision(core),
      expectedDocumentRevision: 2, objectId: 'exercise', attemptId: 'attempt-2', answer: 'Quadruplica.', replyToFeedbackId: 'feedback-1'});
    const reopened = await createCore({storage});
    expect(reopened.getLearnerWork(learner, 'lesson')!.attempts).toEqual([expect.objectContaining({id: 'attempt-1', answer: 'Raddoppia.'}),
      expect.objectContaining({id: 'attempt-2', answer: 'Quadruplica.', replyToFeedbackId: 'feedback-1', sourceObjectRevision: 1})]);
    expect(await reopened.executeLearning(teacher, command)).toEqual(receipt);
    expect(reopened.learningEvents(learner, 'lesson').find(event => event.type === 'review-learner-attempt')).toMatchObject({actorId: 'teacher', studentId: 'learner'});
  });

  it('checks live sharing and ownership before feedback idempotency and source reads', async () => {
    const {core} = await fixture(); const unavailable = {code: 'NOT_FOUND'};
    await expect(core.executeLearning(teacher, feedback(core))).rejects.toMatchObject(unavailable);
    await share(core); const command = feedback(core); await core.executeLearning(teacher, command);
    for (const actor of [learner, other, {...teacher, actorId: 'outsider'}]) await expect(core.executeLearning(actor, command)).rejects.toMatchObject({code: actor.role === 'student' ? 'FORBIDDEN' : 'NOT_FOUND'});
    await share(core, false);
    await expect(core.executeLearning(teacher, command)).rejects.toMatchObject(unavailable);
    await expect(core.readAttemptSource(teacher, 'lesson', 'attempt-1', learner.actorId)).rejects.toMatchObject(unavailable);
    expect(core.getLearnerWork(learner, 'lesson')!.feedback).toHaveLength(1);
    await core.executeLearning(teacher, {kind: 'revoke-assignment', commandId: 'revoke', documentId: 'lesson', studentId: learner.actorId, expectedRevision: 1});
    await expect(core.readAttemptSource(learner, 'lesson', 'attempt-1')).rejects.toMatchObject(unavailable);
  });

  it('rejects stale feedback, reused IDs and invalid correction links without changing durable state', async () => {
    const {core, storage} = await fixture(); await share(core); await core.executeLearning(teacher, feedback(core));
    for (const command of [feedback(core, {commandId: 'stale', expectedRevision: 2}), feedback(core, {commandId: 'duplicate'}),
      feedback(core, {commandId: 'missing', attemptId: 'missing', feedbackId: 'new'}),
      feedback(core, {commandId: 'fork', feedbackId: 'new'}),
      {kind: 'record-learner-attempt', commandId: 'invalid-reply', documentId: 'lesson', expectedRevision: revision(core), expectedDocumentRevision: 2,
        objectId: 'exercise', attemptId: 'attempt-2', answer: 'Quadruplica.', replyToFeedbackId: 'missing'} as LearningCommand]) {
      const before = await storage.read();
      await expect(core.executeLearning(command.kind === 'record-learner-attempt' ? learner : teacher, command)).rejects.toBeTruthy();
      expect(await storage.read()).toEqual(before);
    }
    await core.executeLearning(teacher, feedback(core, {commandId: 'rectify', feedbackId: 'feedback-2', supersedesFeedbackId: 'feedback-1', outcome: 'partial', comment: 'Hai identificato la crescita.'}));
    expect(core.getLearnerWork(learner, 'lesson')!.feedback).toHaveLength(2);
    await expect(core.executeLearning(learner, {kind: 'record-learner-attempt', commandId: 'old-reply', documentId: 'lesson', expectedRevision: revision(core), expectedDocumentRevision: 2,
      objectId: 'exercise', attemptId: 'attempt-2', answer: 'Quadruplica.', replyToFeedbackId: 'feedback-1'})).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
  });

  it('reads only the historical source named by an authorized attempt, even after deletion', async () => {
    const {core} = await fixture();
    await core.execute(teacher, {kind: 'remove-object', commandId: 'remove', documentId: 'lesson', expectedRevision: 2, objectId: 'exercise'});
    const source = await core.readAttemptSource(learner, 'lesson', 'attempt-1');
    expect(source).toMatchObject({id: 'exercise', revision: 1, data: {text: 'Se raddoppia x, come cambia E = kx²/2?'}});
    source.title = 'mutated'; expect((await core.readAttemptSource(learner, 'lesson', 'attempt-1')).title).toBe('Energia elastica');
    await expect(core.readAttemptSource(other, 'lesson', 'attempt-1', learner.actorId)).rejects.toMatchObject({code: 'NOT_FOUND'});
    await expect(core.readAttemptSource(learner, 'lesson', 'unrelated')).rejects.toMatchObject({code: 'NOT_FOUND'});
    expect(() => core.getObjectRevision(learner, 'lesson', 'exercise', 1)).toThrowError(expect.objectContaining({code: 'NOT_FOUND'}));
  });

  it('commits feedback, event and receipt atomically and resolves concurrent work through CAS', async () => {
    const {core, storage} = await fixture(); await share(core); const before = core.snapshot(); storage.fail = true;
    await expect(core.executeLearning(teacher, feedback(core))).rejects.toMatchObject({code: 'STORAGE_FAILURE'});
    expect(core.snapshot()).toEqual(before); expect(await storage.read()).toEqual(before); storage.fail = false;
    const results = await Promise.allSettled([core.executeLearning(teacher, feedback(core)), core.executeLearning(learner,
      {kind: 'save-learner-note', commandId: 'race-note', documentId: 'lesson', expectedRevision: revision(core), text: 'Appunto concorrente'})]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(results[1]).toMatchObject({reason: {code: 'REVISION_CONFLICT'}});
  });

  it('rejects forged authors, disconnected feedback and student rewrites when reopening', async () => {
    const {core} = await fixture(); await share(core); await core.executeLearning(teacher, feedback(core));
    const valid = core.snapshot();
    for (const mutate of [
      (snapshot: CoreSnapshot) => {snapshot.learnerWork[0]!.feedback![0]!.authorId = 'learner';},
      (snapshot: CoreSnapshot) => {snapshot.events.at(-1)!.actorId = 'learner'; snapshot.receipts.at(-1)!.actorId = 'learner';},
      (snapshot: CoreSnapshot) => {const event = snapshot.events.at(-1)!; if ('stream' in event) event.type = 'save-learner-note';},
    ]) {const copy = structuredClone(valid); mutate(copy); expect(CoreSnapshotSchema.safeParse(copy).success).toBe(false);}
  });

  it('opens v4 without rewriting history, preserves old attempt fingerprints and rejects newer fields disguised as v4', async () => {
    const {core, attempt, receipt} = await fixture();
    const old = {...preCourse(core.snapshot()), schemaVersion: 4}; const storage = new Storage(old);
    const reopened = await createCore({storage});
    expect(reopened.snapshot()).toEqual({...old, schemaVersion: 11, notebookLibraries: [], tutorRecords: [], courses: [], courseEditions: [], courseDeliveries: [], courseWork: []}); expect(await storage.read()).toEqual(old); expect(storage.writes).toBe(0);
    expect(await reopened.executeLearning(learner, attempt)).toEqual(receipt); expect(storage.writes).toBe(0);
    await share(core); await core.executeLearning(teacher, feedback(core));
    const forged = {...preCourse(core.snapshot()), schemaVersion: 4};
    expect(migrateSnapshotForOpen(forged)).toBe(forged);
    await expect(createCore({storage: new Storage(forged)})).rejects.toMatchObject({code: 'INVALID_SNAPSHOT'});
  });
});

// Model historical envelopes with exactly their old fields, not a relabelled v7 snapshot.
function preCourse<T extends object>(snapshot: T) {
  const {notebookLibraries: _notebooks, tutorRecords: _t, courses: _c, courseEditions: _e, courseDeliveries: _d, courseWork: _w, ...legacy} = snapshot as T & {notebookLibraries?: unknown; tutorRecords?: unknown; courses?: unknown; courseEditions?: unknown; courseDeliveries?: unknown; courseWork?: unknown};
  return legacy;
}
