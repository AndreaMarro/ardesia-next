import {
  ActorSchema,
  CoreCommandSchema,
  CoreError,
  CoreSnapshotSchema,
  EducationalObjectSchema,
  emptySnapshot,
  migrateSnapshotForOpen,
  type Actor,
  type CommandReceipt,
  type CoreCommand,
  type CoreEvent,
  type CoreSnapshot,
  type EducationalObject,
  type LessonDocument,
  type NewEducationalObject,
} from '@ardesia/contracts';

/** One atomic replacement is required. M0 supports one writer per adapter. */
export interface StorageAdapter {
  read(): Promise<unknown | null>;
  write(snapshot: CoreSnapshot): Promise<void>;
}

export interface CoreOptions {
  storage: StorageAdapter;
  clock?: () => string;
  id?: () => string;
  workspaceId?: string;
}

export interface CoreService {
  execute(actor: Actor, command: CoreCommand): Promise<CommandReceipt>;
  listDocuments(actor: Actor): LessonDocument[];
  getDocument(actor: Actor, documentId: string): LessonDocument;
  getObjectRevision(actor: Actor, documentId: string, objectId: string, revision: number): EducationalObject;
  events(actor: Actor, documentId: string): CoreEvent[];
  /** Local administration/export only. Never expose as an unfiltered remote API. */
  snapshot(): CoreSnapshot;
}

export class MemoryStorage implements StorageAdapter {
  #value: unknown | null;
  constructor(initial: unknown | null = null) { this.#value = structuredClone(initial); }
  async read(): Promise<unknown | null> { return structuredClone(this.#value); }
  async write(snapshot: CoreSnapshot): Promise<void> { this.#value = structuredClone(snapshot); }
}

function parseActor(value: Actor): Actor {
  const result = ActorSchema.safeParse(value);
  if (!result.success) throw new CoreError('INVALID_ACTOR', 'Actor context is invalid.');
  return result.data;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

async function commandFingerprint(actor: Actor, command: CoreCommand): Promise<string> {
  const bytes = new TextEncoder().encode(canonical({ actor, command }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requireOwner(state: CoreSnapshot, actor: Actor, documentId: string): LessonDocument {
  const document = state.documents.find((entry) => entry.id === documentId);
  // Do not reveal whether a different owner's identifier exists.
  if (!document || document.ownerId !== actor.actorId) throw new CoreError('NOT_FOUND', 'Document is unavailable in this workspace.');
  return document;
}

function findObject(document: LessonDocument, id: string): EducationalObject {
  const object = document.objects.find((entry) => entry.id === id);
  if (!object) throw new CoreError('NOT_FOUND', 'Object is unavailable in this document.');
  return object;
}

function sourceRevisionExists(state: CoreSnapshot, document: LessonDocument, sourceId: string, revision: number): boolean {
  if (document.objects.some((object) => object.id === sourceId && object.type === 'source' && object.revision === revision)) return true;
  return state.events.some((event) => {
    if (event.documentId !== document.id || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return false;
    return ['object', 'previous'].some((key) => {
      const object = EducationalObjectSchema.safeParse(event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload) ? event.payload[key] : null);
      return object.success && object.data.type === 'source' && object.data.id === sourceId && object.data.revision === revision;
    });
  });
}

function validateSources(state: CoreSnapshot, document: LessonDocument, input: NewEducationalObject): void {
  for (const source of input.provenance?.sources ?? []) {
    if (!sourceRevisionExists(state, document, source.sourceId, source.revision)) {
      throw new CoreError('INVALID_REFERENCE', 'A source reference must resolve to an exact source revision in this document.');
    }
  }
}

function makeObject(input: NewEducationalObject, actor: Actor, at: string): EducationalObject {
  return EducationalObjectSchema.parse({
    ...input,
    revision: 1,
    status: 'draft',
    provenance: {
      origin: input.provenance?.origin ?? 'authored',
      sources: input.provenance?.sources ?? [],
      createdBy: actor.actorId,
      createdAt: at,
    },
  });
}

function asPayload(value: unknown): CoreEvent['payload'] {
  return JSON.parse(JSON.stringify(value)) as CoreEvent['payload'];
}

function applyCommand(state: CoreSnapshot, actor: Actor, command: CoreCommand, at: string): { document: LessonDocument; payload: CoreEvent['payload'] } {
  if (command.kind === 'create-document') {
    if (state.documents.some((entry) => entry.id === command.documentId)) throw new CoreError('ALREADY_EXISTS', 'A document with this ID already exists.');
    const document: LessonDocument = {
      id: command.documentId,
      ownerId: actor.actorId,
      title: command.title,
      revision: 1,
      status: 'draft',
      createdAt: at,
      updatedAt: at,
      objects: [],
      connections: [],
    };
    state.documents.push(document);
    return { document, payload: { title: command.title } };
  }

  const document = requireOwner(state, actor, command.documentId);
  if (document.status !== 'draft') throw new CoreError('READ_ONLY', 'Approved documents are immutable in M0. Create a new draft through a future revision workflow.');
  if (document.revision !== command.expectedRevision) throw new CoreError('REVISION_CONFLICT', 'The document changed. Reload its current revision before editing.');

  let payload: CoreEvent['payload'];
  switch (command.kind) {
    case 'rename-document': {
      payload = { previousTitle: document.title, title: command.title };
      document.title = command.title;
      break;
    }
    case 'add-object': {
      const previouslyUsed = state.events.some((event) => {
        if (event.documentId !== document.id || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) return false;
        const object = event.payload['object'];
        return object !== null && typeof object === 'object' && !Array.isArray(object) && object['id'] === command.object.id;
      });
      if (document.objects.some((object) => object.id === command.object.id) || previouslyUsed) throw new CoreError('ALREADY_EXISTS', 'Object identities cannot be reused, including after removal.');
      validateSources(state, document, command.object);
      const object = makeObject(command.object, actor, at);
      document.objects.push(object);
      payload = asPayload({ object });
      break;
    }
    case 'replace-object': {
      const previous = findObject(document, command.object.id);
      if (previous.type !== command.object.type) throw new CoreError('INVALID_COMMAND', 'An existing object cannot change its type.');
      if (previous.type === 'lab' && command.object.type === 'lab') {
        const {state: _oldState, ...beforeIdentity} = previous.data;
        const {state: _newState, ...afterIdentity} = command.object.data;
        if (canonical(beforeIdentity) !== canonical(afterIdentity)) throw new CoreError('INVALID_REFERENCE', 'Plugin identity, bundle and schema are immutable. An explicit migration is required.');
      }
      validateSources(state, document, command.object);
      const object = EducationalObjectSchema.parse({
        ...command.object,
        status: 'draft',
        revision: previous.revision + 1,
        provenance: { ...previous.provenance, ...(command.object.provenance ?? {}) },
      });
      document.objects = document.objects.map((entry) => entry.id === object.id ? object : entry);
      payload = asPayload({ previous, object });
      break;
    }
    case 'move-object': {
      const previous = findObject(document, command.objectId);
      const object = { ...previous, x: command.x, y: command.y, status: 'draft' as const, revision: previous.revision + 1 };
      document.objects = document.objects.map((entry) => entry.id === object.id ? object : entry);
      payload = asPayload({ previous, object });
      break;
    }
    case 'remove-object': {
      const previous = findObject(document, command.objectId);
      if (document.objects.some((object) => object.id !== previous.id && object.provenance.sources.some((source) => source.sourceId === previous.id))) {
        throw new CoreError('INVALID_REFERENCE', 'This source is cited by another object. Keep its provenance available.');
      }
      const removedConnections = document.connections.filter((connection) => connection.from === previous.id || connection.to === previous.id);
      document.objects = document.objects.filter((object) => object.id !== previous.id);
      document.connections = document.connections.filter((connection) => connection.from !== previous.id && connection.to !== previous.id);
      payload = asPayload({ previous, removedConnections });
      break;
    }
    case 'connect-objects': {
      findObject(document, command.connection.from);
      findObject(document, command.connection.to);
      if (document.connections.some((connection) => connection.id === command.connection.id)) throw new CoreError('ALREADY_EXISTS', 'A connection with this ID already exists.');
      document.connections.push(command.connection);
      payload = asPayload({ connection: command.connection });
      break;
    }
    case 'disconnect-objects': {
      const previous = document.connections.find((connection) => connection.id === command.connectionId);
      if (!previous) throw new CoreError('NOT_FOUND', 'Connection is unavailable in this document.');
      document.connections = document.connections.filter((connection) => connection.id !== previous.id);
      payload = asPayload({ previous });
      break;
    }
  }
  document.revision += 1;
  document.updatedAt = at;
  return { document, payload };
}

/** Invalid existing bytes reject opening; the adapter is never written on open. */
export async function createCore(options: CoreOptions): Promise<CoreService> {
  let raw: unknown;
  try { raw = await options.storage.read(); }
  catch { throw new CoreError('STORAGE_FAILURE', 'The workspace could not be read. Existing data was not replaced.'); }
  const parsed = CoreSnapshotSchema.safeParse(raw === null ? emptySnapshot(options.workspaceId) : migrateSnapshotForOpen(raw));
  if (!parsed.success) throw new CoreError('INVALID_SNAPSHOT', 'The saved workspace is invalid or incompatible. Existing data was not replaced.');
  let state = structuredClone(parsed.data);
  const clock = options.clock ?? (() => new Date().toISOString());
  const id = options.id ?? (() => crypto.randomUUID());
  let queue: Promise<unknown> = Promise.resolve();

  const service: CoreService = {
    execute(actorInput, commandInput) {
      // Clone and validate before queuing, so caller mutation cannot alter a pending command.
      const actor = parseActor(actorInput);
      const result = CoreCommandSchema.safeParse(commandInput);
      if (!result.success) return Promise.reject(new CoreError('INVALID_COMMAND', 'Command does not satisfy the versioned contract.'));
      const command = structuredClone(result.data);
      const operation = queue.then(async () => {
        if (actor.role !== 'teacher') throw new CoreError('FORBIDDEN', 'Only the teacher owner can edit in M0.');
        const fingerprint = await commandFingerprint(actor, command);
        const duplicate = state.receipts.find((receipt) => receipt.commandId === command.commandId);
        if (duplicate) {
          if (duplicate.actorId !== actor.actorId || duplicate.fingerprint !== fingerprint) throw new CoreError('IDEMPOTENCY_CONFLICT', 'This command ID was already used for a different request.');
          return structuredClone(duplicate);
        }
        const next = structuredClone(state);
        const at = clock();
        const { document, payload } = applyCommand(next, actor, command, at);
        const eventId = id();
        if (next.events.some((event) => event.id === eventId)) throw new CoreError('ALREADY_EXISTS', 'Event ID collision; no command was committed.');
        const event: CoreEvent = {
          id: eventId,
          sequence: next.events.length + 1,
          documentId: document.id,
          documentRevision: document.revision,
          type: command.kind,
          actorId: actor.actorId,
          occurredAt: at,
          payload,
        };
        const receipt: CommandReceipt = {
          commandId: command.commandId,
          actorId: actor.actorId,
          fingerprint,
          documentId: document.id,
          documentRevision: document.revision,
          eventId,
        };
        next.events.push(event);
        next.receipts.push(receipt);
        const validated = CoreSnapshotSchema.safeParse(next);
        if (!validated.success) throw new CoreError('INVALID_COMMAND', 'The resulting state violates a Core invariant.');
        try { await options.storage.write(structuredClone(validated.data)); }
        catch { throw new CoreError('STORAGE_FAILURE', 'Saving failed. The command, event and receipt were not committed in memory.'); }
        state = validated.data;
        return structuredClone(receipt);
      });
      queue = operation.catch(() => undefined);
      return operation;
    },
    listDocuments(actorInput) {
      const actor = parseActor(actorInput);
      return structuredClone(state.documents.filter((document) => document.ownerId === actor.actorId));
    },
    getDocument(actorInput, documentId) {
      return structuredClone(requireOwner(state, parseActor(actorInput), documentId));
    },
    getObjectRevision(actorInput, documentId, objectId, wantedRevision) {
      const document = requireOwner(state, parseActor(actorInput), documentId);
      const current = document.objects.find((object) => object.id === objectId && object.revision === wantedRevision);
      if (current) return structuredClone(current);
      for (const event of state.events) {
        if (event.documentId !== documentId || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) continue;
        for (const key of ['object', 'previous']) {
          const result = EducationalObjectSchema.safeParse(event.payload[key]);
          if (result.success && result.data.id === objectId && result.data.revision === wantedRevision) return structuredClone(result.data);
        }
      }
      throw new CoreError('NOT_FOUND', 'The exact object revision is unavailable.');
    },
    events(actorInput, documentId) {
      requireOwner(state, parseActor(actorInput), documentId);
      return structuredClone(state.events.filter((event) => event.documentId === documentId));
    },
    snapshot() { return structuredClone(state); },
  };
  return service;
}

