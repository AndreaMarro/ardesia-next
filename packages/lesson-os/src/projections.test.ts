import { describe, expect, it } from 'vitest';
import { type CoreEvent, type LessonDocument } from '@ardesia/contracts';
import { projectContinuity, studentProjection } from './index';

const provenance = { origin: 'authored' as const, sources: [], createdBy: 'andrea', createdAt: '2026-10-29T00:00:00.000Z' };
const document: LessonDocument = {
  id: 'lesson-1', ownerId: 'andrea', title: 'Lezione', revision: 1, status: 'approved', createdAt: provenance.createdAt, updatedAt: provenance.createdAt,
  objects: [
    { id: 'visible', type: 'note', title: 'Pubblica', revision: 1, status: 'approved', x: 0, y: 0, width: 100, height: 100, provenance, data: { text: 'Visibile' } },
    { id: 'draft', type: 'note', title: 'Privata', revision: 1, status: 'draft', x: 0, y: 0, width: 100, height: 100, provenance, data: { text: 'Non divulgare' } },
  ],
  connections: [{ id: 'edge-1', from: 'visible', to: 'draft', label: 'Non divulgare' }],
};

describe('LessonOS projections', () => {
  it('returns no student projection for a draft document, even when an object says approved', () => {
    expect(studentProjection({ ...document, status: 'draft' })).toBeNull();
  });

  it('filters drafts and hidden endpoints while leaving the Core snapshot unchanged', () => {
    const input = structuredClone(document);
    const projection = studentProjection(input)!;
    expect(projection.objects.map((object) => object.id)).toEqual(['visible']);
    expect(projection.connections).toEqual([]);
    projection.title = 'Changed projection';
    expect(input).toEqual(document);
    expect(JSON.stringify(projection)).not.toContain('Non divulgare');
  });

  it('hides approved objects that cite a hidden source or a different source revision', () => {
    const input = structuredClone(document);
    input.objects[0]!.provenance.sources = [{ sourceId: 'draft-source', revision: 1, locator: 'p.1' }];
    input.objects.push({ id: 'draft-source', type: 'source', title: 'Riservata', status: 'draft', revision: 1, x: 0, y: 0, width: 100, height: 100, provenance, data: { url: 'https://example.com', publisher: 'Autore', locator: 'p.1', sourceRevision: 'v1', license: 'All rights reserved' } });
    expect(studentProjection(input)!.objects).toEqual([]);
    input.objects[2]!.status = 'approved';
    input.objects[2]!.revision = 2;
    expect(studentProjection(input)!.objects.map((object) => object.id)).toEqual(['draft-source']);
  });

  it('rebuilds continuity deterministically from the complete Core stream without mutating it', () => {
    const first: CoreEvent = { id: 'e1', sequence: 1, documentId: document.id, documentRevision: 1, type: 'create-document', actorId: 'andrea', occurredAt: provenance.createdAt, payload: { title: 'Lezione' } };
    const second: CoreEvent = { ...first, id: 'e2', sequence: 2, documentRevision: 2, type: 'add-object' };
    const events = [second, first];
    const before = structuredClone(events);
    const projection = projectContinuity(events, document.id);
    expect(projection.latestRevision).toBe(2);
    expect(projection.changes.map((change) => change.eventId)).toEqual(['e1', 'e2']);
    expect(events).toEqual(before);
    expect(projectContinuity(before, document.id)).toEqual(projection);
    expect(() => projectContinuity([second], document.id)).toThrow('complete authorized');
  });
});
