import {test,expect,personalProjection} from './fixtures';
import type {Page} from '@playwright/test';

async function gesture(page:Page,type:'pen'|'mouse'='pen',end=true){
 await page.locator('.board-surface').evaluate((el,{type,end})=>{
  const r=el.getBoundingClientRect();el.setPointerCapture=()=>{};
  const send=(event:string,x:number,y:number)=>el.dispatchEvent(new PointerEvent(event,{bubbles:true,pointerId:41,pointerType:type,button:0,buttons:event==='pointerup'?0:1,pressure:.6,clientX:r.x+r.width*.3+x,clientY:r.y+r.height*.5+y}));
  send('pointerdown',0,0);send('pointermove',50,25);if(end)send('pointerup',80,45);
 },{type,end});
}
const inks=async(page:Page)=>(await personalProjection(page)).documents.flatMap(d=>d.objects).filter(o=>o.type==='ink');
const drafts=async(page:Page)=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('ardesia-next.ink-draft.v1.')).map(k=>JSON.parse(localStorage.getItem(k)!)));
async function eraseSaved(page:Page,pointerType='pen'){
 const object=(await inks(page))[0]!;
 await page.getByRole('button',{name:'Gomma a tratto',exact:true}).click();
 await page.locator('.board-surface').evaluate((el,{object,pointerType})=>{
  const r=el.getBoundingClientRect(),matrix=new DOMMatrix(getComputedStyle(el.querySelector('.board-world')!).transform),p=object.data.points[0]!;
  const init={bubbles:true,pointerId:52,pointerType,button:0,buttons:1,pressure:.5,clientX:r.x+matrix.e+(object.x+p.x)*matrix.a,clientY:r.y+matrix.f+(object.y+p.y)*matrix.a};
  el.setPointerCapture=()=>{};el.dispatchEvent(new PointerEvent('pointerdown',init));el.dispatchEvent(new PointerEvent('pointerup',{...init,buttons:0}));
 },{object,pointerType});
}

test('one gesture keeps one checkpoint and repeated hide/cancel hands it off exactly once',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Penna',exact:true}).click();
 await gesture(page,'pen',false);
 await expect.poll(async()=>{const rows=await drafts(page);return rows.length===1&&rows[0].object.data.points.length===2;}).toBe(true);
 const checkpoint=(await drafts(page))[0];expect(await inks(page)).toEqual([]);
 await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide'));window.dispatchEvent(new PageTransitionEvent('pagehide'));const surface=document.querySelector('.board-surface')!;surface.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:41,pointerType:'pen'}));});
 await expect.poll(async()=>(await inks(page)).length).toBe(1);
 expect((await inks(page))[0]).toMatchObject(checkpoint.object);
 await expect.poll(async()=>(await drafts(page)).length).toBe(0);
 await page.reload();expect((await inks(page)).length).toBe(1);
});

test('Pencil respects eraser and pan, and notebook writes the same lesson objects',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Penna',exact:true}).click();await gesture(page);
 await expect.poll(async()=>(await inks(page)).length).toBe(1);await eraseSaved(page);
 await expect.poll(async()=>(await inks(page)).length).toBe(0);
 await page.getByRole('button',{name:'Sposta lavagna',exact:true}).click();await gesture(page);expect(await inks(page)).toEqual([]);
 await page.getByRole('button',{name:'Taccuino',exact:true}).click();await expect(page.getByRole('region',{name:'Taccuino della lezione'})).toBeVisible();
 await page.getByRole('button',{name:'Penna',exact:true}).click();await gesture(page);
 await expect.poll(async()=>(await inks(page)).length).toBe(1);const saved=(await inks(page))[0]!;
 await page.getByRole('button',{name:'Lavagna',exact:true}).click();await expect(page.getByTestId(`object-${saved.id}`)).toBeVisible();
 await page.reload();expect((await inks(page))[0]).toEqual(saved);
});

test('offline stroke erasure survives cold reopen without changing the server until explicit confirmation',async({page,context})=>{
 await page.goto('/');await page.getByRole('button',{name:'Penna',exact:true}).click();await gesture(page);await expect.poll(async()=>(await inks(page)).length).toBe(1);
 const original=(await inks(page))[0]!;
 await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('button',{name:'Rendi disponibile offline',exact:true}).click();
 await expect(page.getByRole('button',{name:'Usa copia offline',exact:true})).toBeVisible();
 await context.setOffline(true);await page.getByRole('button',{name:'Usa copia offline',exact:true}).click();
 await eraseSaved(page);await expect(page.getByTestId(`object-${original.id}`)).toHaveCount(0);
 await page.reload();await expect(page.getByText('Il tuo spazio offline',{exact:true})).toBeVisible();await expect(page.getByTestId(`object-${original.id}`)).toHaveCount(0);
 expect((await inks(page)).map(o=>o.id)).toEqual([original.id]);
 await context.setOffline(false);await page.getByRole('button',{name:'Ricollegati al server',exact:true}).click();
 await page.getByRole('button',{name:'Riprendi modifica non inviata',exact:true}).click();
 await expect.poll(async()=>(await inks(page)).length).toBe(0);
});


test('an active checkpoint in another tab cannot be recovered as a partial Core object',async({page,context})=>{
 await page.goto('/');const second=await context.newPage();await second.goto('/');
 await page.getByRole('button',{name:'Penna',exact:true}).click();await gesture(page,'pen',false);
 await expect.poll(async()=>(await drafts(page)).length).toBe(1);
 await second.reload();await expect(second.getByRole('button',{name:'Recupera tratti interrotti',exact:true})).toBeVisible();
 await second.getByRole('button',{name:'Recupera tratti interrotti',exact:true}).click();
 await expect(second.getByText(/Un tratto è ancora in uso/)).toBeVisible();expect(await inks(page)).toEqual([]);
 await page.locator('.board-surface').evaluate(el=>{const r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:41,pointerType:'pen',button:0,pressure:.8,clientX:r.x+r.width*.3+90,clientY:r.y+r.height*.5+50}));});
 await expect.poll(async()=>(await inks(page)).length).toBe(1);
 await second.getByRole('button',{name:'Recupera tratti interrotti',exact:true}).click();
 await expect.poll(async()=>(await drafts(page)).length).toBe(0);expect((await inks(page)).length).toBe(1);await second.close();
});

test('finger erases a stroke only after opting in to touch writing',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Penna',exact:true}).click();await gesture(page);await expect.poll(async()=>(await inks(page)).length).toBe(1);
 await eraseSaved(page,'touch');expect((await inks(page)).length).toBe(1);
 await page.getByRole('button',{name:'Penna',exact:true}).click();await page.getByRole('checkbox',{name:'Scrivi con un dito',exact:true}).check();await eraseSaved(page,'touch');await expect.poll(async()=>(await inks(page)).length).toBe(0);
});
