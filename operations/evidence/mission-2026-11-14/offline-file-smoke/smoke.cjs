const {createRequire}=require('node:module');
const {readFileSync,writeFileSync}=require('node:fs');
const {pathToFileURL}=require('node:url');
const {join}=require('node:path');
const assert=require('node:assert/strict');
const requireRepo=createRequire('/workspace/scratch/712dbd53ffc0/ardesia-next/package.json');
const {chromium,expect}=requireRepo('@playwright/test');
const root='/workspace/scratch/712dbd53ffc0/offline-file-smoke-20261114';
const archive=JSON.parse(readFileSync(join(root,'archive.json'),'utf8'));
const report={kind:'ardesia-offline-file-scheme-smoke',startedAt:new Date().toISOString(),archive,environment:{platform:process.platform,node:process.version,browser:'Chromium pinned',executable:chromium.executablePath(),viewport:{width:1440,height:1000},scheme:'file:',httpServer:false,networkEnabled:false},checks:[],errors:[],resourceFailures:[],consoleErrors:[],networkAttempts:[],initialRun:{report:'report-initial.json',failure:'Harness attempted a lesson link in a closed details section; repeat opens the observed Notazione scientifica summary through UI.'},limits:['Desktop Chromium on Linux only; no Safari, physical iPad/Pencil or mobile hardware.','No application login, cloud persistence, synchronization or full Ardesia workspace tested.','Practice mode only; timer expiry, all questions and scientific correctness are not qualified.','Attempt recovery is explicit local file export/import, not automatic save.'],passed:false};
let browser;
const file=name=>pathToFileURL(join(archive.extracted,name)).href;
async function context(){
 const ctx=await browser.newContext({viewport:report.environment.viewport,acceptDownloads:true,offline:true,serviceWorkers:'block'});
 await ctx.route('**/*',async route=>{const url=route.request().url();if(/^https?:/.test(url)){report.networkAttempts.push(url);await route.abort('internetdisconnected');}else await route.continue();});
 ctx.on('page',page=>{page.on('pageerror',error=>report.errors.push({url:page.url(),message:error.message}));page.on('console',msg=>{if(msg.type()==='error')report.consoleErrors.push({url:page.url(),text:msg.text()});});page.on('requestfailed',req=>{report.resourceFailures.push({url:req.url(),error:req.failure()});if(/^https?:/.test(req.url()))report.networkAttempts.push(req.url());});});
 return ctx;
}
async function check(name,fn){try{const detail=await fn();report.checks.push({name,passed:true,...detail});console.log(name+': PASS');}catch(e){report.checks.push({name,passed:false,error:e.message});console.log(name+': FAIL '+e.message.slice(0,200));}}
(async()=>{
 browser=await chromium.launch({headless:true});report.environment.version=browser.version();
 const first=await context(),page=await first.newPage();page.setDefaultTimeout(7000);
 await check('index_to_course_to_lesson',async()=>{
  await page.goto(file('index.html'));await expect(page.locator('h1')).toBeVisible();
  assert.equal(await page.locator('#percorsi article').count(),5);
  await page.screenshot({path:join(root,'01-index.png')});
  await page.locator('#percorsi article').first().getByRole('link').click();
  assert.ok(page.url().endsWith('/c1.html'));
  const course=await page.locator('h1').innerText();
  const lessons=page.locator('a[href*="sf-2026-"]');const links=await lessons.count();assert.ok(links>=9);
  await page.locator('summary').filter({hasText:/^Notazione scientifica$/}).click();await lessons.first().click();await expect(page.locator('h1')).toBeVisible();
  const lesson=await page.locator('h1').innerText(),length=(await page.locator('main').innerText()).length;assert.ok(length>1000);
  await page.screenshot({path:join(root,'02-lesson.png')});
  return {course,lesson,lessonLinkCount:links,lessonTextCharacters:length,url:page.url()};
 });
 let selected,downloadPath=join(root,'saved-attempt.json'),savedQuestion;
 await check('practice_answer_and_real_json_download',async()=>{
  await page.goto(file('index.html'));await page.getByRole('link',{name:'Scegli una prova →',exact:true}).click();
  await expect(page.locator('#start-practice')).toBeEnabled();await page.locator('#start-practice').click();
  await expect(page.locator('#active-exam')).toBeVisible();
  savedQuestion=await page.locator('#question-title').innerText();
  const answer=page.locator('#answer-area input[type=radio]').first();selected=await answer.inputValue();await answer.check();
  await page.locator('#flag-question').click();await page.locator('#next').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#save-attempt').click();const download=await downloadPromise;
  await download.saveAs(downloadPath);assert.equal(await download.failure(),null);
  const saved=JSON.parse(readFileSync(downloadPath,'utf8'));assert.ok(JSON.stringify(saved).includes(selected));
  await page.screenshot({path:join(root,'03-saved-attempt.png')});
  report.savedAttempt=saved;
  return {downloadName:download.suggestedFilename(),downloadPath,bytes:Buffer.byteLength(JSON.stringify(saved)),savedQuestion,selected,answeredCount:await page.locator('#answered-count').innerText(),dataKeys:Object.keys(saved)};
 });
 await first.close();
 await check('new_context_reimports_same_edition',async()=>{
  const fresh=await context();const p=await fresh.newPage();p.setDefaultTimeout(7000);await p.goto(file('simulazione.html'));
  await expect(p.locator('#intro')).toBeVisible();await expect(p.locator('#active-exam')).toBeHidden();
  const storage=await fresh.storageState();assert.equal(storage.cookies.length,0);assert.equal(storage.origins.length,0);
  await p.locator('#resume-file').setInputFiles(downloadPath);await expect(p.locator('#active-exam')).toBeVisible();
  const restoredPosition=await p.locator('#question-title').innerText();await p.locator('#question-nav button').first().click();
  assert.equal(await p.locator('#question-title').innerText(),savedQuestion);
  const checked=p.locator('#answer-area input[type=radio]:checked');assert.equal(await checked.inputValue(),selected);
  await expect(p.locator('#flag-question')).toHaveAttribute('aria-pressed','true');
  const answerCount=await p.locator('#answered-count').innerText();await p.screenshot({path:join(root,'04-restored-attempt.png')});
  await p.locator('#submit-exam').click();await p.locator('#confirm-submit').click();await expect(p.locator('#results')).toBeVisible();
  const result={freshCookies:storage.cookies.length,freshStorageOrigins:storage.origins.length,restoredPosition,restoredQuestion:savedQuestion,restoredAnswer:selected,flagRestored:true,answerCount,resultScore:await p.locator('#result-score').innerText(),reviewDetailsCount:await p.locator('#review-list details').count()};
  await fresh.close();return result;
 });
 await check('thermodynamics_lab_prediction_and_parameter_change',async()=>{
  const labContext=await context();const p=await labContext.newPage();p.setDefaultTimeout(7000);
  await p.goto(file('index.html'));await p.getByRole('link',{name:'Apri il laboratorio C3 →',exact:true}).click();
  await expect(p.locator('#controls')).toBeEnabled();await expect(p.locator('#prediction-controls')).toBeEnabled();
  const initialState=await p.locator('#final-state').innerText();
  await p.locator('#energy').selectOption('same');await p.locator('#work').selectOption('b');await p.getByRole('button',{name:'Confronta la previsione',exact:true}).click();
  await expect(p.locator('#results')).toBeVisible();
  const balances={qa:await p.locator('[data-value=qa]').innerText(),qb:await p.locator('[data-value=qb]').innerText(),du:await p.locator('[data-value=du]').first().innerText(),feedback:await p.locator('#energy-feedback').innerText()};
  await p.screenshot({path:join(root,'05-lab-feedback.png')});
  await p.getByRole('button',{name:'Compressione',exact:true}).click();await expect(p.locator('#results')).toBeHidden();
  const changedState=await p.locator('#final-state').innerText();assert.notEqual(initialState,changedState);
  assert.equal(await p.locator('#volume').inputValue(),'0.5');assert.equal(await p.locator('#pressure').inputValue(),'2');
  await p.locator('#transfer-answer').selectOption('negative');await p.getByRole('button',{name:'Verifica il ragionamento',exact:true}).click();await expect(p.locator('#transfer-feedback')).toBeVisible();
  const transferFeedback=await p.locator('#transfer-feedback').innerText();await labContext.close();
  return {initialState,balances,changedState,previousFeedbackCleared:true,transferFeedback};
 });
 report.passed=report.checks.length===4&&report.checks.every(c=>c.passed)&&report.errors.length===0&&report.networkAttempts.length===0&&report.resourceFailures.length===0&&report.consoleErrors.length===0;
})().catch(error=>{report.fatalError=error.message;}).finally(async()=>{
 if(browser)await browser.close();report.completedAt=new Date().toISOString();writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({report:join(root,'report.json'),passed:report.passed,checks:report.checks.map(c=>({name:c.name,passed:c.passed})),errors:report.errors,networkAttempts:report.networkAttempts}));process.exitCode=report.passed?0:1;
});
