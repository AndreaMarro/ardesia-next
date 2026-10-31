import {
  ActorSchema, AssignedLabAccessSchema, canonicalJson, CommandReceiptSchema, CoreCommandSchema, CoreError,
  CoreEventSchema, EducationalObjectSchema, LearnerWorkSchema, LearningCommandSchema,
  LearningEventSchema, LearningReceiptSchema, LessonAssignmentSchema, LessonDocumentSchema,
  PluginCommandSchema, PluginInstallationSchema, PluginReceiptSchema,
  type Actor, type AssignedLabAccess, type CommandReceipt, type CoreCommand, type CoreEvent,
  type EducationalObject, type LearnerWork, type LearningCommand, type LearningEvent, type LearningReceipt,
  type LessonAssignment, type LessonDocument, type PluginCommand, type PluginInstallation,
  type PluginReceipt,
} from '@ardesia/contracts';
import type {CoreService} from '@ardesia/core';

export interface RemoteAccount {id: string; role: Actor['role']; displayName: string}
export interface RemoteSession {account: RemoteAccount; expiresAt: string}
export interface WorkspaceSummary {workspaceId: string; title: string; workspaceRevision: number}
export interface WorkspaceProjection {
  workspaceId: string; title: string; workspaceRevision: number; actor: Actor;
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
  | {action: 'learning-command'; workspaceId: string; command: LearningCommand};
type CreateRequest = {action: 'create-workspace'; title: string; commandId: string};
type ImportRequest = {action: 'import-local'; title: string; commandId: string; expectedAccountId: string; snapshotText: string};
export type PendingRequest = CommandRequest | CreateRequest | ImportRequest;
export type EditCommand = CoreCommand extends infer C ? C extends CoreCommand ? Omit<C, 'commandId' | 'documentId' | 'expectedRevision'> : never : never;
export interface EditIntent {
  actor: Actor; base?: EducationalObject; predecessorId: string | null;
}
export interface RemoteIssue {code: string; message: string}
export interface PendingCommand {
  version: 1 | 2; accountId: string; commandId: string; workspaceId: string | null;
  actorId: string | null;
  request: PendingRequest; createdAt: string;
  status: 'queued' | 'blocked' | 'pending' | 'uncertain' | 'conflict' | 'rejected'; error: RemoteIssue | null;
  edit?: EditIntent;
}
export interface PendingStorage {
  read(accountId: string, capture?: boolean): string | null;
  write(accountId: string, value: string): void;
  remove(accountId: string): void;
  /** Remember a validated, normalized read without changing durable bytes. */
  baseline?(accountId: string, value: string): void;
}
export interface RemoteState {
  status: 'signed-out' | 'loading' | 'confirmed' | 'pending' | 'uncertain' | 'conflict' | 'error';
  account: RemoteAccount | null; workspaceId: string | null; workspaceRevision: number | null;
  pending: readonly PendingCommand[]; error: RemoteIssue | null;
  recovery: 'durable' | 'memory' | 'invalid';
}
export interface RemoteClientOptions {
  fetch?: typeof globalThis.fetch; endpoint?: string; timeoutMs?: number;
  pendingStorage?: PendingStorage; clock?: () => string; id?: () => string;
}
export class RemoteError extends Error {
  constructor(readonly code: string, message: string, readonly outcome: 'rejected' | 'unknown' = 'rejected', readonly status = 0) {
    super(message); this.name = 'RemoteError';
  }
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(value);
const isRevision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const fail = (code: string, message: string): never => {throw new RemoteError(code, message);};
const invalid = (): never => {throw new RemoteError('INVALID_RESPONSE', 'Risposta del server non valida.', 'unknown');};
const issue = (error: unknown): RemoteIssue => error instanceof RemoteError || error instanceof CoreError
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
      documents: array(value.documents, LessonDocumentSchema), assignedDocuments: array(value.assignedDocuments, LessonDocumentSchema),
      installations: array(value.installations, PluginInstallationSchema), events: array(value.events, CoreEventSchema),
      assignments: array(value.assignments, LessonAssignmentSchema), learnerWork: array(value.learnerWork, LearnerWorkSchema),
      learningEvents: array(value.learningEvents, LearningEventSchema), labAccess: array(value.labAccess, AssignedLabAccessSchema),
    };
    // A teacher's imported workspace may retain its historical Core actor. Only the
    // authenticated server may resolve that binding; students always use their account ID.
    if (projection.actor.role !== account.role || (account.role === 'student' && projection.actor.actorId !== account.id)) return invalid();
    const coreActorId = projection.actor.actorId;
    const owned = new Set(projection.documents.map(document => document.id));
    const assigned = new Set(projection.assignments.filter(assignment => assignment.status === 'active' && assignment.studentId === account.id).map(assignment => assignment.documentId));
    if (projection.documents.some(document => document.ownerId !== coreActorId)
      || projection.installations.some(installation => installation.ownerId !== coreActorId)
      || projection.events.some(event => !owned.has(event.documentId))) return invalid();
    if (account.role === 'student') {
      if (projection.documents.length || projection.installations.length || projection.events.length
        || projection.assignments.some(assignment => assignment.studentId !== account.id || assignment.status !== 'active')
        || projection.assignedDocuments.some(document => !assigned.has(document.id))
        || projection.learnerWork.some(work => work.studentId !== account.id || !assigned.has(work.documentId))
        || projection.labAccess.some(access => !assigned.has(access.documentId))) return invalid();
    } else if (projection.assignedDocuments.length || projection.labAccess.length
      || projection.assignments.some(assignment => !owned.has(assignment.documentId))
      || projection.learnerWork.some(work => !owned.has(work.documentId) || !work.evidenceShared
        || !projection.assignments.some(assignment => assignment.documentId === work.documentId && assignment.studentId === work.studentId && assignment.status === 'active'))) return invalid();
    if (projection.learningEvents.some(event => !projection.learnerWork.some(work => work.documentId === event.lessonId && work.studentId === event.studentId))) return invalid();
    return projection;
  } catch (error) {if (error instanceof RemoteError) throw error; return invalid();}
}
function parseRequest(value: unknown): PendingRequest {
  if (!record(value)) return fail('INVALID_RECOVERY', 'Recupero non valido. I dati originali sono conservati.');
  if (['command', 'plugin-command', 'learning-command'].includes(String(value.action)) && isId(value.workspaceId)) {
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
export function browserPendingStorage(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>, prefix = 'ardesia-next.pending.v1.'): PendingStorage {
  const key = (accountId: string) => prefix + encodeURIComponent(accountId);
  const snapshots = new Map<string, Map<string, string>>(), observed = new Map<string, Map<string, string>>();
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
      || canonicalJson(prior.request) !== canonicalJson(next.request)) corruptRecovery();
  }
  function write(id: string, raw: string) {
    const accountKey = key(id), next = entries(raw), previous = snapshots.get(id) ?? new Map<string, string>();
    const old = entries(storage.getItem(accountKey) ?? '[]');
    // Each command has its own atomic localStorage value. Never rewrite the
    // legacy array, a shared index, or an ID created by another open tab.
    for (const [commandId, value] of next) if (previous.get(commandId) !== value) {
      const path = accountKey + '/' + encodeURIComponent(commandId);
      unchanged(old.get(commandId), value); unchanged(storage.getItem(path), value);
      storage.setItem(path, value);
    }
    for (const commandId of previous.keys()) if (!next.has(commandId)) {
      const path = accountKey + '/' + encodeURIComponent(commandId);
      if (old.has(commandId)) storage.setItem(path, 'null'); else storage.removeItem(path);
    }
    snapshots.set(id, next);
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
        return values.size ? '[' + [...values.values()].join(',') + ']' : null;
      } catch {
        // Keep every original byte exportable, including corrupt individual rows.
        return rows.size === 1 && original !== null ? original : JSON.stringify({recovery: [...rows]});
      }
    },
    write,
    baseline(id, raw) {snapshots.set(id, entries(raw));},
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
  if (!storage && typeof window !== 'undefined') {
    // Access may be denied by the browser. Keep explicit in-memory recovery in that case.
    try {storage = browserPendingStorage(window.localStorage);} catch { /* Transport remains usable. */ }
  }
  let session: RemoteSession | null = null, projection: WorkspaceProjection | null = null;
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
    const status: RemoteState['status'] = !session ? 'signed-out' : loading ? 'loading'
      : entries.some(item => item.status === 'uncertain') ? 'uncertain'
      : entries.some(item => item.status === 'conflict') ? 'conflict'
      : entries.some(item => item.status === 'pending' || item.status === 'queued') ? 'pending'
      : entries.length || lastError ? 'error' : 'confirmed';
    state = freeze(clone({status, account: session?.account ?? null, workspaceId: projection?.workspaceId ?? null,
      workspaceRevision: projection?.workspaceRevision ?? null, pending: entries, error: lastError,
      recovery: recoveryBlocked ? 'invalid' : !storage || session && memoryRecovery.has(session.account.id) ? 'memory' : 'durable'}));
    version++; for (const listener of listeners) listener();
  }
  function invalidate() {
    if (session && !recoveryBlocked) {
      let changed = false;
      for (const entry of pending.values()) if (entry.status === 'queued') {
        changed = true;
        entry.status = 'blocked'; entry.error = {code: 'SESSION_CHANGED', message: 'Non inviata: sessione cambiata. Riprendi esplicitamente.'};
      }
      if (changed) try {saveRecovery();} catch { /* Existing durable bytes remain recoverable and never auto-resume. */ }
    }
    epoch++; selection++; session = null; projection = null; pending = new Map(); loading = false; recoveryBlocked = false; emit();
  }
  function account(): RemoteAccount {if (!session) return fail('UNAUTHENTICATED', 'Accedi per aprire lo spazio.'); return session.account;}
  function current(): WorkspaceProjection {account(); if (!projection) return fail('WORKSPACE_REQUIRED', 'Apri uno spazio.'); return projection;}
  function requireActor(actor: Actor) {
    const known = account();
    const bound = current().actor;
    if (actor.actorId !== bound.actorId || actor.role !== bound.role || actor.role !== known.role) throw new CoreError('INVALID_ACTOR', 'Identità non valida per questo spazio.');
  }
  function requireEpoch(expected: number) {if (epoch !== expected) return fail('SESSION_CHANGED', 'Sessione cambiata: risposta precedente ignorata.');}
  function rememberRecovery() {if (session) memoryRecovery.set(session.account.id, JSON.stringify([...pending.values()]));}
  function saveRecovery() {
    if (!session) return;
    try {
      const values = [...pending.values()], accountId = session.account.id;
      if (storage) {
        if (values.length) storage.write(accountId, JSON.stringify(values)); else storage.remove(accountId);
        memoryRecovery.delete(accountId);
      }
      else if (values.length) memoryRecovery.set(accountId, JSON.stringify(values)); else memoryRecovery.delete(accountId);
    }
    catch {rememberRecovery(); throw new RemoteError('RECOVERY_STORAGE_FAILURE', 'Copia di recupero in memoria. Esportala prima di chiudere. Nessun nuovo invio.');}
  }
  function loadRecovery() {
    if (!session) return;
    try {
      const raw = memoryRecovery.get(session.account.id) ?? storage?.read(session.account.id) ?? null; if (raw === null) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length > 500) corruptRecovery();
      const restored = new Map<string, PendingCommand>();
      for (const item of parsed) {
        if (!record(item) || (item.version !== 1 && item.version !== 2) || item.accountId !== session.account.id || !isId(item.commandId)
          || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) || restored.has(item.commandId)) corruptRecovery();
        const request = parseRequest(item.request);
        const commandId = 'command' in request ? request.command.commandId : request.commandId;
        const workspaceId = 'workspaceId' in request ? request.workspaceId : null;
        if (commandId !== item.commandId || workspaceId !== item.workspaceId
          || ('command' in request ? !isId(item.actorId) : item.actorId !== null)
          || (request.action === 'import-local' && request.expectedAccountId !== session.account.id)) corruptRecovery();
        let edit: EditIntent | undefined;
        if (item.version === 2) {
          if (request.action !== 'command' || !record(item.edit)
            || (item.edit.predecessorId !== null && (!isId(item.edit.predecessorId) || item.edit.predecessorId === commandId))
            || !['queued', 'blocked', 'pending', 'uncertain', 'conflict', 'rejected'].includes(String(item.status))) corruptRecovery();
          const actor = ActorSchema.parse(item.edit.actor);
          if (actor.actorId !== item.actorId) corruptRecovery();
          edit = {actor, predecessorId: item.edit.predecessorId as string | null,
            ...(item.edit.base === undefined ? {} : {base: EducationalObjectSchema.parse(item.edit.base)})};
        }
        const unsent = item.version === 2 && (item.status === 'queued' || item.status === 'blocked');
        restored.set(commandId, {version: item.version, accountId: session.account.id, commandId, workspaceId, actorId: item.actorId as string | null, request,
          createdAt: item.createdAt, ...(edit ? {edit} : {}), status: unsent ? 'blocked' : 'uncertain', error: unsent
            ? {code: 'RECOVERED_EDIT', message: 'Non inviata. Risolvi la richiesta precedente, poi riprendi.'}
            : {code: 'RECOVERED_REQUEST', message: 'Verifica l’esito con lo stesso comando.'}});
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
      if (!memoryRecovery.has(session.account.id)) storage?.baseline?.(session.account.id, JSON.stringify([...ordered.values()]));
      pending = ordered;
    } catch {recoveryBlocked = true; lastError = {code: 'INVALID_RECOVERY', message: 'Recupero non valido. I dati originali sono conservati.'};}
  }
  async function request(body: Record<string, unknown>, expectedAccount?: string): Promise<unknown> {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(endpoint, {method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        headers: {'Content-Type': 'application/json', Accept: 'application/json', ...(expectedAccount ? {'X-Ardesia-Account': expectedAccount} : {})},
        body: JSON.stringify(body), signal: controller.signal});
      const text = await response.text(); if (text.length > 8 * 1024 * 1024) return invalid();
      let value: unknown; try {value = JSON.parse(text);} catch {return invalid();}
      if (!record(value) || typeof value.ok !== 'boolean') return invalid();
      if (value.ok === false) {
        if (!record(value.error) || typeof value.error.code !== 'string' || typeof value.error.message !== 'string') return invalid();
        throw new RemoteError(value.error.code, value.error.message, 'rejected', response.status);
      }
      if (!response.ok || !Object.hasOwn(value, 'result')) return invalid();
      return value.result;
    } catch (error) {
      if (error instanceof RemoteError) throw error;
      throw new RemoteError(controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR', 'Operazione non confermata dal server. Recuperala senza duplicarla.', 'unknown');
    } finally {clearTimeout(timer);}
  }
  function handleFailure(error: unknown, expected: number) {
    if (epoch !== expected) return;
    lastError = issue(error);
    if (['UNAUTHENTICATED', 'SESSION_CHANGED'].includes(lastError.code)) invalidate(); else emit();
  }
  function accept(value: unknown, expected: number, workspaceId?: string, select = false): WorkspaceProjection {
    requireEpoch(expected);
    const next = parseProjection(value, account());
    if (workspaceId && next.workspaceId !== workspaceId) return invalid();
    if (projection?.workspaceId === next.workspaceId && (projection.actor.actorId !== next.actor.actorId || projection.actor.role !== next.actor.role)) return invalid();
    if (projection?.workspaceId === next.workspaceId && next.workspaceRevision < projection.workspaceRevision) return clone(projection);
    if (select || projection?.workspaceId === next.workspaceId) {projection = next; emit();}
    return clone(next);
  }
  function authenticate(body: Record<string, unknown>, reset: boolean): Promise<RemoteSession> {
    if (reset) {lastError = null; invalidate();}
    const expected = epoch, known = session?.account.id;
    loading = true; emit();
    const operation = authQueue.then(async () => {
      requireEpoch(expected);
      try {
        const value = parseSession(await request(body, reset ? undefined : known)); requireEpoch(expected);
        if (session && (session.account.id !== value.account.id || session.account.role !== value.account.role)) {invalidate(); return fail('SESSION_CHANGED', 'Sessione cambiata. Accedi di nuovo.');}
        const first = !session; session = value; lastError = null;
        if (first) loadRecovery(); return clone(value);
      } catch (error) {handleFailure(error, expected); throw error;}
      finally {if (epoch === expected) {loading = false; emit();}}
    });
    authQueue = operation.catch(() => undefined); return operation;
  }
  async function send(entry: PendingCommand): Promise<unknown> {
    const key = entry.accountId + ':' + entry.commandId, running = active.get(key); if (running) return running;
    const expected = epoch, selected = selection;
    const unsent = entry.version === 2 && (entry.status === 'queued' || entry.status === 'blocked');
    const operation = Promise.resolve().then(async () => {
      let dispatched = false;
      try {
        requireEpoch(expected); if (account().id !== entry.accountId) return fail('SESSION_CHANGED', 'Comando di un altro account.');
        if (pending.get(entry.commandId) !== entry) return fail('EDIT_BLOCKED', 'Modifica non più in attesa.');
        if (unsent) {
          if (selected !== selection || loading || current().workspaceId !== entry.workspaceId) return fail('WORKSPACE_CHANGED', 'Non inviata: spazio cambiato.');
          if (!entry.edit || entry.request.action !== 'command') return fail('INVALID_RECOVERY', 'Intento non valido.');
          requireActor(entry.edit.actor);
          if (entry.edit.predecessorId) return fail('EDIT_BLOCKED', 'Non inviata: manca la conferma della modifica precedente.');
          const document = ownedDocument(entry.edit.actor, entry.request.command.documentId);
          if (entry.edit.base && canonicalJson(entry.edit.base) !== canonicalJson(document.objects.find(object => object.id === entry.edit!.base!.id))) {
            throw new CoreError('REVISION_CONFLICT', 'Il contenuto salvato è cambiato. La bozza resta intatta: ripristina per aggiornarla.');
          }
          if (document.revision !== entry.request.command.expectedRevision) return fail('REVISION_CONFLICT', 'Non inviata: revisione cambiata. Bozza conservata.');
        }
        entry.status = 'pending'; entry.error = null; saveRecovery(); lastError = null; emit();
        requireEpoch(expected);
        if (unsent && selected !== selection) return fail('WORKSPACE_CHANGED', 'Non inviata: spazio cambiato.');
        dispatched = true;
        const raw = await request(entry.request, entry.accountId); requireEpoch(expected);
        let result: unknown;
        if ('command' in entry.request) {
          if (!record(raw)) return invalid();
          try {
            result = entry.request.action === 'command' ? CommandReceiptSchema.parse(raw.receipt)
              : entry.request.action === 'plugin-command' ? PluginReceiptSchema.parse(raw.receipt) : LearningReceiptSchema.parse(raw.receipt);
          } catch {return invalid();}
          const receipt = result as CommandReceipt | PluginReceipt | LearningReceipt;
          if (receipt.commandId !== entry.commandId || receipt.actorId !== entry.actorId) return invalid();
          if (entry.request.action === 'command' && (!('documentId' in receipt) || receipt.documentId !== entry.request.command.documentId
            || receipt.documentRevision !== entry.request.command.expectedRevision + 1)) return invalid();
          const next = parseProjection(raw.projection, account());
          if (next.actor.actorId !== entry.actorId) return invalid();
          accept(next, expected, entry.request.workspaceId);
        } else result = accept(raw, expected, undefined, selected === selection);
        // Only a positive receipt releases a dependency. A discarded, rejected or
        // uncertain predecessor never authorizes an automatic successor.
        for (const successor of pending.values()) if (successor.edit?.predecessorId === entry.commandId) successor.edit.predecessorId = null;
        pending.delete(entry.commandId);
        try {saveRecovery();} catch {lastError = {code: 'RECOVERY_CLEANUP_FAILURE', message: 'Salvataggio confermato. Copia locale del comando non rimossa.'};}
        emit(); return result;
      } catch (error) {
        if (epoch === expected) {
          entry.error = issue(error); entry.status = unsent && !dispatched ? 'blocked' : error instanceof RemoteError && error.outcome === 'unknown' ? 'uncertain'
            : ['REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT'].includes(entry.error.code) ? 'conflict' : 'rejected';
          try {saveRecovery();} catch { /* Preserve the already stored immutable pending request. */ }
          handleFailure(error, expected);
        }
        throw error;
      } finally {active.delete(key);}
    });
    active.set(key, operation); return operation;
  }
  function mutate(input: PendingRequest): Promise<unknown> {
    const owner = account(); if (recoveryBlocked) return Promise.reject(new RemoteError('INVALID_RECOVERY', 'Conserva una copia, poi rimuovi il recupero non valido.'));
    const body = clone(parseRequest(input));
    const commandId = 'command' in body ? body.command.commandId : body.commandId, workspaceId = 'workspaceId' in body ? body.workspaceId : null;
    if (body.action === 'import-local' && body.expectedAccountId !== owner.id) return Promise.reject(new RemoteError('SESSION_CHANGED', 'Conferma l’account destinatario dell’importazione.'));
    const existing = pending.get(commandId);
    if (existing) {
      if (JSON.stringify(existing.request) !== JSON.stringify(body)) return Promise.reject(new RemoteError('IDEMPOTENCY_CONFLICT', 'ID già usato per un altro comando.'));
      if (existing.status === 'queued' || existing.status === 'blocked') return Promise.reject(new RemoteError('EDIT_NOT_SENT', 'Riprendi esplicitamente la modifica non inviata.'));
      return send(existing);
    }
    if ([...pending.values()].some(item => item.workspaceId === workspaceId)) return Promise.reject(new RemoteError('PENDING_COMMAND', 'Recupera o scarta la modifica precedente prima di proseguire.'));
    const entry: PendingCommand = {version: 1, accountId: owner.id, commandId, workspaceId,
      actorId: 'command' in body ? current().actor.actorId : null, request: body, createdAt: clock(), status: 'pending', error: null};
    pending.set(commandId, entry);
    try {saveRecovery();} catch (error) {pending.delete(commandId); rememberRecovery(); lastError = issue(error); emit(); return Promise.reject(error);}
    return send(entry);
  }
  async function edit(actor: Actor, documentId: string, input: EditCommand, base?: EducationalObject): Promise<void> {
    const owner = account(), workspace = current(), expected = epoch, selected = selection;
    if (recoveryBlocked) return fail('INVALID_RECOVERY', 'Conserva una copia, poi rimuovi il recupero non valido.');
    if (pending.size >= 500) return fail('RECOVERY_LIMIT', 'Recupera o esporta le modifiche in attesa prima di aggiungerne altre.');
    // Capture the identity, payload, draft and ID before any asynchronous boundary.
    const captured = clone({actor: ActorSchema.parse(actor), input, base, commandId: id()});
    const document = workspace.documents.find(item => item.id === documentId);
    if (!document) throw new CoreError('NOT_FOUND', 'Document unavailable.');
    const sequence = [...pending.values()].filter(item => item.workspaceId === workspace.workspaceId);
    const predecessor = sequence.at(-1), previous = predecessor && scheduled.get(predecessor);
    const lastDocumentEdit = sequence.findLast(item => item.request.action === 'command' && item.request.command.documentId === documentId);
    // Reserve the successor's CAS revision from this sequence, never from a
    // later refresh. Dispatch still requires its predecessor's positive receipt.
    const expectedRevision = lastDocumentEdit?.request.action === 'command'
      ? lastDocumentEdit.request.command.expectedRevision + 1 : document.revision;
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
      // A storage failure must not remove the unsent intent or its barrier. The
      // existing memory fallback also survives account changes in this client.
      entry.status = 'blocked'; entry.error = issue(error); lastError = entry.error; rememberRecovery(); emit(); throw error;
    }
    emit();
    const blocked = () => fail('EDIT_BLOCKED', 'Non inviata. Risolvi la richiesta precedente, poi riprendi.');
    const operation = (previous ?? Promise.resolve()).then(async () => {
      requireEpoch(expected);
      if (!automatic) return blocked();
      if (selection !== selected || current().workspaceId !== entry.workspaceId) return fail('WORKSPACE_CHANGED', 'Non inviata: spazio cambiato.');
      await send(entry);
    }, blocked).catch(error => {
      if (epoch === expected && pending.get(entry.commandId) === entry && (entry.status === 'queued' || entry.status === 'blocked')) {
        entry.status = 'blocked'; entry.error = issue(error); lastError = entry.error;
        try {saveRecovery();} catch { /* Original unsent bytes are retained; never dispatch after a failed barrier. */ }
        emit();
      }
      throw error;
    });
    scheduled.set(entry, operation);
    void operation.then(() => scheduled.delete(entry), () => scheduled.delete(entry));
    return operation;
  }
  async function read(body: Record<string, unknown>): Promise<unknown> {
    const expected = epoch, owner = account();
    try {const result = await request(body, owner.id); requireEpoch(expected); return result;}
    catch (error) {
      if (epoch === expected && body.action === 'open-workspace' && body.workspaceId === projection?.workspaceId
        && error instanceof RemoteError && ['NOT_FOUND', 'FORBIDDEN'].includes(error.code)) {
        projection = null; selection++; loading = false;
      }
      handleFailure(error, expected); throw error;
    }
  }
  function ownedDocument(actor: Actor, documentId: string): LessonDocument {
    requireActor(actor); const document = current().documents.find(document => document.id === documentId);
    if (actor.role !== 'teacher' || !document) throw new CoreError('NOT_FOUND', 'Document unavailable.'); return document;
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
  emit();
  return {
    core,
    edit,
    get state(): RemoteState {return state;},
    get account(): RemoteAccount | null {return clone(session?.account ?? null);},
    get projection(): WorkspaceProjection | null {return clone(projection);},
    getVersion: () => version,
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
    session: () => authenticate({action: 'session'}, false),
    login: (username: string, password: string) => authenticate({action: 'login', username, password}, true),
    logout(): Promise<void> {
      const previousAccount = session?.account.id; lastError = null; invalidate(); const expected = epoch;
      const operation = authQueue.then(async () => {
        try {
          // A preceding login can have set its cookie after the UI invalidated that
          // request. Resolve that session before logout rather than racing cookies.
          let target = previousAccount;
          if (!target) {
            try {target = parseSession(await request({action: 'session'})).account.id;}
            catch (error) {if (error instanceof RemoteError && error.code === 'UNAUTHENTICATED') return; throw error;}
          }
          await request({action: 'logout'}, target);
        }
        catch (error) {if (epoch === expected) {lastError = {code: 'LOGOUT_UNCONFIRMED', message: 'Spazio chiuso. Revoca della sessione non confermata dal server.'}; emit();} throw error;}
      }); authQueue = operation.catch(() => undefined); return operation;
    },
    async listWorkspaces(): Promise<WorkspaceSummary[]> {
      const result = await read({action: 'list-workspaces'});
      if (!Array.isArray(result) || result.some(item => !record(item) || !isId(item.workspaceId) || typeof item.title !== 'string' || !isRevision(item.workspaceRevision))) return invalid();
      return clone(result as WorkspaceSummary[]);
    },
    createWorkspace: (title: string, commandId = id()) => mutate({action: 'create-workspace', title, commandId}) as Promise<WorkspaceProjection>,
    async openWorkspace(workspaceId: string): Promise<WorkspaceProjection> {
      const expected = epoch, chosen = ++selection; loading = true; if (!recoveryBlocked) lastError = null; emit();
      try {const result = await read({action: 'open-workspace', workspaceId}); requireEpoch(expected);
        if (chosen !== selection) return fail('WORKSPACE_CHANGED', 'Altro spazio aperto.');
        return accept(result, expected, workspaceId, true);
      } catch (error) {handleFailure(error, expected); throw error;
      } finally {if (epoch === expected && chosen === selection) {loading = false; emit();}}
    },
    async refresh(): Promise<WorkspaceProjection> {
      const expected = epoch, workspaceId = current().workspaceId;
      try {const result = await read({action: 'open-workspace', workspaceId});
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
      if (!entry || entry.version !== 2 || entry.status !== 'blocked') return fail('EDIT_NOT_BLOCKED', 'Nessuna modifica non inviata da riprendere.');
      if (scheduled.has(entry)) return fail('REQUEST_IN_FLIGHT', 'Attendi l’arresto della sequenza.');
      await send(entry);
    },
    discardPending(commandId: string) {
      account(); const previous = pending.get(commandId); if (!previous) return;
      if (active.has(previous.accountId + ':' + previous.commandId) || scheduled.has(previous)) return fail('REQUEST_IN_FLIGHT', 'Attendi l’esito del tentativo in corso.');
      const entries = new Map(pending);
      pending.delete(commandId); try {saveRecovery();} catch (error) {pending = entries; rememberRecovery(); emit(); throw error;}
      lastError = null; emit();
    },
    exportPendingRecovery(): string | null {const owner = account(); return memoryRecovery.get(owner.id) ?? storage?.read(owner.id, false) ?? null;},
    discardInvalidRecovery() {
      const owner = account(); if (!recoveryBlocked) return;
      if (storage) storage.remove(owner.id); memoryRecovery.delete(owner.id);
      recoveryBlocked = false; pending.clear(); lastError = null; emit();
    },
    importLocal(input: Omit<ImportRequest, 'action'>) {return mutate({action: 'import-local', ...input}) as Promise<WorkspaceProjection>;},
    async exportPersonal(): Promise<PersonalExport> {
      const owner = account(), workspaceId = current().workspaceId;
      const result = await read({action: 'export-personal', workspaceId});
      if (!record(result) || result.format !== 'ardesia-personal-v1' || result.accountId !== owner.id || result.workspaceId !== workspaceId
        || typeof result.exportedAt !== 'string' || !Number.isFinite(Date.parse(result.exportedAt))) return invalid();
      return {format: 'ardesia-personal-v1', accountId: owner.id, workspaceId, exportedAt: result.exportedAt, projection: parseProjection(result.projection, owner)};
    },
  };
}
export type RemoteClient = ReturnType<typeof createRemoteClient>;
