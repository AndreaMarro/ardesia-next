import { z } from 'zod';

export const CONTRACT_VERSION = '0.4.0' as const;
export const SNAPSHOT_VERSION = 4 as const;

const identifier = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const title = z.string().trim().min(1).max(240);
const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const dimension = z.number().finite().positive().max(10_000);
const revision = z.number().int().positive();
const timestamp = z.iso.datetime();

export const ActorSchema = z.object({
  actorId: identifier,
  role: z.enum(['teacher', 'student']),
}).strict();
export type Actor = z.infer<typeof ActorSchema>;

/** Canonical structural JSON used for persisted invariants; JSONB object key ordering is not data. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().filter(key => record[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}


export const SourceReferenceSchema = z.object({
  sourceId: identifier,
  revision,
  locator: z.string().trim().min(1).max(1_000),
}).strict();
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const ProvenanceInputSchema = z.object({
  origin: z.enum(['authored', 'imported']),
  sources: z.array(SourceReferenceSchema).max(100),
}).strict();
export const ProvenanceSchema = ProvenanceInputSchema.extend({
  createdBy: identifier,
  createdAt: timestamp,
}).strict();
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const NoteDataSchema = z.object({ text: z.string().max(100_000) }).strict();
export const FormulaDataSchema = z.object({
  latex: z.string().min(1).max(10_000),
  description: z.string().max(10_000),
}).strict();
export const SourceDataSchema = z.object({
  url: z.url().refine((value) => ['https:', 'http:'].includes(new URL(value).protocol), 'Only HTTP(S) source URLs are supported'),
  publisher: z.string().trim().min(1).max(300),
  locator: z.string().trim().min(1).max(1_000),
  sourceRevision: z.string().trim().min(1).max(300),
  license: z.string().trim().min(1).max(300),
}).strict();
export const InkPointSchema = z.object({
  x: coordinate,
  y: coordinate,
  pressure: z.number().finite().min(0).max(1),
}).strict();
export const InkDataSchema = z.object({
  points: z.array(InkPointSchema).min(1).max(20_000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().finite().min(0.5).max(40),
}).strict();

/** Generic persisted state, not an authority to execute plugin code. */
export type JsonValue = null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue};

/** Events contain complete note/ink revisions, so the lab state size caps do not apply.
 * Copy data without invoking accessors. Preserve shared references and legal JSON
 * keys, omit __proto__ as before, and reject cycles that cannot cross the JSON wire. */
const EventJsonSchema = z.transform((value, context): JsonValue => {
  type Frame = {value: unknown; output: Record<string, JsonValue>; key: string; exit?: boolean};
  const result: Record<string, JsonValue> = {}, stack: Frame[] = [{value, output: result, key: 'value'}];
  const active = new Set<object>(), copies = new Map<object, JsonValue>();
  try {
    while (stack.length) {
      const frame = stack.pop()!, source = frame.value;
      if (frame.exit) {active.delete(source as object); continue;}
      if (source === null || typeof source === 'string' || typeof source === 'boolean') {frame.output[frame.key] = source; continue;}
      if (typeof source === 'number') {if (!Number.isFinite(source)) throw Error(); frame.output[frame.key] = source; continue;}
      if (typeof source !== 'object' || active.has(source)) throw Error();
      if (copies.has(source)) {frame.output[frame.key] = copies.get(source)!; continue;}
      const array = Array.isArray(source), prototype = Object.getPrototypeOf(source);
      if (!array && prototype !== Object.prototype && prototype !== null) throw Error();
      const output: Record<string, JsonValue> = array ? [] as unknown as Record<string, JsonValue> : {};
      frame.output[frame.key] = output; copies.set(source, output); active.add(source);
      stack.push({...frame, exit: true});
      const descriptors = Object.getOwnPropertyDescriptors(source);
      const keys = array ? Array.from({length: descriptors.length!.value}, (_, index) => String(index)) : Reflect.ownKeys(descriptors);
      for (let index = keys.length - 1; index >= 0; index--) {
        const key = keys[index]!, descriptor = descriptors[key as keyof typeof descriptors];
        if (!array && (key === '__proto__' || !descriptor!.enumerable)) continue;
        if (typeof key !== 'string' || !descriptor || !('value' in descriptor)) throw Error();
        stack.push({value: descriptor.value, output, key});
      }
    }
    return result.value!;
  } catch {
    context.addIssue({code: 'custom', message: 'Payload must be finite data-only JSON'});
    return z.NEVER;
  }
});

function boundedJson(value: unknown): value is JsonValue {
  const stack: {value: unknown; depth: number}[] = [{value, depth: 0}];
  const seen = new Set<object>();
  let nodes = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++nodes > 4096 || item.depth > 12) return false;
    const itemValue = item.value;
    if (itemValue === null || typeof itemValue === 'boolean' || typeof itemValue === 'string') continue;
    if (typeof itemValue === 'number') {if (!Number.isFinite(itemValue)) return false; continue;}
    if (typeof itemValue !== 'object' || seen.has(itemValue)) return false;
    if (!Array.isArray(itemValue) && Object.getPrototypeOf(itemValue) !== Object.prototype && Object.getPrototypeOf(itemValue) !== null) return false;
    if (Object.getOwnPropertySymbols(itemValue).length) return false;
    if (Array.isArray(itemValue) && (Object.keys(itemValue).length !== itemValue.length || Object.keys(itemValue).some((key,index) => key !== String(index)))) return false;
    seen.add(itemValue);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(itemValue))) {
      if (Array.isArray(itemValue) && key === 'length') continue;
      if (!descriptor.enumerable || !('value' in descriptor) || ['__proto__', 'constructor', 'prototype'].includes(key)) return false;
      stack.push({value: descriptor.value, depth: item.depth + 1});
    }
  }
  try {return new TextEncoder().encode(JSON.stringify(value)).length <= 32768;} catch {return false;}
}
const semver = z.string().regex(/^\d+\.\d+\.\d+$/);
export const LabStateSchema = z.object({schemaVersion: semver, value: z.custom<JsonValue>(boundedJson, 'State must be bounded finite JSON')}).strict().refine(boundedJson, 'State envelope exceeds the bounded JSON contract');
export const LabDataSchema = z.object({
  pluginId: z.string().regex(/^[a-z][a-z0-9.-]{2,80}$/),
  pluginVersion: semver,
  instanceId: identifier,
  stateSchemaVersion: semver,
  bundleDigest: z.string().regex(/^[a-f0-9]{64}$/),
  publisher: z.object({id: identifier, keyId: identifier}).strict(),
  state: LabStateSchema,
}).strict().refine(value => value.state.schemaVersion === value.stateSchemaVersion, 'State version must match the instance');
export type LabData = z.infer<typeof LabDataSchema>;

/** Persisted release identity; only the injected verifier can authorize this DTO. */
const pluginId = z.string().regex(/^[a-z][a-z0-9.-]{2,80}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const capabilityList = z.array(z.string().min(3).max(100).regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/)).max(32)
  .refine(value => new Set(value).size === value.length, 'Capabilities must be unique');
export const PluginReleaseSchema = z.object({
  pluginId,
  version: semver,
  bundleDigest: digest,
  publisher: z.object({id: identifier, keyId: identifier}).strict(),
  license: z.string().trim().min(1).max(300),
  provenance: z.object({
    repository: z.url().refine(value => new URL(value).protocol === 'https:', 'Provenance requires HTTPS'),
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    path: z.string().min(1).max(1_000),
  }).strict(),
  sdkVersion: semver,
  stateSchemaVersion: semver,
  capabilities: capabilityList,
}).strict();
export type PluginRelease = z.infer<typeof PluginReleaseSchema>;

export const PluginConsentSchema = z.object({
  actorId: identifier,
  release: PluginReleaseSchema,
  capabilities: capabilityList,
  grantedAt: timestamp,
}).strict();
export type PluginConsent = z.infer<typeof PluginConsentSchema>;
export const PluginInstallationSchema = z.object({
  ownerId: identifier,
  pluginId,
  revision,
  status: z.enum(['installed', 'active', 'disabled', 'revoked']),
  release: PluginReleaseSchema,
  consent: PluginConsentSchema.nullable(),
  history: z.array(z.object({
    release: PluginReleaseSchema,
    consent: PluginConsentSchema.nullable(),
    changedAt: timestamp,
    direction: z.enum(['update', 'rollback']),
  }).strict()).max(100),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict().superRefine((installation, context) => {
  const add = (message: string) => context.addIssue({code: 'custom', message});
  if (installation.pluginId !== installation.release.pluginId) add('Installation and release identity differ');
  const consent = installation.consent;
  if (consent && (consent.actorId !== installation.ownerId || canonicalJson(consent.release) !== canonicalJson(installation.release)
    || consent.capabilities.length !== installation.release.capabilities.length
    || !installation.release.capabilities.every(capability => consent.capabilities.includes(capability)))) add('Consent must authorize this exact release and its capabilities');
  if (installation.status === 'active' && !consent) add('An active installation requires explicit consent');
  if (installation.status === 'revoked' && consent) add('Revocation removes the current consent');
  if (installation.history.some(entry => entry.release.pluginId !== installation.pluginId)) add('Release history must retain the plugin identity');
});
export type PluginInstallation = z.infer<typeof PluginInstallationSchema>;

const PluginCommandKindsV3 = ['install-plugin', 'consent-plugin', 'activate-plugin', 'disable-plugin', 'revoke-plugin', 'change-plugin-release'] as const;
export const PluginCommandKinds = [...PluginCommandKindsV3, 'withdraw-plugin-consent'] as const;
const pluginCommandFields = {commandId: identifier, pluginId, expectedRevision: z.number().int().nonnegative()};
export const PluginCommandSchema = z.discriminatedUnion('kind', [
  z.object({...pluginCommandFields, kind: z.literal('install-plugin'), expectedRevision: z.literal(0), release: PluginReleaseSchema}).strict(),
  z.object({...pluginCommandFields, kind: z.literal('consent-plugin'), releaseDigest: digest, capabilities: capabilityList}).strict(),
  z.object({...pluginCommandFields, kind: z.literal('activate-plugin')}).strict(),
  z.object({...pluginCommandFields, kind: z.literal('disable-plugin')}).strict(),
  z.object({...pluginCommandFields, kind: z.literal('withdraw-plugin-consent')}).strict(),
  z.object({...pluginCommandFields, kind: z.literal('revoke-plugin')}).strict(),
  z.object({...pluginCommandFields, kind: z.literal('change-plugin-release'), release: PluginReleaseSchema, direction: z.enum(['update', 'rollback'])}).strict(),
]);
export type PluginCommand = z.infer<typeof PluginCommandSchema>;

const inputFields = {
  id: identifier,
  title,
  x: coordinate,
  y: coordinate,
  width: dimension,
  height: dimension,
  provenance: ProvenanceInputSchema.optional(),
};

export const NewObjectSchema = z.discriminatedUnion('type', [
  z.object({ ...inputFields, type: z.literal('note'), data: NoteDataSchema }).strict(),
  z.object({ ...inputFields, type: z.literal('formula'), data: FormulaDataSchema }).strict(),
  z.object({ ...inputFields, type: z.literal('source'), data: SourceDataSchema }).strict(),
  z.object({ ...inputFields, type: z.literal('ink'), data: InkDataSchema }).strict(),
  z.object({ ...inputFields, type: z.literal('lab'), data: LabDataSchema }).strict(),
]);
export type NewEducationalObject = z.infer<typeof NewObjectSchema>;

const objectFields = {
  ...inputFields,
  provenance: ProvenanceSchema,
  status: z.enum(['draft', 'approved']),
  revision,
};
export const EducationalObjectSchema = z.discriminatedUnion('type', [
  z.object({ ...objectFields, type: z.literal('note'), data: NoteDataSchema }).strict(),
  z.object({ ...objectFields, type: z.literal('formula'), data: FormulaDataSchema }).strict(),
  z.object({ ...objectFields, type: z.literal('source'), data: SourceDataSchema }).strict(),
  z.object({ ...objectFields, type: z.literal('ink'), data: InkDataSchema }).strict(),
  z.object({ ...objectFields, type: z.literal('lab'), data: LabDataSchema }).strict(),
]);
export type EducationalObject = z.infer<typeof EducationalObjectSchema>;
export type NoteObject = Extract<EducationalObject, { type: 'note' }>;
export type FormulaObject = Extract<EducationalObject, { type: 'formula' }>;
export type SourceObject = Extract<EducationalObject, { type: 'source' }>;
export type InkObject = Extract<EducationalObject, { type: 'ink' }>;
export type LabObject = Extract<EducationalObject, { type: 'lab' }>;

/** Build an editable input without allowing callers to set status or authority fields. */
export function toObjectInput(object: EducationalObject): NewEducationalObject {
  const { revision: _revision, status: _status, provenance, ...editable } = object;
  return NewObjectSchema.parse({ ...editable, provenance: { origin: provenance.origin, sources: provenance.sources } });
}

/** Identity is immutable across state edits. Updates need a future explicit migration. */
export type LabInstanceReference = Readonly<Omit<LabData, 'state'>>;

export const ConnectionSchema = z.object({
  id: identifier,
  from: identifier,
  to: identifier,
  label: z.string().max(240),
}).strict().refine((value) => value.from !== value.to, 'An object cannot connect to itself');
export type Connection = z.infer<typeof ConnectionSchema>;

export const LessonDocumentSchema = z.object({
  id: identifier,
  ownerId: identifier,
  title,
  revision,
  status: z.enum(['draft', 'approved']),
  createdAt: timestamp,
  updatedAt: timestamp,
  objects: z.array(EducationalObjectSchema).max(2_000),
  connections: z.array(ConnectionSchema).max(5_000),
}).strict().superRefine((document, context) => {
  const ids = new Set<string>();
  const instances = new Set<string>();
  for (const [index, object] of document.objects.entries()) {
    if (ids.has(object.id)) context.addIssue({ code: 'custom', message: 'Duplicate object ID', path: ['objects', index, 'id'] });
    ids.add(object.id);
    if (object.type === 'lab') {
      if (instances.has(object.data.instanceId)) context.addIssue({code: 'custom', message: 'Duplicate plugin instance ID', path: ['objects', index, 'data', 'instanceId']});
      instances.add(object.data.instanceId);
    }
  }
  const connectionIds = new Set<string>();
  for (const [index, connection] of document.connections.entries()) {
    if (connectionIds.has(connection.id)) context.addIssue({ code: 'custom', message: 'Duplicate connection ID', path: ['connections', index, 'id'] });
    if (!ids.has(connection.from) || !ids.has(connection.to)) context.addIssue({ code: 'custom', message: 'Connection endpoint does not exist', path: ['connections', index] });
    connectionIds.add(connection.id);
  }
});
export type LessonDocument = z.infer<typeof LessonDocumentSchema>;

export const CommandKinds = [
  'create-document', 'rename-document', 'add-object', 'replace-object',
  'move-object', 'remove-object', 'connect-objects', 'disconnect-objects',
] as const;
const commandFields = {
  commandId: identifier,
  documentId: identifier,
  expectedRevision: z.number().int().nonnegative(),
};
export const CoreCommandSchema = z.discriminatedUnion('kind', [
  z.object({ ...commandFields, kind: z.literal('create-document'), expectedRevision: z.literal(0), title }).strict(),
  z.object({ ...commandFields, kind: z.literal('rename-document'), title }).strict(),
  z.object({ ...commandFields, kind: z.literal('add-object'), object: NewObjectSchema }).strict(),
  z.object({ ...commandFields, kind: z.literal('replace-object'), object: NewObjectSchema }).strict(),
  z.object({ ...commandFields, kind: z.literal('move-object'), objectId: identifier, x: coordinate, y: coordinate }).strict(),
  z.object({ ...commandFields, kind: z.literal('remove-object'), objectId: identifier }).strict(),
  z.object({ ...commandFields, kind: z.literal('connect-objects'), connection: ConnectionSchema }).strict(),
  z.object({ ...commandFields, kind: z.literal('disconnect-objects'), connectionId: identifier }).strict(),
]);
export type CoreCommand = z.infer<typeof CoreCommandSchema>;

export const CoreEventSchema = z.object({
  id: identifier,
  sequence: revision,
  documentId: identifier,
  documentRevision: revision,
  type: z.enum([...CommandKinds, 'plugin-release-changed']),
  actorId: identifier,
  occurredAt: timestamp,
  payload: EventJsonSchema,
}).strict();
export type CoreEvent = z.infer<typeof CoreEventSchema>;

export const CommandReceiptSchema = z.object({
  commandId: identifier,
  actorId: identifier,
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  documentId: identifier,
  documentRevision: revision,
  eventId: identifier,
}).strict();
export type CommandReceipt = z.infer<typeof CommandReceiptSchema>;

export const PluginEventSchema = /* @__PURE__ */ (() => z.object({
  id: identifier,
  sequence: revision,
  pluginId,
  installationRevision: revision,
  type: z.enum(PluginCommandKinds),
  actorId: identifier,
  occurredAt: timestamp,
  payload: EventJsonSchema,
}).strict())();
export type PluginEvent = z.infer<typeof PluginEventSchema>;
export const PluginReceiptSchema = z.object({
  commandId: identifier,
  actorId: identifier,
  fingerprint: digest,
  pluginId,
  installationRevision: revision,
  eventId: identifier,
  /** A release transition can change several documents in the same atomic write. */
  relatedEventIds: z.array(identifier).max(500),
}).strict();
export type PluginReceipt = z.infer<typeof PluginReceiptSchema>;
/** Explicit lesson access; a grant never makes draft content approved. */
export const LessonAssignmentSchema = z.object({
  documentId: identifier, studentId: identifier, assignedBy: identifier, revision,
  status: z.enum(['active', 'revoked']), createdAt: timestamp, updatedAt: timestamp,
}).strict();
export type LessonAssignment = z.infer<typeof LessonAssignmentSchema>;

export const LearnerLabSchema = z.object({
  objectId: identifier, sourceObjectRevision: revision, revision, data: LabDataSchema,
}).strict();
export type LearnerLab = z.infer<typeof LearnerLabSchema>;
export const LearnerConsentSchema = z.object({
  objectId: identifier, instanceId: identifier, actorId: identifier,
  release: PluginReleaseSchema, capabilities: capabilityList, grantedAt: timestamp,
}).strict().superRefine((consent, context) => {
  if (consent.capabilities.length !== consent.release.capabilities.length
    || !consent.release.capabilities.every(capability => consent.capabilities.includes(capability))) {
    context.addIssue({code: 'custom', message: 'Learner consent must authorize the exact release capabilities'});
  }
});
export type LearnerConsent = z.infer<typeof LearnerConsentSchema>;
export const LearnerAttemptSchema = z.object({
  id: identifier, objectId: identifier, sourceObjectRevision: revision,
  answer: z.string().trim().min(1).max(10_000), createdAt: timestamp,
}).strict();
export const LearnerWorkSchema = z.object({
  documentId: identifier, studentId: identifier, revision,
  notes: z.string().max(100_000),
  labs: z.array(LearnerLabSchema).max(2_000),
  attempts: z.array(LearnerAttemptSchema).max(2_000),
  consents: z.array(LearnerConsentSchema).max(2_000),
  evidenceShared: z.boolean(), createdAt: timestamp, updatedAt: timestamp,
}).strict().superRefine((work, context) => {
  for (const [name, values] of [['labs', work.labs], ['consents', work.consents]] as const) {
    if (new Set(values.map(value => value.objectId)).size !== values.length) {
      context.addIssue({code: 'custom', message: 'A learner object may occur only once', path: [name]});
    }
  }
  if (new Set(work.labs.map(lab => lab.data.instanceId)).size !== work.labs.length) {
    context.addIssue({code: 'custom', message: 'Duplicate learner laboratory instance', path: ['labs']});
  }
  if (new Set(work.attempts.map(attempt => attempt.id)).size !== work.attempts.length) {
    context.addIssue({code: 'custom', message: 'Duplicate learner attempt identity', path: ['attempts']});
  }
  if (work.consents.some(consent => consent.actorId !== work.studentId)) {
    context.addIssue({code: 'custom', message: 'Learner consent must belong to the learner', path: ['consents']});
  }
});
export type LearnerWork = z.infer<typeof LearnerWorkSchema>;

/** Current grant projection for the Host. It contains no teacher consent record or account installation history. */
export const AssignedLabAccessSchema = z.object({
  documentId: identifier, objectId: identifier, instanceId: identifier, pluginId,
  release: PluginReleaseSchema.nullable(),
  status: z.enum(['installed', 'active', 'disabled', 'revoked', 'unavailable']),
  installationRevision: z.number().int().nonnegative(), consented: z.boolean(),
  workRevision: z.number().int().nonnegative(),
}).strict();
export type AssignedLabAccess = z.infer<typeof AssignedLabAccessSchema>;


export const LearningCommandKinds = [
  'assign-lesson', 'revoke-assignment', 'consent-lab', 'revoke-lab-consent',
  'save-learner-note', 'save-learner-lab', 'record-learner-attempt', 'share-learner-evidence',
] as const;
export const LearningCommandSchema = z.discriminatedUnion('kind', [
  z.object({...commandFields, kind: z.literal('assign-lesson'), studentId: identifier}).strict(),
  z.object({...commandFields, kind: z.literal('revoke-assignment'), studentId: identifier}).strict(),
  z.object({...commandFields, kind: z.literal('consent-lab'), objectId: identifier, releaseDigest: digest, capabilities: capabilityList}).strict(),
  z.object({...commandFields, kind: z.literal('revoke-lab-consent'), objectId: identifier}).strict(),
  z.object({...commandFields, kind: z.literal('save-learner-note'), text: z.string().max(100_000)}).strict(),
  z.object({...commandFields, kind: z.literal('save-learner-lab'), expectedDocumentRevision: revision,
    objectId: identifier, instanceId: identifier, state: LabStateSchema}).strict(),
  z.object({...commandFields, kind: z.literal('record-learner-attempt'), expectedDocumentRevision: revision,
    objectId: identifier, attemptId: identifier, answer: z.string().trim().min(1).max(10_000)}).strict(),
  z.object({...commandFields, kind: z.literal('share-learner-evidence'), shared: z.boolean()}).strict(),
]);
export type LearningCommand = z.infer<typeof LearningCommandSchema>;
export const LearningEventSchema = z.object({
  id: identifier, sequence: revision, lessonId: identifier, studentId: identifier,
  stream: z.enum(['assignment', 'learner-work']), learningRevision: revision,
  type: z.enum(LearningCommandKinds), actorId: identifier, occurredAt: timestamp, payload: EventJsonSchema,
}).strict();
export type LearningEvent = z.infer<typeof LearningEventSchema>;
export const LearningReceiptSchema = z.object({
  commandId: identifier, actorId: identifier, fingerprint: digest,
  lessonId: identifier, studentId: identifier, stream: z.enum(['assignment', 'learner-work']),
  learningRevision: revision, eventId: identifier,
}).strict();
export type LearningReceipt = z.infer<typeof LearningReceiptSchema>;

export const WorkspaceEventSchema = /* @__PURE__ */ (() => z.union([CoreEventSchema, PluginEventSchema, LearningEventSchema]))();
export type WorkspaceEvent = z.infer<typeof WorkspaceEventSchema>;
export const WorkspaceReceiptSchema = /* @__PURE__ */ (() => z.union([CommandReceiptSchema, PluginReceiptSchema, LearningReceiptSchema]))();
export type WorkspaceReceipt = z.infer<typeof WorkspaceReceiptSchema>;

// Construction only allocates these schemas and registers validators. Marking the
// factory pure lets browser-only consumers omit the unused server ledger contract;
// every invariant still executes whenever CoreSnapshotSchema.parse/safeParse runs.
export const CoreSnapshotSchema = /* @__PURE__ */ (() => z.object({
  schemaVersion: z.literal(SNAPSHOT_VERSION),
  workspaceId: identifier,
  documents: z.array(LessonDocumentSchema).max(500),
  installations: z.array(PluginInstallationSchema).max(1_000),
  assignments: z.array(LessonAssignmentSchema).max(10_000),
  learnerWork: z.array(LearnerWorkSchema).max(10_000),
  events: z.array(WorkspaceEventSchema).max(50_000),
  receipts: z.array(WorkspaceReceiptSchema).max(50_000),
}).strict().superRefine((snapshot, context) => {
  const documentIds = new Set<string>();
  for (const [index, document] of snapshot.documents.entries()) {
    if (documentIds.has(document.id)) context.addIssue({ code: 'custom', message: 'Duplicate document ID', path: ['documents', index, 'id'] });
    documentIds.add(document.id);
  }
  const installationKeys = new Set<string>();
  const installationKey = (ownerId: string, id: string) => JSON.stringify([ownerId, id]);
  for (const [index, installation] of snapshot.installations.entries()) {
    const key = installationKey(installation.ownerId, installation.pluginId);
    if (installationKeys.has(key)) context.addIssue({code: 'custom', message: 'Duplicate plugin installation', path: ['installations', index]});
    installationKeys.add(key);
  }
  const learningKey = (documentId: string, studentId: string) => JSON.stringify([documentId, studentId]);
  const assignmentKeys = new Set<string>();
  const workKeys = new Set<string>();
  for (const [index, assignment] of snapshot.assignments.entries()) {
    const key = learningKey(assignment.documentId, assignment.studentId);
    const document = snapshot.documents.find(document => document.id === assignment.documentId);
    if (assignmentKeys.has(key) || !document || assignment.assignedBy !== document.ownerId || assignment.studentId === document.ownerId) {
      context.addIssue({code: 'custom', message: 'Invalid or duplicate lesson assignment', path: ['assignments', index]});
    }
    assignmentKeys.add(key);
  }
  for (const [index, work] of snapshot.learnerWork.entries()) {
    const key = learningKey(work.documentId, work.studentId);
    if (workKeys.has(key) || !assignmentKeys.has(key)) {
      context.addIssue({code: 'custom', message: 'Learner work requires a unique assignment', path: ['learnerWork', index]});
    }
    workKeys.add(key);
  }
  const eventIds = new Set<string>();
  const eventsById = new Map<string, WorkspaceEvent>();
  const latest = new Map<string, number>();
  const latestInstallation = new Map<string, number>();
  const latestLearning = new Map<string, LearningEvent>();
  for (const [index, event] of snapshot.events.entries()) {
    if (eventIds.has(event.id) || event.sequence !== index + 1) context.addIssue({code: 'custom', message: 'Invalid event identity or sequence', path: ['events', index]});
    if ('documentId' in event) {
      if (!documentIds.has(event.documentId)) context.addIssue({code: 'custom', message: 'Event document is unavailable', path: ['events', index]});
      if (event.documentRevision !== (latest.get(event.documentId) ?? 0) + 1) context.addIssue({code: 'custom', message: 'Non-contiguous document event revisions', path: ['events', index, 'documentRevision']});
      latest.set(event.documentId, event.documentRevision);
    } else if ('pluginId' in event) {
      const key = installationKey(event.actorId, event.pluginId);
      if (!installationKeys.has(key) || event.installationRevision !== (latestInstallation.get(key) ?? 0) + 1) context.addIssue({code: 'custom', message: 'Invalid installation event or revision', path: ['events', index]});
      latestInstallation.set(key, event.installationRevision);
    } else {
      const key = learningKey(event.lessonId, event.studentId);
      const streamKey = event.stream + ':' + key;
      const document = snapshot.documents.find(document => document.id === event.lessonId);
      const assignmentEvent = event.type === 'assign-lesson' || event.type === 'revoke-assignment';
      if (!assignmentKeys.has(key) || event.learningRevision !== (latestLearning.get(streamKey)?.learningRevision ?? 0) + 1
        || (event.stream === 'assignment') !== assignmentEvent
        || (assignmentEvent ? event.actorId !== document?.ownerId : event.actorId !== event.studentId)
        || (!assignmentEvent && !workKeys.has(key))) {
        context.addIssue({code: 'custom', message: 'Invalid learning stream identity or revision', path: ['events', index]});
      }
      latestLearning.set(streamKey, event);
    }
    eventIds.add(event.id);
    eventsById.set(event.id, event);
  }
  for (const [index, document] of snapshot.documents.entries()) {
    if (latest.get(document.id) !== document.revision) context.addIssue({ code: 'custom', message: 'Document revision is not backed by its events', path: ['documents', index, 'revision'] });
  }
  for (const [index, installation] of snapshot.installations.entries()) {
    if (latestInstallation.get(installationKey(installation.ownerId, installation.pluginId)) !== installation.revision) context.addIssue({code: 'custom', message: 'Installation revision is not backed by its events', path: ['installations', index, 'revision']});
  }
  for (const [name, values, stream, field] of [
    ['assignments', snapshot.assignments, 'assignment', 'assignment'],
    ['learnerWork', snapshot.learnerWork, 'learner-work', 'work'],
  ] as const) {
    for (const [index, value] of values.entries()) {
      const event = latestLearning.get(stream + ':' + learningKey(value.documentId, value.studentId));
      const payload = event?.payload;
      const parsed = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (stream === 'assignment' ? LessonAssignmentSchema.safeParse(payload[field]) : LearnerWorkSchema.safeParse(payload[field])) : null;
      if (event?.learningRevision !== value.revision || !parsed?.success || canonicalJson(parsed.data) !== canonicalJson(value)) {
        context.addIssue({code: 'custom', message: 'Learning state is not backed by its exact committed event', path: [name, index]});
      }
    }
  }
  const receiptIds = new Set<string>();
  const receiptEventIds = new Set<string>();
  for (const [index, receipt] of snapshot.receipts.entries()) {
    const event = eventsById.get(receipt.eventId);
    if (receiptIds.has(receipt.commandId) || receiptEventIds.has(receipt.eventId) || !event || event.actorId !== receipt.actorId) context.addIssue({code: 'custom', message: 'Receipt does not match a unique committed event', path: ['receipts', index]});
    if ('documentId' in receipt) {
      if (!event || !('documentId' in event) || event.documentId !== receipt.documentId || event.documentRevision !== receipt.documentRevision || event.type === 'plugin-release-changed') context.addIssue({code: 'custom', message: 'Document receipt identity differs from its event', path: ['receipts', index]});
    } else if ('pluginId' in receipt) {
      if (!event || !('pluginId' in event) || event.pluginId !== receipt.pluginId || event.installationRevision !== receipt.installationRevision) context.addIssue({code: 'custom', message: 'Plugin receipt identity differs from its event', path: ['receipts', index]});
      for (const relatedId of receipt.relatedEventIds) {
        const related = eventsById.get(relatedId);
        if (relatedId === receipt.eventId || receiptEventIds.has(relatedId) || !related || !('documentId' in related)
          || related.type !== 'plugin-release-changed' || related.actorId !== receipt.actorId || !related.payload
          || typeof related.payload !== 'object' || Array.isArray(related.payload) || related.payload.pluginId !== receipt.pluginId
          || event?.type !== 'change-plugin-release') context.addIssue({code: 'custom', message: 'Transition receipt does not cover a unique related document event', path: ['receipts', index, 'relatedEventIds']});
        receiptEventIds.add(relatedId);
      }
    } else {
      if (!event || !('lessonId' in event) || event.lessonId !== receipt.lessonId || event.studentId !== receipt.studentId
        || event.stream !== receipt.stream || event.learningRevision !== receipt.learningRevision) {
        context.addIssue({code: 'custom', message: 'Learning receipt differs from its committed event', path: ['receipts', index]});
      }
    }
    receiptIds.add(receipt.commandId);
    receiptEventIds.add(receipt.eventId);
  }
  if (receiptEventIds.size !== snapshot.events.length || snapshot.events.some(event => !receiptEventIds.has(event.id))) context.addIssue({code: 'custom', message: 'Every event requires exactly one receipt', path: ['receipts']});
}))();
export type CoreSnapshot = z.infer<typeof CoreSnapshotSchema>;

const LegacySnapshotSchema = /* @__PURE__ */ (() => z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  workspaceId: identifier,
  documents: z.array(LessonDocumentSchema).max(500),
  events: z.array(CoreEventSchema.extend({type: z.enum(CommandKinds)})).max(50_000),
  receipts: z.array(CommandReceiptSchema).max(50_000),
}).strict())();

const MarketplaceSnapshotV3Schema = /* @__PURE__ */ (() => z.object({
  schemaVersion: z.literal(3), workspaceId: identifier,
  documents: z.array(LessonDocumentSchema).max(500), installations: z.array(PluginInstallationSchema).max(1_000),
  events: z.array(z.union([CoreEventSchema, PluginEventSchema.extend({type: z.enum(PluginCommandKindsV3)})])).max(50_000),
  receipts: z.array(z.union([CommandReceiptSchema, PluginReceiptSchema])).max(50_000),
}).strict())();

/** Versioned read-only migration. Historical bytes, consent and receipts are never rewritten on open. */
export function migrateSnapshotForOpen(input: unknown): unknown {
  const legacy = LegacySnapshotSchema.safeParse(input);
  let candidate: unknown;
  if (legacy.success) {
    if (legacy.data.schemaVersion === 1 && legacy.data.documents.some(doc => doc.objects.some(object => object.type === 'lab'))) return input;
    candidate = {...legacy.data, schemaVersion: SNAPSHOT_VERSION, installations: [], assignments: [], learnerWork: []};
  } else {
    const marketplace = MarketplaceSnapshotV3Schema.safeParse(input);
    if (!marketplace.success) return input;
    candidate = {...marketplace.data, schemaVersion: SNAPSHOT_VERSION, assignments: [], learnerWork: []};
  }
  const checked = CoreSnapshotSchema.safeParse(candidate);
  return checked.success ? checked.data : input;
}

export function emptySnapshot(workspaceId = 'local-workspace'): CoreSnapshot {
  return {schemaVersion: SNAPSHOT_VERSION, workspaceId, documents: [], installations: [], assignments: [], learnerWork: [], events: [], receipts: []};
}

export const CoreErrorCodes = [
  'INVALID_ACTOR', 'INVALID_COMMAND', 'INVALID_SNAPSHOT', 'FORBIDDEN', 'NOT_FOUND',
  'REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'ALREADY_EXISTS', 'INVALID_REFERENCE',
  'READ_ONLY', 'STORAGE_FAILURE',
  'PLUGIN_POLICY_REQUIRED', 'PLUGIN_POLICY_REJECTED', 'PLUGIN_NOT_ACTIVE',
  'PLUGIN_CONSENT_REQUIRED', 'PLUGIN_REVOKED', 'INVALID_PLUGIN_TRANSITION',
] as const;
export type CoreErrorCode = typeof CoreErrorCodes[number];

export class CoreError extends Error {
  readonly code: CoreErrorCode;
  constructor(code: CoreErrorCode, message: string) {
    super(message);
    this.name = 'CoreError';
    this.code = code;
  }
}

