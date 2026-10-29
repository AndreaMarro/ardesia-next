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
export async function edit(core: CoreService, actor: Actor, documentId: string, command: EditCommand, base?: EducationalObject): Promise<void> {
  const current = core.getDocument(actor, documentId);
  if (base) assertDraftUnchanged(base, current.objects.find(object => object.id === base.id));
  await core.execute(actor, {...command, commandId: crypto.randomUUID(), documentId, expectedRevision: current.revision} as CoreCommand);
}
export async function newLesson(core: CoreService, actor: Actor, title: string): Promise<string> {
  const documentId = crypto.randomUUID();
  await core.execute(actor, {kind: 'create-document', commandId: crypto.randomUUID(), documentId, expectedRevision: 0, title});
  return documentId;
}
