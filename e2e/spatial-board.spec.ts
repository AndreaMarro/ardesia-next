import {test,expect,personalProjection} from './fixtures';

async function inks(page:Parameters<typeof personalProjection>[0]) {return (await personalProjection(page)).documents.flatMap(d=>d.objects).filter(o=>o.type==='ink');}

test('pan and anchored zoom preserve saved coordinates, selection and horizontal ink on reload',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Apri Che cosa cambia il periodo?',exact:true}).click();
  await expect(page.getByLabel('Testo nota')).toBeVisible();
  await page.getByRole('button',{name:'Chiudi proprietà'}).click();
  const before=(await personalProjection(page)).documents[0]!.objects;
  const surface=page.locator('.board-surface');
  const cameraX=await surface.locator('.board-world').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).e);
  await surface.focus();await page.keyboard.press('ArrowRight');
  expect(await surface.locator('.board-world').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).e)).toBeCloseTo(cameraX-80);
  expect((await personalProjection(page)).documents[0]!.objects).toEqual(before);
  await page.getByRole('button',{name:'Aumenta zoom',exact:true}).click();
  await page.getByRole('button',{name:'Sposta lavagna',exact:true}).click();
  const box=(await page.locator('.board-surface').boundingBox())!;
  await page.mouse.move(box.x+60,box.y+160);await page.mouse.down();await page.mouse.move(box.x+250,box.y+210,{steps:8});await page.mouse.up();
  expect((await personalProjection(page)).documents[0]!.objects).toEqual(before);
  await page.getByRole('button',{name:'Penna',exact:true}).click();
  await page.mouse.move(box.x+70,box.y+210);await page.mouse.down();await page.mouse.move(box.x+250,box.y+210,{steps:15});await page.mouse.up();
  await expect.poll(async()=> (await inks(page)).length).toBe(1);
  const saved=(await inks(page))[0]!;
  await page.reload();await page.getByRole('button',{name:'Inquadra tutto',exact:true}).click();
  const rendered=page.getByTestId(`object-${saved.id}`).locator('.ink-content');
  await expect(rendered).toBeVisible();expect((await rendered.boundingBox())!.height).toBeGreaterThan(0);
  expect((await inks(page))[0]).toEqual(saved);
  await page.getByRole('button',{name:'Penna',exact:true}).click();
  const current=(await page.locator('.board-surface').boundingBox())!;
  // The floating navigation occupies the first 70px of the canvas viewport.
  await page.mouse.click(current.x+180,current.y+300);
  await expect.poll(async()=> (await inks(page)).length).toBe(2);
  const dot=(await inks(page)).find(o=>o.id!==saved.id)!;
  const dotButton=page.getByTestId(`object-${dot.id}`);
  const target=await dotButton.evaluate(el=>{
    const css=getComputedStyle(el,'::after'),zoom=new DOMMatrix(getComputedStyle(el.parentElement!).transform).a;
    return {width:parseFloat(css.width)*zoom,height:parseFloat(css.height)*zoom};
  });
  expect(target.width).toBeGreaterThanOrEqual(43.9);expect(target.height).toBeGreaterThanOrEqual(43.9);
  await page.getByRole('button',{name:'Seleziona oggetti',exact:true}).click();
  await dotButton.focus();await page.keyboard.press('Enter');await expect(dotButton).toHaveAttribute('aria-pressed','true');
});

test('pressure, coalesced samples, palm-first preemption and cancellation retain only the pen stroke',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Penna',exact:true}).click();
  await page.locator('.board-surface').evaluate(el=>{
    const r=el.getBoundingClientRect();
    // Synthetic PointerEvents test dispatch/pressure, not physical Apple Pencil latency.
    const capture=el.setPointerCapture.bind(el);el.setPointerCapture=()=>{};
    const event=(type:string,id:number,pointerType:string,x:number,y:number,pressure:number)=>new PointerEvent(type,{bubbles:true,pointerId:id,pointerType,button:0,buttons:1,clientX:r.x+x,clientY:r.y+y,pressure});
    el.dispatchEvent(event('pointerdown',1,'touch',100,170,.5));
    el.dispatchEvent(event('pointerdown',2,'pen',120,170,.2));
    const move=event('pointermove',2,'pen',200,200,.8);
    Object.defineProperty(move,'getCoalescedEvents',{value:()=>[event('pointermove',2,'pen',150,180,.4),move]});el.dispatchEvent(move);
    el.dispatchEvent(event('pointerup',1,'touch',600,400,.5));
    el.dispatchEvent(event('pointercancel',2,'pen',200,200,0));el.setPointerCapture=capture;
  });
  await expect.poll(async()=> (await inks(page)).length).toBe(1);
  const stroke=(await inks(page))[0]!;expect(stroke.data.points).toHaveLength(3);[.2,.4,.8].forEach((value,i)=>expect(stroke.data.points[i]!.pressure).toBeCloseTo(value,6));
  expect(stroke.data.points.at(-1)!.x-stroke.data.points[0]!.x).toBeCloseTo(80/Number(await page.locator('.board-world').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a)));
  await page.reload();expect((await inks(page))[0]).toEqual(stroke);
});

test('pinch after single-touch movement keeps the current anchor and creates no ink',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Penna',exact:true}).click();
  const before=await page.locator('.board-world').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a);
  await page.locator('.board-surface').evaluate(el=>{
    const r=el.getBoundingClientRect();el.setPointerCapture=()=>{};
    const send=(type:string,id:number,x:number)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',button:0,buttons:1,clientX:r.x+x,clientY:r.y+160}));
    send('pointerdown',1,100);send('pointermove',1,200);send('pointerdown',2,300);send('pointermove',1,210);send('pointerup',1,210);send('pointerup',2,300);
  });
  expect(await page.locator('.board-world').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).a)).toBeCloseTo(before*.9,4);
  expect(await inks(page)).toEqual([]);
});

test('lost network keeps visible account-scoped ink, reload and explicit retry preserve the same object',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Penna',exact:true}).click();
  await page.route('**/api/m3',async route=>{
    const b=route.request().postDataJSON();if(b?.action==='command'&&b.command?.kind==='add-object'&&b.command.object.type==='ink')await route.abort();else await route.continue();
  });
  const box=(await page.locator('.board-surface').boundingBox())!;
  await page.mouse.move(box.x+70,box.y+200);await page.mouse.down();await page.mouse.move(box.x+230,box.y+230,{steps:8});await page.mouse.up();
  await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(1);
  expect(await inks(page)).toEqual([]);
  await page.reload();await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(1);
  const pending=await page.getByLabel('Tratto in attesa di conferma').getAttribute('data-testid');
  await page.unroute('**/api/m3');await page.getByRole('button',{name:'Verifica e ritenta',exact:true}).click();
  await expect.poll(async()=> (await inks(page)).length).toBe(1);
  expect(pending).toBe(`pending-ink-${(await inks(page))[0]!.id}`);
  await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(0);
  await page.reload();expect((await inks(page)).length).toBe(1);
});


test('new cards reserve their position until acknowledgement and avoid the rendered tail of long notes',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Nuova lezione',exact:true}).click();
  await page.getByLabel('Titolo nuova lezione',{exact:true}).fill('Appunti estesi');
  await page.getByRole('button',{name:'Crea lezione',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Appunti estesi',exact:true})).toBeVisible();
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/m3',async route=>{
    const b=route.request().postDataJSON();if(b?.action==='command'&&b.command?.kind==='add-object'&&b.command.object.type==='note')await held;
    await route.continue();
  });
  try {
    await page.getByRole('button',{name:'Aggiungi nota',exact:true}).click();
    await expect(page.getByRole('button',{name:'Aggiungi formula',exact:true})).toBeDisabled();
    await expect(page.getByRole('button',{name:'Aggiungi nota',exact:true})).toBeDisabled();
  } finally {release();}
  await expect(page.getByLabel('Testo nota',{exact:true})).toBeVisible();
  await page.unroute('**/api/m3');
  await page.getByLabel('Testo nota',{exact:true}).fill('Una osservazione lunga da conservare nella lezione.\n'.repeat(80));
  await page.getByRole('button',{name:'Salva modifiche',exact:true}).click();
  await expect(page.getByRole('button',{name:'Salva modifiche',exact:true})).toBeDisabled();
  await expect(page.getByLabel('Testo nota',{exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Chiudi proprietà',exact:true}).click();
  await page.locator('.board-surface').focus();await page.keyboard.press('PageDown');
  await page.getByRole('button',{name:'Aggiungi formula',exact:true}).click();
  await expect(page.getByLabel('Formula LaTeX',{exact:true})).toBeVisible();
  const objects=(await personalProjection(page)).documents.find(d=>d.title==='Appunti estesi')!.objects;
  const note=objects.find(o=>o.title==='Nuova nota')!,formula=objects.find(o=>o.title==='Nuova formula')!;
  expect(note).toBeTruthy();expect(formula).toBeTruthy();
  // The requested position is below the stored height but inside the rendered text.
  expect(formula.y).toBeGreaterThan(note.y+note.height);
  expect(formula.x).toBeGreaterThanOrEqual(note.x+note.width+24);
  await page.reload();expect((await personalProjection(page)).documents.find(d=>d.title==='Appunti estesi')!.objects).toEqual(objects);
});
