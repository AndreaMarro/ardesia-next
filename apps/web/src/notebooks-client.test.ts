import {describe, expect, it, vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {createCore, MemoryStorage} from '@ardesia/core';
import {CoreError, type NotebookCommand, type NotebookReceipt, type PageLayout} from '@ardesia/contracts';
import {browserOfflineStore, createRemoteClient, OfflineError, type OfflineStore, type PendingStorage, type WorkspaceProjection} from '@ardesia/remote-client';

const account = {id: 'notebook-owner', role: 'student', displayName: 'Studente sintetico'} as const;
const actor = {actorId: account.id, role: account.role};
const layout: PageLayout = {format: 'a5', orientation: 'landscape', background: 'grid', paper: 'ivory'};
const create = (): NotebookCommand => ({kind: 'create-notebook', commandId: 'create', expectedRevision: 0,
  notebookId: 'book', title: 'Fisica', sectionId: 'section', sectionTitle: 'Meccanica',
  firstPage: {pageId: 'page', documentId: 'document', title: 'Forze', layout}});
function deferred() {let release!: () => void; return {promise: new Promise<void>(resolve => {release = resolve;}), release: () => release()};}

async function fixture() {
  const server = await createCore({storage: new MemoryStorage()}), other = await createCore({storage: new MemoryStorage()});
  const cache = browserOfflineStore(new IDBFactory()), values = new Map<string, string>();
  const pendingStorage: PendingStorage = {read: id => values.get(id) ?? null, write: (id, value) => {values.set(id, value);}, remove: id => {values.delete(id);}};
  const state = {online: true, capable: true, account: {...account} as {id: string; role: 'student'; displayName: string},
    after: undefined as undefined | ((receipt: NotebookReceipt, projection: WorkspaceProjection) => Promise<void>)};
  const sent: unknown[] = [];
  const projection = (workspaceId = 'space'): WorkspaceProjection => {
    const core = workspaceId === 'space' ? server : other;
    const selectedActor = workspaceId === 'space' ? actor : {...actor, actorId: 'legacy-alias'};
    const documents = core.listDocuments(selectedActor);
    return {workspaceId, title: 'Quaderni', workspaceRevision: core.snapshot().receipts.length, access: 'owner', actor: selectedActor,
      documents, assignedDocuments: [], installations: [], assignments: [], learnerWork: [], learningEvents: [], labAccess: [],
      events: documents.flatMap(document => core.events(actor, document.id)), ...(state.capable ? {notebookSpace: core.getNotebookSpace(actor)} : {})};
  };
  const json = (result: unknown) => new Response(JSON.stringify({ok: true, result}));
  const fetcher: typeof fetch = async (_url, init) => {
    if (!state.online) throw new TypeError('Synthetic offline');
    const body = JSON.parse(String(init?.body));
    if (body.action === 'login' || body.action === 'session') return json({account: state.account, expiresAt: '2026-11-09T00:00:00.000Z'});
    if (body.action === 'logout') return json(null);
    if (body.action === 'open-workspace') return json(projection(body.workspaceId));
    if (body.action !== 'notebook-command') throw Error('Unexpected fixture route');
    sent.push(structuredClone(body));
    try {
      const receipt = await server.executeNotebook(actor, body.command), next = projection();
      await state.after?.(receipt, next); return json({receipt, projection: next});
    } catch (reason) {
      if (reason instanceof CoreError) return new Response(JSON.stringify({ok: false, error: {code: reason.code, message: reason.message}}), {status: 409});
      throw reason;
    }
  };
  const newClient = (store: OfflineStore = cache, recovery = pendingStorage) => createRemoteClient({fetch: fetcher, pendingStorage: recovery, offlineStore: store});
  const client = newClient(); await client.login('synthetic', 'synthetic'); await client.openWorkspace('space');
  return {server, cache, values, state, sent, projection, newClient, client, pendingStorage};
}

describe('notebooks through the Remote Client and real Core', () => {
  it('captures the original actor before a held lock and rejects stale navigation before creating an envelope', async () => {
    const f = await fixture(), held = deferred(); let waiting = false;
    const client = f.newClient(f.cache, {...f.pendingStorage, coordinate: async (key, _mode, run) => {
      if (JSON.parse(key)[2] === 'workspace') {waiting = true; await held.promise;}
      return run();
    }});
    await client.session(); await client.openWorkspace('space');
    const saving = client.core.executeNotebook(actor, create()).catch(reason => reason);
    await vi.waitFor(() => expect(waiting).toBe(true)); await client.openWorkspace('other');
    expect(client.projection!.actor.actorId).toBe('legacy-alias'); held.release();
    expect(await saving).toMatchObject({code: 'WORKSPACE_CHANGED'});
    expect(f.sent).toEqual([]); expect(f.values.size).toBe(0); expect(f.server.snapshot().documents).toEqual([]);
    await client.openWorkspace('space'); await client.core.executeNotebook(actor, create());
    expect(client.state.pending).toEqual([]); expect(f.server.getNotebookSpace(actor).revision).toBe(1);
  });
  it('cold-recovers a lost composite receipt using the identical command and one page/document', async () => {
    const f = await fixture(); await f.client.makeAvailableOffline();
    f.state.after = async () => {throw new TypeError('Lost after atomic commit');};
    const command = create(); await expect(f.client.core.executeNotebook(actor, command)).rejects.toMatchObject({code: 'NETWORK_ERROR'});
    const original = f.client.state.pending[0]!.request;
    expect(f.server.snapshot().documents).toHaveLength(1); expect(f.server.snapshot().events).toHaveLength(2);
    expect((await f.cache.load())!.snapshot.notebookSpace).toEqual({revision: 0, notebooks: []});
    f.state.online = false; const cold = f.newClient(); await expect(cold.session()).rejects.toMatchObject({code: 'NETWORK_ERROR'}); await cold.openOffline();
    expect(cold.state.pending[0]!.request).toEqual(original); expect(cold.account).toBeNull(); expect(cold.projection).toBeNull();
    f.state.online = true; f.state.after = undefined;
    await cold.reconnect(); expect(f.sent).toHaveLength(1); await cold.retryPending(command.commandId);
    expect(f.sent[1]).toEqual(f.sent[0]); expect(cold.state.pending).toEqual([]);
    expect(f.server.snapshot().receipts).toHaveLength(1); expect(f.server.snapshot().events).toHaveLength(2);
    await cold.openOffline(); expect(cold.offline!.notebookSpace).toEqual(f.server.getNotebookSpace(actor));
    expect(cold.offline!.documents).toEqual(f.server.listDocuments(actor));
  });

  it('retains the composite intent until both catalog and documents are durably cached', async () => {
    const f = await fixture(); await f.client.makeAvailableOffline(); let fail = true;
    const client = f.newClient({...f.cache, save: async (generation, snapshot, enable) => {
      if (fail && snapshot.workspaceRevision > 0) throw new OfflineError('OFFLINE_STORAGE_FAILURE', 'Synthetic quota');
      return f.cache.save(generation, snapshot, enable);
    }});
    await client.session(); await client.openWorkspace('space');
    await expect(client.core.executeNotebook(actor, create())).rejects.toMatchObject({code: 'OFFLINE_COPY_UNCONFIRMED'});
    expect(client.state.pending).toHaveLength(1); expect((await f.cache.load())!.snapshot.documents).toEqual([]);
    expect(f.server.getNotebookSpace(actor).revision).toBe(1);
    fail = false; await client.retryPending('create'); expect(client.state.pending).toEqual([]);
    const copy = (await f.cache.load())!.snapshot;
    expect(copy.notebookSpace).toEqual(f.server.getNotebookSpace(actor)); expect(copy.documents).toEqual(f.server.listDocuments(actor));
    expect(f.sent[1]).toEqual(f.sent[0]); expect(f.server.snapshot().receipts).toHaveLength(1);
  });

  it('does not redirect a late notebook response after workspace navigation or account changes', async () => {
    for (const changeAccount of [false, true]) {
      const f = await fixture(), held = deferred(); let entered = false;
      f.state.after = async () => {entered = true; await held.promise;};
      const saving = f.client.core.executeNotebook(actor, create()).catch(reason => reason);
      await vi.waitFor(() => expect(entered).toBe(true));
      if (changeAccount) {await f.client.logout(); f.state.account.id = 'other-account'; await f.client.login('other', 'synthetic');}
      else await f.client.openWorkspace('other');
      held.release(); expect(await saving).toMatchObject({code: changeAccount ? 'SESSION_CHANGED' : 'WORKSPACE_CHANGED'});
      expect(f.values.get(account.id)).toContain('create');
      if (changeAccount) {expect(f.client.state.pending).toEqual([]); expect(f.client.projection).toBeNull();}
      else {expect(f.client.projection!.workspaceId).toBe('other'); expect(f.client.projection!.notebookSpace!.revision).toBe(0);}
    }
  });

  it('rejects mismatched receipts, missing creation evidence and foreign catalog references without cleanup', async () => {
    const corruptions: ((receipt: NotebookReceipt, projection: WorkspaceProjection) => void)[] = [
      receipt => {receipt.notebookOwnerId = 'other';}, receipt => {receipt.notebookRevision++;}, receipt => {receipt.relatedEventIds = [];},
      (_receipt, projection) => {projection.events = [];},
      (_receipt, projection) => {projection.notebookSpace!.notebooks[0]!.sections[0]!.pages[0]!.documentId = 'foreign';},
    ];
    for (const corrupt of corruptions) {
      const f = await fixture(); f.state.after = async (receipt, projection) => {corrupt(receipt, projection);};
      await expect(f.client.core.executeNotebook(actor, create())).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
      expect(f.client.state.pending).toHaveLength(1); expect(f.client.projection!.documents).toEqual([]);
      f.state.after = undefined; await f.client.retryPending('create'); expect(f.client.state.pending).toEqual([]);
      expect(f.server.snapshot().receipts).toHaveLength(1);
    }
  });

  it('keeps two pages, order and layouts in a cold offline copy without granting authoring authority', async () => {
    const f = await fixture(); await f.client.core.executeNotebook(actor, create());
    await f.client.core.executeNotebook(actor, {kind: 'create-notebook-page', commandId: 'second', expectedRevision: 1,
      sectionId: 'section', pageId: 'second', documentId: 'second', title: 'Energia', beforeId: 'page', layout: {...layout, background: 'dots'}});
    await f.client.makeAvailableOffline(); f.state.online = false;
    const cold = f.newClient(); await expect(cold.session()).rejects.toMatchObject({code: 'NETWORK_ERROR'}); await cold.openOffline();
    expect(cold.offline!.notebookSpace!.notebooks[0]!.sections[0]!.pages.map(page => page.documentId)).toEqual(['second', 'document']);
    expect(cold.offline!.documents).toEqual(f.server.listDocuments(actor));
    expect(() => cold.core.getNotebookSpace(actor)).toThrow();
    expect(() => cold.core.executeNotebook(actor, create())).toThrow();
    expect(f.sent).toHaveLength(2);
  });

  it('treats absent server support as unknown and refuses authoring without HTTP or recovery', async () => {
    const f = await fixture(); f.state.capable = false; await f.client.refresh(); await f.client.makeAvailableOffline();
    expect((await f.cache.load())!.snapshot.notebookSpace).toBeNull();
    expect(() => f.client.core.getNotebookSpace(actor)).toThrow(/non disponibili/);
    await expect(f.client.core.executeNotebook(actor, create())).rejects.toMatchObject({code: 'UNSUPPORTED_FEATURE'});
    expect(f.sent).toEqual([]); expect(f.client.state.pending).toEqual([]);
  });
});
