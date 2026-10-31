import {describe, expect, it, vi} from 'vitest';
import {browserPendingStorage, type PendingCommand} from '@ardesia/remote-client';
import {deferred, fixture, ink, lesson, teacher, workspace, type TransportHooks} from './workspace-queue-fixture';

/** Two independent browser adapters see the same origin storage, as already-open tabs do. */
class SharedWebStorage {
  private readonly values = new Map<string, string>();
  get length() {return this.values.size;}
  key(index: number) {return [...this.values.keys()][index] ?? null;}
  getItem(key: string) {return this.values.get(key) ?? null;}
  setItem(key: string, value: string) {this.values.set(key, value);}
  removeItem(key: string) {this.values.delete(key);}
}

const otherWorkspace = 'workspace-b';
async function sharedFixture(hooks: TransportHooks = {}, secondWorkspace = workspace) {
  const base = await fixture(hooks), webStorage = new SharedWebStorage();
  const otherServer = await base.addWorkspace(otherWorkspace);
  const open = (selected = workspace) => base.open(selected, browserPendingStorage(webStorage));
  const tabA = await open(), tabB = await open(secondWorkspace);
  return {...base, otherServer, tabA, tabB, open};
}

function assertPreserved(actual: readonly PendingCommand[], original: readonly PendingCommand[]) {
  for (const entry of original) {
    expect(actual.find(candidate => candidate.commandId === entry.commandId)).toMatchObject({
      accountId: entry.accountId, actorId: entry.actorId, workspaceId: entry.workspaceId,
      commandId: entry.commandId, request: entry.request,
      edit: {actor: entry.edit!.actor, ...(entry.edit?.base ? {base: entry.edit.base} : {})},
    });
  }
}

describe('browser recovery shared by already-open tabs', () => {
  it('preserves A uncertain and unsent intents when an already-open B writes its own request', async () => {
    const {tabA, tabB, open, server} = await sharedFixture({afterCommit: (_call, _receipt, index) => {
      if (index === 1) throw new TypeError('Lost response after real commit.');
    }});
    await Promise.allSettled([
      tabA.edit(teacher, lesson, ink('A-first')),
      tabA.edit(teacher, lesson, ink('A-second')),
    ]);
    expect(tabA.state.pending.map(entry => entry.status)).toEqual(['uncertain', 'blocked']);
    const originals = structuredClone(tabA.state.pending);
    await Promise.allSettled([tabB.edit(teacher, lesson, ink('B-own'))]);
    const reopenedA = await open();
    assertPreserved(reopenedA.state.pending, originals);
    expect(reopenedA.state.pending.find(entry => entry.commandId === originals[1]!.commandId)?.status).toBe('blocked');
    expect(reopenedA.state.status).not.toBe('confirmed');
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['A-first']);
  });

  it('does not treat recovery exported by a stale B as permission to remove A entries during B cleanup', async () => {
    const {tabA, tabB, open, server, otherServer} = await sharedFixture({afterCommit: (_call, _receipt, index) => {
      if (index === 1) throw new TypeError('Lost A response after real commit.');
    }}, otherWorkspace);
    await Promise.allSettled([
      tabA.edit(teacher, lesson, ink('A-first')),
      tabA.edit(teacher, lesson, ink('A-second')),
    ]);
    const originals = structuredClone(tabA.state.pending);
    expect(originals.map(entry => entry.status)).toEqual(['uncertain', 'blocked']);
    expect(tabB.state.pending).toEqual([]);
    const exported = JSON.parse(tabB.exportPendingRecovery()!) as PendingCommand[];
    assertPreserved(exported, originals);
    expect(tabB.state.pending).toEqual([]);

    await tabB.edit(teacher, lesson, ink('B-own'));
    const reopenedA = await open();
    assertPreserved(reopenedA.state.pending, originals);
    expect(reopenedA.state.pending.map(entry => entry.status)).toEqual(['uncertain', 'blocked']);
    expect(reopenedA.state.status).not.toBe('confirmed');
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['A-first']);
    expect(server.snapshot().events).toHaveLength(2);
    expect(server.snapshot().receipts).toHaveLength(2);
    expect(otherServer.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['B-own']);
    expect(otherServer.snapshot().events).toHaveLength(2);
  });

  it('does not let B cleanup of its confirmed command erase A commands written while B awaited its response', async () => {
    const replyB = deferred();
    const {tabA, tabB, open, sent, otherServer} = await sharedFixture({afterCommit: async (call) => {
      if (call.body.workspaceId === otherWorkspace) await replyB.promise;
      else throw new TypeError('Lost A response after real commit.');
    }}, otherWorkspace);
    const resultB = Promise.allSettled([tabB.edit(teacher, lesson, ink('B-own'))]);
    let originals: readonly PendingCommand[] = [];
    try {
      await vi.waitFor(() => expect(otherServer.getDocument(teacher, lesson).revision).toBe(2));
      await Promise.allSettled([
        tabA.edit(teacher, lesson, ink('A-first')),
        tabA.edit(teacher, lesson, ink('A-second')),
      ]);
      originals = structuredClone(tabA.state.pending);
      expect(originals.map(entry => entry.status)).toEqual(['uncertain', 'blocked']);
    } finally {replyB.release();}
    expect((await resultB)[0]?.status).toBe('fulfilled');
    const commandB = sent.find(call => call.body.workspaceId === otherWorkspace)!.body.command.commandId;
    const reopened = await open();
    assertPreserved(reopened.state.pending, originals);
    expect(reopened.state.pending.some(entry => entry.commandId === commandB)).toBe(false);
    expect(otherServer.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['B-own']);
    expect(reopened.state.status).not.toBe('confirmed');
  });

  it('keeps both original A intents across both logouts and reloads, then recovers once without stale B resurrecting them', async () => {
    const {tabA, tabB, open, server, otherServer, sent, receipts} = await sharedFixture({afterCommit: (_call, _receipt, index) => {
      if (index === 1) throw new TypeError('Lost A response after real commit.');
    }}, otherWorkspace);
    await Promise.allSettled([
      tabA.edit(teacher, lesson, ink('A-first')),
      tabA.edit(teacher, lesson, ink('A-second')),
    ]);
    const originals = structuredClone(tabA.state.pending);
    await tabB.edit(teacher, lesson, ink('B-own'));
    await tabA.logout(); await tabB.logout();
    const reopenedA = await open(), reopenedB = await open(otherWorkspace);
    assertPreserved(reopenedA.state.pending, originals);
    assertPreserved(reopenedB.state.pending, originals);
    expect(reopenedA.state.pending.map(entry => entry.status)).toEqual(['uncertain', 'blocked']);

    await reopenedA.retryPending(originals[0]!.commandId);
    const firstAttempts = sent.filter(call => call.body.command.commandId === originals[0]!.commandId);
    expect(firstAttempts).toHaveLength(2);
    expect(firstAttempts[1]).toEqual(firstAttempts[0]);
    const firstReceipts = receipts.filter(receipt => receipt.commandId === originals[0]!.commandId);
    expect(firstReceipts).toHaveLength(2);
    expect(firstReceipts[1]).toEqual(firstReceipts[0]);
    expect(server.snapshot().events).toHaveLength(2);
    expect(server.snapshot().receipts).toHaveLength(2);
    expect(reopenedA.state.pending[0]?.status).toBe('blocked');
    await reopenedA.resumePending(originals[1]!.commandId);
    expect(sent.find(call => call.body.command.commandId === originals[1]!.commandId)?.body).toEqual(originals[1]!.request);
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['A-first', 'A-second']);
    expect(server.snapshot().events).toHaveLength(3);
    expect(server.snapshot().receipts).toHaveLength(3);

    // B still has its old in-memory view of A's recovery. Its own write and
    // cleanup must neither resurrect these confirmed requests nor replace others.
    await reopenedB.edit(teacher, lesson, ink('B-next'));
    await reopenedA.logout(); await reopenedB.logout();
    const finalA = await open(), finalB = await open(otherWorkspace);
    expect(finalA.state.pending).toEqual([]);
    expect(finalB.state.pending).toEqual([]);
    expect(otherServer.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['B-own', 'B-next']);
    expect(otherServer.snapshot().events).toHaveLength(3);
    expect(otherServer.snapshot().receipts).toHaveLength(3);
    expect(server.snapshot().events).toHaveLength(3);
    expect(server.snapshot().receipts).toHaveLength(3);
  });
});
