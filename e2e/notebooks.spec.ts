import {createHash, randomUUID} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import type {Page} from '@playwright/test';
import {notebookPageSize, type NotebookCommand, type PageLayout} from '@ardesia/contracts';
import {test, expect, api, personalProjection, selectedWorkspace} from './fixtures';
import {pdfFixture} from './material-fixture';
import {syntheticMicrophone} from './audio-fixture';

const layout: PageLayout = {format: 'a4', orientation: 'portrait', background: 'ruled', paper: 'ivory'};
const library = (page: Page) => page.getByRole('dialog', {name: 'I miei quaderni', exact: true});
async function openLibrary(page: Page) {await page.getByRole('button', {name: 'Apri quaderni', exact: true}).click(); await expect(library(page)).toBeVisible();}
async function save(page: Page) {await library(page).getByRole('button', {name: 'Salva', exact: true}).click(); await expect(library(page).locator('.notebook-editor')).toHaveCount(0);}
async function createBook(page: Page, title: string) {
  await library(page).getByRole('button', {name: 'Nuovo quaderno', exact: true}).click();
  await library(page).getByLabel('Titolo', {exact: true}).fill(title); await save(page);
  await library(page).locator('.notebook-spine').filter({hasText: title}).click();
}
async function pageOptions(page: Page, title: string) {await library(page).getByLabel(`Opzioni pagina ${title}`, {exact: true}).click();}
async function seed(page: Page) {
  const w = selectedWorkspace(page), notebookId = randomUUID(), sectionId = randomUUID(), documentId = randomUUID(), pageId = randomUUID();
  async function execute(command: NotebookCommand) {return api(page.context().request, {action: 'notebook-command', workspaceId: w.workspaceId, command}, w.account.id);}
  await execute({kind: 'create-notebook', commandId: randomUUID(), expectedRevision: 0, notebookId, title: 'Fisica personale', sectionId, sectionTitle: 'Appunti', firstPage: {pageId, documentId, title: 'Forze', layout}});
  const secondId = randomUUID();
  await execute({kind: 'create-notebook-page', commandId: randomUUID(), expectedRevision: 1, sectionId, documentId: secondId, pageId: randomUUID(), title: 'Energia', layout: {...layout, format: 'a5', orientation: 'landscape', background: 'dots'}, beforeId: null});
  return {w, notebookId, sectionId, documentId, pageId, secondId};
}
async function openPage(page: Page, title: string) {await library(page).getByRole('button', {name: `Apri pagina ${title}`, exact: true}).click(); await expect(library(page)).toHaveCount(0); await expect(page.getByTestId('notebook-paper')).toBeVisible();}
async function draw(page: Page) {
  await page.locator('.board-surface').scrollIntoViewIfNeeded();
  // Settle the initial resize/fit before choosing the gesture's screen coordinates.
  await page.getByRole('button', {name: 'Inquadra pagina', exact: true}).click();
  // Clicking a navigation control may scroll that control into view on mobile.
  // Scroll the paper last, and assert that the entire sampled gesture is visible.
  await page.getByTestId('notebook-paper').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('notebook-paper')).toBeInViewport({ratio: .99});
  const box = (await page.getByTestId('notebook-paper').boundingBox())!;
  await page.mouse.move(box.x + box.width * .35, box.y + box.height * .35); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .65, box.y + box.height * .42, {steps: 8}); await page.mouse.up();
}

test('notebooks organize canonical pages with keyboard reorder, layout, archive and explicit attachment', async ({page}, info) => {
  test.setTimeout(60_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); const original = (await personalProjection(page)).documents;
  await openLibrary(page); await createBook(page, 'Meccanica');
  await library(page).getByRole('button', {name: 'Pagina', exact: true}).click(); await library(page).getByLabel('Titolo', {exact: true}).fill('Energia e lavoro'); await save(page);
  await pageOptions(page, 'Energia e lavoro');
  const move = library(page).getByRole('button', {name: 'Sposta pagina su', exact: true}); await move.focus(); await move.press('Enter');
  await expect(library(page).locator('.notebook-page-open').first()).toHaveAttribute('aria-label', 'Apri pagina Energia e lavoro');
  let projection = await personalProjection(page), space = projection.notebookSpace!;
  const book = space.notebooks[0]!, pages = book.sections[0]!.pages;
  expect(projection.documents.find(document => document.id === pages[0]!.documentId)!.title).toBe('Energia e lavoro');
  const pageId = pages[0]!.id, documentId = pages[0]!.documentId;
  await pageOptions(page, 'Energia e lavoro'); await library(page).getByRole('button', {name: 'Formato e sfondo', exact: true}).click();
  await library(page).getByRole('combobox', {name: 'Formato', exact: true}).selectOption('a5'); await library(page).getByRole('combobox', {name: 'Orientamento', exact: true}).selectOption('landscape');
  await library(page).getByRole('combobox', {name: 'Sfondo', exact: true}).selectOption('grid'); await save(page);
  await library(page).getByRole('button', {name: 'Sezione', exact: true}).click(); await library(page).getByLabel('Titolo', {exact: true}).fill('Problemi'); await save(page);
  await pageOptions(page, 'Energia e lavoro'); await library(page).getByRole('button', {name: 'Sposta in altra sezione', exact: true}).click();
  await library(page).getByRole('combobox', {name: 'Sezione di destinazione', exact: true}).selectOption({label: 'Meccanica / Problemi'}); await save(page);
  await library(page).getByRole('button', {name: 'Problemi', exact: true}).click();
  await pageOptions(page, 'Energia e lavoro'); await library(page).getByRole('button', {name: 'Archivia pagina', exact: true}).click();
  await expect(library(page).getByRole('button', {name: 'Apri pagina Energia e lavoro', exact: true})).toHaveCount(0);
  await library(page).getByLabel('Mostra archivio', {exact: true}).check(); await pageOptions(page, 'Energia e lavoro');
  await library(page).getByRole('button', {name: 'Ripristina pagina', exact: true}).click();
  await createBook(page, 'Termodinamica');
  await library(page).getByText('Organizza sezione', {exact: true}).click(); await library(page).getByRole('button', {name: 'Aggiungi lezione esistente', exact: true}).click();
  await library(page).getByRole('combobox', {name: 'Lezione', exact: true}).selectOption(original[0]!.id); await save(page);
  await expect(library(page).getByRole('button', {name: `Apri pagina ${original[0]!.title}`, exact: true})).toBeVisible();
  projection = await personalProjection(page); expect(projection.documents.find(document => document.id === original[0]!.id)).toEqual(original[0]);
  const attached = projection.notebookSpace!.notebooks[1]!.sections[0]!.pages.find(page => page.documentId === original[0]!.id)!; expect(attached).toBeDefined();
  await library(page).locator('.notebook-spine').filter({hasText: 'Meccanica'}).click(); await library(page).getByRole('button', {name: 'Problemi', exact: true}).click();
  await page.screenshot({path: info.outputPath('notebooks-library.png')});
  await openPage(page, 'Energia e lavoro'); await expect(page.getByTestId('notebook-paper')).toHaveAttribute('data-format', 'a5');
  await expect(page.getByTestId('notebook-paper')).toHaveAttribute('data-orientation', 'landscape');
  await page.reload(); await expect(page.getByTestId('notebook-paper')).toHaveAttribute('data-background', 'grid');
  const final = await personalProjection(page), found = final.notebookSpace!.notebooks[0]!.sections[1]!.pages[0]!;
  expect(found).toMatchObject({id: pageId, documentId, archived: false}); expect(final.documents.find(document => document.id === documentId)!.revision).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test('two notebook pages cold-open offline with their original paper and independently recoverable ink', async ({page, context}, info) => {
  const seeded = await seed(page); await page.goto('/'); await openLibrary(page); await openPage(page, 'Forze');
  await page.getByRole('button', {name: 'Impostazioni', exact: true}).click(); await page.getByRole('button', {name: 'Rendi disponibile offline', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Usa copia offline', exact: true})).toBeVisible();
  await context.setOffline(true); await page.getByRole('button', {name: 'Usa copia offline', exact: true}).click();
  await page.getByRole('button', {name: 'Apri quaderni offline', exact: true}).click(); await openPage(page, 'Forze');
  await draw(page); await expect(page.getByLabel('Tratto in attesa di conferma', {exact: true})).toHaveCount(1);
  await page.getByRole('button', {name: 'Pagina successiva', exact: true}).click(); await expect(page.getByTestId('notebook-paper')).toHaveAttribute('data-format', 'a5');
  await draw(page); await expect(page.getByLabel('Tratto in attesa di conferma', {exact: true})).toHaveCount(1);
  const saved = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('ardesia-next.pending.v1.') && key.includes('/')).map(key => JSON.parse(localStorage.getItem(key)!)).filter(row => row.request));
  expect(saved).toHaveLength(2); expect(new Set(saved.map(row => row.request.command.documentId))).toEqual(new Set([seeded.documentId, seeded.secondId]));
  await page.reload(); await expect(page.getByText('Il tuo spazio offline', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Apri quaderni offline', exact: true}).click();
  await expect(library(page).getByRole('button', {name: 'Nuovo quaderno', exact: true})).toHaveCount(0); await openPage(page, 'Energia');
  await expect(page.getByTestId('notebook-paper')).toHaveAttribute('data-background', 'dots'); await expect(page.getByLabel('Tratto in attesa di conferma', {exact: true})).toHaveCount(1);
  await page.screenshot({path: info.outputPath('notebook-offline.png')});
  await context.setOffline(false); await page.getByRole('button', {name: 'Ricollegati al server', exact: true}).click();
  const resume = page.getByRole('button', {name: 'Riprendi modifica non inviata', exact: true}); await expect(resume).toHaveCount(2);
  await resume.first().click(); await expect(resume).toHaveCount(1); await resume.click(); await expect(resume).toHaveCount(0);
  const confirmed = await personalProjection(page);
  for (const row of saved) expect(confirmed.documents.find(document => document.id === row.request.command.documentId)!.objects).toHaveLength(1);
  expect(confirmed.notebookSpace!.revision).toBe(2);
});

test('notebook page navigation protects an unsaved object and keeps off-paper content accessible', async ({page}, info) => {
  const seeded = await seed(page), objectId = randomUUID();
  await api(page.context().request, {action: 'command', workspaceId: seeded.w.workspaceId, command: {kind: 'add-object', commandId: randomUUID(), expectedRevision: 1, documentId: seeded.documentId,
    object: {id: objectId, type: 'note', title: 'Oltre il foglio', x: -9000, y: 20, width: 260, height: 140, data: {text: 'Nessun contenuto deve sparire.'}}}}, seeded.w.account.id);
  await page.goto('/'); await openLibrary(page); await openPage(page, 'Forze');
  await page.getByText('1 oggetto fuori pagina', {exact: true}).click(); await page.locator('.page-overflow-list').getByRole('button', {name: 'Oltre il foglio', exact: true}).click();
  await expect(page.getByLabel('Testo nota', {exact: true})).toHaveValue('Nessun contenuto deve sparire.');
  if (page.viewportSize()!.width >= 760) {
    await page.getByRole('button', {name: 'Lavagna', exact: true}).click();
    await page.getByRole('button', {name: 'Taccuino', exact: true}).click();
    const inView = async () => {
      const object = (await page.getByTestId('object-' + objectId).boundingBox())!, surface = (await page.locator('.board-surface').boundingBox())!;
      return object.x >= surface.x && object.x + object.width <= surface.x + surface.width && object.y >= surface.y && object.y + object.height <= surface.y + surface.height;
    };
    await expect.poll(inView).toBe(true);
    await page.getByRole('button', {name: 'Inquadra pagina', exact: true}).click();
    await page.getByText('1 oggetto fuori pagina', {exact: true}).click();
    await page.locator('.page-overflow-list').getByRole('button', {name: 'Oltre il foglio', exact: true}).click();
    await expect.poll(inView).toBe(true);
  }
  await page.getByLabel('Testo nota', {exact: true}).fill('Bozza ancora da salvare');
  const mobile = page.viewportSize()!.width < 760;
  await page.getByRole('button', {name: mobile ? 'Apri quaderni' : 'Pagina successiva', exact: true}).click();
  const guard = page.getByRole('dialog', {name: 'Hai modifiche da salvare', exact: true}); await expect(guard).toBeVisible();
  await guard.getByRole('button', {name: 'Continua a modificare', exact: true}).click(); await expect(page.getByLabel('Testo nota', {exact: true})).toHaveValue('Bozza ancora da salvare');
  await page.getByRole('button', {name: 'Salva modifiche', exact: true}).click(); await expect(page.getByRole('button', {name: 'Salva modifiche', exact: true})).toBeDisabled();
  if (mobile) await page.getByRole('button', {name: 'Chiudi proprietà', exact: true}).click();
  await page.getByRole('button', {name: 'Pagina successiva', exact: true}).click(); await expect(page.getByTestId('notebook-paper')).toHaveAttribute('data-format', 'a5');
  const confirmed = (await personalProjection(page)).documents.find(document => document.id === seeded.documentId)!;
  expect(confirmed.objects[0]).toMatchObject({id: objectId, x: -9000, y: 20, data: {text: 'Bozza ancora da salvare'}});
  const areaMeasurements: {width: number; height: number; wholePageFraction: number; filledPageFraction: number}[] = [];
  for (const viewport of [{width: 390, height: 844}, {width: 820, height: 1180}, {width: 1024, height: 1366}, {width: 1366, height: 1024}]) {
    await page.setViewportSize(viewport);
    const pageControls = (await page.getByRole('navigation', {name: 'Pagine del quaderno corrente'}).boundingBox())!, zoomControls = (await page.getByRole('group', {name: 'Navigazione lavagna'}).boundingBox())!;
    expect(Math.max(0, Math.min(pageControls.x + pageControls.width, zoomControls.x + zoomControls.width) - Math.max(pageControls.x, zoomControls.x)) * Math.max(0, Math.min(pageControls.y + pageControls.height, zoomControls.y + zoomControls.height) - Math.max(pageControls.y, zoomControls.y))).toBe(0);
    await page.getByRole('button', {name: 'Inquadra pagina', exact: true}).click();
    await page.getByRole('button', {name: 'Scrittura immersiva', exact: true}).click();
    const surface = (await page.locator('.board-surface').boundingBox())!; expect(surface.width * surface.height / (viewport.width * viewport.height)).toBeGreaterThan(.99);
    const paperFraction = async () => {
      const rect = (await page.getByTestId('notebook-paper').boundingBox())!;
      return Math.max(0, Math.min(viewport.width, rect.x + rect.width) - Math.max(0, rect.x)) * Math.max(0, Math.min(viewport.height, rect.y + rect.height) - Math.max(0, rect.y)) / (viewport.width * viewport.height);
    };
    const wholePageFraction = await paperFraction();
    await page.screenshot({path: info.outputPath(`notebook-${viewport.width}.png`)});
    await page.getByRole('button', {name: 'Avvicina il foglio', exact: true}).click();
    await expect.poll(paperFraction).toBeGreaterThan(.99);
    areaMeasurements.push({...viewport, wholePageFraction, filledPageFraction: await paperFraction()});
    // At writing time even the compact controls disappear without moving the paper.
    const beforeGesture = await page.locator('.board-world').getAttribute('style');
    await page.mouse.move(viewport.width * .4, viewport.height * .4); await page.mouse.down();
    await page.mouse.move(viewport.width * .6, viewport.height * .5, {steps: 8});
    await expect(page.locator('.board-toolbar')).toHaveCSS('opacity', '0');
    expect(await page.locator('.board-world').getAttribute('style')).toBe(beforeGesture);
    await page.screenshot({path: info.outputPath(`notebook-writing-${viewport.width}.png`)});
    await page.mouse.up(); await page.keyboard.press('Escape');
  }
  await writeFile(info.outputPath('notebook-writing-area.json'), JSON.stringify({kind: 'simulated-paper-viewport-intersection', areaMeasurements}, null, 2));
});


test('closing notebook organization protects an edited title until an explicit discard', async ({page}) => {
  await page.goto('/'); await openLibrary(page);
  await library(page).getByRole('button', {name: 'Nuovo quaderno', exact: true}).click();
  await library(page).getByLabel('Titolo', {exact: true}).fill('Titolo ancora da salvare');
  await page.keyboard.press('Escape');
  const guard = page.getByRole('dialog', {name: 'Conservare le modifiche al quaderno?', exact: true}); await expect(guard).toBeVisible();
  await guard.getByRole('button', {name: 'Continua a modificare', exact: true}).click();
  await expect(library(page).getByLabel('Titolo', {exact: true})).toHaveValue('Titolo ancora da salvare');
  await library(page).getByRole('button', {name: 'Chiudi finestra', exact: true}).click();
  await expect(guard).toBeVisible(); await guard.getByRole('button', {name: 'Scarta e chiudi', exact: true}).click();
  await expect(library(page)).toHaveCount(0); expect((await personalProjection(page)).notebookSpace).toEqual({revision: 0, notebooks: []});
});

test('a notebook page imports one PDF page within the paper and preserves the complete original', async ({page}, info) => {
  const seeded = await seed(page), bytes = pdfFixture(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await openLibrary(page); await openPage(page, 'Energia');
  await page.getByRole('button', {name: 'Importa materiale', exact: true}).click();
  const dialog = page.getByRole('dialog', {name: 'Porta un materiale nella lezione', exact: true});
  await dialog.getByLabel('File da importare').setInputFiles({name: 'Appunti di meccanica.pdf', mimeType: 'application/pdf', buffer: bytes});
  await expect(dialog.locator('[data-material-state="ready"]')).toBeVisible();
  await dialog.getByLabel('Pagine da importare').fill('1, 2');
  await dialog.getByRole('button', {name: 'Aggiungi alla pagina', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Scegli una sola pagina');
  expect((await personalProjection(page)).documents.find(document => document.id === seeded.secondId)!.objects).toHaveLength(0);
  await dialog.getByLabel('Pagine da importare').fill('2');
  await dialog.getByRole('button', {name: 'Aggiungi alla pagina', exact: true}).click(); await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('notebook-paper')).toHaveAttribute('data-format', 'a5');
  const projection = await personalProjection(page), document = projection.documents.find(document => document.id === seeded.secondId)!;
  const object = document.objects[0]!, size = notebookPageSize({...layout, format: 'a5', orientation: 'landscape'});
  expect(document.objects).toHaveLength(1); expect(object).toMatchObject({type: 'material', x: 40, y: 60,
    data: {page: 2, pageCount: 3, sha256: createHash('sha256').update(bytes).digest('hex')}});
  expect(object.x + object.width).toBeLessThanOrEqual(size.width); expect(object.y + object.height).toBeLessThanOrEqual(size.height);
  expect(projection.notebookSpace!.notebooks[0]!.sections[0]!.pages[1]!.documentId).toBe(document.id);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', {name: 'Scarica originale', exact: true}).click();
  expect(await readFile((await (await downloadPromise).path())!)).toEqual(bytes);
  await page.getByRole('button', {name: 'Chiudi proprietà', exact: true}).click();
  await page.getByRole('button', {name: 'Inquadra pagina', exact: true}).click();
  await expect(page.locator('.type-material [data-material-state="ready"]')).toBeVisible();
  await page.screenshot({path: info.outputPath('notebook-pdf.png')});
  await page.reload(); await expect(page.getByTestId('notebook-paper')).toHaveAttribute('data-format', 'a5');
  await expect(page.locator('.type-material [data-material-state="ready"]')).toBeVisible();
  expect((await personalProjection(page)).documents.find(row => row.id === seeded.secondId)!.objects).toEqual(document.objects);
  expect(errors).toEqual([]);
});

test('finite paper rejects a stroke started outside but retains one continuous gesture crossing its edge', async ({page}) => {
  const seeded = await seed(page); await page.goto('/'); await openLibrary(page); await openPage(page, 'Forze');
  await page.getByRole('button', {name: 'Inquadra pagina', exact: true}).click();
  await page.getByRole('button', {name: 'Scrittura immersiva', exact: true}).click();
  const paper = (await page.getByTestId('notebook-paper').boundingBox())!, y = paper.y + paper.height * .48;
  const draftRows = () => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('ardesia-next.ink-draft.v1.')).map(key => JSON.parse(localStorage.getItem(key)!)));
  // Pointer capture must not turn entering the page into an implicit new stroke.
  await page.mouse.move(paper.x - 8, y); await page.mouse.down(); await page.mouse.move(paper.x + 90, y + 12, {steps: 12}); await page.mouse.up();
  expect(await draftRows()).toHaveLength(0);
  expect((await personalProjection(page)).documents.find(document => document.id === seeded.documentId)!.objects).toHaveLength(0);
  await page.mouse.move(paper.x + paper.width * .8, y); await page.mouse.down();
  const start = (await draftRows())[0]; expect(start).toBeDefined();
  await page.mouse.move(paper.x + paper.width + 8, y + 30, {steps: 12}); await page.mouse.up();
  await expect.poll(async () => (await personalProjection(page)).documents.find(document => document.id === seeded.documentId)!.objects.length).toBe(1);
  const object = (await personalProjection(page)).documents.find(document => document.id === seeded.documentId)!.objects[0]!;
  expect(object.id).toBe(start.object.id); expect(object.type).toBe('ink');
  if (object.type !== 'ink') throw Error('Expected ink');
  expect(object.data.points.length).toBeGreaterThan(2); expect(object.x + object.width).toBeGreaterThan(notebookPageSize(layout).width);
  await expect.poll(draftRows).toEqual([]);
  await page.keyboard.press('Escape'); await expect(page.getByText('1 oggetto fuori pagina', {exact: true})).toBeVisible();
  await page.reload(); expect((await personalProjection(page)).documents.find(document => document.id === seeded.documentId)!.objects).toEqual([object]);
});

test('notebook camera and page stay fixed when off-page focus is requested during a pen gesture', async ({page}) => {
  const seeded = await seed(page), objectId = randomUUID();
  await api(page.context().request, {action: 'command', workspaceId: seeded.w.workspaceId, command: {kind: 'add-object', commandId: randomUUID(), expectedRevision: 1, documentId: seeded.documentId,
    object: {id: objectId, type: 'note', title: 'Fuori pagina', x: -9000, y: 20, width: 260, height: 140, data: {text: 'Destinazione distante'}}}}, seeded.w.account.id);
  await page.goto('/'); await openLibrary(page); await openPage(page, 'Forze');
  await page.getByRole('button', {name: 'Inquadra pagina', exact: true}).click(); await page.getByRole('button', {name: 'Penna', exact: true}).click();
  await page.getByText('1 oggetto fuori pagina', {exact: true}).click();
  const target = page.locator('.page-overflow-list').getByRole('button', {name: 'Fuori pagina', exact: true}); await target.focus();
  const before = await page.locator('.board-world').getAttribute('style');
  await page.locator('.board-surface').evaluate(surface => {
    const paper = surface.querySelector('.notebook-paper')!.getBoundingClientRect(); surface.setPointerCapture = () => {};
    surface.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 54, pointerType: 'pen', button: 0, buttons: 1, pressure: .5, clientX: paper.x + paper.width * .5, clientY: paper.y + paper.height * .5}));
  });
  // A keyboard activation can coincide with a pen pointer on a touchscreen.
  await target.press('Enter'); expect(await page.locator('.board-world').getAttribute('style')).toBe(before);
  await expect(page.getByRole('button', {name: 'Pagina successiva', exact: true})).toBeDisabled();
  await page.locator('.board-surface').evaluate(surface => {
    const paper = surface.querySelector('.notebook-paper')!.getBoundingClientRect();
    surface.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerId: 54, pointerType: 'pen', button: 0, pressure: .6, clientX: paper.x + paper.width * .6, clientY: paper.y + paper.height * .6}));
  });
  await expect.poll(async () => (await personalProjection(page)).documents.find(document => document.id === seeded.documentId)!.objects.filter(object => object.type === 'ink').length).toBe(1);
  await expect(page.getByRole('button', {name: 'Pagina successiva', exact: true})).toBeEnabled();
  await target.click(); expect(await page.locator('.board-world').getAttribute('style')).not.toBe(before);
});

test('notebook navigation waits for the recording and keeps its audio in the original page', async ({page}, info) => {
  const seeded = await seed(page); await syntheticMicrophone(page);
  await page.goto('/'); await openLibrary(page); await openPage(page, 'Forze');
  if (info.project.name === 'desktop-chromium') {
    await page.setViewportSize({width: 1366, height: 1024});
    await page.getByRole('button', {name: 'Aggiungi nota', exact: true}).click();
    await expect(page.locator('.inspector')).toBeVisible();
  }
  await page.getByRole('button', {name: /Audio e replay/}).click();
  await page.getByLabel('Consenso alla registrazione audio').check();
  await page.getByRole('button', {name: 'Registra spiegazione', exact: true}).click();
  await expect(page.getByText('● Microfono attivo', {exact: false})).toBeVisible();
  await page.getByRole('button', {name: /Audio e replay/}).click();
  await expect(page.getByRole('button', {name: 'Pagina successiva', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: 'Apri quaderni', exact: true}).click();
  await expect(library(page)).toHaveCount(0); await expect(page.locator('.studio-title')).toHaveText('Forze');
  const alert = (await page.locator('.workspace > .error-banner').boundingBox())!;
  for (const control of [page.getByRole('group', {name: 'Navigazione lavagna'}), page.getByRole('navigation', {name: 'Pagine del quaderno corrente'})]) {
    const rect = (await control.boundingBox())!;
    expect(Math.max(0, Math.min(alert.x + alert.width, rect.x + rect.width) - Math.max(alert.x, rect.x)) * Math.max(0, Math.min(alert.y + alert.height, rect.y + rect.height) - Math.max(alert.y, rect.y))).toBe(0);
  }
  await page.screenshot({path: info.outputPath('notebook-recording-guard.png')});
  await expect.poll(() => page.evaluate(() => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open('ardesia-next-audio-recovery-v1', 1); request.onerror = () => reject(request.error);
    request.onsuccess = () => {const db = request.result, tx = db.transaction('chunks'), count = tx.objectStore('chunks').count();
      tx.oncomplete = () => {db.close(); resolve(count.result);}; tx.onabort = () => {db.close(); reject(tx.error);};};
  }))).toBeGreaterThan(0);
  await page.getByRole('button', {name: 'Interrompi registrazione', exact: true}).click();
  await page.getByRole('button', {name: /Audio e replay/}).click();
  await page.getByRole('button', {name: 'Archivia / riprendi caricamento', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Apri replay', exact: true})).toBeEnabled();
  await page.getByRole('button', {name: /Audio e replay/}).click();
  await page.getByRole('button', {name: 'Pagina successiva', exact: true}).click(); await expect(page.locator('.studio-title')).toHaveText('Energia');
  const recordings = (documentId: string) => api<unknown[]>(page.context().request, {action: 'list-recordings', workspaceId: seeded.w.workspaceId, documentId}, seeded.w.account.id);
  expect(await recordings(seeded.documentId)).toHaveLength(1); expect(await recordings(seeded.secondId)).toHaveLength(0);
});
