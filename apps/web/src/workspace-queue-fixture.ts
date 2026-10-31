// Test transport only. All document changes, CAS, receipts and events are produced by the real Core.
import {createCore, MemoryStorage, type CoreService} from '@ardesia/core';
import {CoreError, type Actor, type CoreCommand, type CommandReceipt} from '@ardesia/contracts';
import {createRemoteClient, type PendingStorage, type RemoteAccount, type WorkspaceProjection} from '@ardesia/remote-client';
import type {EditCommand} from './workspace';

export const teacher: Actor = {actorId: 'teacher-a', role: 'teacher'};
export const account: RemoteAccount = {id: teacher.actorId, role: teacher.role, displayName: 'Docente sintetico'};
export const lesson = 'lesson-queue';
export const workspace = 'workspace-a';
const at = '2026-10-31T12:00:00.000Z';

export function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {release = resolve;});
  return {promise, release};
}

export function ink(id: string): EditCommand {
  return {kind: 'add-object', object: {id, type: 'ink', title: id, x: 0, y: 0, width: 100, height: 100,
    data: {points: [{x: 10, y: 20, pressure: 0.5}], color: '#151515', width: 2}}};
}

export interface SentCommand {
  body: {action: 'command'; workspaceId: string; command: CoreCommand};
  accountId: string | null;
}
export interface TransportHooks {
  beforeCommand?: (call: SentCommand, index: number) => void | Promise<void>;
  afterCommit?: (call: SentCommand, receipt: CommandReceipt, index: number) => void | Promise<void>;
}

export async function fixture(hooks: TransportHooks = {}) {
  const values = new Map<string, string>();
  const storage: PendingStorage = {
    read: id => values.get(id) ?? null,
    write: (id, value) => {values.set(id, value);},
    remove: id => {values.delete(id);},
  };
  const spaces = new Map<string, {core: CoreService; owner: RemoteAccount}>();
  let activeAccount: RemoteAccount | null = account;
  async function addWorkspace(id: string, owner = account) {
    const core = await createCore({storage: new MemoryStorage()});
    await core.execute({actorId: owner.id, role: owner.role}, {kind: 'create-document', commandId: 'setup', documentId: lesson,
      expectedRevision: 0, title: 'Coda sintetica'});
    spaces.set(id, {core, owner}); return core;
  }
  const server = await addWorkspace(workspace);
  const sent: SentCommand[] = [], receipts: CommandReceipt[] = [];
  function projection(workspaceId = workspace): WorkspaceProjection {
    const found = spaces.get(workspaceId); if (!found) throw Error('Unknown fixture workspace.');
    const actor = {actorId: found.owner.id, role: found.owner.role};
    const snapshot = found.core.snapshot();
    const documents = found.core.listDocuments(actor);
    return {workspaceId, title: 'Spazio sintetico', workspaceRevision: snapshot.events.length,
      actor, documents, events: documents.flatMap(document => found.core.events(actor, document.id)),
      installations: [], assignments: [], learnerWork: [], learningEvents: [], assignedDocuments: [], labAccess: []};
  }
  const json = (result: unknown) => new Response(JSON.stringify({ok: true, result}), {status: 200});
  const failure = (code: string, status = 409) => new Response(JSON.stringify({ok: false, error: {code, message: 'Rifiuto sintetico ' + code}}), {status});
  const fetcher: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    if (body.action === 'login' || body.action === 'session') return activeAccount
      ? json({account: activeAccount, expiresAt: '2026-11-01T12:00:00.000Z'}) : failure('UNAUTHENTICATED', 401);
    if (body.action === 'logout') return json(null);
    if (!activeAccount) return failure('UNAUTHENTICATED', 401);
    const expected = new Headers(init?.headers).get('X-Ardesia-Account');
    if (expected !== activeAccount.id) return failure('SESSION_CHANGED', 401);
    const space = spaces.get(String(body.workspaceId));
    if (!space || space.owner.id !== activeAccount.id) return failure('NOT_FOUND', 404);
    if (body.action === 'open-workspace') return json(projection(String(body.workspaceId)));
    if (body.action !== 'command') throw Error('Unsupported synthetic route: ' + String(body.action));
    const call: SentCommand = {body: structuredClone(body) as SentCommand['body'], accountId: expected};
    const index = sent.push(call);
    await hooks.beforeCommand?.(call, index);
    let receipt: CommandReceipt;
    try {receipt = await space.core.execute({actorId: space.owner.id, role: space.owner.role}, call.body.command);}
    catch (error) {if (error instanceof CoreError) return failure(error.code); throw error;}
    receipts.push(structuredClone(receipt));
    // A thrown network error here occurs after a real atomic Core commit.
    await hooks.afterCommit?.(call, receipt, index);
    return json({receipt, projection: projection(call.body.workspaceId)});
  };
  async function open(selected = workspace, pendingStorage: PendingStorage = storage) {
    const client = createRemoteClient({fetch: fetcher, pendingStorage, clock: () => at});
    await client.login('synthetic', 'synthetic-password'); await client.openWorkspace(selected); return client;
  }
  const client = await open();
  async function external(id = 'external', core = server) {
    return core.execute(teacher, {...ink(id), commandId: id, documentId: lesson,
      expectedRevision: core.getDocument(teacher, lesson).revision} as CoreCommand);
  }
  return {client, server, sent, receipts, storage, values, hooks, open, projection, external, addWorkspace,
    setAccount(next: RemoteAccount | null) {activeAccount = next;}};
}
