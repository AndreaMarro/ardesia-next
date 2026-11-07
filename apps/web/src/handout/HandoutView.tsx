import {ExtensionView} from '../creator/ExtensionView';
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {Handout} from '@ardesia/lesson-os';
import type {EducationalObject, SourceObject} from '@ardesia/contracts';
import {Dialog} from '../components/Dialog';
import {MathFormula} from '../components/MathFormula';
import {inkPath} from '../components/board-geometry';
import {handoutLatex, inkBounds} from './latex';

export function HandoutView({handout,onClose,notice=''}:{handout:Handout;onClose:()=>void;notice?:string}){
  const {document:lesson,sources,missingSources}=handout;
  const tex=useMemo(()=>handoutLatex(handout),[handout]);
  const [printing,setPrinting]=useState(false),[error,setError]=useState('');
  const live=useRef(true);
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  async function print(){
    setPrinting(true);setError('');
    try{await document.fonts.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));if(live.current)window.print();}
    catch{if(live.current)setError('La stampa non è partita. Puoi riprovare o scaricare il sorgente.');}
    finally{if(live.current)setPrinting(false);}
  }
  function download(){
    const url=URL.createObjectURL(new Blob([tex.source],{type:'application/x-tex;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`ardesia-${lesson.id}-r${lesson.revision}.tex`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return createPortal(<div className="handout-portal"><Dialog title="Dispensa della lezione" onClose={onClose} className="handout-dialog">
    <div className="handout-controls"><div><p>Una copia della revisione {lesson.revision}. Torna alla lezione per continuare a modificarla.</p><p>Stampa e scegli «Salva come PDF», oppure scarica LaTeX/TikZ.</p></div><button className="primary-button" disabled={printing} onClick={()=>void print()}>{printing?'Preparazione…':'Stampa / PDF'}</button><button className="secondary-button" onClick={download}>Scarica LaTeX</button></div>
    {notice&&<p className="handout-screen-note">{notice}</p>}
    {!!tex.warnings.length&&<details className="handout-screen-note"><summary>Conversione LaTeX: {tex.warnings.length} avvisi</summary><ul>{tex.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
    {error&&<p role="alert">{error}</p>}
    <article className="handout-paper" aria-label="Dispensa pronta" data-document-id={lesson.id} data-revision={lesson.revision}>
      <header className="handout-title"><p className="handout-eyebrow">Ardesia / Dispensa</p><h1>{lesson.title}</h1><p>Revisione {lesson.revision} · {lesson.status==='draft'?'DRAFT · non approvata':'Stato salvato: approved'}</p><p className="handout-small">{lesson.id} · {lesson.updatedAt}</p></header>
      <p className="handout-scope">Copia statica in ordine di lettura. Le posizioni della lavagna non sono riprodotte. Bozze, modifiche in attesa, audio e lavoro personale degli studenti non sono inclusi. Le formule troppo larghe vengono ridotte per entrare nella pagina.</p>
      {!lesson.objects.length&&<p>Questa revisione non contiene oggetti.</p>}
      {lesson.objects.map(object=><section className={'handout-object handout-'+object.type} key={object.id} data-handout-object={object.id}><h2>{object.title}</h2><StaticContent object={object}/><p className="handout-small">Oggetto {object.id} · revisione {object.revision} · {object.status==='draft'?'DRAFT':'approved'}</p></section>)}
      <section className="handout-provenance"><h2>Fonti e provenienza</h2>
        {!!missingSources.length&&<p className="handout-warning">{missingSources.length} revisioni di fonte non disponibili in questa copia. I riferimenti esatti sono conservati; nessuna versione corrente li sostituisce.</p>}
        {lesson.objects.map(object=><section key={object.id}><h3>{object.title}</h3><p className="handout-small">{object.id} · revisione {object.revision} · {object.provenance.origin==='authored'?'Creato in Ardesia':'Importato'} · autore {object.provenance.createdBy} · {object.provenance.createdAt}</p>
          {object.type==='lab'&&<p className="handout-small">Istanza {object.data.instanceId} · editore {object.data.publisher.id} · chiave {object.data.publisher.keyId} · stato {object.data.stateSchemaVersion} · digest {object.data.bundleDigest}</p>}
          {object.provenance.sources.map((ref,i)=>{const source=sources.find(s=>s.id===ref.sourceId&&s.revision===ref.revision);return <div className="handout-citation" key={i}><p>{ref.locator} · {ref.sourceId} · revisione {ref.revision}</p>{source?<><p>{source.title} · {source.status==='draft'?'DRAFT':'approved'}</p><SourceData source={source}/></>:<p>Revisione non disponibile.</p>}</div>;})}</section>)}
      </section>
      {!!lesson.connections.length&&<section className="handout-connections"><h2>Collegamenti</h2>{lesson.connections.map(c=><p key={c.id}>{lesson.objects.find(o=>o.id===c.from)!.title} → {lesson.objects.find(o=>o.id===c.to)!.title}: {c.label}<br/><span className="handout-small">{c.from} → {c.to} · {c.id}</span></p>)}</section>}
      <footer className="handout-end">Ardesia · lezione {lesson.id} · revisione {lesson.revision}</footer>
    </article>
  </Dialog></div>,document.body);
}
function SourceData({source}:{source:SourceObject}){return <div className="handout-source"><p>{source.data.publisher} · {source.data.locator}<br/>{source.data.sourceRevision}</p><p><a href={source.data.url} target="_blank" rel="noreferrer">{source.data.url}</a></p><p>{source.data.license}</p><p className="handout-small">{source.provenance.origin} · autore {source.provenance.createdBy} · {source.provenance.createdAt}{source.provenance.sources.map((ref,i)=><span key={i}> · {ref.sourceId} / revisione {ref.revision}: {ref.locator}</span>)}</p></div>;}
function StaticContent({object}:{object:EducationalObject}){
  switch(object.type){
    case 'material':return <p>Originale {object.data.name} · pagina {object.data.page}/{object.data.pageCount}. SHA-256 {object.data.sha256}. Il file e le annotazioni ancorate si consultano nella lezione; i byte originali non sono incorporati in questa dispensa.</p>;
    case 'note':return <p className="handout-text">{object.data.text}</p>;
    case 'formula':return <><HandoutMath latex={object.data.latex}/><p>{object.data.description}</p></>;
    case 'source':return <SourceData source={object}/>;
    case 'extension':return <><ExtensionView data={object.data}/><p className="handout-small">{object.data.definition.typeId} · v{object.data.definition.version} · {object.data.definition.license}. Rappresentazione statica dei valori salvati.</p></>;
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
