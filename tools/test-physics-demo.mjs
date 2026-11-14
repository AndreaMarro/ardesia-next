import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({...(process.env.ARDESIA_BROWSER?{executablePath:process.env.ARDESIA_BROWSER}:{}),headless:true,args:['--no-sandbox']});
const results=[];
const manifest=JSON.parse(fs.readFileSync('apps/web/public/fisica/manifest.json','utf8'));
const originals=JSON.parse(fs.readFileSync('docs/sources/physics-2026-27/editorial/original-problems.json','utf8'));
async function quiz(page,index,{storage=true}={}){
 const record=manifest.pages.find(p=>p.file===`c${index}.html`),source=originals.find(q=>q.id===record.quizId);
 assert.equal(source.unitId,record.quizUnitId);
 const section=page.getByRole('region',{name:source.title,exact:true}),alternatives=section.locator('details.quiz-alternative');
 assert.equal(await alternatives.count(),5);assert.equal(await section.locator('details[open]').count(),0);
 assert.equal(await section.locator('.quiz-feedback:visible').count(),0);
 assert.equal(await section.locator('.quiz-reasoning .prose').isVisible(),false);
 for(const choice of source.choices){
  const option=section.locator(`details[data-choice="${choice.id}"]`),summary=option.locator(':scope > summary');
  assert.equal(await summary.innerText(),`${choice.id}. ${choice.text}`);
  assert.ok((await summary.boundingBox()).height>=44);
  await summary.focus();await page.keyboard.press('Enter');
  assert.notEqual(await option.getAttribute('open'),null);
  assert.equal(await section.locator('.quiz-feedback:visible').count(),1);
  assert.equal(await option.locator('.quiz-verdict').innerText(),choice.id===source.correctChoice?'Alternativa corretta.':'Alternativa da rivedere.');
  assert.equal(await option.locator('.prose').innerText(),choice.feedback);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 const last=alternatives.last().locator(':scope > summary');await last.focus();await page.keyboard.press('Enter');
 assert.equal(await section.locator('.quiz-feedback:visible').count(),0);
 const solution=section.getByText('Leggi lo svolgimento completo del quiz',{exact:true});await solution.focus();await page.keyboard.press('Enter');
 assert.equal(await section.locator('.quiz-reasoning .prose').innerText(),source.solution);
 await solution.press('Enter');assert.equal(await section.locator('.quiz-reasoning .prose').isVisible(),false);
 if(storage)assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
 return {quizId:source.id,unitId:source.unitId,alternatives:5,feedback:'EXACT_SOURCE_MATCH',keyboard:'PASS',storage:storage?'EMPTY':'NOT_READ_FILE_ORIGIN'};
}
try{for(const width of [390,820,1440]){
 const page=await browser.newPage({viewport:{width,height:960}}), errors=[], external=[], api=[], quizzes=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/'))external.push(r.url());if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
 await page.goto('http://127.0.0.1:4173/fisica/index.html');
 await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').innerText(),'Vai al contenuto');
 await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'main');
 await page.getByLabel('Raggio rispetto').focus();await page.keyboard.press('Home');assert.match(await page.locator('#ratio').innerText(),/0,0625/);assert.equal(await page.locator('#flow').getAttribute('width'),'6.25');
 await page.keyboard.press('End');assert.match(await page.locator('#ratio').innerText(),/5,0625/);
 await page.locator('#laboratorio').screenshot({path:`/tmp/ardesia-demo-lab-${width}.png`});
 for(let i=1;i<=5;i++){
  await page.goto(`http://127.0.0.1:4173/fisica/c${i}.html`);
  assert.equal(await page.locator('h1').count(),1);
  await page.getByRole('link',{name:'Prova il quiz',exact:true}).click();assert.equal(new URL(page.url()).hash,'#quiz');
  quizzes.push(await quiz(page,i));
  if(i===2){await page.locator('.quiz-alternative').first().locator(':scope > summary').click();await page.locator('#quiz').screenshot({path:`/tmp/ardesia-demo-quiz-${width}.png`});}
  const solution=page.getByText('Confronta i passaggi e il risultato',{exact:true});
  assert.equal(await solution.locator('..').getAttribute('open'),null);
  await solution.click();assert.notEqual(await solution.locator('..').getAttribute('open'),null);
  const href=await page.getByRole('link',{name:'Chiedi disponibilità su WhatsApp'}).getAttribute('href');
  assert.match(href,/^https:\/\/wa.me\/393461653930/);assert.match(decodeURIComponent(href),/non una prenotazione confermata/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(i===5){
   const lab=page.locator('#interferenza');
   assert.equal(await lab.locator('.interference-case:visible').count(),1);
   await lab.getByRole('radio',{name:'Sfasate di 120°',exact:true}).focus();
   await page.keyboard.press('ArrowRight');
   assert.equal(await lab.getByRole('radio',{name:'Opposte e uguali',exact:true}).isChecked(),true);
   assert.match(await lab.locator('.interference-case:visible').innerText(),/Ampiezza risultante\s+0 cm/);
   assert.equal(await lab.getByRole('img').count(),1);
   await lab.getByText('Opposte e diverse',{exact:true}).first().click();
   assert.match(await lab.locator('.interference-case:visible').innerText(),/Ampiezza risultante\s+1 cm/);
   assert.match(await lab.locator('.interference-case:visible').innerText(),/Spostamento a 0,125 s\s+-1 cm/);
   await lab.getByText('In fase',{exact:true}).first().click();
   assert.match(await lab.locator('.interference-case:visible').innerText(),/Ampiezza risultante\s+2 cm/);
   await lab.screenshot({path:`/tmp/ardesia-demo-interference-${width}.png`});
  }
 }
 await page.goto('http://127.0.0.1:4173/fisica/index.html');await page.screenshot({path:`/tmp/ardesia-demo-${width}.png`,fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(api,[]);assert.deepEqual(await page.context().cookies(),[]);results.push({width,courses:5,quizzes,labEndpoints:'PASS',keyboard:'PASS',contact:'INSPECTED_NOT_SENT',errors,external,api,cookies:'EMPTY'});await page.close();
}
const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();await page.goto('http://127.0.0.1:4173/fisica/index.html');assert.equal(await page.locator('#radius').isDisabled(),true);assert.ok(await page.locator('noscript').isVisible());await page.goto('http://127.0.0.1:4173/fisica/c2.html');await page.getByText('Confronta i passaggi e il risultato',{exact:true}).click();assert.notEqual(await page.getByText('Confronta i passaggi e il risultato',{exact:true}).locator('..').getAttribute('open'),null);results.push({noJavaScript:'PASS'});
const noScriptQuizzes=[];
for(let i=1;i<=5;i++){await page.goto(`http://127.0.0.1:4173/fisica/c${i}.html`);noScriptQuizzes.push(await quiz(page,i));}
results.push({quizzesWithoutJavaScript:noScriptQuizzes});
await page.goto('http://127.0.0.1:4173/fisica/c5.html');
const lab=page.locator('#interferenza');await lab.getByText('Opposte e uguali',{exact:true}).first().click();
assert.equal(await lab.locator('.interference-case:visible').count(),1);
assert.match(await lab.locator('.interference-case:visible').innerText(),/Ampiezza risultante\s+0 cm/);
await lab.getByRole('radio',{name:'Opposte e uguali',exact:true}).focus();await page.keyboard.press('ArrowRight');
assert.match(await lab.locator('.interference-case:visible').innerText(),/Ampiezza risultante\s+1 cm/);
results.push({interferenceWithoutJavaScript:'PASS',source:'canonical declarative lab',states:4});
const offline=await browser.newContext({javaScriptEnabled:false,offline:true,viewport:{width:390,height:960}}),filePage=await offline.newPage(),offlineQuizzes=[],outbound=[];
filePage.on('request',r=>{if(/^https?:/.test(r.url()))outbound.push(r.url())});
for(let i=1;i<=5;i++){
 await filePage.goto(new URL(`../apps/web/dist/fisica/c${i}.html`,import.meta.url).href);
 offlineQuizzes.push(await quiz(filePage,i,{storage:false}));
 await filePage.getByRole('link',{name:'Esplora i percorsi →',exact:true}).click();assert.match(filePage.url(),/\/index\.html#percorsi$/);
 assert.equal(await filePage.locator('#percorsi .grid article').count(),5);
}
assert.deepEqual(outbound,[]);results.push({offlineFileQuizzes:offlineQuizzes,outbound,javaScript:false,networkOffline:true});
fs.writeFileSync('/tmp/ardesia-demo-browser.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
