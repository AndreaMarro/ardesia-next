import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test,expect,api,apiOrigin,personalProjection,selectedWorkspace,loginContext,selectWorkspace} from './fixtures';
import {installContextAccess,continueRouteWithAccess,fetchRouteWithAccess,readApiJson} from './remote-access';
import {extensionDefinitionDigest,toObjectInput,type ExtensionDefinition,type ExtensionObject} from '@ardesia/contracts';
import type {Page} from '@playwright/test';

const creator=(page:Page)=>page.getByRole('dialog',{name:/^(Crea un oggetto|Modifica oggetto)$/});
async function openProgram(page:Page){await page.goto('/');await page.getByRole('button',{name:'Crea un oggetto',exact:true}).click();await creator(page).getByRole('button',{name:'Crea un programma',exact:true}).click();await expect(creator(page).getByLabel('Codice del programma')).toBeVisible();return creator(page);}
async function objects(page:Page){return (await personalProjection(page)).documents[0]!.objects.filter((o):o is ExtensionObject=>o.type==='extension');}
async function edit(page:Page,command:Record<string,unknown>){const w=selectedWorkspace(page),doc=(await personalProjection(page)).documents[0]!;return api(page.request,{action:'command',workspaceId:w.workspaceId,command:{...command,commandId:randomUUID(),documentId:doc.id,expectedRevision:doc.revision}},w.account.id);}
async function start(page:Page){await page.getByRole('button',{name:'Avvia questa versione',exact:true}).click();await expect(page.locator('.program-toolbar')).toContainText('In esecuzione');}
async function refresh(page:Page){const button=page.getByRole('button',{name:'Aggiorna',exact:true});if(await button.isVisible())await button.click();else await page.evaluate(()=>window.dispatchEvent(new Event('focus')));}
async function addIdea(page:Page,text:string){await page.getByLabel('La prossima idea',{exact:true}).fill(text);await expect(page.getByLabel('La prossima idea',{exact:true})).toHaveValue(text);await page.getByRole('button',{name:'Aggiungi idea',exact:true}).click();await expect(page.locator('.program-canvas li').filter({hasText:text})).toHaveCount(1);}

test('programmable Creator requires consent, saves real state, reopens and versions source with portable export',async({page},info)=>{
  test.setTimeout(65000);const errors:string[]=[],downloads:string[]=[];let workers=0,closed=0;
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/program-runtime/'))downloads.push(request.url());});
  page.on('worker',worker=>{workers++;worker.on('close',()=>closed++);});
  const dialog=await openProgram(page),code=dialog.getByLabel('Codice del programma');const initial=await code.inputValue();
  await code.fill('');await expect(code).toBeVisible();await code.fill(initial);
  expect(downloads).toEqual([]);expect(workers).toBe(0);
  await dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();await expect(dialog).toHaveCount(0);
  const first=(await objects(page))[0]!;expect(first.data.definition.renderer).toBe('ardesia.program/1');expect(workers).toBe(0);
  await start(page);expect(downloads.some(url=>url.endsWith('.wasm'))).toBe(true);await addIdea(page,'Una struttura inventata');
  await expect(page.locator('.program-canvas svg circle')).toHaveCount(1);await page.screenshot({path:info.outputPath('program-running.png')});
  await page.getByRole('button',{name:'Salva modifiche',exact:true}).click();await expect.poll(()=>closed).toBe(1);
  expect((await objects(page))[0]!.data.state.ideas).toEqual([{id:1,text:'Una struttura inventata'}]);
  await page.reload();expect(workers).toBe(1);await page.getByRole('button',{name:'Oggetti',exact:true}).click();await page.getByRole('button',{name:'Seleziona Il mio atelier',exact:true}).click();
  await page.getByRole('button',{name:'Modifica struttura',exact:true}).click();await creator(page).getByLabel('Codice del programma').fill(initial.replace('Dai forma a un’idea','Collega i tuoi pensieri'));
  await creator(page).getByRole('button',{name:'Salva nuova versione',exact:true}).click();await expect(creator(page)).toHaveCount(0);
  const second=(await objects(page))[0]!;expect(second.data.definition.version).toBe(2);expect(second.data.definitionDigest).not.toBe(first.data.definitionDigest);expect(second.data.state).toEqual({draft:'',ideas:[{id:1,text:'Una struttura inventata'}],next:2});expect(workers).toBe(1);
  await page.getByRole('button',{name:'Modifica struttura',exact:true}).click();const pending=page.waitForEvent('download');await creator(page).getByRole('button',{name:'Esporta definizione',exact:true}).click();await (await pending).saveAs(info.outputPath('program.ardesia.json'));
  const exported=JSON.parse(await readFile(info.outputPath('program.ardesia.json'),'utf8'));expect(exported.definition).toEqual(second.data.definition);expect(exported.state).toEqual(second.data.state);expect(exported.lineage).toHaveLength(2);expect(errors).toEqual([]);
});

test('hostile programs stop without freezing chrome, leaking authority or replacing the last valid draft',async({page},info)=>{
  test.setTimeout(65000);const errors:string[]=[],external:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(apiOrigin))external.push(r.url());});
  const dialog=await openProgram(page),code=dialog.getByLabel('Codice del programma');const initial=await code.inputValue();
  for(const source of [
    'function update(){while(true){}}',
    'function update(){function recurse(){recurse()}recurse()}',
    'function update(){const huge=[];while(true)huge.push(new Array(100000).fill(123));}',
    'function update(){return {state:{},view:{tag:["div"]}}}',
    'function update(){return {state:{},view:{tag:"div",events:{input:"edit"},children:[{tag:"input",attrs:{type:"text"}}]}}}',
    'function update(){return {state:{},view:{tag:"div",style:{fontSize:"9999em"}}}}',
    'function update({state}){let view={tag:"span",children:["Troppo profondo"]};for(let i=0;i<8;i++)view={tag:"h1",children:[view]};return {state,view:{tag:"span",style:{fontSize:128},children:[view]}}}',
    'function update(){return {state:{},view:{tag:"svg",attrs:{viewBox:"0 0 1e-300 1"}}}}',
    'function update(){return {state:{},view:{tag:"svg",children:[{tag:"path",attrs:{d:"M0 0 L10000 0",strokeDasharray:"1e-300 1e-300"}}]}}}',
    'function update(){return {state:{},view:{tag:"div",style:{backgroundImage:"url(https://example.invalid/leak)"}}}}',
  ]){
    await code.fill(source);await dialog.getByRole('button',{name:'Avvia questa versione',exact:true}).click();
    await expect(dialog.getByRole('button',{name:'Riavvia questa versione',exact:true})).toBeVisible();
    await expect(code).toBeEditable();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
  await code.fill('function update({state}){let view={tag:"span",children:["Caratteri contenuti"]};for(let i=0;i<6;i++)view={tag:"h1",children:[view]};return {state,view:{tag:"span",style:{fontSize:128},children:[view]}}}');await start(page);
  await expect(dialog.locator('.program-canvas h1')).toHaveCount(6);
  expect(await dialog.locator('.program-canvas h1').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).fontSize)<=128))).toBe(true);
  await code.fill('function update({state}){return {state,view:{tag:"p",children:[[typeof fetch,typeof document,typeof indexedDB,typeof Worker,typeof postMessage].join(" / ")]}}}');await start(page);
  await expect(dialog.locator('.program-canvas')).toContainText('undefined / undefined / undefined / undefined / undefined');
  await code.fill(initial);await expect(dialog.getByRole('button',{name:'Avvia questa versione',exact:true})).toBeVisible();await start(page);await addIdea(page,'Ripresa dopo gli errori');
  await dialog.getByRole('button',{name:'Interrompi programma',exact:true}).click();await expect(dialog.getByRole('button',{name:'Riavvia questa versione',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath('program-recovered.png')});expect(errors).toEqual([]);expect(external).toEqual([]);
});

test('program save recovers its original acknowledgement and concurrent edits stop execution without rebasing the draft',async({page})=>{
  const dialog=await openProgram(page);await start(page);await addIdea(page,'Conserva questo stato');
  let first=true;const ids:string[]=[];await page.route('**/api/m3',async route=>{
    const input=route.request().method()==='POST'?route.request().postDataJSON():null;
    if(input?.action!=='command'||input.command.kind!=='add-object'||input.command.object.type!=='extension'){await continueRouteWithAccess(route);return;}
    ids.push(input.command.commandId);const response=await fetchRouteWithAccess(route),body=await readApiJson(response);expect(body.ok).toBe(true);
    if(first){first=false;await route.abort('connectionfailed');}else await route.fulfill({response});
  });
  await dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Salvataggio non confermato');
  await dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();expect(ids).toHaveLength(1);
  await dialog.getByRole('button',{name:'Chiudi finestra',exact:true}).click();await page.getByRole('button',{name:'Scarta modifiche',exact:true}).click();await page.getByRole('button',{name:'Verifica e ritenta',exact:true}).click();
  await expect(page.getByRole('region',{name:'Modifiche da recuperare',exact:true})).toHaveCount(0);expect(ids).toEqual([ids[0],ids[0]]);expect(await objects(page)).toHaveLength(1);
  await page.getByRole('button',{name:'Oggetti',exact:true}).click();await page.getByRole('button',{name:'Seleziona Il mio atelier',exact:true}).click();await start(page);await addIdea(page,'Bozza aperta');
  const saved=(await objects(page))[0]!;await edit(page,{kind:'replace-object',object:{...toObjectInput(saved),title:'Modifica concorrente'}});
  await refresh(page);await expect(page.locator('.inspector [role="alert"]')).toContainText('cambiato');
  await expect(page.getByRole('button',{name:'Interrompi programma',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Salva modifiche',exact:true})).toBeDisabled();
  expect((await objects(page))[0]!.data.state.ideas).toEqual([{id:1,text:'Conserva questo stato'}]);
});

test('assigned programs need separate execution consent, keep experiments private and stop on observed revocation',async({page,browser},info)=>{
  const dialog=await openProgram(page);await dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();await expect(dialog).toHaveCount(0);
  const selected=selectedWorkspace(page),context=await browser.newContext({baseURL:apiOrigin,storageState:{cookies:[],origins:[]},serviceWorkers:'block'});await installContextAccess(context);
  try{
    const account=await loginContext(context,'STUDENT_A',info.project.name);
    await api(page.request,{action:'learning-command',workspaceId:selected.workspaceId,command:{kind:'assign-lesson',commandId:randomUUID(),documentId:selected.documentId,studentId:account.id,expectedRevision:0}},selected.account.id);
    await selectWorkspace(context,{...selected,account,actor:{actorId:account.id,role:'student'}});const student=await context.newPage();let workers=0,closed=0;student.on('worker',w=>{workers++;w.on('close',()=>closed++);});await student.goto('/');
    await expect(student.getByRole('button',{name:'Avvia questa versione',exact:true})).toBeVisible();expect(workers).toBe(0);await start(student);await addIdea(student,'Esperimento privato');
    expect((await objects(page))[0]!.data.state.ideas).toEqual([]);expect((await personalProjection(page)).learnerWork).toEqual([]);
    await api(page.request,{action:'learning-command',workspaceId:selected.workspaceId,command:{kind:'revoke-assignment',commandId:randomUUID(),documentId:selected.documentId,studentId:account.id,expectedRevision:1}},selected.account.id);
    await refresh(student);await expect(student.locator('.program-surface')).toHaveCount(0);await expect.poll(()=>closed).toBe(1);
    expect((await objects(page))[0]!.data.state.ideas).toEqual([]);
  }finally{await context.close();}
});

test('execution consent and experimental state stay within their exact lesson even when object IDs match',async({page})=>{
  const dialog=await openProgram(page);await dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();await expect(dialog).toHaveCount(0);
  const original=(await objects(page))[0]!,workspace=selectedWorkspace(page),otherId=randomUUID();
  const command=(value:Record<string,unknown>)=>api(page.request,{action:'command',workspaceId:workspace.workspaceId,command:{commandId:randomUUID(),documentId:otherId,...value}},workspace.account.id);
  await command({kind:'create-document',expectedRevision:0,title:'Seconda lezione con stesso oggetto'});
  await command({kind:'add-object',expectedRevision:1,object:{...toObjectInput(original),data:{...original.data,state:{draft:'',ideas:[{id:1,text:'Stato della seconda lezione'}],next:2}}}});
  await refresh(page);await page.getByRole('button',{name:'Chiudi proprietà',exact:true}).click();await page.getByRole('button',{name:'Taccuino',exact:true}).click();
  let closed=0;page.on('worker',worker=>worker.on('close',()=>closed++));
  await start(page);await addIdea(page,'Esperimento della prima lezione');
  await page.getByRole('button',{name:'Apri libreria',exact:true}).click();await page.getByRole('button',{name:/Seconda lezione con stesso oggetto/}).click();
  await expect.poll(()=>closed).toBe(1);await expect(page.getByRole('button',{name:'Avvia questa versione',exact:true})).toBeVisible();
  await expect(page.locator('.program-canvas')).toHaveCount(0);await start(page);
  await expect(page.locator('.program-canvas')).toContainText('Stato della seconda lezione');await expect(page.locator('.program-canvas')).not.toContainText('Esperimento della prima lezione');
});

test('hidden-before-mount and unavailable Workers keep the editor usable without starting computation',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let workers=0;page.on('worker',()=>workers++);
  const dialog=await openProgram(page);
  // Inject only platform failure signals; no application state or save result is replaced.
  await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
  await dialog.getByRole('button',{name:'Avvia questa versione',exact:true}).click();
  await expect(dialog.locator('.program-toolbar')).toContainText('non è visibile');expect(workers).toBe(0);
  await page.evaluate(()=>{Reflect.deleteProperty(document,'hidden');const native=window.Worker;Object.defineProperty(window,'Worker',{configurable:true,value:class {constructor(){Object.defineProperty(window,'Worker',{configurable:true,value:native});throw new DOMException('Synthetic unavailable Worker','SecurityError');}}});});
  await dialog.getByRole('button',{name:'Riavvia questa versione',exact:true}).click();await expect(dialog.locator('.program-toolbar')).toContainText('non sono disponibili');expect(workers).toBe(0);
  await dialog.getByRole('button',{name:'Riavvia questa versione',exact:true}).click();await expect(dialog.locator('.program-toolbar')).toContainText('In esecuzione');await addIdea(page,'Riaperto senza perdita');expect(workers).toBe(1);expect(errors).toEqual([]);
});
