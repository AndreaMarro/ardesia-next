import {useMemo,useState} from 'react';
import {conceptLinkDefinition,extensionDefinitionDigest,ownsWorkspace,type LessonDocument,type EducationalObject,type ConceptLinkState} from '@ardesia/contracts';
import type {RemoteClient} from '@ardesia/remote-client';
import {ObjectContent} from '../components/ObjectContent';
import {knowledgeEdges,searchKnowledge} from './graph';
import './knowledge.css';
import {KnowledgeMap} from './KnowledgeMap';
type Selection={document:LessonDocument;object:EducationalObject};
export default function KnowledgeStudio({client,onClose,onOpenLesson}:{client:RemoteClient;onClose:()=>void;onOpenLesson:(id:string)=>void}){
 const projection=client.projection!,documents=projection.documents,actor=projection.actor;
 const [query,setQuery]=useState(''),[selected,setSelected]=useState<Selection|null>(null),[target,setTarget]=useState(''),[relation,setRelation]=useState('approfondisce');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const matches=useMemo(()=>searchKnowledge(documents,query),[projection.workspaceRevision,query]);
 const edges=useMemo(()=>knowledgeEdges(documents,projection.events),[projection.workspaceRevision]);
 const refs=documents.flatMap(document=>document.objects.filter(o=>o.type!=='ink').map(object=>({document,object,key:JSON.stringify([document.id,object.id])})));
 const backlinks=edges.filter(edge=>selected&&(edge.link.targetObjectId===selected.object.id&&edge.link.targetDocumentId===selected.document.id||edge.link.sourceObjectId===selected.object.id&&edge.link.sourceDocumentId===selected.document.id));
 async function connect(){
  if(!selected||busy)return;const to=refs.find(ref=>ref.key===target);if(!to)return;
  setBusy(true);setError('');
  try{
   const fromDoc=documents.find(d=>d.id===selected.document.id),from=fromDoc?.objects.find(o=>o.id===selected.object.id);
   if(!fromDoc||!from||fromDoc.revision!==selected.document.revision)throw Error('La lezione è cambiata. Seleziona di nuovo la fonte prima di collegarla.');
   const state:ConceptLinkState={sourceDocumentId:fromDoc.id,sourceDocumentRevision:fromDoc.revision,sourceObjectId:from.id,sourceObjectRevision:from.revision,
    targetDocumentId:to.document.id,targetDocumentRevision:to.document.revision,targetObjectId:to.object.id,targetObjectRevision:to.object.revision,sourceTitle:from.title,targetTitle:to.object.title,relation:relation.trim()};
   const definition=conceptLinkDefinition(state),definitionDigest=await extensionDefinitionDigest(definition);
   await client.edit(actor,fromDoc.id,{kind:'add-object',object:{id:crypto.randomUUID(),type:'extension',title:(from.title+' → '+to.object.title).slice(0,240),x:Math.min(100000,from.x+from.width+40),y:from.y,width:320,height:220,data:{definition,definitionDigest,state}}});
   setTarget('');setSelected(null);
  }catch(reason){setError(reason instanceof Error?reason.message:'Collegamento non confermato.');}finally{setBusy(false);}
 }
 return <main className="knowledge-studio"><header><a className="wordmark" href="#" onClick={e=>{e.preventDefault();onClose();}}>Ardesia<span>.</span></a><button className="secondary-button" disabled={busy} onClick={onClose}>Torna alla lavagna</button></header>
  <section className="knowledge-intro"><span className="eyebrow">Il filo delle idee</span><h1>La tua conoscenza,<br/>in relazione.</h1><p>Ritrova gli oggetti delle tue lezioni. Collega un’idea a un’altra conservando le revisioni da cui sei partito.</p><label>Cerca nel tuo archivio<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Un concetto, una formula, una fonte…"/></label></section>
  {error&&<p role="alert">{error}</p>}
  <KnowledgeMap documents={documents} edges={edges} onSelect={(document,object)=>{setSelected({document,object});setTarget('');setError('');}}/>
  <div className="knowledge-layout"><section aria-label="Oggetti del tuo archivio"><p className="hint">{matches.length} oggetti · {edges.length} collegamenti concettuali</p><div className="knowledge-list">{matches.slice(0,200).map(({document,object,excerpt})=><button key={document.id+':'+object.id} className="knowledge-card" onClick={()=>{setSelected({document,object});setTarget('');setError('');}}><small>{document.title} · r{object.revision}</small><strong>{object.title}</strong><span>{excerpt}</span></button>)}</div>{matches.length>200&&<p>Affina la ricerca per vedere gli altri risultati.</p>}</section>
   <aside aria-label="Collegamenti e backlink">{selected?<><span className="eyebrow">{selected.document.title}</span><h2>{selected.object.title}</h2><ObjectContent object={selected.object} links/><button className="text-button" disabled={busy} onClick={()=>onOpenLesson(selected.document.id)}>Apri la lezione originale</button>
    <h3>Collegamenti e backlink</h3>{backlinks.map(edge=><article className="knowledge-link" key={edge.id}><strong>{edge.source?.title??'Fonte non disponibile'}</strong><span>→ {edge.link.relation} →</span><strong>{edge.target?.title??'Destinazione non disponibile'}</strong><small>Revisioni {edge.link.sourceObjectRevision} → {edge.link.targetObjectRevision}</small></article>)}{!backlinks.length&&<p>Questa idea non ha ancora collegamenti.</p>}
    {ownsWorkspace(projection)&&<form onSubmit={e=>{e.preventDefault();void connect();}}><h3>Collega un’altra idea</h3><label>Relazione<input value={relation} onChange={e=>setRelation(e.target.value)} maxLength={200} required/></label><label>Destinazione<select value={target} onChange={e=>setTarget(e.target.value)} required><option value="">Scegli un oggetto</option>{refs.filter(ref=>ref.object.id!==selected.object.id||ref.document.id!==selected.document.id).map(ref=><option key={ref.key} value={ref.key}>{ref.document.title} · {ref.object.title}</option>)}</select></label><button className="primary-button" disabled={busy||!target||!relation.trim()}>Crea collegamento</button><p className="hint">Il collegamento viene salvato come oggetto nella lezione di partenza. Le due fonti restano alle revisioni scelte.</p></form>}
   </>:<><h2>Segui una connessione.</h2><p>Seleziona un oggetto per esplorare le relazioni in entrata e in uscita.</p></>}</aside>
  </div>
 </main>;
}
