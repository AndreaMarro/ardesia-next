import { z } from 'zod';

export const CONTRACT_VERSION = '0.3.0' as const;
export const SNAPSHOT_VERSION = 3 as const;

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
  if (consent && (consent.actorId !== installation.ownerId || JSON.stringify(consent.release) !== JSON.stringify(installation.release)
    || consent.capabilities.length !== installation.release.capabilities.length
    || !installation.release.capabilities.every(capability => consent.capabilities.includes(capability)))) add('Consent must authorize this exact release and its capabilities');
  if (installation.status === 'active' && !consent) add('An active installation requires explicit consent');
  if (installation.status === 'revoked' && consent) add('Revocation removes the current consent');
  if (installation.history.some(entry => entry.release.pluginId !== installation.pluginId)) add('Release history must retain the plugin identity');
});
export type PluginInstallation = z.infer<typeof PluginInstallationSchema>;

export const PluginCommandKinds = ['install-plugin', 'consent-plugin', 'activate-plugin', 'disable-plugin', 'revoke-plugin', 'change-plugin-release'] as const;
const pluginCommandFields = {commandId: identifier, pluginId, expectedRevision: z.number().int().nonnegative()};
export const PluginCommandSchema = z.discriminatedUnion('kind', [
  z.object({...pluginCommandFields, kind: z.literal('install-plugin'), expectedRevision: z.literal(0), release: PluginReleaseSchema}).strict(),
  z.object({...pluginCommandFields, kind: z.literal('consent-plugin'), releaseDigest: digest, capabilities: capabilityList}).strict(),
  z.object({...pluginCommandFields, kind: z.literal('activate-plugin')}).strict(),
  z.object({...pluginCommandFields, kind: z.literal('disable-plugin')}).strict(),
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
  payload: z.json(),
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

export const PluginEventSchema = z.object({
  id: identifier,
  sequence: revision,
  pluginId,
  installationRevision: revision,
  type: z.enum(PluginCommandKinds),
  actorId: identifier,
  occurredAt: timestamp,
  payload: z.json(),
}).strict();
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
export const WorkspaceEventSchema = z.union([CoreEventSchema, PluginEventSchema]);
export type WorkspaceEvent = z.infer<typeof WorkspaceEventSchema>;
export const WorkspaceReceiptSchema = z.union([CommandReceiptSchema, PluginReceiptSchema]);
export type WorkspaceReceipt = z.infer<typeof WorkspaceReceiptSchema>;

export const CoreSnapshotSchema = z.object({
  schemaVersion: z.literal(SNAPSHOT_VERSION),
  workspaceId: identifier,
  documents: z.array(LessonDocumentSchema).max(500),
  installations: z.array(PluginInstallationSchema).max(1_000),
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
  const eventIds = new Set<string>();
  const eventsById = new Map<string, WorkspaceEvent>();
  const latest = new Map<string, number>();
  const latestInstallation = new Map<string, number>();
  for (const [index, event] of snapshot.events.entries()) {
    if (eventIds.has(event.id) || event.sequence !== index + 1) context.addIssue({code: 'custom', message: 'Invalid event identity or sequence', path: ['events', index]});
    if ('documentId' in event) {
      if (!documentIds.has(event.documentId)) context.addIssue({code: 'custom', message: 'Event document is unavailable', path: ['events', index]});
      if (event.documentRevision !== (latest.get(event.documentId) ?? 0) + 1) context.addIssue({code: 'custom', message: 'Non-contiguous document event revisions', path: ['events', index, 'documentRevision']});
      latest.set(event.documentId, event.documentRevision);
    } else {
      const key = installationKey(event.actorId, event.pluginId);
      if (!installationKeys.has(key) || event.installationRevision !== (latestInstallation.get(key) ?? 0) + 1) context.addIssue({code: 'custom', message: 'Invalid installation event or revision', path: ['events', index]});
      latestInstallation.set(key, event.installationRevision);
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
  const receiptIds = new Set<string>();
  const receiptEventIds = new Set<string>();
  for (const [index, receipt] of snapshot.receipts.entries()) {
    const event = eventsById.get(receipt.eventId);
    if (receiptIds.has(receipt.commandId) || receiptEventIds.has(receipt.eventId) || !event || event.actorId !== receipt.actorId) context.addIssue({code: 'custom', message: 'Receipt does not match a unique committed event', path: ['receipts', index]});
    if ('documentId' in receipt) {
      if (!event || !('documentId' in event) || event.documentId !== receipt.documentId || event.documentRevision !== receipt.documentRevision || event.type === 'plugin-release-changed') context.addIssue({code: 'custom', message: 'Document receipt identity differs from its event', path: ['receipts', index]});
    } else {
      if (!event || !('pluginId' in event) || event.pluginId !== receipt.pluginId || event.installationRevision !== receipt.installationRevision) context.addIssue({code: 'custom', message: 'Plugin receipt identity differs from its event', path: ['receipts', index]});
      for (const relatedId of receipt.relatedEventIds) {
        const related = eventsById.get(relatedId);
        if (relatedId === receipt.eventId || receiptEventIds.has(relatedId) || !related || !('documentId' in related)
          || related.type !== 'plugin-release-changed' || related.actorId !== receipt.actorId || !related.payload
          || typeof related.payload !== 'object' || Array.isArray(related.payload) || related.payload.pluginId !== receipt.pluginId
          || event?.type !== 'change-plugin-release') context.addIssue({code: 'custom', message: 'Transition receipt does not cover a unique related document event', path: ['receipts', index, 'relatedEventIds']});
        receiptEventIds.add(relatedId);
      }
    }
    receiptIds.add(receipt.commandId);
    receiptEventIds.add(receipt.eventId);
  }
  if (receiptEventIds.size !== snapshot.events.length || snapshot.events.some(event => !receiptEventIds.has(event.id))) context.addIssue({code: 'custom', message: 'Every event requires exactly one receipt', path: ['receipts']});
});
export type CoreSnapshot = z.infer<typeof CoreSnapshotSchema>;

const LegacySnapshotSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  workspaceId: identifier,
  documents: z.array(LessonDocumentSchema).max(500),
  events: z.array(CoreEventSchema.extend({type: z.enum(CommandKinds)})).max(50_000),
  receipts: z.array(CommandReceiptSchema).max(50_000),
}).strict();

/** M0/M1 → M2 is read-only on open and never invents installation or consent. */
export function migrateSnapshotForOpen(input: unknown): unknown {
  const legacy = LegacySnapshotSchema.safeParse(input);
  if (!legacy.success) return input;
  if (legacy.data.schemaVersion === 1 && legacy.data.documents.some(doc => doc.objects.some(object => object.type === 'lab'))) return input;
  const candidate = {...legacy.data, schemaVersion: SNAPSHOT_VERSION, installations: []};
  const checked = CoreSnapshotSchema.safeParse(candidate);
  return checked.success ? checked.data : input;
}

export function emptySnapshot(workspaceId = 'local-workspace'): CoreSnapshot {
  return {schemaVersion: SNAPSHOT_VERSION, workspaceId, documents: [], installations: [], events: [], receipts: []};
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

