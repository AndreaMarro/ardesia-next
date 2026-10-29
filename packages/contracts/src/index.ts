import { z } from 'zod';

export const CONTRACT_VERSION = '0.1.0' as const;
export const SNAPSHOT_VERSION = 1 as const;

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
]);
export type EducationalObject = z.infer<typeof EducationalObjectSchema>;
export type NoteObject = Extract<EducationalObject, { type: 'note' }>;
export type FormulaObject = Extract<EducationalObject, { type: 'formula' }>;
export type SourceObject = Extract<EducationalObject, { type: 'source' }>;
export type InkObject = Extract<EducationalObject, { type: 'ink' }>;

/** Build an editable input without allowing callers to set status or authority fields. */
export function toObjectInput(object: EducationalObject): NewEducationalObject {
  const { revision: _revision, status: _status, provenance, ...editable } = object;
  return NewObjectSchema.parse({ ...editable, provenance: { origin: provenance.origin, sources: provenance.sources } });
}

/** Reserved contract only; M0 cannot install or execute a lab. */
export type LabInstanceReference = Readonly<{
  pluginId: string;
  pluginVersion: string;
  instanceId: string;
  stateSchemaVersion: string;
  bundleDigest: string;
}>;

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
  for (const [index, object] of document.objects.entries()) {
    if (ids.has(object.id)) context.addIssue({ code: 'custom', message: 'Duplicate object ID', path: ['objects', index, 'id'] });
    ids.add(object.id);
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
  type: z.enum(CommandKinds),
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

export const CoreSnapshotSchema = z.object({
  schemaVersion: z.literal(SNAPSHOT_VERSION),
  workspaceId: identifier,
  documents: z.array(LessonDocumentSchema).max(500),
  events: z.array(CoreEventSchema).max(50_000),
  receipts: z.array(CommandReceiptSchema).max(50_000),
}).strict().superRefine((snapshot, context) => {
  const documentIds = new Set<string>();
  for (const [index, document] of snapshot.documents.entries()) {
    if (documentIds.has(document.id)) context.addIssue({ code: 'custom', message: 'Duplicate document ID', path: ['documents', index, 'id'] });
    documentIds.add(document.id);
  }
  const eventIds = new Set<string>();
  const eventsById = new Map<string, CoreEvent>();
  const latest = new Map<string, number>();
  for (const [index, event] of snapshot.events.entries()) {
    if (eventIds.has(event.id) || event.sequence !== index + 1 || !documentIds.has(event.documentId)) context.addIssue({ code: 'custom', message: 'Invalid event identity, sequence or document', path: ['events', index] });
    if (event.documentRevision !== (latest.get(event.documentId) ?? 0) + 1) context.addIssue({ code: 'custom', message: 'Non-contiguous document event revisions', path: ['events', index, 'documentRevision'] });
    latest.set(event.documentId, event.documentRevision);
    eventIds.add(event.id);
    eventsById.set(event.id, event);
  }
  for (const [index, document] of snapshot.documents.entries()) {
    if (latest.get(document.id) !== document.revision) context.addIssue({ code: 'custom', message: 'Document revision is not backed by its events', path: ['documents', index, 'revision'] });
  }
  const receiptIds = new Set<string>();
  const receiptEventIds = new Set<string>();
  for (const [index, receipt] of snapshot.receipts.entries()) {
    const event = eventsById.get(receipt.eventId);
    if (receiptIds.has(receipt.commandId) || receiptEventIds.has(receipt.eventId) || !event || event.documentId !== receipt.documentId || event.documentRevision !== receipt.documentRevision || event.actorId !== receipt.actorId) context.addIssue({ code: 'custom', message: 'Receipt does not match a unique committed event', path: ['receipts', index] });
    receiptIds.add(receipt.commandId);
    receiptEventIds.add(receipt.eventId);
  }
  if (snapshot.receipts.length !== snapshot.events.length) context.addIssue({ code: 'custom', message: 'Every event requires exactly one receipt', path: ['receipts'] });
});
export type CoreSnapshot = z.infer<typeof CoreSnapshotSchema>;

export function emptySnapshot(workspaceId = 'local-workspace'): CoreSnapshot {
  return { schemaVersion: SNAPSHOT_VERSION, workspaceId, documents: [], events: [], receipts: [] };
}

export const CoreErrorCodes = [
  'INVALID_ACTOR', 'INVALID_COMMAND', 'INVALID_SNAPSHOT', 'FORBIDDEN', 'NOT_FOUND',
  'REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'ALREADY_EXISTS', 'INVALID_REFERENCE',
  'READ_ONLY', 'STORAGE_FAILURE',
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
