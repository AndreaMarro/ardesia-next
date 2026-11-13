import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe, it, expect} from 'vitest';
import {PhysicsImportSchema} from './import';
import {extensionDefinitionDigest} from '@ardesia/contracts';

type AssetFile = {file: string; sha256: string};
type CoverageRow = {
  courseId: string;
  lesson: {documentId: string; revision: number};
  practiceObjectIds: string[];
  originalProblemObjectIds: string[];
  assessmentObjectId: string;
  labObjectIds: string[];
};
const base = new URL('./data/', import.meta.url);
const sources = new URL('../../../../../docs/sources/physics-2026-27/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('distributed-assets.json', sources), 'utf8')) as {files: AssetFile[]};
const readPack = (file: AssetFile) => PhysicsImportSchema.parse(JSON.parse(readFileSync(new URL(file.file, base), 'utf8')));

describe('five portable physics courses, exact lessons and original provenance', () => {
  it.each(manifest.files)('validates every object and immutable extension definition in $file', async file => {
    const bytes = readFileSync(new URL(file.file, base));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
    const pack = PhysicsImportSchema.parse(JSON.parse(bytes.toString()));
    expect(pack.courseId).toBe(file.file.replace('.json', '') + '-v1');
    const checked = new Map<string, string>();
    for (const doc of pack.documents) {
      for (const object of doc.objects) {
        for (const source of object.provenance?.sources ?? []) {
          expect(doc.objects.some(o => o.id === source.sourceId && o.type === 'source')).toBe(true);
        }
        if (object.type !== 'extension') continue;
        const data = object.data, key = JSON.stringify(data.definition);
        if (!checked.has(key)) checked.set(key, await extensionDefinitionDigest(data.definition));
        expect(data.definitionDigest).toBe(checked.get(key));
        if (data.definition.typeId === 'ardesia.curriculum.question') {
          expect(String(data.state.prompt).length).toBeGreaterThan(10);
          expect(String(data.state.solution).length).toBeGreaterThan(3);
          if (data.state.kind === 'original') {
            expect(object.provenance?.origin).toBe('authored');
            expect(String(data.state.solution).length).toBeGreaterThan(200);
          }
        }
      }
    }
    expect(PhysicsImportSchema.safeParse({...pack, input: {...pack.input, units: pack.input.units.map((unit, i) =>
      i ? unit : {...unit, lesson: {...unit.lesson, revision: 9999}})}}).success).toBe(false);
  });

  it('reconciles all five courses with the complete syllabus and exact object revisions', () => {
    // Parse each immutable asset once, not once for each of the 200 coverage rows.
    const packs = new Map(manifest.files.map(file => {const pack = readPack(file); return [pack.courseId, pack];}));
    expect(manifest.files).toHaveLength(5);
    expect(packs.size).toBe(5);
    const objectives = new Set<string>(), questions = new Set<string>(), originals = new Set<string>();
    const labs = new Set<string>(), ids = new Set<string>();
    let units = 0;
    for (const pack of packs.values()) {
      units += pack.input.units.length;
      for (const doc of pack.documents) {
        expect(ids.has(doc.id)).toBe(false);
        ids.add(doc.id);
        for (const object of doc.objects) {
          if (object.type !== 'extension') continue;
          const data = object.data;
          if (data.definition.typeId.startsWith('ardesia.physics.')) labs.add(data.definition.typeId);
          if (data.definition.typeId !== 'ardesia.curriculum.question') continue;
          if (data.state.kind === 'assessment') objectives.add(String(data.state.objectives));
          else if (data.state.kind === 'original') originals.add(String(data.state.questionId));
          else questions.add(String(data.state.questionId));
        }
      }
    }
    const coverage = JSON.parse(readFileSync(new URL('distributed-coverage.json', sources), 'utf8')) as CoverageRow[];
    expect(coverage).toHaveLength(200);
    for (const row of coverage) {
      const pack = packs.get(row.courseId);
      expect(pack).toBeDefined();
      const doc = pack!.documents.find(d => d.id === row.lesson.documentId);
      expect(doc).toBeDefined();
      expect(row.lesson.revision).toBe(doc!.objects.length + 1);
      for (const id of [...row.practiceObjectIds, ...row.originalProblemObjectIds, row.assessmentObjectId, ...row.labObjectIds]) {
        expect(doc!.objects.some(o => o.id === id)).toBe(true);
      }
    }
    expect(units).toBe(38);
    expect(objectives.size).toBe(200);
    // Unique physical lab types and original problems in the distributed curriculum.
    expect(labs.size).toBe(19);
    expect(questions.size).toBe(259);
    expect(originals.size).toBe(69);
  });
});
