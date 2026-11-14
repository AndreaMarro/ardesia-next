import {ownsWorkspace, type Course, type CourseSpace} from '@ardesia/contracts';
import type {RemoteClient} from '@ardesia/remote-client';

export function personalPhysicsDelivery(space: CourseSpace, courseId: string, actorId: string) {
  return space.deliveries.find(delivery => delivery.status === 'active' && delivery.learnerId === actorId
    && space.editions.some(pack => pack.edition.id === delivery.editionId && pack.edition.courseId === courseId));
}

/** The shortcut uses the same immutable editions and private Core deliveries as
 * authoring. A retry resumes acknowledged work; it never replaces an edition. */
export async function startPhysicsStudy(client: RemoteClient, course: Course): Promise<string> {
  const projection = client.projection;
  if (!projection || !ownsWorkspace(projection)) throw Error('Apri il tuo spazio personale per iniziare.');
  const {actor, workspaceId} = projection;
  const space = () => {
    if (client.projection?.workspaceId !== workspaceId || client.projection.actor.actorId !== actor.actorId)
      throw Error('Lo spazio è cambiato. Il percorso già salvato resta conservato.');
    if (client.state.pending.length) throw Error('Conferma le modifiche nel pannello di recupero, poi riprendi.');
    return client.core.getCourseSpace(actor);
  };
  const existing = personalPhysicsDelivery(space(), course.id, actor.actorId);
  if (existing) return existing.id;
  let edition = space().editions.find(pack => pack.edition.courseId === course.id && pack.edition.courseRevision === course.revision)?.edition;
  if (!edition) {
    const id = `${course.id}:study:r${course.revision}`;
    await client.core.executeCourse(actor, {kind: 'create-course-edition', editionId: id, courseId: course.id,
      courseRevision: course.revision, expectedRevision: 0, commandId: `${id}:create`, label: `Studio personale · revisione ${course.revision}`});
    edition = space().editions.find(pack => pack.edition.id === id)?.edition;
    if (!edition) throw Error('L’edizione non è ancora confermata. Riprendi dal catalogo.');
  }
  const current = space();
  const resumed = personalPhysicsDelivery(current, course.id, actor.actorId);
  if (resumed) return resumed.id;
  const generation = current.deliveries.filter(delivery => delivery.learnerId === actor.actorId && delivery.status === 'revoked'
    && current.editions.some(pack=>pack.edition.id===delivery.editionId&&pack.edition.courseId===course.id)).length;
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([course.id,actor.actorId,generation])));
  const id = 'study-' + Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  space();
  await client.core.executeCourse(actor, {kind: 'assign-course', deliveryId: id, editionId: edition.id,
    learnerId: actor.actorId, expectedRevision: 0, commandId: `${id}:assign`});
  if (!space().deliveries.some(delivery => delivery.id === id && delivery.status === 'active'))
    throw Error('Il percorso non è ancora confermato. Riprendi dal catalogo.');
  return id;
}
