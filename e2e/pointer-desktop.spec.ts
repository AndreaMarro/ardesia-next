import {test, expect} from './fixtures';

test('keyboard selection and drawing are serialized as real objects', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Apri Il pendolo semplice',exact:true}).focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(page.locator('.app-footer [role="status"]')).toContainText('Confermato dal server');
  await page.getByRole('button',{name:'Penna',exact:true}).click();
  const surface=await page.locator('.board-surface').boundingBox();
  if(!surface) throw new Error('Missing drawing surface');
  await page.mouse.move(surface.x+100,surface.y+430); await page.mouse.down();
  await page.mouse.move(surface.x+220,surface.y+460,{steps:10}); await page.mouse.up();
  await page.getByRole('button',{name:'Seleziona oggetti',exact:true}).click();
  await expect(page.getByRole('button',{name:'Apri Annotazione a penna',exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'Apri Annotazione a penna',exact:true})).toBeVisible();
});
