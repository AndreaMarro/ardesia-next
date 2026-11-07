import {describe,it,expect,beforeAll,vi,afterEach} from 'vitest';
import {newQuickJSWASMModuleFromVariant,type QuickJSWASMModule} from 'quickjs-emscripten-core';
import variant from '@jitl/quickjs-wasmfile-release-sync';
import {type ProgramBody,type ProgramResult} from '@ardesia/contracts';
import {executeProgram} from './program-engine';
import {validateProgramResult} from './program-view';
import {ProgramSession,type ProgramWorker} from './program-session';

let engine:QuickJSWASMModule;
beforeAll(async()=>{engine=await newQuickJSWASMModuleFromVariant(variant);});
const body=(code:string):ProgramBody=>({code,initialState:{count:0}});
const result=(state:ProgramResult['state']={count:1}):ProgramResult=>({state,view:{tag:'p',children:['Valid']}});
const run=(code:string)=>executeProgram(engine,body(code),{count:0},{type:'click',action:'increment'});

describe('programmable engine boundary',()=>{
  it('runs a new algorithm and view without mutating the supplied state',()=>{
    const state={count:4};const b=body('function update({state,event}) {state.count += event.action === "increment" ? 3 : 0; return {state,view:{tag:"svg",attrs:{viewBox:"0 0 100 100"},children:[{tag:"circle",attrs:{cx:state.count,cy:50,r:5,fill:"#235e50"}}]}}}');
    const output=executeProgram(engine,b,state,{type:'click',action:'increment'});expect(output.state.count).toBe(7);expect(state.count).toBe(4);
  });
  it('has no browser, IO, worker, module or Core authority',()=>{
    const output=run('function update({state}) {state.globals=[typeof fetch,typeof XMLHttpRequest,typeof indexedDB,typeof localStorage,typeof document,typeof window,typeof Worker,typeof postMessage,typeof require,typeof process,typeof std,typeof os,typeof WebAssembly]; return {state,view:{tag:"p"}}}');
    expect(output.state.globals).toEqual(Array(13).fill('undefined'));
    expect(()=>run('import * as io from "std"; function update(){return io}')).toThrow();
    expect(()=>run('function update(){return Function("return fetch")()}')).toThrow();
  });
  it.each(['while(true){}','function recurse(){recurse()} recurse();','const huge=[];while(true)huge.push(new Array(100000).fill(123));','const bomb={};Object.defineProperty(bomb,"state",{enumerable:true,get(){while(true){}}});return bomb;'])('interrupts hostile computation: %s',snippet=>{
    const start=performance.now();expect(()=>run('function update(){'+snippet+'}')).toThrow(/Il programma/);expect(performance.now()-start).toBeLessThan(2000);
    expect(run('function update({state}){return {state,view:{tag:"p"}}}').state.count).toBe(0);
  });
  it('does not execute Promise jobs or keep globals between interactions',()=>{
    expect(()=>run('async function update({state}){return {state,view:{tag:"p"}}}')).toThrow();
    const code='globalThis.hidden = (globalThis.hidden || 0) + 1; function update(){return {state:{count:hidden},view:{tag:"p"}}}';expect(run(code).state.count).toBe(1);expect(run(code).state.count).toBe(1);
  });
  it('rejects excessive or invalid output before crossing into UI',()=>{
    expect(()=>run('function update(){return {state:{count:1},view:{tag:"p",children:["a".repeat(150000)]}}}')).toThrow();
    expect(()=>run('function update(){return {state:{count:1},view:{tag:"script",children:["alert(1)"]}}}')).toThrow();
  });
});

describe('passive DOM/SVG contract',()=>{
  it.each([
    {tag:['div']},
    {tag:'div',events:{input:'edit'},children:[{tag:'input',attrs:{type:'text'}}]},
    {tag:'svg',attrs:{viewBox:'0 0 1 1'},children:[{tag:'svg',attrs:{viewBox:'0 0 1 1',width:10000,height:10000}}]},
    {tag:'table',children:[{tag:'tr',children:[{tag:'td',attrs:{colSpan:24},children:[{tag:'table'}]}]}]},
    {tag:'div',style:{display:['flex']}},
    {tag:'input',attrs:{type:['text']}},
    {tag:'div',attrs:{role:['group']}},
    {tag:'div',style:{fontSize:'9999em'}},
    {tag:'td',attrs:{colSpan:1000000}},
    {tag:'svg',attrs:{viewBox:'0 0 1e-300 1'}},
    {tag:'svg',children:[{tag:'path',attrs:{d:'M0 0 L10000 0',strokeDasharray:'1e-300 1e-300'}}]},
    {tag:'iframe',attrs:{src:'https://example.invalid'}},
    {tag:'a',attrs:{href:'javascript:alert(1)'}},
    {tag:'form',attrs:{action:'https://example.invalid'}},
    {tag:'div',attrs:{dangerouslySetInnerHTML:'<script/>'}},
    {tag:'div',style:{backgroundImage:'url(https://example.invalid)'}},
    {tag:'div',style:{position:'fixed'}},
    {tag:'svg',children:[{tag:'path',attrs:{d:'M1e999 1 L2 3'}}]},
    {tag:'svg',children:[{tag:'use',attrs:{href:'https://example.invalid'}}]},
    {tag:'svg',children:[{tag:'circle',attrs:{fill:'url(https://example.invalid)'}}]},
    {tag:'button',events:{click:'(()=>{})()'}},
  ])('rejects executable, navigating or external output: %j',view=>{expect(()=>validateProgramResult({...result(),view})).toThrow();});
  it('bounds nesting, nodes, attributes and identity without dropping data',()=>{
    const deep={tag:'div',children:[] as unknown[]};let n=deep;for(let i=0;i<21;i++){const child={tag:'div',children:[] as unknown[]};n.children.push(child);n=child;}
    for(const view of [deep,{tag:'div',children:Array.from({length:501},()=>({tag:'span'}))},{tag:'div',children:[{tag:'p',key:'same'},{tag:'p',key:'same'}]}])expect(()=>validateProgramResult({...result(),view})).toThrow();
    const valid={state:{count:2},view:{tag:'button',attrs:{'aria-label':'Add'},events:{click:'add'},style:{backgroundColor:'#235e50',padding:12},children:['Add']}};
    expect(validateProgramResult(valid)).toEqual(valid);
  });
});

class FakeWorker implements ProgramWorker{
  onmessage:((event:MessageEvent)=>void)|null=null;onerror:((event:ErrorEvent)=>void)|null=null;sent:unknown[]=[];terminate=vi.fn();
  postMessage(value:unknown){this.sent.push(value);}
  reply(index=0,data:unknown=result()){const sent=this.sent[index] as {nonce:string;id:number};this.onmessage?.({data:{nonce:sent.nonce,id:sent.id,result:data}} as MessageEvent);}
}
afterEach(()=>vi.useRealTimers());
describe('owned session lifecycle',()=>{
  it('freezes the consented body and rejects oversized events before enqueue or send',()=>{
    const worker=new FakeWorker(),fail=vi.fn(),source=body('original'),session=new ProgramSession(source,{count:0},vi.fn(),fail,()=>worker);
    source.code='changed';source.initialState.count=999;
    worker.reply();session.dispatch({type:'click',action:'add'});
    expect((worker.sent[1] as {body:ProgramBody}).body).toEqual(body('original'));
    session.dispatch({type:'input',action:'edit',value:'x'.repeat(8193)});
    expect(worker.sent).toHaveLength(2);expect(fail).toHaveBeenCalledOnce();expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('rejects other generations/duplicates and makes messages inert after stop',()=>{
    const worker=new FakeWorker(),onResult=vi.fn(),failed=vi.fn();const session=new ProgramSession(body('x'),{count:0},onResult,failed,()=>worker);
    worker.onmessage?.({data:{nonce:'forged',id:1,result:result()}} as MessageEvent);expect(onResult).not.toHaveBeenCalled();
    worker.reply();worker.reply();expect(onResult).toHaveBeenCalledTimes(1);
    session.dispatch({type:'click',action:'increment'});const late=worker.onmessage;session.stop();late?.({data:{...(worker.sent[1] as object),result:result({count:99})}} as MessageEvent);
    expect(onResult).toHaveBeenCalledTimes(1);expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('terminates after invalid output, timeout or bounded queue exhaustion',()=>{
    vi.useFakeTimers();for(const kind of ['invalid','timeout','queue']){const worker=new FakeWorker(),fail=vi.fn();const session=new ProgramSession(body('x'),{count:0},vi.fn(),fail,()=>worker);
      if(kind==='invalid')worker.reply(0,{state:{count:999},view:{tag:'script'}});
      if(kind==='timeout')vi.advanceTimersByTime(15001);
      if(kind==='queue')for(let i=0;i<17;i++)session.dispatch({type:'click',action:'add'});
      expect(fail).toHaveBeenCalledOnce();expect(worker.terminate).toHaveBeenCalledOnce();session.stop();
    }
  });
  it('serializes events from the last accepted state and stops periodic ticks',()=>{
    vi.useFakeTimers();const worker=new FakeWorker(),session=new ProgramSession({...body('x'),intervalMs:50},{count:0},vi.fn(),vi.fn(),()=>worker);
    session.dispatch({type:'click',action:'add'});worker.reply(0,result({count:7}));expect((worker.sent[1] as {state:unknown}).state).toEqual({count:7});worker.reply(1);session.stop();vi.advanceTimersByTime(1000);expect(worker.sent).toHaveLength(2);
  });
});
