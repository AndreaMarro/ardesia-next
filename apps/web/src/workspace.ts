import {createCore, type CoreService} from '@ardesia/core';
import type {Actor, CoreCommand, NewEducationalObject} from '@ardesia/contracts';
import {BrowserStorage} from './adapters/browser-storage';

// Device-owner context only. This is deliberately not an authentication provider.
export const localActor: Actor = {actorId: 'device-owner', role: 'teacher'};
export type EditCommand = CoreCommand extends infer C ? C extends CoreCommand ? Omit<C, 'commandId' | 'documentId' | 'expectedRevision'> : never : never;

// Serialize local UI intents, not Core authority: each accepted edit reads the newest
// document revision when its turn begins. The Core still rejects stale external writers.
const editQueues = new WeakMap<CoreService, Promise<void>>();
export function edit(core: CoreService, documentId: string, command: EditCommand): Promise<void> {
  const previous = editQueues.get(core) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(async () => {
    const current = core.getDocument(localActor, documentId);
    await core.execute(localActor, {...command, commandId: crypto.randomUUID(), documentId, expectedRevision: current.revision} as CoreCommand);
  });
  editQueues.set(core, pending);
  return pending;
}
export async function newLesson(core: CoreService, title: string): Promise<string> {
  const documentId = crypto.randomUUID();
  await core.execute(localActor, {kind: 'create-document', commandId: crypto.randomUUID(), documentId, expectedRevision: 0, title});
  return documentId;
}
export async function openWorkspace(): Promise<CoreService> {
  const core = await createCore({storage: new BrowserStorage()});
  if(core.listDocuments(localActor).length) return core;
  const doc = await newLesson(core, 'Oscillazioni: osserva, misura, spiega');
  const sourceId = crypto.randomUUID(), noteId = crypto.randomUUID(), formulaId = crypto.randomUUID();
  const objects: NewEducationalObject[] = [
    {id: sourceId, type: 'source', title: 'Una fonte da esplorare', x: 700, y: 355, width: 280, height: 156,
      data: {url: 'https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums', publisher: 'OpenStax · University Physics', locator: '§ 15.4 · Pendulums', sourceRevision: 'Volume 1, sezione 15.4 · consultata 29 ottobre 2026', license: 'Collegamento alla fonte; nessun testo o figura riprodotti'}},
    {id: noteId, type: 'note', title: 'Che cosa cambia il periodo?', x: 45, y: 100, width: 250, height: 204,
      data: {text: 'Prima osserva. Poi formula un’ipotesi e raccogli una misura.'}},
    {id: formulaId, type: 'formula', title: 'Il pendolo semplice', x: 365, y: 210, width: 290, height: 240,
      data: {latex: 'T = 2\\pi \\sqrt{\\frac{L}{g}}', description: 'Piccole oscillazioni · modello ideale'},
      provenance: {origin: 'authored', sources: [{sourceId, revision: 1, locator: 'Eq. 15.19; ipotesi di piccole oscillazioni'}]}}
  ];
  for(const object of objects) await edit(core, doc, {kind: 'add-object', object});
  await edit(core, doc, {kind: 'connect-objects', connection: {id: crypto.randomUUID(), from: noteId, to: formulaId, label: 'Ipotesi e modello'}});
  await edit(core, doc, {kind: 'connect-objects', connection: {id: crypto.randomUUID(), from: formulaId, to: sourceId, label: 'Fonte del modello'}});
  return core;
}
