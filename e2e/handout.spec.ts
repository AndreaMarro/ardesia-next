import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test,expect,api,apiOrigin,personalProjection,selectedWorkspace,loginContext,selectWorkspace} from './fixtures';
import {addMarketplaceSpring} from './marketplace-helpers';
import {installContextAccess} from './remote-access';
import {toObjectInput,type LessonDocument} from '@ardesia/contracts';
import type {WorkspaceProjection} from '@ardesia/remote-client';
import type {Page} from '@playwright/test';

async function edit(page:Page,command:Record<string,unknown>){
  const selected=selectedWorkspace(page),projection=await personalProjection(page),document=projection.documents.find(d=>d.id===selected.documentId)!;
  return api(page.context().request,{action:'command',workspaceId:selected.workspaceId,command:{...command,documentId:document.id,commandId:randomUUID(),expectedRevision:document.revision}},selected.account.id);
}
async function saved(page:Page):Promise<LessonDocument>{return (await personalProjection(page)).documents.find(d=>d.id===selectedWorkspace(page).documentId)!;}

test('handout exports a frozen saved lesson, exact sources, static lab and pressure ink without mutating drafts',async({page},info)=>{
  test.setTimeout(70000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(m.text());});
  await addMarketplaceSpring(page);
  const initial=await saved(page),source=initial.objects.find(o=>o.type==='source')!;
  await edit(page,{kind:'replace-object',object:{...toObjectInput(source),data:{...source.data,publisher:'EDITORE NUOVO',sourceRevision:'Edizione 2'}}});
  const inkId=randomUUID();
  await edit(page,{kind:'add-object',object:{id:inkId,type:'ink',title:'Un tratto con pressione',x:-90000,y:280,width:220,height:70,data:{color:'#294435',width:6,points:[{x:0,y:5,pressure:.1},{x:80,y:45,pressure:.8},{x:220,y:10,pressure:.3}]}}});
  await edit(page,{kind:'add-object',object:{id:randomUUID(),type:'note',title:'Passaggi della spiegazione',x:0,y:400,width:300,height:300,data:{text:Array.from({length:45},(_,i)=>`Passaggio ${i+1}. A piccoli angoli e in gravità costante il periodo dipende dalla radice della lunghezza. Confronta ipotesi e osservazioni.`).join('\n')+'\nFINE DELLA SPIEGAZIONE'}}});
  await edit(page,{kind:'add-object',object:{id:randomUUID(),type:'formula',title:'Sorgente da conservare',x:0,y:450,width:300,height:200,data:{latex:'\\input{segreto}',description:'Non eseguire istruzioni nel documento.'}}});
  await edit(page,{kind:'add-object',object:{id:randomUUID(),type:'formula',title:'Formula estesa',x:0,y:500,width:300,height:200,data:{latex:'x+'.repeat(150)+'\\text{FINE FORMULA}',description:'La formula completa deve rientrare nella pagina.'}}});
  await page.reload();await page.getByRole('button',{name:'Taccuino',exact:true}).click();await page.getByRole('button',{name:'Modifica Il pendolo semplice',exact:true}).click();
  // An open unsaved editor survives the derived export.
  const field=page.getByLabel('Descrizione formula', {exact:true});await field.fill('BOZZA PRIVATA NON SALVATA');
  const before=await saved(page);let newWorkers=0;page.on('worker',()=>newWorkers++);
  await page.getByRole('button',{name:'Dispensa della lezione',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Dispensa della lezione'}),paper=page.getByRole('article',{name:'Dispensa pronta'});
  await expect(paper).toHaveAttribute('data-revision',String(before.revision));
  await expect(paper).toContainText('FINE DELLA SPIEGAZIONE');await expect(paper).not.toContainText('BOZZA PRIVATA NON SALVATA');
  await expect(paper.locator('.handout-citation')).toContainText('OpenStax · University Physics');
  await expect(paper.locator('.handout-citation')).not.toContainText('EDITORE NUOVO');
  await expect(paper.locator('.handout-lab')).toContainText('massKg');await expect(paper.locator('.lab-content')).toHaveCount(0);
  await expect(paper.locator(`[data-handout-object="${inkId}"] svg path`)).toHaveAttribute('fill','#294435');
  const downloaded=page.waitForEvent('download');await dialog.getByRole('button',{name:'Scarica LaTeX',exact:true}).click();
  const download=await downloaded;await download.saveAs(info.outputPath('lesson.tex'));const tex=await readFile(info.outputPath('lesson.tex'),'utf8');
  expect(tex).toContain('\\begin{tikzpicture}');expect(tex).not.toContain('\\input{');expect(tex).not.toContain('BOZZA PRIVATA');expect(tex).toContain('OpenStax');expect(tex.replaceAll('\\allowbreak{}','')).toContain('massKg');
  await page.evaluate(()=>{window.print=()=>{document.body.dataset.printRequested='true';};});
  await dialog.getByRole('button',{name:'Stampa / PDF',exact:true}).click();await expect(page.locator('body')).toHaveAttribute('data-print-requested','true');
  await expect(page).toHaveTitle(/Ardesia/);await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await paper.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  expect(await paper.locator('.handout-math').evaluateAll(nodes=>nodes.every(node=>{const math=node.querySelector('.katex-display > .katex');return !math||math.getBoundingClientRect().width<=node.clientWidth+1;}))).toBe(true);
  await page.screenshot({path:info.outputPath('handout.png'),fullPage:false});
  await page.emulateMedia({media:'print'});
  await expect.poll(()=>paper.evaluate(el=>Math.round(el.getBoundingClientRect().width))).toBe(658);
  await expect.poll(()=>paper.locator('.handout-math').evaluateAll(nodes=>nodes.every(node=>{const math=node.querySelector('.katex-display > .katex');return !math||math.getBoundingClientRect().width<=node.clientWidth+1;}))).toBe(true);
  const inkSection=paper.locator(`[data-handout-object="${inkId}"]`);
  expect(await inkSection.evaluate(el=>el.getBoundingClientRect().bottom<=el.nextElementSibling!.getBoundingClientRect().top+1)).toBe(true);
  await page.pdf({path:info.outputPath('handout.pdf'),printBackground:true,preferCSSPageSize:true});
  await page.emulateMedia({media:'screen'});
  await dialog.getByRole('button',{name:'Chiudi finestra',exact:true}).click();await expect(field).toHaveValue('BOZZA PRIVATA NON SALVATA');
  expect(await saved(page)).toEqual(before);expect(newWorkers).toBe(0);expect(errors).toEqual([]);
});

test('assigned handout excludes personal work and closes after observed assignment revocation',async({page,browser},info)=>{
  const selected=selectedWorkspace(page),student=await browser.newContext({baseURL:apiOrigin,viewport:info.project.use.viewport,isMobile:info.project.use.isMobile,hasTouch:info.project.use.hasTouch,storageState:{cookies:[],origins:[]}});await installContextAccess(student);
  try{
    const account=await loginContext(student,'STUDENT_B',info.project.name);
    await api(page.context().request,{action:'learning-command',workspaceId:selected.workspaceId,command:{kind:'assign-lesson',commandId:randomUUID(),documentId:selected.documentId,studentId:account.id,expectedRevision:0}},selected.account.id);
    await selectWorkspace(student,{...selected,account,actor:{actorId:account.id,role:'student'}});
    const learner=await student.newPage();await learner.goto('/');
    await learner.getByLabel('Note personali',{exact:true}).fill('NOTA PRIVATA DA ESCLUDERE');await learner.getByRole('button',{name:'Salva note personali',exact:true}).click();
    await expect.poll(async()=>{const p=await api<WorkspaceProjection>(student.request,{action:'open-workspace',workspaceId:selected.workspaceId},account.id);return p.learnerWork[0]?.notes;}).toBe('NOTA PRIVATA DA ESCLUDERE');
    await learner.getByRole('button',{name:'Dispensa',exact:true}).click();
    await expect(learner.getByRole('article',{name:'Dispensa pronta'})).not.toContainText('NOTA PRIVATA');
    await api(page.context().request,{action:'learning-command',workspaceId:selected.workspaceId,command:{kind:'revoke-assignment',commandId:randomUUID(),documentId:selected.documentId,studentId:account.id,expectedRevision:1}},selected.account.id);
    await learner.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(learner.getByRole('dialog',{name:'Dispensa della lezione'})).toHaveCount(0);
  }finally{await student.close();}
});

test('offline handout uses the last confirmed copy and leaves pending ink recoverable',async({page,context})=>{
  await page.goto('/');const before=await saved(page);
  await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('button',{name:'Rendi disponibile offline',exact:true}).click();await expect(page.getByRole('button',{name:'Usa copia offline',exact:true})).toBeVisible();
  await context.setOffline(true);await page.getByRole('button',{name:'Usa copia offline',exact:true}).click();
  await expect(page.getByText('Il tuo spazio offline',{exact:true})).toBeVisible();
  const surface=page.locator('.board-surface');await surface.scrollIntoViewIfNeeded();const box=(await surface.boundingBox())!;
  await page.mouse.move(box.x+box.width*.2,box.y+box.height*.6);await page.mouse.down();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.65,{steps:6});await page.mouse.up();
  await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(1);
  await page.reload();await expect(page.getByText('Il tuo spazio offline',{exact:true})).toBeVisible();await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(1);
  await page.getByRole('button',{name:'Dispensa',exact:true}).click();const paper=page.getByRole('article',{name:'Dispensa pronta'});
  await expect(paper).toHaveAttribute('data-revision',String(before.revision));await expect(paper.locator('[data-handout-object]')).toHaveCount(before.objects.length);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Scarica LaTeX',exact:true}).click();expect((await download).suggestedFilename()).toContain(`r${before.revision}.tex`);
  await page.emulateMedia({media:'print'});await page.pdf({path:test.info().outputPath('offline-handout.pdf'),printBackground:true,preferCSSPageSize:true});await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:'Chiudi finestra',exact:true}).click();await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(1);
  await context.setOffline(false);expect(await saved(page)).toEqual(before);
});
