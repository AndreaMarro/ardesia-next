import type {QuickJSWASMModule} from 'quickjs-emscripten-core';
import {ProgramEventSchema, ProgramBodySchema, ProgramStateSchema, type ProgramBody, type ProgramEvent, type ProgramResult} from '@ardesia/contracts';
import {validateProgramResult} from './program-view';

export const PROGRAM_LIMITS = Object.freeze({memoryBytes:16*1024*1024,stackBytes:128*1024,executionMs:100,outputBytes:131072,watchdogMs:2000,initializationMs:15000,queue:16});
/** Untrusted code stays inside QuickJS. There are deliberately no native functions, loaders or IO bridges. */
export function executeProgram(engine:QuickJSWASMModule, body:ProgramBody, state:ProgramResult['state'], event:ProgramEvent):ProgramResult {
  ProgramBodySchema.parse(body); ProgramStateSchema.parse(state); ProgramEventSchema.parse(event);
  const runtime=engine.newRuntime();
  runtime.setMemoryLimit(PROGRAM_LIMITS.memoryBytes);
  runtime.setMaxStackSize(PROGRAM_LIMITS.stackBytes);
  const deadline=performance.now()+PROGRAM_LIMITS.executionMs;
  runtime.setInterruptHandler(()=>performance.now()>deadline);
  const vm=runtime.newContext();
  try {
    const input=JSON.stringify(JSON.stringify({state,event}));
    const source='(() => { "use strict";\n'+body.code+'\n; return JSON.stringify(update(JSON.parse('+input+'))); })()';
    const result=vm.evalCode(source,'user-program.js');
    if(result.error){
      let detail='Il programma ha un errore o ha superato il tempo, la memoria o lo stack disponibili.';
      try {if(vm.typeof(result.error)==='string'){const error=vm.getString(result.error);if(error)detail=error.slice(0,800);}}catch{/* Error inspection has the same VM deadline. */}
      finally {result.error.dispose();}
      throw Error(detail);
    }
    try {
      if(vm.typeof(result.value)!=='string')throw Error('update deve restituire stato e interfaccia come dati JSON.');
      const json=vm.getString(result.value);
      if(json.length>PROGRAM_LIMITS.outputBytes || new TextEncoder().encode(json).byteLength>PROGRAM_LIMITS.outputBytes)throw Error('Il risultato del programma è troppo grande.');
      return validateProgramResult(JSON.parse(json));
    } finally {result.value.dispose();}
  } finally {vm.dispose();runtime.dispose();}
}
