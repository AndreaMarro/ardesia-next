import {describe, expect, it, vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {MaterialManifestSchema, materialPage} from '@ardesia/contracts';
import {browserOfflineStore, browserInkDraftStorage, createRemoteClient, OfflineError, type OfflineStore} from '@ardesia/remote-client';
import {account, deferred, fixture, ink, lesson, teacher, workspace, type TransportHooks} from './workspace-queue-fixture';

const stroke = (id: string) => {const command = ink(id); if (command.kind !== 'add-object' || command.object.type !== 'ink') throw Error('Ink fixture required'); return command.object;};
async function setup(hooks: TransportHooks = {}) {
  const f = await fixture(hooks), factory = new IDBFactory(), cache = browserOfflineStore(factory);
  const network = {online: true, calls: [] as string[]};
  const transport: typeof fetch = async (url, init) => {
    network.calls.push(JSON.parse(String(init?.body)).action);
    if (!network.online) throw new TypeError('Synthetic disconnection');
    return f.fetcher(url, init);
  };
  const newClient = (store = cache, fetcher = transport) => createRemoteClient({offlineStore: store, pendingStorage: f.storage, fetch: fetcher});
  const client = newClient();
  await client.login('synthetic', 'synthetic'); await client.openWorkspace(workspace); await client.makeAvailableOffline();
  return {...f, client, cache, factory, network, newClient, transport};
}
async function rawStore(factory: IDBFactory, action: (store: IDBObjectStore) => void) {
  await new Promise<void>((resolve, reject) => {
    const request = factory.open('ardesia-next.offline.v1', 1);
    request.onsuccess = () => {const db = request.result, tx = db.transaction('local', 'readwrite'); action(tx.objectStore('local'));
      tx.oncomplete = () => {db.close(); resolve();}; tx.onabort = () => {db.close(); reject(tx.error);};};
    request.onerror = () => reject(request.error);
  });
}

describe('own lessons offline with original Core recovery', () => {
  it('an ACK during offline loading keeps its command until the updated copy is durable', async () => {
    const f = await setup(), loadHeld = deferred(), saveHeld = deferred();
    let loading = false, saving = false, delay = false;
    const store: OfflineStore = {...f.cache,
      load: async () => {const old = await f.cache.load(); if (delay) {loading = true; await loadHeld.promise;} return old;},
      save: async (generation, snapshot, enable) => {if (delay && snapshot.workspaceRevision === 2) {saving = true; await saveHeld.promise;} return f.cache.save(generation, snapshot, enable);}};
    const c = f.newClient(store); await c.session(); await c.openWorkspace(workspace); delay = true;
    const opening = c.openOffline(); await vi.waitFor(() => expect(loading).toBe(true));
    const edit = c.edit(teacher, lesson, ink('ack-during-load')).catch(error => error);
    await vi.waitFor(() => expect(saving).toBe(true)); loadHeld.release();
    await new Promise(resolve => setTimeout(resolve, 0));
    const retained = c.state.pending.some(p => p.request.action === 'command' && p.request.command.kind === 'add-object' && p.request.command.object.id === 'ack-during-load');
    const visible = c.offline?.documents[0]?.objects.some(o => o.id === 'ack-during-load');
    delay = false; saveHeld.release(); await edit; await opening;
    expect(retained || visible).toBe(true);
    expect(c.offline?.documents[0]?.objects.map(o => o.id)).toContain('ack-during-load');
  });

  it('first availability includes a confirmation received while the first snapshot is being saved', async () => {
    const f = await fixture(), cache = browserOfflineStore(new IDBFactory()), held = deferred(); let saving = false;
    const c = createRemoteClient({fetch: f.fetcher, pendingStorage: f.storage, offlineStore: {...cache,
      save: async (generation, snapshot, enable) => {if (enable && snapshot.workspaceRevision === 1) {saving = true; await held.promise;} return cache.save(generation, snapshot, enable);}}});
    await c.login('synthetic', 'synthetic'); await c.openWorkspace(workspace);
    const preparing = c.makeAvailableOffline(); await vi.waitFor(() => expect(saving).toBe(true));
    const edit = c.edit(teacher, lesson, ink('ack-during-enable'));
    await vi.waitFor(() => expect(c.projection?.workspaceRevision).toBe(2)); held.release();
    await edit; await preparing; await c.openOffline();
    expect(c.offline?.documents[0]?.objects.map(o => o.id)).toContain('ack-during-enable');
  });

  it('failed snapshot persistence retains the acknowledged command across cold boot for an identical retry', async () => {
    const f = await setup(); let failSave = true;
    const store: OfflineStore = {...f.cache, save: async (generation, snapshot, enable) => {
      if (failSave && snapshot.workspaceRevision === 2) throw new OfflineError('OFFLINE_STORAGE_FAILURE', 'Synthetic quota');
      return f.cache.save(generation, snapshot, enable);
    }};
    const c = f.newClient(store); await c.session(); await c.openWorkspace(workspace);
    await c.edit(teacher, lesson, ink('ack-not-cached')).catch(() => undefined);
    expect(f.server.getDocument(teacher, lesson).objects.map(o => o.id)).toContain('ack-not-cached');
    expect(c.state.pending).toHaveLength(1);
    await expect(c.openOffline()).rejects.toBeDefined();
    f.network.online = false; const cold = f.newClient(store); await expect(cold.session()).rejects.toBeDefined(); await cold.openOffline();
    expect(cold.state.pending).toHaveLength(1); const request = cold.state.pending[0]!;
    failSave = false; f.network.online = true; await cold.reconnect(); await cold.retryPending(request.commandId);
    expect(f.sent[1]).toEqual(f.sent[0]); expect(f.server.snapshot().events).toHaveLength(2); expect(cold.state.pending).toEqual([]);
    await cold.openOffline(); expect(cold.offline?.documents[0]?.objects.map(o => o.id)).toContain('ack-not-cached');
  });

  it('cold-opens without a session, keeps pressure/IDs through another cold-open, and confirms only through real Core receipts', async () => {
    const f = await setup(); f.network.online = false;
    const cold = f.newClient(); await expect(cold.session()).rejects.toMatchObject({code: 'NETWORK_ERROR'}); await cold.openOffline();
    expect(cold.account).toBeNull(); expect(cold.projection).toBeNull(); expect(cold.state.status).toBe('offline');
    expect(() => cold.core.getDocument(teacher, lesson)).toThrow();
    const first = stroke('offline-a'); first.data.points = [{x: 1, y: 2, pressure: .2}, {x: 20, y: 30, pressure: .9}];
    const calls = [...f.network.calls];
    await cold.queueOfflineInk(lesson, first); await cold.queueOfflineInk(lesson, stroke('offline-b'));
    expect(f.network.calls).toEqual(calls); expect(cold.offline?.documents[0]?.revision).toBe(1);
    expect(f.server.getDocument(teacher, lesson).objects).toEqual([]);
    const original = structuredClone(cold.state.pending);
    const reopened = f.newClient(); await expect(reopened.session()).rejects.toMatchObject({code: 'NETWORK_ERROR'}); await reopened.openOffline();
    expect(reopened.state.pending.map(p => [p.commandId, p.request, p.edit])).toEqual(original.map(p => [p.commandId, p.request, p.edit]));
    await expect(reopened.retryPending(original[0]!.commandId)).rejects.toMatchObject({code: 'UNAUTHENTICATED'});
    await expect(reopened.resumePending(original[0]!.commandId)).rejects.toMatchObject({code: 'UNAUTHENTICATED'});
    f.network.online = true; await reopened.reconnect(); expect(f.sent).toHaveLength(0);
    await expect(reopened.resumePending(original[1]!.commandId)).rejects.toBeDefined();
    await reopened.resumePending(original[0]!.commandId); expect(f.sent).toHaveLength(1);
    expect(reopened.state.pending[0]?.status).toBe('blocked');
    await reopened.resumePending(original[1]!.commandId);
    expect(f.sent.map(s => s.body)).toEqual(original.map(p => p.request));
    expect(f.server.getDocument(teacher, lesson).objects[0]?.type).toBe('ink');
    expect(f.server.getDocument(teacher, lesson).objects[0]?.data).toEqual(first.data);
    expect(f.server.snapshot().events).toHaveLength(3); expect(f.server.snapshot().receipts).toHaveLength(3);
    expect(reopened.state.status).toBe('confirmed'); expect(reopened.state.pending).toEqual([]);
  });

  it('a lost real commit is recovered identically before its offline successor is released', async () => {
    const f = await setup({afterCommit: (_call, _receipt, index) => {if (index === 1) throw new TypeError('Lost after real Core commit');}});
    await expect(f.client.edit(teacher, lesson, ink('uncertain'))).rejects.toMatchObject({code: 'NETWORK_ERROR'});
    f.network.online = false; await f.client.openOffline(); await f.client.queueOfflineInk(lesson, stroke('successor'));
    const [first, second] = f.client.state.pending;
    expect(f.server.snapshot().events).toHaveLength(2);
    const cold = f.newClient(); await expect(cold.session()).rejects.toBeDefined(); await cold.openOffline();
    f.network.online = true; await cold.reconnect();
    await expect(cold.resumePending(second!.commandId)).rejects.toBeDefined();
    await cold.retryPending(first!.commandId); expect(f.sent[1]).toEqual(f.sent[0]); expect(f.server.snapshot().events).toHaveLength(2);
    expect(cold.state.pending[0]?.status).toBe('blocked');
    await cold.resumePending(second!.commandId); expect(f.server.snapshot().events).toHaveLength(3);
  });

  it('an actual competing revision preserves unsent drafts without sending or rebasing', async () => {
    const f = await setup(); await f.client.openOffline(); await f.client.queueOfflineInk(lesson, stroke('offline'));
    const pending = f.client.state.pending[0]!; await f.external(); await f.client.reconnect();
    await expect(f.client.resumePending(pending.commandId)).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    expect(f.sent).toHaveLength(0); expect(f.client.state.pending[0]?.request).toEqual(pending.request);
    expect(f.server.getDocument(teacher, lesson).objects.map(o => o.id)).toEqual(['external']);
  });

  it('persists logout while disconnected, rejects stale cache writes and ink, but retains account-scoped recovery', async () => {
    const f = await setup(), before = (await f.cache.load())!;
    await f.client.openOffline(); await f.client.queueOfflineInk(lesson, stroke('retained'));
    const other = f.newClient(); f.network.online = false; await expect(other.session()).rejects.toBeDefined(); await other.openOffline();
    await expect(f.client.logout()).rejects.toMatchObject({code: 'NETWORK_ERROR'});
    expect(await f.cache.load()).toBeNull(); expect(f.values.get(account.id)).toContain('retained');
    await expect(other.queueOfflineInk(lesson, stroke('forbidden'))).rejects.toMatchObject({code: 'SESSION_CHANGED'});
    await expect(f.cache.save(before.gate.generation, {...before.snapshot, workspaceRevision: 100}, true)).rejects.toMatchObject({code: 'SESSION_CHANGED'});
    f.network.online = true; const reopened = f.newClient(); const count = f.network.calls.length;
    await expect(reopened.session()).rejects.toMatchObject({code: 'UNAUTHENTICATED'}); expect(f.network.calls).toHaveLength(count);
    await reopened.login('synthetic', 'synthetic'); await reopened.openWorkspace(workspace);
    expect(reopened.state.pending[0]?.request).toMatchObject({command: {object: {id: 'retained'}}});
  });

  it('account B with the same lesson ID cannot read or dispatch account A pending', async () => {
    const f = await setup(); await f.client.openOffline(); await f.client.queueOfflineInk(lesson, stroke('only-a'));
    const b = {...account, id: 'teacher-b'}; await f.addWorkspace('workspace-b', b); f.setAccount(b);
    await f.client.login('b', 'synthetic'); await f.client.openWorkspace('workspace-b');
    expect(f.client.state.pending).toEqual([]); expect(f.client.state.offlineAvailable).toBe(false);
    await expect(f.client.openOffline()).rejects.toMatchObject({code: 'OFFLINE_UNAVAILABLE'});
    expect(f.values.get(account.id)).toContain('only-a'); expect(f.sent).toEqual([]);
  });

  it('a verified role change for the same ID invalidates the old teacher cache', async () => {
    const f = await setup(); f.setAccount({...account, role: 'student'});
    const cold = f.newClient(); await expect(cold.session()).rejects.toMatchObject({code: 'SESSION_CHANGED'});
    await expect(cold.openOffline()).rejects.toMatchObject({code: 'OFFLINE_UNAVAILABLE'});
    await vi.waitFor(async () => expect(await f.cache.load()).toBeNull());
  });

  it('observed authorization failure prevents stale fallback; corruption is not overwritten', async () => {
    const f = await setup(); f.setAccount(null);
    const cold = f.newClient(); await expect(cold.session()).rejects.toMatchObject({code: 'UNAUTHENTICATED'});
    await expect(cold.openOffline()).rejects.toMatchObject({code: 'OFFLINE_UNAVAILABLE'});
    await vi.waitFor(async () => expect(await f.cache.load()).toBeNull());
    f.setAccount(account); await f.client.login('a', 'synthetic'); await f.client.openWorkspace(workspace); await f.client.makeAvailableOffline();
    const original = (await f.cache.load())!;
    await rawStore(f.factory, store => store.put({format: 'future-format', original: 'keep these bytes'}, ['snapshot', account.id, workspace]));
    await expect(f.cache.load()).rejects.toBeDefined();
    await expect(f.cache.save(original.gate.generation, {...original.snapshot, workspaceRevision: 20}, true)).rejects.toBeDefined();
    let raw: unknown;
    await rawStore(f.factory, store => {const request = store.get(['snapshot', account.id, workspace]); request.onsuccess = () => {raw = request.result;};});
    expect(raw).toEqual({format: 'future-format', original: 'keep these bytes'});
  });

  it('concurrent cache writes never regress revision and contain no revocable projection fields', async () => {
    const f = await setup(), found = (await f.cache.load())!;
    const old = found.snapshot, latest = {...old, workspaceRevision: 5};
    const secondTab = browserOfflineStore(f.factory);
    await Promise.all([f.cache.save(found.gate.generation, latest), secondTab.save(found.gate.generation, old)]);
    expect((await f.cache.load())?.snapshot.workspaceRevision).toBe(5);
    expect(Object.keys((await f.cache.load())!.snapshot).sort()).toEqual(['format','account','workspaceId','title','workspaceRevision','actor','documents','savedAt','notebookSpace'].sort());
  });

  it('failed durable pending storage reports memory, preserves/export drafts and never sends', async () => {
    const f = await setup(); await f.client.openOffline();
    f.storage.write = () => {throw new Error('Quota exceeded');};
    await expect(f.client.queueOfflineInk(lesson, stroke('memory-only'))).rejects.toMatchObject({code: 'RECOVERY_STORAGE_FAILURE'});
    expect(f.client.state.recovery).toBe('memory'); expect(f.client.exportPendingRecovery()).toContain('memory-only');
    expect(f.sent).toHaveLength(0); expect(f.client.offline?.documents[0]?.objects).toEqual([]);
  });

  it('a delayed workspace gate cannot replace the newer selection or its availability', async () => {
    const f = await setup(); await f.addWorkspace('workspace-b'); await f.client.openWorkspace('workspace-b'); await f.client.makeAvailableOffline();
    const hold = deferred(); let gateCalls = 0, delay = false;
    const store: OfflineStore = {...f.cache, gate: async () => {const result = await f.cache.gate(); if (delay && ++gateCalls === 3) await hold.promise; return result;}};
    const c = f.newClient(store); await c.session();
    delay = true; const old = c.openWorkspace(workspace); const result = old.catch(error => error);
    await vi.waitFor(() => expect(gateCalls).toBe(3)); await c.openWorkspace('workspace-b'); hold.release();
    expect(await result).toMatchObject({code: 'WORKSPACE_CHANGED'}); expect(c.projection?.workspaceId).toBe('workspace-b'); expect(c.state.offlineAvailable).toBe(true);
  });

  it('superseded reconnect cannot close a newer login', async () => {
    const f = await setup(), hold = deferred(); let delay = false;
    const c = f.newClient(f.cache, async (url, init) => {const response = await f.transport(url, init);
      if (delay && JSON.parse(String(init?.body)).action === 'session') await hold.promise; return response;});
    await c.session(); await c.openWorkspace(workspace); await c.openOffline(); delay = true;
    const reconnect = c.reconnect().catch(error => error); await vi.waitFor(() => expect(f.network.calls.at(-1)).toBe('session'));
    const b = {...account, id: 'teacher-b'}; f.setAccount(b); const login = c.login('b', 'synthetic'); hold.release();
    await login; expect(await reconnect).toMatchObject({code: 'SESSION_CHANGED'});
    expect(c.account?.id).toBe(b.id); expect((await f.cache.gate()).accountId).toBe(b.id); expect((await f.cache.gate()).signedOut).toBe(false);
  });

  it('unreadable optional storage permits explicit online login but never restores an unverified automatic session', async () => {
    const f = await fixture(); const cache = browserOfflineStore(new IDBFactory());
    const unavailable = () => Promise.reject(new OfflineError('OFFLINE_STORAGE_FAILURE', 'Storage unavailable'));
    const c = createRemoteClient({fetch: f.fetcher, offlineStore: {...cache, gate: unavailable, close: unavailable}});
    await expect(c.session()).rejects.toMatchObject({code: 'OFFLINE_STORAGE_FAILURE'});
    await c.login('synthetic', 'synthetic'); await c.openWorkspace(workspace);
    expect(c.account?.id).toBe(account.id); await expect(c.makeAvailableOffline()).rejects.toMatchObject({code: 'OFFLINE_UNAVAILABLE'});
  });

  it.each([['FORBIDDEN', 403], ['NOT_FOUND', 404]])('a cold %s response closes the active cached workspace before it can be reopened', async (code, status) => {
    const f = await setup();
    const cold = f.newClient(f.cache, async (url, init) => JSON.parse(String(init?.body)).action === 'open-workspace'
      ? new Response(JSON.stringify({ok: false, error: {code, message: 'Synthetic inaccessible workspace'}}), {status: Number(status)}) : f.transport(url, init));
    await cold.session(); expect(cold.projection).toBeNull();
    await expect(cold.openWorkspace(workspace)).rejects.toMatchObject({code});
    await expect(cold.openOffline()).rejects.toMatchObject({code: 'OFFLINE_UNAVAILABLE'});
    expect(await f.cache.load()).toBeNull();
  });

  it('logout still closes the remote session and reports an unpersisted local close', async () => {
    const f = await setup(); const c = f.newClient({...f.cache, close: async () => {throw new OfflineError('OFFLINE_STORAGE_FAILURE', 'Synthetic storage failure');}});
    await c.session(); await c.openWorkspace(workspace);
    await expect(c.logout()).rejects.toMatchObject({code: 'LOCAL_LOGOUT_UNCONFIRMED'});
    expect(f.network.calls.at(-1)).toBe('logout'); expect(c.account).toBeNull(); expect(c.offline).toBeNull();
    expect(c.state.error?.code).toBe('LOCAL_LOGOUT_UNCONFIRMED');
  });

  it.each(['open', 'prepare'])('logout between the final copy check and %s publication cannot reopen local data', async action => {
    const f = await setup(); const snapshot = await f.cache.load();
    let release!: (value: typeof snapshot) => void, loading = false;
    const held = new Promise<typeof snapshot>(resolve => {release = resolve;});
    const c = f.newClient({...f.cache, load: () => {loading = true; return held;}});
    await c.session(); await c.openWorkspace(workspace);
    const opening = (action === 'open' ? c.openOffline() : c.makeAvailableOffline()).catch(error => error);
    await vi.waitFor(() => expect(loading).toBe(true));
    // This reaction runs after the helper's check but before its caller resumes.
    const logout = held.then(() => c.logout()); release(snapshot);
    expect(await opening).toMatchObject({code: 'SESSION_CHANGED'}); await logout;
    expect(c.offline).toBeNull(); expect(c.state.offlineAvailable).toBe(false);
  });

  it('reconnect drains an already captured stroke before authenticating and refuses new input during transition', async () => {
    const f = await setup(), held = deferred(); let delay = false, waiting = false;
    const c = f.newClient({...f.cache, gate: async () => {const value = await f.cache.gate();
      if (delay) {delay = false; waiting = true; await held.promise;} return value;}});
    await c.session(); await c.openWorkspace(workspace); await c.openOffline(); delay = true;
    const writing = c.queueOfflineInk(lesson, stroke('before-reconnect')).catch(error => error);
    await vi.waitFor(() => expect(waiting).toBe(true)); const calls = f.network.calls.length;
    const connecting = c.reconnect().catch(error => error);
    await new Promise(resolve => setTimeout(resolve, 0)); const prematureRequests = f.network.calls.length - calls;
    const late = c.queueOfflineInk(lesson, stroke('during-reconnect')).catch(error => error);
    held.release(); const written = await writing; await connecting;
    expect(prematureRequests).toBe(0); expect(written).toMatchObject({kind: 'queued'});
    expect(await late).toMatchObject({code: 'OFFLINE_TRANSITION'});
    expect(c.account?.id).toBe(account.id); expect(c.state.pending).toHaveLength(1); expect(f.sent).toHaveLength(0);
    expect(c.state.pending[0]?.request).toMatchObject({command: {object: {id: 'before-reconnect'}}});
  });
});


it('keeps the prior offline revision when a new original cannot be persisted, then cold-opens the complete revision', async () => {
  const f=await setup(), prior=(await f.cache.load())!, bytes=new TextEncoder().encode('%PDF-1.7\noriginal');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  const documentId='unopened-material-lesson';
  const manifest=MaterialManifestSchema.parse({format:'ardesia-material-v1',assetId:'unopened-original',documentId,name:'Original.pdf',mimeType:'application/pdf',bytes:bytes.length,sha256:hash,license:'CC0',pages:[{width:600,height:800}],parts:[{index:0,bytes:bytes.length,sha256:hash}]});
  const state={manifest,status:'ready',ownerId:account.id,createdAt:'2026-11-07T12:00:00.000Z'};
  await f.server.execute(teacher,{kind:'create-document',commandId:'second-lesson',documentId,expectedRevision:0,title:'Unopened lesson'});
  await f.server.execute(teacher,{kind:'add-object',commandId:'new-original',documentId,expectedRevision:1,object:{id:'page',type:'material',title:'Original',x:0,y:0,width:300,height:400,data:materialPage(manifest,1)}});
  const fetcher:typeof fetch=async(url,init)=>{
    const body=JSON.parse(String(init?.body));
    if(body.action==='read-material')return new Response(JSON.stringify({ok:true,result:state}));
    if(body.action==='read-material-part')return new Response(JSON.stringify({ok:true,result:{base64:Buffer.from(bytes).toString('base64')}}));
    return f.transport(url,init);
  };
  let failStorage=true;
  const store:OfflineStore={...f.cache,putMaterial:async(...args)=>{if(failStorage)throw new OfflineError('OFFLINE_STORAGE_FAILURE','Synthetic material quota');await f.cache.putMaterial!(...args);}};
  const c=f.newClient(store,fetcher);await c.session();await c.openWorkspace(workspace);
  await expect(c.openOffline()).rejects.toMatchObject({code:'OFFLINE_STORAGE_FAILURE'});
  expect((await f.cache.load())?.snapshot).toEqual(prior.snapshot);
  failStorage=false;await c.refresh();await c.openOffline();
  expect(c.offline?.documents.find(d=>d.id===documentId)?.objects[0]?.id).toBe('page');
  f.network.online=false;const cold=f.newClient();await expect(cold.session()).rejects.toMatchObject({code: 'NETWORK_ERROR'});await cold.openOffline();
  expect(await (await cold.offlineMaterials().download(manifest.assetId,hash)).text()).toBe(new TextDecoder().decode(bytes));
});


it('offline erasure of saved and queued ink remains an immutable ordered command through cold reopen',async()=>{
  const f=await setup();
  await f.client.edit(teacher,lesson,ink('saved-ink'));
  await f.client.edit(teacher,lesson,{kind:'add-object',object:{id:'note',type:'note',title:'Da conservare',x:1,y:2,width:100,height:100,data:{text:'Non è inchiostro'}}});
  await f.client.openOffline();f.network.online=false;
  const calls=[...f.network.calls];
  await expect(f.client.queueOfflineEraseInk(lesson,'note')).rejects.toMatchObject({code:'OFFLINE_UNAVAILABLE'});
  await f.client.queueOfflineInk(lesson,stroke('new-ink'));
  await f.client.queueOfflineEraseInk(lesson,'saved-ink');
  await f.client.queueOfflineEraseInk(lesson,'new-ink');
  await expect(f.client.queueOfflineEraseInk(lesson,'new-ink')).rejects.toMatchObject({code:'OFFLINE_UNAVAILABLE'});
  expect(f.network.calls).toEqual(calls);
  const retained=structuredClone(f.client.state.pending);
  expect(retained.map(p=>p.request.action==='command'&&p.request.command.kind)).toEqual(['add-object','remove-object','remove-object']);
  const cold=f.newClient();await expect(cold.session()).rejects.toBeDefined();await cold.openOffline();
  expect(cold.state.pending.map(p=>p.request)).toEqual(retained.map(p=>p.request));
  f.network.online=true;await cold.reconnect();
  for(const entry of retained)await cold.resumePending(entry.commandId);
  expect(f.server.getDocument(teacher,lesson).objects.map(o=>o.id)).toEqual(['note']);
  expect(f.sent.slice(-3).map(s=>s.body)).toEqual(retained.map(p=>p.request));
  expect(cold.state.pending).toEqual([]);
});

it('a live gesture checkpoint uses one stable ID, never mutates Core, and clears only after exact durable handoff',async()=>{
  const f=await setup(),values=new Map<string,string>();
  const web={get length(){return values.size;},key:(n:number)=>[...values.keys()][n]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const store=browserInkDraftStorage(web);
  const make=()=>createRemoteClient({fetch:f.transport,pendingStorage:f.storage,offlineStore:f.cache,inkDraftStorage:store});
  const c=make();await c.login('synthetic','synthetic');await c.openWorkspace(workspace);
  const access=c.inkRecovery(lesson),draft={object:stroke('interrupted'),sampleTimes:[100]};
  access.write(draft);draft.object.data.points[0]!.pressure=.8;access.write(draft);
  expect(values.size).toBe(1);expect(c.state.pending).toEqual([]);expect(f.sent).toHaveLength(0);
  const cold=make();await cold.session();await cold.openWorkspace(workspace);
  expect(cold.inkRecovery(lesson).read()).toEqual([draft]);
  await cold.edit(teacher,lesson,{kind:'add-object',object:draft.object});
  expect(cold.inkRecovery(lesson).read()).toEqual([]);expect(values.size).toBe(1);
  access.release(draft.object.id);
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(await cold.inkRecovery(lesson).recover(draft.object.id,async()=>{throw Error('Already retained');})).toBe(true);expect(values.size).toBe(0);
  access.write({...draft,object:stroke('old-session')});
  await c.logout();expect(()=>access.read()).toThrow();expect(()=>access.write(draft)).toThrow();
  expect(values.size).toBe(1);
});


it('exclusive ink handoff clears a checkpoint before releasing even when the Core reply was lost',async()=>{
 const f=await fixture({afterCommit:(_command,_receipt,index)=>{if(index===1)throw new TypeError('Lost acknowledged response');}}),values=new Map<string,string>();
 const web={get length(){return values.size;},key:(n:number)=>[...values.keys()][n]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
 const a=createRemoteClient({fetch:f.fetcher,pendingStorage:f.storage,inkDraftStorage:browserInkDraftStorage(web)}),b=createRemoteClient({fetch:f.fetcher,pendingStorage:f.storage,inkDraftStorage:browserInkDraftStorage(web)});
 await a.session();await a.openWorkspace(workspace);await b.session();await b.openWorkspace(workspace);
 const draft={object:stroke('lost-reply-gesture'),sampleTimes:[1]},access=a.inkRecovery(lesson);access.write(draft);
 await expect(a.edit(teacher,lesson,{kind:'add-object',object:draft.object})).rejects.toMatchObject({code:'NETWORK_ERROR'});
 expect(a.state.recovery).toBe('durable');expect(a.state.pending).toHaveLength(1);access.release(draft.object.id);
 await new Promise(resolve=>setTimeout(resolve,0));
 expect(b.inkRecovery(lesson).read()).toEqual([]);
 expect(await b.inkRecovery(lesson).recover(draft.object.id,async()=>{throw Error('A second command must not be submitted');})).toBe(true);
 expect(f.sent).toHaveLength(1);await a.retryPending(a.state.pending[0]!.commandId);expect(f.sent[1]?.body).toEqual(f.sent[0]?.body);
 expect(f.server.getDocument(teacher,lesson).objects).toHaveLength(1);
});
