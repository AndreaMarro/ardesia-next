import type {CoreService} from '@ardesia/core';
import {canonicalJson, CoreError, type Actor, type CoreCommand, type EducationalObject, type LearnerWork, type NewEducationalObject} from '@ardesia/contracts';

export type EditCommand = CoreCommand extends infer C ? C extends CoreCommand ? Omit<C, 'commandId' | 'documentId' | 'expectedRevision'> : never : never;
export type SaveObject = (object: NewEducationalObject, base: EducationalObject) => Promise<EducationalObject | null>;
export const draftConflictMessage = 'Il contenuto salvato è cambiato. La bozza resta intatta: ripristina per aggiornarla.';
export const removedDraftMessage = 'Oggetto rimosso. Copia la bozza prima di chiudere il pannello.';
export function assertDraftUnchanged(base: unknown, current: unknown): void {
  if (canonicalJson(base) !== canonicalJson(current)) throw new CoreError('REVISION_CONFLICT', draftConflictMessage);
}
export function learnerObject(object: EducationalObject, work: LearnerWork | null | undefined): EducationalObject {
  const saved = work?.labs.find(lab => lab.objectId === object.id);
  return object.type === 'lab' && saved ? {...object, data: saved.data, revision: saved.revision} : object;
}
// The canvas can submit a second pointer-up before the first remote Core receipt
// arrives. Serialize UI intents per Core instance; the Core still independently
// authorizes the actor and rejects stale external writers and object drafts.
const editQueues = new WeakMap<CoreService, Promise<void>>();
export async function edit(core: CoreService, actor: Actor, documentId: string, command: EditCommand, base?: EducationalObject): Promise<void> {
  const [owner, input, draft] = structuredClone([actor, command, base] as const);
  const previous = editQueues.get(core) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(async () => {
    const current = core.getDocument(owner, documentId);
    if (draft) assertDraftUnchanged(draft, current.objects.find(object => object.id === draft.id));
    await core.execute(owner, {...input, commandId: crypto.randomUUID(), documentId, expectedRevision: current.revision} as CoreCommand);
  });
  editQueues.set(core, pending);
  return pending;
}
export async function newLesson(core: CoreService, actor: Actor, title: string): Promise<string> {
  const documentId = crypto.randomUUID();
  await core.execute(actor, {kind: 'create-document', commandId: crypto.randomUUID(), documentId, expectedRevision: 0, title});
  return documentId;
}
