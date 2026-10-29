import type {Page} from '@playwright/test';
import {test, expect, mutateReadProjection} from './fixtures';
import {addMarketplaceSpring, openMarketplace, storedWorkspace} from './marketplace-helpers';

async function addSpring(page: Page) {
  await addMarketplaceSpring(page);
}
async function storedLab(page: Page) {
  const projection = await storedWorkspace(page);
  for (const document of projection.documents) {
    const lab = document.objects.find(object => object.type === 'lab');
    if (lab) return {lab, documentRevision: document.revision, events: projection.events.length};
  }
  throw new Error('No laboratory persisted through the remote Core.');
}
async function expectNoLaboratory(page: Page) {
  const projection = await storedWorkspace(page);
  expect(projection.documents.flatMap(document => document.objects).some(object => object.type === 'lab')).toBe(false);
}

test('[M1] verified spring edits and reopens through Core', async ({page}, testInfo) => {
  const errors: string[] = [], workers: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('worker', worker => workers.push(worker.url()));
  await addSpring(page);
  const initial = await storedLab(page);
  const inspector = page.getByRole('complementary', {name:'Proprietà del laboratorio'});
  await expect(inspector.getByLabel('Massa (kg)', {exact:true})).toHaveValue('1');
  await expect(inspector.locator('.science-metrics div').filter({hasText:'Energia totale'})).toContainText('0,4');
  await inspector.getByLabel('Massa (kg)', {exact:true}).fill('4');
  // One click must evaluate and save even when the number field still has focus.
  await inspector.getByRole('button', {name:'Salva laboratorio', exact:true}).click();
  await expect(page.locator('.app-footer [role="status"]')).toContainText('Confermato dal server');
  await expect(inspector.getByLabel('Massa (kg)', {exact:true})).toHaveValue('4');
  await expect(inspector.locator('.science-metrics div').filter({hasText:'Periodo'})).toContainText('2,8099');
  const saved = await storedLab(page);
  expect(saved.lab.id).toBe(initial.lab.id);
  expect(saved.lab.data.instanceId).toBe(initial.lab.data.instanceId);
  expect(saved.lab.data.bundleDigest).toBe(initial.lab.data.bundleDigest);
  expect(saved.lab.revision).toBe(2);
  expect(saved.lab.data.state.value).toMatchObject({massKg: 4});
  expect(saved.lab.status).toBe('draft');
  await page.getByRole('button', {name:'Chiudi proprietà', exact:true}).click();
  await page.getByRole('button', {name:'Lezione', exact:true}).click();
  const lessonObject = page.locator(`.reading-object[data-object-id="${saved.lab.id}"]`);
  await expect(lessonObject.locator('.lab-content')).toHaveAttribute('data-plugin-status','ready');
  await expect(lessonObject).toContainText('2,8099');
  await page.reload();
  await page.getByRole('button', {name:'Apri Molla ideale', exact:true}).click();
  await expect(page.getByLabel('Massa (kg)', {exact:true})).toHaveValue('4');
  const reopened = await storedLab(page);
  expect(reopened).toEqual(saved);
  expect(workers.length).toBeGreaterThanOrEqual(3);
  expect(workers.every(url => url.startsWith('blob:'))).toBe(true);
  await page.getByRole('button', {name:'Chiudi proprietà', exact:true}).click();
  await page.getByRole('button', {name:'Lezione', exact:true}).click();
  await page.locator('.reading-object.type-lab h3').scrollIntoViewIfNeeded();
  await expect(page.locator('.reading-object.type-lab .lab-content')).toHaveAttribute('data-plugin-status','ready');
  await page.screenshot({path:`artifacts/${testInfo.project.name}-m1-spring.png`, fullPage:true});
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const mutation of ['bundle','signature','capability'] as const) {
  const titles = {bundle:'[M1] tampered bundle never starts a worker', signature:'[M1] tampered signature never starts a worker', capability:'[M1] disallowed capability never starts a worker'};
  test(titles[mutation], async ({page}) => {
    let workers = 0;
    page.on('worker', () => {workers += 1;});
    const path = mutation === 'bundle' ? '**/plugins/ideal-spring/1.0.0/plugin.js' : '**/plugins/ideal-spring/1.0.0/manifest.json';
    await page.route(path, async route => {
      const response = await route.fetch();
      if (mutation === 'bundle') await route.fulfill({response, body:(await response.text())+'\n/* altered bytes */'});
      else {
        const manifest = await response.json();
        if (mutation === 'signature') manifest.signature.value = 'A'.repeat(86)+'==';
        else manifest.capabilities.push('objects:read');
        await route.fulfill({response, json:manifest});
      }
    });
    await page.goto('/');
    await openMarketplace(page);
    await page.getByRole('button', {name:'Verifica Molla ideale', exact:true}).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('non ha superato la verifica');
    await expectNoLaboratory(page);
    expect(workers).toBe(0);
  });
}

for (const incompatible of [true, false]) {
  test(incompatible ? '[M1] incompatible saved state is preserved and refused' : '[M1] invalid scientific state is preserved and refused', async ({page}) => {
    await addSpring(page);
    await page.getByRole('button', {name:'Chiudi proprietà', exact:true}).click();
    const confirmed = await storedWorkspace(page);
    const intercepted = await mutateReadProjection(page, projection => {
      const object = projection.documents.flatMap(document => document.objects).find(object => object.type === 'lab');
      if (object?.type !== 'lab') throw new Error('Missing persisted laboratory in the actual server response.');
      if (incompatible) {object.data.stateSchemaVersion = '2.0.0'; object.data.state.schemaVersion = '2.0.0';}
      else object.data.state.value = {...object.data.state.value as {massKg: number}, massKg: -1};
    });
    await page.reload();
    await page.getByRole('button', {name:'Apri Molla ideale', exact:true}).click();
    const inspector = page.getByRole('complementary', {name:'Proprietà del laboratorio'});
    await expect(inspector).toHaveAttribute('data-plugin-status','error');
    await expect(inspector).toHaveAttribute('data-error-code', incompatible ? 'INCOMPATIBLE_STATE' : 'INVALID_STATE');
    await expect(inspector.getByRole('button', {name:'Salva laboratorio', exact:true})).toBeDisabled();
    expect(intercepted()).toBeGreaterThan(0);
    expect(await storedWorkspace(page)).toEqual(confirmed);
  });
}

test('[M1] rejected parameters preserve the saved experiment', async ({page}) => {
  await addSpring(page);
  const before = await storedLab(page);
  const inspector = page.getByRole('complementary', {name:'Proprietà del laboratorio'});
  await inspector.getByLabel('Massa (kg)', {exact:true}).fill('0');
  await inspector.getByRole('button', {name:'Aggiorna grafico', exact:true}).click();
  await expect(inspector.getByRole('alert')).toContainText('non ha accettato');
  expect(await storedLab(page)).toEqual(before);
  await inspector.getByLabel('Massa (kg)', {exact:true}).fill('2');
  await inspector.getByRole('button', {name:'Aggiorna grafico', exact:true}).click();
  await expect(inspector).toHaveAttribute('data-plugin-status','ready');
  await expect(inspector.locator('.science-metrics div').filter({hasText:'Periodo'})).toContainText('1,9869');
  expect(await storedLab(page)).toEqual(before);
  await inspector.getByRole('button', {name:'Salva laboratorio', exact:true}).click();
  await expect(page.locator('.app-footer [role="status"]')).toContainText('Confermato dal server');
  expect((await storedLab(page)).lab.data.state.value).toMatchObject({massKg: 2});
  expect((await storedLab(page)).lab.revision).toBe(2);
});
