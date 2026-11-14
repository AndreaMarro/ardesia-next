import {ExtensionView} from '../creator/ExtensionView';
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {planHandout,type Handout} from '@ardesia/lesson-os';
import {useMaterials} from '../materials/MaterialView';
import {prepareHandoutAssets} from './assets';
import {buildHandoutFiles,handoutZip,type PreparedHandout} from './bundle';
import {inkPlates,materialPlate,placedInkPath,INK_PRINT_MM_PER_UNIT,type InkPlate} from './plates';
import {PROGRAM_RENDERER,type EducationalObject,type SourceObject,type InkObject} from '@ardesia/contracts';
import {Dialog} from '../components/Dialog';
import {MathFormula} from '../components/MathFormula';
import {inkPath} from '../components/board-geometry';
import {inkBounds} from './latex';

export function HandoutView({handout,onClose,notice=''}:{handout:Handout;onClose:()=>void;notice?:string}){
  const {document:lesson,sources,missingSources}=handout;
  const scope=useMaterials(),[prepared,setPrepared]=useState<PreparedHandout|null>(null),[images,setImages]=useState<Record<string,string>>({});
  const [exported,setExported]=useState<Record<string,Uint8Array>|null>(null);
  const [printing,setPrinting]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState('Preparazione della dispensa…'),[attempt,setAttempt]=useState(0);
  const controller=useRef<AbortController|null>(null),activeUrls=useRef<string[]>([]);
  useEffect(()=>{
    const abort=new AbortController();controller.current=abort;setPrepared(null);setExported(null);setImages({});setError('');setProgress('Preparazione della dispensa…');
    const urls:string[]=[];activeUrls.current=urls;
    void (async()=>{
      const result=await prepareHandoutAssets(handout,async data=>{if(!scope)throw Error('Materiali non disponibili.');return scope.load(data);},async data=>{if(!scope)throw Error('Materiali non disponibili.');await scope.access().read(data.assetId,scope.course);},abort.signal,notice,setProgress);
      const generated=await buildHandoutFiles(result);abort.signal.throwIfAborted();
      const next:Record<string,string>={};
      for(const asset of result.assets){
        const url=URL.createObjectURL(new Blob([new Uint8Array(result.files[asset.rasterPath]!).buffer],{type:'image/png'}));urls.push(url);next[asset.objectId]=url;
        const image=new Image();image.src=url;await image.decode();abort.signal.throwIfAborted();
      }
      // Image decoding may take time: reauthorize this exact frozen generation
      // immediately before committing the ready state.
      for(const object of lesson.objects)if(object.type==='material'){
        abort.signal.throwIfAborted();if(!scope)throw Error('Materiali non disponibili.');
        await scope.access().read(object.data.assetId,scope.course);abort.signal.throwIfAborted();
      }
      setExported(generated);setImages(next);setPrepared(result);setProgress('');
    })().catch(reason=>{for(const url of urls)URL.revokeObjectURL(url);if(!abort.signal.aborted){setError(reason instanceof Error?reason.message:'Dispensa non disponibile. Riprova.');setProgress('');}});
    return()=>{abort.abort();for(const url of urls)URL.revokeObjectURL(url);};
  },[handout,scope,notice,attempt]);
  const ready=prepared?.handout===handout;
  const tex=useMemo(()=>ready&&exported?{source:new TextDecoder().decode(exported['main.tex']!),warnings:JSON.parse(new TextDecoder().decode(exported['warnings.json']!)) as string[]}:null,[ready,exported]);
  const plan=useMemo(()=>planHandout(handout),[handout]);
  async function authorize(){
    const signal=controller.current!.signal;signal.throwIfAborted();
    try{
      for(const object of lesson.objects)if(object.type==='material'){if(!scope)throw Error('Materiali non disponibili.');await scope.access().read(object.data.assetId,scope.course);signal.throwIfAborted();}
    }catch(reason){
      if(!signal.aborted){setPrepared(null);setExported(null);setImages({});for(const url of activeUrls.current)URL.revokeObjectURL(url);controller.current?.abort();setPrinting(false);setError('L’accesso ai materiali non è stato confermato. Anteprima chiusa; riprova la preparazione.');}
      throw reason;
    }
    return signal;
  }
  async function print(){
    if(!ready)return;setPrinting(true);setError('');
    try{const signal=await authorize();await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));signal.throwIfAborted();await authorize();signal.throwIfAborted();window.print();}
    catch(reason){if(!controller.current?.signal.aborted)setError(reason instanceof Error?reason.message:'La stampa non è partita.');}
    finally{if(!controller.current?.signal.aborted)setPrinting(false);}
  }
  async function download(bundle:boolean){
    if(!ready||!prepared||!tex)return;setPrinting(true);setError('');
    try{
      const signal=await authorize();const blob=bundle?await handoutZip(prepared):new Blob([tex.source],{type:'application/x-tex;charset=utf-8'});signal.throwIfAborted();await authorize();signal.throwIfAborted();
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ardesia-'+lesson.id+'-r'+lesson.revision+(bundle?'.zip':'.tex');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(reason){if(!controller.current?.signal.aborted)setError(reason instanceof Error?reason.message:'Esportazione non completata.');}
    finally{if(!controller.current?.signal.aborted)setPrinting(false);}
  }
  return createPortal(<div className="handout-portal"><Dialog title="Dispensa della lezione" onClose={onClose} className="handout-dialog">
    <div className="handout-controls"><div><p>Una copia della revisione {lesson.revision}. Torna alla lezione per continuare a modificarla.</p><p>Stampa una copia pronta oppure conserva il pacchetto con LaTeX/TikZ, fonti e originali.</p></div><button className="primary-button" disabled={printing||!ready} onClick={()=>void print()}>{printing?'Preparazione…':'Stampa / PDF'}</button><button className="secondary-button" disabled={printing||!ready} onClick={()=>void download(true)}>Scarica pacchetto completo</button>{!lesson.objects.some(o=>o.type==='material')&&<button className="secondary-button" disabled={printing||!ready} onClick={()=>void download(false)}>Scarica LaTeX</button>}</div>
    {notice&&<p className="handout-screen-note">{notice}</p>}
    {!!tex?.warnings.length&&<details className="handout-screen-note"><summary>Conversione LaTeX: {tex.warnings.length} avvisi</summary><ul>{tex.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
    {progress&&<p className="handout-screen-note" role="status">{progress}</p>}{error&&<p className="handout-screen-note" role="alert">{error} <button className="secondary-button" onClick={()=>setAttempt(n=>n+1)}>Riprova preparazione</button></p>}
    {ready&&<article className="handout-paper" aria-label="Dispensa pronta" data-document-id={lesson.id} data-revision={lesson.revision}>
      <header className="handout-title"><p className="handout-eyebrow">Ardesia / Dispensa</p><h1>{lesson.title}</h1><p>Revisione {lesson.revision} · {lesson.status==='draft'?'DRAFT · non approvata':'Stato salvato: approved'}</p><p className="handout-small">{lesson.id} · {lesson.updatedAt}</p></header>
      <p className="handout-scope">Copia statica in ordine spaziale, non una ricostruzione didattica. Le tavole conservano la geometria della scrittura e delle annotazioni. Bozze, modifiche in attesa, audio e lavoro personale degli studenti non sono inclusi. Le formule troppo larghe vengono ridotte per entrare nella pagina.</p>
      {!lesson.objects.length&&<p>Questa revisione non contiene oggetti.</p>}
      {plan.blocks.flatMap((block,index)=>{
        const ink=lesson.objects.filter((o):o is InkObject=>o.type==='ink'&&block.inkIds.includes(o.id));
        if(block.kind==='ink')return inkPlates(ink).map((plate,i)=><section className="handout-object handout-ink" key={plate.id} data-handout-object={plate.ink[0]?.object.id}><h2>Scrittura · tavola {i+1}</h2><PlateView plate={plate}/><p className="handout-small">Scala comune fra le tavole. Un tratto sul bordo continua nella tavola adiacente.</p></section>);
        const object=lesson.objects.find(o=>o.id===block.objectId)!;
        return <section className={'handout-object handout-'+object.type} key={index} data-handout-object={object.id}><h2>{object.title}</h2>{object.type==='material'?<><PlateView plate={materialPlate(object,ink)} image={images[object.id]}/><p className="handout-small">{object.data.name} · pagina {object.data.page} di {object.data.pageCount} · {object.data.license}. Originale completo nel pacchetto; testo rasterizzato.</p></>:<StaticContent object={object}/>}<p className="handout-small">Oggetto {object.id} · revisione {object.revision} · {object.status==='draft'?'DRAFT':'approved'}</p></section>;
      })}
      {notice&&<p className="handout-warning">{notice}</p>}
      {!!tex?.warnings.length&&<section className="handout-conversions"><h2>Conversioni e limiti</h2><ul>{tex.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></section>}
      <section className="handout-provenance"><h2>Fonti e provenienza</h2>
        {!!missingSources.length&&<p className="handout-warning">{missingSources.length} revisioni di fonte non disponibili in questa copia. I riferimenti esatti sono conservati; nessuna versione corrente li sostituisce.</p>}
        {lesson.objects.map(object=><section key={object.id}><h3>{object.title}</h3><p className="handout-small">{object.id} · revisione {object.revision} · {object.provenance.origin==='authored'?'Creato in Ardesia':'Importato'} · autore {object.provenance.createdBy} · {object.provenance.createdAt}</p>
          {object.type==='lab'&&<p className="handout-small">Istanza {object.data.instanceId} · editore {object.data.publisher.id} · chiave {object.data.publisher.keyId} · stato {object.data.stateSchemaVersion} · digest {object.data.bundleDigest}</p>}
          {object.provenance.sources.map((ref,i)=>{const source=sources.find(s=>s.id===ref.sourceId&&s.revision===ref.revision);return <div className="handout-citation" key={i}><p>{ref.locator} · {ref.sourceId} · revisione {ref.revision}</p>{source?<><p>{source.title} · {source.status==='draft'?'DRAFT':'approved'}</p><SourceData source={source}/></>:<p>Revisione non disponibile.</p>}</div>;})}</section>)}
      </section>
      {!!lesson.connections.length&&<section className="handout-connections"><h2>Collegamenti</h2>{lesson.connections.map(c=><p key={c.id}>{lesson.objects.find(o=>o.id===c.from)!.title} → {lesson.objects.find(o=>o.id===c.to)!.title}: {c.label}<br/><span className="handout-small">{c.from} → {c.to} · {c.id}</span></p>)}</section>}
      <footer className="handout-end">Ardesia · lezione {lesson.id} · revisione {lesson.revision}</footer>
    </article>}
  </Dialog></div>,document.body);
}
function PlateView({plate,image}:{plate:InkPlate;image?:string}){
  const b=plate.bounds;
  return <svg className="handout-plate" role="img" aria-label={plate.material?.title??'Scrittura con geometria originale'} viewBox={[b.left,b.top,b.width,b.height].join(' ')} style={{aspectRatio:b.width+'/'+b.height,...(!plate.material?{width:b.width*INK_PRINT_MM_PER_UNIT+'mm'}:{})}}>
    {plate.material&&image&&<image href={image} x={0} y={0} width={plate.material.width} height={plate.material.height}/>}
    {plate.ink.map(ink=><path key={ink.object.id} data-ink-object={ink.object.id} d={placedInkPath(ink,b)} fill={ink.object.data.color}/>)}
  </svg>;
}
function SourceData({source}:{source:SourceObject}){return <div className="handout-source"><p>{source.data.publisher} · {source.data.locator}<br/>{source.data.sourceRevision}</p><p><a href={source.data.url} target="_blank" rel="noreferrer">{source.data.url}</a></p><p>{source.data.license}</p><p className="handout-small">{source.provenance.origin} · autore {source.provenance.createdBy} · {source.provenance.createdAt}{source.provenance.sources.map((ref,i)=><span key={i}> · {ref.sourceId} / revisione {ref.revision}: {ref.locator}</span>)}</p></div>;}
function StaticContent({object}:{object:EducationalObject}){
  switch(object.type){
    case 'material':return <p>Originale {object.data.name} · pagina {object.data.page}/{object.data.pageCount}. SHA-256 {object.data.sha256}. Il file e le annotazioni ancorate si consultano nella lezione; i byte originali non sono incorporati in questa dispensa.</p>;
    case 'note':return <p className="handout-text">{object.data.text}</p>;
    case 'formula':return <><HandoutMath latex={object.data.latex}/><p>{object.data.description}</p></>;
    case 'source':return <SourceData source={object}/>;
    case 'extension':return <>{object.data.definition.renderer===PROGRAM_RENDERER?<p>{object.data.definition.fallback}</p>:<ExtensionView data={object.data}/>}<p className="handout-small">{object.data.definition.typeId} · v{object.data.definition.version} · {object.data.definition.license}. Rappresentazione statica dei valori salvati.</p><pre className="handout-data">{JSON.stringify(object.data.state,null,2)}</pre></>;
    case 'lab':return <><p>Laboratorio statico · {object.data.pluginId}@{object.data.pluginVersion}. Nessuna simulazione viene eseguita.</p><pre className="handout-data">{JSON.stringify(object.data.state,null,2)}</pre></>;
    case 'ink':{const b=inkBounds(object);return <svg className="handout-ink-svg" role="img" aria-label={object.title} viewBox={`${b.left} ${b.top} ${b.width} ${b.height}`}><path d={inkPath(object.data.points,object.data.width)} fill={object.data.color}/></svg>;}
  }
}
function HandoutMath({latex}:{latex:string}){
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const element=ref.current!;let live=true,lastWidth=0;
    const fit=()=>{
      if(!live)return;
      element.style.fontSize='1em';
      const math=element.querySelector<HTMLElement>('.katex-display > .katex');
      if(math&&math.scrollWidth>element.clientWidth)element.style.fontSize=`${element.clientWidth/math.scrollWidth*.98}em`;
      lastWidth=element.clientWidth;
    };
    const observer=new ResizeObserver(()=>{if(element.clientWidth!==lastWidth)fit();});observer.observe(element);
    fit();void document.fonts.ready.then(fit);window.addEventListener('beforeprint',fit);window.addEventListener('afterprint',fit);
    return()=>{live=false;observer.disconnect();window.removeEventListener('beforeprint',fit);window.removeEventListener('afterprint',fit);};
  },[latex]);
  return <div ref={ref} className="handout-math"><MathFormula latex={latex}/></div>;
}
