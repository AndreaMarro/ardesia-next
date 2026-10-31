import {describe, expect, it} from 'vitest';
import type {Actor} from '@ardesia/contracts';
import {fixture, ink, lesson, teacher} from './workspace-queue-fixture';

describe('M3 authenticated workspace edits', () => {
  it('captures each queued intent before caller-owned objects can change', async () => {
    const {client, server} = await fixture();
    const first = client.edit(teacher, lesson, ink('first'));
    const command = ink('second');
    const second = client.edit(teacher, lesson, command);
    if (command.kind !== 'add-object' || command.object.type !== 'ink') throw Error('Invalid test intent');
    command.object.title = 'Changed after enqueue';
    command.object.data.points[0]!.x = 999;
    await Promise.all([first, second]);
    expect(server.getDocument(teacher, lesson).objects[1]).toMatchObject({
      id: 'second', title: 'second', data: {points: [{x: 10, y: 20, pressure: 0.5}]},
    });
  });

  it('preserves two unawaited pen strokes and their distinct Core revisions', async () => {
    const {client, server} = await fixture();
    const first = client.edit(teacher, lesson, ink('stroke-a'));
    const second = client.edit(teacher, lesson, ink('stroke-b'));
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    const saved = server.getDocument(teacher, lesson);
    expect(saved.objects.map(object => object.id)).toEqual(['stroke-a', 'stroke-b']);
    expect(saved.revision).toBe(3);
    expect(server.snapshot().events).toHaveLength(3);
    expect(server.snapshot().receipts).toHaveLength(3);
  });

  it('blocks the queue when an unauthorized actor is rejected, including a later authorized intent', async () => {
    const {client, server, sent} = await fixture();
    const other: Actor = {actorId: 'other-teacher', role: 'teacher'};
    const forbidden = client.edit(other, lesson, ink('foreign-stroke'));
    const valid = client.edit(teacher, lesson, ink('own-stroke'));
    const results = await Promise.allSettled([forbidden, valid]);
    expect(results[0]).toMatchObject({status: 'rejected', reason: {code: 'INVALID_ACTOR'}});
    expect(results[1]?.status).toBe('rejected');
    expect(sent).toEqual([]);
    const saved = server.getDocument(teacher, lesson);
    expect(saved.objects).toEqual([]);
    expect(saved.revision).toBe(1);
    expect(server.snapshot().events).toHaveLength(1);
    expect(client.state.status).not.toBe('confirmed');
  });

  it('still rejects a stale object draft rather than overwriting a newer edit', async () => {
    const {client, server} = await fixture();
    const note = {id: 'note-1', type: 'note' as const, title: 'Nota', x: 10, y: 20,
      width: 220, height: 160, data: {text: 'originale'}};
    await client.edit(teacher, lesson, {kind: 'add-object', object: note});
    const base = client.core.getDocument(teacher, lesson).objects.find(object => object.id === note.id);
    if (!base) throw new Error('Missing fixture note');
    const first = client.edit(teacher, lesson,
      {kind: 'replace-object', object: {...note, data: {text: 'corretto'}}}, base);
    const stale = client.edit(teacher, lesson,
      {kind: 'replace-object', object: {...note, data: {text: 'vecchia bozza'}}}, base);
    const results = await Promise.allSettled([first, stale]);
    expect(results[0]?.status).toBe('fulfilled');
    expect(results[1]).toMatchObject({status: 'rejected', reason: {code: 'REVISION_CONFLICT'}});
    const saved = server.getDocument(teacher, lesson);
    expect(saved.objects.find(object => object.id === note.id)?.data).toEqual({text: 'corretto'});
    expect(saved.revision).toBe(3);
    expect(client.state.status).not.toBe('confirmed');
  });
});
