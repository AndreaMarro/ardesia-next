import {newQuickJSWASMModuleFromVariant, newVariant} from 'quickjs-emscripten-core';
import variant from '@jitl/quickjs-wasmfile-release-sync';
import {PROGRAM_LIMITS} from './program-limits';

/** Bound the whole WASM module, including the engine and guest allocations.
 * The Emscripten allocator's per-runtime accounting is not a cumulative cap.
 * A fresh memory belongs to one Worker; it is never shared between sessions.
 */
export function createProgramModule(wasmLocation?: string) {
  const pages = PROGRAM_LIMITS.memoryBytes / 65536;
  const wasmMemory = new WebAssembly.Memory({initial: pages, maximum: pages});
  return newQuickJSWASMModuleFromVariant(newVariant(variant, {wasmMemory, ...(wasmLocation ? {wasmLocation} : {})}));
}
