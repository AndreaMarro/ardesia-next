import {conceptLinkState,projectDocumentRevision,objectSearchText,searchTextExcerpt,type CoreEvent,type EducationalObject,type LessonDocument,type ConceptLinkState} from '@ardesia/contracts';
export type KnowledgeSelection={document:LessonDocument;object:EducationalObject};
export type KnowledgeEdge={id:string;documentId:string;link:ConceptLinkState;source:EducationalObject|null;target:EducationalObject|null;sourceDocument:LessonDocument|null;targetDocument:LessonDocument|null};
/** A derived view over already authorized documents/events. No storage and no
 * network lookup of missing/foreign IDs; unavailable references stay unresolved. */
export function knowledgeEdges(documents:readonly LessonDocument[],events:readonly CoreEvent[]):KnowledgeEdge[]{
 const cache=new Map<string,LessonDocument|null>();
 function endpoint(id:string,revision:number,objectId:string,objectRevision:number){
  const allowed=documents.find(d=>d.id===id);if(!allowed)return null;
  const key=id+':'+revision;
  if(!cache.has(key)){try{cache.set(key,allowed.revision===revision?allowed:projectDocumentRevision(events,id,revision));}catch{cache.set(key,null);}}
  const document=cache.get(key),object=document?.objects.find(o=>o.id===objectId&&o.revision===objectRevision);
  return document&&object?{document,object}:null;
 }
 return documents.flatMap(document=>document.objects.flatMap(object=>{
  if(object.type!=='extension')return [];
  const link=conceptLinkState(object);if(!link)return [];
  const source=endpoint(link.sourceDocumentId,link.sourceDocumentRevision,link.sourceObjectId,link.sourceObjectRevision),target=endpoint(link.targetDocumentId,link.targetDocumentRevision,link.targetObjectId,link.targetObjectRevision);
  return [{id:object.id,documentId:document.id,link,source:source?.object??null,target:target?.object??null,sourceDocument:source?.document??null,targetDocument:target?.document??null}];
 }));
}
export function searchKnowledge(documents:readonly LessonDocument[],query:string){
 return documents.flatMap(doc=>doc.objects.flatMap(object=>{
  const excerpt=searchTextExcerpt(objectSearchText(object)+'\n'+doc.title,query);
  return excerpt!==null?[{document:doc,object,excerpt}]:[];
 }));
}
