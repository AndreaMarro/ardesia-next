/** Media capture using actual authenticated local Core and the standard synthetic teaching workspace.
 * Run with a local Playwright config selecting this file, video:on, after setup-test-databases/build.
 * It creates no remote accounts and is deliberately outside the regression testDir.
 */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {test,expect,personalProjection} from '../e2e/fixtures';
import {openMarketplace,verifyAndInstallSpring,authorizeSpring} from '../e2e/marketplace-helpers';
const output=resolve(process.env.ARDESIA_MEDIA_DIR??'artifacts/showcase/core');
test('actual board, notebook and signed plugin',async({page},info)=>{
 test.setTimeout(120_000);mkdirSync(output,{recursive:true});
 const captures:Record<string,unknown>[]=[],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const shot=async(name:string)=>{const file=resolve(output,name+'.png');await page.screenshot({path:file});captures.push({file,route:page.url(),viewport:page.viewportSize(),mode:'actual authenticated local UI; synthetic teaching workspace'});};
 await page.goto('/');await page.getByRole('button',{name:'Inquadra tutto',exact:true}).click();
 await shot('lavagna-oggetti-fonti');await page.waitForTimeout(2500);
 await page.getByRole('button',{name:'Taccuino',exact:true}).click();await shot('taccuino');await page.waitForTimeout(2000);
 await page.getByRole('button',{name:'Lavagna',exact:true}).click();
 await openMarketplace(page);await verifyAndInstallSpring(page);await authorizeSpring(page);
 await page.getByRole('button',{name:'Attiva Molla ideale',exact:true}).click();
 await shot('plugin-verificato-attivo');await page.waitForTimeout(2000);
 await page.getByRole('button',{name:'Aggiungi molla alla lezione',exact:true}).click();
 const inspector=page.getByRole('complementary',{name:'Proprietà del laboratorio',exact:true});
 await expect(inspector).toHaveAttribute('data-plugin-status','ready');
 await inspector.getByLabel('Massa (kg)',{exact:true}).fill('4');
 await inspector.getByRole('button',{name:'Salva laboratorio',exact:true}).click();
 await expect(page.locator('.app-footer [role="status"]')).toContainText('Confermato dal server');
 await shot('molla-parametro-salvato');await page.waitForTimeout(2000);
 await inspector.locator('.science-metrics').scrollIntoViewIfNeeded();
 await shot('molla-grafico-e-misure');await page.waitForTimeout(4000);
 await page.getByRole('button',{name:'Chiudi proprietà',exact:true}).click();
 await page.getByRole('button',{name:'Inquadra tutto',exact:true}).click();
 await shot('plugin-nella-lezione');await page.waitForTimeout(3000);
 await page.getByRole('button',{name:'Penna',exact:true}).click();
 const box=(await page.locator('.board-surface').boundingBox())!;
 await page.mouse.move(box.x+80,box.y+box.height-160);await page.mouse.down();
 await page.mouse.move(box.x+200,box.y+box.height-145,{steps:18});await page.mouse.up();
 await expect.poll(async()=>(await personalProjection(page)).documents[0]!.objects.filter(o=>o.type==='ink').length).toBeGreaterThan(0);
 await shot('lavagna-annotata');await page.waitForTimeout(2000);
 await page.reload();await page.getByRole('button',{name:'Apri Molla ideale',exact:true}).click();
 await expect(page.getByLabel('Massa (kg)',{exact:true})).toHaveValue('4');
 await shot('plugin-riaperto');await page.waitForTimeout(3000);
 expect(errors).toEqual([]);
 writeFileSync(resolve(output,'manifest.json'),JSON.stringify({source:JSON.parse(readFileSync('apps/web/dist/build-info.json','utf8')),physicalDevices:'NOT_RUN',captures,errors,video:info.outputPath('video.webm')},null,2)+'\n');
});
