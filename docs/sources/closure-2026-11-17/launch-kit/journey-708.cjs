const {chromium}=require('../../ardesia-next/node_modules/@playwright/test'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const b=await chromium.launch(),c=await b.newContext({offline:true,viewport:{width:1280,height:900}}),p=await c.newPage(),errors=[],requests=[],rows=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});const base='file://'+path.join(__dirname,'708-offline')+'/';try{
for(const[name,file,selector]of [['C1','urti.html','#m1'],['C2','index.html','#radius'],['C3','termodinamica.html','#volume'],['C4','campo.html','#charge'],['C5','c5.html','#wave-cancelled']]){
 await p.goto(base+file);const before=await p.locator('body').innerText();assert.equal(await p.locator(selector).isDisabled(),false);
 if(name==='C5')await p.locator('label[for="wave-cancelled"]').click();else await p.locator(selector).evaluate(el=>{el.value=el.max;el.dispatchEvent(new Event('input',{bubbles:true}))});
 const after=await p.locator('body').innerText();assert.notEqual(after,before,name+' visible response');rows.push({course:name,file,control:selector,visibleResponse:true});
}
await p.goto(base+'index.html');assert.equal(await p.locator('a[href="./quaderno-esperimenti.pdf"]').count(),1);await p.locator('a[href="./c5.html"]').click();assert.ok(await p.locator('#interferenza').isVisible());
assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);fs.writeFileSync(path.join(__dirname,'journey-708.json'),JSON.stringify({labs:rows,workbookLink:true,C5FromHome:true,errors,requests},null,2));console.log('PASS five instructional lab paths, workbook link and offline behavior');
}finally{await c.close();await b.close()}})();
