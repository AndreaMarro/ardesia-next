import {useState} from 'react';
import type {EducationalObject,LessonDocument} from '@ardesia/contracts';
import type {KnowledgeEdge,KnowledgeSelection} from './graph';

const key=(documentId:string,objectId:string)=>JSON.stringify([documentId,objectId]);
const PAGE_SIZE=6;
/** A focused neighborhood of current authorized objects. Historical endpoints
 * are opened explicitly from backlinks, never substituted with current data. */
export function KnowledgeMap({documents,edges,selected,onSelect}:{documents:LessonDocument[];edges:KnowledgeEdge[];selected:KnowledgeSelection|null;onSelect:(document:LessonDocument,object:EducationalObject)=>void}){
 const [paging,setPaging]=useState({center:'',page:0});
 const available=new Map(documents.flatMap(document=>document.objects.map(object=>[key(document.id,object.id),{document,object}] as const)));
 const related=new Set(edges.flatMap(edge=>[...(edge.source?[key(edge.link.sourceDocumentId,edge.link.sourceObjectId)]:[]),...(edge.target?[key(edge.link.targetDocumentId,edge.link.targetObjectId)]:[])]));
 const selectedKey=selected?key(selected.document.id,selected.object.id):null;
 if(selectedKey&&available.has(selectedKey))related.add(selectedKey);
 const all=[...related].flatMap(id=>available.has(id)?[{id,...available.get(id)!}]:[]);
 const center=all.find(node=>node.id===selectedKey)??all[0];if(!center)return null;
 const neighborhood=new Set(edges.flatMap(edge=>{
  if(!edge.source||!edge.target)return [];
  const from=key(edge.link.sourceDocumentId,edge.link.sourceObjectId),to=key(edge.link.targetDocumentId,edge.link.targetObjectId);
  return from===center.id?[to]:to===center.id?[from]:[];
 }));
 const neighbors=all.filter(node=>node.id!==center.id&&neighborhood.has(node.id));
 const page=Math.min(paging.center===center.id?paging.page:0,Math.max(0,Math.ceil(neighbors.length/PAGE_SIZE)-1));
 const nodes=[{...center,x:450,y:210},...neighbors.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map((node,i,values)=>{
  const angle=-Math.PI/2+2*Math.PI*i/values.length;return {...node,x:450+320*Math.cos(angle),y:210+155*Math.sin(angle)};
 })];
 return <section className="knowledge-map" aria-label="Mappa delle relazioni"><div><h2>Una mappa delle tue idee.</h2><p>Esplora un’idea e i suoi vicini. La mappa mostra gli oggetti correnti; i backlink sotto aprono le revisioni conservate dai collegamenti.</p>
  <label>Centro della mappa<select value={center.id} onChange={event=>{const next=all.find(node=>node.id===event.target.value);if(next)onSelect(next.document,next.object);}}>{all.map(node=><option key={node.id} value={node.id}>{node.object.title} · {node.document.title}</option>)}</select></label>
  <div className="knowledge-pagination"><span role="status">{all.length} idee collegate · {neighbors.length} vicini{neighbors.length>PAGE_SIZE?` · ${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,neighbors.length)}`:''}</span>{neighbors.length>PAGE_SIZE&&<><button className="secondary-button" disabled={page===0} onClick={()=>setPaging({center:center.id,page:page-1})}>Vicini precedenti</button><button className="secondary-button" disabled={(page+1)*PAGE_SIZE>=neighbors.length} onClick={()=>setPaging({center:center.id,page:page+1})}>Altri vicini</button></>}</div></div>
  <svg viewBox="0 0 900 420" role="group" aria-label="Nodi e collegamenti concettuali">
   {edges.map(edge=>{const from=nodes.find(n=>n.id===key(edge.link.sourceDocumentId,edge.link.sourceObjectId)),to=nodes.find(n=>n.id===key(edge.link.targetDocumentId,edge.link.targetObjectId));return from&&to&&edge.source&&edge.target?<path key={key(edge.documentId,edge.id)} d={`M${from.x},${from.y} L${to.x},${to.y}`} fill="none" stroke="#9db7aa" strokeWidth="2"><title>{edge.link.relation} · r{edge.link.sourceObjectRevision} → r{edge.link.targetObjectRevision}</title></path>:null;})}
   {nodes.map(node=><g key={node.id} role="button" tabIndex={0} aria-label={'Esplora '+node.object.title} aria-pressed={node.id===center.id} onClick={()=>onSelect(node.document,node.object)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(node.document,node.object);}}} transform={`translate(${node.x},${node.y})`}>
    <title>{node.object.title+' · '+node.document.title}</title><rect x="-100" y="-31" width="200" height="62" rx="12"/><text textAnchor="middle" y="-3">{node.object.title.length>24?node.object.title.slice(0,23)+'…':node.object.title}</text><text className="knowledge-map-revision" textAnchor="middle" y="17">Oggetto · revisione {node.object.revision}</text>
   </g>)}
  </svg>
 </section>;
}
