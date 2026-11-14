import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {test,expect,personalProjection} from './fixtures';

test('imports two pages exported by the native notebook, preserves the PDF and anchors new web ink',async({page},info)=>{
 test.setTimeout(120000);
 const bytes=await readFile('e2e/fixtures/native-quaderno.pdf');
 const sha256=createHash('sha256').update(bytes).digest('hex');
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Importa materiale',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Porta un materiale nella lezione'});
 await dialog.getByLabel('File da importare').setInputFiles({name:'Appunti dal quaderno nativo.pdf',mimeType:'application/pdf',buffer:bytes});
 await expect(dialog.locator('[data-material-state="ready"]')).toBeVisible();
 await dialog.getByLabel('Pagine da importare').fill('1, 2');
 await dialog.getByLabel('Diritti del materiale').fill('Appunti originali · fixture di collaudo Ardesia');
 await dialog.getByRole('button',{name:'Aggiungi alla lavagna',exact:true}).click();await expect(dialog).toHaveCount(0);
 const snapshot=await personalProjection(page);
 const materials=snapshot.documents[0]!.objects.filter(o=>o.type==='material');
 expect(materials.map(o=>o.data.page)).toEqual([1,2]);
 for(const item of materials){expect(item.data.sha256).toBe(sha256);expect(item.data.pageCount).toBe(2);}
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Scarica originale',exact:true}).click();
 expect(await readFile((await (await pending).path())!)).toEqual(bytes);
 await page.getByRole('button',{name:'Chiudi proprietà',exact:true}).click();
 await page.getByRole('button',{name:'Inquadra tutto',exact:true}).click();
 await expect(page.locator('.type-material [data-material-state="ready"]')).toHaveCount(2);
 await page.getByRole('button',{name:'Penna',exact:true}).click();
 const box=(await page.locator(`[data-object-id="${materials[0]!.id}"]`).boundingBox())!;
 await page.mouse.move(box.x+box.width*.25,box.y+box.height*.65);await page.mouse.down();
 await page.mouse.move(box.x+box.width*.65,box.y+box.height*.7,{steps:10});await page.mouse.up();
 await expect.poll(async()=>((await personalProjection(page)).documents[0]!.objects.filter(o=>o.type==='ink').length)).toBe(1);
 const ink=(await personalProjection(page)).documents[0]!.objects.find(o=>o.type==='ink')!;
 expect(ink.data.anchor?.objectId).toBe(materials[0]!.id);
 await page.reload();await page.getByRole('button',{name:'Inquadra tutto',exact:true}).click();
 await expect(page.locator('.type-material [data-material-state="ready"]')).toHaveCount(2);
 expect((await personalProjection(page)).documents[0]!.objects.find(o=>o.id===ink.id)?.data).toEqual(ink.data);
 expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath('native-notebook-import.png'),fullPage:false});
});
