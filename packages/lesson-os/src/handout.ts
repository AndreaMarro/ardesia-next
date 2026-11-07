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
  // Layout establishes a deterministic reading order; identity and source data stay intact.
  document.objects.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id, 'en'));
  return structuredClone({format: 'ardesia-handout-v1', document, sources: [...sources.values()],
    missingSources: [...required].filter(([identity]) => !sources.has(identity)).map(([, ref]) => ref)});
}
