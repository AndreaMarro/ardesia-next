import {describe, expect, it} from 'vitest';
import {browserPendingStorage, createRemoteClient, type PendingCommand} from './index';

const owner = 'teacher-storage';
const accountKey = 'ardesia-next.pending.v1.' + owner;
const rowKey = (id: string) => accountKey + '/' + encodeURIComponent(id);
const at = '2026-10-31T12:00:00.000Z';

class WebStorage {
  readonly values = new Map<string, string>();
  get length() {return this.values.size;}
  key(index: number) {return [...this.values.keys()][index] ?? null;}
  getItem(key: string) {return this.values.get(key) ?? null;}
  setItem(key: string, value: string) {this.values.set(key, value);}
  removeItem(key: string) {this.values.delete(key);}
}

function entry(commandId: string, predecessorId: string | null = null, workspaceId = 'workspace-storage'): PendingCommand {
  return {version: 2, accountId: owner, commandId, workspaceId, actorId: owner, createdAt: at,
    request: {action: 'command', workspaceId, command: {kind: 'rename-document', commandId,
      documentId: 'lesson-storage', expectedRevision: predecessorId ? 2 : 1, title: commandId}},
    status: 'blocked', error: null, edit: {actor: {actorId: owner, role: 'teacher'}, predecessorId}};
}

async function authenticate(storage: ReturnType<typeof browserPendingStorage>) {
  const actions: string[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {action: string};
    actions.push(body.action);
    if (body.action !== 'login') throw Error('Unexpected request during recovery load.');
    return new Response(JSON.stringify({ok: true, result: {
      account: {id: owner, role: 'teacher', displayName: 'Synthetic storage teacher'},
      expiresAt: '2026-11-01T12:00:00.000Z',
    }}), {status: 200});
  };
  const client = createRemoteClient({pendingStorage: storage, fetch: fetcher});
  await client.login('synthetic', 'synthetic-password');
  return {client, actions};
}

describe('per-command browser recovery compatibility and isolation', () => {
  it('cleans observed legacy IDs with tombstones while preserving original legacy bytes and later legacy writes', () => {
    const web = new WebStorage(), storage = browserPendingStorage(web);
    const old = entry('legacy-command');
    delete old.edit; old.version = 1; old.status = 'uncertain';
    const original = JSON.stringify([old], null, 2);
    web.setItem(accountKey, original);
    const firstRead = storage.read(owner)!;
    storage.baseline!(owner, firstRead);
    const newer = entry('new-command');
    storage.write(owner, JSON.stringify([old, newer]));
    expect(web.getItem(accountKey)).toBe(original);
    storage.write(owner, JSON.stringify([newer]));
    expect(web.getItem(accountKey)).toBe(original);
    expect(web.getItem(rowKey(old.commandId))).toBe('null');
    expect(JSON.parse(storage.read(owner, false)!)).toEqual([newer]);

    // A legacy writer may update its own aggregate. Normal cleanup must neither
    // rewrite that aggregate nor erase a newly introduced ID it never observed.
    const foreign = entry('later-legacy-command');
    delete foreign.edit; foreign.version = 1; foreign.status = 'uncertain';
    const later = JSON.stringify([old, foreign], null, 2);
    web.setItem(accountKey, later);
    storage.remove(owner);
    expect(web.getItem(accountKey)).toBe(later);
    expect(web.getItem(rowKey(newer.commandId))).toBeNull();
    expect(JSON.parse(browserPendingStorage(web).read(owner)!)).toEqual([foreign]);
  });

  it('exports corrupt row bytes and limits explicit discard to the unchanged rows observed before export', async () => {
    const web = new WebStorage(), badPath = rowKey('corrupt-command');
    const original = '{"version":2,"broken":';
    web.setItem(badPath, original);
    const {client, actions} = await authenticate(browserPendingStorage(web));
    expect(client.state.recovery).toBe('invalid');
    expect(client.state.pending).toEqual([]);
    const unseen = entry('unseen-command');
    web.setItem(rowKey(unseen.commandId), JSON.stringify(unseen));

    const exported = JSON.parse(client.exportPendingRecovery()!) as {recovery: [string, string][]};
    expect(exported.recovery).toContainEqual([badPath, original]);
    expect(exported.recovery).toContainEqual([rowKey(unseen.commandId), JSON.stringify(unseen)]);
    client.discardInvalidRecovery();
    expect(web.getItem(badPath)).toBeNull();
    expect(web.getItem(rowKey(unseen.commandId))).toBe(JSON.stringify(unseen));
    expect(JSON.parse(browserPendingStorage(web).read(owner)!)).toEqual([unseen]);
    expect(actions).toEqual(['login']);
  });

  it('preserves the existing row when another adapter collides on a command ID with a different payload', () => {
    const web = new WebStorage(), first = browserPendingStorage(web), second = browserPendingStorage(web);
    first.read(owner); second.read(owner);
    const original = entry('shared-id');
    first.write(owner, JSON.stringify([original]));
    const changed = structuredClone(original);
    if (changed.request.action !== 'command' || changed.request.command.kind !== 'rename-document') throw Error('Invalid fixture.');
    changed.request.command.title = 'A different intent under the same ID';
    expect(() => second.write(owner, JSON.stringify([changed]))).toThrow();
    expect(web.getItem(rowKey(original.commandId))).toBe(JSON.stringify(original));
    expect(JSON.parse(browserPendingStorage(web).read(owner)!)).toEqual([original]);
  });

  it('retains legacy and every successfully written row if quota fails partway through a multi-row write', () => {
    const web = new WebStorage(), storage = browserPendingStorage(web);
    const old = entry('legacy-command'), first = entry('first-command'), second = entry('second-command', first.commandId);
    const original = JSON.stringify([old]);
    web.setItem(accountKey, original);
    storage.baseline!(owner, storage.read(owner)!);
    const originalWrite = web.setItem.bind(web);
    web.setItem = (key, value) => {
      if (key === rowKey(second.commandId)) throw new Error('Synthetic quota failure.');
      originalWrite(key, value);
    };
    expect(() => storage.write(owner, JSON.stringify([old, first, second]))).toThrow();
    expect(web.getItem(accountKey)).toBe(original);
    expect(web.getItem(rowKey(first.commandId))).toBe(JSON.stringify(first));
    expect(web.getItem(rowKey(second.commandId))).toBeNull();
    web.setItem = originalWrite;
    storage.write(owner, JSON.stringify([old, first, second]));
    const recovered = JSON.parse(browserPendingStorage(web).read(owner)!) as PendingCommand[];
    expect(new Set(recovered.map(item => item.commandId))).toEqual(new Set([old.commandId, first.commandId, second.commandId]));
    expect(web.getItem(accountKey)).toBe(original);
  });

  it('restores dependencies in causal order even when localStorage enumerates the successor first', async () => {
    const web = new WebStorage();
    const parent = entry('parent'), child = entry('child', parent.commandId);
    // Equal timestamps and reversed storage enumeration make timestamp or key
    // ordering insufficient. The actual predecessor relation must be followed.
    web.setItem(rowKey(child.commandId), JSON.stringify(child));
    web.setItem(rowKey(parent.commandId), JSON.stringify(parent));
    const {client, actions} = await authenticate(browserPendingStorage(web));
    expect(client.state.recovery).toBe('durable');
    expect(client.state.pending.map(item => item.commandId)).toEqual(['parent', 'child']);
    expect(client.state.pending.map(item => item.status)).toEqual(['blocked', 'blocked']);
    expect(client.state.status).not.toBe('confirmed');
    expect(actions).toEqual(['login']);
    expect(web.getItem(rowKey(child.commandId))).toBe(JSON.stringify(child));
  });

  it.each(['cycle', 'cross-workspace'] as const)('preserves invalid %s dependencies without dispatch or destructive normalization', async reason => {
    const web = new WebStorage();
    const parent = entry('parent', reason === 'cycle' ? 'child' : null);
    const child = entry('child', parent.commandId, reason === 'cross-workspace' ? 'other-workspace' : parent.workspaceId!);
    const originalParent = JSON.stringify(parent), originalChild = JSON.stringify(child);
    web.setItem(rowKey(child.commandId), originalChild);
    web.setItem(rowKey(parent.commandId), originalParent);
    const {client, actions} = await authenticate(browserPendingStorage(web));
    expect(client.state.recovery).toBe('invalid');
    expect(client.state.pending).toEqual([]);
    const exported = JSON.parse(client.exportPendingRecovery()!) as PendingCommand[];
    expect(new Set(exported.map(item => item.commandId))).toEqual(new Set(['parent', 'child']));
    expect(web.getItem(rowKey(parent.commandId))).toBe(originalParent);
    expect(web.getItem(rowKey(child.commandId))).toBe(originalChild);
    expect(actions).toEqual(['login']);
  });
});
