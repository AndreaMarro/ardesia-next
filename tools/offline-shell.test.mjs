import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';

const expected={'/':'<!doctype html><p>Offline fixture</p>','/assets/ui.js':'console.log("Fixture")','/assets/ui.css':'body{color:#123}',
  '/pdf-runtime/fonts/test.bin':'Exact font bytes','/build-info.json':'{"sourceDigest":"fixture"}'};
function build(){
  const root=mkdtempSync(join(tmpdir(),'ardesia-offline-shell-'));
  try{
    for(const [path,bytes] of Object.entries(expected)){
      const target=join(root,'apps/web/dist',path==='/'?'index.html':path);
      mkdirSync(resolve(target,'..'),{recursive:true});writeFileSync(target,bytes);
    }
    cpSync('apps/web/offline-worker.js',join(root,'apps/web/offline-worker.js'));
    const module=pathToFileURL(resolve('tools/build-offline-shell.mjs')).href;
    const result=spawnSync(process.execPath,['--input-type=module','-e',`import {buildOfflineShell} from ${JSON.stringify(module)};buildOfflineShell({sourceDigest:'fixture'});`],{cwd:root,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    return readFileSync(join(root,'apps/web/dist/sw.js'),'utf8');
  }finally{rmSync(root,{recursive:true,force:true});}
}
function worker(source,alteredPath){
  const listeners=new Map(),deleted=[],requested=[],cached=new Map();
  let cacheName;
  const cache={
    addAll:async requests=>{for(const request of requests){requested.push(request);const path=new URL(request.url).pathname;cached.set(path,new Response(expected[path]+(path===alteredPath?'changed':'')));}},
    match:async path=>cached.get(path)?.clone(),
  };
  class LocalRequest extends Request{constructor(path,options){super(new URL(path,'https://fixture.test'),options);}}
  runInNewContext(source,{crypto:webcrypto,Uint8Array,btoa,Request:LocalRequest,URL,
    caches:{open:async name=>{cacheName=name;return cache;},delete:async name=>{deleted.push(name);cached.clear();},keys:async()=>[cacheName]},
    self:{addEventListener:(event,callback)=>listeners.set(event,callback),location:{origin:'https://fixture.test'},clients:{claim:async()=>{}}}});
  return{listeners,deleted,requested,cached};
}
test('generated offline shell checks every original asset and does not intercept API or cross-origin requests',async()=>{
  const fixture=worker(build());let ready;
  fixture.listeners.get('install')({waitUntil:promise=>{ready=promise;}});await ready;
  assert.deepEqual(fixture.requested.map(request=>new URL(request.url).pathname).sort(),Object.keys(expected).sort());
  assert.ok(fixture.requested.every(request=>request.cache==='reload'&&request.redirect==='error'));
  assert.deepEqual(fixture.deleted,[]);
  for(const url of ['https://fixture.test/api/m3','https://fixture.test/assets/ui.js?changed=1','https://other.test/assets/ui.js']){
    fixture.listeners.get('fetch')({request:new Request(url),respondWith:()=>assert.fail('Unexpected interception')});
  }
});
test('a single changed byte in any asset rejects and deletes the incomplete offline shell',async()=>{
  const source=build();
  for(const path of Object.keys(expected)){
    const fixture=worker(source,path);let ready;
    fixture.listeners.get('install')({waitUntil:promise=>{ready=promise;}});
    await assert.rejects(ready,/Mixed or changed shell/);
    assert.equal(fixture.deleted.length,1);assert.equal(fixture.cached.size,0);
  }
});
