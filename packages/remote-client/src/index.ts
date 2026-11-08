import {browserInkDraftStorage, type InkDraftAccess, type InkDraft, type InkDraftStorage} from './ink-drafts';
export {browserInkDraftStorage, parseInkDraft, type InkDraft, type InkDraftAccess, type InkDraftStorage} from './ink-drafts';
import {materialAccess} from './materials';
import type {MaterialAccess} from './materials';
export {type MaterialAccess} from './materials';
import {recordingAccess} from './recordings';
export {sha256, type RecordingAccess} from './recordings';
import {
  WorkspaceAccessSchema, ownsWorkspace, type WorkspaceAccess,
  TutorSpaceSchema, TutorCommandSchema, TutorReceiptSchema, tutorTarget, type TutorSpace, type TutorCommand, type TutorReceipt,
  CourseSpaceSchema, CourseCommandSchema, CourseReceiptSchema, courseTarget,
  type CourseSpace, type CourseCommand, type CourseReceipt,
  ActorSchema, AssignedLabAccessSchema, canonicalJson, CommandReceiptSchema, CoreCommandSchema, CoreError,
  CoreEventSchema, EducationalObjectSchema, LearnerWorkSchema, LearningCommandSchema,
  LearningEventSchema, LearningReceiptSchema, LessonAssignmentSchema, LessonDocumentSchema,
  PluginCommandSchema, PluginInstallationSchema, PluginReceiptSchema,
  type WorkspaceReceipt, type Actor, type AssignedLabAccess, type CommandReceipt, type CoreCommand, type CoreEvent,
  type EducationalObject, type LearnerWork, type LearningCommand, type LearningEvent, type LearningReceipt,
  type LessonAssignment, type LessonDocument, type PluginCommand, type PluginInstallation,
  type PluginReceipt, type NewEducationalObject,
} from '@ardesia/contracts';
import type {CoreService} from '@ardesia/core';
import {browserOfflineStore, OfflineError, parseOfflineSnapshot, type OfflineStore, type OfflineSnapshot} from './offline';
export {browserOfflineStore, OfflineError, parseOfflineSnapshot, type OfflineStore, type OfflineSnapshot} from './offline';

export interface RemoteAccount {id: string; role: Actor['role']; displayName: string}
export interface RemoteSession {account: RemoteAccount; expiresAt: string}
export interface WorkspaceSummary {workspaceId: string; title: string; workspaceRevision: number; access?: WorkspaceAccess}
export interface WorkspaceProjection {
  workspaceId: string; title: string; workspaceRevision: number; actor: Actor; access?: WorkspaceAccess;
  tutorSpace?: TutorSpace;
  courseSpace?: CourseSpace;
  documents: LessonDocument[]; assignedDocuments: LessonDocument[];
  installations: PluginInstallation[]; events: CoreEvent[]; assignments: LessonAssignment[];
  learnerWork: LearnerWork[]; learningEvents: LearningEvent[]; labAccess: AssignedLabAccess[];
}
export interface PersonalExport {
  format: 'ardesia-personal-v1'; accountId: string; workspaceId: string;
  exportedAt: string; projection: WorkspaceProjection;
}
type CommandRequest =
  | {action: 'command'; workspaceId: string; command: CoreCommand}
  | {action: 'plugin-command'; workspaceId: string; command: PluginCommand}
  | {action: 'tutor-command'; workspaceId: string; command: TutorCommand}
  | {action: 'course-command'; workspaceId: string; command: CourseCommand}
  | {action: 'learning-command'; workspaceId: string; command: LearningCommand};
type CreateRequest = {action: 'create-workspace'; title: string; commandId: string};
type ImportRequest = {action: 'import-local'; title: string; commandId: string; expectedAccountId: string; snapshotText: string};
export type PendingRequest = CommandRequest | CreateRequest | ImportRequest;
export type EditCommand = CoreCommand extends infer C ? C extends CoreCommand ? Omit<C, 'commandId' | 'documentId' | 'expectedRevision'> : never : never;
export interface EditIntent {
  actor: Actor; base?: EducationalObject; predecessorId: string | null;
}
export interface RemoteIssue {code: string; message: string}
export interface InkRecoveryAttempt {commandId: string; expectedRevision: number; createdAt: string}
export interface InkReconciliation {
  /** Stable logical recovery identity; the original request remains byte-for-byte unchanged. */
  recoveryId: string; originalOutcome: 'not-sent' | 'revision-conflict'; attempts: InkRecoveryAttempt[];
}
export interface PendingCommand {
  version: 1 | 2 | 3; accountId: string; commandId: string; workspaceId: string | null;
  actorId: string | null;
  request: PendingRequest; createdAt: string;
  status: 'queued' | 'blocked' | 'pending' | 'uncertain' | 'conflict' | 'rejected'; error: RemoteIssue | null;
  edit?: EditIntent;
  reconciliation?: InkReconciliation;
}
export interface PendingStorage {
  read(accountId: string, capture?: boolean): string | null;
  write(accountId: string, value: string): void;
  remove(accountId: string): void;
  /** Remember a validated, normalized read without changing durable bytes. */
  baseline?(accountId: string, value: string): void;
  /** Origin-wide locks. A memory-only mutex must not advertise this capability. */
  coordinate?<T>(scope: string, mode: 'shared' | 'exclusive', operation: () => Promise<T>): Promise<T>;
}
export interface RemoteState {
  status: 'signed-out' | 'offline' | 'loading' | 'confirmed' | 'pending' | 'uncertain' | 'conflict' | 'error';
  account: RemoteAccount | null; workspaceId: string | null; workspaceRevision: number | null;
  pending: readonly PendingCommand[]; error: RemoteIssue | null;
  recovery: 'durable' | 'memory' | 'invalid';
  offlineAvailable: boolean; offlineSavedAt: string | null;
}
export interface RemoteClientOptions {
  fetch?: typeof globalThis.fetch; endpoint?: string; timeoutMs?: number;
  pendingStorage?: PendingStorage; clock?: () => string; id?: () => string;
  offlineStore?: OfflineStore;
  inkDraftStorage?: InkDraftStorage;
}
export class RemoteError extends Error {
  constructor(readonly code: string, message: string, readonly outcome: 'rejected' | 'unknown' = 'rejected', readonly status = 0) {
    super(message); this.name = 'RemoteError';
  }
}
export type {InkRecoveryPreview} from './ink-reconciliation';
function transmittedRequest(entry: PendingCommand): PendingRequest {
  const attempt = entry.reconciliation?.attempts.at(-1);
  return attempt && entry.request.action === 'command' && entry.request.command.kind === 'add-object'
    ? {...entry.request, command: {...entry.request.command, commandId: attempt.commandId, expectedRevision: attempt.expectedRevision}} : entry.request;
}
const attemptIdentity = (entry: PendingCommand) => canonicalJson([entry.request, entry.reconciliation ?? null]);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(value);
const isRevision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const fail = (code: string, message: string): never => {throw new RemoteError(code, message);};
const invalid = (): never => {throw new RemoteError('INVALID_RESPONSE', 'Risposta del server non valida.', 'unknown');};
const issue = (error: unknown): RemoteIssue => error instanceof RemoteError || error instanceof CoreError || error instanceof OfflineError
  ? {code: error.code, message: error.message} : {code: 'NETWORK_ERROR', message: 'Operazione non confermata dal server.'};
const clone = <T>(value: T): T => structuredClone(value);
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {Object.freeze(value); for (const child of Object.values(value)) freeze(child);}
  return value;
}
function array<T>(value: unknown, schema: {parse(input: unknown): T}): T[] {
  if (!Array.isArray(value)) return invalid();
  return value.map(item => schema.parse(item));
}
function parseSession(value: unknown): RemoteSession {
  if (!record(value) || !record(value.account) || !isId(value.account.id)
    || !['teacher', 'student'].includes(String(value.account.role)) || typeof value.account.displayName !== 'string'
    || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))) return invalid();
  return {account: {id: value.account.id, role: value.account.role as Actor['role'], displayName: value.account.displayName}, expiresAt: value.expiresAt};
}
function parseProjection(value: unknown, account: RemoteAccount): WorkspaceProjection {
  try {
    if (!record(value) || !isId(value.workspaceId) || typeof value.title !== 'string' || !isRevision(value.workspaceRevision)) return invalid();
    const projection: WorkspaceProjection = {
      workspaceId: value.workspaceId, title: value.title, workspaceRevision: value.workspaceRevision, actor: ActorSchema.parse(value.actor),
      ...(value.access === undefined ? {} : {access: WorkspaceAccessSchema.parse(value.access)}),
      ...(value.tutorSpace === undefined ? {} : {tutorSpace: TutorSpaceSchema.parse(value.tutorSpace)}),
      ...(value.courseSpace === undefined ? {} : {courseSpace: CourseSpaceSchema.parse(value.courseSpace)}),
      documents: array(value.documents, LessonDocumentSchema), assignedDocuments: array(value.assignedDocuments, LessonDocumentSchema),
      installations: array(value.installations, PluginInstallationSchema), events: array(value.events, CoreEventSchema),
      assignments: array(value.assignments, LessonAssignmentSchema), learnerWork: array(value.learnerWork, LearnerWorkSchema),
      learningEvents: array(value.learningEvents, LearningEventSchema), labAccess: array(value.labAccess, AssignedLabAccessSchema),
    };
    // An imported personal workspace retains its historical actor. Only the server
    // resolves that binding; an assigned learner always uses their account identity.
    const owner = ownsWorkspace(projection);
    if (projection.actor.role !== account.role || (!owner && (account.role !== 'student' || projection.actor.actorId !== account.id))) return invalid();
    const coreActorId = projection.actor.actorId;
    const owned = new Set(projection.documents.map(document => document.id));
    const assigned = new Set(projection.assignments.filter(assignment => assignment.status === 'active' && assignment.studentId === account.id).map(assignment => assignment.documentId));
    if (projection.documents.some(document => document.ownerId !== coreActorId)
      || projection.installations.some(installation => installation.ownerId !== coreActorId)
      || projection.events.some(event => !owned.has(event.documentId))) return invalid();
    if (!owner) {
      if (projection.documents.length || projection.installations.length || projection.events.length
        || projection.assignments.some(assignment => assignment.studentId !== account.id || assignment.status !== 'active')
        || projection.assignedDocuments.some(document => !assigned.has(document.id))
        || projection.learnerWork.some(work => work.studentId !== account.id || !assigned.has(work.documentId))
        || projection.labAccess.some(access => !assigned.has(access.documentId))) return invalid();
    } else if (projection.assignedDocuments.length || projection.labAccess.length
      || projection.assignments.some(assignment => !owned.has(assignment.documentId))
      || account.role === 'student' && (projection.assignments.length > 0 || projection.learnerWork.length > 0)
      || projection.learnerWork.some(work => !owned.has(work.documentId) || !work.evidenceShared
        || !projection.assignments.some(assignment => assignment.documentId === work.documentId && assignment.studentId === work.studentId && assignment.status === 'active'))) return invalid();
    if (projection.learningEvents.some(event => !projection.learnerWork.some(work => work.documentId === event.lessonId && work.studentId === event.studentId))) return invalid();
    if ((projection.tutorSpace?.records.some(value => account.role !== 'teacher' || value.ownerId !== coreActorId) || projection.tutorSpace?.history.some(value => account.role !== 'teacher' || value.actorId !== coreActorId || value.payload.value.ownerId !== coreActorId))) return invalid();
    if (projection.courseSpace) {
      const space = projection.courseSpace;
      if (space.courses.some(course => !owner || course.ownerId !== coreActorId)
        || space.deliveries.some(value => value.learnerId !== coreActorId && !(owner && account.role === 'teacher' && value.ownerId === coreActorId))
        || space.editions.some(({edition, course}) => edition.courseId !== course.id || edition.courseRevision !== course.revision
          || edition.ownerId !== course.ownerId || !(owner && edition.ownerId === coreActorId)
          && !space.deliveries.some(value => value.editionId === edition.id && value.learnerId === coreActorId && value.status === 'active'))
        || space.work.some(work => !space.deliveries.some(value => value.id === work.id
          && (value.learnerId === coreActorId || owner && account.role === 'teacher' && value.ownerId === coreActorId && value.status === 'active' && work.shared)))) return invalid();
    }
    return projection;
  } catch (error) {if (error instanceof RemoteError) throw error; return invalid();}
}
function parseRequest(value: unknown): PendingRequest {
  if (!record(value)) return fail('INVALID_RECOVERY', 'Recupero non valido. I dati originali sono conservati.');
  if (['command', 'plugin-command', 'learning-command', 'course-command', 'tutor-command'].includes(String(value.action)) && isId(value.workspaceId)) {
    if (value.action === 'tutor-command') return {action: value.action, workspaceId: value.workspaceId, command: TutorCommandSchema.parse(value.command)};
    if (value.action === 'course-command') return {action: value.action, workspaceId: value.workspaceId, command: CourseCommandSchema.parse(value.command)};
    if (value.action === 'command') return {action: value.action, workspaceId: value.workspaceId, command: CoreCommandSchema.parse(value.command)};
    if (value.action === 'plugin-command') return {action: value.action, workspaceId: value.workspaceId, command: PluginCommandSchema.parse(value.command)};
    return {action: 'learning-command', workspaceId: value.workspaceId, command: LearningCommandSchema.parse(value.command)};
  }
  if (isId(value.commandId) && typeof value.title === 'string' && value.title.trim() && value.title.length <= 240) {
    if (value.action === 'create-workspace') return {action: value.action, commandId: value.commandId, title: value.title};
    if (value.action === 'import-local' && isId(value.expectedAccountId) && typeof value.snapshotText === 'string') {
      return {action: value.action, commandId: value.commandId, title: value.title, expectedAccountId: value.expectedAccountId, snapshotText: value.snapshotText};
    }
  }
  return fail('INVALID_COMMAND', 'Comando non valido.');
}
// Recovery validation has one external failure mode; original bytes are preserved.
function corruptRecovery(): never {throw Error('Invalid recovery');}
/** Stores recovery requests only, never credentials or a second confirmed workspace. */
export function browserPendingStorage(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>, prefix = 'ardesia-next.pending.v1.', locks: Pick<LockManager, 'request'> | null | undefined = typeof navigator === 'undefined' ? undefined : navigator.locks): PendingStorage {
  const key = (accountId: string) => prefix + encodeURIComponent(accountId);
  const snapshots = new Map<string, Map<string, string>>(), observed = new Map<string, Map<string, string>>();
  const durable = new Map<string, Map<string, string>>();
  const entries = (raw: string): Map<string, string> => {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) corruptRecovery();
    const result = new Map<string, string>();
    for (const value of values) {
      if (!record(value) || !isId(value.commandId) || result.has(value.commandId)) corruptRecovery();
      result.set(value.commandId, JSON.stringify(value));
    }
    return result;
  };
  function unchanged(before: string | undefined | null, after: string) {
    if (!before || before === 'null') return;
    const prior = JSON.parse(before) as PendingCommand, next = JSON.parse(after) as PendingCommand;
    if (prior.accountId !== next.accountId || prior.actorId !== next.actorId
      || canonicalJson(prior.request) !== canonicalJson(next.request)
      || prior.reconciliation && (!next.reconciliation || canonicalJson(prior.reconciliation.attempts) !== canonicalJson(next.reconciliation.attempts.slice(0, prior.reconciliation.attempts.length)))) corruptRecovery();
  }
  function write(id: string, raw: string) {
    const accountKey = key(id), next = entries(raw), previous = snapshots.get(id) ?? new Map<string, string>();
    const old = entries(storage.getItem(accountKey) ?? '[]'), known = durable.get(id) ?? new Map<string, string>();
    const actual = (commandId: string) => storage.getItem(accountKey + '/' + encodeURIComponent(commandId)) ?? old.get(commandId) ?? null;
    const check = (commandId: string) => {
      if (actual(commandId) !== (known.get(commandId) ?? null)) throw new RemoteError('RECOVERY_CHANGED', 'Recupero cambiato. Rileggi prima di proseguire.');
    };
    // Compare every changed row before the first write. Origin-wide queue locks
    // make this read/check/write atomic with other clients of this protocol.
    for (const [commandId, value] of next) if (previous.get(commandId) !== value) check(commandId);
    for (const commandId of previous.keys()) if (!next.has(commandId)) check(commandId);
    const retained = new Set(old.keys());
    for (let index = 0; index < storage.length; index++) {
      const path = storage.key(index);
      if (path?.startsWith(accountKey + '/')) {
        const commandId = decodeURIComponent(path.slice(accountKey.length + 1));
        if (storage.getItem(path) === 'null') retained.delete(commandId); else retained.add(commandId);
      }
    }
    for (const commandId of previous.keys()) if (!next.has(commandId)) retained.delete(commandId);
    for (const commandId of next.keys()) retained.add(commandId);
    if (retained.size > 500) throw new RemoteError('RECOVERY_LIMIT', 'Il recupero condiviso contiene già 500 modifiche. Esporta le modifiche in memoria prima di proseguire.');
    snapshots.set(id, previous); durable.set(id, known);
    // Each command has its own atomic localStorage value. Never rewrite the
    // legacy array, a shared index, or an ID created by another open tab.
    for (const [commandId, value] of next) if (previous.get(commandId) !== value) {
      const path = accountKey + '/' + encodeURIComponent(commandId);
      unchanged(old.get(commandId), value); unchanged(storage.getItem(path), value);
      storage.setItem(path, value);
      known.set(commandId, value); previous.set(commandId, value);
    }
    for (const commandId of previous.keys()) if (!next.has(commandId)) {
      const path = accountKey + '/' + encodeURIComponent(commandId);
      if (old.has(commandId)) storage.setItem(path, 'null'); else storage.removeItem(path);
      if (old.has(commandId)) known.set(commandId, 'null'); else known.delete(commandId);
      previous.delete(commandId);
    }
    snapshots.set(id, next); durable.set(id, known);
  }
  return {
    read(id, capture = true) {
      const accountKey = key(id), original = storage.getItem(accountKey), rows = new Map<string, string>();
      if (original !== null) rows.set(accountKey, original);
      for (let index = 0; index < storage.length; index++) {
        const path = storage.key(index);
        if (path?.startsWith(accountKey + '/')) {const value = storage.getItem(path); if (value !== null) rows.set(path, value);}
      }
      if (capture) {observed.set(id, rows); snapshots.delete(id);}
      try {
        const values = entries(original ?? '[]');
        for (const [path, raw] of rows) if (path !== accountKey) {
          const commandId = decodeURIComponent(path.slice(accountKey.length + 1)), value: unknown = JSON.parse(raw);
          if (!isId(commandId) || value !== null && (!record(value) || value.commandId !== commandId)) corruptRecovery();
          if (value === null) values.delete(commandId);
          else {
            unchanged(values.get(commandId), raw);
            values.set(commandId, raw);
          }
        }
        if (capture) {
          const bytes = new Map(values);
          for (const [path, raw] of rows) if (path !== accountKey && raw === 'null') bytes.set(decodeURIComponent(path.slice(accountKey.length + 1)), raw);
          durable.set(id, bytes);
        }
        return values.size ? '[' + [...values.values()].join(',') + ']' : null;
      } catch {
        // Keep every original byte exportable, including corrupt individual rows.
        return rows.size === 1 && original !== null ? original : JSON.stringify({recovery: [...rows]});
      }
    },
    write,
    baseline(id, raw) {snapshots.set(id, entries(raw));},
    ...(locks ? {coordinate: async <T>(scope: string, mode: 'shared' | 'exclusive', operation: () => Promise<T>): Promise<T> => await locks.request('ardesia:pending:' + prefix + scope, {mode}, operation)} : {}),
    remove(id) {
      if (snapshots.has(id)) write(id, '[]');
      else for (const [path, raw] of observed.get(id) ?? []) if (storage.getItem(path) === raw) storage.removeItem(path);
    },
  };
}
export function createRemoteClient(options: RemoteClientOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis), endpoint = options.endpoint ?? '/api/m3';
  if (!/^\/(?!\/)/.test(endpoint) || endpoint.includes('#')) throw Error('Same-origin API required.');
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 120_000) throw Error('Invalid timeout.');
  const clock = options.clock ?? (() => new Date().toISOString()), id = options.id ?? (() => crypto.randomUUID());
  let storage = options.pendingStorage;
  let inkDraftStorage = options.inkDraftStorage;
  if (!inkDraftStorage && typeof window !== 'undefined') {try {inkDraftStorage = browserInkDraftStorage(window.localStorage);} catch { /* Drawing reports unavailable checkpoint storage. */ }}
  if (!storage && typeof window !== 'undefined') {
    // Access may be denied by the browser. Keep explicit in-memory recovery in that case.
    try {storage = browserPendingStorage(window.localStorage);} catch { /* Transport remains usable. */ }
  }
  let session: RemoteSession | null = null, projection: WorkspaceProjection | null = null;
  const receiptListeners = new Set<(request: PendingRequest, receipt: WorkspaceReceipt) => void>();
  let offline: OfflineSnapshot | null = null, offlineAvailable = false, offlineSavedAt: string | null = null;
  let cache = options.offlineStore;
  if (!cache && typeof window !== 'undefined') {
    try {if (window.indexedDB) cache = browserOfflineStore(window.indexedDB);} catch { /* Offline availability remains disabled. */ }
  }
  let localGeneration: string | null = null, cacheWrites: Promise<unknown> = Promise.resolve();
  let localInkWrites: Promise<unknown> = Promise.resolve(), reconnecting: number | null = null;
  let epoch = 0, selection = 0, version = 0, loading = false, lastError: RemoteIssue | null = null;
  let recoveryBlocked = false;
  let pending = new Map<string, PendingCommand>();
  const memoryRecovery = new Map<string, string>();
  let state: RemoteState;
  const listeners = new Set<() => void>(), active = new Map<string, Promise<unknown>>();
  // Scheduling only: immutable requests and unsent drafts live in the existing
  // account-scoped recovery store, never in a second workspace or journal.
  const scheduled = new Map<PendingCommand, Promise<void>>();
  let authQueue: Promise<unknown> = Promise.resolve();
  function emit() {
    const entries = [...pending.values()];
    const status: RemoteState['status'] = offline ? 'offline' : !session ? 'signed-out' : loading ? 'loading'
      : entries.some(item => item.status === 'uncertain') ? 'uncertain'
      : entries.some(item => item.status === 'conflict') ? 'conflict'
      : entries.some(item => item.status === 'pending' || item.status === 'queued') ? 'pending'
      : entries.length || lastError ? 'error' : 'confirmed';
    state = freeze(clone({status, account: session?.account ?? null, workspaceId: projection?.workspaceId ?? null,
      workspaceRevision: projection?.workspaceRevision ?? null, pending: entries, error: lastError,
      recovery: recoveryBlocked ? 'invalid' : !storage || recoveryAccount() && memoryRecovery.has(recoveryAccount()!.id) ? 'memory' : 'durable',
      offlineAvailable, offlineSavedAt}));
    version++; for (const listener of listeners) listener();
  }
  function invalidate() {
    if (recoveryAccount() && !recoveryBlocked) {
      let changed = false;
      for (const entry of pending.values()) if (entry.status === 'queued') {
        changed = true;
        entry.status = 'blocked'; entry.error = {code: 'SESSION_CHANGED', message: 'Non inviata: sessione cambiata. Riprendi esplicitamente.'};
      }
      // Queued bytes restore as blocked. Do not write outside the recovery locks
      // while an older request is finishing or another tab is reconciling.
      if (changed && memoryRecovery.has(recoveryAccount()!.id)) rememberRecovery();
    }
    epoch++; selection++; reconnecting = null; session = null; projection = null; offline = null; offlineAvailable = false; offlineSavedAt = null;
    pending = new Map(); loading = false; recoveryBlocked = false; emit();
  }
  function recoveryAccount(): RemoteAccount | null {return session?.account ?? offline?.account ?? null;}
  async function checkLocalGate(ownerId: string, local = false) {
    if (!cache) {if (local) return fail('OFFLINE_UNAVAILABLE', 'Archivio offline non disponibile.'); return;}
    const gate = await cache.gate();
    if (!localGeneration || gate.generation !== localGeneration || gate.signedOut || gate.accountId !== ownerId
      || local && gate.workspaceId !== offline?.workspaceId) return fail('SESSION_CHANGED', 'Accesso locale chiuso o cambiato.');
  }
  function closeLocal() {
    const generation = localGeneration;
    cacheWrites = cacheWrites.catch(() => undefined).then(() => cache?.close(generation ?? undefined));
    return cacheWrites;
  }
  function snapshotFor(owner: RemoteAccount, source: WorkspaceProjection): OfflineSnapshot {
    return parseOfflineSnapshot({format: 'ardesia-own-lessons-v1', account: owner, workspaceId: source.workspaceId,
      title: source.title, workspaceRevision: source.workspaceRevision, actor: source.actor, documents: source.documents, savedAt: clock()});
  }
  function updateOfflineCopy(source: WorkspaceProjection, enable = false) {
    if (!cache || !localGeneration || !session || !ownsWorkspace(source)) return;
    const snapshot = snapshotFor(session.account, source), generation = localGeneration, expected = epoch;
    cacheWrites = cacheWrites.catch(() => undefined).then(async () => {
      requireEpoch(expected);
      // A reading-copy revision is durable only with every referenced original.
      const gate=await cache!.gate();
      if(!enable&&gate.workspaceId!==snapshot.workspaceId)return;
      const ids=new Map(snapshot.documents.flatMap(d=>d.objects.flatMap(o=>o.type==='material'?[[o.data.assetId,o.data.sha256] as const]:[])));
      if(ids.size&&!cache!.putMaterial)return fail('OFFLINE_UNAVAILABLE','Archivio dei materiali non disponibile.');
      const api=materialAccess(snapshot.workspaceId,read,async()=>{requireEpoch(expected);await checkLocalGate(snapshot.account.id);});
      for(const [id,digest] of ids){
        const saved=gate.workspaceId===snapshot.workspaceId?await cache!.getMaterial?.(generation,snapshot.account.id,snapshot.workspaceId,id):null;
        if(saved?.state.manifest.sha256===digest)continue;
        const blob=await api.download(id,digest),state=await api.read(id);requireEpoch(expected);await cache!.putMaterial!(generation,snapshot.account.id,snapshot.workspaceId,state,blob);
      }
      // Without explicit enable the store only writes the already authorized workspace.
      if (await cache!.save(generation, snapshot, enable) && epoch === expected && projection?.workspaceId === snapshot.workspaceId) {
        offlineSavedAt = snapshot.savedAt; emit();
      }
    });
    // Report background read-cache failures, but retain the rejection for transitions
    // and ACK cleanup. An unsuccessful save must never masquerade as a durable copy.
    void cacheWrites.catch(error => {if (epoch === expected) {lastError = issue(error); emit();}});
  }
  async function readyOfflineCopy(expected: number, chosen: number) {
    for (;;) {
      const writes = cacheWrites;
      await writes; requireEpoch(expected);
      const found = await cache!.load(); requireEpoch(expected);
      if (selection !== chosen) return fail('WORKSPACE_CHANGED', 'Altro spazio aperto.');
      // A receipt may queue another save while load reads its transaction snapshot.
      if (writes !== cacheWrites) continue;
      if (found && projection?.workspaceId === found.snapshot.workspaceId && found.snapshot.workspaceRevision < projection.workspaceRevision) {
        return fail('OFFLINE_COPY_STALE', 'La copia offline non contiene ancora le ultime conferme. Riprova con la rete attiva.');
      }
      return found;
    }
  }
  function account(): RemoteAccount {if (!session) return fail('UNAUTHENTICATED', 'Accedi per aprire lo spazio.'); return session.account;}
  function current(): WorkspaceProjection {account(); if (!projection) return fail('WORKSPACE_REQUIRED', 'Apri uno spazio.'); return projection;}
  function requireActor(actor: Actor) {
    const known = account();
    const bound = current().actor;
    if (actor.actorId !== bound.actorId || actor.role !== bound.role || actor.role !== known.role) throw new CoreError('INVALID_ACTOR', 'Identità non valida per questo spazio.');
  }
  function requireEpoch(expected: number) {if (epoch !== expected) return fail('SESSION_CHANGED', 'Sessione cambiata: risposta precedente ignorata.');}
  function rememberRecovery() {const owner = recoveryAccount(); if (owner) memoryRecovery.set(owner.id, JSON.stringify([...pending.values()]));}
  function saveRecovery() {
    const owner = recoveryAccount(); if (!owner) return;
    try {
      const values = [...pending.values()], accountId = owner.id;
      if (storage) {
        if (values.length) storage.write(accountId, JSON.stringify(values)); else storage.remove(accountId);
        memoryRecovery.delete(accountId);
      }
      else if (values.length) memoryRecovery.set(accountId, JSON.stringify(values)); else memoryRecovery.delete(accountId);
    }
    catch (error) {
      if (error instanceof RemoteError && error.code === 'RECOVERY_CHANGED') throw error;
      rememberRecovery(); throw new RemoteError('RECOVERY_STORAGE_FAILURE', 'Copia di recupero in memoria. Esportala prima di chiudere. Nessun nuovo invio.');
    }
  }
  function loadRecovery(synchronize = false) {
    const owner = recoveryAccount(); if (!owner) return;
    try {
      // A failed durable write remains an explicit local barrier. Never replace
      // its unsaved bytes with a shorter disk copy during a routine reread.
      if (synchronize && memoryRecovery.has(owner.id)) return;
      const raw = memoryRecovery.get(owner.id) ?? storage?.read(owner.id) ?? null;
      if (raw === null) {if (synchronize) pending.clear(); storage?.baseline?.(owner.id, '[]'); return;}
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length > 500) corruptRecovery();
      const restored = new Map<string, PendingCommand>();
      for (const item of parsed) {
        if (!record(item) || (item.version !== 1 && item.version !== 2 && item.version !== 3) || item.accountId !== owner.id || !isId(item.commandId)
          || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) || restored.has(item.commandId)) corruptRecovery();
        const request = parseRequest(item.request);
        const commandId = 'command' in request ? request.command.commandId : request.commandId;
        const workspaceId = 'workspaceId' in request ? request.workspaceId : null;
        if (commandId !== item.commandId || workspaceId !== item.workspaceId
          || ('command' in request ? !isId(item.actorId) : item.actorId !== null)
          || (request.action === 'import-local' && request.expectedAccountId !== owner.id)) corruptRecovery();
        let edit: EditIntent | undefined;
        if (item.version === 2 || item.version === 3) {
          if (request.action !== 'command' || !record(item.edit)
            || (item.edit.predecessorId !== null && (!isId(item.edit.predecessorId) || item.edit.predecessorId === commandId))
            || !['queued', 'blocked', 'pending', 'uncertain', 'conflict', 'rejected'].includes(String(item.status))) corruptRecovery();
          const actor = ActorSchema.parse(item.edit.actor);
          if (actor.actorId !== item.actorId) corruptRecovery();
          edit = {actor, predecessorId: item.edit.predecessorId as string | null,
            ...(item.edit.base === undefined ? {} : {base: EducationalObjectSchema.parse(item.edit.base)})};
        }
        let reconciliation: InkReconciliation | undefined;
        if (item.version === 3) {
          const value = item.reconciliation;
          if (request.action !== 'command' || request.command.kind !== 'add-object' || request.command.object.type !== 'ink'
            || !record(value) || value.recoveryId !== commandId || !['not-sent', 'revision-conflict'].includes(String(value.originalOutcome))
            || !Array.isArray(value.attempts) || !value.attempts.length || value.attempts.length > 16) corruptRecovery();
          const ids = new Set([commandId]); let revision = request.command.expectedRevision;
          const attempts: InkRecoveryAttempt[] = [];
          for (const attempt of value.attempts) {
            if (!record(attempt) || !isId(attempt.commandId) || ids.has(attempt.commandId)
              || !isRevision(attempt.expectedRevision) || attempt.expectedRevision <= revision
              || typeof attempt.createdAt !== 'string' || !Number.isFinite(Date.parse(attempt.createdAt))) corruptRecovery();
            ids.add(attempt.commandId); revision = attempt.expectedRevision;
            attempts.push({commandId: attempt.commandId, expectedRevision: attempt.expectedRevision, createdAt: attempt.createdAt});
          }
          reconciliation = {recoveryId: commandId, originalOutcome: value.originalOutcome as InkReconciliation['originalOutcome'], attempts};
        } else if (item.reconciliation !== undefined) corruptRecovery();
        const unsent = item.version !== 1 && (item.status === 'queued' || item.status === 'blocked');
        const entry: PendingCommand = {version: item.version, accountId: owner.id, commandId, workspaceId, actorId: item.actorId as string | null, request,
          createdAt: item.createdAt, ...(edit ? {edit} : {}), ...(reconciliation ? {reconciliation} : {}), status: unsent ? 'blocked' : 'uncertain', error: unsent
            ? {code: 'RECOVERED_EDIT', message: 'Non inviata. Risolvi la richiesta precedente, poi riprendi.'}
            : {code: 'RECOVERED_REQUEST', message: 'Verifica l’esito con lo stesso comando.'}};
        const previous = synchronize ? pending.get(commandId) : undefined;
        if (previous && attemptIdentity(previous) === attemptIdentity(entry)) {
          // Preserve locally established outcome knowledge across routine reads;
          // dependency releases from another tab are nevertheless authoritative.
          if (!unsent && item.status !== previous.status) {
            previous.status = 'uncertain'; previous.error = {code: 'RECOVERED_REQUEST', message: 'Un’altra scheda ha tentato questa modifica. Verifica lo stesso comando.'};
          }
          previous.edit = edit; restored.set(commandId, previous);
        } else restored.set(commandId, entry);
      }
      const attemptIds = new Set(restored.keys());
      for (const entry of restored.values()) for (const attempt of entry.reconciliation?.attempts ?? []) {
        if (attemptIds.has(attempt.commandId)) corruptRecovery(); attemptIds.add(attempt.commandId);
      }
      const ordered = new Map<string, PendingCommand>(), visiting = new Set<string>();
      function visit(entry: PendingCommand) {
        if (ordered.has(entry.commandId)) return;
        if (visiting.has(entry.commandId)) corruptRecovery();
        visiting.add(entry.commandId);
        const predecessor = entry.edit?.predecessorId ? restored.get(entry.edit.predecessorId) : undefined;
        if (predecessor) {
          if (predecessor.workspaceId !== entry.workspaceId) corruptRecovery();
          visit(predecessor);
        }
        ordered.set(entry.commandId, entry);
      }
      for (const entry of restored.values()) visit(entry);
      if (!memoryRecovery.has(owner.id)) storage?.baseline?.(owner.id, JSON.stringify([...ordered.values()]));
      pending = ordered;
    } catch {recoveryBlocked = true; lastError = {code: 'INVALID_RECOVERY', message: 'Recupero non valido. I dati originali sono conservati.'};}
  }
  function coordinate<T>(workspaceId: string | null, suffix: string, mode: 'shared' | 'exclusive', operation: () => Promise<T>): Promise<T> {
    const owner = recoveryAccount(), expected = epoch;
    if (!owner) return Promise.reject(new RemoteError('UNAUTHENTICATED', 'Apri il tuo spazio.'));
    const run = async () => {requireEpoch(expected); return operation();};
    return storage?.coordinate ? storage.coordinate(JSON.stringify([owner.id, workspaceId, suffix]), mode, run) : run();
  }
  function recoveryQueue<T>(workspaceId: string | null, operation: () => T | Promise<T>): Promise<T> {
    // Rows and the 500-intent quota are account-wide even when HTTP authoring
    // proceeds independently in different workspaces. This lock is only held
    // for the short durable read/check/write, never for a network response.
    return coordinate(null, 'queue', 'exclusive', async () => {
      if (storage?.coordinate) loadRecovery(true);
      if (recoveryBlocked) return fail('INVALID_RECOVERY', 'Esporta il recupero originale prima di proseguire.');
      return operation();
    });
  }
  async function request(body: Record<string, unknown>, expectedAccount?: string): Promise<unknown> {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const protectedReadOrWrite = expectedAccount && !['session', 'login', 'logout'].includes(String(body.action));
      if (protectedReadOrWrite) {
        if (!session || offline) return fail('UNAUTHENTICATED', 'Ricollegati prima di inviare al server.');
        if (cache) await checkLocalGate(expectedAccount);
      }
      const response = await fetcher(endpoint, {method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        headers: {'Content-Type': 'application/json', Accept: 'application/json', ...(expectedAccount ? {'X-Ardesia-Account': expectedAccount} : {})},
        body: JSON.stringify(body), signal: controller.signal});
      const text = await response.text(); if (text.length > 8 * 1024 * 1024) return invalid();
      if (protectedReadOrWrite && cache) await checkLocalGate(expectedAccount);
      let value: unknown; try {value = JSON.parse(text);} catch {return invalid();}
      if (!record(value) || typeof value.ok !== 'boolean') return invalid();
      if (value.ok === false) {
        if (!record(value.error) || typeof value.error.code !== 'string' || typeof value.error.message !== 'string') return invalid();
        throw new RemoteError(value.error.code, value.error.message, 'rejected', response.status);
      }
      if (!response.ok || !Object.hasOwn(value, 'result')) return invalid();
      return value.result;
    } catch (error) {
      if (error instanceof RemoteError || error instanceof OfflineError) throw error;
      throw new RemoteError(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR', 'Operazione non confermata dal server. Recuperala senza duplicarla.', 'unknown');
    } finally {clearTimeout(timer);}
  }
  function handleFailure(error: unknown, expected: number) {
    if (epoch !== expected) return;
    lastError = issue(error);
    if (['UNAUTHENTICATED', 'SESSION_CHANGED'].includes(lastError.code)) {
      void closeLocal().catch(() => undefined); invalidate();
    } else emit();
  }
  function invalidateDeniedLearningRead(body: Record<string, unknown>, error: unknown) {
    const feedback = body.action === 'learning-command' && record(body.command) && body.command.kind === 'review-learner-attempt';
    const selected = projection;
    if (selected && selected.workspaceId === body.workspaceId && (body.action === 'course-command' || body.action === 'read-course-lesson')
      && error instanceof RemoteError && ['NOT_FOUND', 'FORBIDDEN'].includes(error.code)) {
      const space = selected.courseSpace;
      if (space) projection = {...selected, courseSpace: {...space, courses: [], editions: [],
        work: space.work.filter(work => space.deliveries.some(delivery => delivery.id === work.id && delivery.learnerId === selected.actor.actorId))}};
      selection++; loading = false; return;
    }
    if (projection?.workspaceId === body.workspaceId && (body.action === 'read-attempt-source' || feedback)
      && error instanceof RemoteError && ['NOT_FOUND', 'FORBIDDEN'].includes(error.code)) {
      // An observed refusal invalidates disposable evidence immediately, including
      // late refresh/command responses. Reopening requires a new authorized read.
      // Pending envelopes remain intact; the own-lesson offline copy has no learner data.
      projection = null; selection++; loading = false;
    }
  }
  function accept(value: unknown, expected: number, workspaceId?: string, select = false): WorkspaceProjection {
    requireEpoch(expected);
    const next = parseProjection(value, account());
    if (workspaceId && next.workspaceId !== workspaceId) return invalid();
    if (projection?.workspaceId === next.workspaceId && (projection.actor.actorId !== next.actor.actorId || projection.actor.role !== next.actor.role || ownsWorkspace(projection) !== ownsWorkspace(next))) return invalid();
    if (projection?.workspaceId === next.workspaceId && next.workspaceRevision < projection.workspaceRevision) {updateOfflineCopy(projection); return clone(projection);}
    updateOfflineCopy(next);
    if (select || projection?.workspaceId === next.workspaceId) {projection = next; emit();}
    return clone(next);
  }
  function authenticate(body: Record<string, unknown>, reset: boolean): Promise<RemoteSession> {
    if (reset) {lastError = null; invalidate();}
    const expected = epoch, known = session?.account.id ?? offline?.account.id;
    const barrier = cache ? (reset ? cache.close() : cache.gate()) : null;
    void barrier?.catch(() => undefined); // Auth may be queued behind an earlier cookie request.
    loading = true; emit();
    const operation = authQueue.then(async () => {
      requireEpoch(expected);
      try {
        let gate;
        try {gate = await barrier;} catch (error) {
          // An explicit fresh login may use the server without the optional copy.
          // A cold automatic session must not bypass an unreadable local logout.
          if (!reset || !(error instanceof OfflineError) || error.code !== 'OFFLINE_STORAGE_FAILURE') throw error;
          cache = undefined; localGeneration = null; offlineAvailable = false; offlineSavedAt = null; gate = null;
        }
        requireEpoch(expected);
        if (gate) {
          localGeneration = gate.generation;
          if (!reset && gate.signedOut) return fail('UNAUTHENTICATED', 'Spazio chiuso su questo dispositivo. Accedi di nuovo.');
        }
        const value = parseSession(await request(body, reset ? undefined : known)); requireEpoch(expected);
        if (session && (session.account.id !== value.account.id || session.account.role !== value.account.role)) {invalidate(); return fail('SESSION_CHANGED', 'Sessione cambiata. Accedi di nuovo.');}
        const confirmedGate = gate ? await cache!.confirm(gate.generation, value.account.id, value.account.role, reset) : null; requireEpoch(expected);
        const first = !session; session = value; offline = null; lastError = null;
        offlineAvailable = !!confirmedGate?.workspaceId;
        if (first) loadRecovery(); return clone(value);
      } catch (error) {handleFailure(error, expected); throw error;}
      finally {if (epoch === expected) {loading = false; emit();}}
    });
    authQueue = operation.catch(() => undefined); return operation;
  }
  async function send(original: PendingCommand, workspaceLockHeld = false): Promise<unknown> {
    // Only publish an active promise AFTER acquiring its workspace lock. An
    // exclusive recovery must never await a shared request queued behind itself.
    if (!workspaceLockHeld) {
      const captured = clone(original);
      return coordinate(captured.workspaceId, 'workspace', 'shared', () => send(captured, true));
    }
    const outgoing = transmittedRequest(original), attemptId = 'command' in outgoing ? outgoing.command.commandId : outgoing.commandId;
    const key = original.accountId + ':' + original.commandId + '/' + attemptId, running = active.get(key); if (running) return running;
    const expected = epoch, selected = selection, identity = attemptIdentity(original);
    const run = () => coordinate(original.workspaceId, 'intent:' + original.commandId, 'exclusive', async () => {
      let entry = original, body = transmittedRequest(original), unsent = false, dispatched = false;
      const transmittedId = 'command' in body ? body.command.commandId : body.commandId;
      try {
        await recoveryQueue(original.workspaceId, () => {
          requireEpoch(expected); if (account().id !== entry.accountId) return fail('SESSION_CHANGED', 'Comando di un altro account.');
          const fresh = pending.get(entry.commandId);
          if (!fresh || attemptIdentity(fresh) !== identity) return fail('RECOVERY_CHANGED', 'Recupero cambiato. Rileggi prima di proseguire.');
          entry = fresh; body = transmittedRequest(entry);
          unsent = entry.version !== 1 && (entry.status === 'queued' || entry.status === 'blocked');
          if (unsent) {
            if (selected !== selection || loading || current().workspaceId !== entry.workspaceId) return fail('WORKSPACE_CHANGED', 'Non inviata: spazio cambiato.');
            if (!entry.edit || body.action !== 'command') return fail('INVALID_RECOVERY', 'Intento non valido.');
            requireActor(entry.edit.actor);
            if (entry.edit.predecessorId) return fail('EDIT_BLOCKED', 'Non inviata: manca la conferma della modifica precedente.');
            const document = ownedDocument(entry.edit.actor, body.command.documentId);
            if (entry.edit.base && canonicalJson(entry.edit.base) !== canonicalJson(document.objects.find(object => object.id === entry.edit!.base!.id))) {
              throw new CoreError('REVISION_CONFLICT', 'Il contenuto salvato è cambiato. La bozza resta intatta: ripristina per aggiornarla.');
            }
            if (document.revision !== body.command.expectedRevision) return fail('REVISION_CONFLICT', 'Non inviata: revisione cambiata. Bozza conservata.');
          }
          entry.status = 'pending'; entry.error = null; saveRecovery(); lastError = null; emit();
        });
        requireEpoch(expected);
        if (unsent && selected !== selection) return fail('WORKSPACE_CHANGED', 'Non inviata: spazio cambiato.');
        dispatched = true;
        const raw = await request(body, entry.accountId); requireEpoch(expected);
        let result: unknown;
        if ('command' in body) {
          if (!record(raw)) return invalid();
          try {
            result = body.action === 'command' ? CommandReceiptSchema.parse(raw.receipt)
              : body.action === 'plugin-command' ? PluginReceiptSchema.parse(raw.receipt)
              : body.action === 'tutor-command' ? TutorReceiptSchema.parse(raw.receipt)
              : body.action === 'course-command' ? CourseReceiptSchema.parse(raw.receipt) : LearningReceiptSchema.parse(raw.receipt);
          } catch {return invalid();}
          const receipt = result as CommandReceipt | PluginReceipt | LearningReceipt | CourseReceipt | TutorReceipt;
          if (receipt.commandId !== transmittedId || receipt.actorId !== entry.actorId) return invalid();
          if (body.action === 'command' && (!('documentId' in receipt) || receipt.documentId !== body.command.documentId
            || receipt.documentRevision !== body.command.expectedRevision + 1)) return invalid();
          if (body.action === 'tutor-command') {
            if (selected !== selection) throw new RemoteError('WORKSPACE_CHANGED', 'Accesso cambiato durante la richiesta. Recupera la stessa modifica.', 'unknown');
            const target = tutorTarget(body.command);
            if (!('tutorEntity' in receipt) || receipt.tutorEntity !== target.tutorEntity || receipt.entityId !== target.entityId
              || receipt.entityRevision !== body.command.expectedRevision + 1) return invalid();
          }
          if (body.action === 'course-command') {
            if (selected !== selection) throw new RemoteError('WORKSPACE_CHANGED', 'Accesso cambiato durante la richiesta. Recupera la stessa modifica.', 'unknown');
            const target = courseTarget(body.command);
            if (!('courseEntity' in receipt) || receipt.courseEntity !== target.courseEntity || receipt.entityId !== target.entityId
              || receipt.entityRevision !== body.command.expectedRevision + 1) return invalid();
          }
          const next = parseProjection(raw.projection, account());
          if (next.actor.actorId !== entry.actorId) return invalid();
          // The receipt remains valid after navigation or a refused evidence read,
          // but its earlier full projection must not restore invalidated grants.
          if (selected === selection) accept(next, expected, body.workspaceId);
        } else result = accept(raw, expected, undefined, selected === selection);
        // Keep the logical intent, original and current attempt until both the
        // positive server receipt and the authorized offline copy are durable.
        try {await cacheWrites;} catch {
          requireEpoch(expected);
          throw new RemoteError('OFFLINE_COPY_UNCONFIRMED', 'Il server ha confermato, ma la copia offline non è aggiornata. Il comando resta recuperabile.', 'unknown');
        }
        requireEpoch(expected);
        await recoveryQueue(entry.workspaceId, () => {
          const fresh = pending.get(entry.commandId);
          if (!fresh || attemptIdentity(fresh) !== identity) return fail('RECOVERY_CHANGED', 'Recupero cambiato. Rileggi prima di proseguire.');
          // Successor releases must be durable BEFORE deleting their receipt's
          // recoverable envelope. A crash can retry this exact attempt safely.
          let released = false;
          for (const successor of pending.values()) if (successor.edit?.predecessorId === entry.commandId) {successor.edit.predecessorId = null; released = true;}
          try {if (released) saveRecovery();} catch {
            throw new RemoteError('RECOVERY_CLEANUP_FAILURE', 'Salvato sul server. Verifica lo stesso tentativo per completare il recupero locale.', 'unknown');
          }
          const before = new Map(pending); pending.delete(entry.commandId);
          try {saveRecovery();} catch {
            pending = before; rememberRecovery();
            throw new RemoteError('RECOVERY_CLEANUP_FAILURE', 'Salvato sul server. Verifica lo stesso tentativo per completare il recupero locale.', 'unknown');
          }
          emit();
        });
        if ('command' in body) for (const listener of receiptListeners) {
          try {listener(clone(body), clone(result as WorkspaceReceipt));} catch { /* Observers cannot change an acknowledged transaction. */ }
        }
        return result;
      } catch (error) {
        if (epoch === expected) {
          invalidateDeniedLearningRead(body, error);
          try {await recoveryQueue(entry.workspaceId, () => {
            const fresh = pending.get(entry.commandId);
            if (!fresh || attemptIdentity(fresh) !== identity) return;
            fresh.error = issue(error); fresh.status = unsent && !dispatched ? 'blocked' : error instanceof RemoteError && error.outcome === 'unknown' ? 'uncertain'
              : ['REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(fresh.error.code) ? 'conflict' : 'rejected';
            saveRecovery();
          });} catch { /* Original bytes remain recoverable. A failed barrier never sends. */ }
          handleFailure(error, expected);
        }
        throw error;
      }
    });
    const operation = Promise.resolve().then(run)
      .finally(() => active.delete(key));
    active.set(key, operation); return operation;
  }
  async function mutate(input: PendingRequest): Promise<unknown> {
    const owner = account(), body = clone(parseRequest(input)), expected = epoch;
    const commandId = 'command' in body ? body.command.commandId : body.commandId, workspaceId = 'workspaceId' in body ? body.workspaceId : null;
    return coordinate(workspaceId, 'workspace', 'shared', async () => {
      const entry = await recoveryQueue(workspaceId, () => {
        requireEpoch(expected);
        if (body.action === 'import-local' && body.expectedAccountId !== owner.id) return fail('SESSION_CHANGED', 'Conferma l’account destinatario dell’importazione.');
        const existing = pending.get(commandId);
        if (existing) {
          if (canonicalJson(existing.request) !== canonicalJson(body) || existing.reconciliation) return fail('IDEMPOTENCY_CONFLICT', 'ID già usato per un altro comando o recupero.');
          if (existing.status === 'queued' || existing.status === 'blocked') return fail('EDIT_NOT_SENT', 'Riprendi esplicitamente la modifica non inviata.');
          return existing;
        }
        if (pending.size >= 500) return fail('RECOVERY_LIMIT', 'Recupera o esporta le modifiche in attesa prima di aggiungerne altre.');
        if ([...pending.values()].some(item => item.workspaceId === workspaceId)) return fail('PENDING_COMMAND', 'Recupera o scarta la modifica precedente prima di proseguire.');
        const entry: PendingCommand = {version: 1, accountId: owner.id, commandId, workspaceId,
          actorId: 'command' in body ? current().actor.actorId : null, request: body, createdAt: clock(), status: 'pending', error: null};
        pending.set(commandId, entry);
        try {saveRecovery();} catch (error) {pending.delete(commandId); rememberRecovery(); lastError = issue(error); emit(); throw error;}
        return entry;
      });
      return send(entry, true);
    });
  }
  async function edit(actor: Actor, documentId: string, input: EditCommand, base?: EducationalObject): Promise<void> {
    const owner = account(), workspace = current(), expected = epoch, selected = selection;
    const captured = clone({actor: ActorSchema.parse(actor), input, base, commandId: id()});
    const document = workspace.documents.find(item => item.id === documentId);
    if (!document) throw new CoreError('NOT_FOUND', 'Document unavailable.');
    return coordinate(workspace.workspaceId, 'workspace', 'shared', async () => {
      const {operation} = await recoveryQueue(workspace.workspaceId, () => {
        requireEpoch(expected);
        if (selection !== selected) return fail('WORKSPACE_CHANGED', 'Non inviata: spazio cambiato.');
        if (pending.size >= 500) return fail('RECOVERY_LIMIT', 'Recupera o esporta le modifiche in attesa prima di aggiungerne altre.');
        const sequence = [...pending.values()].filter(item => item.workspaceId === workspace.workspaceId);
        const predecessor = sequence.at(-1), previous = predecessor && scheduled.get(predecessor);
        const lastDocumentEdit = sequence.findLast(item => item.request.action === 'command' && item.request.command.documentId === documentId);
        const lastRequest = lastDocumentEdit && transmittedRequest(lastDocumentEdit);
        const expectedRevision = lastRequest?.action === 'command' ? lastRequest.command.expectedRevision + 1 : document.revision;
        const request = freeze(parseRequest({action: 'command', workspaceId: workspace.workspaceId,
          command: {...captured.input, commandId: captured.commandId, documentId, expectedRevision}}));
        if (pending.has(captured.commandId)) return fail('IDEMPOTENCY_CONFLICT', 'ID del comando già in attesa.');
        const automatic = !predecessor || !!previous && (predecessor.status === 'queued' || predecessor.status === 'pending');
        const entry: PendingCommand = {version: 2, accountId: owner.id, actorId: captured.actor.actorId,
          commandId: captured.commandId, workspaceId: workspace.workspaceId, request, createdAt: clock(),
          status: automatic ? 'queued' : 'blocked', error: null,
          edit: {actor: freeze(captured.actor), ...(captured.base ? {base: freeze(captured.base)} : {}), predecessorId: predecessor?.commandId ?? null}};
        pending.set(entry.commandId, entry);
        try {saveRecovery();} catch (error) {
          entry.status = 'blocked'; entry.error = issue(error); lastError = entry.error; rememberRecovery(); emit(); throw error;
        }
        emit();
        const blocked = () => fail('EDIT_BLOCKED', 'Non inviata. Risolvi la richiesta precedente, poi riprendi.');
        const operation = (previous ?? Promise.resolve()).then(async () => {
          requireEpoch(expected);
          if (!automatic) return blocked();
          if (selection !== selected || current().workspaceId !== entry.workspaceId) return fail('WORKSPACE_CHANGED', 'Non inviata: spazio cambiato.');
          await send(entry, true);
        }, blocked).catch(async error => {
          if (epoch === expected) await recoveryQueue(entry.workspaceId, () => {
            if (pending.get(entry.commandId) === entry && (entry.status === 'queued' || entry.status === 'blocked')) {
              entry.status = 'blocked'; entry.error = issue(error); lastError = entry.error;
              try {saveRecovery();} catch { /* Preserve bytes; never dispatch after a failed barrier. */ }
              emit();
            }
          }).catch(() => undefined);
          throw error;
        });
        scheduled.set(entry, operation);
        void operation.then(() => scheduled.delete(entry), () => scheduled.delete(entry));
        return {operation};
      });
      return operation;
    });
  }
  async function queueOfflineInkEdit(documentId: string, input: Extract<EditCommand, {kind: 'add-object' | 'remove-object'}>) {
    const source = offline, expected = epoch;
    if (!source) return fail('OFFLINE_UNAVAILABLE', 'Apri prima la copia offline.');
    const captured = clone(input);
    if (reconnecting === expected) return fail('OFFLINE_TRANSITION', 'Attendi la riconnessione prima di scrivere.');
    const operation = localInkWrites.catch(() => undefined).then(() => coordinate(source.workspaceId, 'workspace', 'shared', async () => {
      try {await checkLocalGate(source.account.id, true); requireEpoch(expected);} catch (error) {handleFailure(error, expected); throw error;}
      return recoveryQueue(source.workspaceId, () => {
      if (pending.size >= 500) return fail('RECOVERY_LIMIT', 'Esporta o riconcilia le modifiche prima di proseguire.');
      const document = source.documents.find(d => d.id === documentId);
      if (!document) return fail('OFFLINE_UNAVAILABLE', 'Puoi modificare i tratti nelle lezioni personali disponibili offline.');
      const sequence = [...pending.values()].filter(entry => entry.workspaceId === source.workspaceId);
      if (captured.kind === 'add-object' && captured.object.type !== 'ink') return fail('OFFLINE_UNAVAILABLE', 'Solo i tratti a penna sono modificabili offline.');
      if (captured.kind === 'remove-object') {
        let target: NewEducationalObject | undefined = document.objects.find(o => o.id === captured.objectId);
        for (const entry of sequence) if (entry.request.action === 'command' && entry.request.command.documentId === documentId) {
          const command = entry.request.command;
          if (command.kind === 'add-object' && command.object.id === captured.objectId) target = command.object;
          if (command.kind === 'remove-object' && command.objectId === captured.objectId) target = undefined;
        }
        if (target?.type !== 'ink') return fail('OFFLINE_UNAVAILABLE', 'La gomma cancella soltanto tratti ancora presenti.');
      }
      const predecessor = sequence.at(-1);
      const last = sequence.findLast(entry => entry.request.action === 'command' && entry.request.command.documentId === documentId);
      const lastRequest = last && transmittedRequest(last);
      const commandId = id(), expectedRevision = lastRequest?.action === 'command' ? lastRequest.command.expectedRevision + 1 : document.revision;
      const request = freeze(parseRequest({action: 'command', workspaceId: source.workspaceId,
        command: {...captured, commandId, documentId, expectedRevision}}));
      if (pending.has(commandId)) return fail('IDEMPOTENCY_CONFLICT', 'ID già presente nel recupero.');
      const entry: PendingCommand = {version: 2, accountId: source.account.id, actorId: source.actor.actorId, workspaceId: source.workspaceId,
        commandId, request, createdAt: clock(), status: 'blocked', error: {code: 'OFFLINE_QUEUED', message: 'Conservata sul dispositivo, non inviata.'},
        edit: {actor: freeze(clone(source.actor)), predecessorId: predecessor?.commandId ?? null}};
      pending.set(commandId, entry);
      try {saveRecovery(); lastError = null; emit();}
      catch (error) {entry.error = issue(error); lastError = entry.error; rememberRecovery(); emit(); throw error;}
      return {kind: 'queued' as const, commandId, recovery: state.recovery};
      });
    }));
    localInkWrites = operation; return operation;
  }
  async function read(body: Record<string, unknown>): Promise<unknown> {
    const expected = epoch, owner = account();
    try {const result = await request(body, owner.id); requireEpoch(expected); return result;}
    catch (error) {
      if (epoch === expected) invalidateDeniedLearningRead(body, error);
      if (epoch === expected && body.action === 'open-workspace'
        && error instanceof RemoteError && ['NOT_FOUND', 'FORBIDDEN'].includes(error.code)) {
        const gate = await cache?.gate().catch(() => null);
        if (epoch === expected && (body.workspaceId === projection?.workspaceId || body.workspaceId === gate?.workspaceId)) {
          void closeLocal().catch(() => undefined); offlineAvailable = false; offlineSavedAt = null;
          projection = null; selection++; loading = false;
        }
      }
      handleFailure(error, expected); throw error;
    }
  }
  function ownedDocument(actor: Actor, documentId: string): LessonDocument {
    requireActor(actor); const document = current().documents.find(document => document.id === documentId);
    if (!ownsWorkspace(current()) || !document) throw new CoreError('NOT_FOUND', 'Document unavailable.'); return document;
  }
  function assignedDocument(actor: Actor, documentId: string): LessonDocument {
    requireActor(actor); const document = current().assignedDocuments.find(document => document.id === documentId);
    if (actor.role !== 'student' || !document) throw new CoreError('NOT_FOUND', 'Assigned document unavailable.'); return document;
  }
  function learnerWork(actor: Actor, documentId: string, studentId?: string): LearnerWork | null {
    requireActor(actor); const target = actor.role === 'student' ? actor.actorId : studentId;
    if (!target || (actor.role === 'student' && studentId && studentId !== actor.actorId)
      || !current().assignments.some(assignment => assignment.documentId === documentId && assignment.studentId === target && assignment.status === 'active')) throw new CoreError('NOT_FOUND', 'Learner work unavailable.');
    const work = current().learnerWork.find(work => work.documentId === documentId && work.studentId === target) ?? null;
    if (actor.role === 'teacher' && !work?.evidenceShared) throw new CoreError('NOT_FOUND', 'Learner work unavailable.'); return work;
  }
  const core: CoreService = {
    executeTutor(actor, command) {requireActor(actor); return mutate({action: 'tutor-command', workspaceId: current().workspaceId, command}) as Promise<TutorReceipt>;},
    getTutorSpace(actor) {requireActor(actor); return clone(current().tutorSpace ?? {records: [], history: []});},
    executeCourse(actor, command) {requireActor(actor); return mutate({action: 'course-command', workspaceId: current().workspaceId, command}) as Promise<CourseReceipt>;},
    getCourseSpace(actor) {requireActor(actor); return clone(current().courseSpace ?? {courses: [], editions: [], deliveries: [], work: []});},
    async readCourseLesson(actor, editionId, unitId) {
      requireActor(actor);
      const source = current(), expected = epoch, chosen = selection;
      const allowed = () => current().courseSpace?.editions.find(value => value.edition.id === editionId)?.course.units.find(unit => unit.id === unitId)?.lesson;
      const ref = allowed(); if (!ref) throw new CoreError('NOT_FOUND', 'Exact course material unavailable.');
      const raw = await read({action: 'read-course-lesson', workspaceId: source.workspaceId, editionId, unitId});
      requireEpoch(expected);
      if (selection !== chosen || !allowed()) return fail('WORKSPACE_CHANGED', 'Il percorso non è più disponibile.');
      const result = LessonDocumentSchema.safeParse(raw);
      if (!result.success || result.data.id !== ref.documentId || result.data.revision !== ref.revision) return invalid();
      return clone(result.data);
    },
    execute(actor, command) {requireActor(actor); return mutate({action: 'command', workspaceId: current().workspaceId, command}) as Promise<CommandReceipt>;},
    executePlugin(actor, command) {requireActor(actor); return mutate({action: 'plugin-command', workspaceId: current().workspaceId, command}) as Promise<PluginReceipt>;},
    executeLearning(actor, command) {requireActor(actor); return mutate({action: 'learning-command', workspaceId: current().workspaceId, command}) as Promise<LearningReceipt>;},
    listDocuments(actor) {requireActor(actor); return clone(current().documents);},
    getDocument: (actor, documentId) => clone(ownedDocument(actor, documentId)),
    listInstallations(actor) {requireActor(actor); return clone(current().installations);},
    getInstallation(actor, pluginId) {requireActor(actor); return clone(current().installations.find(item => item.pluginId === pluginId) ?? null);},
    listAssignments(actor) {requireActor(actor); return clone(current().assignments);},
    getAssignedDocument: (actor, documentId) => clone(assignedDocument(actor, documentId)),
    getAssignedLabAccess(actor, documentId, objectId) {assignedDocument(actor, documentId); const access = current().labAccess.find(item => item.documentId === documentId && item.objectId === objectId);
      if (!access) throw new CoreError('NOT_FOUND', 'Lab authorization unavailable.'); return clone(access);},
    getLearnerWork: (actor, documentId, studentId) => clone(learnerWork(actor, documentId, studentId)),
    async readAttemptSource(actor, documentId, attemptId, studentId) {
      const expected = epoch, chosen = selection, source = current();
      const work = learnerWork(actor, documentId, studentId);
      const attempt = work?.attempts.find(entry => entry.id === attemptId);
      if (!attempt) throw new CoreError('NOT_FOUND', 'Attempt unavailable.');
      const raw = await read({action: 'read-attempt-source', workspaceId: source.workspaceId, documentId, attemptId,
        ...(studentId ? {studentId} : {})});
      requireEpoch(expected);
      if (selection !== chosen) return fail('WORKSPACE_CHANGED', 'Lo spazio è cambiato.');
      learnerWork(actor, documentId, studentId); // A newer projection may have revoked access during this read.
      const result = EducationalObjectSchema.safeParse(raw);
      if (!result.success || result.data.id !== attempt.objectId || result.data.revision !== attempt.sourceObjectRevision) return invalid();
      return clone(result.data);
    },
    learningEvents(actor, documentId, studentId) {learnerWork(actor, documentId, studentId); const target = actor.role === 'student' ? actor.actorId : studentId;
      return clone(current().learningEvents.filter(event => event.lessonId === documentId && event.studentId === target));},
    events(actor, documentId) {ownedDocument(actor, documentId); return clone(current().events.filter(event => event.documentId === documentId));},
    getObjectRevision(actor, documentId, objectId, revision) {
      const document = ownedDocument(actor, documentId);
      const found = document.objects.find(object => object.id === objectId && object.revision === revision); if (found) return clone(found);
      for (const event of current().events.filter(event => event.documentId === documentId)) {
        if (!record(event.payload)) continue;
        const candidates: unknown[] = [event.payload.object, event.payload.previous];
        if (event.type === 'plugin-release-changed' && Array.isArray(event.payload.objects)) {
          for (const change of event.payload.objects) if (record(change)) candidates.push(change.object, change.previous);
        }
        for (const candidate of candidates) {const result = EducationalObjectSchema.safeParse(candidate);
          if (result.success && result.data.id === objectId && result.data.revision === revision) return clone(result.data);}
      }
      throw new CoreError('NOT_FOUND', 'Exact object revision unavailable.');
    },
    snapshot() {return fail('REMOTE_EXPORT_REQUIRED', 'Usa l’esportazione personale del server.');},
  };
  async function openWorkspace(workspaceId: string): Promise<WorkspaceProjection> {
    const expected = epoch, chosen = ++selection; loading = true; if (!recoveryBlocked) lastError = null; emit();
    try {const result = await read({action: 'open-workspace', workspaceId}); requireEpoch(expected);
      if (chosen !== selection) return fail('WORKSPACE_CHANGED', 'Altro spazio aperto.');
      if (cache) {const gate = await cache.gate(); requireEpoch(expected);
        if (chosen !== selection) return fail('WORKSPACE_CHANGED', 'Altro spazio aperto.');
        offlineAvailable = gate.workspaceId === workspaceId;}
      if (chosen !== selection) return fail('WORKSPACE_CHANGED', 'Altro spazio aperto.');
      return accept(result, expected, workspaceId, true);
    } catch (error) {handleFailure(error, expected); throw error;
    } finally {if (epoch === expected && chosen === selection) {loading = false; emit();}}
  }
  async function openOffline(): Promise<OfflineSnapshot> {
    if (!cache) return fail('OFFLINE_UNAVAILABLE', 'Nessuna copia offline disponibile.');
    if (!session && !offline && !['NETWORK_ERROR', 'REQUEST_TIMEOUT'].includes(lastError?.code ?? '')) {
      return fail('OFFLINE_UNAVAILABLE', 'L’accesso offline richiede una copia preparata online e un’interruzione di rete.');
    }
    const expected = epoch, chosen = selection;
    const found = await readyOfflineCopy(expected, chosen);
    requireEpoch(expected);
    if (selection !== chosen) return fail('WORKSPACE_CHANGED', 'Altro spazio aperto.');
    if (!found || session && (found.snapshot.account.id !== session.account.id || found.snapshot.account.role !== session.account.role)) return fail('OFFLINE_UNAVAILABLE', 'Nessuna lezione personale disponibile offline.');
    invalidate(); offline = found.snapshot; localGeneration = found.gate.generation;
    offlineAvailable = true; offlineSavedAt = offline.savedAt; lastError = null; loadRecovery(); emit(); return clone(offline);
  }
  function inkRecoveryContext() {
    const owner = account(), source = current(), expected = epoch, chosen = selection;
    if (!storage?.coordinate || memoryRecovery.has(owner.id)) return fail('RECOVERY_UNAVAILABLE', 'Recupero sul dispositivo non disponibile. Esporta i tratti prima di chiudere.');
    return {owner, source, expected, chosen};
  }
  async function inkProposal({owner, source, expected, chosen}: ReturnType<typeof inkRecoveryContext>) {
    const fresh = await read({action: 'open-workspace', workspaceId: source.workspaceId}); requireEpoch(expected);
    if (chosen !== selection) return fail('WORKSPACE_CHANGED', 'Lo spazio è cambiato.');
    accept(fresh, expected, source.workspaceId);
    return recoveryQueue(source.workspaceId, async () => {
      const {inkRecoveryPreview} = await import('./ink-reconciliation');
      const preview = await inkRecoveryPreview(owner, current(), [...pending.values()]);
      emit(); return preview;
    });
  }
  async function prepareInkRecovery() {
    const context = inkRecoveryContext();
    return coordinate(context.source.workspaceId, 'workspace', 'exclusive', () => inkProposal(context));
  }
  async function confirmInkRecovery(token: string): Promise<void> {
    const context = inkRecoveryContext(), {source, expected, chosen} = context;
    return coordinate(source.workspaceId, 'workspace', 'exclusive', async () => {
      const preview = await inkProposal(context);
      if (preview.token !== token) return fail('RECOVERY_PREVIEW_STALE', 'La lezione o i tratti sono cambiati. Apri una nuova anteprima prima di confermare.');
      for (const approved of preview.entries) {
        requireEpoch(expected);
        if (chosen !== selection) return fail('WORKSPACE_CHANGED', 'Lo spazio è cambiato. Il resto rimane da recuperare.');
        const entry = await recoveryQueue(source.workspaceId, () => {
          const entry = pending.get(approved.recoveryId);
          if (!entry || !entry.edit || entry.edit.predecessorId) return fail('RECOVERY_CHANGED', 'Recupero cambiato. Rileggi prima di proseguire.');
          const commandId = id();
          if (!isId(commandId) || [...pending.values()].some(value => value.commandId === commandId || value.reconciliation?.attempts.some(attempt => attempt.commandId === commandId))) return fail('IDEMPOTENCY_CONFLICT', 'Identità del tentativo già utilizzata.');
          entry.reconciliation = {...(entry.reconciliation ?? {recoveryId: entry.commandId, originalOutcome: entry.status === 'blocked' ? 'not-sent' as const : 'revision-conflict' as const}),
            attempts: [...(entry.reconciliation?.attempts ?? []), {commandId, expectedRevision: approved.expectedRevision, createdAt: clock()}]};
          entry.version = 3; entry.status = 'blocked'; entry.error = null;
          // One atomic row contains both the original and the effective attempt.
          // No HTTP occurs unless this envelope was durably written.
          try {saveRecovery();} catch (error) {entry.error = issue(error); lastError = entry.error; rememberRecovery(); emit(); throw error;}
          emit(); return entry;
        });
        await send(entry, true);
      }
      lastError = null; emit();
    });
  }
  cache?.subscribe?.(() => {
    const expected = epoch, generation = localGeneration;
    if (!generation || !recoveryAccount()) return;
    void cache!.gate().then(gate => {
      if (epoch === expected && (gate.generation !== generation || gate.signedOut)) {
        lastError = {code: 'SESSION_CHANGED', message: 'Spazio chiuso o account cambiato in un’altra scheda.'}; invalidate();
      }
    }).catch(error => {if (epoch === expected) {lastError = issue(error); invalidate();}});
  });
  emit();
  return {
    core,
    subscribeReceipts(listener: (request: PendingRequest, receipt: WorkspaceReceipt) => void) {receiptListeners.add(listener); return () => {receiptListeners.delete(listener);};},
    materials() {
      const owner = account(), source = current(), expected = epoch, chosen = selection;
      const authorize = async () => {
        requireEpoch(expected);
        if (selection !== chosen) return fail('WORKSPACE_CHANGED', 'Lo spazio è cambiato.');
        if (cache) await checkLocalGate(owner.id);
        requireEpoch(expected);
        if (selection !== chosen) return fail('WORKSPACE_CHANGED', 'Lo spazio è cambiato.');
      };
      const api = materialAccess(source.workspaceId, async input => {await authorize(); const value = await read(input); await authorize(); return value;}, authorize);
      const save = async (state: import('@ardesia/contracts').MaterialState,blob:Blob) => {
        if(ownsWorkspace(source)&&cache?.putMaterial&&localGeneration&&offlineAvailable){await cache.putMaterial(localGeneration,owner.id,source.workspaceId,state,blob);await authorize();}
      };
      return {...api,
        async loadDraft(documentId:string){await authorize();const value=await cache?.loadMaterialDraft?.(localGeneration!,owner.id,source.workspaceId,documentId);await authorize();return value??null;},
        async saveDraft(draft:import('./materials').MaterialDraft){await authorize();if(!cache?.saveMaterialDraft||!localGeneration)return fail('OFFLINE_UNAVAILABLE','Archivio di recupero non disponibile. Nessun upload avviato.');await cache.saveMaterialDraft(localGeneration,owner.id,source.workspaceId,draft);await authorize();},
        async clearDraft(documentId:string,assetId:string){await authorize();await cache?.clearMaterialDraft?.(localGeneration!,owner.id,source.workspaceId,documentId,assetId);await authorize();},
        async upload(...args:Parameters<MaterialAccess['upload']>){const state=await api.upload(...args);await save(state,args[1]);return state;},
        async download(...args:Parameters<MaterialAccess['download']>){const blob=await api.download(...args);await save(await api.read(args[0],args[2]),blob);return blob;}};
    },
    recordings() {
      const owner = account(), source = current(), expected = epoch, chosen = selection;
      if (!ownsWorkspace(source)) return fail('FORBIDDEN', 'Le registrazioni personali richiedono il tuo spazio.');
      return recordingAccess(owner.id, source.workspaceId, async input => {
        requireEpoch(expected);
        if (selection !== chosen) return fail('WORKSPACE_CHANGED', 'Lo spazio è cambiato.');
        const value = await read(input); requireEpoch(expected);
        if (selection !== chosen) return fail('WORKSPACE_CHANGED', 'Lo spazio è cambiato.');
        return value;
      }, async () => {
        requireEpoch(expected);
        if (selection !== chosen) return fail('WORKSPACE_CHANGED', 'Lo spazio è cambiato.');
        if (cache) await checkLocalGate(owner.id);
        requireEpoch(expected);
        if (selection !== chosen) return fail('WORKSPACE_CHANGED', 'Lo spazio è cambiato.');
      });
    },
    edit,
    prepareInkRecovery,
    confirmInkRecovery,
    offlineMaterials(): MaterialAccess {
      const copy=offline,expected=epoch,generation=localGeneration;
      if(!copy||!generation||!cache?.getMaterial)return fail('OFFLINE_UNAVAILABLE','Materiali non disponibili in questa copia.');
      const get=async(assetId:string)=>{
        requireEpoch(expected);const value=await cache!.getMaterial!(generation,copy.account.id,copy.workspaceId,assetId);requireEpoch(expected);
        if(!value||!copy.documents.some(d=>d.id===value.state.manifest.documentId&&d.objects.some(o=>o.type==='material'&&o.data.assetId===assetId&&o.data.sha256===value.state.manifest.sha256)))return fail('OFFLINE_UNAVAILABLE','Originale non conservato offline. Ricollegati e prepara la copia.');
        return value;
      };
      return {read:async id=>(await get(id)).state,download:async(id,digest)=>{const value=await get(id);if(value.state.manifest.sha256!==digest)return fail('INVALID_OFFLINE_COPY','Identità del materiale non coerente.');return value.blob;},upload:async()=>fail('OFFLINE_UNAVAILABLE','L’importazione richiede la connessione.')};
    },
    get offline(): OfflineSnapshot | null {return clone(offline);},
    async makeAvailableOffline(): Promise<void> {
      const owner = account(), source = current(), expected = epoch, chosen = selection;
      if (!ownsWorkspace(source) || !cache || !localGeneration) return fail('OFFLINE_UNAVAILABLE', 'La copia offline delle lezioni personali non è disponibile.');
      updateOfflineCopy(source, true);
      const found = await readyOfflineCopy(expected, chosen);
      requireEpoch(expected);
      if (selection !== chosen) return fail('WORKSPACE_CHANGED', 'Altro spazio aperto.');
      if (!found || found.snapshot.workspaceId !== source.workspaceId) return fail('OFFLINE_UNAVAILABLE', 'Copia offline non disponibile.');
      offlineAvailable = true; offlineSavedAt = found.snapshot.savedAt; emit();
    },
    openOffline,
    async reconnect(): Promise<void> {
      if (!offline) return fail('OFFLINE_UNAVAILABLE', 'Nessuna copia offline aperta.');
      const previous = clone(offline), expected = epoch;
      if (reconnecting === expected) return fail('OFFLINE_TRANSITION', 'Riconnessione già in corso.');
      reconnecting = expected;
      try {
        // Finish captured local strokes before changing the identity context.
        // Memory-only recovery remains exportable if its durable write failed.
        await localInkWrites.catch(() => undefined); requireEpoch(expected);
        await authenticate({action: 'session'}, false);
        requireEpoch(expected);
        const next = await openWorkspace(previous.workspaceId);
        requireEpoch(expected);
        if (next.actor.actorId !== previous.actor.actorId || next.actor.role !== previous.actor.role || session?.account.id !== previous.account.id) {
          await closeLocal(); requireEpoch(expected); invalidate(); return fail('SESSION_CHANGED', 'Il collegamento originale dello spazio è cambiato.');
        }
      } catch (error) {
        if (epoch !== expected) throw error;
        if (['NETWORK_ERROR', 'REQUEST_TIMEOUT'].includes(issue(error).code)) await openOffline();
        else {await closeLocal().catch(() => undefined); if (epoch === expected) invalidate();}
        throw error;
      } finally {if (reconnecting === expected) reconnecting = null;}
    },
    queueOfflineInk(documentId: string, object: Extract<NewEducationalObject, {type: 'ink'}>) {
      return queueOfflineInkEdit(documentId, {kind: 'add-object', object});
    },
    queueOfflineEraseInk(documentId: string, objectId: string) {
      return queueOfflineInkEdit(documentId, {kind: 'remove-object', objectId});
    },
    inkRecovery(documentId: string): InkDraftAccess {
      const owner = recoveryAccount(), source = offline ?? projection, expected = epoch;
      if (!owner || !source || !source.documents.some(d => d.id === documentId)
        || !offline && !ownsWorkspace(source)) return fail('OFFLINE_UNAVAILABLE', 'Recupero penna disponibile nelle tue lezioni personali.');
      const scope = {accountId: owner.id, workspaceId: source.workspaceId, documentId};
      const authorize = () => {
        requireEpoch(expected);
        const active = offline ?? projection;
        if (recoveryAccount()?.id !== owner.id || active?.workspaceId !== scope.workspaceId || !active.documents.some(d => d.id === documentId)) return fail('SESSION_CHANGED', 'Lo spazio della bozza è cambiato.');
        if (!inkDraftStorage) return fail('RECOVERY_STORAGE_FAILURE', 'Il browser non può conservare il tratto in corso. Termina il tratto ed esporta prima di chiudere.');
        return active.documents.find(d => d.id === documentId)!;
      };
      const retained = (draft: InkDraft) => {
          const document = authorize();
            const same = (object: NewEducationalObject) => object.id === draft.object.id && object.type === 'ink'
              && ['x', 'y', 'width', 'height', 'title', 'data'].every(key => canonicalJson(object[key as keyof typeof object]) === canonicalJson(draft.object[key as keyof typeof draft.object]));
            // Clear a checkpoint only after exact confirmed data or durable immutable recovery exists.
            return document.objects.some(same) || state.recovery === 'durable' && [...pending.values()].some(entry => entry.workspaceId === scope.workspaceId && entry.request.action === 'command'
              && entry.request.command.documentId === documentId && entry.request.command.kind === 'add-object' && same(entry.request.command.object));
      };
      return {
        read() {authorize(); return inkDraftStorage!.read(scope).filter(draft => !retained(draft));},
        recover(objectId, apply) {authorize(); return inkDraftStorage!.recover(scope, objectId, async draft => {
          if (retained(draft)) return true;
          const confirmed = await apply(draft); authorize(); return confirmed || retained(draft);
        });},
        release(objectId) {
          try {
            authorize();const draft=inkDraftStorage!.read(scope,objectId)[0];
            // Transfer is complete even after a lost HTTP response if the exact
            // immutable pending command is durable. Remove before unlocking so
            // a stale second tab cannot create another command for this ID.
            if(draft&&retained(draft))inkDraftStorage!.remove(scope,objectId);
          } catch { /* Revocation/corruption preserves bytes; releasing needs no authority. */ }
          finally {inkDraftStorage?.release(scope,objectId);}
        },
        write(draft) {authorize(); inkDraftStorage!.write(scope, draft);},
        remove(objectId) {authorize(); inkDraftStorage!.remove(scope, objectId);},
        exportRaw() {authorize(); return inkDraftStorage!.exportRaw(scope);},
      };
    },
    get state(): RemoteState {return state;},
    get account(): RemoteAccount | null {return clone(session?.account ?? null);},
    get projection(): WorkspaceProjection | null {return clone(projection);},
    getVersion: () => version,
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
    session: () => authenticate({action: 'session'}, false),
    login: (username: string, password: string) => authenticate({action: 'login', username, password}, true),
    logout(): Promise<void> {
      const previousAccount = recoveryAccount()?.id; const closed = closeLocal(); lastError = null; invalidate(); const expected = epoch;
      const operation = authQueue.then(async () => {
        try {
          let localFailure = false;
          try {await closed;} catch {localFailure = true;}
          // A preceding login can have set its cookie after the UI invalidated that
          // request. Resolve that session before logout rather than racing cookies.
          let target = previousAccount;
          if (!target) {
            try {target = parseSession(await request({action: 'session'})).account.id;}
            catch (error) {if (error instanceof RemoteError && error.code === 'UNAUTHENTICATED') return; throw error;}
          }
          await request({action: 'logout'}, target);
          if (localFailure) return fail('LOCAL_LOGOUT_UNCONFIRMED', 'Sessione online chiusa, ma la chiusura della copia su questo dispositivo non è stata salvata.');
        }
        catch (error) {if (epoch === expected) {lastError = issue(error).code === 'LOCAL_LOGOUT_UNCONFIRMED' ? issue(error) : {code: 'LOGOUT_UNCONFIRMED', message: 'Spazio chiuso. Revoca della sessione non confermata dal server.'}; emit();} throw error;}
      }); authQueue = operation.catch(() => undefined); return operation;
    },
    async listWorkspaces(): Promise<WorkspaceSummary[]> {
      const result = await read({action: 'list-workspaces'});
      if (!Array.isArray(result) || result.some(item => !record(item) || !isId(item.workspaceId) || typeof item.title !== 'string' || !isRevision(item.workspaceRevision)
        || item.access !== undefined && !WorkspaceAccessSchema.safeParse(item.access).success)) return invalid();
      return clone(result as WorkspaceSummary[]);
    },
    createWorkspace: (title: string, commandId = id()) => mutate({action: 'create-workspace', title, commandId}) as Promise<WorkspaceProjection>,
    openWorkspace,
    async refresh(): Promise<WorkspaceProjection> {
      const expected = epoch, chosen = selection, workspaceId = current().workspaceId;
      try {const result = await read({action: 'open-workspace', workspaceId});
        if (chosen !== selection) return fail('WORKSPACE_CHANGED', 'Lo spazio è cambiato: rileggi le evidenze autorizzate.');
        const refreshed = accept(result, expected, workspaceId); if (!recoveryBlocked) lastError = null; emit(); return refreshed;
      } catch (error) {handleFailure(error, expected); throw error;}
    },
    async retryPending(commandId?: string): Promise<unknown> {
      account(); const entry = commandId ? pending.get(commandId) : [...pending.values()].find(item => item.workspaceId === (projection?.workspaceId ?? null));
      if (!entry) return fail('NOT_FOUND', 'Nessun comando da recuperare nello spazio.');
      if (entry.status === 'queued' || entry.status === 'blocked') return fail('EDIT_NOT_SENT', 'Riprendi esplicitamente la modifica non inviata.');
      return send(entry);
    },
    async resumePending(commandId: string): Promise<void> {
      account(); const entry = pending.get(commandId);
      if (!entry || entry.version === 1 || entry.status !== 'blocked') return fail('EDIT_NOT_BLOCKED', 'Nessuna modifica non inviata da riprendere.');
      if (scheduled.has(entry)) return fail('REQUEST_IN_FLIGHT', 'Attendi l’arresto della sequenza.');
      await send(entry);
    },
    async discardPending(commandId: string) {
      account(); const previous = pending.get(commandId); if (!previous) return;
      if ([...active.keys()].some(key => key.startsWith(previous.accountId + ':' + previous.commandId + '/')) || scheduled.has(previous)) return fail('REQUEST_IN_FLIGHT', 'Attendi l’esito del tentativo in corso.');
      const identity = attemptIdentity(previous);
      await coordinate(previous.workspaceId, 'workspace', 'shared', () => coordinate(previous.workspaceId, 'intent:' + commandId, 'exclusive', () => recoveryQueue(previous.workspaceId, () => {
        const current = pending.get(commandId);
        if (!current || attemptIdentity(current) !== identity) return fail('RECOVERY_CHANGED', 'Recupero cambiato. Rileggi prima di proseguire.');
        const entries = new Map(pending);
        pending.delete(commandId); try {saveRecovery();} catch (error) {pending = entries; rememberRecovery(); emit(); throw error;}
        lastError = null; emit();
      })));
    },
    exportPendingRecovery(): string | null {const owner = recoveryAccount(); if (!owner) return fail('UNAUTHENTICATED', 'Apri il tuo spazio.'); return memoryRecovery.get(owner.id) ?? storage?.read(owner.id, false) ?? null;},
    discardInvalidRecovery() {
      const owner = account(); if (!recoveryBlocked) return;
      if (storage) storage.remove(owner.id); memoryRecovery.delete(owner.id);
      recoveryBlocked = false; pending.clear(); lastError = null; emit();
    },
    importLocal(input: Omit<ImportRequest, 'action'>) {return mutate({action: 'import-local', ...input}) as Promise<WorkspaceProjection>;},
    async exportPersonal(): Promise<PersonalExport> {
      const owner = account(), workspaceId = current().workspaceId, chosen = selection;
      const result = await read({action: 'export-personal', workspaceId});
      if (chosen !== selection) return fail('WORKSPACE_CHANGED', 'Lo spazio è cambiato: rileggi le evidenze autorizzate.');
      if (!record(result) || result.format !== 'ardesia-personal-v1' || result.accountId !== owner.id || result.workspaceId !== workspaceId
        || typeof result.exportedAt !== 'string' || !Number.isFinite(Date.parse(result.exportedAt))) return invalid();
      const exported = parseProjection(result.projection, owner);
      if (exported.workspaceRevision < current().workspaceRevision) return fail('REVISION_CONFLICT', 'Le evidenze sono cambiate durante l’esportazione. Esporta di nuovo i dati autorizzati.');
      return {format: 'ardesia-personal-v1', accountId: owner.id, workspaceId, exportedAt: result.exportedAt, projection: exported};
    },
  };
}
export type RemoteClient = ReturnType<typeof createRemoteClient>;
