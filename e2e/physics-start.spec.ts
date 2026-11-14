import {test,expect,personalProjection} from './fixtures';

test('a learner starts physics from the catalog and resumes the same private path',async({page},info)=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/#corsi');
 const card=page.getByRole('region',{name:'Cinque microcorsi di Fisica',exact:true}).locator('.course-card')
  .filter({has:page.getByRole('heading',{name:'Fluidi: pressione, flusso e superfici',exact:true})});
 await card.getByRole('button',{name:'Inizia a studiare',exact:true}).click();
 await expect(page.getByLabel('Il tuo ragionamento',{exact:true})).toBeVisible({timeout:120000});
 const before=(await personalProjection(page)).courseSpace!;
 expect(before.editions).toHaveLength(1);expect(before.deliveries).toHaveLength(1);
 await page.getByLabel('Il tuo ragionamento',{exact:true}).fill('Prima distinguo densità, pressione e portata.');
 await page.getByRole('button',{name:'Salva risposta',exact:true}).click();
 await expect(page.getByLabel('Il tuo ragionamento',{exact:true})).toHaveValue('');
 await page.reload();
 await card.getByRole('button',{name:'Riprendi lo studio',exact:true}).click();
 await expect(page.locator('.course-attempts')).toContainText('Prima distinguo densità, pressione e portata.');
 const after=(await personalProjection(page)).courseSpace!;
 expect(after.deliveries).toEqual(before.deliveries);expect(after.editions).toEqual(before.editions);
 expect(after.work[0]!.attempts).toHaveLength(1);expect(after.work[0]!.shared).toBe(false);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect(errors).toEqual([]);
 await page.screenshot({path:info.outputPath('physics-direct-study.png'),fullPage:false});
});
