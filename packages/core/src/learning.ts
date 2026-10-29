import {
  CoreError, canonicalJson,
  type Actor, type AssignedLabAccess, type CoreSnapshot, type LabData, type LabObject, type LearnerWork,
  type LearningCommand, type LearningEvent, type LessonAssignment, type LessonDocument,
} from '@ardesia/contracts';
import {findInstallation, requireLabInstallation, verifyPluginPolicy, type PluginPolicy} from './plugin-commands';

const unavailable = () => new CoreError('NOT_FOUND', 'The requested learning resource is unavailable.');
const payload = (value: unknown): LearningEvent['payload'] => JSON.parse(JSON.stringify(value)) as LearningEvent['payload'];

export function activeAssignment(state: CoreSnapshot, studentId: string, documentId: string): LessonAssignment {
  const assignment = state.assignments.find(entry => entry.documentId === documentId && entry.studentId === studentId && entry.status === 'active');
  if (!assignment) throw unavailable();
  return assignment;
}

export function assignedDocument(state: CoreSnapshot, actor: Actor, documentId: string): LessonDocument {
  if (actor.role !== 'student') throw unavailable();
  activeAssignment(state, actor.actorId, documentId);
  const document = state.documents.find(document => document.id === documentId);
  if (!document) throw unavailable();
  return document;
}

/** Call before idempotency lookup too, so revocation cannot leak prior private results. */
export function authorizeLearningCommand(state: CoreSnapshot, actor: Actor, command: LearningCommand): void {
  if (command.kind === 'assign-lesson' || command.kind === 'revoke-assignment') {
    if (actor.role !== 'teacher') throw new CoreError('FORBIDDEN', 'Only the teacher owner may assign a lesson.');
    if (!state.documents.some(document => document.id === command.documentId && document.ownerId === actor.actorId)) throw unavailable();
    if (command.studentId === actor.actorId) throw new CoreError('INVALID_ACTOR', 'A teacher cannot assign a lesson to their own teacher identity.');
  } else {
    assignedDocument(state, actor, command.documentId);
  }
}

export function readableLearnerWork(state: CoreSnapshot, actor: Actor, documentId: string, requestedStudentId?: string): LearnerWork | null {
  const studentId = actor.role === 'student' ? actor.actorId : requestedStudentId;
  if (!studentId || (actor.role === 'student' && requestedStudentId !== undefined && requestedStudentId !== actor.actorId)) throw unavailable();
  activeAssignment(state, studentId, documentId);
  if (actor.role === 'student') assignedDocument(state, actor, documentId);
  else if (!state.documents.some(document => document.id === documentId && document.ownerId === actor.actorId)) throw unavailable();
  const work = state.learnerWork.find(entry => entry.documentId === documentId && entry.studentId === studentId) ?? null;
  // Sharing is a live, revocable policy. Ownership of the lesson grants no access to private work.
  if (actor.role === 'teacher' && !work?.evidenceShared) throw unavailable();
  return work;
}

function findLab(document: LessonDocument, objectId: string): LabObject {
  const object = document.objects.find(object => object.id === objectId);
  if (object?.type !== 'lab') throw unavailable();
  return object;
}

function teacherLabAuthorization(state: CoreSnapshot, document: LessonDocument, data: LabData, policy?: PluginPolicy) {
  if (!policy) throw new CoreError('PLUGIN_POLICY_REQUIRED', 'Remote learner laboratories require a release and state verifier.');
  const teacher: Actor = {actorId: document.ownerId, role: 'teacher'};
  // Validate against the current authoritative installation on every operation, including after stale browser reads.
  return requireLabInstallation(state, teacher, data);
}

export function assignedLabAccess(state: CoreSnapshot, actor: Actor, documentId: string, objectId: string): AssignedLabAccess {
  const document = assignedDocument(state, actor, documentId);
  const lab = findLab(document, objectId);
  const installation = findInstallation(state, {actorId: document.ownerId, role: 'teacher'}, lab.data.pluginId);
  const work = state.learnerWork.find(entry => entry.documentId === documentId && entry.studentId === actor.actorId);
  const consent = work?.consents.find(entry => entry.objectId === objectId && entry.instanceId === lab.data.instanceId);
  const release = installation?.release ?? null;
  const matching = release && release.pluginId === lab.data.pluginId && release.version === lab.data.pluginVersion
    && release.bundleDigest === lab.data.bundleDigest && release.publisher.id === lab.data.publisher.id
    && release.publisher.keyId === lab.data.publisher.keyId && release.stateSchemaVersion === lab.data.stateSchemaVersion;
  return {
    documentId, objectId, instanceId: lab.data.instanceId, pluginId: lab.data.pluginId, release,
    status: matching && installation ? installation.status : 'unavailable', installationRevision: installation?.revision ?? 0,
    consented: !!(matching && consent && consent.actorId === actor.actorId && canonicalJson(consent.release) === canonicalJson(release)),
    workRevision: work?.revision ?? 0,
  };
}

export type LearningCommandResult = {
  studentId: string; stream: LearningEvent['stream']; revision: number; payload: LearningEvent['payload'];
};

/** Mutates only the transaction clone. Core owns the atomic event, receipt and snapshot commit. */
export async function applyLearningCommand(state: CoreSnapshot, actor: Actor, command: LearningCommand, at: string, policy?: PluginPolicy): Promise<LearningCommandResult> {
  authorizeLearningCommand(state, actor, command);
  if (command.kind === 'assign-lesson' || command.kind === 'revoke-assignment') {
    const current = state.assignments.find(entry => entry.documentId === command.documentId && entry.studentId === command.studentId);
    if ((current?.revision ?? 0) !== command.expectedRevision) throw new CoreError('REVISION_CONFLICT', 'The lesson assignment changed. Reload before retrying.');
    if (command.kind === 'revoke-assignment' && !current) throw unavailable();
    const previous = current ? structuredClone(current) : null;
    const assignment: LessonAssignment = {
      documentId: command.documentId, studentId: command.studentId, assignedBy: actor.actorId,
      revision: (current?.revision ?? 0) + 1, status: command.kind === 'assign-lesson' ? 'active' : 'revoked',
      createdAt: current?.createdAt ?? at, updatedAt: at,
    };
    if (current) state.assignments = state.assignments.map(entry => entry === current ? assignment : entry);
    else state.assignments.push(assignment);
    return {studentId: command.studentId, stream: 'assignment', revision: assignment.revision, payload: payload({previous, assignment})};
  }

  const document = assignedDocument(state, actor, command.documentId);
  const current = state.learnerWork.find(entry => entry.documentId === command.documentId && entry.studentId === actor.actorId);
  if ((current?.revision ?? 0) !== command.expectedRevision) throw new CoreError('REVISION_CONFLICT', 'Your work changed in another session. Reload before retrying.');
  const previous = current ? structuredClone(current) : null;
  const work: LearnerWork = current ?? {
    documentId: command.documentId, studentId: actor.actorId, revision: 1,
    notes: '', labs: [], attempts: [], consents: [], evidenceShared: false, createdAt: at, updatedAt: at,
  };
  if ('expectedDocumentRevision' in command && command.expectedDocumentRevision !== document.revision) {
    throw new CoreError('REVISION_CONFLICT', 'The assigned lesson changed. Reload the source before saving new work.');
  }
  switch (command.kind) {
    case 'consent-lab': {
      const lab = findLab(document, command.objectId);
      const installation = teacherLabAuthorization(state, document, lab.data, policy);
      if (command.releaseDigest !== installation.release.bundleDigest) throw new CoreError('INVALID_REFERENCE', 'Consent must name the current authorized laboratory release.');
      if (command.capabilities.length !== installation.release.capabilities.length
        || !installation.release.capabilities.every(capability => command.capabilities.includes(capability))) {
        throw new CoreError('PLUGIN_CONSENT_REQUIRED', 'Explicit learner consent is required for every requested capability.');
      }
      await verifyPluginPolicy(policy!, {operation: 'consent', actor, release: installation.release, states: [], consent: command.capabilities});
      const consent = {objectId: lab.id, instanceId: lab.data.instanceId, actorId: actor.actorId,
        release: structuredClone(installation.release), capabilities: [...command.capabilities].sort(), grantedAt: at};
      work.consents = [...work.consents.filter(entry => entry.objectId !== lab.id), consent];
      break;
    }
    case 'revoke-lab-consent':
      if (!work.consents.some(entry => entry.objectId === command.objectId)) throw unavailable();
      work.consents = work.consents.filter(entry => entry.objectId !== command.objectId);
      break;
    case 'save-learner-note':
      work.notes = command.text;
      break;
    case 'save-learner-lab': {
      const lab = findLab(document, command.objectId);
      if (lab.data.instanceId !== command.instanceId) throw new CoreError('INVALID_REFERENCE', 'Laboratory instance identity cannot be replaced.');
      const data: LabData = {...structuredClone(lab.data), state: structuredClone(command.state)};
      const installation = teacherLabAuthorization(state, document, data, policy);
      const consent = work.consents.find(entry => entry.objectId === lab.id && entry.instanceId === lab.data.instanceId);
      if (!consent || consent.actorId !== actor.actorId || canonicalJson(consent.release) !== canonicalJson(installation.release)) {
        throw new CoreError('PLUGIN_CONSENT_REQUIRED', 'Authorize this exact laboratory release in your own account before saving.');
      }
      await verifyPluginPolicy(policy!, {operation: 'use', actor, release: installation.release, states: [data], consent: consent.capabilities});
      const saved = work.labs.find(entry => entry.objectId === lab.id);
      work.labs = [...work.labs.filter(entry => entry.objectId !== lab.id), {
        objectId: lab.id, sourceObjectRevision: lab.revision, revision: (saved?.revision ?? 0) + 1, data,
      }];
      break;
    }
    case 'record-learner-attempt': {
      const object = document.objects.find(object => object.id === command.objectId);
      if (!object) throw unavailable();
      if (work.attempts.some(entry => entry.id === command.attemptId)) throw new CoreError('ALREADY_EXISTS', 'Attempt identities cannot be reused.');
      work.attempts.push({id: command.attemptId, objectId: object.id, sourceObjectRevision: object.revision, answer: command.answer, createdAt: at});
      break;
    }
    case 'share-learner-evidence':
      work.evidenceShared = command.shared;
      break;
  }
  if (current) work.revision += 1;
  work.updatedAt = at;
  if (!current) state.learnerWork.push(work);
  return {studentId: actor.actorId, stream: 'learner-work', revision: work.revision, payload: payload({previous, work})};
}
