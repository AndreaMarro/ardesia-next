import {readFileSync,writeFileSync,cpSync,mkdirSync} from 'node:fs';import{spawnSync}from'node:child_process';import{gzipSync}from'node:zlib';import{resolve}from'node:path';
const base=resolve('work/core-budget-candidate'),repo=resolve(base,'repo'),node=process.execPath;
const original=readFileSync(repo+'/apps/web/vite.config.ts','utf8');
writeFileSync(base+'/original-vite.config.ts',original);
const variants={oxc:original.replace("minify: 'terser'", "minify: 'oxc'"),rolldownOnly:original.replace("minify: 'terser'", "minify: false"),terserNoCompress:original.replace("compress: {passes: 3, reduce_funcs: false, sequences: false, join_vars: false}","compress: false"),terserNoMangle:original.replace("terserOptions: {ecma:","terserOptions: {mangle: false, ecma:")};
const results=[];
for(const[name,config]of Object.entries(variants)){
 writeFileSync(repo+'/apps/web/vite.config.ts',config);const out=spawnSync(node,[repo+'/node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--configLoader','native'],{cwd:repo,encoding:'utf8',env:{...process.env,PATH:resolve(node,'..')+':'+process.env.PATH},maxBuffer:1024*1024*5});writeFileSync(base+'/build-'+name+'.log',out.stdout+out.stderr);if(out.status!==0){console.log(name,'FAILED');results.push({name,status:out.status});continue;}
 const manifest=JSON.parse(readFileSync(repo+'/apps/web/dist/.vite/manifest.json','utf8')),entries=Object.values(manifest).filter(x=>x.file.endsWith('.js')&&!/^assets\/(?:ProgramSurface|program-example|pdf-engine|pdf\.worker)/.test(x.file)).map(x=>({file:x.file,gzip:gzipSync(readFileSync(repo+'/apps/web/dist/'+x.file)).length})); const total=entries.reduce((sum,x)=>sum+x.gzip,0);results.push({name,total,entries});mkdirSync(base+'/dist-'+name,{recursive:true});cpSync(repo+'/apps/web/dist',base+'/dist-'+name,{recursive:true});writeFileSync(base+'/final-minifier-probe.json',JSON.stringify(results,null,2));console.log(name,total);
}
writeFileSync(repo+'/apps/web/vite.config.ts',original);
