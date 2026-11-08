import {canonicalJson, CoreError, EducationalObjectSchema, LessonDocumentSchema, type EducationalObject, type LessonDocument, type SourceObject, type SourceReference} from '@ardesia/contracts';

const key = (id: string, revision: number) => `${id}@${revision}`;
export interface Handout {
  format: 'ardesia-handout-v1';
  document: LessonDocument;
  sources: SourceObject[];
  missingSources: SourceReference[];
}

/** A disposable publication projection, never an authorization or an archive.
 * Callers supply only a confirmed, authorized document and exact source revisions.
 * Audio frames and learner-specific overlays are not saved document revisions. */
export function projectHandout(input: LessonDocument, historicalSources: readonly EducationalObject[] = []): Handout {
  const document = LessonDocumentSchema.parse(input);
  const required = new Map(document.objects.flatMap(object => object.provenance.sources).map(ref => [key(ref.sourceId, ref.revision), ref]));
  const sources = new Map(document.objects.filter((object): object is SourceObject => object.type === 'source').map(source => [key(source.id, source.revision), source]));
  for (const inputSource of historicalSources) {
    const source = EducationalObjectSchema.parse(inputSource), identity = key(source.id, source.revision);
    if (source.type !== 'source' || !required.has(identity)) throw new CoreError('INVALID_SNAPSHOT', 'Handouts accept only exact cited source revisions.');
    if (sources.has(identity) && canonicalJson(sources.get(identity)) !== canonicalJson(source)) throw new CoreError('INVALID_SNAPSHOT', 'Conflicting source revision.');
    sources.set(identity, source);
  }
  // Preserve the exact confirmed snapshot. Reading order belongs to the derived
  // publication plan, never to the source document or its digest.
  return structuredClone({format: 'ardesia-handout-v1', document, sources: [...sources.values()],
    missingSources: [...required].filter(([identity]) => !sources.has(identity)).map(([, ref]) => ref)});
}

export type HandoutBlock = {kind: 'object' | 'material'; objectId: string; inkIds: string[]} | {kind: 'ink'; inkIds: string[]};
export interface HandoutPlan {format: 'ardesia-handout-plan-v1'; blocks: HandoutBlock[]; coverage: {objectId: string; revision: number; representation: string}[]}
/** Every saved object is accounted for exactly once; annotations travel with
 * their material. Renderers may paginate a spatial ink plate without separating
 * its strokes into independent, rescaled symbols. */
export function planHandout(handout: Handout): HandoutPlan {
  const objects = [...handout.document.objects].sort((a,b) => a.y-b.y || a.x-b.x || a.id.localeCompare(b.id,'en'));
  const materials = new Set(objects.filter(o => o.type === 'material').map(o => o.id));
  const free = objects.filter(o => o.type === 'ink' && (!o.data.anchor || !materials.has(o.data.anchor.objectId)));
  const blocks: HandoutBlock[] = [];
  let inkPlaced = false;
  for (const object of objects) {
    if (object.type === 'ink') {
      if (free.some(o => o.id === object.id) && !inkPlaced) {blocks.push({kind:'ink',inkIds:free.map(o => o.id)});inkPlaced=true;}
    } else if (object.type === 'material') {
      blocks.push({kind:'material',objectId:object.id,inkIds:objects.filter(o => o.type === 'ink' && o.data.anchor?.objectId === object.id).map(o => o.id)});
    } else blocks.push({kind:'object',objectId:object.id,inkIds:[]});
  }
  return {format:'ardesia-handout-plan-v1',blocks,coverage:objects.map(o => ({objectId:o.id,revision:o.revision,
    representation:o.type === 'ink' ? (o.data.anchor && materials.has(o.data.anchor.objectId) ? 'material-annotation' : 'spatial-ink')
      : o.type === 'material' ? 'material-plate' : o.type === 'extension' || o.type === 'lab' ? 'static-state' : o.type}))};
}
