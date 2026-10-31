import {describe, expect, it} from 'vitest';
import {createRemoteClient, browserPendingStorage, type PendingStorage, type RemoteAccount, type WorkspaceProjection} from './index';
import type {CoreCommand} from '@ardesia/contracts';

const at = '2026-10-29T14:00:00.000Z';
const teacher: RemoteAccount = {id: 'teacher-a', role: 'teacher', displayName: 'Docente sintetico'};
const studentA: RemoteAccount = {id: 'student-a', role: 'student', displayName: 'Studente A'};
const studentB: RemoteAccount = {id: 'student-b', role: 'student', displayName: 'Studente B'};
const actor = {actorId: teacher.id, role: teacher.role};
const json = (result: unknown, status = 200) => new Response(JSON.stringify({ok: true, result}), {status});
const error = (code: string, status = 409) => new Response(JSON.stringify({ok: false, error: {code, message: 'Operazione rifiutata.'}}), {status});
const session = (account: RemoteAccount) => ({account, expiresAt: '2026-10-30T14:00:00.000Z'});
const projection = (workspaceRevision = 1, account = teacher, workspaceId = 'workspace-a'): WorkspaceProjection => ({
  workspaceId, title: 'Spazio sintetico', workspaceRevision, actor: {actorId: account.id, role: account.role},
  documents: account.role === 'teacher' ? [{id: 'lesson-1', ownerId: account.id, title: 'Lezione', revision: workspaceRevision,
    status: 'draft', createdAt: at, updatedAt: at, objects: [], connections: []}] : [],
  assignedDocuments: [], installations: [], events: [], assignments: [], learnerWork: [], learningEvents: [], labAccess: [],
});
const rename = (commandId = 'command-1'): Extract<CoreCommand, {kind: 'rename-document'}> => ({kind: 'rename-document', commandId, documentId: 'lesson-1', expectedRevision: 1, title: 'Nuovo titolo'});
const mutation = (command: CoreCommand, next: WorkspaceProjection) => ({projection: next, receipt: {
  commandId: command.commandId, actorId: next.actor.actorId, fingerprint: 'a'.repeat(64), documentId: command.documentId,
  documentRevision: next.workspaceRevision, eventId: 'event-' + command.commandId,
}});
function deferred<T>() {let resolve!: (value: T) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};}
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function memoryStorage() {
  const values = new Map<string, string>();
  const storage: PendingStorage = {read: id => values.get(id) ?? null, write: (id, value) => {values.set(id, value);}, remove: id => {values.delete(id);}};
  return {storage, values};
}
function fetchFor(handler: (body: Record<string, unknown>, init: RequestInit) => Response | Promise<Response>): typeof fetch {
  return async (_input, init) => handler(JSON.parse(String(init?.body)) as Record<string, unknown>, init!);
}
async function open(fetcher: typeof fetch, pendingStorage?: PendingStorage) {
  const client = createRemoteClient({fetch: fetcher, pendingStorage, clock: () => at});
  await client.login('synthetic-teacher', 'synthetic-password'); await client.openWorkspace('workspace-a'); return client;
}

describe('remote Core facade and account-scoped recovery', () => {
  it('accepts the contract’s 200-character identifier boundary and rejects a longer account ID', async () => {
    const longAccount = {...teacher, id: 'a'.repeat(200)}, workspaceId = 'w'.repeat(200);
    const client = createRemoteClient({fetch: fetchFor(body => body.action === 'login'
      ? json(session(longAccount)) : json(projection(1, longAccount, workspaceId)))});
    await client.login('synthetic', 'synthetic');
    await client.openWorkspace(workspaceId);
    expect(client.account?.id).toBe(longAccount.id);
    expect(client.projection?.workspaceId).toBe(workspaceId);
    const invalid = createRemoteClient({fetch: fetchFor(() => json(session({...longAccount, id: 'a'.repeat(201)})))});
    await expect(invalid.login('synthetic', 'synthetic')).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
    expect(invalid.account).toBeNull();
  });

  it('reads only server-confirmed data, sends no actor, and refuses a caller-selected identity or global export', async () => {
    const calls: {body: Record<string, unknown>; init: RequestInit}[] = [];
    const wait = deferred<Response>();
    const client = await open(fetchFor((body, init) => {
      calls.push({body, init});
      if (body.action === 'login') return json(session(teacher));
      if (body.action === 'open-workspace') return json(projection());
      return wait.promise;
    }));
    expect(() => client.core.getDocument({...actor, actorId: studentA.id}, 'lesson-1')).toThrow();
    expect(() => client.core.snapshot()).toThrow(/esportazione personale/);
    const before = client.core.getDocument(actor, 'lesson-1'); before.title = 'Caller mutation';
    expect(client.core.getDocument(actor, 'lesson-1').title).toBe('Lezione');
    const command = rename(); const saving = client.core.execute(actor, command); await tick();
    expect(client.state.status).toBe('pending');
    expect(client.core.getDocument(actor, 'lesson-1').revision).toBe(1);
    const sent = calls.at(-1)!;
    expect(sent.body).toEqual({action: 'command', workspaceId: 'workspace-a', command});
    expect(new Headers(sent.init.headers).get('X-Ardesia-Account')).toBe(teacher.id);
    expect(sent.init.credentials).toBe('same-origin');
    wait.resolve(json(mutation(command, projection(2)))); await saving;
    expect(client.core.getDocument(actor, 'lesson-1').revision).toBe(2);
    expect(client.state.status).toBe('confirmed');
  });

  it('recovers a committed command after a lost response with the exact original ID and immutable payload', async () => {
    const {storage, values} = memoryStorage(); const sends: unknown[] = []; let attempt = 0;
    const client = await open(fetchFor(body => {
      if (body.action === 'login') return json(session(teacher));
      if (body.action === 'open-workspace') return json(projection());
      sends.push(body); if (++attempt === 1) throw new TypeError('Lost response after commit');
      return json(mutation(body.command as CoreCommand, projection(2)));
    }), storage);
    const command = rename(); const saving = client.core.execute(actor, command); command.title = 'Changed by caller after send';
    await expect(saving).rejects.toMatchObject({code: 'NETWORK_ERROR'});
    expect(client.state.status).toBe('uncertain');
    expect(client.core.getDocument(actor, 'lesson-1').revision).toBe(1);
    expect(values.get(teacher.id)).toContain('Nuovo titolo');
    expect(values.get(teacher.id)).not.toContain('Changed by caller');
    await expect(client.core.execute(actor, rename('another-command'))).rejects.toMatchObject({code: 'PENDING_COMMAND'});
    await client.retryPending('command-1');
    expect(sends).toHaveLength(2); expect(sends[1]).toEqual(sends[0]);
    expect(client.state.status).toBe('confirmed'); expect(values.has(teacher.id)).toBe(false);
  });

  it('does not replace a newer confirmed projection with a late older read', async () => {
    const reads = [deferred<Response>(), deferred<Response>()]; let count = 0;
    const client = await open(fetchFor(body => {
      if (body.action === 'login') return json(session(teacher));
      if (++count === 1) return json(projection());
      return reads[count - 2]!.promise;
    }));
    const old = client.refresh(), recent = client.refresh();
    reads[1]!.resolve(json(projection(3))); await recent;
    reads[0]!.resolve(json(projection(2))); await old;
    expect(client.projection?.workspaceRevision).toBe(3);
    expect(client.core.getDocument(actor, 'lesson-1').revision).toBe(3);
  });

  it('ignores a command response after logout and does not expose recovered A commands to B', async () => {
    const {storage, values} = memoryStorage(), wait = deferred<Response>(); let account = teacher;
    const client = await open(fetchFor(body => {
      if (body.action === 'login') return json(session(account));
      if (body.action === 'logout') return json(null);
      if (body.action === 'open-workspace') return json(projection(1, account));
      return wait.promise;
    }), storage);
    const command = rename(), saving = client.core.execute(actor, command); await tick();
    await client.logout(); expect(client.account).toBeNull(); expect(client.projection).toBeNull();
    account = studentB; await client.login('synthetic-student-b', 'synthetic-password');
    expect(client.state.pending).toEqual([]); expect(client.exportPendingRecovery()).toBeNull();
    wait.resolve(json(mutation(command, projection(2))));
    await expect(saving).rejects.toMatchObject({code: 'SESSION_CHANGED'});
    expect(client.account?.id).toBe(studentB.id); expect(client.projection).toBeNull();
    expect(values.has(teacher.id)).toBe(true);
    account = teacher; await client.login('synthetic-teacher', 'synthetic-password');
    expect(client.state.pending).toHaveLength(1);
    expect(client.state.pending[0]?.request).toEqual({action: 'command', workspaceId: 'workspace-a', command});
  });

  it('restores pending state in a new client without writing it into the confirmed projection or auto-retrying', async () => {
    const {storage} = memoryStorage(); let commandCount = 0;
    const fetcher = fetchFor(body => {
      if (body.action === 'login') return json(session(teacher));
      if (body.action === 'open-workspace') return json(projection());
      commandCount++; throw new TypeError('Disconnected');
    });
    const original = await open(fetcher, storage);
    await expect(original.core.execute(actor, rename())).rejects.toMatchObject({code: 'NETWORK_ERROR'});
    const reopened = await open(fetcher, storage);
    expect(commandCount).toBe(1); expect(reopened.state.status).toBe('uncertain');
    expect(reopened.core.getDocument(actor, 'lesson-1').revision).toBe(1);
    expect(reopened.state.pending[0]?.commandId).toBe('command-1');
  });

  it('keeps a rejected revision conflict recoverable without inventing a new expected revision', async () => {
    const requests: unknown[] = [];
    const client = await open(fetchFor(body => {
      if (body.action === 'login') return json(session(teacher));
      if (body.action === 'open-workspace') return json(projection());
      requests.push(body); return error('REVISION_CONFLICT');
    }));
    await expect(client.core.execute(actor, rename())).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    expect(client.state.status).toBe('conflict');
    await expect(client.retryPending()).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    expect(requests[0]).toEqual(requests[1]);
    expect(client.state.pending[0]?.request).toMatchObject({command: {expectedRevision: 1}});
    client.discardPending('command-1'); expect(client.state.pending).toEqual([]);
  });

  it('rejects an actor mismatch in a server projection and clears data on session expiration', async () => {
    let mode = 'normal';
    const client = await open(fetchFor(body => {
      if (body.action === 'login') return json(session(teacher));
      if (mode === 'wrong-account') return json(projection(2, studentB));
      if (mode === 'expired') return error('UNAUTHENTICATED', 401);
      return json(projection());
    }));
    mode = 'wrong-account'; await expect(client.refresh()).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
    expect(client.projection?.actor).toEqual(actor); expect(client.state.status).toBe('error');
    mode = 'expired'; await expect(client.refresh()).rejects.toMatchObject({code: 'UNAUTHENTICATED'});
    expect(client.account).toBeNull(); expect(client.projection).toBeNull(); expect(client.state.status).toBe('signed-out');
  });

  it('refuses a projection containing another teacher’s documents or private student work', async () => {
    const unsafe = projection(); unsafe.documents[0]!.ownerId = 'teacher-other';
    const client = createRemoteClient({fetch: fetchFor(body => body.action === 'login' ? json(session(teacher)) : json(unsafe))});
    await client.login('synthetic', 'synthetic');
    await expect(client.openWorkspace('workspace-a')).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
    expect(client.projection).toBeNull();
    const second = projection(1, studentA); second.learnerWork.push({documentId: 'lesson-1', studentId: studentB.id, revision: 1,
      notes: 'Private B', labs: [], attempts: [], consents: [], evidenceShared: false, createdAt: at, updatedAt: at});
    const studentClient = createRemoteClient({fetch: fetchFor(body => body.action === 'login' ? json(session(studentA)) : json(second))});
    await studentClient.login('synthetic', 'synthetic');
    await expect(studentClient.openWorkspace('workspace-a')).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
    expect(studentClient.projection).toBeNull();
  });

  it('keeps corrupted recovery bytes and requires an explicit discard before new writes', async () => {
    const {storage, values} = memoryStorage(); values.set(teacher.id, '{invalid-original');
    const client = await open(fetchFor(body => body.action === 'login' ? json(session(teacher)) : json(projection())), storage);
    expect(values.get(teacher.id)).toBe('{invalid-original');
    expect(client.exportPendingRecovery()).toBe('{invalid-original');
    await expect(client.core.execute(actor, rename())).rejects.toMatchObject({code: 'INVALID_RECOVERY'});
    expect(values.get(teacher.id)).toBe('{invalid-original');
    client.discardInvalidRecovery(); expect(values.has(teacher.id)).toBe(false);
  });

  it('refuses to send when a durable recovery record cannot be written', async () => {
    let sent = false;
    const bad: PendingStorage = {read: () => null, write: () => {throw Error('Quota');}, remove: () => {}};
    const client = await open(fetchFor(body => {
      if (body.action === 'login') return json(session(teacher));
      if (body.action === 'open-workspace') return json(projection());
      sent = true; return json(null);
    }), bad);
    await expect(client.core.execute(actor, rename())).rejects.toMatchObject({code: 'RECOVERY_STORAGE_FAILURE'});
    expect(sent).toBe(false); expect(client.state.pending).toEqual([]);
  });

  it('serializes cookie-setting auth requests and discards a superseded login response', async () => {
    const first = deferred<Response>(); const calls: string[] = [];
    const client = createRemoteClient({fetch: fetchFor(body => {calls.push(String(body.username));
      return body.username === 'first' ? first.promise : json(session(studentB));})});
    const old = client.login('first', 'synthetic'); await tick();
    const latest = client.login('second', 'synthetic'); await tick();
    expect(calls).toEqual(['first']);
    first.resolve(json(session(teacher))); await expect(old).rejects.toMatchObject({code: 'SESSION_CHANGED'});
    await latest; expect(calls).toEqual(['first', 'second']); expect(client.account?.id).toBe(studentB.id);
  });

  it('does not let a late workspace open select a workspace the user already left', async () => {
    const slow = deferred<Response>();
    const client = await open(fetchFor(body => {
      if (body.action === 'login') return json(session(teacher));
      if (body.workspaceId === 'workspace-slow') return slow.promise;
      return json(projection(1, teacher, String(body.workspaceId)));
    }));
    const old = client.openWorkspace('workspace-slow'), latest = client.openWorkspace('workspace-new');
    await latest; slow.resolve(json(projection(8, teacher, 'workspace-slow')));
    await expect(old).rejects.toMatchObject({code: 'WORKSPACE_CHANGED'});
    expect(client.projection?.workspaceId).toBe('workspace-new');
  });

  it('treats timeout as an unknown outcome and keeps the exact pending request', async () => {
    const fetcher = fetchFor((body, init) => {
      if (body.action === 'login') return json(session(teacher));
      if (body.action === 'open-workspace') return json(projection());
      return new Promise<Response>((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once: true}));
    });
    const client = createRemoteClient({fetch: fetcher, timeoutMs: 10});
    await client.login('synthetic', 'synthetic'); await client.openWorkspace('workspace-a');
    await expect(client.core.execute(actor, rename())).rejects.toMatchObject({code: 'REQUEST_TIMEOUT', outcome: 'unknown'});
    expect(client.state.status).toBe('uncertain'); expect(client.state.pending[0]?.request).toMatchObject({command: rename()});
  });

  it('rejects a mismatched command receipt and retains uncertain recovery', async () => {
    const client = await open(fetchFor(body => {
      if (body.action === 'login') return json(session(teacher));
      if (body.action === 'open-workspace') return json(projection());
      return json(mutation(rename('different-command'), projection(2)));
    }));
    await expect(client.core.execute(actor, rename())).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
    expect(client.state.status).toBe('uncertain'); expect(client.projection?.workspaceRevision).toBe(1);
  });

  it('exports only an explicitly authorized personal format and requires import account confirmation', async () => {
    const calls: string[] = [];
    const client = await open(fetchFor(body => {
      calls.push(String(body.action));
      if (body.action === 'login') return json(session(teacher));
      if (body.action === 'export-personal') return json({format: 'ardesia-personal-v1', accountId: teacher.id, workspaceId: 'workspace-a', exportedAt: at, projection: projection()});
      return json(projection());
    }));
    const exported = await client.exportPersonal(); expect(exported.accountId).toBe(teacher.id);
    await expect(client.importLocal({commandId: 'import-1', title: 'Import', expectedAccountId: studentB.id, snapshotText: '{}'})).rejects.toMatchObject({code: 'SESSION_CHANGED'});
    expect(calls).not.toContain('import-local');
  });

  it('namespaces recovery keys by account without storing application credentials', () => {
    const values = new Map<string, string>();
    const storage = browserPendingStorage({getItem: key => values.get(key) ?? null, setItem: (key, value) => {values.set(key, value);}, removeItem: key => {values.delete(key);},
      key: index => [...values.keys()][index] ?? null, get length() {return values.size;}});
    const a = JSON.stringify([{commandId: 'pending-a', accountId: 'student-a'}]), b = JSON.stringify([{commandId: 'pending-b', accountId: 'student-b'}]);
    storage.write('student-a', a); storage.write('student-b', b); storage.remove('student-a');
    expect(storage.read('student-a')).toBeNull(); expect(storage.read('student-b')).toBe(b);
    expect([...values.keys()]).toEqual(['ardesia-next.pending.v1.student-b/pending-b']);
  });

  it('preserves the server-bound historical teacher actor of an imported workspace', async () => {
    const imported = projection(); imported.actor.actorId = 'device-owner'; imported.documents[0]!.ownerId = 'device-owner';
    const next = structuredClone(imported); next.workspaceRevision = 2; next.documents[0]!.revision = 2;
    const client = await open(fetchFor(body => {
      if (body.action === 'login') return json(session(teacher));
      if (body.action === 'open-workspace') return json(imported);
      return json(mutation(body.command as CoreCommand, next));
    }));
    expect(client.account?.id).toBe(teacher.id);
    expect(client.core.getDocument(imported.actor, 'lesson-1').ownerId).toBe('device-owner');
    expect(() => client.core.getDocument(actor, 'lesson-1')).toThrow();
    const receipt = await client.core.execute(imported.actor, rename());
    expect(receipt.actorId).toBe('device-owner'); expect(client.projection?.workspaceRevision).toBe(2);
  });

  it('rejects a changed Core binding for the same workspace even when its revision increases', async () => {
    let changed = false;
    const client = await open(fetchFor(body => {
      if (body.action === 'login') return json(session(teacher));
      const next = projection(changed ? 2 : 1);
      if (changed) {next.actor.actorId = 'different-binding'; next.documents[0]!.ownerId = 'different-binding';}
      return json(next);
    }));
    changed = true; await expect(client.refresh()).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
    expect(client.projection?.actor).toEqual(actor);
  });

  it('clears the prior role projection when the session role changes', async () => {
    const client = await open(fetchFor(body => body.action === 'login' ? json(session(teacher))
      : body.action === 'session' ? json(session({...teacher, role: 'student'})) : json(projection())));
    await expect(client.session()).rejects.toMatchObject({code: 'SESSION_CHANGED'});
    expect(client.projection).toBeNull(); expect(client.account).toBeNull();
  });

  it('logs out the cookie established by a superseded login before reporting signed out', async () => {
    const first = deferred<Response>(); const calls: string[] = [];
    const client = createRemoteClient({fetch: fetchFor((body, init) => {
      calls.push(String(body.action));
      if (body.action === 'login') return first.promise;
      if (body.action === 'session') return json(session(teacher));
      expect(new Headers(init.headers).get('X-Ardesia-Account')).toBe(teacher.id);
      return json(null);
    })});
    const old = client.login('synthetic', 'synthetic'); await tick(); const logout = client.logout();
    first.resolve(json(session(teacher))); await expect(old).rejects.toMatchObject({code: 'SESSION_CHANGED'});
    await logout; expect(calls).toEqual(['login', 'session', 'logout']); expect(client.state.status).toBe('signed-out');
  });

  it('drops the currently displayed workspace after observing a server access revocation', async () => {
    let revoked = false;
    const client = await open(fetchFor(body => body.action === 'login' ? json(session(teacher))
      : revoked ? error('NOT_FOUND', 404) : json(projection())));
    revoked = true; await expect(client.refresh()).rejects.toMatchObject({code: 'NOT_FOUND'});
    expect(client.projection).toBeNull(); expect(client.account?.id).toBe(teacher.id);
    expect(client.state.workspaceId).toBeNull(); expect(client.state.status).toBe('error');
    expect(() => client.core.getDocument(actor, 'lesson-1')).toThrow();
  });

  it('keeps in-memory recovery account-scoped across logout when durable storage is unavailable', async () => {
    let account = teacher;
    const client = await open(fetchFor(body => {
      if (body.action === 'login') return json(session(account));
      if (body.action === 'logout') return json(null);
      if (body.action === 'open-workspace') return json(projection());
      throw new TypeError('Connection lost');
    }));
    await expect(client.core.execute(actor, rename())).rejects.toMatchObject({code: 'NETWORK_ERROR'});
    expect(client.state.recovery).toBe('memory'); await client.logout();
    account = studentB; await client.login('student', 'synthetic'); expect(client.state.pending).toEqual([]);
    account = teacher; await client.login('teacher', 'synthetic'); expect(client.state.pending).toHaveLength(1);
  });
});
