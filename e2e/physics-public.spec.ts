import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
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

test('static experiences start from file URLs without a network',async({browser})=>{
 const context=await browser.newContext({offline:true,viewport:{width:390,height:844}});
 try{
  const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(resolve('apps/web/dist/fisica/simulazione.html')).href);
  await page.locator('#start-practice').click();await expect(page.locator('#question-title')).toBeVisible();
  await page.goto(pathToFileURL(resolve('apps/web/dist/fisica/campo.html')).href);
  await expect(page.locator('input[type=range]').first()).toBeEnabled();
  await expect(page.locator('#field-strength')).toContainText('28,086');
  await page.locator('#charge').fill('2');await page.locator('#charge').dispatchEvent('input');
  await expect(page.locator('#field-strength')).toContainText('56,172');
  expect(errors).toEqual([]);
 }finally{await context.close();}
});
