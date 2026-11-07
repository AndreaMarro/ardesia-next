import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {PhysicsImportSchema} from './import';
import {extensionDefinitionDigest} from '@ardesia/contracts';
const base=new URL('./data/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('../../../../../docs/sources/physics-2026-27/distributed-assets.json',import.meta.url),'utf8'));
describe('five portable physics courses, exact lessons and original provenance',()=>{
 it('validates every distributed object, syllabus map and immutable extension definition',async()=>{
  const objectives=new Set<string>(),questions=new Set<string>(),originals=new Set<string>(),labs=new Set<string>(),ids=new Set<string>();let units=0;
  const checked=new Map<string,string>();
  for(const file of manifest.files){
   const bytes=readFileSync(new URL(file.file,base));expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
   const pack=PhysicsImportSchema.parse(JSON.parse(bytes.toString()));units+=pack.input.units.length;
   for(const doc of pack.documents){expect(ids.has(doc.id)).toBe(false);ids.add(doc.id);
    for(const object of doc.objects){
     const sources=object.provenance?.sources??[];for(const source of sources)expect(doc.objects.some(o=>o.id===source.sourceId&&o.type==='source')).toBe(true);
     if(object.type!=='extension')continue;
     const data=object.data,key=JSON.stringify(data.definition);
     if(!checked.has(key))checked.set(key,await extensionDefinitionDigest(data.definition));expect(data.definitionDigest).toBe(checked.get(key));
     if(data.definition.typeId.startsWith('ardesia.physics.'))labs.add(data.definition.typeId);
     if(data.definition.typeId==='ardesia.curriculum.question'){expect(String(data.state.prompt).length).toBeGreaterThan(10);expect(String(data.state.solution).length).toBeGreaterThan(3);if(data.state.kind==='assessment')objectives.add(String(data.state.objectives));else if(data.state.kind==='original'){originals.add(String(data.state.questionId));expect(object.provenance?.origin).toBe('authored');expect(String(data.state.solution).length).toBeGreaterThan(200);}else questions.add(String(data.state.questionId));}
    }
   }
   expect(PhysicsImportSchema.safeParse({...pack,input:{...pack.input,units:pack.input.units.map((u,i)=>i?u:{...u,lesson:{...u.lesson,revision:9999}})}}).success).toBe(false);
  }
  const coverage=JSON.parse(readFileSync(new URL('../../../../../docs/sources/physics-2026-27/distributed-coverage.json',import.meta.url),'utf8'));
  expect(coverage).toHaveLength(200);
  for(const row of coverage){const file=manifest.files.find((f:{file:string})=>row.courseId===f.file.replace('.json','')+'-v1');const pack=PhysicsImportSchema.parse(JSON.parse(readFileSync(new URL(file.file,base),'utf8')));const doc=pack.documents.find(d=>d.id===row.lesson.documentId)!;expect(row.lesson.revision).toBe(doc.objects.length+1);for(const id of [...row.practiceObjectIds,...row.originalProblemObjectIds,row.assessmentObjectId,...row.labObjectIds])expect(doc.objects.some(o=>o.id===id)).toBe(true);}
  expect(units).toBe(38);expect(objectives.size).toBe(200);expect(labs.size).toBe(15);expect(questions.size).toBe(259);expect(originals.size).toBe(38);
 });
});
