import {describe, expect, it} from 'vitest';
import {
  CoreSnapshotSchema, migrateSnapshotForOpen,
  type Actor, type CoreSnapshot, type LearningCommand, type NewEducationalObject, type PluginRelease,
} from '@ardesia/contracts';
import {createCore, MemoryStorage, type CoreService, type PluginPolicyRequest} from './index';

const teacher: Actor = {actorId: 'teacher-andrea', role: 'teacher'};
const otherTeacher: Actor = {actorId: 'teacher-other', role: 'teacher'};
const student: Actor = {actorId: 'student-one', role: 'student'};
const second: Actor = {actorId: 'student-two', role: 'student'};
const outsider: Actor = {actorId: 'student-outside', role: 'student'};
const release: PluginRelease = {
  pluginId: 'ardesia.ideal-spring', version: '1.0.0', bundleDigest: 'a'.repeat(64),
  publisher: {id: 'ardesia', keyId: 'key-one'}, license: 'UNLICENSED',
  provenance: {repository: 'https://github.com/AndreaMarro/ardesia-next', commit: '1'.repeat(40), path: 'plugins/ideal-spring/src/worker.ts'},
  sdkVersion: '1.0.0', stateSchemaVersion: '1.0.0', capabilities: ['state:read', 'state:write'],
};
const lab: Extract<NewEducationalObject, {type: 'lab'}> = {
  id: 'lab-one', type: 'lab', title: 'Molla ideale', x: 10, y: 10, width: 400, height: 300,
  data: {pluginId: release.pluginId, pluginVersion: release.version, instanceId: 'instance-one', stateSchemaVersion: '1.0.0',
    bundleDigest: release.bundleDigest, publisher: release.publisher,
    state: {schemaVersion: '1.0.0', value: {massKg: 1, stiffnessNPerM: 20, initialDisplacementM: 0.2, initialVelocityMPerS: 0, timeS: 0}}},
};
const unavailable = expect.objectContaining({code: 'NOT_FOUND'});

class ObservedStorage extends MemoryStorage {
  writes = 0;
  fail = false;
  override async write(snapshot: CoreSnapshot) {
    if (this.fail) throw new Error('Temporary service failure');
    await super.write(snapshot);
    this.writes++;
  }
}

function options(storage = new ObservedStorage(), prefix = 'event') {
  let counter = 0;
  return {storage, clock: () => '2026-10-29T12:00:00.000Z', id: () => `${prefix}-${++counter}`};
}
function verifier() {
  const requests: PluginPolicyRequest[] = [];
  const control = {revoked: false};
  const policy = async (request: PluginPolicyRequest) => {
    requests.push(structuredClone(request));
    if (control.revoked || JSON.stringify(request.release) !== JSON.stringify(release)) throw new Error('Untrusted release');
    for (const data of request.states) {
      const value = data.state.value as {massKg?: unknown};
      if (data.state.schemaVersion !== '1.0.0' || typeof value.massKg !== 'number' || value.massKg <= 0 || value.massKg > 100) throw new Error('Invalid scientific state');
    }
  };
  return {policy, requests, control};
}

async function fixture(assign = true) {
  const config = options();
  const verification = verifier();
  const core = await createCore({...config, pluginPolicy: verification.policy});
  await core.execute(teacher, {kind: 'create-document', commandId: 'create', documentId: 'lesson-one', expectedRevision: 0, title: 'Oscillazioni'});
  await core.executePlugin(teacher, {kind: 'install-plugin', commandId: 'install', pluginId: release.pluginId, expectedRevision: 0, release});
  await core.executePlugin(teacher, {kind: 'consent-plugin', commandId: 'teacher-consent', pluginId: release.pluginId, expectedRevision: 1, releaseDigest: release.bundleDigest, capabilities: release.capabilities});
  await core.executePlugin(teacher, {kind: 'activate-plugin', commandId: 'activate', pluginId: release.pluginId, expectedRevision: 2});
  await core.execute(teacher, {kind: 'add-object', commandId: 'add-lab', documentId: 'lesson-one', expectedRevision: 1, object: lab});
  if (assign) for (const actor of [student, second]) {
    await core.executeLearning(teacher, {kind: 'assign-lesson', commandId: `assign-${actor.actorId}`, documentId: 'lesson-one', studentId: actor.actorId, expectedRevision: 0});
  }
  return {core, storage: config.storage, verification};
}

const workRevision = (core: CoreService, actor = student) => core.getLearnerWork(actor, 'lesson-one')?.revision ?? 0;
const note = (core: CoreService, text = 'Osservazione privata', actor = student, commandId = `note-${actor.actorId}`): LearningCommand => ({
  kind: 'save-learner-note', commandId, documentId: 'lesson-one', expectedRevision: workRevision(core, actor), text,
});
async function consent(core: CoreService, actor = student) {
  return core.executeLearning(actor, {kind: 'consent-lab', commandId: `consent-${actor.actorId}-${workRevision(core, actor)}`, documentId: 'lesson-one',
    expectedRevision: workRevision(core, actor), objectId: lab.id, releaseDigest: release.bundleDigest, capabilities: release.capabilities});
}
function saveLab(core: CoreService, massKg = 4, actor = student, commandId = `save-${actor.actorId}`): LearningCommand {
  return {kind: 'save-learner-lab', commandId, documentId: 'lesson-one', expectedRevision: workRevision(core, actor), expectedDocumentRevision: 2,
    objectId: lab.id, instanceId: lab.data.instanceId, state: {schemaVersion: '1.0.0', value: {massKg, stiffnessNPerM: 20, initialDisplacementM: 0.2, initialVelocityMPerS: 0, timeS: 0}}};
}

describe('M3 Core lesson assignments and private learner continuity', () => {
  it('assigns drafts explicitly without approval and keeps direct owner APIs private', async () => {
    const {core} = await fixture();
    expect(core.getAssignedDocument(student, 'lesson-one')).toMatchObject({id: 'lesson-one', status: 'draft', objects: [{id: lab.id, status: 'draft'}]});
    expect(core.listAssignments(student)).toHaveLength(1);
    expect(core.listAssignments(teacher)).toHaveLength(2);
    expect(core.listAssignments(otherTeacher)).toEqual([]);
    expect(core.listDocuments(student)).toEqual([]);
    expect(core.listInstallations(student)).toEqual([]);
    expect(core.getInstallation(student, release.pluginId)).toBeNull();
    for (const actor of [student, second, outsider, {...teacher, role: 'student' as const}]) {
      expect(() => core.getDocument(actor, 'lesson-one')).toThrowError(unavailable);
      expect(() => core.events(actor, 'lesson-one')).toThrowError(unavailable);
      expect(() => core.getObjectRevision(actor, 'lesson-one', lab.id, 1)).toThrowError(unavailable);
    }
    expect(() => core.getAssignedDocument(outsider, 'lesson-one')).toThrowError(unavailable);
    expect(() => core.getAssignedDocument(student, 'known-unassigned-id')).toThrowError(unavailable);
    await expect(core.executeLearning(student, {kind: 'assign-lesson', commandId: 'self-grant', documentId: 'lesson-one', studentId: outsider.actorId, expectedRevision: 0})).rejects.toMatchObject({code: 'FORBIDDEN'});
    await expect(core.executeLearning(otherTeacher, {kind: 'assign-lesson', commandId: 'other-grant', documentId: 'lesson-one', studentId: outsider.actorId, expectedRevision: 0})).rejects.toMatchObject({code: 'NOT_FOUND'});
  });

  it('persists distinct private notes and denies known-ID reads across students and teachers', async () => {
    const {core, storage, verification} = await fixture();
    await core.executeLearning(student, note(core));
    await core.executeLearning(second, note(core, 'Appunti secondo account', second));
    expect(core.getLearnerWork(student, 'lesson-one')).toMatchObject({studentId: student.actorId, notes: 'Osservazione privata', evidenceShared: false});
    expect(core.getLearnerWork(second, 'lesson-one')).toMatchObject({studentId: second.actorId, notes: 'Appunti secondo account'});
    for (const operation of [
      () => core.getLearnerWork(second, 'lesson-one', student.actorId),
      () => core.learningEvents(second, 'lesson-one', student.actorId),
      () => core.getLearnerWork(teacher, 'lesson-one', student.actorId),
      () => core.getLearnerWork(otherTeacher, 'lesson-one', student.actorId),
      () => core.learningEvents(teacher, 'lesson-one', student.actorId),
    ]) expect(operation).toThrowError(unavailable);
    const reopened = await createCore({...options(storage, 'second-session'), pluginPolicy: verification.policy});
    expect(reopened.getLearnerWork(student, 'lesson-one')).toEqual(core.getLearnerWork(student, 'lesson-one'));
    expect(reopened.learningEvents(student, 'lesson-one')).toEqual(core.learningEvents(student, 'lesson-one'));
    expect(core.getDocument(teacher, 'lesson-one').revision).toBe(2);
  });

  it('requires separate learner consent and preserves laboratory identities and both revisions', async () => {
    const {core, storage, verification} = await fixture();
    expect(core.getAssignedLabAccess(student, 'lesson-one', lab.id)).toMatchObject({status: 'active', consented: false, installationRevision: 3, workRevision: 0});
    await expect(core.executeLearning(student, saveLab(core))).rejects.toMatchObject({code: 'PLUGIN_CONSENT_REQUIRED'});
    expect(core.getLearnerWork(student, 'lesson-one')).toBeNull();
    await consent(core);
    const consentPolicy = verification.requests.at(-1)!;
    expect(consentPolicy).toMatchObject({operation: 'consent', actor: student, states: []});
    await core.executeLearning(student, saveLab(core));
    const saved = core.getLearnerWork(student, 'lesson-one')!;
    expect(saved).toMatchObject({revision: 2, labs: [{objectId: lab.id, sourceObjectRevision: 1, revision: 1,
      data: {instanceId: lab.data.instanceId, state: {value: {massKg: 4}}}}]});
    expect(verification.requests.at(-1)).toMatchObject({operation: 'use', actor: student});
    expect(core.getLearnerWork(second, 'lesson-one')).toBeNull();
    expect(core.getDocument(teacher, 'lesson-one').objects[0]).toMatchObject({revision: 1, data: {state: {value: {massKg: 1}}}});
    const reopened = await createCore({...options(storage, 'reopened'), pluginPolicy: verification.policy});
    expect(reopened.getLearnerWork(student, 'lesson-one')).toEqual(saved);
    expect(reopened.getAssignedLabAccess(student, 'lesson-one', lab.id)).toMatchObject({consented: true, workRevision: 2});
  });

  it('rejects incomplete consent, forged instance, scientific state and source revision without changes', async () => {
    const {core} = await fixture();
    await expect(core.executeLearning(student, {kind: 'consent-lab', commandId: 'partial', documentId: 'lesson-one', objectId: lab.id,
      expectedRevision: 0, releaseDigest: release.bundleDigest, capabilities: ['state:read']})).rejects.toMatchObject({code: 'PLUGIN_CONSENT_REQUIRED'});
    await consent(core);
    const before = core.snapshot();
    const valid = saveLab(core) as Extract<LearningCommand, {kind: 'save-learner-lab'}>;
    for (const [command, code] of [
      [{...valid, instanceId: 'forged-instance'}, 'INVALID_REFERENCE'],
      [{...valid, expectedDocumentRevision: 1}, 'REVISION_CONFLICT'],
      [{...valid, objectId: 'another-lab'}, 'NOT_FOUND'],
      [saveLab(core, -10), 'PLUGIN_POLICY_REJECTED'],
      [{...valid, state: {schemaVersion: '2.0.0', value: {massKg: 4}}}, 'INVALID_REFERENCE'],
    ] as const) {
      await expect(core.executeLearning(student, command)).rejects.toMatchObject({code});
      expect(core.snapshot()).toEqual(before);
    }
  });

  it('enforces learner consent revocation and teacher disable against a stale session', async () => {
    const {core} = await fixture();
    await consent(core);
    await core.executeLearning(student, saveLab(core));
    await core.executeLearning(student, {kind: 'revoke-lab-consent', commandId: 'student-revoke', documentId: 'lesson-one', objectId: lab.id, expectedRevision: 2});
    expect(core.getAssignedLabAccess(student, 'lesson-one', lab.id).consented).toBe(false);
    await expect(core.executeLearning(student, saveLab(core, 5, student, 'after-consent-revoke'))).rejects.toMatchObject({code: 'PLUGIN_CONSENT_REQUIRED'});
    expect(core.getLearnerWork(student, 'lesson-one')!.labs[0]!.data.state.value).toMatchObject({massKg: 4});
    await consent(core);
    const staleSave = saveLab(core, 8, student, 'stale-save');
    await core.executePlugin(teacher, {kind: 'disable-plugin', commandId: 'disable', pluginId: release.pluginId, expectedRevision: 3});
    await expect(core.executeLearning(student, staleSave)).rejects.toMatchObject({code: 'PLUGIN_NOT_ACTIVE'});
    expect(core.getAssignedLabAccess(student, 'lesson-one', lab.id).status).toBe('disabled');
    expect(core.getLearnerWork(student, 'lesson-one')!.labs[0]!.data.state.value).toMatchObject({massKg: 4});
  });

  it('withdraws teacher consent without making the installation irreversibly revoked', async () => {
    const {core} = await fixture();
    await core.executePlugin(teacher, {kind: 'withdraw-plugin-consent', commandId: 'import-withdraw', pluginId: release.pluginId, expectedRevision: 3});
    expect(core.getInstallation(teacher, release.pluginId)).toMatchObject({status: 'disabled', consent: null, revision: 4});
    await expect(core.executePlugin(teacher, {kind: 'activate-plugin', commandId: 'cannot-auto-activate', pluginId: release.pluginId, expectedRevision: 4})).rejects.toMatchObject({code: 'PLUGIN_CONSENT_REQUIRED'});
    await core.executePlugin(teacher, {kind: 'consent-plugin', commandId: 'new-consent', pluginId: release.pluginId, expectedRevision: 4, releaseDigest: release.bundleDigest, capabilities: release.capabilities});
    await core.executePlugin(teacher, {kind: 'activate-plugin', commandId: 'new-activation', pluginId: release.pluginId, expectedRevision: 5});
    expect(core.getInstallation(teacher, release.pluginId)).toMatchObject({status: 'active', revision: 6});
    expect(core.snapshot().events.find(event => event.type === 'withdraw-plugin-consent')!.payload).toMatchObject({previous: {consent: {actorId: teacher.actorId}}, installation: {consent: null}});
  });

  it('revokes assigned access before any direct read or idempotent replay while preserving saved work', async () => {
    const {core} = await fixture();
    const command = note(core);
    await core.executeLearning(student, command);
    await core.executeLearning(teacher, {kind: 'revoke-assignment', commandId: 'revoke-access', documentId: 'lesson-one', studentId: student.actorId, expectedRevision: 1});
    for (const operation of [
      () => core.getAssignedDocument(student, 'lesson-one'), () => core.getLearnerWork(student, 'lesson-one'),
      () => core.learningEvents(student, 'lesson-one'), () => core.getAssignedLabAccess(student, 'lesson-one', lab.id),
    ]) expect(operation).toThrowError(unavailable);
    await expect(core.executeLearning(student, command)).rejects.toMatchObject({code: 'NOT_FOUND'});
    expect(core.listAssignments(student)).toEqual([]);
    await expect(core.executeLearning(teacher, {kind: 'assign-lesson', commandId: 'stale-grant', documentId: 'lesson-one', studentId: student.actorId, expectedRevision: 1})).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    await core.executeLearning(teacher, {kind: 'assign-lesson', commandId: 'fresh-grant', documentId: 'lesson-one', studentId: student.actorId, expectedRevision: 2});
    expect(core.getLearnerWork(student, 'lesson-one')).toMatchObject({revision: 1, notes: 'Osservazione privata'});
  });

  it('shares current evidence explicitly and never exposes earlier private history to the teacher', async () => {
    const {core} = await fixture();
    await core.executeLearning(student, note(core, 'Testo privato poi eliminato'));
    await core.executeLearning(student, note(core, 'Riepilogo condivisibile', student, 'revised-note'));
    await consent(core);
    await core.executeLearning(student, {kind: 'share-learner-evidence', commandId: 'share', documentId: 'lesson-one', expectedRevision: 3, shared: true});
    expect(core.getLearnerWork(teacher, 'lesson-one', student.actorId)).toMatchObject({notes: 'Riepilogo condivisibile', evidenceShared: true, consents: []});
    const visibleEvents = core.learningEvents(teacher, 'lesson-one', student.actorId);
    expect(visibleEvents).toHaveLength(1);
    expect(visibleEvents[0]!.payload).toMatchObject({previous: null, work: {consents: []}});
    expect(JSON.stringify(visibleEvents)).not.toContain('Testo privato poi eliminato');
    expect(() => core.getLearnerWork(second, 'lesson-one', student.actorId)).toThrowError(unavailable);
    await core.executeLearning(student, {kind: 'share-learner-evidence', commandId: 'unshare', documentId: 'lesson-one', expectedRevision: 4, shared: false});
    expect(() => core.getLearnerWork(teacher, 'lesson-one', student.actorId)).toThrowError(unavailable);
    expect(() => core.learningEvents(teacher, 'lesson-one', student.actorId)).toThrowError(unavailable);
  });

  it('records immutable attempt IDs against exact source object revisions', async () => {
    const {core} = await fixture();
    const attempt: LearningCommand = {kind: 'record-learner-attempt', commandId: 'answer', documentId: 'lesson-one', expectedRevision: 0,
      expectedDocumentRevision: 2, objectId: lab.id, attemptId: 'attempt-one', answer: 'Aumentando la massa cresce il periodo.'};
    await core.executeLearning(student, attempt);
    expect(core.getLearnerWork(student, 'lesson-one')!.attempts).toEqual([{id: 'attempt-one', objectId: lab.id, sourceObjectRevision: 1,
      answer: 'Aumentando la massa cresce il periodo.', createdAt: '2026-10-29T12:00:00.000Z'}]);
    await expect(core.executeLearning(student, {...attempt, commandId: 'replace-answer', expectedRevision: 1, answer: 'Un altro risultato'})).rejects.toMatchObject({code: 'ALREADY_EXISTS'});
  });

  it('retries after a lost response with the same receipt and rejects changed payloads', async () => {
    const {core, storage, verification} = await fixture();
    const command = note(core);
    const receipt = await core.executeLearning(student, command);
    const writes = storage.writes;
    expect(await core.executeLearning(student, command)).toEqual(receipt);
    expect(storage.writes).toBe(writes);
    const reopened = await createCore({...options(storage, 'retry-session'), pluginPolicy: verification.policy});
    expect(await reopened.executeLearning(student, command)).toEqual(receipt);
    await expect(reopened.executeLearning(student, {...command, text: 'Changed'} as LearningCommand)).rejects.toMatchObject({code: 'IDEMPOTENCY_CONFLICT'});
    await expect(reopened.executeLearning(second, {...command, expectedRevision: 0})).rejects.toMatchObject({code: 'IDEMPOTENCY_CONFLICT'});
  });

  it('serializes concurrent requests and accepts only one write to an expected work revision', async () => {
    const {core} = await fixture();
    const results = await Promise.allSettled([
      core.executeLearning(student, note(core, 'Prima richiesta', student, 'concurrent-one')),
      core.executeLearning(student, note(core, 'Seconda richiesta', student, 'concurrent-two')),
    ]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(results[1]).toMatchObject({reason: {code: 'REVISION_CONFLICT'}});
    expect(core.getLearnerWork(student, 'lesson-one')).toMatchObject({revision: 1, notes: 'Prima richiesta'});
    expect(CoreSnapshotSchema.safeParse(core.snapshot()).success).toBe(true);
  });

  it('rolls back failed storage and verifier operations without events, receipt or partial work', async () => {
    const {core, storage, verification} = await fixture();
    const before = core.snapshot();
    storage.fail = true;
    const command = note(core);
    await expect(core.executeLearning(student, command)).rejects.toMatchObject({code: 'STORAGE_FAILURE'});
    expect(core.snapshot()).toEqual(before);
    expect(await storage.read()).toEqual(before);
    storage.fail = false;
    await core.executeLearning(student, command);
    await consent(core);
    const beforeRevocation = core.snapshot();
    verification.control.revoked = true;
    await expect(core.executeLearning(student, saveLab(core))).rejects.toMatchObject({code: 'PLUGIN_POLICY_REJECTED'});
    expect(core.snapshot()).toEqual(beforeRevocation);
    expect(await storage.read()).toEqual(beforeRevocation);
  });

  it('clones queued requests and returned projections so callers cannot mutate authority', async () => {
    const {core} = await fixture();
    const command = note(core) as Extract<LearningCommand, {kind: 'save-learner-note'}>;
    const pending = core.executeLearning(student, command);
    command.text = 'Caller mutation';
    await pending;
    const work = core.getLearnerWork(student, 'lesson-one')!;
    work.notes = 'Mutated projection';
    const assignment = core.listAssignments(student)[0]!;
    assignment.status = 'revoked';
    core.getAssignedDocument(student, 'lesson-one').objects.length = 0;
    const access = core.getAssignedLabAccess(student, 'lesson-one', lab.id);
    access.release!.bundleDigest = 'f'.repeat(64);
    expect(core.getLearnerWork(student, 'lesson-one')!.notes).toBe('Osservazione privata');
    expect(core.getAssignedDocument(student, 'lesson-one').objects).toHaveLength(1);
    expect(core.getAssignedLabAccess(student, 'lesson-one', lab.id).release!.bundleDigest).toBe(release.bundleDigest);
  });

  it('rejects injected actor, ownership and unbounded learner data in commands', async () => {
    const {core} = await fixture();
    const before = core.snapshot();
    for (const forged of [
      {...note(core), actorId: teacher.actorId}, {...note(core), studentId: second.actorId},
      {...note(core), ownerId: teacher.actorId}, {...note(core), text: 'x'.repeat(100_001)},
    ]) await expect(core.executeLearning(student, forged as LearningCommand)).rejects.toMatchObject({code: 'INVALID_COMMAND'});
    expect(core.snapshot()).toEqual(before);
  });

  it('detects orphaned, duplicated, altered and unreceipted learning records on reopen', async () => {
    const {core} = await fixture();
    await core.executeLearning(student, note(core));
    const valid = core.snapshot();
    for (const mutate of [
      (state: CoreSnapshot) => {state.assignments.push(structuredClone(state.assignments[0]!));},
      (state: CoreSnapshot) => {state.learnerWork[0]!.revision++;},
      (state: CoreSnapshot) => {state.learnerWork[0]!.notes = 'Uncommitted change';},
      (state: CoreSnapshot) => {state.receipts.pop();},
      (state: CoreSnapshot) => {state.events.at(-1)!.actorId = second.actorId;},
      (state: CoreSnapshot) => {state.learnerWork[0]!.studentId = outsider.actorId;},
      (state: CoreSnapshot) => {state.events.pop();},
    ]) {
      const corrupted = structuredClone(valid); mutate(corrupted);
      const storage = new ObservedStorage(corrupted);
      await expect(createCore(options(storage))).rejects.toMatchObject({code: 'INVALID_SNAPSHOT'});
      expect(await storage.read()).toEqual(corrupted);
      expect(storage.writes).toBe(0);
    }
  });
});

describe('M3 read-only versioned migration', () => {
  it('opens v3 preserving all installation, consent, laboratory and idempotency evidence without writes', async () => {
    const {core} = await fixture(false);
    const {assignments: _assignments, learnerWork: _work, ...old} = core.snapshot();
    const legacy = {...old, schemaVersion: 3};
    const storage = new ObservedStorage(legacy);
    const reopened = await createCore({...options(storage, 'migration'), pluginPolicy: verifier().policy});
    expect(reopened.snapshot()).toEqual({...legacy, schemaVersion: 4, assignments: [], learnerWork: []});
    expect(await storage.read()).toEqual(legacy);
    expect(storage.writes).toBe(0);
    await reopened.executeLearning(teacher, {kind: 'assign-lesson', commandId: 'new-assignment', documentId: 'lesson-one', studentId: student.actorId, expectedRevision: 0});
    expect((await storage.read() as CoreSnapshot).schemaVersion).toBe(4);
    expect(reopened.snapshot().events.slice(0, legacy.events.length)).toEqual(legacy.events);
    expect(reopened.snapshot().receipts.slice(0, legacy.receipts.length)).toEqual(legacy.receipts);
    expect(reopened.snapshot().installations).toEqual(legacy.installations);
    expect(reopened.snapshot().documents).toEqual(legacy.documents);
  });

  it('roundtrips JSONB key ordering without changing snapshots, receipts or learner authorization', async () => {
    const {core, verification} = await fixture();
    await consent(core);
    const command = saveLab(core);
    const receipt = await core.executeLearning(student, command);
    const original = core.snapshot();
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder)
      : value !== null && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.length - b.length || a.localeCompare(b)).map(([key, entry]) => [key, reorder(entry)])) : value;
    const jsonb = JSON.parse(JSON.stringify(reorder(original)));
    const storage = new ObservedStorage(jsonb);
    const reopened = await createCore({...options(storage, 'jsonb'), pluginPolicy: verification.policy});
    expect(reopened.snapshot()).toEqual(original);
    expect(storage.writes).toBe(0);
    expect(await reopened.executeLearning(student, command)).toEqual(receipt);
    expect(storage.writes).toBe(0);
    expect(reopened.getAssignedLabAccess(student, 'lesson-one', lab.id).consented).toBe(true);
    await reopened.executeLearning(student, note(reopened, 'Continuazione dopo JSONB', student, 'after-jsonb'));
    expect(reopened.getLearnerWork(student, 'lesson-one')).toMatchObject({revision: 3, notes: 'Continuazione dopo JSONB'});
    expect(reopened.snapshot().receipts.find(entry => entry.commandId === command.commandId)).toEqual(receipt);
  });

  it('refuses forged legacy learning fields, invalid history and newer commands mislabeled as v3', async () => {
    const {core} = await fixture(false);
    const {assignments: _assignments, learnerWork: _work, ...old} = core.snapshot();
    for (const raw of [{...old, schemaVersion: 3, learnerWork: []}, {...old, schemaVersion: 3, receipts: []}]) {
      expect(migrateSnapshotForOpen(raw)).toBe(raw);
      const storage = new ObservedStorage(raw);
      await expect(createCore(options(storage))).rejects.toMatchObject({code: 'INVALID_SNAPSHOT'});
      expect(storage.writes).toBe(0);
    }
    await core.executePlugin(teacher, {kind: 'withdraw-plugin-consent', commandId: 'withdraw', pluginId: release.pluginId, expectedRevision: 3});
    const {assignments: _a, learnerWork: _w, ...newer} = core.snapshot();
    const invalid = {...newer, schemaVersion: 3};
    expect(migrateSnapshotForOpen(invalid)).toBe(invalid);
  });
});
