import {test, expect, type Page} from '@playwright/test';

const storageKey = 'ardesia-next.core.v1';
async function addSpring(page: Page) {
  await page.goto('/');
  await page.getByRole('button', {name:'Apri moduli', exact:true}).click();
  await page.getByRole('button', {name:'Aggiungi molla alla lezione', exact:true}).click();
  await expect(page.getByRole('complementary', {name:'Proprietà del laboratorio'})).toHaveAttribute('data-plugin-status', 'ready');
}
async function storedLab(page: Page) {
  return page.evaluate(key => {
    const snapshot = JSON.parse(localStorage.getItem(key)!);
    for (const document of snapshot.documents) {
      const lab = document.objects.find((object: {type:string}) => object.type === 'lab');
      if (lab) return {lab, documentRevision: document.revision, events: snapshot.events.length};
    }
    throw Error('No stored laboratory');
  }, storageKey);
}
async function expectNoLaboratory(page: Page) {
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).documents.flatMap((document: {objects:Array<{type:string}>}) => document.objects).some((object: {type:string}) => object.type === 'lab'), storageKey)).toBe(false);
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
  await expect(page.getByRole('status')).toContainText('Salvato');
  await expect(inspector.getByLabel('Massa (kg)', {exact:true})).toHaveValue('4');
  await expect(inspector.locator('.science-metrics div').filter({hasText:'Periodo'})).toContainText('2,8099');
  const saved = await storedLab(page);
  expect(saved.lab.id).toBe(initial.lab.id);
  expect(saved.lab.data.instanceId).toBe(initial.lab.data.instanceId);
  expect(saved.lab.data.bundleDigest).toBe(initial.lab.data.bundleDigest);
  expect(saved.lab.revision).toBe(2);
  expect(saved.lab.data.state.value.massKg).toBe(4);
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
    await page.getByRole('button', {name:'Apri moduli', exact:true}).click();
    await page.getByRole('button', {name:'Aggiungi molla alla lezione', exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('non ha superato la verifica');
    await expectNoLaboratory(page);
    expect(workers).toBe(0);
  });
}

for (const incompatible of [true, false]) {
  test(incompatible ? '[M1] incompatible saved state is preserved and refused' : '[M1] invalid scientific state is preserved and refused', async ({page}) => {
    await addSpring(page);
    await page.getByRole('button', {name:'Chiudi proprietà', exact:true}).click();
    const corrupted = await page.evaluate(({key, incompatible}) => {
      const snapshot = JSON.parse(localStorage.getItem(key)!);
      const lab = snapshot.documents.flatMap((document: {objects: Array<{type:string}>}) => document.objects).find((object: {type:string}) => object.type === 'lab');
      if (incompatible) {lab.data.stateSchemaVersion='2.0.0';lab.data.state.schemaVersion='2.0.0';}
      else lab.data.state.value.massKg = -1;
      const bytes = JSON.stringify(snapshot);localStorage.setItem(key,bytes);return bytes;
    }, {key:storageKey, incompatible});
    await page.reload();
    await page.getByRole('button', {name:'Apri Molla ideale', exact:true}).click();
    const inspector = page.getByRole('complementary', {name:'Proprietà del laboratorio'});
    await expect(inspector).toHaveAttribute('data-plugin-status','error');
    await expect(inspector).toHaveAttribute('data-error-code', incompatible ? 'INCOMPATIBLE_STATE' : 'INVALID_STATE');
    await expect(inspector.getByRole('button', {name:'Salva laboratorio', exact:true})).toBeDisabled();
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(corrupted);
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
  await expect(page.getByRole('status')).toContainText('Salvato');
  expect((await storedLab(page)).lab.data.state.value.massKg).toBe(2);
  expect((await storedLab(page)).lab.revision).toBe(2);
});
