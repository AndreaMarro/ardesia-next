import {describe, expect, it} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {browserOfflineStore, parseOfflineSnapshot, type LegacyOfflineSnapshot, type OfflineSnapshot} from './offline';
import {browserOfflineStore as oldOfflineStore} from './fixtures/offline-v1-013221f';

const legacy: LegacyOfflineSnapshot = {format: 'ardesia-own-lessons-v1', account: {id: 'account', role: 'student', displayName: 'Studente'},
  workspaceId: 'space', title: 'Quaderno personale', workspaceRevision: 5, actor: {actorId: 'owner', role: 'student'},
  documents: [{id: 'page-doc', ownerId: 'owner', title: 'Pagina', revision: 1, status: 'draft', objects: [], connections: [],
    createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z'}], savedAt: '2026-11-08T00:00:00.000Z'};
const current: OfflineSnapshot = {...legacy, format: 'ardesia-own-lessons-v2', notebookSpace: {revision: 1, notebooks: [
  {id: 'book', title: 'Fisica', archived: false, sections: [{id: 'section', title: 'Forze', archived: false, pages: [
    {id: 'page', documentId: 'page-doc', archived: false, layout: {format: 'a4', orientation: 'portrait', background: 'ruled', paper: 'ivory'}},
  ]}]},
]}};
async function stored(factory: IDBFactory) {
  return new Promise<unknown>((resolve, reject) => {
    const request = factory.open('ardesia-next.offline.v1'); request.onerror = () => reject(request.error);
    request.onsuccess = () => {const db = request.result, tx = db.transaction('local'), get = tx.objectStore('local').get(['snapshot', 'account', 'space']);
      tx.oncomplete = () => {db.close(); resolve(get.result);}; tx.onabort = () => {db.close(); reject(tx.error);};};
  });
}

describe('notebook offline version boundary', () => {
  it('cold-reads actual v1 bytes without rewriting them or inventing an empty catalog', async () => {
    const factory = new IDBFactory(), old = oldOfflineStore(factory), gate = await old.gate();
    await old.confirm(gate.generation, 'account', 'student', true); await old.save(gate.generation, legacy, true);
    const before = await stored(factory), copy = await browserOfflineStore(factory).load();
    expect(copy!.snapshot).toEqual({...legacy, format: 'ardesia-own-lessons-v2', notebookSpace: null});
    expect(await stored(factory)).toEqual(before); expect(before).toEqual(legacy);
  });

  it('enriches only the missing catalog at the same revision, then prevents erasure or divergent data', async () => {
    const factory = new IDBFactory(), old = oldOfflineStore(factory), gate = await old.gate();
    await old.confirm(gate.generation, 'account', 'student', true); await old.save(gate.generation, legacy, true);
    const store = browserOfflineStore(factory);
    await expect(store.save(gate.generation, {...current, title: 'Changed at the same revision'})).rejects.toBeDefined();
    expect(await stored(factory)).toEqual(legacy);
    await store.save(gate.generation, current); expect(await stored(factory)).toEqual(current);
    for (const stale of [legacy, {...legacy, workspaceRevision: 6}, {...current, notebookSpace: null, workspaceRevision: 6}]) {
      await expect(store.save(gate.generation, stale)).rejects.toBeDefined(); expect(await stored(factory)).toEqual(current);
    }
    await expect(store.save(gate.generation, {...current, documents: []})).rejects.toBeDefined();
    expect(await stored(factory)).toEqual(current);
  });

  it('the actual previous reader refuses v2 reads and writes without overwriting the newer archive', async () => {
    const factory = new IDBFactory(), store = browserOfflineStore(factory), gate = await store.gate();
    await store.confirm(gate.generation, 'account', 'student', true); await store.save(gate.generation, current, true);
    const old = oldOfflineStore(factory);
    await expect(old.load()).rejects.toBeDefined();
    await expect(old.save(gate.generation, {...legacy, workspaceRevision: 100}, true)).rejects.toBeDefined();
    expect(await stored(factory)).toEqual(current); expect((await store.load())!.snapshot).toEqual(current);
  });

  it('rejects relabelled v2, missing v2 fields and page references outside the personal copy', () => {
    expect(() => parseOfflineSnapshot({...current, format: 'ardesia-own-lessons-v1'})).toThrow();
    expect(() => parseOfflineSnapshot({...legacy, format: 'ardesia-own-lessons-v2'})).toThrow();
    expect(() => parseOfflineSnapshot({...current, documents: []})).toThrow();
    expect(() => parseOfflineSnapshot({...current, documents: [{...current.documents[0], ownerId: 'other'}]})).toThrow();
  });
});
