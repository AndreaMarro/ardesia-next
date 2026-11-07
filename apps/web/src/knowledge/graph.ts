import {conceptLinkState,projectDocumentRevision,type CoreEvent,type EducationalObject,type LessonDocument,type ConceptLinkState} from '@ardesia/contracts';
export type KnowledgeEdge={id:string;documentId:string;link:ConceptLinkState;source:EducationalObject|null;target:EducationalObject|null};
/** A derived view over already authorized documents/events. No storage and no
 * network lookup of missing/foreign IDs; unavailable references stay unresolved. */
export function knowledgeEdges(documents:readonly LessonDocument[],events:readonly CoreEvent[]):KnowledgeEdge[]{
 const cache=new Map<string,LessonDocument|null>();
 function endpoint(id:string,revision:number,objectId:string,objectRevision:number){
  const allowed=documents.find(d=>d.id===id);if(!allowed)return null;
  const key=id+':'+revision;
  if(!cache.has(key)){try{cache.set(key,allowed.revision===revision?allowed:projectDocumentRevision(events,id,revision));}catch{cache.set(key,null);}}
  return cache.get(key)?.objects.find(o=>o.id===objectId&&o.revision===objectRevision)??null;
 }
 return documents.flatMap(document=>document.objects.flatMap(object=>{
  if(object.type!=='extension')return [];
  const link=conceptLinkState(object);if(!link)return [];
  return [{id:object.id,documentId:document.id,link,source:endpoint(link.sourceDocumentId,link.sourceDocumentRevision,link.sourceObjectId,link.sourceObjectRevision),target:endpoint(link.targetDocumentId,link.targetDocumentRevision,link.targetObjectId,link.targetObjectRevision)}];
 }));
}
export function searchKnowledge(documents:readonly LessonDocument[],query:string){
 const normalize=(text:string)=>text.normalize('NFKC').toLocaleLowerCase('it'),needle=normalize(query);
 return documents.flatMap(doc=>doc.objects.flatMap(object=>{
  const text=object.type==='note'?object.data.text:object.type==='formula'?object.data.latex+' '+object.data.description:object.type==='source'?object.data.publisher+' '+object.data.locator:object.type==='extension'?object.data.definition.description:'';
  return normalize(doc.title+' '+object.title+' '+text).includes(needle)?[{document:doc,object,excerpt:text.slice(0,220)}]:[];
 }));
}
