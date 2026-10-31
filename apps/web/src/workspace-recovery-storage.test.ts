import {describe, expect, it} from 'vitest';
import {account, fixture, ink, lesson, teacher, workspace} from './workspace-queue-fixture';

describe('P0 recovery storage failures preserve the write barrier', () => {
  it('keeps the first intent blocked when its initial recovery write fails, and requires explicit recovery for both strokes', async () => {
    const {client, server, storage, sent} = await fixture();
    const originalWrite = storage.write;
    let writes = 0;
    storage.write = (id, value) => {
      if (++writes === 1) throw new Error('Synthetic recovery write failure.');
      originalWrite(id, value);
    };

    const results = await Promise.allSettled([
      client.edit(teacher, lesson, ink('first')),
      client.edit(teacher, lesson, ink('second')),
    ]);
    expect(results[0]).toMatchObject({status: 'rejected', reason: {code: 'RECOVERY_STORAGE_FAILURE'}});
    expect(results[1]?.status).toBe('rejected');
    expect(sent).toHaveLength(0);
    expect(server.getDocument(teacher, lesson).objects).toEqual([]);
    expect(client.state.pending.map(entry => entry.status)).toEqual(['blocked', 'blocked']);
    expect(client.state.status).not.toBe('confirmed');
    const originals = structuredClone(client.state.pending);
    expect(originals.map(entry => entry.request)).toMatchObject([
      {command: {expectedRevision: 1, object: {id: 'first'}}},
      {command: {expectedRevision: 2, object: {id: 'second'}}},
    ]);
    expect(JSON.parse(client.exportPendingRecovery()!)).toHaveLength(2);

    await client.resumePending(originals[0]!.commandId);
    expect(sent).toHaveLength(1);
    expect(client.state.pending[0]?.status).toBe('blocked');
    expect(client.state.status).not.toBe('confirmed');
    await client.resumePending(originals[1]!.commandId);
    expect(sent.map(call => call.body)).toEqual(originals.map(entry => entry.request));
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['first', 'second']);
    expect(server.snapshot().receipts).toHaveLength(3);
    expect(server.snapshot().events).toHaveLength(3);
    expect(client.state.status).toBe('confirmed');
  });

  it('keeps an unsent second stroke when its recovery write fails while the first stroke completes', async () => {
    const {client, server, storage, sent} = await fixture();
    const originalWrite = storage.write;
    let writes = 0;
    storage.write = (id, value) => {
      if (++writes === 2) throw new Error('Synthetic second recovery write failure.');
      originalWrite(id, value);
    };

    const results = await Promise.allSettled([
      client.edit(teacher, lesson, ink('first')),
      client.edit(teacher, lesson, ink('second')),
    ]);
    expect(results[0]?.status).toBe('fulfilled');
    expect(results[1]).toMatchObject({status: 'rejected', reason: {code: 'RECOVERY_STORAGE_FAILURE'}});
    expect(sent).toHaveLength(1);
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['first']);
    expect(client.state.pending).toHaveLength(1);
    expect(client.state.pending[0]).toMatchObject({status: 'blocked', request: {command: {expectedRevision: 2, object: {id: 'second'}}}});
    expect(client.state.status).not.toBe('confirmed');
    const second = structuredClone(client.state.pending[0]!);
    await client.resumePending(second.commandId);
    expect(sent[1]?.body).toEqual(second.request);
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['first', 'second']);
    expect(server.snapshot().events).toHaveLength(3);
    expect(client.state.status).toBe('confirmed');
  });

  it('keeps unsent intents in account-scoped memory across logout when recovery storage remains unavailable', async () => {
    const {client, server, storage, sent} = await fixture();
    const originalWrite = storage.write;
    storage.write = () => {throw new Error('Synthetic persistent quota failure.');};
    await Promise.allSettled([
      client.edit(teacher, lesson, ink('first')),
      client.edit(teacher, lesson, ink('second')),
    ]);
    expect(sent).toHaveLength(0);
    expect(client.state.pending).toHaveLength(2);
    expect(client.state.recovery).toBe('memory');
    const originals = structuredClone(client.state.pending);
    expect(JSON.parse(client.exportPendingRecovery()!).map((entry: {commandId: string}) => entry.commandId))
      .toEqual(originals.map(entry => entry.commandId));

    await client.logout();
    await client.login('synthetic', 'synthetic-password');
    await client.openWorkspace(workspace);
    expect(sent).toHaveLength(0);
    expect(client.state.pending.map(entry => ({id: entry.commandId, request: entry.request})))
      .toEqual(originals.map(entry => ({id: entry.commandId, request: entry.request})));
    expect(client.state.pending.map(entry => entry.status)).toEqual(['blocked', 'blocked']);
    expect(client.state.recovery).toBe('memory');
    expect(client.state.status).not.toBe('confirmed');
    expect(server.getDocument(teacher, lesson).objects).toEqual([]);

    storage.write = originalWrite;
    await client.resumePending(originals[0]!.commandId);
    expect(sent).toHaveLength(1);
    await client.resumePending(originals[1]!.commandId);
    expect(sent.map(call => call.body)).toEqual(originals.map(entry => entry.request));
    expect(client.state.pending).toEqual([]);
    expect(client.state.recovery).toBe('durable');
    expect(server.snapshot().receipts).toHaveLength(3);
  });

  it('uses an empty memory override after cleanup fails so a confirmed command is not resurrected at the next login', async () => {
    const {client, server, storage, sent, values} = await fixture();
    storage.remove = () => {throw new Error('Synthetic recovery cleanup failure.');};
    await client.edit(teacher, lesson, ink('first'));

    expect(sent).toHaveLength(1);
    expect(server.getDocument(teacher, lesson).objects.map(object => object.id)).toEqual(['first']);
    expect(client.state.pending).toEqual([]);
    // The durable bytes are deliberately stale. The same client must remember
    // that its positive receipt already removed this command from recovery.
    expect(JSON.parse(values.get(account.id)!)).toHaveLength(1);
    expect(client.state.recovery).toBe('memory');
    expect(JSON.parse(client.exportPendingRecovery()!)).toEqual([]);

    await client.logout();
    await client.login('synthetic', 'synthetic-password');
    await client.openWorkspace(workspace);
    expect(client.state.pending).toEqual([]);
    expect(client.state.recovery).toBe('memory');
    expect(JSON.parse(client.exportPendingRecovery()!)).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(server.snapshot().events).toHaveLength(2);
    expect(server.snapshot().receipts).toHaveLength(2);
  });
});
