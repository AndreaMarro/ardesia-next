import type {CoreService} from '@ardesia/core';
import {canonicalJson, CoreError, type Actor, type EducationalObject, type LearnerWork, type NewEducationalObject} from '@ardesia/contracts';

export type {EditCommand} from '@ardesia/remote-client';
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
// RemoteClient owns queued intents and account-scoped recovery. The UI does not
// keep a second write queue or turn an unconfirmed stroke into saved data.
export async function newLesson(core: CoreService, actor: Actor, title: string): Promise<string> {
  const documentId = crypto.randomUUID();
  await core.execute(actor, {kind: 'create-document', commandId: crypto.randomUUID(), documentId, expectedRevision: 0, title});
  return documentId;
}

/** Pending add-object footprints reserve placement; only ink is drawn as a visual draft. Never apply them to Core, Notebook, export or revision history. */
export function pendingObjectsForDocument(pending: readonly import('@ardesia/remote-client').PendingCommand[], workspaceId: string, documentId: string): NewEducationalObject[] {
  return pending.flatMap(entry => {
    const request = entry.request;
    return entry.workspaceId === workspaceId && request.action === 'command' && request.workspaceId === workspaceId
      && request.command.documentId === documentId && request.command.kind === 'add-object'
      ? [request.command.object] : [];
  });
}

/** A visual erasure remains a pending command until Core acknowledges it. */
export function pendingRemovalsForDocument(pending: readonly import('@ardesia/remote-client').PendingCommand[], workspaceId: string, documentId: string): string[] {
  return pending.flatMap(entry => {
    const request=entry.request;
    return entry.workspaceId===workspaceId&&request.action==='command'&&request.workspaceId===workspaceId&&request.command.documentId===documentId&&request.command.kind==='remove-object'
      ? [request.command.objectId] : [];
  });
}
