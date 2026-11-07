import {describe,it,expect} from 'vitest';
import {createCore,MemoryStorage} from '@ardesia/core';
import {conceptLinkDefinition,extensionDefinitionDigest,type Actor,type ConceptLinkState} from '@ardesia/contracts';
import {knowledgeEdges,searchKnowledge} from './graph';
import {readFile} from 'node:fs/promises';
import {PhysicsImportSchema} from '../courses/physics/import';
const actor:Actor={actorId:'author',role:'teacher'};
describe('knowledge links over authorized exact Core revisions',()=>{
 it('finds the original distributed problem through content only present in its Creator state',async()=>{
  const pack=PhysicsImportSchema.parse(JSON.parse(await readFile(new URL('../courses/physics/data/sf-2026-strumenti-meccanica.json',import.meta.url),'utf8')));
  const original=pack.documents.flatMap(d=>d.objects).find(o=>o.title==='La potenza che compare solo durante gli impulsi')!;
  expect(original).toBeDefined();
  const core=await createCore({storage:new MemoryStorage()});
  await core.execute(actor,{kind:'create-document',commandId:'create',documentId:'course',expectedRevision:0,title:'Meccanica'});
  await core.execute(actor,{kind:'add-object',commandId:'add',documentId:'course',expectedRevision:1,object:{...original,provenance:{origin:'imported',sources:[]}}});
  const results=searchKnowledge(core.listDocuments(actor),'FRAZIONE DI TEMPO ACCESO');
  expect(results).toHaveLength(1);expect(results[0]).toMatchObject({object:{id:original.id,revision:1},document:{id:'course',revision:2}});
  expect(results[0]!.excerpt).toContain('frazione di tempo acceso');
  expect(searchKnowledge(core.listDocuments({actorId:'stranger',role:'teacher'}),'frazione')).toEqual([]);
 });
 it('keeps an old target after edits and resolves nothing outside the authorized documents',async()=>{
  const core=await createCore({storage:new MemoryStorage()});
  for(const id of ['from','to']){
   await core.execute(actor,{kind:'create-document',commandId:'create-'+id,documentId:id,expectedRevision:0,title:id});
   await core.execute(actor,{kind:'add-object',commandId:'add-'+id,documentId:id,expectedRevision:1,object:{id:id+'-note',type:'note',title:'Energia '+id,x:0,y:0,width:240,height:120,data:{text:'Energia potenziale originaria'}}});
  }
  const state:ConceptLinkState={sourceDocumentId:'from',sourceDocumentRevision:2,sourceObjectId:'from-note',sourceObjectRevision:1,targetDocumentId:'to',targetDocumentRevision:2,targetObjectId:'to-note',targetObjectRevision:1,sourceTitle:'Energia from',targetTitle:'Energia to',relation:'approfondisce'};
  const definition=conceptLinkDefinition(state);
  await core.execute(actor,{kind:'add-object',commandId:'link',documentId:'from',expectedRevision:2,object:{id:'concept-link',type:'extension',title:'Relazione',x:300,y:0,width:320,height:220,data:{definition,definitionDigest:await extensionDefinitionDigest(definition),state}}});
  await core.execute(actor,{kind:'replace-object',commandId:'change',documentId:'to',expectedRevision:2,object:{id:'to-note',type:'note',title:'Versione successiva',x:0,y:0,width:240,height:120,data:{text:'Una formulazione nuova'}}});
  const alternate={...state,relation:'confronta'};const stable=conceptLinkDefinition(alternate);expect(stable).toEqual(definition);
  await core.execute(actor,{kind:'add-object',commandId:'second-link',documentId:'from',expectedRevision:3,object:{id:'second-concept-link',type:'extension',title:'Confronto',x:700,y:0,width:320,height:220,data:{definition:stable,definitionDigest:await extensionDefinitionDigest(stable),state:alternate}}});
  const docs=core.listDocuments(actor),events=docs.flatMap(d=>core.events(actor,d.id));
  expect(knowledgeEdges(docs,events)[0]?.target).toMatchObject({id:'to-note',revision:1,title:'Energia to'});
  expect(knowledgeEdges(docs.filter(d=>d.id!=='to'),events)[0]?.target).toBeNull();
  expect(knowledgeEdges(docs,[])[0]?.target).toBeNull();
  expect(searchKnowledge(docs,'FORMULAZIONE').map(v=>v.object.id)).toEqual(['to-note']);
  expect(knowledgeEdges(core.listDocuments({actorId:'stranger',role:'teacher'}),events)).toEqual([]);
 });
});
