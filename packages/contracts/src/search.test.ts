import {describe,it,expect} from 'vitest';
import {EducationalObjectSchema,type ExtensionObject,objectSearchText,searchTextExcerpt} from './index';

const object:ExtensionObject={id:'custom',type:'extension',title:'Taccuino originale',revision:3,status:'draft',x:0,y:0,width:300,height:200,
 provenance:{origin:'authored',sources:[],createdBy:'author',createdAt:'2026-11-07T10:00:00.000Z'},
 data:{definition:{format:'ardesia-extension/1',typeId:'personal.unknown-type',version:2,name:'Tipo originale',description:'',license:'CC0',renderer:'personal.renderer/1',fallback:'Contenuto conservato',body:{text:'Testo della composizione'}},definitionDigest:'0'.repeat(64),state:{rows:[{nested:{text:'Lungo contesto. '.repeat(60)+'La frazione di tempo acceso è diversa dalla potenza di picco. ＡＢＣ'}}]}}};
describe('shared object search without executing extensions',()=>{
 it('finds nested new-type content and relevant Unicode excerpts beyond the opening paragraph',()=>{
  const valid=EducationalObjectSchema.parse(object),text=objectSearchText(valid);
  expect(searchTextExcerpt(text,'FRAZIONE   DI TEMPO\nACCESO')).toContain('frazione di tempo acceso');
  expect(searchTextExcerpt(text,'abc')).toContain('ABC');
  expect(searchTextExcerpt(text,'Testo della composizione')).not.toBeNull();
  expect(searchTextExcerpt(text,'mancante')).toBeNull();
  expect(searchTextExcerpt('İ'.repeat(100)+' Bersaglio','bersaglio')).toContain('Bersaglio');
  expect(searchTextExcerpt('İ'.repeat(100)+' Bersaglio','i\u0307 bersaglio')).toContain('İ Bersaglio');
 });
 it('searches program state without evaluating or indexing its code',()=>{
  const program={...object,data:{...object.data,definition:{...object.data.definition,renderer:'ardesia.program/1',body:{code:'throw new Error("NOT_LESSON_PROSE")'}}}};
  expect(objectSearchText(program)).toContain('frazione di tempo acceso');expect(objectSearchText(program)).not.toContain('NOT_LESSON_PROSE');
 });
 it('bounds hostile unvalidated recursion/size and never invokes getters',()=>{
  const cycle:Record<string,unknown>={};cycle.self=cycle;
  Object.defineProperty(cycle,'getter',{enumerable:true,get(){throw Error('must not execute');}});
  const malformed={...object,data:{...object.data,state:{cycle,huge:'x'.repeat(300_000)}}} as ExtensionObject;
  expect(objectSearchText(malformed).length).toBeLessThanOrEqual(262_144);
 });
});
