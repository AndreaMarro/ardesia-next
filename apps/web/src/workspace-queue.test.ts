import {describe, expect, it, vi} from 'vitest';
import type {Actor, EducationalObject} from '@ardesia/contracts';
import {account, deferred, fixture, ink, lesson, teacher, workspace, type TransportHooks} from './workspace-queue-fixture';

describe('P0 fail-closed workspace write sequence', () => {
  it('waits for a positive receipt before sending the second rapid stroke, with distinct revisions and receipts', async () => {
    const firstReply = deferred();
    const {client, server, sent, receipts} = await fixture({beforeCommand: async (_call, index) => {if (index === 1) await firstReply.promise;}});
    const first = client.edit(teacher, lesson, ink('stroke-a'));
    const second = client.edit(teacher, lesson, ink('stroke-b'));
    const settled = Promise.allSettled([first, second]);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(server.getDocument(teacher, lesson).objects).toEqual([]);
    expect(client.state.pending).toHaveLength(2);
    expect(client.state.status).not.toBe('confirmed');
    firstReply.release();
    expect((await settled).map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(sent.map(call => call.body.command.expectedRevision)).toEqual([1, 2]);
    expect(new Set(sent.map(call => call.body.command.commandId)).size).toBe(2);
    expect(receipts.map(receipt => receipt.documentRevision)).toEqual([2, 3]);
    expect(new Set(receipts.map(receipt => receipt.eventId)).size).toBe(2);
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['stroke-a', 'stroke-b']);
    expect(server.snapshot().receipts).toHaveLength(3);
    expect(server.snapshot().events).toHaveLength(3);
    expect(client.state.status).toBe('confirmed');
    expect(client.state.pending).toEqual([]);
  });

  it('does not send the queued stroke after an actual competing writer causes REVISION_CONFLICT', async () => {
    const hooks: TransportHooks = {};
    const {client, server, sent, external} = await fixture(hooks);
    hooks.beforeCommand = async (_call, index) => {if (index === 1) await external();};
    const results = await Promise.allSettled([
      client.edit(teacher, lesson, ink('stroke-a')),
      client.edit(teacher, lesson, ink('stroke-b')),
    ]);
    expect(results[0]).toMatchObject({status: 'rejected', reason: {code: 'REVISION_CONFLICT'}});
    expect(sent).toHaveLength(1);
    expect(results[1]?.status).toBe('rejected');
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['external']);
    expect(server.snapshot().events).toHaveLength(2);
    expect(client.state.pending.map(entry => entry.status)).toEqual(['conflict', 'blocked']);
    const [first, second] = client.state.pending;
    expect(first?.request).toMatchObject({command: {expectedRevision: 1}});
    expect(second?.request).toMatchObject({command: {expectedRevision: 2}});
    await client.refresh();
    expect(client.state.status).not.toBe('confirmed');
    await expect(client.resumePending(second!.commandId)).rejects.toBeDefined();
    expect(sent).toHaveLength(1);
  });

  it('recovers a committed command with the identical ID and receipt, then resumes the preserved successor only explicitly', async () => {
    const {client, server, sent, receipts} = await fixture({afterCommit: (_call, _receipt, index) => {
      if (index === 1) throw new TypeError('Synthetic response lost after real commit.');
    }});
    const results = await Promise.allSettled([
      client.edit(teacher, lesson, ink('stroke-a')),
      client.edit(teacher, lesson, ink('stroke-b')),
    ]);
    expect(results[0]).toMatchObject({status: 'rejected', reason: {code: 'NETWORK_ERROR'}});
    expect(results[1]?.status).toBe('rejected');
    expect(sent).toHaveLength(1);
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['stroke-a']);
    expect(server.snapshot().events).toHaveLength(2);
    expect(server.snapshot().receipts).toHaveLength(2);
    expect(client.core.getDocument(teacher, lesson).objects).toEqual([]);
    expect(client.state.pending.map(entry => entry.status)).toEqual(['uncertain', 'blocked']);
    const [first, second] = structuredClone(client.state.pending);
    expect(second?.request).toMatchObject({command: {expectedRevision: 2}});
    await expect(client.retryPending(second!.commandId)).rejects.toBeDefined();
    await expect(client.resumePending(second!.commandId)).rejects.toBeDefined();
    expect(sent).toHaveLength(1);
    await client.retryPending(first!.commandId);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(sent[0]?.accountId).toBe(account.id);
    expect(sent[0]?.body).not.toHaveProperty('actor');
    expect(receipts[1]).toEqual(receipts[0]);
    expect(server.snapshot().events).toHaveLength(2);
    expect(server.snapshot().receipts).toHaveLength(2);
    expect(client.state.pending).toHaveLength(1);
    expect(client.state.pending[0]?.status).toBe('blocked');
    expect(client.state.status).not.toBe('confirmed');
    await client.resumePending(second!.commandId);
    expect(sent).toHaveLength(3);
    expect(sent[2]?.body).toEqual(second!.request);
    expect(sent[2]?.accountId).toBe(account.id);
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['stroke-a', 'stroke-b']);
    expect(server.snapshot().events).toHaveLength(3);
    expect(server.snapshot().receipts).toHaveLength(3);
    expect(client.state.pending).toEqual([]);
    expect(client.state.status).toBe('confirmed');
  });

  it('does not continue an already queued authorized intent after rejecting an unauthorized actor', async () => {
    const {client, server, sent} = await fixture();
    const other: Actor = {actorId: 'foreign-teacher', role: 'teacher'};
    const results = await Promise.allSettled([
      client.edit(other, lesson, ink('forbidden')),
      client.edit(teacher, lesson, ink('queued-own')),
    ]);
    expect(results[0]).toMatchObject({status: 'rejected', reason: {code: 'INVALID_ACTOR'}});
    expect(sent).toEqual([]);
    expect(results[1]?.status).toBe('rejected');
    expect(server.getDocument(teacher, lesson).objects).toEqual([]);
    expect(server.snapshot().events).toHaveLength(1);
    expect(client.state.status).not.toBe('confirmed');
  });

  it('does not silently rebase the second queued intent onto a projection advanced by an external writer', async () => {
    const hooks: TransportHooks = {};
    const {client, server, sent, external} = await fixture(hooks);
    // Receipt 2 arrives with a genuine current projection already advanced to revision 3.
    hooks.afterCommit = async (_call, _receipt, index) => {if (index === 1) await external();};
    const results = await Promise.allSettled([
      client.edit(teacher, lesson, ink('stroke-a')),
      client.edit(teacher, lesson, ink('stroke-b')),
    ]);
    expect(results[0]?.status).toBe('fulfilled');
    expect(results[1]?.status).toBe('rejected');
    expect(sent.slice(1).every(call => call.body.command.expectedRevision === 2)).toBe(true);
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['stroke-a', 'external']);
    expect(server.snapshot().events).toHaveLength(3);
    expect(client.state.pending[0]?.request).toMatchObject({command: {expectedRevision: 2}});
    expect(client.state.status).not.toBe('confirmed');
  });

  it('captures the actor before a delayed predecessor allows caller-owned identity to change', async () => {
    const firstReply = deferred();
    const {client, sent} = await fixture({beforeCommand: async (_call, index) => {if (index === 1) await firstReply.promise;}});
    const mutableActor: Actor = {...teacher};
    const first = client.edit(teacher, lesson, ink('stroke-a'));
    const second = client.edit(mutableActor, lesson, ink('stroke-b'));
    const results = Promise.allSettled([first, second]);
    mutableActor.actorId = 'foreign-after-enqueue';
    await vi.waitFor(() => expect(sent).toHaveLength(1)); firstReply.release();
    expect((await results).map(result => result.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(sent.map(call => call.accountId)).toEqual([account.id, account.id]);
  });

  it('does not allow caller mutation of a captured stale draft to bypass its conflict', async () => {
    const hooks: TransportHooks = {};
    const {client, server, sent} = await fixture(hooks);
    const note = {id: 'note', type: 'note' as const, title: 'Nota', x: 0, y: 0, width: 200, height: 150, data: {text: 'original'}};
    await client.edit(teacher, lesson, {kind: 'add-object', object: note});
    const base = client.core.getDocument(teacher, lesson).objects[0] as EducationalObject;
    const firstReply = deferred();
    hooks.afterCommit = async (_call, _receipt, index) => {if (index === 2) await firstReply.promise;};
    const first = client.edit(teacher, lesson, {kind: 'replace-object', object: {...note, data: {text: 'newer'}}}, base);
    const stale = client.edit(teacher, lesson, {kind: 'replace-object', object: {...note, data: {text: 'stale overwrite'}}}, base);
    const results = Promise.allSettled([first, stale]);
    await vi.waitFor(() => expect(server.getDocument(teacher, lesson).revision).toBe(3));
    Object.assign(base, structuredClone(server.getDocument(teacher, lesson).objects[0]));
    firstReply.release();
    const outcomes = await results;
    expect(outcomes[0]?.status).toBe('fulfilled');
    expect(outcomes[1]).toMatchObject({status: 'rejected', reason: {code: 'REVISION_CONFLICT'}});
    expect(sent).toHaveLength(2);
    expect(server.getDocument(teacher, lesson).objects[0]?.data).toEqual({text: 'newer'});
  });

  it('assigns command IDs before waiting for the preceding receipt', async () => {
    const firstReply = deferred();
    const {client} = await fixture({beforeCommand: async (_call, index) => {if (index === 1) await firstReply.promise;}});
    const nextId = vi.spyOn(crypto, 'randomUUID');
    let results: Promise<PromiseSettledResult<void>[]> | undefined;
    try {
      const before = nextId.mock.calls.length;
      const first = client.edit(teacher, lesson, ink('stroke-a'));
      const second = client.edit(teacher, lesson, ink('stroke-b'));
      results = Promise.allSettled([first, second]);
      expect(nextId.mock.calls.length - before).toBe(2);
      expect(client.state.pending.map(entry => entry.commandId)).toHaveLength(2);
      expect(new Set(client.state.pending.map(entry => entry.commandId)).size).toBe(2);
    } finally {
      firstReply.release(); if (results) await results; nextId.mockRestore();
    }
  });

  it('restores unsent successors without changing their payloads or automatically resuming after a reload', async () => {
    const {client, server, sent, open} = await fixture({afterCommit: (_call, _receipt, index) => {
      if (index === 1) throw new TypeError('Synthetic lost response.');
    }});
    await Promise.allSettled([client.edit(teacher, lesson, ink('stroke-a')), client.edit(teacher, lesson, ink('stroke-b'))]);
    const originals = structuredClone(client.state.pending);
    const reopened = await open();
    expect(sent).toHaveLength(1);
    expect(reopened.state.pending.map(entry => ({id: entry.commandId, request: entry.request})))
      .toEqual(originals.map(entry => ({id: entry.commandId, request: entry.request})));
    expect(reopened.state.pending.map(entry => entry.status)).toEqual(['uncertain', 'blocked']);
    expect(reopened.state.status).not.toBe('confirmed');
    await reopened.retryPending(originals[0]!.commandId);
    expect(sent).toHaveLength(2);
    expect(reopened.state.pending[0]?.status).toBe('blocked');
    await reopened.resumePending(originals[1]!.commandId);
    expect(sent).toHaveLength(3);
    expect(sent[2]?.body).toEqual(originals[1]!.request);
    expect(server.snapshot().events).toHaveLength(3);
    expect(server.snapshot().receipts).toHaveLength(3);
    expect(reopened.state.pending).toEqual([]);
  });

  it('invalidates the old automatic queue even after logout and immediate login to the same account', async () => {
    const firstReply = deferred();
    const {client, server, sent} = await fixture({beforeCommand: async (_call, index) => {if (index === 1) await firstReply.promise;}});
    const results = Promise.allSettled([client.edit(teacher, lesson, ink('stroke-a')), client.edit(teacher, lesson, ink('stroke-b'))]);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const originalIds = client.state.pending.map(entry => entry.commandId);
    await client.logout();
    await client.login('synthetic', 'synthetic-password'); await client.openWorkspace(workspace);
    firstReply.release();
    expect((await results).map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(sent).toHaveLength(1);
    expect(client.state.pending.map(entry => entry.commandId)).toEqual(originalIds);
    expect(client.state.pending.map(entry => entry.status)).toEqual(['uncertain', 'blocked']);
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['stroke-a']);
    expect(client.state.status).not.toBe('confirmed');
  });

  it('does not expose or send account A queued intents from account B', async () => {
    const firstReply = deferred();
    const {client, server, sent, addWorkspace, setAccount, values} = await fixture({beforeCommand: async (_call, index) => {if (index === 1) await firstReply.promise;}});
    const other = {id: 'teacher-b', role: 'teacher' as const, displayName: 'Secondo docente sintetico'};
    const otherCore = await addWorkspace('workspace-b', other);
    const results = Promise.allSettled([client.edit(teacher, lesson, ink('stroke-a')), client.edit(teacher, lesson, ink('stroke-b'))]);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const secondId = client.state.pending[1]!.commandId;
    await client.logout(); setAccount(other);
    await client.login('other', 'synthetic-password'); await client.openWorkspace('workspace-b');
    firstReply.release();
    expect((await results).map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(sent).toHaveLength(1);
    expect(client.state.pending).toEqual([]);
    expect(client.exportPendingRecovery()).toBeNull();
    await expect(client.resumePending(secondId)).rejects.toBeDefined();
    expect(sent).toHaveLength(1);
    expect(otherCore.getDocument({actorId: other.id, role: other.role}, lesson).objects).toEqual([]);
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['stroke-a']);
    expect(JSON.parse(values.get(account.id)!)).toHaveLength(2);
  });

  it('does not redirect queued writes to another selected workspace with identical document IDs', async () => {
    const firstReply = deferred();
    const {client, server, sent, addWorkspace} = await fixture({beforeCommand: async (_call, index) => {if (index === 1) await firstReply.promise;}});
    const otherCore = await addWorkspace('workspace-b');
    const results = Promise.allSettled([client.edit(teacher, lesson, ink('stroke-a')), client.edit(teacher, lesson, ink('stroke-b'))]);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const secondId = client.state.pending[1]!.commandId;
    await client.openWorkspace('workspace-b'); firstReply.release();
    const outcomes = await results;
    expect(outcomes[1]?.status).toBe('rejected');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body.workspaceId).toBe(workspace);
    expect(otherCore.getDocument(teacher, lesson).objects).toEqual([]);
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['stroke-a']);
    await expect(client.resumePending(secondId)).rejects.toBeDefined();
    expect(sent).toHaveLength(1);
    expect(client.state.pending.some(entry => entry.commandId === secondId && entry.status === 'blocked')).toBe(true);
    expect(client.state.status).not.toBe('confirmed');
  });
});
