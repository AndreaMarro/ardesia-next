import {test,expect} from './fixtures';

test('a queued close from a removed dialog preserves the new Creator and its draft guards',async({page},info)=>{
  await page.goto('/');
  const creator=page.getByRole('dialog',{name:'Crea un oggetto',exact:true});
  await page.getByRole('button',{name:'Crea un oggetto',exact:true}).click();
  await expect(creator).toBeVisible();
  await creator.evaluate(element=>{
    // Observe and suppress the native cleanup event, then simulate its late
    // delivery after reopening, without changing the parent callbacks.
    let released=false;
    const audit={element,held:0,release:()=>{released=true;element.dispatchEvent(new Event('close'));}};
    element.addEventListener('close',event=>{if(!released){event.stopImmediatePropagation();audit.held++;}},true);
    Object.assign(window,{creatorCloseAudit:audit});
  });
  await creator.getByRole('button',{name:'Chiudi finestra',exact:true}).click();
  await expect(creator).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {creatorCloseAudit:{held:number}}).creatorCloseAudit.held)).toBe(1);
  expect(await page.evaluate(()=>(window as unknown as {creatorCloseAudit:{element:HTMLElement}}).creatorCloseAudit.element.isConnected)).toBe(false);
  await page.getByRole('button',{name:'Crea un oggetto',exact:true}).click();
  await expect(creator).toBeVisible();
  await expect(creator).toHaveJSProperty('open',true);
  await creator.getByLabel('Nome del tipo',{exact:true}).fill('Nuovo oggetto da conservare');
  await page.evaluate(()=>(window as unknown as {creatorCloseAudit:{release:()=>void}}).creatorCloseAudit.release());
  await expect(creator).toBeVisible();
  await expect(creator.getByLabel('Nome del tipo',{exact:true})).toHaveValue('Nuovo oggetto da conservare');
  await expect(page.locator('dialog')).toHaveCount(1);
  const guard=page.getByRole('dialog',{name:'Hai modifiche da salvare',exact:true});
  await expect(guard).toHaveCount(0);
  await page.screenshot({path:info.outputPath('replacement-draft-preserved.png')});
  // Escape and the explicit close button still use the dirty-draft decision.
  await page.keyboard.press('Escape');
  await expect(guard).toBeVisible();
  await guard.getByRole('button',{name:'Continua a modificare',exact:true}).click();
  await expect(creator.getByLabel('Nome del tipo',{exact:true})).toHaveValue('Nuovo oggetto da conservare');
  await creator.getByRole('button',{name:'Chiudi finestra',exact:true}).click();
  await guard.getByRole('button',{name:'Scarta modifiche',exact:true}).click();
  await expect(creator).toHaveCount(0);
  // A native close on the current, connected clean dialog is still effective.
  await page.getByRole('button',{name:'Crea un oggetto',exact:true}).click();
  await expect(creator).toBeVisible();
  await creator.evaluate(element=>(element as HTMLDialogElement).close());
  await expect(page.locator('dialog')).toHaveCount(0);
});
