import {useEffect, useRef, useState, type PointerEvent, type KeyboardEvent, type CSSProperties} from 'react';
import type {InkDraft, InkDraftAccess} from '@ardesia/remote-client';
import {MousePointer2, PenLine, Hand, Type, SquareFunction, Link2, Undo2, Plus} from './Icons';
import {materialPosition} from '@ardesia/contracts';
import type {EducationalObject, LessonDocument, NewEducationalObject} from '@ardesia/contracts';
import {ObjectContent} from './ObjectContent';
import {initialCamera, toWorld, zoomAt, isVisible, inkPath, inkObject, strokeBuffer, appendSample, inkIntersectsEraser, type StrokeBuffer, type Point, type Camera} from './board-geometry';

type Props = {
  document: LessonDocument; selectedId: string | null; onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onAdd: (type: 'note' | 'formula' | 'source', position?: {x:number;y:number}) => Promise<void>;
  onInk: (object: NewEducationalObject, sampleTimes: number[], recovered?: boolean) => Promise<boolean> | void;
  onErase?: (objectId: string) => Promise<boolean>;
  inkRecovery?: (documentId: string) => InkDraftAccess;
  pendingRemovals?: string[];
  appearance?: 'board' | 'notebook'; onUndo: () => void; canUndo: boolean;
  pendingObjects?: NewEducationalObject[];
  readOnlyObjects?: boolean;
  replayOnly?: boolean;
  onInkActiveChange?: (active: boolean) => void;
};
type Stroke = StrokeBuffer & {id:string;recovery?:InkDraftAccess;anchor?: {objectId:string;x:number;y:number};pointerId:number; pointerType:string; color:string; width:number};
export function Board({document,selectedId,onSelect,onMove,onAdd,onInk,onUndo,canUndo,pendingObjects=[],pendingRemovals=[],readOnlyObjects=false,replayOnly=false,onInkActiveChange,onErase,inkRecovery,appearance='board'}: Props) {
  const [tool,setTool]=useState<'select'|'pen'|'pan'|'eraser'>(replayOnly?'pan':readOnlyObjects?'pen':'select');
  const [camera,setCamera]=useState<Camera>(initialCamera), cameraRef=useRef(camera);
  const [size,setSize]=useState({width:1000,height:590});const measured=useRef(false);
  const creating=useRef(false),[isCreating,setIsCreating]=useState(false);
  const [color,setColor]=useState('#203e62'), [width,setWidth]=useState(2.5);
  const [touchWrites,setTouchWrites]=useState(false), [inkError,setInkError]=useState('');
  const [recovered,setRecovered]=useState<InkDraft[]>([]), [recovering,setRecovering]=useState(false);
  const erased=useRef(new Set<string>()), eraser=useRef<{pointerId:number;point:Point}|null>(null);
  const checkpointAction=useRef<() => void>(() => undefined), finishAction=useRef<() => void>(() => undefined);
  const surface=useRef<HTMLDivElement>(null), live=useRef<SVGPathElement>(null);
  const stroke=useRef<Stroke|null>(null), frame=useRef(0);
  const touches=useRef(new Map<number,{x:number;y:number}>());
  const pan=useRef<{id:number;x:number;y:number}|null>(null);
  const drag=useRef<{id:string;pointerId:number;startX:number;startY:number;x:number;y:number}|null>(null);
  const [dragOffset,setDragOffset]=useState<{id:string;x:number;y:number}|null>(null);
  const suppressClick=useRef(false), initialized=useRef(false);
  const focusedViewport=useRef('');
  useEffect(()=>{
    if(!selectedId){focusedViewport.current='';return;}
    if(focusedViewport.current===selectedId)return;
    const selected=document.objects.find(o=>o.id===selectedId);if(!selected)return;
    const object=materialPosition(selected,document.objects),c=cameraRef.current;
    focusedViewport.current=selectedId;
    const left=object.x*c.zoom+c.x,top=object.y*c.zoom+c.y;
    if(left<40||left+object.width*c.zoom>size.width-40||top<70||top+object.height*c.zoom>size.height-140){
      const zoom=Math.max(.1,Math.min(c.zoom,(size.width-80)/object.width,(size.height-210)/object.height));
      updateCamera({zoom,x:size.width/2-(object.x+object.width/2)*zoom,y:(size.height-70)/2-(object.y+object.height/2)*zoom});
    }
  },[selectedId,document.objects,size]);
  useEffect(()=>{if(!initialized.current&&measured.current&&size.width>0&&size.height>0){fit();initialized.current=true;}},[size]);
  const updateCamera=(next:Camera)=>{cameraRef.current=next;setCamera(next);};
  function local(e:{clientX:number;clientY:number}) {const rect=surface.current!.getBoundingClientRect();return {x:e.clientX-rect.left,y:e.clientY-rect.top};}
  function sample(e:globalThis.PointerEvent):Point {
    const p=toWorld(local(e),cameraRef.current);
    return {...p,x:Math.max(-999999,Math.min(999999,p.x)),y:Math.max(-999999,Math.min(999999,p.y)),pressure:e.pointerType==='pen'?e.pressure:.5,sampledAt:e.timeStamp};
  }
  function paint() {frame.current=0;live.current?.setAttribute('d',stroke.current?inkPath(stroke.current.points,stroke.current.width):'');}
  function schedulePaint() {if(!frame.current)frame.current=requestAnimationFrame(paint);}
  function clearStroke(discard=false) {const abandoned=stroke.current;stroke.current=null;onInkActiveChange?.(false);cancelAnimationFrame(frame.current);frame.current=0;live.current?.setAttribute('d','');if(discard&&abandoned){try{abandoned.recovery?.remove(abandoned.id);}catch{setInkError('Il gesto annullato resta fra i tratti da recuperare.');}finally{abandoned.recovery?.release(abandoned.id);}}}
  function draftFor(points:Point[],current:Stroke):InkDraft {
    const object=inkObject(points,current.color,current.width,current.id);
    if(object.type!=='ink')throw Error('Expected ink');
    return {object:current.anchor?{...object,data:{...object.data,anchor:current.anchor}}:object,sampleTimes:points.map(point=>point.sampledAt??performance.now())};
  }
  function checkpoint() {
    const current=stroke.current;if(!current?.points.length||!inkRecovery)return;
    try {current.recovery??=inkRecovery(document.id);current.recovery.write(draftFor(current.points,current));}
    catch(reason){setInkError(reason instanceof Error?reason.message:'Il tratto in corso non è conservato sul dispositivo.');}
  }
  function exportDrafts(){
    try {
      const raw=inkRecovery?.(document.id).exportRaw();if(!raw)return;
      const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=window.document.createElement('a');
      a.href=url;a.download='ardesia-tratti-interrotti.json';a.click();URL.revokeObjectURL(url);
    }catch(reason){setInkError(reason instanceof Error?reason.message:'Esportazione non disponibile.');}
  }
  function refreshDrafts(){
    if(!inkRecovery||replayOnly)return;
    try {setRecovered(inkRecovery(document.id).read().filter(draft=>draft.object.id!==stroke.current?.id));}
    catch(reason){setInkError(reason instanceof Error?reason.message:'Recupero del tratto non disponibile.');}
  }
  function publish(draft:InkDraft,wasRecovered=false,retained?:InkDraftAccess) {
    let recovery=retained;
    try {recovery??=inkRecovery?.(document.id);recovery?.write(draft);} catch(reason) {setInkError(reason instanceof Error?reason.message:'Checkpoint del tratto non disponibile.');}
    const result=onInk(draft.object,draft.sampleTimes,wasRecovered);
    void Promise.resolve(result).then(ok=>{if(ok)recovery?.remove(draft.object.id);refreshDrafts();}).catch(()=>refreshDrafts()).finally(()=>recovery?.release(draft.object.id));
  }
  function writeStroke(points:Point[],current:Stroke) {publish(draftFor(points,current),false,current.recovery);current.id=crypto.randomUUID();current.recovery=undefined;}
  function commitStroke() {const current=stroke.current;clearStroke();if(current?.points.length)publish(draftFor(current.points,current),false,current.recovery);}
  checkpointAction.current=checkpoint;finishAction.current=commitStroke;
  useEffect(()=>{
    refreshDrafts();
    const timer=window.setInterval(()=>checkpointAction.current(),750);
    const hide=()=>{checkpointAction.current();finishAction.current();eraser.current=null;onInkActiveChange?.(false);};
    const visibility=()=>{if(window.document.visibilityState==='hidden')hide();};
    window.addEventListener('pagehide',hide);window.document.addEventListener('visibilitychange',visibility);
    return()=>{try{checkpointAction.current();stroke.current?.recovery?.release(stroke.current.id);}finally{clearInterval(timer);window.removeEventListener('pagehide',hide);window.document.removeEventListener('visibilitychange',visibility);}};
  },[document.id]);
  useEffect(()=>refreshDrafts(),[document.revision,pendingObjects.length]);
  function erase(from:Point,to:Point){
    if(!onErase)return;
    for(const raw of [...document.objects,...pendingObjects]) {
      if(raw.type!=='ink'||erased.current.has(raw.id)||pendingRemovals.includes(raw.id))continue;
      const object=materialPosition(raw,document.objects);
      if(object.type==='ink'&&inkIntersectsEraser(object,from,to,9/cameraRef.current.zoom)){
        erased.current.add(raw.id);void onErase(raw.id).then(ok=>{if(!ok)erased.current.delete(raw.id);});
      }
    }
  }
  useEffect(()=>{
    const node=surface.current!;
    const resize=new ResizeObserver(([entry])=>{if(entry){measured.current=true;setSize({width:entry.contentRect.width,height:entry.contentRect.height});}});resize.observe(node);
    const wheel=(e:WheelEvent)=>{e.preventDefault();if(stroke.current||drag.current||eraser.current)return;
      updateCamera(e.ctrlKey||e.metaKey?zoomAt(cameraRef.current,local(e),Math.exp(-e.deltaY*.008)):{...cameraRef.current,x:cameraRef.current.x-e.deltaX,y:cameraRef.current.y-e.deltaY});};
    node.addEventListener('wheel',wheel,{passive:false});
    return ()=>{resize.disconnect();node.removeEventListener('wheel',wheel);cancelAnimationFrame(frame.current);};
  },[]);
  function down(e:PointerEvent<HTMLDivElement>) {
    if(e.button!==0 && e.button!==1 && !(e.pointerType==='pen'&&e.button===5))return;
    if((stroke.current?.pointerType==='pen' && e.pointerId!==stroke.current.pointerId)||eraser.current&&eraser.current.pointerId!==e.pointerId)return;
    if(e.pointerType==='pen'){if(stroke.current?.pointerType==='touch')clearStroke(true);touches.current.clear();pan.current=null;drag.current=null;setDragOffset(null);}
    e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
    if(e.pointerType==='touch') {
      touches.current.set(e.pointerId,local(e));
      if(touches.current.size>1){clearStroke(true);drag.current=null;setDragOffset(null);pan.current=null;return;}
    }
    if(stroke.current)return;
    suppressClick.current=false;
    if(!replayOnly&&onErase&&(tool==='eraser'||e.pointerType==='pen'&&e.button===5)&&(e.pointerType!=='touch'||touchWrites)){
      const point=sample(e.nativeEvent);erased.current.clear();eraser.current={pointerId:e.pointerId,point};onInkActiveChange?.(true);erase(point,point);return;
    }
    if(!replayOnly&&tool==='pen'&&e.button===0&&(e.pointerType!=='touch'||touchWrites)) {
      stroke.current={id:crypto.randomUUID(),pointerId:e.pointerId,pointerType:e.pointerType,...strokeBuffer(sample(e.nativeEvent)),color,width};
      const start=stroke.current.points[0]!;const material=[...document.objects].reverse().find(o=>o.type==='material'&&start.x>=o.x&&start.x<=o.x+o.width&&start.y>=o.y&&start.y<=o.y+o.height);
      if(material)stroke.current.anchor={objectId:material.id,x:material.x,y:material.y};
      onInkActiveChange?.(true);
      live.current?.setAttribute('fill',color);checkpoint();schedulePaint();return;
    }
    const target=(e.target as Element).closest<HTMLElement>('[data-object-id]');
    const object=document.objects.find(o=>o.id===target?.dataset.objectId);
    if(!readOnlyObjects&&tool==='select'&&object&&e.button===0){drag.current={id:object.id,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:object.x,y:object.y};return;}
    pan.current={id:e.pointerId,...local(e)};
  }
  function move(e:PointerEvent<HTMLDivElement>) {
    const current=stroke.current;
    if(eraser.current){if(eraser.current.pointerId===e.pointerId){const point=sample(e.nativeEvent);erase(eraser.current.point,point);eraser.current.point=point;}return;}
    if(current?.pointerType==='pen'&&current.pointerId!==e.pointerId)return;
    if(touches.current.has(e.pointerId)&&touches.current.size>1) {
      const before=[...touches.current.values()];touches.current.set(e.pointerId,local(e));const after=[...touches.current.values()];
      const a=before[0]!,b=before[1]!,c=after[0]!,d=after[1]!;
      const oldMid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},mid={x:(c.x+d.x)/2,y:(c.y+d.y)/2};
      const next=zoomAt(cameraRef.current,oldMid,Math.hypot(c.x-d.x,c.y-d.y)/Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)));
      updateCamera({...next,x:next.x+mid.x-oldMid.x,y:next.y+mid.y-oldMid.y});return;
    }
    if(touches.current.has(e.pointerId)&&touches.current.size===1)touches.current.set(e.pointerId,local(e));
    if(current?.pointerId===e.pointerId) {
      const events=e.nativeEvent.getCoalescedEvents?.()??[];
      for(const event of events.length?events:[e.nativeEvent]) {
        appendSample(current,sample(event),points=>writeStroke(points,current));
      }
      schedulePaint();return;
    }
    if(drag.current?.pointerId===e.pointerId){const d=drag.current;setDragOffset({id:d.id,x:(e.clientX-d.startX)/cameraRef.current.zoom,y:(e.clientY-d.startY)/cameraRef.current.zoom});return;}
    if(pan.current?.id===e.pointerId){const p=local(e);updateCamera({...cameraRef.current,x:cameraRef.current.x+p.x-pan.current.x,y:cameraRef.current.y+p.y-pan.current.y});pan.current={id:e.pointerId,...p};suppressClick.current=true;}
    if(touches.current.has(e.pointerId))touches.current.set(e.pointerId,local(e));
  }
  function up(e:PointerEvent<HTMLDivElement>,cancelled=false) {
    if(eraser.current?.pointerId===e.pointerId){if(!cancelled)erase(eraser.current.point,sample(e.nativeEvent));eraser.current=null;onInkActiveChange?.(false);suppressClick.current=true;}
    if(stroke.current?.pointerId===e.pointerId){
      // Cancellation/lost capture retains the real samples already received.
      if(!cancelled){const p=sample(e.nativeEvent);p.pressure=stroke.current.points.at(-1)!.pressure;appendSample(stroke.current,p,points=>writeStroke(points,stroke.current!));}
      commitStroke();suppressClick.current=true;
    }
    const d=drag.current;
    if(d?.pointerId===e.pointerId){drag.current=null;setDragOffset(null);const dx=(e.clientX-d.startX)/cameraRef.current.zoom,dy=(e.clientY-d.startY)/cameraRef.current.zoom;
      if(!cancelled&&Math.abs(dx)+Math.abs(dy)>4){suppressClick.current=true;onMove(d.id,Math.max(-999999,Math.min(999999,d.x+dx)),Math.max(-999999,Math.min(999999,d.y+dy)));}else if(!cancelled&&!suppressClick.current){onSelect(d.id);}}
    touches.current.delete(e.pointerId);
    if(pan.current?.id===e.pointerId)pan.current=null;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function keyboardPan(e:KeyboardEvent<HTMLDivElement>){
    if(e.target!==e.currentTarget || e.altKey || e.ctrlKey || e.metaKey)return;
    if(e.key==='Home'){e.preventDefault();fit();return;}
    const steps:Record<string,[number,number]>={ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,80],ArrowDown:[0,-80],PageUp:[0,size.height*.8],PageDown:[0,-size.height*.8]};
    const step=steps[e.key];if(!step)return;e.preventDefault();updateCamera({...cameraRef.current,x:cameraRef.current.x+step[0],y:cameraRef.current.y+step[1]});
  }
  function keyboardMove(e:KeyboardEvent,object:EducationalObject){
    if(readOnlyObjects)return;
    const steps:Record<string,[number,number]>={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};
    const step=steps[e.key];if(!e.altKey||!step)return;e.preventDefault();onMove(object.id,Math.max(-999999,Math.min(999999,(document.objects.find(o=>o.id===object.id)?.x??object.x)+step[0])),Math.max(-999999,Math.min(999999,(document.objects.find(o=>o.id===object.id)?.y??object.y)+step[1])));
  }
  function objectBounds(){
    const measured=new Map([...surface.current!.querySelectorAll<HTMLElement>('[data-object-id]')].map(node=>{
      const rect=node.getBoundingClientRect();return [node.dataset.objectId!,{width:rect.width/cameraRef.current.zoom,height:rect.height/cameraRef.current.zoom}] as const;
    }));
    return [...document.objects,...pendingObjects].map(o=>({...materialPosition(o,document.objects),...measured.get(o.id)}));
  }
  async function add(type:'note'|'formula'|'source'){
    if(creating.current)return;creating.current=true;setIsCreating(true);setTool('select');
    try {
      const position=toWorld({x:size.width/2,y:size.height/2},cameraRef.current);position.x-=135;position.y-=95;
      for(const o of objectBounds().sort((a,b)=>a.x-b.x)){
        if(position.x<o.x+o.width+24&&position.x+270+24>o.x&&position.y<o.y+o.height+24&&position.y+190+24>o.y)position.x=o.x+o.width+32;
      }
      position.x=Math.max(-999999,Math.min(999999,position.x));position.y=Math.max(-999999,Math.min(999999,position.y));await onAdd(type,position);
    } finally {creating.current=false;setIsCreating(false);}
  }
  function fit(){
    const objects=objectBounds();if(!objects.length){updateCamera(initialCamera);return;}
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const o of objects){left=Math.min(left,o.x);top=Math.min(top,o.y);right=Math.max(right,o.x+o.width);bottom=Math.max(bottom,o.y+o.height);}
    const inset=window.innerWidth<760?24:112,availableHeight=Math.max(100,size.height-196);
    const zoom=Math.max(.1,Math.min(1,(size.width-inset)/Math.max(1,right-left),availableHeight/Math.max(1,bottom-top)));
    updateCamera({x:(size.width+(inset===24?0:64)-(right-left)*zoom)/2-left*zoom,y:100+(availableHeight-(bottom-top)*zoom)/2-top*zoom,zoom});
  }
  const visible=document.objects.filter(o=>!pendingRemovals.includes(o.id)).map(o=>materialPosition(o,document.objects)).sort((a,b)=>Number(a.type==='ink')-Number(b.type==='ink')).filter(o=>!['ink','material'].includes(o.type)||o.id===selectedId||isVisible(o,camera,size.width,size.height));
  return <section className={`board-region spatial-board ${appearance==='notebook'?'notebook-board':''} ${tool==='pen'?'drawing':''} ${tool==='pan'?'panning':''} ${tool==='eraser'?'erasing':''}`} aria-label={appearance==='notebook'?'Taccuino della lezione':'Lavagna della lezione'}>
    <div className="board-surface" ref={surface} tabIndex={0} aria-label="Superficie lavagna: frecce o trascinamento per spostarti, due dita per lo zoom, Home per inquadrare"
      onKeyDown={keyboardPan} onPointerDown={down} onPointerMove={move} onPointerUp={e=>up(e)} onPointerCancel={e=>up(e,true)} onLostPointerCapture={e=>up(e,true)}
      style={{backgroundSize:`${32*camera.zoom}px ${32*camera.zoom}px`,backgroundPosition:`${camera.x}px ${camera.y}px`}}>
      <div className="board-world" style={{transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`,'--board-zoom':camera.zoom} as CSSProperties}>
        <svg className="connections" aria-hidden="true">{document.connections.map(connection=>{
          const from=document.objects.find(o=>o.id===connection.from),to=document.objects.find(o=>o.id===connection.to);if(!from||!to)return null;const a=materialPosition(from,document.objects),b=materialPosition(to,document.objects);
          const x=a.x+a.width,y=a.y+a.height/2;
          return <path key={connection.id} d={`M${x},${y}C${x+45},${y} ${b.x-40},${b.y+b.height/3} ${b.x},${b.y+b.height/3}`} fill="none" stroke="var(--sage)" strokeWidth="1.5" strokeDasharray="5 5"/>;
        })}</svg>
        {visible.map(object=><button key={object.id} data-object-id={object.id} data-testid={`object-${object.id}`} className={`board-object type-${object.type} ${object.id===selectedId?'selected':''}`}
          aria-label={`${appearance==='notebook'?'Modifica':'Apri'} ${object.title}`} aria-pressed={object.id===selectedId} style={{left:object.x,top:object.y,width:object.width,minHeight:object.height,...(['ink','material'].includes(object.type)?{height:object.height}:{}),transform:dragOffset?.id===object.id?`translate(${dragOffset.x}px,${dragOffset.y}px)`:undefined}}
          onClick={e=>{if(e.detail===0||(!suppressClick.current&&tool==='select'))onSelect(object.id);}} onKeyDown={e=>keyboardMove(e,object)}>
          {object.type!=='ink'&&<h2>{object.title}</h2>}{readOnlyObjects&&object.type==='lab'?<p>{replayOnly?'Laboratorio della revisione registrata · esecuzione sospesa durante il replay.':'Ricollegati per eseguire questo laboratorio con i permessi aggiornati.'}</p>:<ObjectContent object={object}/>}</button>)}
        {pendingObjects.map(o=>materialPosition(o,document.objects)).filter(o=>!pendingRemovals.includes(o.id)&&o.type==='ink'&&!document.objects.some(saved=>saved.id===o.id)).map(o=>o.type==='ink'&&<svg key={o.id} className="pending-ink" data-testid={`pending-ink-${o.id}`} aria-label="Tratto in attesa di conferma" style={{left:o.x,top:o.y,width:o.width,height:o.height}} viewBox={`0 0 ${o.width} ${o.height}`}><path d={inkPath(o.data.points,o.data.width)} fill={o.data.color}/></svg>)}
        {recovered.filter(draft=>!pendingObjects.some(o=>o.id===draft.object.id)&&!document.objects.some(o=>o.id===draft.object.id)).map(draft=><svg key={draft.object.id} className="pending-ink" aria-label="Tratto interrotto da recuperare" style={{left:draft.object.x,top:draft.object.y,width:draft.object.width,height:draft.object.height}} viewBox={`0 0 ${draft.object.width} ${draft.object.height}`}><path d={inkPath(draft.object.data.points,draft.object.data.width)} fill={draft.object.data.color}/></svg>)}
        <svg className="live-ink" aria-hidden="true"><path ref={live}/></svg>
      </div>
    </div>
    {(inkError||recovered.length>0)&&<div className="ink-recovery-notice" role="status">{inkError&&<p>{inkError}</p>}<button onClick={exportDrafts}>Esporta tratti</button>{recovered.length>0&&<><p>{recovered.length} tratti conservati su questo dispositivo, anche da altre schede.</p><button disabled={recovering} onClick={async()=>{setRecovering(true);try {const recovery=inkRecovery?.(document.id);for(const draft of recovery?.read()??[]){const ok=await recovery!.recover(draft.object.id,async latest=>(await onInk(latest.object,latest.sampleTimes,true))===true);if(!ok){setInkError('Un tratto è ancora in uso o in attesa di conferma. Riprova quando l’altra scheda ha terminato.');break;}}refreshDrafts();}catch(reason){setInkError(reason instanceof Error?reason.message:'Recupero non disponibile.');}finally{setRecovering(false);}}}>Recupera tratti interrotti</button></>}</div>}
    {!document.objects.length&&!pendingObjects.length&&<div className="canvas-empty"><h2>Ogni lezione comincia da una domanda.</h2><p>{readOnlyObjects?'Scrivi con la penna. I tratti restano sul dispositivo fino alla riconnessione.':'Scrivi sulla lavagna o aggiungi una nota, una formula, una fonte.'}</p>{!readOnlyObjects&&<button className="primary-button" disabled={isCreating} onClick={()=>void add('note')}>Scrivi la prima nota</button>}</div>}
    <div className="board-navigation" role="group" aria-label="Navigazione lavagna">
      <button aria-label="Riduci zoom" onClick={()=>updateCamera(zoomAt(cameraRef.current,{x:size.width/2,y:size.height/2},1/1.25))}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" strokeWidth="2"/></svg></button>
      <button aria-label={`Zoom ${Math.round(camera.zoom*100)}%, ripristina 100%`} onClick={()=>updateCamera(zoomAt(cameraRef.current,{x:size.width/2,y:size.height/2},1/cameraRef.current.zoom))}>{Math.round(camera.zoom*100)}%</button>
      <button aria-label="Aumenta zoom" onClick={()=>updateCamera(zoomAt(cameraRef.current,{x:size.width/2,y:size.height/2},1.25))}><Plus size={18}/></button>
      <button onClick={fit}>Inquadra tutto</button>
    </div>
    {tool==='pen'&&<div className="pen-options" role="group" aria-label="Stile della penna">{[['#203e62','Blu'],['#638575','Verde'],['#973b3b','Rosso']].map(([value,label])=><button key={value} aria-label={`Inchiostro ${label}`} aria-pressed={color===value} onClick={()=>setColor(value!)}><span style={{background:value}}/></button>)}<select aria-label="Spessore della penna" value={width} onChange={e=>setWidth(Number(e.target.value))}><option value="1.5">Fine</option><option value="2.5">Medio</option><option value="5">Ampio</option></select><label><input type="checkbox" checked={touchWrites} onChange={e=>setTouchWrites(e.target.checked)}/>Scrivi con un dito</label></div>}
    <div className="board-toolbar" role="toolbar" aria-label="Strumenti lavagna">
      <button aria-label="Seleziona oggetti" title="Seleziona · Alt + frecce per spostare" aria-pressed={tool==='select'} onClick={()=>setTool('select')}><MousePointer2 size={21}/></button>
      <button disabled={replayOnly} aria-label="Penna" title="Penna" aria-pressed={tool==='pen'} onClick={()=>setTool('pen')}><PenLine size={21}/></button>
      <button disabled={replayOnly||!onErase} aria-label="Gomma a tratto" title="Gomma a tratto" aria-pressed={tool==='eraser'} onClick={()=>setTool('eraser')}><svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 17 8-10 5 4-8 10H8l-5-4 8-10M8 17l5 4M13 21h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg></button>
      <button aria-label="Sposta lavagna" title="Sposta lavagna" aria-pressed={tool==='pan'} onClick={()=>setTool('pan')}><Hand size={21}/></button>
      {!readOnlyObjects&&<><span className="toolbar-divider"/>
      <button aria-label="Aggiungi nota" disabled={isCreating} onClick={()=>add('note')}><Type size={22}/></button>
      <button aria-label="Aggiungi formula" disabled={isCreating} onClick={()=>add('formula')}><SquareFunction size={22}/></button>
      <button aria-label="Aggiungi fonte" disabled={isCreating} onClick={()=>add('source')}><Link2 size={21}/></button>
      <span className="toolbar-divider"/>
      <button aria-label="Annulla ultima modifica" disabled={!canUndo} onClick={onUndo}><Undo2 size={21}/></button></>}
    </div>
  </section>;
}
