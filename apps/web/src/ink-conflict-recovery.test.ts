import {describe, expect, it, vi} from 'vitest';
import {browserPendingStorage, createRemoteClient, type PendingCommand} from '@ardesia/remote-client';
import {deferred, fixture, ink, lesson, teacher, workspace, type TransportHooks} from './workspace-queue-fixture';

class WebStorage {
  values = new Map<string, string>();
  fault?: (key: string, value: string | null) => void;
  get length() {return this.values.size;}
  key(index: number) {return [...this.values.keys()][index] ?? null;}
  getItem(key: string) {return this.values.get(key) ?? null;}
  setItem(key: string, value: string) {this.fault?.(key, value); this.values.set(key, value);}
  removeItem(key: string) {this.fault?.(key, null); this.values.delete(key);}
}
async function setup(hooks: TransportHooks = {}, count = 3) {
  const f = await fixture(hooks), disk = new WebStorage();
  // Node 24's real LockManager supplies the same shared/exclusive contract as
  // the browser, rather than a callback-only fake which hides race conditions.
  const storage = () => browserPendingStorage(disk);
  const open = () => f.open(workspace, storage());
  const client = await open();
  await f.external('external');
  await Promise.allSettled(Array.from({length: count}, (_, index) => client.edit(teacher, lesson, ink('ink-' + index))));
  const originals = structuredClone(client.state.pending);
  expect(originals.map(entry => entry.status)).toEqual(['conflict', ...Array(count - 1).fill('blocked')]);
  return {...f, client, disk, storage, open, originals};
}
const countObjects = (f: Awaited<ReturnType<typeof setup>>) => f.server.getDocument(teacher, lesson).objects.length;

describe('explicit, coordinated ink reconciliation against real Core', () => {
  it('previews three preserved strokes, then applies only the finite confirmed sequence with new receipt IDs', async () => {
    const f = await setup();
    const preview = await f.client.prepareInkRecovery();
    expect(preview.entries).toHaveLength(3); expect(f.sent).toHaveLength(1); expect(countObjects(f)).toBe(1);
    const before = f.client.exportPendingRecovery();
    expect(f.client.exportPendingRecovery()).toBe(before);
    await f.client.confirmInkRecovery(preview.token);
    expect(countObjects(f)).toBe(4); expect(f.client.state.pending).toEqual([]);
    expect(f.disk.values.size).toBe(0);
    for (const [index, call] of f.sent.slice(1).entries()) {
      const original = f.originals[index]!.request;
      expect(original.action).toBe('command');
      if (original.action !== 'command') throw Error('Invalid fixture');
      expect(call.body).toEqual({...original, command: {...original.command, commandId: call.body.command.commandId, expectedRevision: index + 2}});
      expect(call.body.command.commandId).not.toBe(f.originals[index]!.commandId);
    }
    expect(f.server.snapshot().events).toHaveLength(5); expect(f.server.snapshot().receipts).toHaveLength(5);
  });

  it('retries the same replacement after a committed response is lost and a new client opens', async () => {
    const f = await setup({afterCommit: (_call, _receipt, index) => {if (index === 2) throw TypeError('Lost replacement response');}});
    const preview = await f.client.prepareInkRecovery();
    await expect(f.client.confirmInkRecovery(preview.token)).rejects.toMatchObject({code: 'NETWORK_ERROR'});
    expect(countObjects(f)).toBe(2); expect(f.client.state.pending).toHaveLength(3);
    const retained = JSON.parse(f.client.exportPendingRecovery()!) as PendingCommand[];
    expect(retained[0]?.request).toEqual(f.originals[0]?.request);
    expect(retained[0]?.reconciliation?.attempts).toHaveLength(1);
    const cold = await f.open();
    await expect(cold.prepareInkRecovery()).rejects.toThrow(/Verifica/);
    expect(f.sent).toHaveLength(2);
    await cold.retryPending(f.originals[0]!.commandId);
    expect(f.sent[2]).toEqual(f.sent[1]); expect(f.receipts[1]).toEqual(f.receipts[0]);
    expect(countObjects(f)).toBe(2);
    const remaining = await cold.prepareInkRecovery(); expect(remaining.entries).toHaveLength(2);
    await cold.confirmInkRecovery(remaining.token);
    expect(countObjects(f)).toBe(4); expect(cold.state.pending).toEqual([]);
    expect(f.server.snapshot().events).toHaveLength(5);
  });

  it('invalidates a preview if another writer changes the lesson; no implicit CAS refresh', async () => {
    const f = await setup(), preview = await f.client.prepareInkRecovery();
    await f.external('later');
    await expect(f.client.confirmInkRecovery(preview.token)).rejects.toMatchObject({code: 'RECOVERY_PREVIEW_STALE'});
    expect(f.sent).toHaveLength(1); expect(f.client.state.pending.every(entry => !entry.reconciliation)).toBe(true);
    await f.client.confirmInkRecovery((await f.client.prepareInkRecovery()).token);
    expect(countObjects(f)).toBe(5);
  });

  it('stops after a new conflict in the middle and retains all remaining original payloads', async () => {
    let inject = true;
    const f = await setup();
    f.hooks.afterCommit = async (_call, _receipt, index) => {if (index === 2 && inject) {inject = false; await f.external('racing');}};
    await expect(f.client.confirmInkRecovery((await f.client.prepareInkRecovery()).token)).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    expect(f.sent).toHaveLength(2); // The refreshed receipt projection detects stale next CAS before HTTP.
    expect(f.client.state.pending).toHaveLength(2);
    expect(f.client.state.pending.map(entry => entry.request)).toEqual(f.originals.slice(1).map(entry => entry.request));
    expect(countObjects(f)).toBe(3);
    await f.client.confirmInkRecovery((await f.client.prepareInkRecovery()).token);
    expect(countObjects(f)).toBe(5);
  });

  it('serializes two confirmations and rejects stale retry/discard without resurrecting any row', async () => {
    const f = await setup(), other = await f.open();
    // A reload first verifies the original rejection, never infers it from disk.
    await expect(other.retryPending(f.originals[0]!.commandId)).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    const a = await f.client.prepareInkRecovery(), b = await other.prepareInkRecovery();
    expect(a.token).toBe(b.token);
    const held = deferred(); let holding = false;
    f.hooks.afterCommit = async () => {if (!holding) {holding = true; await held.promise;}};
    const confirming = f.client.confirmInkRecovery(a.token);
    await vi.waitFor(() => expect(holding).toBe(true));
    const competing = Promise.allSettled([other.confirmInkRecovery(b.token), other.retryPending(f.originals[0]!.commandId), other.discardPending(f.originals[0]!.commandId)]);
    held.release(); await confirming;
    expect((await competing).every(result => result.status === 'rejected')).toBe(true);
    expect(countObjects(f)).toBe(4); expect(f.disk.values.size).toBe(0);
    expect((await f.open()).state.pending).toEqual([]);
  });

  it('keeps the original durable row and the attempted envelope exportable when its write hits quota', async () => {
    const f = await setup(), preview = await f.client.prepareInkRecovery();
    const before = [...f.disk.values];
    f.disk.fault = (_key, value) => {if (value && JSON.parse(value)?.version === 3) throw Error('Quota');};
    await expect(f.client.confirmInkRecovery(preview.token)).rejects.toMatchObject({code: 'RECOVERY_STORAGE_FAILURE'});
    expect(f.sent).toHaveLength(1); expect([...f.disk.values]).toEqual(before);
    expect(f.client.state.recovery).toBe('memory');
    const exported = JSON.parse(f.client.exportPendingRecovery()!) as PendingCommand[];
    expect(exported.map(entry => entry.request)).toEqual(f.originals.map(entry => entry.request));
    expect(exported[0]?.reconciliation?.attempts).toHaveLength(1);
    f.disk.fault = undefined;
    await f.client.resumePending(f.originals[0]!.commandId);
    await f.client.confirmInkRecovery((await f.client.prepareInkRecovery()).token);
    expect(countObjects(f)).toBe(4);
  });

  it('does not deadlock when the same client queues an original retry during confirmation', async () => {
    const f = await setup({}, 1), gate = deferred(); let hold = false, reading = false;
    const client = createRemoteClient({pendingStorage: f.storage(), fetch: async (url, init) => {
      if (hold && JSON.parse(String(init?.body)).action === 'open-workspace') {reading = true; await gate.promise;}
      return f.fetcher(url, init);
    }});
    await client.login('synthetic', 'password'); await client.openWorkspace(workspace);
    await expect(client.retryPending(f.originals[0]!.commandId)).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    const preview = await client.prepareInkRecovery(); hold = true;
    const confirmation = client.confirmInkRecovery(preview.token);
    await vi.waitFor(() => expect(reading).toBe(true));
    const retry = Promise.allSettled([client.retryPending(f.originals[0]!.commandId)]);
    gate.release(); await confirmation;
    expect((await retry)[0]?.status).toBe('rejected'); expect(countObjects(f)).toBe(2);
    expect(client.state.pending).toEqual([]);
  });

  it('does not reuse a subscriber resume waiting behind the exclusive recovery that emitted its envelope', async () => {
    const f = await setup({}, 1); let resumed: Promise<PromiseSettledResult<void>[]> | undefined;
    const unsubscribe = f.client.subscribe(() => {
      const entry = f.client.state.pending[0];
      if (!resumed && entry?.status === 'blocked' && entry.reconciliation) resumed = Promise.allSettled([f.client.resumePending(entry.commandId)]);
    });
    await f.client.confirmInkRecovery((await f.client.prepareInkRecovery()).token);
    expect(resumed).toBeDefined(); expect((await resumed)![0]?.status).toBe('rejected');
    expect(countObjects(f)).toBe(2); expect(f.client.state.pending).toEqual([]); unsubscribe();
  });

  it('rejects a queued original retry after a replacement loses its response, instead of redirecting that old action', async () => {
    const f = await setup({}, 1), gate = deferred(); let hold = false, reading = false;
    const client = createRemoteClient({pendingStorage: f.storage(), fetch: async (url, init) => {
      if (hold && JSON.parse(String(init?.body)).action === 'open-workspace') {reading = true; await gate.promise;}
      return f.fetcher(url, init);
    }});
    await client.login('synthetic', 'password'); await client.openWorkspace(workspace);
    await expect(client.retryPending(f.originals[0]!.commandId)).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    const preview = await client.prepareInkRecovery(); hold = true;
    f.hooks.afterCommit = () => {throw TypeError('Lost replacement response');};
    const confirmation = Promise.allSettled([client.confirmInkRecovery(preview.token)]);
    await vi.waitFor(() => expect(reading).toBe(true));
    const retry = Promise.allSettled([client.retryPending(f.originals[0]!.commandId)]);
    gate.release(); expect((await confirmation)[0]).toMatchObject({status: 'rejected', reason: {code: 'NETWORK_ERROR'}});
    expect((await retry)[0]).toMatchObject({status: 'rejected', reason: {code: 'RECOVERY_CHANGED'}});
    expect(f.sent).toHaveLength(3); expect(countObjects(f)).toBe(2); expect(client.state.pending).toHaveLength(1);
  });

  it.each(['release', 'delete'] as const)('keeps an ACK envelope when %s fails, then recovers the same receipt', async phase => {
    const f = await setup(), preview = await f.client.prepareInkRecovery();
    f.disk.fault = (_key, value) => {if (countObjects(f) === 2 && (phase === 'delete' ? value === null : value && JSON.parse(value)?.edit?.predecessorId === null && JSON.parse(value)?.commandId === f.originals[1]!.commandId)) throw Error('Crash at cleanup');};
    await expect(f.client.confirmInkRecovery(preview.token)).rejects.toMatchObject({code: 'RECOVERY_CLEANUP_FAILURE'});
    expect(countObjects(f)).toBe(2);
    expect((JSON.parse(f.client.exportPendingRecovery()!) as PendingCommand[]).map(entry => entry.request)).toEqual(f.originals.map(entry => entry.request));
    f.disk.fault = undefined;
    const cold = await f.open();
    expect(cold.state.pending).toHaveLength(3); expect(f.sent).toHaveLength(2);
    await cold.retryPending(f.originals[0]!.commandId);
    expect(f.sent[2]).toEqual(f.sent[1]); expect(countObjects(f)).toBe(2);
    await cold.confirmInkRecovery((await cold.prepareInkRecovery()).token);
    expect(countObjects(f)).toBe(4); expect(cold.state.pending).toEqual([]);
  });

  it('reopens the durable replacement without sending when its pre-HTTP marker could not be saved', async () => {
    const f = await setup({}, 1), preview = await f.client.prepareInkRecovery();
    f.disk.fault = (_key, value) => {if (value && JSON.parse(value)?.version === 3 && JSON.parse(value)?.status === 'pending') throw Error('Before HTTP');};
    await expect(f.client.confirmInkRecovery(preview.token)).rejects.toMatchObject({code: 'RECOVERY_STORAGE_FAILURE'});
    expect(f.sent).toHaveLength(1); expect(countObjects(f)).toBe(1);
    const stored = JSON.parse([...f.disk.values.values()][0]!) as PendingCommand;
    expect(stored.reconciliation?.attempts).toHaveLength(1); expect(stored.status).toBe('blocked');
    f.disk.fault = undefined;
    const cold = await f.open(); expect(f.sent).toHaveLength(1);
    await cold.resumePending(stored.commandId);
    expect(f.sent[1]?.body.command.commandId).toBe(stored.reconciliation!.attempts[0]!.commandId);
    expect(countObjects(f)).toBe(2); expect(cold.state.pending).toEqual([]);
  });

  it('does not cross a non-ink barrier and does not recycle an object ID from history', async () => {
    const f = await setup({}, 1);
    await f.client.edit(teacher, lesson, {kind: 'rename-document', title: 'After ink'}).catch(() => undefined);
    await f.client.edit(teacher, lesson, ink('after-barrier')).catch(() => undefined);
    const preview = await f.client.prepareInkRecovery();
    expect(preview.entries).toHaveLength(1); expect(preview.remaining).toBe(2);
    await f.client.confirmInkRecovery(preview.token);
    expect(f.client.state.pending).toHaveLength(2);
    await expect(f.client.prepareInkRecovery()).rejects.toThrow(/altra modifica/);

    const g = await setup({}, 1);
    await g.external('ink-0');
    await g.server.execute(teacher, {kind: 'remove-object', objectId: 'ink-0', documentId: lesson, commandId: 'remove-existing', expectedRevision: 3});
    await expect(g.client.prepareInkRecovery()).rejects.toThrow(/storico/);
    expect(g.sent).toHaveLength(1); expect(g.client.state.pending[0]?.request).toEqual(g.originals[0]?.request);
  });

  it('previews moved page anchors without rewriting ink and refuses a removed page or unavailable source', async () => {
    async function anchored(remove: boolean, missingSource = false) {
      const f = await fixture(), disk = new WebStorage();
      await f.server.execute(teacher, {kind: 'add-object', commandId: 'page-create', documentId: lesson, expectedRevision: 1,
        object: {id: 'page', type: 'material', title: 'Pagina originale', x: 10, y: 20, width: 600, height: 800,
          data: {assetId: 'original-asset', sha256: 'a'.repeat(64), mimeType: 'application/pdf', name: 'Original.pdf', license: 'CC0', page: 1, pageCount: 1, pageWidth: 600, pageHeight: 800}}});
      const client = await f.open(workspace, browserPendingStorage(disk));
      await f.server.execute(teacher, remove
        ? {kind: 'remove-object', commandId: 'page-change', documentId: lesson, expectedRevision: 2, objectId: 'page'}
        : {kind: 'move-object', commandId: 'page-change', documentId: lesson, expectedRevision: 2, objectId: 'page', x: 110, y: 220});
      const edit = ink('anchored'); if (edit.kind !== 'add-object' || edit.object.type !== 'ink') throw Error('Expected ink');
      edit.object.data.anchor = {objectId: 'page', x: 10, y: 20};
      if (missingSource) edit.object.provenance = {origin: 'authored', sources: [{sourceId: 'missing', revision: 1, locator: 'p. 1'}]};
      await expect(client.edit(teacher, lesson, edit)).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
      const original = structuredClone(client.state.pending[0]!.request);
      if (remove || missingSource) {
        await expect(client.prepareInkRecovery()).rejects.toThrow(remove ? /pagina/ : /fonte/);
        expect(f.sent).toHaveLength(1); expect(client.state.pending[0]?.request).toEqual(original);
      } else {
        const preview = await client.prepareInkRecovery();
        expect(preview.entries[0]).toMatchObject({x: 100, y: 200, movedAnchor: true, object: edit.object});
        await client.confirmInkRecovery(preview.token);
        expect(f.sent[1]!.body.command).toMatchObject({object: edit.object});
        const saved = f.server.getDocument(teacher, lesson).objects.find(value => value.id === 'anchored')!;
        expect(saved).toMatchObject({x: 0, y: 0, data: edit.object.data});
      }
    }
    await anchored(false); await anchored(true); await anchored(false, true);
  });

  it('refuses a new attempt after account access changes and retains the original account recovery', async () => {
    const f = await setup({}, 1), preview = await f.client.prepareInkRecovery(), original = f.client.exportPendingRecovery();
    f.setAccount({id: 'other-account', role: 'teacher', displayName: 'Other'});
    await expect(f.client.confirmInkRecovery(preview.token)).rejects.toMatchObject({code: 'SESSION_CHANGED'});
    expect(f.sent).toHaveLength(1); expect(f.client.state.account).toBeNull();
    expect(f.storage().read(teacher.actorId)).toBe(original);
    await f.client.login('other', 'password'); expect(f.client.state.pending).toEqual([]);
  });

  it('rejects an authorized read-only document projection before preparing a replacement', async () => {
    const f = await setup({}, 1);
    // Approved documents are a valid projection contract even though ordinary
    // authoring commands never promote their status. Exercise that read boundary.
    const client = createRemoteClient({pendingStorage: f.storage(), fetch: async (url, init) => {
      const response = await f.fetcher(url, init);
      if (JSON.parse(String(init?.body)).action !== 'open-workspace') return response;
      const value = await response.json(); value.result.documents[0].status = 'approved';
      return new Response(JSON.stringify(value), {status: 200});
    }});
    await client.login('synthetic', 'password'); await client.openWorkspace(workspace);
    await expect(client.prepareInkRecovery()).rejects.toThrow(/non è più modificabile/);
    expect(f.sent).toHaveLength(1); expect(client.state.pending[0]?.request).toEqual(f.originals[0]?.request);
  });

  it('recovers 500 logical intents without duplicating recovery rows or raising the quota', async () => {
    const f = await setup({}, 1), first = f.originals[0]!;
    let predecessorId = first.commandId;
    for (let index = 1; index < 500; index++) {
      const commandId = 'cold-' + index;
      f.disk.setItem('ardesia-next.pending.v1.' + teacher.actorId + '/' + commandId, JSON.stringify({...first, commandId, status: 'blocked', error: null,
        request: {action: 'command', workspaceId: workspace, command: {...ink('ink-' + index), commandId, documentId: lesson, expectedRevision: index + 1}},
        edit: {...first.edit, predecessorId}}));
      predecessorId = commandId;
    }
    const cold = await f.open();
    await expect(cold.retryPending(first.commandId)).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    const preview = await cold.prepareInkRecovery();
    expect(preview.entries).toHaveLength(500); expect(f.disk.values.size).toBe(500);
    f.hooks.afterCommit = () => {expect(f.disk.values.size).toBeLessThanOrEqual(500); throw TypeError('Stop after first real receipt');};
    await expect(cold.confirmInkRecovery(preview.token)).rejects.toMatchObject({code: 'NETWORK_ERROR'});
    expect(f.disk.values.size).toBe(500); expect((await f.open()).state.pending).toHaveLength(500);
  });

  it('enforces the account-wide quota while two workspaces capture a new intent concurrently', async () => {
    const f = await setup({}, 1), template = f.originals[0]!;
    await f.addWorkspace('other-workspace'); f.disk.values.clear();
    const prefix = 'ardesia-next.pending.v1.' + teacher.actorId + '/';
    for (let index = 0; index < 499; index++) {
      const commandId = 'retained-' + index;
      f.disk.setItem(prefix + commandId, JSON.stringify({...template, commandId, status: 'blocked', error: null,
        request: {action: 'command', workspaceId: workspace, command: {...ink('object-' + index), commandId, documentId: lesson, expectedRevision: index + 1}},
        edit: {...template.edit, predecessorId: index ? 'retained-' + (index - 1) : null}}));
    }
    const a = await f.open();
    const other = createRemoteClient({fetch: f.fetcher, pendingStorage: f.storage()});
    await other.login('synthetic', 'password'); await other.openWorkspace('other-workspace');
    let maximum = 0;
    f.disk.fault = (key, value) => {maximum = Math.max(maximum, f.disk.values.size + (value === null ? -1 : f.disk.values.has(key) ? 0 : 1));};
    await Promise.allSettled([a.edit(teacher, lesson, ink('new-a')), other.edit(teacher, lesson, ink('new-b'))]);
    expect(maximum).toBeLessThanOrEqual(500); expect(f.disk.values.size).toBe(500);
    const cold = await f.open(); expect(cold.state.recovery).toBe('durable'); expect(cold.state.pending).toHaveLength(500);
  });

  it('requires real coordination and rejects corrupted attempt identity without losing the exported bytes', async () => {
    const f = await setup();
    const verifier = await f.open();
    const plain = browserPendingStorage(f.disk, 'ardesia-next.pending.v1.', null);
    const client = await fixture();
    await expect(client.client.prepareInkRecovery()).rejects.toMatchObject({code: 'RECOVERY_UNAVAILABLE'});
    expect(plain.coordinate).toBeUndefined();
    await expect(verifier.retryPending(f.originals[0]!.commandId)).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    const before = JSON.parse(f.disk.getItem([...f.disk.values.keys()][0]!)!);
    f.disk.setItem([...f.disk.values.keys()][0]!, JSON.stringify({...before, version: 3, reconciliation: {recoveryId: before.commandId, originalOutcome: 'revision-conflict', attempts: [{commandId: before.commandId, expectedRevision: 2, createdAt: before.createdAt}]}}));
    const cold = await f.open(); expect(cold.state.recovery).toBe('invalid');
    expect(cold.exportPendingRecovery()).toContain('reconciliation');
    await expect(cold.prepareInkRecovery()).rejects.toMatchObject({code: 'INVALID_RECOVERY'});
  });
});
