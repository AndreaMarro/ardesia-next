import {describe, expect, it} from 'vitest';
import {canonicalJson, projectDocumentRevision, type Actor, type CoreSnapshot, type NotebookCommand, type PageLayout} from '@ardesia/contracts';
import {createCore, MemoryStorage, type StorageAdapter} from './index';

const owner: Actor = {actorId: 'owner', role: 'student'}, other: Actor = {actorId: 'other', role: 'teacher'};
const layout: PageLayout = {format: 'a4', orientation: 'portrait', background: 'grid', paper: 'ivory'};
const create = (name = 'a', revision = 0): Extract<NotebookCommand, {kind: 'create-notebook'}> => ({kind: 'create-notebook', commandId: 'create-' + name,
  expectedRevision: revision, notebookId: 'book-' + name, title: 'Quaderno ' + name, sectionId: 'section-' + name,
  sectionTitle: 'Appunti', firstPage: {pageId: 'page-' + name, documentId: 'doc-' + name, title: 'Pagina ' + name, layout}});
function fixture(storage: StorageAdapter = new MemoryStorage()) {
  let event = 0;
  const options = {storage, workspaceId: 'notebooks', clock: () => '2026-11-08T00:00:00.000Z', id: () => 'event-' + ++event};
  return {storage, options, open: () => createCore(options)};
}

describe('Canonical notebook organization', () => {
  it('creates a page and its document atomically with one composite receipt and exact document history', async () => {
    const f = fixture(), core = await f.open(), command = create();
    const receipt = await core.executeNotebook(owner, command);
    const snapshot = core.snapshot();
    expect(snapshot.documents).toHaveLength(1); expect(snapshot.events).toHaveLength(2); expect(snapshot.receipts).toHaveLength(1);
    expect(receipt).toMatchObject({notebookOwnerId: owner.actorId, notebookRevision: 1, relatedEventIds: [snapshot.events[0]!.id]});
    expect(projectDocumentRevision(core.events(owner, 'doc-a'), 'doc-a', 1)).toEqual(core.getDocument(owner, 'doc-a'));
    expect(core.getNotebookSpace(owner).notebooks[0]!.sections[0]!.pages[0]).toEqual({id: 'page-a', documentId: 'doc-a', layout, archived: false});
    const reopened = await f.open(); expect(reopened.snapshot()).toEqual(snapshot);
    expect(await reopened.executeNotebook(owner, command)).toEqual(receipt);
    expect(reopened.snapshot()).toEqual(snapshot);
  });

  it('moves pages and sections across notebooks without changing document IDs, objects or history', async () => {
    const f = fixture(), core = await f.open();
    await core.executeNotebook(owner, create()); await core.executeNotebook(owner, create('b', 1));
    await core.execute(owner, {kind: 'add-object', commandId: 'ink', documentId: 'doc-a', expectedRevision: 1,
      object: {id: 'ink', type: 'ink', title: 'Tratto', x: -90, y: 20, width: 200, height: 50,
        data: {color: '#243b42', width: 3, points: [{x: 0, y: 0, pressure: .2}, {x: 200, y: 40, pressure: .8}]}}});
    const before = core.snapshot(), document = core.getDocument(owner, 'doc-a');
    await core.executeNotebook(owner, {kind: 'create-notebook-section', commandId: 'section', expectedRevision: 2, notebookId: 'book-a', sectionId: 'extra', title: 'Problemi', beforeId: 'section-a'});
    await core.executeNotebook(owner, {kind: 'move-notebook-page', commandId: 'page-move', expectedRevision: 3, pageId: 'page-a', targetSectionId: 'extra', beforeId: null});
    await core.executeNotebook(owner, {kind: 'move-notebook-section', commandId: 'section-move', expectedRevision: 4, sectionId: 'extra', targetNotebookId: 'book-b', beforeId: 'section-b'});
    await core.executeNotebook(owner, {kind: 'move-notebook', commandId: 'book-move', expectedRevision: 5, notebookId: 'book-b', beforeId: 'book-a'});
    await core.executeNotebook(owner, {kind: 'set-notebook-page-layout', commandId: 'layout', expectedRevision: 6, pageId: 'page-a', layout: {...layout, format: 'a5', orientation: 'landscape', background: 'ruled'}});
    const space = core.getNotebookSpace(owner);
    expect(space.notebooks.map(book => book.id)).toEqual(['book-b', 'book-a']);
    expect(space.notebooks[0]!.sections.map(section => section.id)).toEqual(['extra', 'section-b']);
    expect(space.notebooks[0]!.sections[0]!.pages[0]!.documentId).toBe('doc-a');
    expect(core.getDocument(owner, 'doc-a')).toEqual(document);
    expect(core.snapshot().events.filter(event => 'documentId' in event)).toEqual(before.events.filter(event => 'documentId' in event));
    expect((await f.open()).snapshot()).toEqual(core.snapshot());
    // Returned projections are disposable, never a second mutable catalog.
    space.notebooks[0]!.title = 'Local mutation'; expect(core.getNotebookSpace(owner).notebooks[0]!.title).toBe('Quaderno b');
  });

  it('retries the original composite creation after document and catalog changes without rewriting history', async () => {
    const f = fixture(), core = await f.open(), original = create(), receipt = await core.executeNotebook(owner, original);
    await core.execute(owner, {kind: 'rename-document', commandId: 'rename-page', documentId: 'doc-a', expectedRevision: 1, title: 'Titolo corrente'});
    await core.executeNotebook(owner, {kind: 'rename-notebook', commandId: 'rename-book', expectedRevision: 1, notebookId: 'book-a', title: 'Titolo del quaderno'});
    await core.executeNotebook(owner, create('b', 2));
    await core.executeNotebook(owner, {kind: 'move-notebook-page', commandId: 'moved', expectedRevision: 3, pageId: 'page-a', targetSectionId: 'section-b', beforeId: 'page-b'});
    const snapshot = core.snapshot(), reopened = await f.open();
    expect(await reopened.executeNotebook(owner, original)).toEqual(receipt); expect(reopened.snapshot()).toEqual(snapshot);
    expect(projectDocumentRevision(reopened.events(owner, 'doc-a'), 'doc-a', 1).title).toBe(original.firstPage.title);
    expect(reopened.getDocument(owner, 'doc-a').title).toBe('Titolo corrente');
  });

  it('rejects a second generated event collision without committing the new document', async () => {
    const f = fixture(), core = await f.open(); await core.executeNotebook(owner, create());
    const before = core.snapshot(), bytes = await f.storage.read(); let call = 0;
    const colliding = await createCore({...f.options, id: () => ++call === 1 ? 'new-document-event' : before.events[0]!.id});
    await expect(colliding.executeNotebook(owner, create('b', 1))).rejects.toMatchObject({code: 'ALREADY_EXISTS'});
    expect(call).toBe(2); expect(colliding.snapshot()).toEqual(before); expect(await f.storage.read()).toEqual(bytes);
  });

  it('validates a composite creation across the hashing window and refuses a corrupt later fingerprint', async () => {
    const f = fixture(), core = await f.open(); await core.executeNotebook(owner, create());
    for (let i = 0; i < 61; i++) await core.execute(owner, {kind: 'rename-document', commandId: 'rename-' + i,
      documentId: 'doc-a', expectedRevision: i + 1, title: 'Titolo ' + i});
    await core.executeNotebook(owner, {kind: 'create-notebook-page', commandId: 'at-boundary', expectedRevision: 1,
      sectionId: 'section-a', pageId: 'second', documentId: 'second', title: 'Seconda', layout, beforeId: null});
    const snapshot = core.snapshot();
    expect(snapshot.events[63]!.type).toBe('create-document'); expect(snapshot.events[64]!.type).toBe('create-notebook-page');
    expect((await f.open()).snapshot()).toEqual(snapshot);
    const corrupt = structuredClone(snapshot); corrupt.receipts.at(-1)!.fingerprint = '0'.repeat(64); let writes = 0;
    await expect(createCore({storage: {read: async () => corrupt, write: async () => {writes++;}}})).rejects.toMatchObject({code: 'INVALID_SNAPSHOT'});
    expect(writes).toBe(0);
  });

  it('attaches an exact owned document once and archives reversibly without deleting content', async () => {
    const f = fixture(), core = await f.open(); await core.executeNotebook(owner, create());
    await core.execute(owner, {kind: 'create-document', commandId: 'existing', documentId: 'existing', title: 'Lavagna esistente', expectedRevision: 0});
    const attach: NotebookCommand = {kind: 'attach-document-to-notebook', commandId: 'attach', expectedRevision: 1,
      sectionId: 'section-a', pageId: 'attached', documentId: 'existing', expectedDocumentRevision: 1, layout, beforeId: 'page-a'};
    const receipt = await core.executeNotebook(owner, attach); expect(receipt.relatedEventIds).toEqual([]);
    const document = core.getDocument(owner, 'existing');
    await core.executeNotebook(owner, {kind: 'set-notebook-entry-archived', commandId: 'archive', expectedRevision: 2, entry: {kind: 'page', id: 'attached'}, archived: true});
    await expect(core.executeNotebook(owner, {...attach, commandId: 'alias', pageId: 'alias', expectedRevision: 3})).rejects.toMatchObject({code: 'ALREADY_EXISTS'});
    await core.executeNotebook(owner, {kind: 'set-notebook-entry-archived', commandId: 'restore', expectedRevision: 3, entry: {kind: 'page', id: 'attached'}, archived: false});
    expect(core.getDocument(owner, 'existing')).toEqual(document);
    expect((await f.open()).getNotebookSpace(owner).notebooks[0]!.sections[0]!.pages.map(page => page.id)).toEqual(['attached', 'page-a']);
  });

  it('rejects stale organization and incorrect order anchors without partial changes', async () => {
    const core = await fixture().open(); await core.executeNotebook(owner, create()); await core.executeNotebook(owner, create('b', 1));
    const before = core.snapshot();
    for (const command of [
      {kind: 'move-notebook', commandId: 'stale', expectedRevision: 1, notebookId: 'book-b', beforeId: 'book-a'},
      {kind: 'move-notebook', commandId: 'self', expectedRevision: 2, notebookId: 'book-a', beforeId: 'book-a'},
      {kind: 'move-notebook-page', commandId: 'wrong-anchor', expectedRevision: 2, pageId: 'page-a', targetSectionId: 'section-b', beforeId: 'page-a'},
    ] as NotebookCommand[]) {
      await expect(core.executeNotebook(owner, command)).rejects.toBeDefined(); expect(core.snapshot()).toEqual(before);
    }
    const updates = await Promise.allSettled([
      core.executeNotebook(owner, {kind: 'rename-notebook', commandId: 'winner', expectedRevision: 2, notebookId: 'book-a', title: 'Nuovo titolo'}),
      core.executeNotebook(owner, {kind: 'rename-notebook', commandId: 'loser', expectedRevision: 2, notebookId: 'book-a', title: 'Vecchio titolo'}),
    ]);
    expect(updates.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(core.getNotebookSpace(owner).notebooks[0]!.title).toBe('Nuovo titolo');
  });

  it('keeps catalogs private to owners, including student-owned spaces', async () => {
    const core = await fixture().open(); await core.executeNotebook(owner, create()); await core.executeNotebook(other, create('other'));
    expect(core.getNotebookSpace(other).notebooks.map(book => book.id)).toEqual(['book-other']);
    const before = core.snapshot();
    await expect(core.executeNotebook(other, {kind: 'rename-notebook', commandId: 'foreign', expectedRevision: 1, notebookId: 'book-a', title: 'No'})).rejects.toMatchObject({code: 'NOT_FOUND'});
    await expect(core.executeNotebook(other, {kind: 'attach-document-to-notebook', commandId: 'foreign-document', expectedRevision: 1,
      sectionId: 'section-other', pageId: 'alias', documentId: 'doc-a', expectedDocumentRevision: 1, layout, beforeId: null})).rejects.toMatchObject({code: 'NOT_FOUND'});
    expect(core.snapshot()).toEqual(before);
  });

  it('rolls back catalog, document, events and receipt together on storage or generated-ID failure', async () => {
    const durable = new MemoryStorage(); let refuse = false;
    const f = fixture({read: () => durable.read(), write: async value => {if (refuse) throw Error('disk full'); await durable.write(value);}});
    const core = await f.open(); await core.executeNotebook(owner, create());
    const before = core.snapshot(), bytes = await durable.read(); refuse = true;
    await expect(core.executeNotebook(owner, create('b', 1))).rejects.toMatchObject({code: 'STORAGE_FAILURE'});
    expect(core.snapshot()).toEqual(before); expect(await durable.read()).toEqual(bytes);
    const colliding = await createCore({...f.options, id: () => before.events[0]!.id});
    await expect(colliding.executeNotebook(owner, create('c', 1))).rejects.toMatchObject({code: 'ALREADY_EXISTS'});
    expect(colliding.snapshot()).toEqual(before); expect(await durable.read()).toEqual(bytes);
  });

  it('captures command payloads before queuing and preserves the shared idempotency namespace', async () => {
    const core = await fixture().open(), command = create();
    const applying = core.executeNotebook(owner, command); command.title = 'Changed after submission'; await applying;
    expect(core.getNotebookSpace(owner).notebooks[0]!.title).toBe('Quaderno a');
    await expect(core.executeNotebook(owner, command)).rejects.toMatchObject({code: 'IDEMPOTENCY_CONFLICT'});
    await expect(core.executeNotebook({...owner, role: 'teacher'}, create())).rejects.toMatchObject({code: 'IDEMPOTENCY_CONFLICT'});
    await expect(core.execute(owner, {kind: 'create-document', commandId: 'create-a', documentId: 'collision', title: 'No', expectedRevision: 0})).rejects.toMatchObject({code: 'IDEMPOTENCY_CONFLICT'});
  });

  it('rejects a document collision before persisting a second notebook', async () => {
    const core = await fixture().open(); await core.executeNotebook(owner, create()); const before = core.snapshot();
    const next = create('b', 1); if (next.kind !== 'create-notebook') throw Error('fixture'); next.firstPage.documentId = 'doc-a';
    await expect(core.executeNotebook(owner, next)).rejects.toMatchObject({code: 'ALREADY_EXISTS'}); expect(core.snapshot()).toEqual(before);
  });

  it('rejects catalog, history, receipt and creation-link tampering without writing', async () => {
    const core = await fixture().open(); await core.executeNotebook(owner, create()); await core.executeNotebook(owner, create('b', 1));
    const saved = core.snapshot();
    const corruptions: ((state: CoreSnapshot) => void)[] = [
      state => {state.notebookLibraries[0]!.notebooks.reverse();},
      state => {state.notebookLibraries[0]!.notebooks[0]!.sections[0]!.pages[0]!.documentId = 'doc-b';},
      state => {state.notebookLibraries[0]!.ownerId = other.actorId;},
      state => {const event = state.events[1]!; if ('notebookOwnerId' in event) event.payload.command.expectedRevision = 3;},
      state => {const receipt = state.receipts[0]!; if ('notebookOwnerId' in receipt) receipt.relatedEventIds = [state.events[2]!.id];},
      state => {state.receipts[0]!.fingerprint = '0'.repeat(64);},
      state => {state.receipts[0]!.commandId = 'different-command';},
      state => {const receipt = state.receipts[0]!; if ('notebookOwnerId' in receipt) receipt.notebookOwnerId = other.actorId;},
      state => {state.events[0]!.occurredAt = '2026-11-09T00:00:00.000Z';},
      state => {const event = state.events[0]!; if ('documentId' in event) event.payload = {title: 'Different creation title'};},
      ...[false, true].map(before => (state: CoreSnapshot) => {
        const receipt = {commandId: 'second-coverage', actorId: owner.actorId, fingerprint: 'a'.repeat(64), documentId: 'doc-a', documentRevision: 1, eventId: state.events[0]!.id};
        if (before) state.receipts.unshift(receipt); else state.receipts.push(receipt);
      }),
      state => {state.receipts.pop();},
    ];
    for (const change of corruptions) {
      const broken = structuredClone(saved); change(broken); let writes = 0;
      await expect(createCore({storage: {read: async () => broken, write: async () => {writes++;}}})).rejects.toMatchObject({code: 'INVALID_SNAPSHOT'});
      expect(writes).toBe(0);
    }
  });

  it('migrates v1–v10 on read only, preserving old values and receipts without inventing notebooks', async () => {
    const core = await fixture().open();
    await core.execute(owner, {kind: 'create-document', commandId: 'old', documentId: 'old', title: 'Lezione storica', expectedRevision: 0});
    const baseline = core.snapshot();
    for (let version = 1; version <= 10; version++) {
      const old = structuredClone(baseline) as unknown as Record<string, unknown>; old.schemaVersion = version; delete old.notebookLibraries;
      if (version < 8) delete old.tutorRecords;
      if (version < 7) for (const key of ['courses', 'courseEditions', 'courseDeliveries', 'courseWork']) delete old[key];
      if (version < 4) for (const key of ['assignments', 'learnerWork']) delete old[key];
      if (version < 3) delete old.installations;
      const bytes = canonicalJson(old); let writes = 0;
      const reopened = await createCore({storage: {read: async () => old, write: async () => {writes++;}}});
      expect(reopened.getNotebookSpace(owner)).toEqual({revision: 0, notebooks: []});
      expect(reopened.snapshot()).toEqual(baseline); expect(canonicalJson(old)).toBe(bytes); expect(writes).toBe(0);
    }
  });

  it('refuses a notebook snapshot relabelled as an old version, including hidden notebook ledger entries', async () => {
    const core = await fixture().open(); await core.executeNotebook(owner, create());
    for (const keepCatalog of [true, false]) for (const version of [1, 7, 9, 10]) {
      const old = core.snapshot() as unknown as Record<string, unknown>; old.schemaVersion = version;
      if (!keepCatalog) delete old.notebookLibraries;
      await expect(createCore({storage: new MemoryStorage(old)})).rejects.toMatchObject({code: 'INVALID_SNAPSHOT'});
    }
  });
});
