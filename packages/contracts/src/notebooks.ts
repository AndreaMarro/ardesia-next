import {z} from 'zod';

const id = /* @__PURE__ */ (() => z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/))();
const title = /* @__PURE__ */ (() => z.string().trim().min(1).max(240))();
const revision = /* @__PURE__ */ (() => z.number().int().nonnegative())();
export const PageLayoutSchema = /* @__PURE__ */ (() => z.object({
  format: z.enum(['a4', 'a5', 'letter']), orientation: z.enum(['portrait', 'landscape']),
  background: z.enum(['plain', 'ruled', 'grid', 'dots']), paper: z.enum(['white', 'ivory']),
}).strict())();
export type PageLayout = z.infer<typeof PageLayoutSchema>;
export const NotebookPageSchema = /* @__PURE__ */ (() => z.object({id, documentId: id, layout: PageLayoutSchema, archived: z.boolean()}).strict())();
export type NotebookPage = z.infer<typeof NotebookPageSchema>;
export const NotebookSectionSchema = /* @__PURE__ */ (() => z.object({id, title, archived: z.boolean(), pages: z.array(NotebookPageSchema).max(500)}).strict())();
export type NotebookSection = z.infer<typeof NotebookSectionSchema>;
export const NotebookSchema = /* @__PURE__ */ (() => z.object({id, title, archived: z.boolean(), sections: z.array(NotebookSectionSchema).max(100)}).strict())();
export type Notebook = z.infer<typeof NotebookSchema>;
const space = /* @__PURE__ */ (() => ({revision, notebooks: z.array(NotebookSchema).max(100)}))();
function validCatalog(value: {revision: number; notebooks: Notebook[]}) {
  const ids = new Set<string>(), documents = new Set<string>();
  const unique = (value: string) => !ids.has(value) && !!ids.add(value);
  if (value.revision === 0 && value.notebooks.length) return false;
  for (const notebook of value.notebooks) {
    if (!unique(notebook.id)) return false;
    for (const section of notebook.sections) {
      if (!unique(section.id)) return false;
      for (const page of section.pages) {
        if (!unique(page.id) || documents.has(page.documentId)) return false;
        documents.add(page.documentId);
      }
    }
  }
  return documents.size <= 500;
}
export const NotebookSpaceSchema = /* @__PURE__ */ (() => z.object(space).strict().refine(validCatalog, 'Notebook identities, order and capacity must be valid.'))();
export type NotebookSpace = z.infer<typeof NotebookSpaceSchema>;
export const NotebookLibrarySchema = /* @__PURE__ */ (() => z.object({...space, ownerId: id, revision: revision.refine(v => v > 0), updatedAt: z.iso.datetime()})
  .strict().refine(validCatalog, 'Notebook identities, order and capacity must be valid.'))();
export type NotebookLibrary = z.infer<typeof NotebookLibrarySchema>;
const command = {commandId: id, expectedRevision: revision};
const firstPage = /* @__PURE__ */ (() => z.object({pageId: id, documentId: id, title, layout: PageLayoutSchema}).strict())();
export const NotebookCommandKinds = [
  'create-notebook', 'rename-notebook', 'create-notebook-section', 'rename-notebook-section',
  'create-notebook-page', 'attach-document-to-notebook', 'set-notebook-page-layout',
  'move-notebook', 'move-notebook-section', 'move-notebook-page', 'set-notebook-entry-archived',
] as const;
export const NotebookCommandSchema = /* @__PURE__ */ (() => z.discriminatedUnion('kind', [
  z.object({...command, kind: z.literal('create-notebook'), notebookId: id, title, sectionId: id, sectionTitle: title, firstPage}).strict(),
  z.object({...command, kind: z.literal('rename-notebook'), notebookId: id, title}).strict(),
  z.object({...command, kind: z.literal('create-notebook-section'), notebookId: id, sectionId: id, title, beforeId: id.nullable()}).strict(),
  z.object({...command, kind: z.literal('rename-notebook-section'), sectionId: id, title}).strict(),
  z.object({...command, kind: z.literal('create-notebook-page'), ...firstPage.shape, sectionId: id, beforeId: id.nullable()}).strict(),
  z.object({...command, kind: z.literal('attach-document-to-notebook'), sectionId: id, pageId: id, documentId: id,
    expectedDocumentRevision: revision.refine(v => v > 0), layout: PageLayoutSchema, beforeId: id.nullable()}).strict(),
  z.object({...command, kind: z.literal('set-notebook-page-layout'), pageId: id, layout: PageLayoutSchema}).strict(),
  z.object({...command, kind: z.literal('move-notebook'), notebookId: id, beforeId: id.nullable()}).strict(),
  z.object({...command, kind: z.literal('move-notebook-section'), sectionId: id, targetNotebookId: id, beforeId: id.nullable()}).strict(),
  z.object({...command, kind: z.literal('move-notebook-page'), pageId: id, targetSectionId: id, beforeId: id.nullable()}).strict(),
  z.object({...command, kind: z.literal('set-notebook-entry-archived'),
    entry: z.object({kind: z.enum(['notebook', 'section', 'page']), id}).strict(), archived: z.boolean()}).strict(),
]))();
export type NotebookCommand = z.infer<typeof NotebookCommandSchema>;
export const NotebookEventSchema = /* @__PURE__ */ (() => z.object({id, sequence: z.number().int().positive(), notebookOwnerId: id,
  notebookRevision: z.number().int().positive(), type: z.enum(NotebookCommandKinds), actorId: id,
  actorRole: z.enum(['teacher', 'student']), occurredAt: z.iso.datetime(), payload: z.object({command: NotebookCommandSchema}).strict(),
}).strict())();
export type NotebookEvent = z.infer<typeof NotebookEventSchema>;
export const NotebookReceiptSchema = /* @__PURE__ */ (() => z.object({commandId: id, actorId: id, fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  notebookOwnerId: id, notebookRevision: z.number().int().positive(), eventId: id, relatedEventIds: z.array(id).max(1),
}).strict())();
export type NotebookReceipt = z.infer<typeof NotebookReceiptSchema>;

/** The page frame is world geometry. Display pixels never promise physical millimetres. */
export function notebookPageSize(layout: PageLayout) {
  const sizes = {a4: [210, 297], a5: [148, 210], letter: [215.9, 279.4]} as const;
  const [short, long] = sizes[layout.format], scale = 96 / 25.4;
  return layout.orientation === 'portrait' ? {width: short * scale, height: long * scale} : {width: long * scale, height: short * scale};
}
export function notebookPages(space: Pick<NotebookSpace, 'notebooks'>) {
  return space.notebooks.flatMap(notebook => notebook.sections.flatMap(section => section.pages.map(page => ({notebook, section, page}))));
}
/** Creation is one Core transaction, including a normal document creation event. */
export function notebookNewDocument(command: NotebookCommand) {
  return command.kind === 'create-notebook' ? command.firstPage : command.kind === 'create-notebook-page' ? command : null;
}
