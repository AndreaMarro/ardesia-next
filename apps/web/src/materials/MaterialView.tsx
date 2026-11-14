import {renderMaterial} from './render';
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
    let disposed=false;
    const controller=new AbortController();setState('Caricamento del materiale…');setText('');
    void (async()=>{
      const raster=await renderMaterial(async()=>{const original=blob??await scope?.load(data);if(!original)throw Error('Materiale non disponibile in questa copia.');return original;},data,controller.signal);
      if(!disposed){const current=canvas.current!;current.width=raster.width;current.height=raster.height;current.getContext('2d')!.drawImage(raster.canvas,0,0);setText(raster.text);setState('');}
    })().catch(()=>{if(!disposed)setState('Materiale non disponibile. Verifica la connessione e riprova.');});
    return()=>{disposed=true;controller.abort();};
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
