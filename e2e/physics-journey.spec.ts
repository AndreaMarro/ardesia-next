import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('a visitor reaches the Poiseuille lesson, recovers an error and resumes the same edition',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/fisica/c2.html');
 await page.getByRole('link',{name:'Inizia la lezione interattiva →',exact:true}).click();
 await page.locator('[name=prediction][value=quarter]').check();
 await page.locator('#radius').fill('0.5');
 await expect(page.locator('#prediction-feedback')).toContainText('1/16');
 await expect(page.locator('#ratio')).toContainText('0,0625');
 await page.locator('[name=quiz][value=A]').check();await page.locator('#check-quiz').click();
 await expect(page.locator('#quiz-feedback')).toContainText('velocità locale');
 await page.locator('#quiz-feedback a').click();await expect(page).toHaveURL(/#recupero-media$/);
 await page.locator('[name=quiz][value=E]').check();await page.locator('#check-quiz').click();
 await page.locator('#quiz-feedback a').click();await expect(page).toHaveURL(/#nuova-applicazione$/);
 await page.locator('#transfer-answer').fill('40,0');await page.locator('#check-transfer').click();
 await expect(page.locator('#transfer-feedback')).toContainText('Il tempo è coerente');
 await page.locator('#journey-notes').fill('La portata richiede la velocità media.');
 const pending=page.waitForEvent('download');await page.locator('#save-journey').click();
 const saved=await (await pending).path();const work=JSON.parse(readFileSync(saved!,'utf8'));
 expect(work.study.attempts).toEqual(['A','E']);expect(work.study.radius).toBe(0.5);
 await page.reload();await expect(page.locator('#journey-notes')).toHaveValue('');
 await page.locator('#resume-journey').setInputFiles(saved!);
 await expect(page.locator('#save-status')).toContainText('Lavoro riaperto');
 await expect(page.locator('#journey-notes')).toHaveValue(work.study.notes);
 await expect(page.locator('#radius')).toHaveValue('0.5');
 await expect(page.locator('#attempt-note')).toContainText('2 confronti sullo stesso quesito');
 await expect(page.locator('#transfer-feedback')).toContainText('Il tempo è coerente');
 expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect(errors).toEqual([]);
});

test('guided resume rejects wrong editions, malformed fields and oversized files without losing the current work',async({page})=>{
 await page.goto('/fisica/poiseuille.html');await page.locator('#journey-notes').fill('Da conservare');
 const pending=page.waitForEvent('download');await page.locator('#save-journey').click();
 const work=JSON.parse(readFileSync((await (await pending).path())!,'utf8'));
 for(const invalid of [
  {...work,edition:'0'.repeat(64)},
  {...work,study:{...work.study,radius:1.03}},
  {...work,study:{...work.study,quiz:['A']}},
  {...work,study:{...work.study,attempts:['Z']}},
  {...work,study:{...work.study,notes:'x'.repeat(20000)}}
 ]){
  await page.locator('#resume-journey').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});
  await expect(page.locator('#save-status')).toContainText('File non compatibile');
  await expect(page.locator('#journey-notes')).toHaveValue('Da conservare');
 }
 await page.locator('#transfer-answer').fill('40 secondi');await page.locator('#check-transfer').click();
 await expect(page.locator('#transfer-feedback')).toContainText('solo il numero');
});

test('the public reading lessons expose the existing laboratories at the point of investigation',async({page})=>{
 for(const [unit,destination] of [['sf-2026-u3-04','poiseuille.html'],['sf-2026-u6-02','campo.html'],['sf-2026-u5-04','termodinamica.html']] as const){
  await page.goto('/fisica/'+unit+'.html#indagine');
  await expect(page.locator('#indagine .reader-lab a')).toHaveAttribute('href','./'+destination);
  await page.locator('#indagine .reader-lab a').click();await expect(page).toHaveURL(new RegExp('/fisica/'+destination.replace('.','\\.')+'$'));
 }
});
