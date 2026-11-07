import {randomUUID} from 'node:crypto';
import type {Browser,Page,TestInfo} from '@playwright/test';
import type {WorkspaceProjection} from '@ardesia/remote-client';
import {test,expect,api,rawApi,apiOrigin,selectWorkspace,selectedWorkspace,personalProjection,type TestAccount} from './fixtures';
import {personalBrowserCredentials} from '../tools/e2e-accounts.mjs';
import {resolveE2ETarget} from './target';
import {addMarketplaceSpring,storedSpring} from './marketplace-helpers';

async function personal(browser:Browser,reference:Page,info:TestInfo,route='/'){
  const mobile=info.project.name==='mobile-chromium';
  const context=await browser.newContext({baseURL:apiOrigin,viewport:reference.viewportSize(),isMobile:mobile,hasTouch:mobile,storageState:{cookies:[],origins:[]}});
  const {account}=await api<{account:TestAccount}>(context.request,{action:'login',...personalBrowserCredentials(process.env,resolveE2ETarget().mode,info.project.name)});
  const projection=await api<WorkspaceProjection>(context.request,{action:'create-workspace',commandId:randomUUID(),title:'Idee personali '+randomUUID().slice(0,8)},account.id);
  await selectWorkspace(context,{account,actor:projection.actor,workspaceId:projection.workspaceId,documentId:''});
  const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(route);
  await expect(page.getByRole('heading',{name:'Uno spazio per le tue idee.'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('personal-home.png'),fullPage:true});
  await page.getByLabel('Titolo prima lezione',{exact:true}).fill('Una mia domanda sul mondo');
  await page.getByRole('button',{name:'Crea lezione nel mio account',exact:true}).click();
  await expect(page.locator('.board-surface')).toBeVisible();
  const saved=await personalProjection(page);
  await selectWorkspace(context,{account,actor:saved.actor,workspaceId:saved.workspaceId,documentId:saved.documents[0]!.id});
  expect(saved).toMatchObject({access:'owner',actor:{actorId:account.id,role:'student'}});
  await expect(page.getByRole('button',{name:'Assegna',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Apri studio tutor',exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
  return {context,page,account};
}

test('a learner following a tutor deep link into an empty owned space can create a lesson without a crash',async({page:teacher,browser},info)=>{
  const f=await personal(browser,teacher,info,'/#tutor');
  try{expect((await personalProjection(f.page)).documents).toHaveLength(1);}finally{await f.context.close();}
});

test('a learner creates an original type and a personal course, reopens both and keeps the real account role',async({page:teacher,browser},info)=>{
  test.setTimeout(90_000);const f=await personal(browser,teacher,info),page=f.page;
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.getByRole('button',{name:'Crea un oggetto',exact:true}).click();
    const creator=page.getByRole('dialog',{name:'Crea un oggetto',exact:true});
    await creator.getByRole('button',{name:'Parti da zero',exact:true}).click();
    await creator.getByLabel('Nome del tipo',{exact:true}).fill('Il mio misuratore di curiosità');
    await creator.getByRole('button',{name:'Aggiungi elemento',exact:true}).click();
    await creator.locator('.creator-palette').getByRole('button',{name:'Controllo',exact:true}).click();
    await creator.getByLabel('Variabile controllo',{exact:true}).fill('curiosity');
    await creator.getByLabel('Etichetta controllo',{exact:true}).fill('Domande');
    await creator.getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();
    await expect(creator).toHaveCount(0);
    const invented=(await personalProjection(page)).documents[0]!.objects.find(object=>object.type==='extension')!;
    expect(invented.provenance.createdBy).toBe(f.account.id);
    await page.getByRole('button',{name:'Apri corsi',exact:true}).click();
    await page.getByRole('button',{name:'Parti da una molla',exact:true}).click();
    await page.getByLabel('Titolo del corso',{exact:true}).fill('Le mie domande sulla molla');
    await page.getByRole('button',{name:'Salva corso',exact:true}).click();
    await expect(page.getByText('Bozza salvata · r1',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Fissa un’edizione',exact:true}).click();
    await expect(page.getByRole('button',{name:'Assegna edizione',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'Inizia il mio percorso',exact:true}).click();
    await page.getByLabel('Il tuo ragionamento',{exact:true}).fill('Una previsione soltanto mia.');
    await page.getByRole('button',{name:'Salva risposta',exact:true}).click();
    await expect(page.getByLabel('Il tuo ragionamento',{exact:true})).toHaveValue('');
    await page.reload();await page.getByRole('button',{name:'Riprendi',exact:true}).click();
    await expect(page.locator('.course-attempts')).toContainText('Una previsione soltanto mia.');
    const saved=await personalProjection(page);expect(saved.courseSpace!.courses[0]!.ownerId).toBe(f.account.id);
    expect(saved.documents[0]!.objects.find(object=>object.id===invented.id)).toEqual(invented);
    const teacherAccount=selectedWorkspace(teacher).account;
    expect((await rawApi(teacher.context().request,{action:'open-workspace',workspaceId:saved.workspaceId},teacherAccount.id)).status).toBe(404);
    const session=await api<{account:{role:string}}>(f.context.request,{action:'session'},f.account.id);expect(session.account.role).toBe('student');
    expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await f.context.close();}
});

test('a learner owns a consented scientific module and reopens its saved laboratory',async({page:teacher,browser},info)=>{
  test.setTimeout(60_000);const f=await personal(browser,teacher,info),page=f.page;
  try{
    await addMarketplaceSpring(page);
    const panel=page.getByRole('complementary',{name:'Proprietà del laboratorio',exact:true});
    await panel.getByLabel('Massa (kg)',{exact:true}).fill('4');
    await panel.getByRole('button',{name:'Salva laboratorio',exact:true}).click();
    await expect.poll(async()=>(await storedSpring(page)).revision).toBe(2);
    const saved=await storedSpring(page);await page.reload();
    await page.getByRole('button',{name:'Taccuino',exact:true}).click();
    await page.getByRole('button',{name:'Modifica Molla ideale',exact:true}).click();
    await expect(page.getByRole('complementary',{name:'Proprietà del laboratorio',exact:true})).toHaveAttribute('data-plugin-status','ready');
    expect(await storedSpring(page)).toEqual(saved);
  }finally{await f.context.close();}
});

test('a learner retains private offline ink across cold reopen and explicitly confirms it after reconnect',async({page:teacher,browser},info)=>{
  test.setTimeout(90_000);const f=await personal(browser,teacher,info);let page=f.page;
  try{
    const original=await personalProjection(page);
    await page.getByRole('button',{name:'Impostazioni',exact:true}).click();
    await page.getByRole('button',{name:'Rendi disponibile offline',exact:true}).click();
    await expect(page.getByRole('button',{name:'Usa copia offline',exact:true})).toBeVisible();
    await f.context.setOffline(true);await page.getByRole('button',{name:'Usa copia offline',exact:true}).click();
    await expect(page.getByText('Il tuo spazio offline',{exact:true})).toBeVisible();
    const bounds=(await page.locator('.board-surface').boundingBox())!;
    await page.mouse.move(bounds.x+bounds.width*.2,bounds.y+bounds.height*.4);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.6,{steps:10});await page.mouse.up();
    await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(1);
    const pending=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('ardesia-next.pending.v1.')&&key.includes('/')).map(key=>localStorage.getItem(key)));
    const reopened=await f.context.newPage();await page.close();page=reopened;await page.goto('/');
    await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(1);
    expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('ardesia-next.pending.v1.')&&key.includes('/')).map(key=>localStorage.getItem(key)))).toEqual(pending);
    await f.context.setOffline(false);expect((await personalProjection(page)).documents).toEqual(original.documents);
    await page.getByRole('button',{name:'Ricollegati al server',exact:true}).click();
    await page.getByRole('button',{name:'Riprendi modifica non inviata',exact:true}).click();
    await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(0);
    const saved=await personalProjection(page);expect(saved.documents[0]!.revision).toBe(original.documents[0]!.revision+1);expect(saved.actor.role).toBe('student');
  }finally{await f.context.setOffline(false);await f.context.close();}
});

test('a learner moves between owned and assigned spaces without mixing tools or private content',async({page:teacher,browser},info)=>{
  const f=await personal(browser,teacher,info),page=f.page;
  try{
    const own=await personalProjection(page),shared=selectedWorkspace(teacher),sharedTitle=(await personalProjection(teacher)).title;
    await api(teacher.context().request,{action:'learning-command',workspaceId:shared.workspaceId,command:{kind:'assign-lesson',commandId:randomUUID(),documentId:shared.documentId,studentId:f.account.id,expectedRevision:0}},shared.account.id);
    await page.getByRole('button',{name:'Account e spazi',exact:true}).click();
    const assigned=page.getByRole('region',{name:'Condivisi con te',exact:true});
    await assigned.getByRole('button').filter({hasText:sharedTitle}).click();
    await expect(page.getByRole('heading',{name:'Il mio lavoro',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Crea un oggetto',exact:true})).toHaveCount(0);
    await page.getByLabel('Note personali',{exact:true}).fill('Una nota privata nel percorso assegnato.');
    await page.getByRole('button',{name:'Salva note personali',exact:true}).click();
    await expect(page.getByRole('button',{name:'Salva note personali',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Account e spazi',exact:true}).click();
    await page.getByRole('region',{name:'I tuoi progetti',exact:true}).getByRole('button',{name:new RegExp(own.title)}).click();
    await expect(page.locator('.board-surface')).toBeVisible();
    await expect(page.getByRole('button',{name:'Crea un oggetto',exact:true})).toBeVisible();
    expect((await personalProjection(page)).documents).toEqual(own.documents);
    expect((await personalProjection(teacher)).learnerWork).toEqual([]);
    await page.reload();await expect(page.locator('.board-surface')).toBeVisible();
  }finally{await f.context.close();}
});
