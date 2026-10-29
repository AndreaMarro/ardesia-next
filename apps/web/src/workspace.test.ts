import {describe, expect, it} from 'vitest';
import {createCore, MemoryStorage} from '@ardesia/core';
import {edit, localActor, type EditCommand} from './workspace';

async function lesson() {
  const core = await createCore({storage: new MemoryStorage()});
  await core.execute(localActor, {
    kind: 'create-document', commandId: 'setup-lesson', documentId: 'lesson-1',
    expectedRevision: 0, title: 'Prova penna',
  });
  return core;
}

function ink(id: string): EditCommand {
  return {
    kind: 'add-object',
    object: {
      id, type: 'ink', title: 'Tratto sulla lavagna', x: 10, y: 20,
      width: 80, height: 80,
      data: {points: [{x: 12, y: 22, pressure: 0.5}], color: '#151515', width: 2},
    },
  };
}

describe('workspace edit queue', () => {
  it('persists two rapid ink strokes without discarding the second revision', async () => {
    const core = await lesson();
    // The UI intentionally does not await the previous pointerup handler.
    const first = edit(core, 'lesson-1', ink('stroke-a'));
    const second = edit(core, 'lesson-1', ink('stroke-b'));
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
    const saved = core.getDocument(localActor, 'lesson-1');
    expect(saved.objects.map(object => object.id)).toEqual(['stroke-a', 'stroke-b']);
    expect(saved.revision).toBe(3);
    expect(core.snapshot().events).toHaveLength(3);
    expect(core.snapshot().receipts).toHaveLength(3);
  });

  it('retains a later valid stroke when an earlier intent is rejected', async () => {
    const core = await lesson();
    const invalid = edit(core, 'lesson-1', {
      kind: 'connect-objects',
      connection: {id: 'invalid-edge', from: 'missing-a', to: 'missing-b', label: ''},
    });
    const valid = edit(core, 'lesson-1', ink('stroke-after-error'));
    const outcomes = await Promise.allSettled([invalid, valid]);
    expect(outcomes[0]).toMatchObject({status: 'rejected', reason: {code: 'NOT_FOUND'}});
    expect(outcomes[1]).toMatchObject({status: 'fulfilled'});
    const saved = core.getDocument(localActor, 'lesson-1');
    expect(saved.objects.map(object => object.id)).toEqual(['stroke-after-error']);
    expect(saved.revision).toBe(2);
    expect(core.snapshot().events).toHaveLength(2);
  });
});
