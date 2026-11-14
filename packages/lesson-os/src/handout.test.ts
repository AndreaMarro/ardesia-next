import {describe,expect,it} from 'vitest';
import {type LessonDocument,type SourceObject} from '@ardesia/contracts';
import {projectHandout} from './index';
const time='2026-11-07T10:00:00.000Z';
const base={title:'Fonte',x:0,y:100,width:200,height:100,revision:1,status:'draft' as const,provenance:{origin:'authored' as const,sources:[],createdBy:'teacher',createdAt:time}};
const source:SourceObject={...base,id:'source',type:'source',data:{url:'https://example.org',publisher:'Originale',locator:'pagina 7',sourceRevision:'Edizione 1',license:'CC BY 4.0'}};
const lesson:LessonDocument={id:'lesson',ownerId:'teacher',title:'Il pendolo',revision:5,status:'draft',createdAt:time,updatedAt:time,connections:[],objects:[{...source,revision:2,data:{...source.data,publisher:'Revisione corrente'}},{...base,id:'formula',type:'formula',y:0,data:{latex:'T=2\\pi\\sqrt{L/g}',description:'Piccoli angoli'},provenance:{...base.provenance,sources:[{sourceId:'source',revision:1,locator:'equazione 2'}]}}]};
describe('confirmed handout projection',()=>{
  it('retains exact historical citations, saved identities and draft status without sharing references',()=>{
    const original=structuredClone(lesson),out=projectHandout(lesson,[source]);
    expect(out.document.objects.map(o=>o.id)).toEqual(['formula','source']);
    expect(out.document).toMatchObject({id:'lesson',revision:5,status:'draft'});
    expect(out.sources.find(s=>s.revision===1)?.data.publisher).toBe('Originale');
    expect(out.sources.find(s=>s.revision===2)?.data.publisher).toBe('Revisione corrente');
    expect(out.missingSources).toEqual([]);
    out.sources[0]!.data.publisher='Changed';out.document.objects[0]!.title='Changed';
    expect(lesson).toEqual(original);expect(source.data.publisher).toBe('Originale');
  });
  it('reports an unavailable cited revision without silently substituting the current source',()=>{
    const out=projectHandout(lesson);
    expect(out.missingSources).toEqual([{sourceId:'source',revision:1,locator:'equazione 2'}]);
    expect(out.sources).toHaveLength(1);expect(out.sources[0]!.revision).toBe(2);
  });
  it('rejects unrelated, conflicting and non-source historical data',()=>{
    expect(()=>projectHandout(lesson,[{...source,id:'private-unrelated'}])).toThrow();
    expect(()=>projectHandout(lesson,[source,{...source,title:'Conflicting history'}])).toThrow();
    expect(()=>projectHandout(lesson,[{...lesson.objects[1]!,id:'source'}])).toThrow();
  });
  it('rejects a mixed learner export instead of including private work implicitly',()=>{
    expect(()=>projectHandout({...lesson,notes:'PRIVATE'} as LessonDocument)).toThrow();
  });
});
