import {test,expect,personalProjection} from './fixtures';
test('concept links persist as portable objects and backlinks retain exact old targets',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Apri conoscenza',exact:true}).click();
 const original=(await personalProjection(page)).documents[0]!,note=original.objects.find(o=>o.type==='note')!,formula=original.objects.find(o=>o.type==='formula')!,source=original.objects.find(o=>o.type==='source')!;
 await page.locator('.knowledge-card').filter({hasText:note.title}).click();
 await page.getByRole('combobox',{name:'Destinazione',exact:true}).selectOption({label:original.title+' · '+formula.title});await page.getByRole('button',{name:'Crea collegamento',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Segui una connessione.',exact:true})).toBeVisible();
 await page.locator('.knowledge-card').filter({hasText:formula.title}).filter({hasNotText:'→'}).click();
 await page.getByRole('combobox',{name:'Destinazione',exact:true}).selectOption({label:original.title+' · '+source.title});await page.getByRole('button',{name:'Crea collegamento',exact:true}).click();
 await expect.poll(async()=>(await personalProjection(page)).documents[0]!.objects.filter(o=>o.type==='extension').length).toBe(2);
 await expect(page.getByRole('region',{name:'Mappa delle relazioni',exact:true})).toBeVisible();await page.getByRole('button',{name:'Esplora '+formula.title,exact:true}).click();await expect(page.getByRole('heading',{name:formula.title,exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('knowledge-map.png'),fullPage:true});
 await page.reload();await page.getByLabel('Cerca nel tuo archivio',{exact:true}).fill(formula.title);
 await page.locator('.knowledge-card').filter({hasText:formula.title}).filter({hasNotText:'→'}).click();await expect(page.locator('.knowledge-link')).toHaveCount(2);
 await expect(page.locator('.knowledge-link').first()).toContainText(note.title);await expect(page.locator('.knowledge-link').first()).toContainText('Revisioni 1 → 1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Apri la lezione originale',exact:true}).click();await expect(page.getByRole('region',{name:'Lavagna della lezione',exact:true})).toBeVisible();
});
