import {ProgramEventSchema, ProgramBodySchema, ProgramStateSchema, type ProgramBody, type ProgramEvent, type ProgramResult} from '@ardesia/contracts';
import {validateProgramResult} from './program-view';

export interface ProgramWorker {
  postMessage(message:unknown):void;
  terminate():void;
  onmessage:((event:MessageEvent)=>void)|null;
  onerror:((event:ErrorEvent)=>void)|null;
}
/** Owns one ephemeral execution. The caller obtains explicit consent before constructing it. */
export class ProgramSession {
  private worker:ProgramWorker;
  private nonce:string=crypto.randomUUID();
  private sequence=0;
  private pending=0;
  private queue:ProgramEvent[]=[];
  private stopped=false;
  private timeout:ReturnType<typeof setTimeout>|undefined;
  private timer:ReturnType<typeof setInterval>|undefined;
  private state:ProgramResult['state'];
  constructor(private body:ProgramBody,state:ProgramResult['state'],private onResult:(result:ProgramResult)=>void,private onFailure:(message:string)=>void,
    createWorker:()=>ProgramWorker=()=>new Worker('/program-runtime/worker.js',{type:'module',name:'Ardesia · programma isolato'})){
    this.body=structuredClone(ProgramBodySchema.parse(body));this.state=structuredClone(ProgramStateSchema.parse(state));
    this.worker=createWorker();
    this.worker.onmessage=event=>this.receive(event.data);
    this.worker.onerror=()=>this.fail('Il motore non è disponibile. La bozza è conservata.');
    this.send({type:'start',action:'start'},true);
    if(this.body.intervalMs)this.timer=setInterval(()=>{if(!this.pending)this.dispatch({type:'tick',action:'tick'});},this.body.intervalMs);
  }
  private send(event:ProgramEvent,initial=false){
    if(this.stopped)return;
    const id=++this.sequence;this.pending=id;
    this.timeout=setTimeout(()=>this.fail('Il programma non risponde ed è stato interrotto. La bozza è conservata.'),initial?15000:2000);
    const message={nonce:this.nonce,id,body:this.body,state:this.state,event};
    if(new TextEncoder().encode(JSON.stringify(message)).byteLength>262144){this.fail('Il messaggio del programma è troppo grande.');return;}
    this.worker.postMessage(message);
  }
  dispatch(event:ProgramEvent){
    if(this.stopped)return;
    const checked=ProgramEventSchema.safeParse(event);if(!checked.success){this.fail('Interazione del programma non valida o troppo grande.');return;}event=checked.data;
    if(this.pending){if(this.queue.length>=16){this.fail('Troppe interazioni in attesa. Il programma è stato interrotto.');return;}this.queue.push(structuredClone(event));return;}
    this.send(event);
  }
  private receive(message:unknown){
    if(this.stopped||!message||typeof message!=='object')return;
    const data=message as {nonce:unknown;id:unknown;result?:unknown;error?:unknown};
    if(data.nonce!==this.nonce||data.id!==this.pending||!this.pending)return;
    clearTimeout(this.timeout);this.pending=0;
    if(typeof data.error==='string'){this.fail(data.error.slice(0,1000));return;}
    try {const result=validateProgramResult(data.result);this.state=structuredClone(result.state);this.onResult(structuredClone(result));}
    catch {this.fail('Il programma ha restituito dati o un’interfaccia non validi. La bozza è conservata.');return;}
    const next=this.queue.shift();if(next)this.send(next);
  }
  private fail(message:string){if(this.stopped)return;this.stop();this.onFailure(message);}
  stop(){
    if(this.stopped)return;this.stopped=true;this.nonce='';this.pending=0;this.queue=[];
    clearTimeout(this.timeout);clearInterval(this.timer);this.worker.onmessage=null;this.worker.onerror=null;this.worker.terminate();
  }
}
