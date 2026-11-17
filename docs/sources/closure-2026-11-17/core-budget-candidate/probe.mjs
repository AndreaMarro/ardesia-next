import{readFileSync,writeFileSync}from'node:fs';import{gzipSync}from'node:zlib';import{createRequire}from'node:module';
const require=createRequire(new URL('../ardesia-next/package.json',import.meta.url)),{minify}=require('terser'),base=new URL('../ardesia-next/',import.meta.url),report=JSON.parse(readFileSync(new URL('artifacts/budget.json',base)));
const files=report.files.filter(x=>x.file.startsWith('assets/')&&!/^assets\/(?:ProgramSurface|program-example|pdf-engine|pdf\.worker)/.test(x.file)&&x.file.endsWith('.js'));
const results=[];
for(const file of files){const code=readFileSync(new URL('apps/web/dist/'+file.file,base),'utf8');
 const ascii=await minify(code,{ecma:2022,compress:false,mangle:false,format:{ascii_only:true,comments:false}}),utf=await minify(code,{ecma:2022,compress:false,mangle:false,format:{ascii_only:false,comments:false}});
 results.push({file:file.file,before:file.gzipBytes,ascii:gzipSync(ascii.code).length,utf8:gzipSync(utf.code).length,delta:gzipSync(utf.code).length-file.gzipBytes});}
writeFileSync(new URL('probe.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify({files:results,totalDelta:results.reduce((n,x)=>n+x.delta,0)},null,2));
