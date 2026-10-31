import {describe, expect, it} from 'vitest';
import {createCore, MemoryStorage} from '@ardesia/core';
import type {Actor} from '@ardesia/contracts';
import {edit, type EditCommand} from './workspace';

const teacher: Actor = {actorId: 'teacher-a', role: 'teacher'};

async function fixture() {
  const core = await createCore({storage: new MemoryStorage()});
  await core.execute(teacher, {
    kind: 'create-document', commandId: 'setup-lesson', documentId: 'lesson-1',
    expectedRevision: 0, title: 'Tratti rapidi',
  });
  return core;
}

function ink(id: string): EditCommand {
  return {
    kind: 'add-object', object: {
      id, type: 'ink', title: 'Tratto', x: 10, y: 20, width: 80, height: 80,
      data: {points: [{x: 12, y: 22, pressure: 0.5}], color: '#151515', width: 2},
    },
  };
}

describe('M3 authenticated workspace edits', () => {
  it('captures each queued intent before caller-owned objects can change', async () => {
    const core = await fixture();
    const first = edit(core, teacher, 'lesson-1', ink('first'));
    const command = ink('second');
    const second = edit(core, teacher, 'lesson-1', command);
    if (command.kind !== 'add-object' || command.object.type !== 'ink') throw Error('Invalid test intent');
    command.object.title = 'Changed after enqueue';
    command.object.data.points[0]!.x = 999;
    await Promise.all([first, second]);
    expect(core.getDocument(teacher, 'lesson-1').objects[1]).toMatchObject({
      id: 'second', title: 'Tratto', data: {points: [{x: 12, y: 22, pressure: 0.5}]},
    });
  });
  it('preserves two unawaited pen strokes and their distinct Core revisions', async () => {
    const core = await fixture();
    const first = edit(core, teacher, 'lesson-1', ink('stroke-a'));
    const second = edit(core, teacher, 'lesson-1', ink('stroke-b'));
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);

    const saved = core.getDocument(teacher, 'lesson-1');
    expect(saved.objects.map(object => object.id)).toEqual(['stroke-a', 'stroke-b']);
    expect(saved.revision).toBe(3);
    expect(core.snapshot().events).toHaveLength(3);
    expect(core.snapshot().receipts).toHaveLength(3);
  });

  it('does not poison the queue when an unauthorized actor is rejected', async () => {
    const core = await fixture();
    const other: Actor = {actorId: 'other-teacher', role: 'teacher'};
    const forbidden = edit(core, other, 'lesson-1', ink('foreign-stroke'));
    const valid = edit(core, teacher, 'lesson-1', ink('own-stroke'));
    const results = await Promise.allSettled([forbidden, valid]);

    expect(results[0]).toMatchObject({status: 'rejected', reason: {code: 'NOT_FOUND'}});
    expect(results[1]).toMatchObject({status: 'fulfilled'});
    const saved = core.getDocument(teacher, 'lesson-1');
    expect(saved.objects.map(object => object.id)).toEqual(['own-stroke']);
    expect(saved.revision).toBe(2);
    expect(core.snapshot().events).toHaveLength(2);
  });

  it('still rejects a stale object draft rather than overwriting a newer edit', async () => {
    const core = await fixture();
    const note = {
      id: 'note-1', type: 'note' as const, title: 'Nota', x: 10, y: 20,
      width: 220, height: 160, data: {text: 'originale'},
    };
    await edit(core, teacher, 'lesson-1', {kind: 'add-object', object: note});
    const base = core.getDocument(teacher, 'lesson-1').objects.find(object => object.id === note.id);
    if (!base) throw new Error('Missing fixture note');

    const first = edit(core, teacher, 'lesson-1',
      {kind: 'replace-object', object: {...note, data: {text: 'corretto'}}}, base);
    const stale = edit(core, teacher, 'lesson-1',
      {kind: 'replace-object', object: {...note, data: {text: 'vecchia bozza'}}}, base);
    const results = await Promise.allSettled([first, stale]);

    expect(results[0]).toMatchObject({status: 'fulfilled'});
    expect(results[1]).toMatchObject({status: 'rejected', reason: {code: 'REVISION_CONFLICT'}});
    const saved = core.getDocument(teacher, 'lesson-1');
    expect(saved.objects.find(object => object.id === note.id)?.data).toEqual({text: 'corretto'});
    expect(saved.revision).toBe(3);
  });
});
