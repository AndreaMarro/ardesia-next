import {randomUUID} from 'node:crypto';
import type {Page} from '@playwright/test';
import {toObjectInput} from '@ardesia/contracts';
import {api, apiOrigin, expect, loginContext, personalProjection, selectedWorkspace, selectWorkspace, test} from './fixtures';
import {addMarketplaceSpring, storedSpring} from './marketplace-helpers';

const conflictText = 'Il contenuto salvato è cambiato';
async function refresh(page: Page) {
  const refreshed = page.waitForResponse(response => response.url().endsWith('/api/m3') && response.request().postDataJSON()?.action === 'open-workspace');
  // The narrow layout hides the status toolbar; focus still refreshes the real server projection.
  const button = page.locator('.remote-status').getByRole('button', {name: 'Aggiorna', exact: true});
  if (await button.isVisible()) await button.click();
  else await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await refreshed;
}
const labPanel = (page: Page) => page.getByRole('complementary', {name: 'Proprietà del laboratorio', exact: true});
const noteText = async (page: Page) => (await personalProjection(page)).documents[0]!.objects.find(object => object.type === 'note');

test('[M3 editor] a teacher note retains its base and draft through a competing save', async ({page, context}) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByRole('button', {name: 'Apri Che cosa cambia il periodo?', exact: true}).click();
  await page.getByLabel('Testo nota', {exact: true}).fill('Bozza locale da conservare.');
  const peer = await context.newPage();
  try {
    await peer.goto('/');
    await peer.getByRole('button', {name: 'Apri Che cosa cambia il periodo?', exact: true}).click();
    await peer.getByLabel('Testo nota', {exact: true}).fill('Nota confermata nella seconda scheda.');
    await peer.getByRole('button', {name: 'Salva modifiche', exact: true}).click();
    await expect.poll(() => noteText(peer)).toMatchObject({data: {text: 'Nota confermata nella seconda scheda.'}});
    await expect(peer.getByRole('button', {name: 'Salva modifiche', exact: true})).toBeDisabled();
    await refresh(page);
    const editor = page.getByRole('complementary', {name: 'Proprietà dell’oggetto', exact: true});
    await expect(editor.getByRole('alert')).toContainText(conflictText);
    await expect(page.getByLabel('Testo nota', {exact: true})).toHaveValue('Bozza locale da conservare.');
    await expect(page.getByRole('button', {name: 'Salva modifiche', exact: true})).toBeDisabled();
    let commands = 0;
    page.on('request', request => {if (request.method() === 'POST' && request.url().endsWith('/api/m3') && request.postDataJSON()?.action === 'command') commands++;});
    const committed = await personalProjection(page);
    // A form submission must also refuse the conflict independently of the disabled button.
    await page.locator('#object-editor').evaluate(form => (form as HTMLFormElement).requestSubmit());
    expect(await personalProjection(page)).toEqual(committed);
    expect(commands).toBe(0);

    await page.getByRole('button', {name: 'Ripristina versione salvata', exact: true}).click();
    await expect(page.getByLabel('Testo nota', {exact: true})).toHaveValue('Nota confermata nella seconda scheda.');
    await page.getByLabel('Testo nota', {exact: true}).fill('Nota ripresa dalla versione confermata.');
    // A change to another object may advance the document without invalidating this note base.
    const selected = selectedWorkspace(page), latest = await personalProjection(peer), document = latest.documents[0]!;
    const formula = document.objects.find(object => object.type === 'formula')!;
    await api(context.request, {action: 'command', workspaceId: selected.workspaceId, command: {
      kind: 'replace-object', commandId: randomUUID(), documentId: document.id, expectedRevision: document.revision,
      object: {...toObjectInput(formula), title: 'Formula aggiornata in parallelo'},
    }}, selected.account.id);
    await refresh(page);
    await expect(page.locator('.app-shell')).toHaveAttribute('data-revision', String(document.revision + 1));
    await expect(editor.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Salva modifiche', exact: true})).toBeEnabled();
    await page.getByRole('button', {name: 'Salva modifiche', exact: true}).click();
    await expect.poll(() => noteText(page)).toMatchObject({data: {text: 'Nota ripresa dalla versione confermata.'}});
    await expect(page.getByRole('button', {name: 'Salva modifiche', exact: true})).toBeDisabled();
    await expect(editor.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', {name: 'Chiudi proprietà', exact: true}).click();
    await expect(page.getByRole('dialog', {name: 'Hai modifiche da salvare', exact: true})).toHaveCount(0);
    await page.getByRole('button', {name: 'Apri Che cosa cambia il periodo?', exact: true}).click();
    await page.getByLabel('Testo nota', {exact: true}).fill('Bozza ancora copiabile dopo la rimozione remota.');
    const beforeRemoval = (await personalProjection(peer)).documents[0]!, removed = beforeRemoval.objects.find(object => object.type === 'note')!;
    await api(context.request, {action: 'command', workspaceId: selected.workspaceId, command: {
      kind: 'remove-object', commandId: randomUUID(), documentId: beforeRemoval.id, expectedRevision: beforeRemoval.revision, objectId: removed.id,
    }}, selected.account.id);
    await refresh(page);
    await expect(editor.getByRole('alert')).toContainText('Oggetto rimosso');
    await expect(page.getByLabel('Testo nota', {exact: true})).toHaveValue('Bozza ancora copiabile dopo la rimozione remota.');
    await expect(page.getByRole('button', {name: 'Salva modifiche', exact: true})).toBeDisabled();
    await expect(page.getByRole('button', {name: 'Ripristina versione salvata', exact: true})).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Rimuovi oggetto', exact: true})).toBeDisabled();
    await page.getByRole('button', {name: 'Chiudi proprietà', exact: true}).click();
    await page.getByRole('button', {name: 'Scarta modifiche', exact: true}).click();
    await expect(editor).toHaveCount(0);
    expect((await personalProjection(page)).documents[0]!.objects.some(object => object.id === removed.id)).toBe(false);
  } finally {await peer.close();}
});

test('[M3 editor] a teacher laboratory preserves dirty parameters and still stops on consent withdrawal', async ({page, context}) => {
  test.setTimeout(90_000);
  await addMarketplaceSpring(page);
  await labPanel(page).getByLabel('Massa (kg)', {exact: true}).fill('4');
  await labPanel(page).getByRole('button', {name: 'Aggiorna grafico', exact: true}).click();
  await expect(labPanel(page).getByRole('button', {name: 'Salva laboratorio', exact: true})).toBeEnabled();
  const peer = await context.newPage();
  try {
    await peer.goto('/');
    await peer.getByRole('button', {name: 'Apri Molla ideale', exact: true}).click();
    await expect(labPanel(peer)).toHaveAttribute('data-plugin-status', 'ready');
    await labPanel(peer).getByLabel('Massa (kg)', {exact: true}).fill('6');
    await labPanel(peer).getByRole('button', {name: 'Salva laboratorio', exact: true}).click();
    await expect.poll(async () => (await storedSpring(peer)).data.state.value).toMatchObject({massKg: 6});
    await expect(labPanel(peer)).toHaveAttribute('data-plugin-status', 'ready');
    await expect(labPanel(peer).getByRole('button', {name: 'Salva laboratorio', exact: true})).toBeDisabled();
    await refresh(page);
    await expect(labPanel(page).getByRole('alert')).toContainText(conflictText);
    await expect(labPanel(page).getByLabel('Massa (kg)', {exact: true})).toHaveValue('4');
    await expect(labPanel(page).getByRole('button', {name: 'Salva laboratorio', exact: true})).toBeDisabled();
    const committed = await personalProjection(page);
    await page.locator('#object-editor').evaluate(form => (form as HTMLFormElement).requestSubmit());
    expect(await personalProjection(page)).toEqual(committed);

    await labPanel(page).getByRole('button', {name: 'Ripristina stato salvato', exact: true}).click();
    await expect(labPanel(page)).toHaveAttribute('data-plugin-status', 'ready');
    await expect(labPanel(page).getByLabel('Massa (kg)', {exact: true})).toHaveValue('6');
    await labPanel(page).getByLabel('Massa (kg)', {exact: true}).fill('8');
    await labPanel(page).getByRole('button', {name: 'Salva laboratorio', exact: true}).click();
    await expect.poll(async () => (await storedSpring(page)).data.state.value).toMatchObject({massKg: 8});
    await expect(labPanel(page)).toHaveAttribute('data-plugin-status', 'ready');
    await expect(labPanel(page).getByRole('button', {name: 'Salva laboratorio', exact: true})).toBeDisabled();
    await expect(labPanel(page).getByRole('alert')).toHaveCount(0);
    await labPanel(page).getByLabel('Massa (kg)', {exact: true}).fill('9');
    const selected = selectedWorkspace(page), latest = await personalProjection(peer), installation = latest.installations[0]!;
    await api(context.request, {action: 'plugin-command', workspaceId: selected.workspaceId, command: {
      kind: 'withdraw-plugin-consent', commandId: randomUUID(), pluginId: installation.pluginId, expectedRevision: installation.revision,
    }}, selected.account.id);
    await refresh(page);
    await expect.poll(() => page.workers().length).toBe(0);
    await expect(labPanel(page)).toHaveAttribute('data-plugin-status', 'error');
    await expect(labPanel(page).getByLabel('Massa (kg)', {exact: true})).toHaveValue('9');
    await expect(labPanel(page).getByLabel('Massa (kg)', {exact: true})).toBeDisabled();
    await expect(labPanel(page).getByRole('button', {name: 'Salva laboratorio', exact: true})).toBeDisabled();
    expect((await storedSpring(page)).data.state.value).toMatchObject({massKg: 8});
    let resumed = (await personalProjection(peer)).installations[0]!;
    await api(context.request, {action: 'plugin-command', workspaceId: selected.workspaceId, command: {
      kind: 'consent-plugin', commandId: randomUUID(), pluginId: resumed.pluginId, expectedRevision: resumed.revision,
      releaseDigest: resumed.release.bundleDigest, capabilities: resumed.release.capabilities,
    }}, selected.account.id);
    resumed = (await personalProjection(peer)).installations[0]!;
    await api(context.request, {action: 'plugin-command', workspaceId: selected.workspaceId, command: {
      kind: 'activate-plugin', commandId: randomUUID(), pluginId: resumed.pluginId, expectedRevision: resumed.revision,
    }}, selected.account.id);
    await refresh(page);
    await expect(labPanel(page)).toHaveAttribute('data-plugin-status', 'ready');
    await expect(labPanel(page).getByLabel('Massa (kg)', {exact: true})).toHaveValue('9');
    await expect.poll(() => page.workers().length).toBeGreaterThan(0);
    const beforeRemoval = (await personalProjection(peer)).documents[0]!, removed = beforeRemoval.objects.find(object => object.type === 'lab')!;
    await api(context.request, {action: 'command', workspaceId: selected.workspaceId, command: {
      kind: 'remove-object', commandId: randomUUID(), documentId: beforeRemoval.id, expectedRevision: beforeRemoval.revision, objectId: removed.id,
    }}, selected.account.id);
    await refresh(page);
    await expect(labPanel(page).getByRole('alert').filter({hasText: 'Oggetto rimosso'})).toBeVisible();
    await expect(labPanel(page).getByLabel('Massa (kg)', {exact: true})).toHaveValue('9');
    await expect(labPanel(page).getByRole('button', {name: 'Ripristina stato salvato', exact: true})).toHaveCount(0);
    await expect(labPanel(page).getByRole('button', {name: 'Rimuovi oggetto', exact: true})).toBeDisabled();
    await expect.poll(() => page.workers().length).toBe(0);
    await page.getByRole('button', {name: 'Chiudi proprietà', exact: true}).click();
    await page.getByRole('button', {name: 'Scarta modifiche', exact: true}).click();
    await expect(labPanel(page)).toHaveCount(0);
    expect(page.workers()).toHaveLength(0);
  } finally {await peer.close();}
});

test('[M3 editor] student notes and the first personal lab keep their own draft bases', async ({page, browser}, testInfo) => {
  test.setTimeout(120_000);
  await addMarketplaceSpring(page);
  const teacher = selectedWorkspace(page), lab = await storedSpring(page);
  const learner = await browser.newContext({baseURL: apiOrigin, viewport: page.viewportSize() ?? {width: 1440, height: 960},
    isMobile: testInfo.project.name === 'mobile-chromium', hasTouch: testInfo.project.name === 'mobile-chromium', storageState: {cookies: [], origins: []}});
  try {
    const account = await loginContext(learner, 'STUDENT_A');
    await api(page.context().request, {action: 'learning-command', workspaceId: teacher.workspaceId, command: {
      kind: 'assign-lesson', commandId: randomUUID(), documentId: teacher.documentId, studentId: account.id, expectedRevision: 0,
    }}, teacher.account.id);
    await selectWorkspace(learner, {...teacher, account, actor: {actorId: account.id, role: 'student'}});
    const first = await learner.newPage(), peer = await learner.newPage();
    await first.goto('/'); await peer.goto('/');
    await first.getByLabel('Note personali', {exact: true}).fill('Bozza privata della prima scheda.');
    await peer.getByLabel('Note personali', {exact: true}).fill('Note personali confermate dalla seconda scheda.');
    await peer.getByRole('button', {name: 'Salva note personali', exact: true}).click();
    await expect.poll(async () => (await personalProjection(peer)).learnerWork[0]?.notes).toBe('Note personali confermate dalla seconda scheda.');
    await refresh(first);
    await expect(first.locator('.learner-notes').getByRole('alert')).toContainText(conflictText);
    await expect(first.getByLabel('Note personali', {exact: true})).toHaveValue('Bozza privata della prima scheda.');
    await expect(first.getByRole('button', {name: 'Salva note personali', exact: true})).toBeDisabled();
    await first.getByRole('button', {name: 'Ripristina note salvate', exact: true}).click();
    await expect(first.getByLabel('Note personali', {exact: true})).toHaveValue('Note personali confermate dalla seconda scheda.');
    await first.getByLabel('Note personali', {exact: true}).fill('Note riprese dalla base confermata.');
    const work = (await personalProjection(peer)).learnerWork[0]!;
    await api(learner.request, {action: 'learning-command', workspaceId: teacher.workspaceId, command: {
      kind: 'share-learner-evidence', commandId: randomUUID(), documentId: teacher.documentId, expectedRevision: work.revision, shared: true,
    }}, account.id);
    await refresh(first);
    await expect(first.locator('.learner-content')).toHaveAttribute('data-work-revision', String(work.revision + 1));
    await expect(first.getByRole('button', {name: 'Salva note personali', exact: true})).toBeEnabled();
    await first.getByRole('button', {name: 'Salva note personali', exact: true}).click();
    await expect.poll(async () => (await personalProjection(first)).learnerWork[0]?.notes).toBe('Note riprese dalla base confermata.');
    await expect(first.getByRole('button', {name: 'Salva note personali', exact: true})).toBeDisabled();
    await expect(first.locator('.learner-notes').getByRole('alert')).toHaveCount(0);

    await first.getByRole('button', {name: 'Modifica Molla ideale', exact: true}).click();
    await first.getByLabel('Leggere il mio stato scientifico', {exact: true}).check();
    await first.getByLabel('Modificare e salvare i parametri', {exact: true}).check();
    await first.getByRole('button', {name: 'Autorizza laboratorio', exact: true}).click();
    await expect(labPanel(first)).toHaveAttribute('data-plugin-status', 'ready');
    await expect(first.getByLabel('Titolo laboratorio', {exact: true})).toBeDisabled();
    await labPanel(first).getByLabel('Massa (kg)', {exact: true}).fill('4');
    await refresh(peer);
    await peer.getByRole('button', {name: 'Modifica Molla ideale', exact: true}).click();
    await expect(labPanel(peer)).toHaveAttribute('data-plugin-status', 'ready');
    const card = peer.locator('.lab-content');
    await expect(card).toHaveAttribute('data-plugin-status', 'ready');
    const cardPeriod = card.locator('.science-metrics div').filter({hasText: 'Periodo'}).locator('dd');
    const sourcePeriod = await cardPeriod.textContent();
    await labPanel(peer).getByLabel('Massa (kg)', {exact: true}).fill('6');
    await labPanel(peer).getByRole('button', {name: 'Salva laboratorio', exact: true}).click();
    await expect.poll(async () => (await personalProjection(peer)).learnerWork[0]?.labs[0]?.data.state.value).toMatchObject({massKg: 6});
    const personal = (await personalProjection(peer)).learnerWork[0]!.labs[0]!;
    expect(personal.revision).toBe(lab.revision); // Both are 1; revision alone cannot detect this change.
    await expect(labPanel(peer)).toHaveAttribute('data-plugin-status', 'ready');
    const personalPeriod = await labPanel(peer).locator('.science-metrics div').filter({hasText: 'Periodo'}).locator('dd').textContent();
    expect(personalPeriod).not.toBe(sourcePeriod);
    await expect.soft(cardPeriod).toHaveText(personalPeriod!);
    await refresh(first);
    await expect(labPanel(first).getByRole('alert')).toContainText(conflictText);
    await expect(labPanel(first).getByLabel('Massa (kg)', {exact: true})).toHaveValue('4');
    await expect(labPanel(first).getByRole('button', {name: 'Salva laboratorio', exact: true})).toBeDisabled();
    await labPanel(first).getByRole('button', {name: 'Ripristina stato salvato', exact: true}).click();
    await expect(labPanel(first)).toHaveAttribute('data-plugin-status', 'ready');
    await expect(labPanel(first).getByLabel('Massa (kg)', {exact: true})).toHaveValue('6');
    await labPanel(first).getByLabel('Massa (kg)', {exact: true}).fill('8');
    await labPanel(first).getByRole('button', {name: 'Salva laboratorio', exact: true}).click();
    await expect.poll(async () => (await personalProjection(first)).learnerWork[0]?.labs[0]?.data.state.value).toMatchObject({massKg: 8});
    await expect(labPanel(first)).toHaveAttribute('data-plugin-status', 'ready');
    await expect(labPanel(first).getByRole('button', {name: 'Salva laboratorio', exact: true})).toBeDisabled();
    await expect(labPanel(first).getByRole('alert')).toHaveCount(0);
    await labPanel(first).getByLabel('Massa (kg)', {exact: true}).fill('9');
    const confirmed = (await personalProjection(peer)).learnerWork[0]!;
    await api(learner.request, {action: 'learning-command', workspaceId: teacher.workspaceId, command: {
      kind: 'revoke-lab-consent', commandId: randomUUID(), documentId: teacher.documentId, expectedRevision: confirmed.revision, objectId: lab.id,
    }}, account.id);
    await refresh(first);
    await expect.poll(() => first.workers().length).toBe(0);
    await expect(labPanel(first)).toHaveAttribute('data-plugin-status', 'error');
    await expect(labPanel(first).getByLabel('Massa (kg)', {exact: true})).toHaveValue('9');
    await expect(labPanel(first).getByLabel('Massa (kg)', {exact: true})).toBeDisabled();
    expect((await personalProjection(first)).learnerWork[0]!.labs[0]!.data.state.value).toMatchObject({massKg: 8});
    await labPanel(first).getByRole('button', {name: 'Ripristina stato salvato', exact: true}).click();
    await expect(labPanel(first)).toHaveCount(0);
    await expect(first.getByLabel('Leggere il mio stato scientifico', {exact: true})).not.toBeChecked();
    await expect(first.getByLabel('Modificare e salvare i parametri', {exact: true})).not.toBeChecked();
    await expect(first.getByRole('button', {name: 'Autorizza laboratorio', exact: true})).toBeDisabled();
  } finally {await learner.close();}
});
