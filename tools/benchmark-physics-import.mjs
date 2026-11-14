// Synthetic Core-only measurement; excludes HTTP, PostgreSQL and browser rendering.
// Capture a comparable baseline before changing Core:
//   node tools/benchmark-physics-import.mjs --capture /tmp/physics-core-before.mjs
// Compare after the change (one warmup + three measured runs per implementation):
//   node tools/benchmark-physics-import.mjs --compare /tmp/physics-core-before.mjs /tmp/physics-import.json
import {build} from 'vite';
import {readFile,writeFile,mkdtemp,rm,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir,cpus,platform,arch} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const [mode,baselinePath,outputPath]=process.argv.slice(2);
if(!baselinePath||!['--capture','--compare'].includes(mode)||mode==='--compare'&&!outputPath)throw Error('Use --capture MODULE or --compare BASELINE_MODULE REPORT_JSON');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const temp=await mkdtemp(join(tmpdir(),'ardesia-physics-core-'));
try{
 await build({root,configFile:false,publicDir:false,logLevel:'silent',ssr:{target:'node',noExternal:true},
  build:{ssr:resolve(root,'packages/core/src/index.ts'),target:'es2023',outDir:temp,emptyOutDir:false,minify:false,
   rolldownOptions:{output:{format:'es',entryFileNames:'core.mjs',codeSplitting:false}}}});
 const current=join(temp,'core.mjs');
 if(mode==='--capture'){
  await copyFile(current,resolve(baselinePath));
  console.log(JSON.stringify({module:resolve(baselinePath),sha256:hash(await readFile(current))}));
 }else{
  const fixturePath='apps/web/src/courses/physics/data/sf-2026-fluidi.json',fixture=await readFile(resolve(root,fixturePath)),pack=JSON.parse(fixture);
  const implementations={baseline:await import(pathToFileURL(resolve(baselinePath)).href),candidate:await import(pathToFileURL(current).href)};
  const actor={actorId:'physics-benchmark',role:'teacher'},commands=[];
  for(const doc of pack.documents){
   commands.push({kind:'create-document',commandId:doc.id+':create',documentId:doc.id,expectedRevision:0,title:doc.title});
   for(const [index,object] of doc.objects.entries())commands.push({kind:'add-object',commandId:doc.id+':add:'+index,documentId:doc.id,expectedRevision:index+1,object});
  }
  const course={kind:'save-course',commandId:pack.courseId+':create',courseId:pack.courseId,expectedRevision:0,input:pack.input};
  const samples=[],digests=new Set();
  async function run(name,warmup){
   const {createCore,MemoryStorage}=implementations[name],storage=new MemoryStorage();let counter=0,openMs=0,executeMs=0,core;
   const options={storage,workspaceId:'physics-benchmark',clock:()=> '2026-11-13T00:00:00.000Z',id:()=>`event-${++counter}`};
   const start=performance.now();
   for(const command of [...commands,course]){
    let at=performance.now();core=await createCore(options);openMs+=performance.now()-at;
    at=performance.now();const receipt=command.kind==='save-course'?await core.executeCourse(actor,command):await core.execute(actor,command);executeMs+=performance.now()-at;
    assert.equal(command.kind==='save-course'?receipt.entityRevision:receipt.documentRevision,command.expectedRevision+1);
   }
   const totalMs=performance.now()-start,snapshot=core.snapshot(),snapshotSha256=hash(JSON.stringify(snapshot));
   assert.equal(snapshot.documents.length,pack.documents.length);assert.equal(snapshot.receipts.length,commands.length+1);
   assert.deepEqual((await createCore(options)).snapshot(),snapshot);
   // Retry after reopen remains idempotent, including old receipts after later edits.
   const reopened=await createCore(options);await reopened.execute(actor,commands[0]);await reopened.executeCourse(actor,course);
   assert.deepEqual(reopened.snapshot(),snapshot);digests.add(snapshotSha256);
   samples.push({implementation:name,warmup,openMs,executeMs,totalMs,snapshotSha256});
  }
  await run('baseline',true);await run('candidate',true);
  for(let round=0;round<3;round++)for(const name of round%2?['candidate','baseline']:['baseline','candidate'])await run(name,false);
  assert.equal(digests.size,1,'Implementations must produce identical snapshots, events and receipts');
  const median=name=>samples.filter(s=>s.implementation===name&&!s.warmup).map(s=>s.totalMs).sort((a,b)=>a-b)[1];
  const sources={};for(const path of ['packages/core/src/index.ts','packages/core/src/extensions.ts','tools/benchmark-physics-import.mjs'])sources[path]=hash(await readFile(resolve(root,path)));
  const report={format:'ardesia-physics-import-benchmark/1',measuredAt:new Date().toISOString(),scope:'Core reopen + command per request, MemoryStorage; no HTTP, PostgreSQL or browser. No end-to-end speed claim.',
   environment:{node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model},fixture:{path:fixturePath,sha256:hash(fixture),commands:commands.length+1,objects:pack.documents.reduce((n,d)=>n+d.objects.length,0)},
   modules:{baseline:hash(await readFile(resolve(baselinePath))),candidate:hash(await readFile(current))},sourceFiles:sources,samples,
   medianMs:{baseline:median('baseline'),candidate:median('candidate')},reductionPercent:100*(1-median('candidate')/median('baseline')),identicalSnapshotSha256:[...digests][0]};
  await writeFile(resolve(outputPath),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({report:resolve(outputPath),medianMs:report.medianMs,reductionPercent:report.reductionPercent,identicalSnapshots:true}));
 }
}finally{await rm(temp,{recursive:true,force:true});}
