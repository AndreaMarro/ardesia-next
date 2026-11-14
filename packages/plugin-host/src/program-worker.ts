import wasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url';
import {executeProgram} from './program-engine';
import {createProgramModule} from './program-module';
import type {ProgramBody,ProgramEvent,ProgramResult} from '@ardesia/contracts';

let engine:ReturnType<typeof createProgramModule>|undefined;
const endpoint=globalThis as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(message:unknown)=>void};
let sessionNonce:string|undefined,ready=false;
endpoint.onmessage=async message=>{
  const {kind,nonce,id,body,state,event}=message.data as {kind?:string;nonce:string;id:number;body:ProgramBody;state:ProgramResult['state'];event:ProgramEvent};
  if(kind==='initialize'){
    if(sessionNonce!==undefined||typeof nonce!=='string')return;
    sessionNonce=nonce;
    try {engine=createProgramModule(wasmUrl);await engine;ready=true;endpoint.postMessage({kind:'ready',nonce});}
    catch {endpoint.postMessage({kind:'initialization-error',nonce});}
    return;
  }
  if(!ready||nonce!==sessionNonce||!engine)return;
  try {endpoint.postMessage({nonce,id,result:executeProgram(await engine,body,state,event)});}
  catch(error){endpoint.postMessage({nonce,id,error:error instanceof Error?error.message:'Esecuzione non riuscita.'});}
};
