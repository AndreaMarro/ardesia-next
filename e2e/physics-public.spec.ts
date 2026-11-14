import {test,expect} from '@playwright/test';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {unzipSync} from 'fflate';
import {pathToFileURL} from 'node:url';

test('the public reading edition exposes every complete lesson and its worked practice',async({page,request})=>{
 const manifest=await (await request.get('/fisica/lessons-manifest.json')).json();
 expect(manifest.status).toBe('DRAFT');expect(manifest.humanApproval).toBe(false);
 expect(manifest.pages).toHaveLength(38);expect(manifest.sourcePacks).toHaveLength(5);
 for(const lesson of manifest.pages){
  const response=await request.get('/fisica/'+lesson.file);expect(response.ok()).toBe(true);
  const text=await response.text();expect(text).toContain("id='teoria'");
  expect(text).toContain("id='recupero'");expect(text.match(/class='reader-question'/g)).toHaveLength(lesson.questions);
 }
 await page.goto('/fisica/c1.html#programma');
 await page.locator('#programma details').first().locator('summary').click();
 await page.getByRole('link',{name:'Apri la lezione completa →'}).first().click();
 await expect(page.locator('#teoria')).toBeVisible();
 const question=page.locator('.reader-question').first();await question.locator('summary').first().click();
 await question.getByText('Confronta il ragionamento',{exact:true}).click();
 await expect(question.locator('details')).toHaveAttribute('open','');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(page.locator('[aria-current=page]')).toHaveCount(1);
});

test('practice runs without an Ardesia account, grades answers and exports a source-linked result',async({page})=>{
 const source=JSON.parse(readFileSync('docs/sources/physics-2026-27/editorial/exam-2026-a.json','utf8'));
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/fisica/simulazione.html');await page.locator('#start-practice').click();
 for(const [index,q] of source.questions.entries()){
  if(q.type==='choice')await page.locator(`input[value=${q.correctChoice}]`).check();
  else await page.locator('#completion-answer').fill(q.acceptedAnswers[0]);
  if(index<30)await page.locator('#next').click();
 }
 await page.locator('#submit-exam').click();await page.locator('#confirm-submit').click();
 await expect(page.locator('#result-score')).toContainText('31');
 expect(await page.locator('.review-item').count()).toBe(31);
 const pending=page.waitForEvent('download');await page.locator('#export-result').click();
 const download=await pending;const result=JSON.parse(readFileSync((await download.path())!,'utf8'));
 expect(result.correct).toBe(31);expect(result.score).toBe(31);expect(result.source.humanApproval).toBe(false);
 expect(result.source.sha256).toMatch(/^[a-f0-9]{64}$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect(errors).toEqual([]);
});

test('a timed practice submits at the deadline when its confirmation dialog is open',async({page})=>{
 const start=new Date('2026-11-14T00:00:00Z');await page.clock.setFixedTime(start);
 await page.goto('/fisica/simulazione.html');await page.locator('#start-timed').click();
 await page.locator('input[value=A]').check();await page.locator('#submit-exam').click();
 await page.clock.setFixedTime(new Date(+start+3_000_000));await page.locator('#confirm-submit').dispatchEvent('click');
 await expect(page.locator('#results')).toBeVisible();
 const pending=page.waitForEvent('download');await page.locator('#export-result').click();
 const result=JSON.parse(readFileSync((await (await pending).path())!,'utf8'));
 expect(result.reason).toBe('timeout');expect(result.elapsedSeconds).toBe(3000);
 expect(result.items[0].answer).toBe('A');expect(result.blank).toBe(30);
});

test('edition B uses new questions, accepts the mobile sign control and links exact recovery lessons',async({page})=>{
 const source=JSON.parse(readFileSync('docs/sources/physics-2026-27/editorial/exam-2026-b.json','utf8'));
 await page.goto('/fisica/simulazione.html');
 await page.getByRole('link',{name:'Prova B · nuove domande',exact:true}).click();
 await expect(page.locator('.edition-picker [aria-current=page]')).toHaveText('Prova B · nuove domande');
 await page.locator('#start-practice').click();
 for(const [index,q] of source.questions.entries()){
  if(q.type==='choice')await page.locator(`input[value=${q.correctChoice}]`).check();
  else{
   const answer=q.acceptedAnswers[0];
   if(/^[-−]/.test(answer)){
    const long='0'.repeat(79)+'2';await page.locator('#completion-answer').fill(long);
    await page.getByRole('button',{name:'Cambia segno della risposta numerica',exact:true}).click();
    await expect(page.locator('#completion-answer')).toHaveValue(long);
    await expect(page.locator('#input-help')).toContainText('80 caratteri');
   }
   await page.locator('#completion-answer').fill(answer.replace(/^[-−]/,''));
   if(/^[-−]/.test(answer)){
    await page.getByRole('button',{name:'Cambia segno della risposta numerica',exact:true}).click();
    await expect(page.locator('#completion-answer')).toHaveValue(answer.replace('−','-'));
   }
  }
  if(index<30)await page.locator('#next').click();
 }
 await page.locator('#submit-exam').click();await page.locator('#confirm-submit').click();
 const pending=page.waitForEvent('download');await page.locator('#export-result').click();
 const result=JSON.parse(readFileSync((await (await pending).path())!,'utf8'));
 expect(result.score).toBe(31);expect(result.examId).toBe(source.id);expect(result.items.every((item:{id:string})=>item.id.startsWith('physics-2026-original-b-'))).toBe(true);
 const first=page.locator('.review-item').first();await first.locator('summary').first().click();
 await expect(first.locator('a')).toHaveAttribute('href',`./${source.questions[0].unitId}.html`);
 await first.locator('a').click();await expect(page.locator('#teoria')).toBeVisible();
});

test('the downloaded ZIP contains complete lessons and starts its interactive experiences offline',async({page,browser})=>{
 await page.goto('/fisica/simulazione.html');
 const pending=page.waitForEvent('download');await page.locator('a[download]').click();
 const bytes=readFileSync((await (await pending).path())!);
 const archive=unzipSync(bytes),folder=mkdtempSync(resolve(tmpdir(),'ardesia-physics-offline-'));
 const context=await browser.newContext({offline:true,viewport:{width:390,height:844}});
 try{
  expect(Object.keys(archive).filter(name=>/^sf-2026-u.+\.html$/.test(name))).toHaveLength(38);
  for(const [name,content] of Object.entries(archive)){
   const target=resolve(folder,name);expect(target.startsWith(folder+sep)).toBe(true);
   mkdirSync(dirname(target),{recursive:true});writeFileSync(target,content);
   if(name.endsWith('.html'))expect(Buffer.from(content).toString()).not.toMatch(/(?:href|src)=["']\//);
  }
  const broken=await page.evaluate(({files,pages})=>{
   const parsed=new Map(Object.entries(pages).map(([name,text])=>[name,new DOMParser().parseFromString(text,'text/html')]));
   const errors:string[]=[];
   for(const [name,document] of parsed)for(const element of document.querySelectorAll('[href],[src]')){
    const value=element.getAttribute('href')??element.getAttribute('src')!;
    const url=new URL(value,'https://offline.invalid/'+name);
    if(url.origin!=='https://offline.invalid')continue;
    const target=decodeURIComponent(url.pathname.slice(1));
    if(!files.includes(target))errors.push(name+' → '+value);
    else if(url.hash&&parsed.has(target)&&!parsed.get(target)!.getElementById(decodeURIComponent(url.hash.slice(1))))errors.push(name+' → '+value);
   }
   return errors;
  },{files:Object.keys(archive),pages:Object.fromEntries(Object.entries(archive).filter(([name])=>name.endsWith('.html')).map(([name,bytes])=>[name,Buffer.from(bytes).toString()]))});
  expect(broken).toEqual([]);
  const offlinePage=await context.newPage();const errors:string[]=[];offlinePage.on('pageerror',e=>errors.push(e.message));
  await offlinePage.goto(pathToFileURL(resolve(folder,'simulazione.html')).href);
  await offlinePage.locator('#start-practice').click();await expect(offlinePage.locator('#question-title')).toBeVisible();
  await offlinePage.goto(pathToFileURL(resolve(folder,'campo.html')).href);
  await expect(offlinePage.locator('input[type=range]').first()).toBeEnabled();
  await expect(offlinePage.locator('#field-strength')).toContainText('28,086');
  await offlinePage.locator('#charge').fill('2');await offlinePage.locator('#charge').dispatchEvent('input');
  await expect(offlinePage.locator('#field-strength')).toContainText('56,172');
  await offlinePage.goto(pathToFileURL(resolve(folder,'sf-2026-u1-01.html')).href);
  await expect(offlinePage.locator('#teoria')).toBeVisible();
  await expect(offlinePage.getByText('Per salvare il lavoro nello spazio Ardesia',{exact:false})).toBeVisible();
  expect(errors).toEqual([]);
 }finally{await context.close();rmSync(folder,{recursive:true,force:true});}
});
