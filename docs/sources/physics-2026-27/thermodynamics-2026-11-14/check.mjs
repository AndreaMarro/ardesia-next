import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {chromium} from '../ardesia-next/node_modules/playwright/index.mjs';
const base=new URL('../thermodynamics-lab-candidate/',import.meta.url),out=new URL('./',import.meta.url),pub=new URL('apps/web/public/fisica/',base);
const files=['candidate.patch','tools/build-physics-thermodynamics.mjs','tools/physics-runtime/termodinamica.js','apps/web/public/fisica/termodinamica.html','apps/web/public/fisica/termodinamica.js','apps/web/public/fisica/termodinamica-manifest.json'];
const report={node:process.version,sha256:{},numeric:{},browser:[]};
for(const f of files)report.sha256[f]=createHash('sha256').update(readFileSync(new URL(f,base))).digest('hex');
assert.equal(report.sha256['candidate.patch'],'8b7b36a7c063e5d68b5d8ec6e4fb8b755ce08121a8a30d7c0804a65c92e55948');
const model=f=>{let c={module:{exports:{}}};vm.runInNewContext(readFileSync(new URL(f,base),'utf8'),c);return c.module.exports.solve};
const source=model('tools/physics-runtime/termodinamica.js'),minified=model('apps/web/public/fisica/termodinamica.js');
const R=8.31446261815324,pi=1e5,Ti=300,Vi=R*Ti/pi;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
// Independent path quadrature: compute temperature at 100 subsegments/leg,
// integrate dU=Cv*dT and dQ=Cv*dT+p*dV along each piecewise straight path.
function integrate(vertices){let w=0,q=0,du=0;for(let j=1;j<vertices.length;j++){
 const a=vertices[j-1],b=vertices[j];for(let k=0;k<100;k++){
 const z=k/100,z1=(k+1)/100,p=a[0]+(b[0]-a[0])*z,p1=a[0]+(b[0]-a[0])*z1,V=a[1]+(b[1]-a[1])*z,V1=a[1]+(b[1]-a[1])*z1;
 const dT=(p1*V1-p*V)/R,dV=V1-V,work=(p+p1)/2*dV,energy=1.5*R*dT;
 w+=work;du+=energy;q+=energy+work;
 }}return {w,q,du};}
let count=0;
const inputs=[];for(let i=0;i<31;i++)for(let j=0;j<31;j++)inputs.push([.5+i*.05,.5+j*.05]);
inputs.push([Math.SQRT2,1/Math.SQRT2],[.713,1.357],[1.731,.831]);
for(const [v,p] of inputs){const A=integrate([[pi,Vi],[pi,v*Vi],[pi*p,v*Vi]]),B=integrate([[pi,Vi],[pi*p,Vi],[pi*p,v*Vi]]),s=source(v,p),m=minified(v,p);
 for(const [actual,expected] of [[s.qa,A.q],[s.qb,B.q],[s.wa,A.w],[s.wb,B.w],[s.du,A.du],[s.du,B.du],[s.Tf,p*pi*v*Vi/R],[s.dw,B.w-A.w]])near(actual,expected);
 for(const key of Object.keys(s))near(s[key],m[key]);count++;
}
report.numeric.quadratureCases=count;
report.numeric.counterexamples=[['same temperature, compression',.5,2],['same temperature, expansion',2,.5],['compress at lower final pressure',.5,.5],['expand at lower final pressure',2,.5],['unchanged state',1,1],['pure isochore',1,2],['pure isobar',2,1]].map(([name,v,p])=>({name,...source(v,p)}));
for(const f of [source,minified])for(const a of [[NaN,1],[1,Infinity],[1,-Infinity],[0,1],[2.001,1],[1,.4999],['1',1],[null,1],[undefined,1]])assert.throws(()=>f(...a));
report.numeric.invalidInputChecks=18;
report.runtimeGzipBytes=gzipSync(readFileSync(new URL('termodinamica.js',pub))).length;
assert.ok(report.runtimeGzipBytes<=2300);
const manifest=JSON.parse(readFileSync(new URL('termodinamica-manifest.json',pub)));for(const f of manifest.files){assert.equal(f.sha256,report.sha256['apps/web/public/fisica/'+f.file]);assert.equal(f.rawBytes,readFileSync(new URL(f.file,pub)).length);}
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,1280]){
 const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>network.push(r.url()));
 await page.goto(new URL('termodinamica.html',pub).href);
 const assertWidth=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 await assertWidth();assert.equal(await page.locator('#controls').isDisabled(),false);
 // Native selects supplied through browser automation; keyboard Tab/Enter submits.
 // macOS Chromium automation did not commit native-menu options using keys alone.
 await page.locator('#energy').selectOption('same');await page.locator('#work').selectOption('b');await page.locator('#work').focus();await page.keyboard.press('Tab');await page.keyboard.press('Enter');
 assert.equal(await page.locator('#results').isVisible(),true);assert.equal(await page.locator('#feedback').evaluate(n=>document.activeElement===n),true);
 assert.match(await page.locator('#work-feedback').innerText(),/corretta/);
 // Native Home/End/Arrow keys reach exact bounds and invalidate old prediction.
 await page.locator('#volume').focus();await page.keyboard.press('Home');assert.equal(await page.locator('#volume').inputValue(),'0.5');assert.equal(await page.locator('#results').isVisible(),false);assert.equal(await page.locator('#energy').inputValue(),'');
 await page.locator('#pressure').focus();await page.keyboard.press('End');assert.equal(await page.locator('#pressure').inputValue(),'2');
 await page.locator('#energy').selectOption('same');await page.locator('#work').selectOption('a');await page.getByRole('button',{name:'Confronta la previsione',exact:true}).click();
 assert.match(await page.locator('#work-feedback').innerText(),/corretta/);assert.equal(await page.locator('[data-value="du"]').first().innerText(),'0');assert.equal(await page.locator('[data-value="qa"]').innerText(),'-1.247,17');assert.equal(await page.locator('[data-value="qb"]').innerText(),'-2.494,34');
 assert.equal(await page.locator('#path-a').getAttribute('d'),'M260 180 H160 V60');assert.equal(await page.locator('#path-b').getAttribute('d'),'M260 180 V60 H160');
 await assertWidth();await page.locator('figure').scrollIntoViewIfNeeded();await page.screenshot({path:new URL(`compression-graph-${width}.png`,out).pathname});
 await page.locator('#results').scrollIntoViewIfNeeded();await page.screenshot({path:new URL(`compression-result-${width}.png`,out).pathname});
 // Lower pressure compression is a counterexample to "compression always makes B smaller".
 await page.locator('#pressure').focus();await page.keyboard.press('Home');
 await page.locator('#energy').selectOption('same');await page.locator('#work').selectOption('b');await page.getByRole('button',{name:'Confronta la previsione',exact:true}).click();assert.match(await page.locator('#work-feedback').innerText(),/corretta/);assert.equal(await page.locator('[data-value="wb"]').innerText(),'-623,58');
 await page.getByRole('button',{name:'Solo isocore',exact:true}).click();await page.locator('#energy').selectOption('same');await page.locator('#work').selectOption('equal');await page.getByRole('button',{name:'Confronta la previsione',exact:true}).click();assert.equal(await page.locator('[data-value="wa"]').innerText(),'0');assert.equal(await page.locator('[data-value="wb"]').innerText(),'0');
 await page.locator('#transfer-answer').selectOption('zero');await page.getByRole('button',{name:'Verifica il ragionamento',exact:true}).click();assert.match(await page.locator('#transfer-feedback').innerText(),/Rivedi il segno/);
 await page.locator('#transfer-answer').selectOption('negative');await page.getByRole('button',{name:'Verifica il ragionamento',exact:true}).click();assert.match(await page.locator('#transfer-feedback').innerText(),/Corretto/);assert.equal(await page.locator('#transfer-feedback').evaluate(n=>document.activeElement===n),true);
 assert.equal(await page.evaluate(()=>localStorage.length),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);await assertWidth();assert.deepEqual(errors,[]);assert.ok(network.every(url=>url.startsWith('file:')));
 report.browser.push({width,passed:true,network,errors,keyboard:'ranges Home/End; Tab/Enter submit; full native select keyboard selection not established',stalePredictionReset:true,transfer:true,compressionOrderingBothPressureDirections:true});await ctx.close();
 }
 const ctx=await browser.newContext({viewport:{width:320,height:900},javaScriptEnabled:false}),page=await ctx.newPage();await page.goto(new URL('termodinamica.html',pub).href);assert.equal(await page.locator('#volume').isDisabled(),true);assert.equal(await page.locator('#energy').isDisabled(),true);assert.equal(await page.locator('#transfer-answer').isDisabled(),true);await page.locator('summary').click();assert.match(await page.locator('details').innerText(),/6547,64 J/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('details').scrollIntoViewIfNeeded();await page.screenshot({path:new URL('no-js-320.png',out).pathname});report.browser.push({width:320,javaScript:false,disabledControls:true,workedExampleReadable:true});await ctx.close();
}finally{await browser.close();writeFileSync(new URL('results.json',out),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({numeric:report.numeric.quadratureCases,browserContexts:report.browser.length,runtimeGzipBytes:report.runtimeGzipBytes,passed:true}));
