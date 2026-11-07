import {newQuickJSWASMModuleFromVariant,newVariant} from 'quickjs-emscripten-core';
import variant from '@jitl/quickjs-wasmfile-release-sync';
import wasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url';
import {executeProgram} from './program-engine';
import type {ProgramBody,ProgramEvent,ProgramResult} from '@ardesia/contracts';

const engine=newQuickJSWASMModuleFromVariant(newVariant(variant,{wasmLocation:wasmUrl}));
const endpoint=globalThis as unknown as {onmessage:((event:MessageEvent)=>void)|null;postMessage:(message:unknown)=>void};
endpoint.onmessage=async message=>{
  const {nonce,id,body,state,event}=message.data as {nonce:string;id:number;body:ProgramBody;state:ProgramResult['state'];event:ProgramEvent};
  try {endpoint.postMessage({nonce,id,result:executeProgram(await engine,body,state,event)});}
  catch(error){endpoint.postMessage({nonce,id,error:error instanceof Error?error.message:'Esecuzione non riuscita.'});}
};
