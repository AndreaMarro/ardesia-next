import {canonicalJson, CoreError, NotebookLibrarySchema, notebookNewDocument, notebookPages,
  type Actor, type CoreSnapshot, type Notebook, type NotebookCommand, type NotebookLibrary,
  type NotebookPage, type NotebookSection, type NotebookSpace} from '@ardesia/contracts';

type DocumentIdentity = {id: string; ownerId: string; revision: number};
type CatalogState = {notebookLibraries: NotebookLibrary[]; documents: DocumentIdentity[]};
function missing(): never {throw new CoreError('NOT_FOUND', 'Notebook entry is unavailable.');}
function invalid(message: string): never {throw new CoreError('INVALID_COMMAND', message);}
function requireRevision(actual: number, expected: number) {
  if (actual !== expected) throw new CoreError('REVISION_CONFLICT', 'The notebook changed. Read the saved version before retrying.');
}
export function notebookSpace(state: CatalogState, actor: Actor): NotebookSpace {
  const library = state.notebookLibraries.find(item => item.ownerId === actor.actorId);
  return structuredClone(library ? {revision: library.revision, notebooks: library.notebooks} : {revision: 0, notebooks: []});
}
function insert<T extends {id: string}>(items: T[], entry: T, beforeId: string | null) {
  if (entry.id === beforeId) invalid('An entry cannot be placed before itself.');
  const index = beforeId === null ? items.length : items.findIndex(item => item.id === beforeId);
  if (index < 0) invalid('The order anchor is not in the target container.');
  items.splice(index, 0, entry);
}
function move<T extends {id: string}>(source: T[], target: T[], entry: T, beforeId: string | null) {
  if (entry.id === beforeId) invalid('An entry cannot be placed before itself.');
  // Validate the target before changing even the transient cloned structure.
  if (beforeId !== null && !target.some(item => item.id === beforeId)) invalid('The order anchor is not in the target container.');
  source.splice(source.indexOf(entry), 1); insert(target, entry, beforeId);
}
/** Mutates only a transient Core clone. Its caller commits documents/events/receipt together. */
export function applyNotebook(state: CatalogState, actor: Actor, command: NotebookCommand, at: string): NotebookLibrary {
  let library = state.notebookLibraries.find(item => item.ownerId === actor.actorId);
  requireRevision(library?.revision ?? 0, command.expectedRevision);
  if (!library) {
    if (command.kind !== 'create-notebook') return missing();
    library = {ownerId: actor.actorId, revision: 0, updatedAt: at, notebooks: []};
    state.notebookLibraries.push(library);
  }
  const book = (id: string): Notebook => library!.notebooks.find(item => item.id === id) ?? missing();
  const section = (id: string): {notebook: Notebook; section: NotebookSection} => {
    for (const notebook of library!.notebooks) {
      const section = notebook.sections.find(item => item.id === id);
      if (section) return {notebook, section};
    }
    return missing();
  };
  const page = (id: string) => notebookPages(library!).find(item => item.page.id === id) ?? missing();
  function requireNewIds(ids: string[]) {
    const existing = library!.notebooks.flatMap(notebook => [notebook.id,
      ...notebook.sections.flatMap(section => [section.id, ...section.pages.map(page => page.id)])]);
    if (new Set(ids).size !== ids.length || ids.some(id => existing.includes(id))) {
      throw new CoreError('ALREADY_EXISTS', 'Notebook identities cannot be reused.');
    }
  }
  function newPage(input: {pageId: string; documentId: string; layout: NotebookPage['layout']}, expectedRevision: number): NotebookPage {
    requireNewIds([input.pageId]);
    const document = state.documents.find(item => item.id === input.documentId && item.ownerId === actor.actorId) ?? missing();
    requireRevision(document.revision, expectedRevision);
    if (notebookPages(library!).some(item => item.page.documentId === document.id)) {
      throw new CoreError('ALREADY_EXISTS', 'This document already belongs to a notebook page. Move that page instead.');
    }
    return {id: input.pageId, documentId: input.documentId, layout: structuredClone(input.layout), archived: false};
  }
  switch (command.kind) {
    case 'create-notebook': {
      requireNewIds([command.notebookId, command.sectionId, command.firstPage.pageId]);
      const first = newPage(command.firstPage, 1);
      library.notebooks.push({id: command.notebookId, title: command.title, archived: false,
        sections: [{id: command.sectionId, title: command.sectionTitle, archived: false, pages: [first]}]});
      break;
    }
    case 'rename-notebook': book(command.notebookId).title = command.title; break;
    case 'create-notebook-section':
      requireNewIds([command.sectionId]);
      insert(book(command.notebookId).sections, {id: command.sectionId, title: command.title, archived: false, pages: []}, command.beforeId);
      break;
    case 'rename-notebook-section': section(command.sectionId).section.title = command.title; break;
    case 'create-notebook-page':
    case 'attach-document-to-notebook':
      insert(section(command.sectionId).section.pages, newPage(command, command.kind === 'create-notebook-page' ? 1 : command.expectedDocumentRevision), command.beforeId);
      break;
    case 'set-notebook-page-layout': page(command.pageId).page.layout = structuredClone(command.layout); break;
    case 'move-notebook': move(library.notebooks, library.notebooks, book(command.notebookId), command.beforeId); break;
    case 'move-notebook-section': {
      const found = section(command.sectionId);
      move(found.notebook.sections, book(command.targetNotebookId).sections, found.section, command.beforeId); break;
    }
    case 'move-notebook-page': {
      const found = page(command.pageId);
      move(found.section.pages, section(command.targetSectionId).section.pages, found.page, command.beforeId); break;
    }
    case 'set-notebook-entry-archived': {
      const {kind, id} = command.entry;
      (kind === 'notebook' ? book(id) : kind === 'section' ? section(id).section : page(id).page).archived = command.archived;
    }
  }
  library.revision += 1; library.updatedAt = at;
  if (!NotebookLibrarySchema.safeParse(library).success) invalid('The notebook exceeds its capacity or contains duplicate identities.');
  return library;
}

/** Replay compact organization commands against document identities at each ledger position. */
export async function validateNotebookHistory(state: CoreSnapshot): Promise<void> {
  const fail = (): never => {throw new CoreError('INVALID_SNAPSHOT', 'Notebook history does not match its catalog and receipts.');};
  const replay: CatalogState = {notebookLibraries: [], documents: []};
  const receipts = new Map(state.receipts.map(receipt => [receipt.eventId, receipt]));
  // Fingerprints are independent; catalog replay must remain ordered. Bound the
  // hashing window so a large ledger cannot enqueue thousands of crypto jobs.
  for (let offset = 0; offset < state.events.length; offset += 64) {
    const batch = state.events.slice(offset, offset + 64), fingerprints = new Map<string, string>();
    try {
      await Promise.all(batch.filter(event => 'notebookOwnerId' in event).map(async event => {
        if (!('notebookOwnerId' in event)) return;
        const actor: Actor = {actorId: event.actorId, role: event.actorRole};
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson({actor, command: event.payload.command})));
        fingerprints.set(event.id, Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''));
      }));
    } catch {return fail();}
    for (const event of batch) {
      if ('documentId' in event) {
        if (event.type === 'create-document') replay.documents.push({id: event.documentId, ownerId: event.actorId, revision: event.documentRevision});
        else {
          const document = replay.documents.find(document => document.id === event.documentId);
          if (document) document.revision = event.documentRevision;
        }
      } else if ('notebookOwnerId' in event) {
        try {
          const actor: Actor = {actorId: event.actorId, role: event.actorRole}, command = event.payload.command;
          const library = applyNotebook(replay, actor, command, event.occurredAt), receipt = receipts.get(event.id);
          if (event.notebookOwnerId !== actor.actorId || event.notebookRevision !== library.revision || event.type !== command.kind
            || !receipt || receipt.fingerprint !== fingerprints.get(event.id)) return fail();
          // A creation must claim the immediate document event; the structural
          // snapshot validator also checks actor, title, revision and exact ID.
          const created = notebookNewDocument(command);
          if (created) {
            const previous = state.events[event.sequence - 2];
            if (!previous || !('documentId' in previous) || previous.type !== 'create-document'
              || previous.documentId !== created.documentId || !('relatedEventIds' in receipt)
              || receipt.relatedEventIds.length !== 1 || receipt.relatedEventIds[0] !== previous.id) return fail();
          }
        } catch {return fail();}
      }
    }
  }
  if (canonicalJson(replay.notebookLibraries) !== canonicalJson(state.notebookLibraries)) return fail();
}
