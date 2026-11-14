import {test, expect, personalProjection, selectedWorkspace, api, loginContext, type TestWorkspace} from './fixtures';
import type {Page} from '@playwright/test';

async function prepare(page: Page) {
  await page.goto('/');
  await page.getByRole('button', {name: 'Impostazioni', exact: true}).click();
  await page.getByRole('button', {name: 'Rendi disponibile offline', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Usa copia offline', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Chiudi finestra', exact: true}).click();
}
async function openOffline(page: Page) {
  await page.getByRole('button', {name: 'Impostazioni', exact: true}).click();
  await page.getByRole('button', {name: 'Usa copia offline', exact: true}).click();
  await expect(page.getByText('Il tuo spazio offline', {exact: true})).toBeVisible();
}
async function draw(page: Page, offset = 0) {
  const surface = page.locator('.board-surface'); await surface.scrollIntoViewIfNeeded();
  const box = (await surface.boundingBox())!;
  await page.mouse.move(box.x + box.width * .15, box.y + box.height * .55 + offset); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .4, box.y + box.height * .6 + offset, {steps: 8}); await page.mouse.up();
}
async function recovery(page: Page) {
  return page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('ardesia-next.pending.v1.') && key.includes('/'))
    .map(key => JSON.parse(localStorage.getItem(key)!)).filter(row => row.request).sort((a, b) => a.commandId.localeCompare(b.commandId))
    .map(({commandId, request, edit, createdAt}) => ({commandId, request, edit, createdAt})));
}

test('cold offline shell preserves original ink commands across page closure and confirms them explicitly after reconnect', async ({page, context}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await prepare(page); const original = await personalProjection(page);
  let sends = 0;
  context.on('request', request => {if (request.method() === 'POST' && request.postDataJSON()?.action === 'command') sends++;});
  await context.setOffline(true); await openOffline(page);
  await draw(page); await draw(page, 30); await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(2);
  const retained = await recovery(page); expect(retained).toHaveLength(2); expect(sends).toBe(0);
  const reopened = await context.newPage(); reopened.on('pageerror', error => errors.push(error.message)); await page.close();
  await reopened.goto('/'); await expect(reopened.getByText('Il tuo spazio offline', {exact: true})).toBeVisible();
  await expect(reopened.getByLabel('Tratto in attesa di conferma')).toHaveCount(2); expect(await recovery(reopened)).toEqual(retained);
  await expect(reopened.getByRole('button', {name: 'Aggiungi nota', exact: true})).toHaveCount(0);
  await expect(reopened.getByText('nessuna sessione online attiva', {exact: false})).toBeVisible();
  const cachedUrls = await reopened.evaluate(async () => (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)))).flat());
  expect(cachedUrls).toContain('/'); expect(cachedUrls.some(path => path.startsWith('/api') || path.startsWith('/plugins'))).toBe(false);
  await reopened.screenshot({path: 'artifacts/' + test.info().project.name + '-offline-ink.png', fullPage: true});
  await context.setOffline(false);
  expect((await personalProjection(reopened)).documents).toEqual(original.documents); expect(sends).toBe(0);
  await reopened.getByRole('button', {name: 'Ricollegati al server', exact: true}).click();
  const resume = reopened.getByRole('button', {name: 'Riprendi modifica non inviata', exact: true});
  await expect(resume).toHaveCount(2); expect(sends).toBe(0); await resume.first().click();
  await expect(resume).toHaveCount(1); await expect(resume).toBeEnabled(); await resume.click();
  await expect(reopened.getByLabel('Tratto in attesa di conferma')).toHaveCount(0);
  const confirmed = await personalProjection(reopened), document = confirmed.documents.find(d => d.id === selectedWorkspace(reopened).documentId)!;
  const inputs = retained.map(row => row.request.command.object);
  for (const input of inputs) expect(document.objects.find(object => object.id === input.id)).toMatchObject(input);
  expect(document.revision).toBe(original.documents.find(d => d.id === document.id)!.revision + 2); expect(sends).toBe(2);
  await reopened.reload(); expect((await personalProjection(reopened)).documents).toEqual(confirmed.documents); expect(errors).toEqual([]);
});

test('offline logout closes a second tab and cold reload without deleting isolated recovery', async ({page, context}) => {
  await prepare(page); await context.setOffline(true); await openOffline(page);
  await draw(page); await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(1); const retained = await recovery(page);
  const other = await context.newPage(); await other.goto('/'); await expect(other.getByText('Il tuo spazio offline', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Chiudi ed esci', exact: true}).click();
  await expect(other.getByRole('heading', {name: 'Il tuo spazio', exact: true})).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', {name: 'Il tuo spazio', exact: true})).toBeVisible();
  await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(0); expect(await recovery(page)).toEqual(retained);
  await other.close();
});

test('observed session revocation prevents cached login fallback and never caches API responses', async ({page, context}) => {
  await prepare(page); const current = selectedWorkspace(page);
  // Revoke a token owned by this case, not the worker's shared fixture login.
  await context.clearCookies({name: 'ardesia_dev_session'});
  await loginContext(context, 'TEACHER', test.info().project.name);
  await api(context.request, {action: 'logout'}, current.account.id);
  await page.reload(); await expect(page.getByRole('heading', {name: 'Il tuo spazio', exact: true})).toBeVisible();
  await context.setOffline(true); await page.reload();
  await expect(page.getByRole('heading', {name: 'Il tuo spazio', exact: true})).toBeVisible();
  await expect(page.getByText('Il tuo spazio offline', {exact: true})).toHaveCount(0);
});

test('an incompatible offline copy is preserved and refused on cold startup', async ({page, context}) => {
  await prepare(page); const current = selectedWorkspace(page);
  const access = async (page: Page, current: TestWorkspace, corrupt: boolean) => page.evaluate(async ({accountId, workspaceId, corrupt}) => {
    return new Promise(resolve => {
      const request = indexedDB.open('ardesia-next.offline.v1', 1);
      request.onsuccess = () => {const db = request.result, tx = db.transaction('local', 'readwrite'), store = tx.objectStore('local');
        const key = ['snapshot', accountId, workspaceId]; let result: unknown;
        if (corrupt) store.put({format: 'future-version', original: 'preserve-fixture'}, key);
        else {const value = store.get(key); value.onsuccess = () => {result = value.result;};}
        tx.oncomplete = () => {db.close(); resolve(result);};
      };
    });
  }, {accountId: current.account.id, workspaceId: current.workspaceId, corrupt});
  await access(page, current, true); await context.setOffline(true); await page.reload();
  await expect(page.getByRole('heading', {name: 'Il tuo spazio', exact: true})).toBeVisible();
  expect(await access(page, current, false)).toEqual({format: 'future-version', original: 'preserve-fixture'});
});


test('a disconnected editor retains its draft and guards the explicit offline transition', async ({page, context}) => {
  await prepare(page);
  await page.getByRole('button', {name: 'Aggiungi nota', exact: true}).click();
  const text = page.getByRole('textbox', {name: 'Testo nota', exact: true});
  await text.fill('Bozza personale da conservare dopo la perdita di rete');
  await context.setOffline(true);
  await expect(text).toHaveValue('Bozza personale da conservare dopo la perdita di rete');
  await expect(page.getByText('Il tuo spazio offline', {exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Impostazioni', exact: true}).click();
  await page.getByRole('button', {name: 'Usa copia offline', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Hai modifiche da salvare'})).toBeVisible();
  await page.getByRole('button', {name: 'Continua a modificare', exact: true}).click();
  await page.getByRole('button', {name: 'Chiudi finestra', exact: true}).click();
  await expect(text).toHaveValue('Bozza personale da conservare dopo la perdita di rete');
  await context.setOffline(false);
  await page.getByRole('button', {name: 'Salva modifiche', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Salva modifiche', exact: true})).toBeDisabled();
  await openOffline(page);
  await expect(page.locator('.note-text').filter({hasText: 'Bozza personale da conservare dopo la perdita di rete'})).toBeVisible();
});

test('input stays frozen while an explicit offline transition waits for IndexedDB', async ({page}) => {
  await prepare(page);
  await page.getByRole('button', {name: 'Aggiungi nota', exact: true}).click();
  await expect(page.getByRole('textbox', {name: 'Testo nota', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Impostazioni', exact: true}).click();
  // A real transaction in another connection delays the copy's read transaction.
  await page.evaluate(async () => new Promise<void>(resolve => {
    const globals = window as typeof window & {releaseOfflineTransaction?: boolean};
    globals.releaseOfflineTransaction = false;
    const request = indexedDB.open('ardesia-next.offline.v1', 1);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('local', 'readwrite'), store = tx.objectStore('local');
      function hold() {store.get('gate').onsuccess = () => {if (!globals.releaseOfflineTransaction) hold();};}
      tx.oncomplete = () => db.close(); hold(); resolve();
    };
  }));
  await page.getByRole('button', {name: 'Usa copia offline', exact: true}).click();
  await expect(page.locator('.app-shell')).toHaveAttribute('inert', '');
  expect(await page.getByRole('textbox', {name: 'Testo nota', exact: true, includeHidden: true}).evaluate(element => {
    (element as HTMLTextAreaElement).focus(); return document.activeElement === element;
  })).toBe(false);
  await page.evaluate(() => { (window as typeof window & {releaseOfflineTransaction?: boolean}).releaseOfflineTransaction = true; });
  await expect(page.getByText('Il tuo spazio offline', {exact: true})).toBeVisible();
});

test('discard before a failed offline transition resets the editor and protects subsequent drafts', async ({page}) => {
  await prepare(page);
  await page.getByRole('button', {name: 'Aggiungi nota', exact: true}).click();
  const text = page.getByRole('textbox', {name: 'Testo nota', exact: true}); await text.fill('Da scartare esplicitamente');
  const current = selectedWorkspace(page);
  await page.evaluate(async ({accountId, workspaceId}) => new Promise<void>(resolve => {
    const request = indexedDB.open('ardesia-next.offline.v1', 1);
    request.onsuccess = () => {const db = request.result, tx = db.transaction('local', 'readwrite');
      tx.objectStore('local').put({format: 'future-version'}, ['snapshot', accountId, workspaceId]);
      tx.oncomplete = () => {db.close(); resolve();};};
  }), {accountId: current.account.id, workspaceId: current.workspaceId});
  await page.getByRole('button', {name: 'Impostazioni', exact: true}).click();
  await page.getByRole('button', {name: 'Usa copia offline', exact: true}).click();
  await page.getByRole('button', {name: 'Scarta modifiche', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Usa copia offline', exact: true})).toBeEnabled();
  await page.getByRole('button', {name: 'Chiudi finestra', exact: true}).click();
  await expect(text).toHaveValue(''); await text.fill('Nuova bozza da proteggere');
  await page.getByRole('button', {name: 'Account e spazi', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Hai modifiche da salvare'})).toBeVisible();
  await page.getByRole('button', {name: 'Continua a modificare', exact: true}).click();
  await expect(text).toHaveValue('Nuova bozza da proteggere');
});

test('offline navigation waits for the pen and reconnect freezes the board until the real session response arrives', async ({page}) => {
  await prepare(page); await openOffline(page);
  const surface = page.locator('.board-surface'); await surface.scrollIntoViewIfNeeded(); const box = (await surface.boundingBox())!;
  await page.mouse.move(box.x + box.width * .15, box.y + box.height * .6); await page.mouse.down();
  await expect(page.getByRole('button', {name: 'Ricollegati al server', exact: true})).toBeDisabled();
  await expect(page.getByRole('button', {name: 'Chiudi ed esci', exact: true})).toBeDisabled();
  await page.mouse.move(box.x + box.width * .3, box.y + box.height * .6); await page.mouse.up();
  await expect(page.getByLabel('Tratto in attesa di conferma')).toHaveCount(1); const retained = await recovery(page);
  let release!: () => void, requested = false;
  const hold = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/m3', async route => {
    if (route.request().method() !== 'POST' || route.request().postDataJSON()?.action !== 'session') return route.continue();
    const response = await route.fetch(); requested = true; await hold; await route.fulfill({response});
  });
  await page.getByRole('button', {name: 'Ricollegati al server', exact: true}).click();
  await expect.poll(() => requested).toBe(true); await expect(page.locator('.offline-workspace')).toHaveAttribute('inert', '');
  await draw(page); expect(await recovery(page)).toEqual(retained);
  release(); await expect(page.getByRole('button', {name: 'Riprendi modifica non inviata', exact: true})).toHaveCount(1);
  expect(await recovery(page)).toEqual(retained);
});
