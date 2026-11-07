import {describe,it,expect} from 'vitest';
import {createCore,MemoryStorage} from '@ardesia/core';
import {conceptLinkDefinition,extensionDefinitionDigest,type Actor,type ConceptLinkState} from '@ardesia/contracts';
import {knowledgeEdges,searchKnowledge} from './graph';
const actor:Actor={actorId:'author',role:'teacher'};
describe('knowledge links over authorized exact Core revisions',()=>{
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
