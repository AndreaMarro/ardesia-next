import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {MaterialManifestSchema,materialPage} from '@ardesia/contracts';
import {test,expect,personalProjection,selectedWorkspace,api} from './fixtures';

import {pdfFixture} from './material-fixture';

const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

test('imports real PDF pages, preserves the original, anchors ink when moving and reopens offline',async({page},info)=>{
  test.setTimeout(120_000);const bytes=pdfFixture(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  // The PDF engine must not be fetched by the empty lesson.
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(e=>/pdf-engine|pdf\.worker/.test(e.name)))).toBe(false);
  await page.getByRole('button',{name:'Importa materiale',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Porta un materiale nella lezione'});
  await dialog.getByLabel('File da importare').setInputFiles({name:'Le tre domande.pdf',mimeType:'application/pdf',buffer:bytes});
  await expect(dialog.locator('[data-material-state="ready"]')).toBeVisible();
  await dialog.getByRole('button',{name:'Pagina successiva',exact:true}).click();
  await expect(dialog.getByRole('img',{name:'Le tre domande.pdf · pagina 2 di 3'})).toBeVisible();
  await expect(dialog.locator('[data-material-state="ready"]')).toBeVisible();
  await dialog.getByLabel('Pagine da importare').fill('1, 3');
  await dialog.getByLabel('Diritti del materiale').fill('CC0 · fixture originale');
  await expect(dialog.locator('.material-accessible-text')).toContainText('pagina 2');
  await dialog.getByRole('button',{name:'Aggiungi alla lavagna',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('material-import.png'),fullPage:true});
  await dialog.getByRole('button',{name:'Aggiungi alla lavagna',exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(page.locator('.inspector')).toBeVisible();
  const saved=await personalProjection(page),lesson=saved.documents[0]!,materials=lesson.objects.filter(o=>o.type==='material');
  expect(materials.map(o=>o.data.page)).toEqual([1,3]);expect(materials[0]!.data.sha256).toBe(digest(bytes));
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Scarica originale',exact:true}).click();
  const download=await downloadPromise;expect(await readFile((await download.path())!)).toEqual(bytes);
  await page.getByRole('button',{name:'Chiudi proprietà',exact:true}).click();
  await page.getByRole('button',{name:'Inquadra tutto',exact:true}).click();await expect(page.locator('.type-material [data-material-state="ready"]')).toHaveCount(2);await page.getByRole('button',{name:'Penna',exact:true}).click();
  const target=page.locator(`[data-object-id="${materials[0]!.id}"]`),box=(await target.boundingBox())!;
  await page.mouse.move(box.x+box.width*.3,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5,{steps:12});await page.mouse.up();
  await expect.poll(async()=>((await personalProjection(page)).documents[0]!.objects.filter(o=>o.type==='ink').length)).toBe(1);
  const before=(await personalProjection(page)).documents[0]!.objects.find(o=>o.type==='ink')!;expect(before.data.anchor?.objectId).toBe(materials[0]!.id);
  await target.focus();await target.press('Alt+ArrowRight');
  await expect.poll(async()=>((await personalProjection(page)).documents[0]!.objects.find(o=>o.id===materials[0]!.id)!.x)).toBe(materials[0]!.x+10);
  await page.reload();await page.getByRole('button',{name:'Inquadra tutto',exact:true}).click();await expect(page.locator('.type-material [data-material-state="ready"]')).toHaveCount(2);
  const renderedInk=page.locator(`[data-object-id="${before.id}"]`);expect(await renderedInk.evaluate(el=>Number.parseFloat((el as HTMLElement).style.left))).toBeCloseTo(before.x+10,3);
  // Move the page beyond the viewport; focus and connection endpoints must use the anchored position.
  const selected=selectedWorkspace(page);
  const edit=async(command:Record<string,unknown>)=>{const doc=(await personalProjection(page)).documents.find(d=>d.id===lesson.id)!;return api(page.context().request,{action:'command',workspaceId:selected.workspaceId,command:{...command,commandId:randomUUID(),documentId:doc.id,expectedRevision:doc.revision}},selected.account.id);};
  await edit({kind:'connect-objects',connection:{id:randomUUID(),from:before.id,to:lesson.objects[0]!.id,label:'Annotazione e contesto'}});
  await edit({kind:'move-object',objectId:materials[0]!.id,x:materials[0]!.x+5010,y:materials[0]!.y});
  await page.reload();
  await page.getByRole('button',{name:'Oggetti',exact:true}).click();await page.getByRole('button',{name:`Seleziona ${before.title}`,exact:true}).click();
  await page.getByRole('button',{name:'Chiudi proprietà',exact:true}).click();
  await expect(renderedInk).toBeInViewport();
  expect(await renderedInk.evaluate(el=>Number.parseFloat((el as HTMLElement).style.left))).toBeCloseTo(before.x+5010,3);
  const connection=page.locator('.connections path').last();expect(await connection.getAttribute('d')).toContain(`M${before.x+5010+before.width},`);
  await edit({kind:'move-object',objectId:materials[0]!.id,x:materials[0]!.x+10,y:materials[0]!.y});
  await page.reload();
  await page.getByRole('button',{name:'Inquadra tutto',exact:true}).click();
  await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('button',{name:'Rendi disponibile offline',exact:true}).click();
  await expect(page.getByRole('button',{name:'Usa copia offline',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Usa copia offline',exact:true}).click();
  await expect(page.locator('.offline-workspace')).toBeVisible();await page.context().setOffline(true);await page.reload();
  await expect(page.locator('.offline-workspace .type-material [data-material-state="ready"]')).toHaveCount(2);
  await page.screenshot({path:info.outputPath('material-offline.png'),fullPage:true});
  expect(errors).toEqual([]);await page.context().setOffline(false);
});

test('imports a decoded image and rejects corrupt files without adding objects',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Importa materiale',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Porta un materiale nella lezione'});
  await dialog.getByLabel('File da importare').setInputFiles({name:'broken.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\ncorrupt')});
  await expect(dialog.getByRole('alert')).toContainText('PDF non leggibile');
  expect((await personalProjection(page)).documents[0]!.objects).toHaveLength(3);
  const base64=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const c=canvas.getContext('2d')!;c.fillStyle='#dbe8d8';c.fillRect(0,0,320,180);c.fillStyle='#235e50';c.fillRect(20,20,80,80);return canvas.toDataURL('image/png').split(',')[1]!;});
  const bytes=Buffer.from(base64,'base64');
  await dialog.getByLabel('File da importare').setInputFiles({name:'Appunti.png',mimeType:'image/png',buffer:bytes});
  await expect(dialog.locator('[data-material-state="ready"]')).toBeVisible();
  await dialog.getByRole('button',{name:'Aggiungi alla lavagna',exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect(page.locator('.type-material [data-material-state="ready"]')).toBeVisible();
  const object=(await personalProjection(page)).documents[0]!.objects.find(o=>o.type==='material')!;
  expect(object).toMatchObject({type:'material',data:{mimeType:'image/png',sha256:digest(bytes),page:1,pageCount:1}});
  await page.reload();await expect(page.locator('.type-material [data-material-state="ready"]')).toBeVisible();
});


test('resumes an interrupted material upload after reopening with the same original and page IDs',async({page})=>{
  const bytes=pdfFixture();await page.goto('/');let dropped=false;
  await page.route('**/api/m3',async route=>{const input=route.request().postDataJSON();if(input?.action==='put-material-part'&&!dropped){dropped=true;await route.fetch();await route.abort('failed');return;}await route.continue();});
  await page.getByRole('button',{name:'Importa materiale',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Porta un materiale nella lezione'});
  await dialog.getByLabel('File da importare').setInputFiles({name:'Da riprendere.pdf',mimeType:'application/pdf',buffer:bytes});await expect(dialog.locator('[data-material-state="ready"]')).toBeVisible();
  await dialog.getByRole('button',{name:'Aggiungi alla lavagna',exact:true}).click();await expect(dialog.getByRole('alert')).toBeVisible();expect(dropped).toBe(true);
  const selected=selectedWorkspace(page);const intent=await page.evaluate(async s=>new Promise<{assetId:string;ids:string[]}>(resolve=>{const request=indexedDB.open('ardesia-next.offline.v1',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('local','readonly'),item=tx.objectStore('local').get(['material-draft',s.account.id,s.workspaceId,s.documentId]);item.onsuccess=()=>resolve({assetId:item.result.manifest.assetId,ids:item.result.objects.map((o:{id:string})=>o.id)});tx.oncomplete=()=>db.close();};}),selected);
  page.on('dialog',d=>d.accept());await page.reload();await page.getByRole('button',{name:'Importa materiale',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Riprova importazione',exact:true})).toBeEnabled();await expect(dialog.getByLabel('File da importare')).toBeDisabled();
  await dialog.getByRole('button',{name:'Riprova importazione',exact:true}).click();await expect(dialog).toHaveCount(0);
  const materials=(await personalProjection(page)).documents[0]!.objects.filter(o=>o.type==='material');expect(materials).toHaveLength(1);expect(materials[0]!.data.sha256).toBe(digest(bytes));expect(materials.map(o=>o.id)).toEqual(intent.ids);expect(materials[0]!.data.assetId).toBe(intent.assetId);
  await page.reload();await page.getByRole('button',{name:'Importa materiale',exact:true}).click();await expect(dialog.getByLabel('File da importare')).toBeEnabled();
});


test('updates an already prepared offline copy with the original in an unopened lesson',async({page})=>{
  test.setTimeout(90_000);await page.goto('/');
  await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('button',{name:'Rendi disponibile offline',exact:true}).click();
  await expect(page.getByRole('button',{name:'Usa copia offline',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Chiudi finestra',exact:true}).click();
  const selected=selectedWorkspace(page),documentId=randomUUID(),assetId=randomUUID(),bytes=pdfFixture(),hash=digest(bytes);
  const send=(body:Record<string,unknown>)=>api(page.context().request,{...body,workspaceId:selected.workspaceId},selected.account.id);
  await send({action:'command',command:{kind:'create-document',commandId:randomUUID(),documentId,expectedRevision:0,title:'Materiale arrivato dopo'}});
  const manifest=MaterialManifestSchema.parse({format:'ardesia-material-v1',assetId,documentId,name:'Senza aprire la lezione.pdf',mimeType:'application/pdf',bytes:bytes.length,sha256:hash,license:'CC0',pages:[{width:600,height:800},{width:600,height:800},{width:600,height:800}],parts:[{index:0,bytes:bytes.length,sha256:hash}]});
  await send({action:'prepare-material',manifest});await send({action:'put-material-part',assetId,index:0,base64:bytes.toString('base64')});await send({action:'finish-material',assetId});
  await send({action:'command',command:{kind:'add-object',commandId:randomUUID(),documentId,expectedRevision:1,object:{id:randomUUID(),type:'material',title:'Pagina arrivata dopo',x:0,y:0,width:300,height:400,data:materialPage(manifest,1)}}});
  await page.reload();
  await expect(page.locator('.type-material')).toHaveCount(0);
  await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('button',{name:'Usa copia offline',exact:true}).click();
  await expect(page.locator('.offline-workspace')).toBeVisible();await page.context().setOffline(true);await page.reload();
  await page.getByLabel('Lezione disponibile').selectOption(documentId);
  await expect(page.locator('.type-material [data-material-state="ready"]')).toBeVisible();
  await page.context().setOffline(false);
});


test('lets the owner recover the file and abandon a permanently rejected import',async({page})=>{
  const bytes=pdfFixture();await page.goto('/');
  await page.route('**/api/m3',async route=>{if(route.request().postDataJSON()?.action==='prepare-material'){await route.fulfill({status:422,json:{ok:false,error:{code:'INVALID_COMMAND',message:'Synthetic quota refusal'}}});return;}await route.continue();});
  await page.getByRole('button',{name:'Importa materiale',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Porta un materiale nella lezione'});
  await dialog.getByLabel('File da importare').setInputFiles({name:'Da conservare.pdf',mimeType:'application/pdf',buffer:bytes});await expect(dialog.locator('[data-material-state="ready"]')).toBeVisible();
  await dialog.getByRole('button',{name:'Aggiungi alla lavagna',exact:true}).click();await expect(dialog.getByRole('alert')).toBeVisible();
  page.on('dialog',d=>d.accept());await page.reload();await page.getByRole('button',{name:'Importa materiale',exact:true}).click();
  await expect(dialog.getByLabel('File da importare')).toBeDisabled();
  await dialog.getByRole('button',{name:'Abbandona questa importazione',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await dialog.getByRole('button',{name:'Scarica il file conservato',exact:true}).click();
  expect(await readFile((await (await downloadPromise).path())!)).toEqual(bytes);
  await dialog.getByRole('button',{name:'Abbandona bozza',exact:true}).click();await expect(dialog.getByLabel('File da importare')).toBeEnabled();
  await page.reload();await page.getByRole('button',{name:'Importa materiale',exact:true}).click();await expect(dialog.getByLabel('File da importare')).toBeEnabled();
  expect((await personalProjection(page)).documents[0]!.objects).toHaveLength(3);
  await page.unroute('**/api/m3');await dialog.getByLabel('File da importare').setInputFiles({name:'Nuovo tentativo.pdf',mimeType:'application/pdf',buffer:bytes});await expect(dialog.locator('[data-material-state="ready"]')).toBeVisible();await dialog.getByRole('button',{name:'Aggiungi alla lavagna',exact:true}).click();await expect(dialog).toHaveCount(0);expect((await personalProjection(page)).documents[0]!.objects).toHaveLength(4);
});
