const {chromium,devices}=require(process.cwd()+'/node_modules/@playwright/test');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const out=process.argv[2];
const base=process.argv[3]||'http://127.0.0.1:4181/fisica/';
const root='docs/sources/physics-2026-27/question-review/';
const qs=new Map(fs.readdirSync(root+'lots').flatMap(p=>JSON.parse(fs.readFileSync(root+'lots/'+p))).map(x=>[x.id,x]));
const manifest=JSON.parse(fs.readFileSync('apps/web/public/fisica/practice-manifest.json'));
const profiles=[
 ['desktop',{viewport:{width:1440,height:960}}],
 ['smartphone',{...devices['Pixel 7'],viewport:{width:360,height:800}}],
 ['ipad-verticale',{...devices['iPad (gen 7)']}],
 ['ipad-orizzontale',{...devices['iPad (gen 7) landscape']}]
];
(async()=>{
 const browser=await chromium.launch();
 try {
 const result=await Promise.all(profiles.map(async([profile,options])=>{
  const context=await browser.newContext(options);
  const page=await context.newPage();
  page.setDefaultTimeout(3500);
  const failures=[];
  const problems=[];page.on('pageerror',e=>failures.push(e.message));
  const received=[];
  for(const row of manifest.rows){
   const q=qs.get(row.id);
   const article=page.locator('#'+row.id);
   try {
    assert.equal((await page.goto(new URL(row.lesson+'#'+row.id,base).href))?.status()??200,200);
    await article.locator(':scope > summary').waitFor();
    assert.equal(await article.getAttribute('open'),'');
    const hint=article.locator('.reviewed-hint summary').first();
    await (options.hasTouch?hint.tap():hint.click());
    assert.equal(await article.locator('.reviewed-solution').getAttribute('open'),null);
    if(q.answer.kind==='choice'){
      const wrong=q.options.find(o=>o.id!==q.answer.id);
      await article.locator('input[value='+wrong.id+']').check();
      await article.locator('button').click();
      assert.equal(await article.locator('output').innerText(),'Rivedi la scelta.');
      assert.equal(await article.locator('[data-practice-option]:visible').count(),1);
      await article.locator('input[value='+q.answer.id+']').check();
    } else await article.locator('input[name=answer]').fill(q.answer.exact??q.answer.accepted[0]);
    await article.locator('button').click();
    assert.equal(await article.locator('output').innerText(),'Risposta corretta.');
    await article.locator('.reviewed-solution summary').click();
    assert.ok(await article.locator('.reviewed-solution p:visible').count()>1);
    if(q.figure)assert.ok(await article.getByRole('img',{name:q.figure.alt,exact:true}).isVisible());
    const sizing=await article.evaluate(el=>{
      const form=el.querySelector('form');
      return {width:document.documentElement.scrollWidth,viewport:innerWidth,formW:form.scrollWidth,formClient:form.clientWidth,
       clippedMath:[...el.querySelectorAll('.practice-math')].filter(m=>m.clientWidth && m.scrollWidth>m.clientWidth+1).map(m=>m.querySelector('annotation')?.textContent)};
    });
    assert.ok(sizing.width<=sizing.viewport+1&&sizing.formW<=sizing.formClient+1&&sizing.clippedMath.length===0,JSON.stringify(sizing));
    if(row.id==='u7-snell-refracted-sine-06'){
      await article.locator('.reviewed-solution').evaluate(el=>el.scrollIntoView({block:'start'}));
      await page.screenshot({path:out+'/'+profile+'.png'});
    }
    received.push(row.id);
   } catch(e){problems.push([row.id,e.message]);}
  }
  await context.close();
  return {profile,verified:received,problems,failures};
 }));
 fs.writeFileSync(out+'/browser-grid.json',JSON.stringify(result,null,2)+'\n');
 console.log(result.map(r=>({profile:r.profile,verified:r.verified.length,problems:r.problems,errors:r.failures})));
 if(result.some(r=>r.problems.length||r.failures.length))process.exitCode=1;
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
