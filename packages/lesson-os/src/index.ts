import { CoreError, LessonDocumentSchema, type CoreEvent, type LessonDocument } from '@ardesia/contracts';

export type ContinuityProjection = Readonly<{
  documentId: string;
  latestRevision: number;
  lastActivityAt: string | null;
  changes: ReadonlyArray<{
    eventId: string;
    revision: number;
    type: CoreEvent['type'];
    actorId: string;
    occurredAt: string;
  }>;
}>;

/** Pure projection over the authorized Core stream; no independent event store. */
export function projectContinuity(events: readonly CoreEvent[], documentId: string): ContinuityProjection {
  const relevant = events.filter((event) => event.documentId === documentId).sort((a, b) => a.sequence - b.sequence);
  for (const [index, event] of relevant.entries()) {
    if (event.documentRevision !== index + 1) throw new CoreError('INVALID_SNAPSHOT', 'Continuity requires the complete authorized document event stream.');
  }
  const latest = relevant.at(-1);
  return {
    documentId,
    latestRevision: latest?.documentRevision ?? 0,
    lastActivityAt: latest?.occurredAt ?? null,
    changes: relevant.map((event) => ({ eventId: event.id, revision: event.documentRevision, type: event.type, actorId: event.actorId, occurredAt: event.occurredAt })),
  };
}

/** Preview projection only; the server must authorize the reader before calling it. */
export function studentProjection(input: LessonDocument): LessonDocument | null {
  const document = LessonDocumentSchema.parse(input);
  if (document.status !== 'approved') return null;
  // Remove objects citing hidden sources, transitively, so provenance cannot expose a draft ID.
  let objects = document.objects.filter((object) => object.status === 'approved');
  let changed = true;
  while (changed) {
    const sources = new Map(objects.filter((object) => object.type === 'source').map((object) => [object.id, object.revision]));
    const visible = objects.filter((object) => object.provenance.sources.every((source) => sources.get(source.sourceId) === source.revision));
    changed = visible.length !== objects.length;
    objects = visible;
  }
  const ids = new Set(objects.map((object) => object.id));
  return structuredClone({ ...document, objects, connections: document.connections.filter((connection) => ids.has(connection.from) && ids.has(connection.to)) });
}
