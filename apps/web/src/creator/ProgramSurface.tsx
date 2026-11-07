import {createElement,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {canonicalJson,ProgramBodySchema,type ExtensionData,type ProgramEvent,type ProgramNode,type ProgramResult} from '@ardesia/contracts';
import {ProgramSession} from '@ardesia/plugin-host/program';

type Props={data:ExtensionData;onChange?:(state:ExtensionData['state'])=>void};
/** Only validated DOM/SVG data reaches React. No raw HTML, CSS, URL, function or native object crosses the VM boundary. */
export function ProgramSurface({data,onChange}:Props){
  const [result,setResult]=useState<ProgramResult>(),[message,setMessage]=useState('Avvio del programma…'),[running,setRunning]=useState(true);
  const [attempt,setAttempt]=useState(0);
  const session=useRef<ProgramSession|undefined>(undefined),lastState=useRef(canonicalJson(data.state)),changed=useRef(onChange);
  changed.current=onChange;
  const stateIdentity=canonicalJson(data.state);
  function stop(reason='Programma interrotto. I valori di prova restano nella bozza.') {session.current?.stop();session.current=undefined;setRunning(false);setMessage(reason);}
  useEffect(()=>{
    let active=true;lastState.current=canonicalJson(data.state);setRunning(true);setMessage('Avvio del programma…');
    if(document.hidden){stop('Programma sospeso perché la pagina non è visibile.');return;}
    let program:ProgramSession;
    try {program=new ProgramSession(ProgramBodySchema.parse(data.definition.body),data.state,next=>{if(!active)return;const identity=canonicalJson(next.state),modified=identity!==lastState.current;lastState.current=identity;setResult(next);setMessage('In esecuzione');if(modified)changed.current?.(next.state);},error=>{if(active){setRunning(false);setMessage(error);}});}
    catch {setRunning(false);setMessage('Le esecuzioni isolate non sono disponibili in questo browser. La bozza è conservata.');return;}
    session.current=program;
    const visibility=()=>{if(document.hidden)stop('Programma sospeso perché la pagina non è visibile.');};
    document.addEventListener('visibilitychange',visibility);
    return()=>{active=false;program.stop();session.current=undefined;document.removeEventListener('visibilitychange',visibility);};
  },[attempt]);
  useLayoutEffect(()=>{if(stateIdentity!==lastState.current)stop('I valori sono cambiati fuori dall’anteprima. Riapri l’esperienza per usare la nuova bozza.');},[stateIdentity]);
  function dispatch(type:ProgramEvent['type'],action:string,e:React.SyntheticEvent<HTMLElement>){
    if(!running)return;
    e.stopPropagation();const event:ProgramEvent={type,action};
    if(type==='input'||type==='change'){
      const target=e.currentTarget as HTMLInputElement;
      if(typeof target.value!=='string')return;
      event.value=target.type==='checkbox'?target.checked:target.value.slice(0,8192);
    }
    if(type==='keydown'){const key=(e.nativeEvent as KeyboardEvent).key;if(key.length>30)return;event.key=key;}
    if(type.startsWith('pointer')){const pointer=e.nativeEvent as PointerEvent,box=e.currentTarget.getBoundingClientRect();event.x=Math.max(0,Math.min(1,(pointer.clientX-box.left)/Math.max(1,box.width)));event.y=Math.max(0,Math.min(1,(pointer.clientY-box.top)/Math.max(1,box.height)));}
    session.current?.dispatch(event);
  }
  function render(node:ProgramNode|string,index:number):React.ReactNode{
    if(typeof node==='string')return node;
    const props:Record<string,unknown>={...node.attrs,style:node.style,key:node.key??index};
    if(node.tag==='button')props.type='button';
    const names:Record<string,string>={click:'onClick',input:'onInput',change:'onChange',keydown:'onKeyDown',pointerdown:'onPointerDown',pointermove:'onPointerMove',pointerup:'onPointerUp'};
    for(const [type,action] of Object.entries(node.events??{}))props[names[type]!]=(e:React.SyntheticEvent<HTMLElement>)=>dispatch(type as ProgramEvent['type'],action,e);
    if(['input','textarea','select'].includes(node.tag)){props.disabled=!running||props.disabled;props.onChange??=()=>{};}
    return createElement(node.tag,props,...(node.children??[]).map(render));
  }
  return <section className="program-surface"><header className="program-toolbar"><span role="status">{message}</span>{running&&<button type="button" className="secondary-button" onClick={()=>stop()}>Interrompi programma</button>}</header>
    {result&&<div className="program-canvas" inert={!running}>{render(result.view,0)}</div>}
    {!running&&<button type="button" className="secondary-button" onClick={()=>setAttempt(value=>value+1)}>Riavvia questa versione</button>}
  </section>;
}
