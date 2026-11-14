import {test,expect,personalProjection} from './fixtures';
import type {Page} from '@playwright/test';

const inks=async(page:Page)=>(await personalProjection(page)).documents.flatMap(document=>document.objects.filter(object=>object.type==='ink'));
async function area(page:Page){
 return page.locator('.writing-immersive').evaluate(board=>{
  const viewport=window.visualViewport,screen={x:viewport?.offsetLeft??0,y:viewport?.offsetTop??0,width:viewport?.width??innerWidth,height:viewport?.height??innerHeight};
  const rect=board.querySelector('.board-surface')!.getBoundingClientRect();
  const intersection=(r:DOMRect)=>Math.max(0,Math.min(r.right,screen.x+screen.width)-Math.max(r.left,screen.x))*Math.max(0,Math.min(r.bottom,screen.y+screen.height)-Math.max(r.top,screen.y));
  const controls=[...board.querySelectorAll('[data-writing-control]')].filter(element=>{const style=getComputedStyle(element);return style.visibility!=='hidden'&&Number(style.opacity)>.5;}).map(element=>({name:element.getAttribute('data-writing-control'),area:intersection(element.getBoundingClientRect())}));
  const pixels=screen.width*screen.height;
  return {viewport:screen,canvas:intersection(rect)/pixels,net:(intersection(rect)-controls.reduce((sum,item)=>sum+item.area,0))/pixels,controls};
 });
}
async function pen(page:Page,phase:'down'|'up'){
 await page.locator('.board-surface').evaluate((surface,phase)=>{
  const rect=surface.getBoundingClientRect();surface.setPointerCapture=()=>{};
  const point={bubbles:true,pointerId:71,pointerType:'pen',button:0,buttons:phase==='up'?0:1,pressure:.62,clientX:rect.x+rect.width*.73+(phase==='up'?60:0),clientY:rect.y+rect.height*.6+(phase==='up'?35:0)};
  surface.dispatchEvent(new PointerEvent(phase==='down'?'pointerdown':'pointerup',point));
  if(phase==='down')surface.dispatchEvent(new PointerEvent('pointermove',{...point,clientX:point.clientX+30,clientY:point.clientY+20,pressure:.8}));
 },phase);
}

test('immersive writing exceeds ninety percent usable area on Mac and simulated iPad viewports without shifting ink',async({page},info)=>{
 const measurements=[];
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto('/');
 // The fixture's first automatic fit is asynchronous; measure the transition
 // after that fit, not the initial identity camera before ResizeObserver runs.
 await expect(page.locator('.board-world')).not.toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
 const sizes=[{width:1440,height:960},{width:1024,height:1366},{width:1366,height:1024},{width:820,height:1180},{width:1180,height:820},{width:744,height:1133},{width:1024,height:768}];
 for(const [index,size]of sizes.entries()){
  await page.setViewportSize(size);const reference=page.getByRole('button',{name:'Apri Il pendolo semplice',exact:true});
  const before=(await reference.boundingBox())!;
  await page.getByRole('button',{name:'Scrittura immersiva',exact:true}).click();
  await expect(page.locator('.writing-immersive')).toHaveCount(1);
  const after=(await reference.boundingBox())!;expect(Math.abs(after.x-before.x)).toBeLessThan(1);expect(Math.abs(after.y-before.y)).toBeLessThan(1);
  await expect(page.locator('.writing-immersive .board-toolbar')).toHaveCSS('opacity','1');
  const visible=await area(page);expect(visible.canvas).toBeGreaterThan(.99);expect(visible.net).toBeGreaterThan(.9);
  const transform=await page.locator('.board-world').evaluate(el=>getComputedStyle(el).transform);
  await page.getByRole('button',{name:'Nascondi strumenti di scrittura',exact:true}).click();await expect(page.getByRole('toolbar',{name:'Strumenti lavagna',exact:true})).toBeHidden();
  await page.getByRole('button',{name:'Mostra strumenti di scrittura',exact:true}).click();await expect(page.getByRole('toolbar',{name:'Strumenti lavagna',exact:true})).toBeVisible();
  expect(await page.locator('.board-world').evaluate(el=>getComputedStyle(el).transform)).toBe(transform);
  await pen(page,'down');await expect(page.getByRole('toolbar',{name:'Strumenti lavagna',exact:true})).toBeHidden();
  const drawing=await area(page);expect(drawing.net).toBeGreaterThan(.99);
  expect(await page.locator('.board-world').evaluate(el=>getComputedStyle(el).transform)).toBe(transform);
  // Keyboard navigation during a live gesture cannot distort later samples.
  await expect(page.locator('.board-surface')).toBeFocused();
  for(const key of ['Escape','ArrowRight','Home','PageDown'])await page.keyboard.press(key);
  await reference.dispatchEvent('keydown',{key:'ArrowRight',altKey:true,bubbles:true});
  await expect(page.locator('.writing-immersive')).toHaveCount(1);
  expect(await page.locator('.board-world').evaluate(el=>getComputedStyle(el).transform)).toBe(transform);
  await pen(page,'up');await expect.poll(async()=>(await inks(page)).length).toBe(index+1);
  const last=(await inks(page)).at(-1)!;
  const scale=await page.locator('.board-world').evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
  // CSS matrices are serialized at limited precision; PointerEvent pressure is
  // float32. Tolerances stay far below a CSS pixel and preserve the signal.
  expect(last.type).toBe('ink');if(last.type==='ink'){expect(last.data.points).toHaveLength(3);expect(last.width*scale).toBeCloseTo(60,3);expect(last.height*scale).toBeCloseTo(35,3);}
  await expect(page.getByRole('toolbar',{name:'Strumenti lavagna',exact:true})).toBeVisible();
  await expect(page.locator('.writing-immersive .board-toolbar')).toHaveCSS('opacity','1');
  measurements.push({project:info.project.name,device:'simulated viewport, synthetic PointerEvents',visible,drawing});
  if(index===3)await page.screenshot({path:info.outputPath('writing-ipad-portrait.png')});
  if(index===4)await page.screenshot({path:info.outputPath('writing-ipad-landscape.png')});
  await page.keyboard.press('Escape');await expect(page.locator('.writing-immersive')).toHaveCount(0);
  const restored=(await reference.boundingBox())!;expect(Math.abs(restored.x-before.x)).toBeLessThan(1);expect(Math.abs(restored.y-before.y)).toBeLessThan(1);
 }
 const saved=await inks(page);expect(saved).toHaveLength(sizes.length);expect(saved.every(object=>object.type==='ink'&&object.data.points.some(point=>Math.abs(point.pressure-.8)<.000001))).toBe(true);
 await page.reload();expect(await inks(page)).toEqual(saved);
 expect(errors).toEqual([]);
 await info.attach('writing-area-measurements',{body:JSON.stringify(measurements,null,2),contentType:'application/json'});
});

test('immersive tools are recoverable by keyboard and simulated touch while two fingers keep navigating',async({page},info)=>{
 await page.setViewportSize({width:820,height:1180});await page.goto('/');
 await page.getByRole('button',{name:'Scrittura immersiva',exact:true}).click();
 await page.getByRole('button',{name:'Nascondi strumenti di scrittura',exact:true}).click();
 const recover=page.getByRole('button',{name:'Mostra strumenti di scrittura',exact:true});
 if(info.project.use.hasTouch)await recover.tap();else await recover.click();
 const hide=page.getByRole('button',{name:'Nascondi strumenti di scrittura',exact:true});
 await hide.focus();await hide.press('Enter');await expect(page.getByRole('toolbar',{name:'Strumenti lavagna',exact:true})).toBeHidden();
 await recover.focus();await recover.press('Enter');await expect(page.getByRole('toolbar',{name:'Strumenti lavagna',exact:true})).toBeVisible();
 const scale=()=>page.locator('.board-world').evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
 const before=await scale();
 await page.locator('.board-surface').evaluate(surface=>{
  surface.setPointerCapture=()=>{};
  const emit=(type:string,id:number,x:number,y:number)=>surface.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',pointerId:id,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y}));
  emit('pointerdown',81,300,420);emit('pointerdown',82,500,420);emit('pointermove',82,600,420);emit('pointerup',81,300,420);emit('pointerup',82,600,420);
 });
 expect(await scale()).toBeCloseTo(before*1.5,5);expect(await inks(page)).toHaveLength(0);
 await page.getByRole('button',{name:'Opzioni della penna',exact:true}).click();await page.getByLabel('Scrivi con un dito',{exact:true}).check();
 for(const [type,x,y]of [['pointerdown',300,600],['pointermove',330,620],['pointerup',360,640]]as const){
  await page.locator('.board-surface').evaluate((surface,{type,x,y})=>surface.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',pointerId:83,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y})),{type,x,y});
  if(type==='pointerdown')await expect(page.getByRole('toolbar',{name:'Strumenti lavagna',exact:true})).toBeHidden();
 }
 await expect.poll(async()=>(await inks(page)).length).toBe(1);
 await page.keyboard.press('Escape');await expect(page.locator('.writing-immersive')).toHaveCount(0);
});

test('entering immersive writing protects a dirty object until its draft decision',async({page})=>{
 await page.setViewportSize({width:1440,height:960});await page.goto('/');
 await page.getByRole('button',{name:'Oggetti',exact:true}).click();await page.getByRole('button',{name:'Seleziona Che cosa cambia il periodo?',exact:true}).click();
 const title=page.getByLabel('Titolo oggetto',{exact:true});await title.fill('La bozza deve restare');
 await page.getByRole('button',{name:'Scrittura immersiva',exact:true}).click();
 const guard=page.getByRole('dialog',{name:'Hai modifiche da salvare',exact:true});await expect(guard).toBeVisible();
 await guard.getByRole('button',{name:'Continua a modificare',exact:true}).click();await expect(title).toHaveValue('La bozza deve restare');await expect(page.locator('.writing-immersive')).toHaveCount(0);
 await page.getByRole('button',{name:'Scrittura immersiva',exact:true}).click();await guard.getByRole('button',{name:'Scarta modifiche',exact:true}).click();
 await expect(page.locator('.writing-immersive')).toHaveCount(1);await expect(page.locator('.inspector')).toHaveCount(0);
 expect((await personalProjection(page)).documents[0]!.objects.some(object=>object.title==='La bozza deve restare')).toBe(false);
 await page.getByRole('button',{name:'Esci dalla scrittura immersiva',exact:true}).click();await expect(page.getByRole('button',{name:'Oggetti',exact:true})).toBeVisible();
});

test('immersive offline writing preserves strokes through reload and explicit server confirmation',async({page,context})=>{
 await page.setViewportSize({width:1024,height:768});await page.goto('/');
 await page.getByRole('button',{name:'Impostazioni',exact:true}).click();await page.getByRole('button',{name:'Rendi disponibile offline',exact:true}).click();await expect(page.getByRole('button',{name:'Usa copia offline',exact:true})).toBeVisible();
 await context.setOffline(true);await page.getByRole('button',{name:'Usa copia offline',exact:true}).click();
 await page.getByRole('button',{name:'Scrittura immersiva',exact:true}).click();expect((await area(page)).net).toBeGreaterThan(.9);
 await expect(page.getByRole('button',{name:'Ricollegati al server',exact:true})).toBeHidden();
 await expect(page.getByRole('button',{name:'Chiudi ed esci',exact:true})).toBeHidden();
 await page.getByRole('button',{name:'Esci dalla scrittura immersiva',exact:true}).focus();
 for(let index=0;index<16;index++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement===document.body||!!document.activeElement?.closest('.writing-immersive'))).toBe(true);}
 await pen(page,'down');await pen(page,'up');await expect(page.locator('.writing-status')).toContainText('1 modifiche da confermare');
 await page.reload();await expect(page.getByText('Il tuo spazio offline',{exact:true})).toBeVisible();await expect(page.locator('.pending-ink')).toHaveCount(1);expect(await inks(page)).toEqual([]);
 await page.getByRole('button',{name:'Scrittura immersiva',exact:true}).click();await pen(page,'down');await pen(page,'up');await expect(page.locator('.writing-status')).toContainText('2 modifiche da confermare');
 await page.getByRole('button',{name:'Esci dalla scrittura immersiva',exact:true}).click();await context.setOffline(false);await page.getByRole('button',{name:'Ricollegati al server',exact:true}).click();
 await page.getByRole('button',{name:'Riprendi modifica non inviata',exact:true}).filter({visible:true}).first().click();await expect.poll(async()=>(await inks(page)).length).toBe(1);
 await page.getByRole('button',{name:'Riprendi modifica non inviata',exact:true}).click();await expect.poll(async()=>(await inks(page)).length).toBe(2);
 expect(new Set((await inks(page)).map(object=>object.id)).size).toBe(2);
});
