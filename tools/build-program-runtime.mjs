import {build} from 'vite';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
/** Optional engine is a separate build: no existing asset is moved out of the baseline budget. */
export async function buildProgramRuntime(){
  const outDir='apps/web/dist/program-runtime';
  await build({configFile:false,publicDir:false,base:'/program-runtime/',logLevel:'warn',build:{
    target:'es2022',outDir,emptyOutDir:true,assetsInlineLimit:0,minify:'terser',sourcemap:false,
    rolldownOptions:{input:'packages/plugin-host/src/program-worker.ts',output:{entryFileNames:'worker.js',chunkFileNames:'[name]-[hash].js',assetFileNames:'[name]-[hash][extname]'}},
  }});
  const files=readdirSync(outDir).map(name=>{const body=readFileSync(join(outDir,name));return {file:name,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')};});
  writeFileSync(join(outDir,'manifest.json'),JSON.stringify({abi:'ardesia.program/1',engine:'quickjs-emscripten@0.32.0',files},null,2));
  const packages=['quickjs-emscripten-core','@jitl/quickjs-wasmfile-release-sync','@jitl/quickjs-ffi-types'];
  writeFileSync(join(outDir,'THIRD_PARTY_NOTICES.txt'),packages.map(name=>name+'\n'+readFileSync(join('node_modules',name,'LICENSE'),'utf8')).join('\n\n'));
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/program-runtime-build.json',JSON.stringify({files},null,2));
}

if(process.argv[1]?.endsWith('/build-program-runtime.mjs'))await buildProgramRuntime();
