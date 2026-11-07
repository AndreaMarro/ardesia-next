import {canonicalJson, CoreError, CoreEventSchema, EducationalObjectSchema, LessonDocumentSchema, type CoreEvent, type LessonDocument} from './index';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function invalid(): never {throw new CoreError('INVALID_SNAPSHOT', 'Exact replay requires the complete, coherent authorized document history.');}

/** Rebuild a document from its existing Core events. No stored scene or second journal. */
export function projectDocumentRevision(input: readonly CoreEvent[], documentId: string, wanted: number): LessonDocument {
  if (!Number.isInteger(wanted) || wanted < 1) return invalid();
  const events = input.filter(event => event.documentId === documentId).sort((a, b) => a.documentRevision - b.documentRevision);
  let document: LessonDocument | undefined;
  const seen = new Set<string>(), objectIds = new Set<string>();
  for (let index = 0; index < wanted; index++) {
    const parsed = CoreEventSchema.safeParse(events[index]); if (!parsed.success) return invalid();
    const event = parsed.data;
    if (event.documentRevision !== index + 1 || seen.has(event.id) || !record(event.payload)) return invalid();
    seen.add(event.id); const payload = event.payload;
    if (index === 0) {
      if (event.type !== 'create-document' || typeof payload.title !== 'string') return invalid();
      document = LessonDocumentSchema.parse({id: documentId, ownerId: event.actorId, title: payload.title,
        revision: 1, status: 'draft', createdAt: event.occurredAt, updatedAt: event.occurredAt, objects: [], connections: []});
      continue;
    }
    if (!document || document.ownerId !== event.actorId) return invalid();
    const object = () => {const result = EducationalObjectSchema.safeParse(payload.object); return result.success ? result.data : invalid();};
    if (event.type === 'rename-document') {
      if (typeof payload.title !== 'string' || payload.previousTitle !== document.title) return invalid();
      document.title = payload.title;
    } else if (event.type === 'add-object') {
      const next = object(); if (objectIds.has(next.id) || next.revision !== 1) return invalid();
      objectIds.add(next.id); document.objects.push(next);
    } else if (event.type === 'replace-object' || event.type === 'move-object') {
      const next = object(), previous = document.objects.find(value => value.id === next.id);
      if (!previous || next.revision !== previous.revision + 1 || canonicalJson(payload.previous) !== canonicalJson(previous)) return invalid();
      document.objects = document.objects.map(value => value.id === next.id ? next : value);
    } else if (event.type === 'remove-object') {
      const previous = EducationalObjectSchema.safeParse(payload.previous);
      if (!previous.success || !document.objects.some(value => value.id === previous.data.id && canonicalJson(value) === canonicalJson(previous.data))) return invalid();
      document.objects = document.objects.filter(value => value.id !== previous.data.id);
      document.connections = document.connections.filter(value => value.from !== previous.data.id && value.to !== previous.data.id);
    } else if (event.type === 'connect-objects') {
      if (!record(payload.connection)) return invalid();
      // The document schema validates IDs and endpoints together below.
      document.connections.push(payload.connection as unknown as LessonDocument['connections'][number]);
    } else if (event.type === 'disconnect-objects') {
      if (!record(payload.previous) || typeof payload.previous.id !== 'string') return invalid();
      const id = payload.previous.id;
      if (!document.connections.some(value => value.id === id && canonicalJson(value) === canonicalJson(payload.previous))) return invalid();
      document.connections = document.connections.filter(value => value.id !== id);
    } else if (event.type === 'plugin-release-changed') {
      if (!Array.isArray(payload.objects)) return invalid();
      for (const change of payload.objects) {
        if (!record(change)) return invalid();
        const next = EducationalObjectSchema.safeParse(change.object);
        if (!next.success || !document.objects.some(value => value.id === next.data.id && value.revision + 1 === next.data.revision && canonicalJson(change.previous) === canonicalJson(value))) return invalid();
        document.objects = document.objects.map(value => value.id === next.data.id ? next.data : value);
      }
    } else return invalid();
    document = LessonDocumentSchema.parse({...document, revision: event.documentRevision, updatedAt: event.occurredAt});
  }
  return document ?? invalid();
}
