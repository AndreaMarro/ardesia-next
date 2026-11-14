import {randomUUID} from 'node:crypto';
import type {Page, BrowserContext} from '@playwright/test';
import type {LabObject} from '@ardesia/contracts';
import {test, expect, api, rawApi, apiOrigin, loginContext, selectWorkspace, selectedWorkspace, personalProjection} from './fixtures';
import {openMarketplace, storedWorkspace, readConsentLabel, writeConsentLabel} from './marketplace-helpers';

async function add(page: Page, name: string, flow = false) {
  await openMarketplace(page);
  const card = page.getByRole('article', {name: 'Modulo ' + name, exact: true});
  await card.getByRole('button', {name: 'Verifica ' + name, exact: true}).click();
  await card.getByRole('button', {name: 'Installa ' + name, exact: true}).click();
  await card.getByRole('checkbox', {name: readConsentLabel, exact: true}).check();
  await card.getByRole('checkbox', {name: writeConsentLabel, exact: true}).check();
  await card.getByRole('button', {name: 'Salva autorizzazioni', exact: true}).click();
  await card.getByRole('button', {name: 'Attiva ' + name, exact: true}).click();
  await card.getByRole('button', {name: flow ? 'Aggiungi Poiseuille a portata imposta' : name === 'Molla ideale' ? 'Aggiungi molla alla lezione' : 'Aggiungi Flusso di Poiseuille alla lezione', exact: true}).click();
  await expect(page.getByRole('complementary', {name: 'Proprietà del laboratorio'})).toHaveAttribute('data-plugin-status', 'ready');
}
// The spatial notebook may contain overlapping objects. Select through the
// accessible object list without moving them or bypassing pointer hit testing.
async function selectObject(page: Page, title: string) {
  await page.getByRole('button', {name: 'Oggetti', exact: true}).click();
  await page.getByRole('region', {name: 'Fonti e oggetti', exact: true})
    .getByRole('button', {name: 'Seleziona ' + title, exact: true}).click();
}
async function labs(page: Page) {
  return (await storedWorkspace(page)).documents.flatMap(document => document.objects).filter((object): object is LabObject => object.type === 'lab');
}
for (const flow of [false, true]) {
  test(`[M4] ${flow ? 'flow' : 'pressure'} control saves reopens rejects and revokes without changing spring`, async ({page}, testInfo) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    for (const name of flow ? ['Flusso di Poiseuille', 'Molla ideale'] : ['Molla ideale', 'Flusso di Poiseuille']) {
      await add(page, name, flow && name !== 'Molla ideale');
      await page.getByRole('button', {name: 'Chiudi proprietà', exact: true}).click();
    }
    const initial = await labs(page), spring = initial.find(object => object.data.pluginId === 'ardesia.ideal-spring')!, fluid = initial.find(object => object.data.pluginId === 'ardesia.poiseuille')!;
    expect(initial).toHaveLength(2); expect(spring.id).not.toBe(fluid.id);
    expect(fluid.data.state.value).toMatchObject(flow ? {flowRateM3PerS: Math.PI * 1e-7} : {pressureDropPa: 800});
    await page.getByRole('button', {name: 'Taccuino', exact: true}).click();
    await selectObject(page, 'Flusso di Poiseuille');
    const inspector = page.getByRole('complementary', {name: 'Proprietà del laboratorio'});
    await expect(inspector).toHaveAttribute('data-plugin-status', 'ready');
    // Arbitrary valid SI values must save even when another numeric parameter is not a step multiple.
    await inspector.getByLabel('Viscosità dinamica (Pa·s)', {exact: true}).fill('0.0015');
    await inspector.getByRole('button', {name: 'Salva laboratorio', exact: true}).click();
    await expect.poll(async () => (await labs(page)).find(object => object.id === fluid.id)?.revision).toBe(2);
    const saved = (await labs(page)).find(object => object.id === fluid.id)!;
    expect(saved.data.state.value).toMatchObject({viscosityPaS: 0.0015});
    expect(saved.data.instanceId).toBe(fluid.data.instanceId); expect(saved.data.bundleDigest).toBe(fluid.data.bundleDigest); expect(saved.status).toBe('draft');
    expect((await labs(page)).find(object => object.id === spring.id)).toEqual(spring);
    const beforeRefusal = await storedWorkspace(page);
    // After viscosity changed, pressure 10000 Pa alone still has Re≈1111.
    // Density 2000 kg/m³ makes this a real out-of-domain case (Re≈2222).
    if (!flow) await inspector.getByLabel('Densità (kg/m³)', {exact: true}).fill('2000');
    await inspector.getByLabel(flow ? 'Portata imposta (m³/s)' : 'Differenza di pressione (Pa)', {exact: true}).fill(flow ? '0.001' : '10000');
    await inspector.getByRole('button', {name: 'Aggiorna grafico', exact: true}).click();
    await expect(inspector).toHaveAttribute('data-plugin-status', 'error');
    await expect(inspector.locator('.lab-error')).toContainText('Re ≥ 2000');
    await expect(inspector.locator('.lab-error')).toContainText('Riduci la forzante');
    expect(await storedWorkspace(page)).toEqual(beforeRefusal);
    await inspector.getByRole('button', {name: 'Ripristina stato salvato', exact: true}).click();
    await expect(inspector).toHaveAttribute('data-plugin-status', 'ready');
    await page.reload();
    await page.getByRole('button', {name: 'Taccuino', exact: true}).click();
    await selectObject(page, 'Flusso di Poiseuille');
    await expect(inspector).toHaveAttribute('data-plugin-status', 'ready');
    await expect(inspector.getByLabel('Viscosità dinamica (Pa·s)', {exact: true})).toHaveValue('0.0015');
    expect((await labs(page)).find(object => object.id === fluid.id)).toEqual(saved);
    await page.screenshot({path: `artifacts/${testInfo.project.name}-m4-${flow ? 'flow' : 'pressure'}.png`, fullPage: true});
    await page.getByRole('button', {name: 'Chiudi proprietà', exact: true}).click();
    await openMarketplace(page);
    await page.getByRole('article', {name: 'Modulo Flusso di Poiseuille'}).getByText('Revoca del modulo', {exact: true}).click();
    await page.getByRole('button', {name: 'Revoca Flusso di Poiseuille', exact: true}).click();
    await page.getByRole('button', {name: 'Chiudi finestra', exact: true}).click();
    await page.getByRole('button', {name: 'Taccuino', exact: true}).click();
    await selectObject(page, 'Flusso di Poiseuille');
    await expect(inspector).toHaveAttribute('data-plugin-status', 'error');
    await expect(inspector.getByRole('button', {name: 'Salva laboratorio', exact: true})).toBeDisabled();
    expect((await labs(page)).find(object => object.id === fluid.id)).toEqual(saved);
    await page.getByRole('button', {name: 'Chiudi proprietà', exact: true}).click();
    await selectObject(page, 'Molla ideale');
    await expect(inspector).toHaveAttribute('data-plugin-status', 'ready');
    await expect(inspector.getByLabel('Massa (kg)', {exact: true})).toHaveValue('1');
    expect((await labs(page)).find(object => object.id === spring.id)).toEqual(spring);
    expect(errors).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const flow of [false, true]) {
  test(`[M4] ${flow ? 'flow' : 'pressure'} learner consent private save independent reopen and revocation`, async ({page, browser}, testInfo) => {
    // Three independent authenticated sessions plus consent/save/revocation, as in M3.
    test.setTimeout(120_000);
    const contexts: BrowserContext[] = [];
    const errors: string[] = [];
    const fresh = async (kind: 'STUDENT_A' | 'STUDENT_B') => {
      const context = await browser.newContext({baseURL: apiOrigin, viewport: page.viewportSize()!, storageState: {cookies: [], origins: []}});
      contexts.push(context);
      const account = await loginContext(context, kind, testInfo.project.name);
      await selectWorkspace(context, {...selectedWorkspace(page), account, actor: {actorId: account.id, role: 'student'}});
      return {context, account};
    };
    try {
      await page.goto('/'); await add(page, 'Flusso di Poiseuille', flow);
      await page.getByRole('button', {name: 'Chiudi proprietà', exact: true}).click();
      const teacher = selectedWorkspace(page), original = (await labs(page))[0]!;
      const first = await fresh('STUDENT_A'), peer = await fresh('STUDENT_B');
      for (const account of [first.account, peer.account]) {
        await api(page.context().request, {action: 'learning-command', workspaceId: teacher.workspaceId,
          command: {kind: 'assign-lesson', commandId: randomUUID(), documentId: teacher.documentId, studentId: account.id, expectedRevision: 0}}, teacher.account.id);
      }
      const student = await first.context.newPage(); student.on('pageerror', error => errors.push(error.message));
      await student.goto('/');
      await student.getByRole('button', {name: 'Modifica Flusso di Poiseuille', exact: true}).click();
      const consent = student.locator('.learner-consent');
      await expect(consent).toContainText('Flusso di Poiseuille');
      await expect(consent).not.toContainText('Molla ideale');
      await student.getByLabel('Leggere il mio stato scientifico', {exact: true}).check();
      await student.getByLabel('Modificare e salvare i parametri', {exact: true}).check();
      await student.getByRole('button', {name: 'Autorizza laboratorio', exact: true}).click();
      const inspector = student.getByRole('complementary', {name: 'Proprietà del laboratorio'});
      await expect(inspector).toHaveAttribute('data-plugin-status', 'ready');
      await inspector.getByLabel('Viscosità dinamica (Pa·s)', {exact: true}).fill('0.0015');
      await inspector.getByRole('button', {name: 'Salva laboratorio', exact: true}).click();
      await expect.poll(async () => (await personalProjection(student)).learnerWork[0]?.labs[0]?.data.state.value).toMatchObject({viscosityPaS: 0.0015});
      const saved = (await personalProjection(student)).learnerWork[0]!.labs[0]!;
      expect(saved.data.instanceId).toBe(original.data.instanceId); expect(saved.data.bundleDigest).toBe(original.data.bundleDigest);
      expect((await labs(page))[0]).toEqual(original);
      expect((await storedWorkspace(page)).learnerWork).toEqual([]);
      const other = await peer.context.newPage(); await other.goto('/');
      expect((await personalProjection(other)).learnerWork).toEqual([]);
      const resumed = await fresh('STUDENT_A'), reopened = await resumed.context.newPage();
      reopened.on('pageerror', error => errors.push(error.message));
      await reopened.goto('/');
      await reopened.getByRole('button', {name: 'Modifica Flusso di Poiseuille', exact: true}).click();
      await expect(reopened.getByLabel('Viscosità dinamica (Pa·s)', {exact: true})).toHaveValue('0.0015');
      expect((await personalProjection(reopened)).learnerWork[0]!.labs[0]).toEqual(saved);
      await reopened.screenshot({path: testInfo.outputPath(`m4-learner-${flow ? 'flow' : 'pressure'}.png`), fullPage: true});
      await reopened.getByRole('button', {name: 'Revoca consenso laboratorio', exact: true}).click();
      await expect(reopened.getByRole('heading', {name: 'Autorizza questo laboratorio', exact: true})).toBeVisible();
      const before = await personalProjection(reopened);
      const denied = await rawApi(first.context.request, {action: 'learning-command', workspaceId: teacher.workspaceId,
        command: {kind: 'save-learner-lab', commandId: randomUUID(), documentId: teacher.documentId, expectedRevision: before.learnerWork[0]!.revision,
          expectedDocumentRevision: before.assignedDocuments[0]!.revision, objectId: original.id, instanceId: original.data.instanceId, state: saved.data.state}}, first.account.id);
      expect(denied.payload.error?.code).toBe('PLUGIN_CONSENT_REQUIRED');
      expect(await personalProjection(reopened)).toEqual(before);
      expect((await labs(page))[0]).toEqual(original); expect(errors).toEqual([]);
    } finally {for (const context of contexts) await context.close();}
  });
}
