import {describe, expect, it} from 'vitest';
import {CourseInputSchema, emptySnapshot, migrateSnapshotForOpen, type CourseCommand} from '@ardesia/contracts';
import {createCore, MemoryStorage} from './index';

const teacher = {actorId: 'author', role: 'teacher'} as const;
const student = {actorId: 'learner', role: 'student'} as const;
const stranger = {actorId: 'other', role: 'student'} as const;
const input = CourseInputSchema.parse({title: 'Forze e molle', description: 'Modello statico', license: 'All rights reserved', units: [{
  id: 'unit-a', title: 'Equilibrio', objective: 'Determinare k', prerequisites: 'Metri e newton', explanation: 'F=kx in equilibrio nel regime elastico.',
  prediction: 'Come cambia x?', activity: 'Calcola x per F=3 N e k=150 N/m.', referenceFeedback: 'x=0,02 m.',
  recovery: 'Converti centimetri in metri.', transfer: 'Scegli una molla per un carico con estensione massima assegnata e motiva.', sources: [], lesson: null,
}]});
async function fixture(link = false) {
  let n = 0; const storage = new MemoryStorage();
  const core = await createCore({storage, id: () => `event-${++n}`, clock: () => '2026-11-07T12:00:00.000Z'});
  if (link) {
    await core.execute(teacher, {kind: 'create-document', commandId: 'doc', documentId: 'lesson', expectedRevision: 0, title: 'Materiale'});
    await core.execute(teacher, {kind: 'add-object', commandId: 'note', documentId: 'lesson', expectedRevision: 1,
      object: {id: 'note', type: 'note', title: 'Originale', x: 0, y: 0, width: 200, height: 100, data: {text: 'Prima versione'}}});
  }
  const value = structuredClone(input); if (link) value.units[0]!.lesson = {documentId: 'lesson', revision: 2};
  await core.executeCourse(teacher, {kind: 'save-course', commandId: 'save', courseId: 'course', expectedRevision: 0, input: value});
  await core.executeCourse(teacher, {kind: 'create-course-edition', commandId: 'edition', editionId: 'edition', courseId: 'course', courseRevision: 1, expectedRevision: 0, label: 'Prima edizione'});
  await core.executeCourse(teacher, {kind: 'assign-course', commandId: 'assign', deliveryId: 'delivery', editionId: 'edition', learnerId: student.actorId, expectedRevision: 0});
  return {core, storage};
}
const answer: CourseCommand = {kind: 'record-course-attempt', commandId: 'answer', deliveryId: 'delivery', expectedRevision: 0,
  unitId: 'unit-a', stage: 'prediction', attemptId: 'attempt', answer: 'Raddoppia.'};

describe('versioned courses and private learning', () => {
  it('pins course, unit and lesson revisions while the author edits and removes material', async () => {
    const {core, storage} = await fixture(true);
    const edited = structuredClone(input); edited.units[0]!.explanation = 'Nuova spiegazione';
    await core.executeCourse(teacher, {kind: 'save-course', commandId: 'change', courseId: 'course', expectedRevision: 1, input: edited});
    await core.execute(teacher, {kind: 'remove-object', commandId: 'remove', documentId: 'lesson', expectedRevision: 2, objectId: 'note'});
    expect(core.getCourseSpace(teacher).courses[0]!.units[0]!.revision).toBe(2);
    expect(core.getCourseSpace(student).courses).toEqual([]);
    expect(core.getCourseSpace(student).editions[0]!.course.units[0]!.explanation).toBe(input.units[0]!.explanation);
    expect((await core.readCourseLesson(student, 'edition', 'unit-a')).objects[0]!.title).toBe('Originale');
    expect(core.listAssignments(student)).toEqual([]);
    await expect(core.readCourseLesson(stranger, 'edition', 'unit-a')).rejects.toMatchObject({code: 'NOT_FOUND'});
    expect(() => core.getAssignedDocument(student, 'lesson')).toThrow();
    const reopened = await createCore({storage});
    expect(reopened.getCourseSpace(student)).toEqual(core.getCourseSpace(student));
  });
  it('keeps responses private, shares explicitly, revokes without erasing, and refuses old pending commands', async () => {
    const {core} = await fixture();
    const receipt = await core.executeCourse(student, answer);
    expect(await core.executeCourse(student, answer)).toEqual(receipt);
    expect(core.getCourseSpace(teacher).work).toEqual([]);
    expect(core.getCourseSpace(stranger)).toEqual({courses: [], editions: [], deliveries: [], work: []});
    await core.executeCourse(student, {kind: 'share-course-work', commandId: 'share', deliveryId: 'delivery', expectedRevision: 1, shared: true});
    expect(core.getCourseSpace(teacher).work[0]!.attempts).toHaveLength(1);
    await core.executeCourse(student, {kind: 'share-course-work', commandId: 'unshare', deliveryId: 'delivery', expectedRevision: 2, shared: false});
    expect(core.getCourseSpace(teacher).work).toEqual([]);
    await core.executeCourse(teacher, {kind: 'revoke-course-delivery', commandId: 'revoke', deliveryId: 'delivery', expectedRevision: 1});
    expect(core.getCourseSpace(student).editions).toEqual([]);
    expect(core.getCourseSpace(student).work[0]!.attempts).toHaveLength(1);
    await expect(core.executeCourse(student, answer)).rejects.toMatchObject({code: 'NOT_FOUND'});
    await expect(core.executeCourse(teacher, {kind: 'assign-course', commandId: 'reuse', deliveryId: 'delivery', editionId: 'edition', learnerId: student.actorId, expectedRevision: 0})).rejects.toMatchObject({code: 'ALREADY_EXISTS'});
    await core.executeCourse(teacher, {kind: 'assign-course', commandId: 'new', deliveryId: 'new-delivery', editionId: 'edition', learnerId: student.actorId, expectedRevision: 0});
    expect(core.getCourseSpace(student).work.find(value => value.id === 'new-delivery')).toBeUndefined();
  });
  it('records assistance and immutable attempts, without manufacturing grades or completion', async () => {
    const {core} = await fixture();
    await core.executeCourse(student, answer);
    await core.executeCourse(student, {kind: 'view-course-help', commandId: 'help', deliveryId: 'delivery', expectedRevision: 1, unitId: 'unit-a', help: 'recovery'});
    await core.executeCourse(student, {...answer, commandId: 'second', attemptId: 'attempt-2', expectedRevision: 2, stage: 'activity', answer: '0,02 m'});
    const work = core.getCourseSpace(student).work[0]!;
    expect(work.attempts.map(value => value.helpUsed)).toEqual([[], ['recovery']]);
    expect(work).not.toHaveProperty('score'); expect(work).not.toHaveProperty('mastery');
    await expect(core.executeCourse(student, {...answer, commandId: 'stale'})).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    await expect(core.executeCourse(stranger, answer)).rejects.toMatchObject({code: 'NOT_FOUND'});
  });
  it('supports genuine author self-study without impersonating a student', async () => {
    const {core} = await fixture();
    await core.executeCourse(teacher, {kind: 'assign-course', commandId: 'self', deliveryId: 'self', editionId: 'edition', learnerId: teacher.actorId, expectedRevision: 0});
    await core.executeCourse(teacher, {...answer, deliveryId: 'self'});
    expect(core.getCourseSpace(teacher).work[0]!.attempts).toHaveLength(1);
    expect(core.snapshot().events.at(-1)).toMatchObject({actorRole: 'teacher'});
  });
  it('keeps failed writes atomic and requires complete draft learning phases for an edition', async () => {
    const {core, storage} = await fixture(); const before = core.snapshot();
    storage.write = async () => {throw Error('disk');};
    await expect(core.executeCourse(student, answer)).rejects.toMatchObject({code: 'STORAGE_FAILURE'});
    expect(core.snapshot()).toEqual(before);
    const restored = await createCore({storage: new MemoryStorage(before)});
    const incomplete = structuredClone(input); incomplete.units[0]!.transfer = '';
    await restored.executeCourse(teacher, {kind: 'save-course', commandId: 'incomplete', courseId: 'course', expectedRevision: 1, input: incomplete});
    await expect(restored.executeCourse(teacher, {kind: 'create-course-edition', commandId: 'bad-edition', editionId: 'edition-2', courseId: 'course', courseRevision: 2, expectedRevision: 0, label: 'Incomplete'})).rejects.toMatchObject({code: 'INVALID_COMMAND'});
  });
  it.each(['content', 'actor', 'receipt', 'work', 'digest'] as const)('rejects %s corruption on opening a snapshot', async kind => {
    const {core} = await fixture(); await core.executeCourse(student, answer); const state = core.snapshot();
    if (kind === 'content') state.courses[0]!.units[0]!.explanation = 'Forged';
    if (kind === 'actor') {const event = state.events.at(-1)!; event.actorId = 'other'; state.receipts.at(-1)!.actorId = 'other';}
    if (kind === 'receipt') state.receipts.at(-1)!.fingerprint = '0'.repeat(64);
    if (kind === 'work') state.courseWork[0]!.attempts[0]!.answer = 'Forged';
    if (kind === 'digest') state.courseEditions[0]!.courseDigest = '0'.repeat(64);
    await expect(createCore({storage: new MemoryStorage(state)})).rejects.toMatchObject({code: 'INVALID_SNAPSHOT'});
  });
  it('migrates v6 in memory and refuses new course fields disguised as legacy data', async () => {
    const {tutorRecords, courses, courseEditions, courseDeliveries, courseWork, ...old} = emptySnapshot();
    const legacy = {...old, schemaVersion: 6}; const original = JSON.stringify(legacy);
    const storage = new MemoryStorage(legacy); const core = await createCore({storage});
    expect(core.snapshot().schemaVersion).toBe(10); expect(JSON.stringify(await storage.read())).toBe(original);
    expect(migrateSnapshotForOpen({...legacy, courses})).toEqual({...legacy, courses});
  });
});
