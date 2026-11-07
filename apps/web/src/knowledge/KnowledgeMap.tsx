import type {EducationalObject,LessonDocument} from '@ardesia/contracts';
import type {KnowledgeEdge} from './graph';

/** Navigation is limited to the current authorized objects. Exact historical
 * endpoints remain in the relation list; a missing endpoint is never fetched. */
export function KnowledgeMap({documents,edges,onSelect}:{documents:LessonDocument[];edges:KnowledgeEdge[];onSelect:(document:LessonDocument,object:EducationalObject)=>void}){
 const key=(documentId:string,objectId:string)=>JSON.stringify([documentId,objectId]);
 const available=new Map(documents.flatMap(document=>document.objects.map(object=>[key(document.id,object.id),{document,object}] as const)));
 const related=new Set(edges.flatMap(edge=>[...(edge.source?[key(edge.link.sourceDocumentId,edge.link.sourceObjectId)]:[]),...(edge.target?[key(edge.link.targetDocumentId,edge.link.targetObjectId)]:[])]));
 const all=[...related].flatMap(id=>available.has(id)?[{id,...available.get(id)!}]:[]);
 const nodes=all.slice(0,8).map((node,i,values)=>{const angle=-Math.PI/2+2*Math.PI*i/values.length;return {...node,x:450+320*Math.cos(angle),y:210+155*Math.sin(angle)};});
 if(!nodes.length)return null;
 return <section className="knowledge-map" aria-label="Mappa delle relazioni"><div><h2>Una mappa delle tue idee.</h2><p>Seleziona un nodo per esplorarlo. I collegamenti sotto conservano le revisioni originali.{all.length>8?' Sono mostrati i primi otto nodi; tutti gli oggetti restano ricercabili.':''}</p></div>
  <svg viewBox="0 0 900 420" role="group" aria-label="Nodi e collegamenti concettuali">
   {edges.map(edge=>{const from=nodes.find(n=>n.id===key(edge.link.sourceDocumentId,edge.link.sourceObjectId)),to=nodes.find(n=>n.id===key(edge.link.targetDocumentId,edge.link.targetObjectId));return from&&to&&edge.source&&edge.target?<path key={edge.id} d={`M${from.x},${from.y} Q450,210 ${to.x},${to.y}`} fill="none" stroke="#9db7aa" strokeWidth="2"><title>{edge.link.relation} · r{edge.link.sourceObjectRevision} → r{edge.link.targetObjectRevision}</title></path>:null;})}
   {nodes.map(node=><g key={node.id} role="button" tabIndex={0} aria-label={'Esplora '+node.object.title} onClick={()=>onSelect(node.document,node.object)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(node.document,node.object);}}} transform={`translate(${node.x},${node.y})`}>
    <title>{node.object.title+' · '+node.document.title}</title><rect x="-100" y="-31" width="200" height="62" rx="12"/><text textAnchor="middle" y="-3">{node.object.title.length>24?node.object.title.slice(0,23)+'…':node.object.title}</text><text className="knowledge-map-revision" textAnchor="middle" y="17">Oggetto · revisione {node.object.revision}</text>
   </g>)}
  </svg>
 </section>;
}
