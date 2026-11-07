import {renderMaterialInTurn,materialRasterSize} from './render-queue';
import {inkPath} from '../components/board-geometry';
import type {MaterialObject,InkObject} from '@ardesia/contracts';
import {createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import type {MaterialData, MaterialManifest} from '@ardesia/contracts';
import type {MaterialAccess} from '@ardesia/remote-client';
import './materials.css';

type Scope={access:()=>MaterialAccess;course?:{editionId:string;unitId:string};load:(data:MaterialData)=>Promise<Blob>};
const Materials=createContext<Scope|null>(null);
export function MaterialProvider({access,course,children}:{access:()=>MaterialAccess;course?:Scope['course'];children:ReactNode}){
  const value=useMemo(()=>{
    const cache=new Map<string,Promise<Blob>>();let total=0;
    return {access,course,async load(data:MaterialData){
      const key=data.assetId+data.sha256;
      // Every cache hit is reauthorized; a rendered page is disposed when its lesson leaves the projection.
      if(cache.has(key)){await access().read(data.assetId,course);return cache.get(key)!;}
      const promise=access().download(data.assetId,data.sha256,course);cache.set(key,promise);
      promise.then(blob=>{total+=blob.size;if(total>64*1024*1024){cache.clear();total=0;}},()=>cache.delete(key));return promise;
    }};
  },[access,course?.editionId,course?.unitId]);
  return <Materials.Provider value={value}>{children}</Materials.Provider>;
}
export function useMaterials(){return useContext(Materials);}
export function MaterialView({data,blob}:{data:MaterialData;blob?:Blob}){
  const scope=useMaterials(),canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false),[state,setState]=useState('Caricamento del materiale…'),[text,setText]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{const observer=new IntersectionObserver(entries=>setVisible(entries.some(e=>e.isIntersecting)),{rootMargin:'200px'});observer.observe(container.current!);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    if(!visible){if(canvas.current){canvas.current.width=1;canvas.current.height=1;}return;}
    let disposed=false,task:ReturnType<typeof import('./pdf-engine')['openPdf']>|undefined,render:import('pdfjs-dist').RenderTask|undefined;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    const stop=()=>{render?.cancel();void task?.destroy().catch(()=>undefined);};
    setState('Caricamento del materiale…');setText('');
    void renderMaterialInTurn(async()=>{
      try{
        const original=blob??await scope?.load(data);if(!original)throw Error('Materiale non disponibile in questa copia.');if(disposed)return;
        const target=document.createElement('canvas');
        if(data.mimeType==='application/pdf'){
          const {openPdf}=await import('./pdf-engine');const bytes=await original.arrayBuffer();if(disposed)return;
          task=openPdf(new Uint8Array(bytes));timer=setTimeout(stop,20_000);
          const pdf=await task.promise;if(disposed)return;const page=await pdf.getPage(data.page);if(disposed)return;
          const base=page.getViewport({scale:1}),size=materialRasterSize(base.width,base.height),viewport=page.getViewport({scale:size.scale});
          target.width=size.width;target.height=size.height;render=page.render({canvas:target,viewport});await render.promise;
          const content=await page.getTextContent();if(!disposed)setText(content.items.flatMap(item=>'str'in item?[item.str]:[]).join(' ').slice(0,100000));
        }else{
          const bitmap=await createImageBitmap(original);try{if(disposed)return;if(bitmap.width*bitmap.height>40_000_000)throw Error('Image too large');const size=materialRasterSize(bitmap.width,bitmap.height);target.width=size.width;target.height=size.height;target.getContext('2d')!.drawImage(bitmap,0,0,target.width,target.height);}finally{bitmap.close();}
        }
        if(!disposed){const current=canvas.current!;current.width=target.width;current.height=target.height;current.getContext('2d')!.drawImage(target,0,0);setState('');}
      }finally{clearTimeout(timer);await task?.destroy().catch(()=>undefined);}
    },controller.signal).catch(()=>{if(!disposed)setState('Materiale non disponibile. Verifica la connessione e riprova.');});
    return()=>{disposed=true;controller.abort();clearTimeout(timer);stop();};
  },[scope,data.assetId,data.sha256,data.page,blob,retry,visible]);
  return <div ref={container} className="material-view" style={{aspectRatio:`${data.pageWidth} / ${data.pageHeight}`}} data-material-state={!visible?'offscreen':state?'loading-or-error':'ready'}>
    <canvas ref={canvas} role="img" aria-label={`${data.name} · pagina ${data.page} di ${data.pageCount}`} hidden={!!state||!visible}/><span className="material-accessible-text">{text}</span>
    {visible&&state&&<span className="material-status" role="status">{state}<span className="material-retry" role="button" tabIndex={0} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setRetry(n=>n+1);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();setRetry(n=>n+1);}}}>Riprova</span></span>}
  </div>;
}
export function AnnotatedMaterial({object,annotations}:{object:MaterialObject;annotations:InkObject[]}){
  return <div className="annotated-material"><MaterialView data={object.data}/><svg className="material-annotations" viewBox={`0 0 ${object.width} ${object.height}`} aria-label="Annotazioni della pagina" role="img">{annotations.map(ink=><path key={ink.id} transform={`translate(${ink.x-ink.data.anchor!.x},${ink.y-ink.data.anchor!.y})`} d={inkPath(ink.data.points,ink.data.width)} fill={ink.data.color}/>)}</svg></div>;
}
export function MaterialDetails({data}:{data:MaterialData}){
  const scope=useMaterials(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <section className="material-details"><p>{data.name}<br/>Pagina {data.page} di {data.pageCount}</p><p className="hint">{data.license}</p>
    <button type="button" className="secondary-button" disabled={!scope||busy} onClick={()=>{setBusy(true);setError('');void scope!.load(data).then(blob=>{
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=data.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }).catch(()=>setError('Originale non disponibile. Riprova con la connessione attiva.')).finally(()=>setBusy(false));}}>{busy?'Preparazione…':'Scarica originale'}</button>
    {error&&<p role="alert">{error}</p>}<details><summary>Identità del materiale</summary><p className="material-digest">SHA-256 {data.sha256}</p><p className="hint">Originale conservato; gli appunti sono oggetti separati della lezione.</p></details></section>;
}
