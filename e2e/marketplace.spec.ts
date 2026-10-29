import type {Page} from '@playwright/test';
import {test, expect, mutateReadProjection, selectedWorkspace, rawApi} from './fixtures';
import {
  addMarketplaceSpring, authorizeSpring, openMarketplace, readConsentLabel,
  springId, storedBytes, storedSpring, storedWorkspace,
  verifyAndInstallSpring, writeConsentLabel,
} from './marketplace-helpers';

async function saveFourKilograms(page: Page): Promise<void> {
  const inspector = page.getByRole('complementary', {name: 'Proprietà del laboratorio', exact: true});
  await inspector.getByLabel('Massa (kg)', {exact: true}).fill('4');
  await inspector.getByRole('button', {name: 'Salva laboratorio', exact: true}).click();
  await expect(inspector.getByLabel('Massa (kg)', {exact: true})).toHaveValue('4');
  await expect(inspector.locator('.science-metrics div').filter({hasText: 'Periodo'})).toContainText('2,8099');
  await expect.poll(async () => (await storedSpring(page)).revision).toBe(2);
  await expect(inspector).toHaveAttribute('data-plugin-status', 'ready');
  await expect(inspector.getByRole('button', {name: 'Ripristina stato salvato', exact: true})).toHaveCount(0);
  await expect(inspector.getByRole('button', {name: 'Salva laboratorio', exact: true})).toBeDisabled();
  await expect(page.locator('.app-footer [role="status"]')).toContainText('Confermato dal server');
  await expect.poll(() => page.workers().length).toBeGreaterThan(0);
}

test('[M2] marketplace installs consents activates saves reopens and disables', async ({page}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Bozza personale', {exact: true})).toBeVisible();
  await openMarketplace(page);
  await page.getByRole('textbox', {name: 'Cerca moduli', exact: true}).fill('molla');
  await verifyAndInstallSpring(page);
  const installed = (await storedWorkspace(page)).installations[0]!;
  expect(installed).toMatchObject({pluginId: springId, status: 'installed', revision: 1, consent: null});
  expect(installed.release).toMatchObject({version: '1.0.0', publisher: {id: 'ardesia'}, sdkVersion: '1.0.0', stateSchemaVersion: '1.0.0'});
  expect(installed.release.license.length).toBeGreaterThan(0);
  expect(installed.release.provenance.commit).toMatch(/^[a-f0-9]{40}$/);
  await authorizeSpring(page);
  await page.getByRole('button', {name: 'Attiva Molla ideale', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Aggiungi molla alla lezione', exact: true})).toBeEnabled();
  await page.screenshot({path: `artifacts/${testInfo.project.name}-m2-marketplace.png`, fullPage: true});
  await page.getByRole('button', {name: 'Aggiungi molla alla lezione', exact: true}).click();
  await expect(page.getByRole('complementary', {name: 'Proprietà del laboratorio', exact: true})).toHaveAttribute('data-plugin-status', 'ready');
  const original = await storedSpring(page);
  await saveFourKilograms(page);
  const saved = await storedSpring(page);
  expect(saved.id).toBe(original.id);
  expect(saved.data.instanceId).toBe(original.data.instanceId);
  expect(saved.data.state.value).toMatchObject({massKg: 4});
  const savedWorkspace = await storedWorkspace(page);
  expect(savedWorkspace.installations[0]).toMatchObject({status: 'active', consent: {actorId: selectedWorkspace(page).actor.actorId, capabilities: ['state:read', 'state:write']}});
  expect(savedWorkspace.installations[0]!.consent!.release).toEqual(savedWorkspace.installations[0]!.release);
  await page.reload();
  await page.getByRole('button', {name: 'Apri Molla ideale', exact: true}).click();
  await expect(page.getByLabel('Massa (kg)', {exact: true})).toHaveValue('4');
  expect(await storedWorkspace(page)).toEqual(savedWorkspace);
  await openMarketplace(page);
  await page.getByRole('button', {name: 'Disattiva Molla ideale', exact: true}).click();
  await expect.poll(async () => (await storedWorkspace(page)).installations[0]!.status).toBe('disabled');
  await expect.poll(() => page.workers().length).toBe(0);
  expect(await storedSpring(page)).toEqual(saved);
  await page.reload();
  await expect(page.getByRole('button', {name: 'Apri Molla ideale', exact: true})).toBeVisible();
  expect(await storedSpring(page)).toEqual(saved);
  expect((await storedWorkspace(page)).installations[0]).toMatchObject({status: 'disabled'});
  expect(page.workers()).toHaveLength(0);
  // The same installation can be reactivated; no duplicate object or fresh consent is invented.
  await openMarketplace(page);
  await page.getByRole('button', {name: 'Attiva Molla ideale', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Disattiva Molla ideale', exact: true})).toBeEnabled();
  await page.getByRole('button', {name: 'Chiudi finestra', exact: true}).click();
  await page.getByRole('button', {name: 'Apri Molla ideale', exact: true}).click();
  await expect(page.getByLabel('Massa (kg)', {exact: true})).toHaveValue('4');
  expect(await storedSpring(page)).toEqual(saved);
  await openMarketplace(page);
  await page.getByRole('button', {name: 'Disattiva Molla ideale', exact: true}).click();
  await expect.poll(async () => (await storedWorkspace(page)).installations[0]!.status).toBe('disabled');
  expect(await page.evaluate(() => localStorage.getItem('ardesia-next.core.v1'))).toBeNull();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('ardesia-next.pending.v1.')))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('[M2] verification and installation execute no plugin code', async ({page}) => {
  const workers: string[] = [];
  page.on('worker', worker => workers.push(worker.url()));
  await page.goto('/');
  await expect(page.getByText('Bozza personale', {exact: true})).toBeVisible();
  const before = await storedWorkspace(page);
  await openMarketplace(page);
  await verifyAndInstallSpring(page);
  const installed = await storedWorkspace(page);
  expect(installed.documents).toEqual(before.documents);
  expect(installed.installations[0]).toMatchObject({status: 'installed', consent: null});
  expect(workers).toEqual([]);
  await page.reload();
  expect(await storedWorkspace(page)).toEqual(installed);
  await openMarketplace(page);
  await expect(page.getByRole('checkbox', {name: readConsentLabel, exact: true})).not.toBeChecked();
  await expect(page.getByRole('checkbox', {name: writeConsentLabel, exact: true})).not.toBeChecked();
  await expect(page.getByRole('button', {name: 'Attiva Molla ideale', exact: true})).toBeDisabled();
  await authorizeSpring(page);
  expect((await storedWorkspace(page)).installations[0]!.status).not.toBe('active');
  expect(workers).toEqual([]);
});

test('[M2] denied capabilities prevent activation and preserve data', async ({page}) => {
  let workers = 0;
  page.on('worker', () => workers++);
  await page.goto('/');
  await expect(page.getByText('Bozza personale', {exact: true})).toBeVisible();
  await openMarketplace(page);
  await verifyAndInstallSpring(page);
  const before = await storedBytes(page);
  await page.getByRole('checkbox', {name: readConsentLabel, exact: true}).check();
  await page.getByRole('button', {name: 'Salva autorizzazioni', exact: true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('PLUGIN_CONSENT_REQUIRED');
  await expect(page.getByRole('button', {name: 'Attiva Molla ideale', exact: true})).toBeDisabled();
  expect(await storedBytes(page)).toBe(before);
  expect((await storedWorkspace(page)).installations[0]!.consent).toBeNull();
  expect(workers).toBe(0);
});

for (const mutation of ['signature', 'bundle'] as const) {
  test(mutation === 'signature'
    ? '[M2] tampered signature is refused without modifying saved data'
    : '[M2] altered bundle is refused without modifying saved data', async ({page}) => {
    let workers = 0;
    page.on('worker', () => workers++);
    await page.goto('/');
  await expect(page.getByText('Bozza personale', {exact: true})).toBeVisible();
    const before = await storedBytes(page);
    if (mutation === 'signature') {
      await page.route('**/plugins/catalog.json', async route => {
        const response = await route.fetch();
        const catalog = await response.json();
        for (const entry of catalog.entries) if (entry.kind === 'plugin') entry.manifest.signature.value = 'A'.repeat(86) + '==';
        await route.fulfill({response, json: catalog});
      });
      await page.route('**/plugins/ideal-spring/1.0.0/manifest.json', async route => {
        const response = await route.fetch();
        const manifest = await response.json();
        manifest.signature.value = 'A'.repeat(86) + '==';
        await route.fulfill({response, json: manifest});
      });
    } else {
      await page.route('**/plugins/ideal-spring/1.0.0/plugin.js', async route => {
        const response = await route.fetch();
        await route.fulfill({response, body: (await response.text()) + '\n/* deliberately altered artifact */'});
      });
    }
    await openMarketplace(page);
    await page.getByRole('button', {name: 'Verifica Molla ideale', exact: true}).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(mutation === 'signature' ? 'INVALID_SIGNATURE' : 'INTEGRITY_MISMATCH');
    expect(await storedBytes(page)).toBe(before);
    expect(workers).toBe(0);
  });
}

test('[M2] revoked publisher stops reopening and preserves data', async ({page}) => {
  await addMarketplaceSpring(page);
  await saveFourKilograms(page);
  const before = await storedBytes(page);
  const saved = await storedSpring(page);
  expect(page.workers().length).toBeGreaterThan(0);
  await page.route('**/plugins/revocations.json', async route => {
    const response = await route.fetch();
    const revocations = await response.json();
    revocations.revision += 1;
    revocations.revokedPublishers = ['ardesia'];
    await route.fulfill({response, json: revocations});
  });
  await openMarketplace(page);
  await page.getByRole('button', {name: 'Verifica Molla ideale', exact: true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('REVOKED_PUBLISHER');
  await expect.poll(() => page.workers().length).toBe(0);
  expect(await storedBytes(page)).toBe(before);
  await page.reload();
  await page.getByRole('button', {name: 'Apri Molla ideale', exact: true}).click();
  const inspector = page.getByRole('complementary', {name: 'Proprietà del laboratorio', exact: true});
  await expect(inspector).toHaveAttribute('data-plugin-status', 'error');
  await expect(inspector).toHaveAttribute('data-error-code', 'REVOKED_PUBLISHER');
  expect(page.workers()).toHaveLength(0);
  expect(await storedBytes(page)).toBe(before);
  expect(await storedSpring(page)).toEqual(saved);
});

test('[M2] incompatible SDK is refused without modifying saved data', async ({page}) => {
  let workers = 0;
  page.on('worker', () => workers++);
  await page.goto('/');
  await expect(page.getByText('Bozza personale', {exact: true})).toBeVisible();
  const before = await storedBytes(page);
  await page.route('**/plugins/ideal-spring/1.0.0/manifest.json', async route => {
    const response = await route.fetch();
    const manifest = await response.json();
    manifest.sdkVersion = '2.0.0';
    await route.fulfill({response, json: manifest});
  });
  await openMarketplace(page);
  await page.getByRole('button', {name: 'Verifica Molla ideale', exact: true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(/SDK_INCOMPATIBLE|INVALID_MANIFEST|CATALOG_MISMATCH/);
  expect(await storedBytes(page)).toBe(before);
  expect(workers).toBe(0);
});

test('[M2] invalid state is refused without destroying the saved experiment', async ({page}) => {
  await addMarketplaceSpring(page);
  await saveFourKilograms(page);
  const installation = (await storedWorkspace(page)).installations[0];
  await page.getByRole('button', {name: 'Chiudi proprietà', exact: true}).click();
  const confirmed = await storedBytes(page);
  const intercepted = await mutateReadProjection(page, projection => {
    const object = projection.documents.flatMap(document => document.objects).find(object => object.type === 'lab');
    if (object?.type !== 'lab') throw new Error('The authenticated server response did not contain the persisted laboratory.');
    object.data.state.value = {...object.data.state.value as {massKg: number}, massKg: -1};
  });
  await page.reload();
  await page.getByRole('button', {name: 'Apri Molla ideale', exact: true}).click();
  const inspector = page.getByRole('complementary', {name: 'Proprietà del laboratorio', exact: true});
  await expect(inspector).toHaveAttribute('data-plugin-status', 'error');
  await expect(inspector).toHaveAttribute('data-error-code', 'INVALID_STATE');
  await expect(inspector.getByRole('button', {name: 'Salva laboratorio', exact: true})).toBeDisabled();
  expect(intercepted()).toBeGreaterThan(0);
  expect(await storedBytes(page)).toBe(confirmed);
  expect((await storedWorkspace(page)).installations[0]).toEqual(installation);
});

test('[M2] unauthorized update preserves the installed release and experiment', async ({page}) => {
  await addMarketplaceSpring(page);
  await saveFourKilograms(page);
  const before = await storedBytes(page);
  const saved = await storedSpring(page);
  await page.route('**/plugins/catalog.json', async route => {
    const response = await route.fetch();
    const catalog = await response.json();
    catalog.revision += 1;
    for (const entry of catalog.entries) if (entry.kind === 'plugin') entry.manifest.version = '9.9.9';
    await route.fulfill({response, json: catalog});
  });
  await page.route('**/plugins/ideal-spring/1.0.0/manifest.json', async route => {
    const response = await route.fetch();
    const manifest = await response.json();
    manifest.version = '9.9.9';
    await route.fulfill({response, json: manifest});
  });
  await openMarketplace(page);
  await page.getByRole('button', {name: 'Controlla aggiornamenti', exact: true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('RELEASE_NOT_ALLOWED');
  expect(await storedBytes(page)).toBe(before);
  expect(await storedSpring(page)).toEqual(saved);
  expect((await storedWorkspace(page)).installations[0]!.release.version).toBe('1.0.0');
});

test('[M2] failed persistence preserves installation consent and experiment', async ({page}) => {
  await addMarketplaceSpring(page);
  await saveFourKilograms(page);
  const before = await storedBytes(page);
  const saved = await storedSpring(page);
  let refused = 0;
  await page.route('**/api/m3', async route => {
    if (route.request().method() === 'POST' && route.request().postDataJSON()?.action === 'plugin-command') {
      refused++; await route.abort('connectionfailed');
    } else await route.continue();
  });
  await openMarketplace(page);
  await page.getByRole('button', {name: 'Disattiva Molla ideale', exact: true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('NETWORK_ERROR');
  await expect(page.locator('.remote-status')).toContainText('Salvataggio da verificare');
  await expect(page.getByRole('heading', {name: 'Modifiche in attesa di conferma', exact: true})).toBeVisible();
  expect(refused).toBe(1);
  expect(await storedBytes(page)).toBe(before);
  expect((await storedWorkspace(page)).installations[0]!.status).toBe('active');
  expect(await storedSpring(page)).toEqual(saved);
  await page.unroute('**/api/m3');
  await page.reload();
  await page.getByRole('button', {name: 'Apri Molla ideale', exact: true}).click();
  await expect(page.getByLabel('Massa (kg)', {exact: true})).toHaveValue('4');
  expect(await storedBytes(page)).toBe(before);
});

test('[M2] revoked module stays revoked after reload without deleting its state', async ({page}) => {
  await addMarketplaceSpring(page);
  await saveFourKilograms(page);
  const saved = await storedSpring(page);
  await openMarketplace(page);
  await page.getByText('Revoca del modulo', {exact: true}).click();
  await page.getByRole('button', {name: 'Revoca Molla ideale', exact: true}).click();
  await expect.poll(async () => (await storedWorkspace(page)).installations[0]!.status).toBe('revoked');
  expect((await storedWorkspace(page)).installations[0]!.consent).toBeNull();
  await expect.poll(() => page.workers().length).toBe(0);
  expect(await storedSpring(page)).toEqual(saved);
  const revoked = await storedBytes(page);
  await page.reload();
  await page.getByRole('button', {name: 'Apri Molla ideale', exact: true}).click();
  await expect(page.getByRole('complementary', {name: 'Proprietà del laboratorio', exact: true})).toHaveAttribute('data-plugin-status', 'error');
  expect(await storedBytes(page)).toBe(revoked);
  expect(await storedSpring(page)).toEqual(saved);
  expect(page.workers()).toHaveLength(0);
  await openMarketplace(page);
  await expect(page.getByText('Revocato', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Attiva Molla ideale', exact: true})).toHaveCount(0);
});

test('[M2] stale tab stops runtime after another tab disables module', async ({page, context}) => {
  await addMarketplaceSpring(page);
  await saveFourKilograms(page);
  const saved = await storedSpring(page), selected = selectedWorkspace(page);
  const beforeRevision = (await storedWorkspace(page)).installations[0]!.revision;
  expect(page.workers().length).toBeGreaterThan(0);

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByRole('button', {name: 'Apri Molla ideale', exact: true})).toBeVisible();
  await openMarketplace(second);
  await second.getByRole('button', {name: 'Disattiva Molla ideale', exact: true}).click();
  await expect.poll(async () => (await storedWorkspace(second)).installations[0]!.status).toBe('disabled');
  const committed = await storedBytes(second);
  const inspector = page.getByRole('complementary', {name: 'Proprietà del laboratorio', exact: true});
  await expect.poll(() => page.workers().length, {timeout: 15_000}).toBe(0);
  await expect(inspector).toHaveAttribute('data-plugin-status', 'error');
  await expect(inspector).toHaveAttribute('data-error-code', /PLUGIN_DISABLED|STALE_WORKSPACE/);
  await expect(inspector.getByRole('button', {name: 'Salva laboratorio', exact: true})).toBeDisabled();
  expect(await storedBytes(page)).toBe(committed);
  expect(await storedSpring(page)).toEqual(saved);

  // A known old installation revision cannot reactivate the module through a direct authenticated request.
  const stale = await rawApi(context.request, {action: 'plugin-command', workspaceId: selected.workspaceId,
    command: {kind: 'activate-plugin', commandId: 'stale-' + crypto.randomUUID(), pluginId: springId, expectedRevision: beforeRevision}}, selected.account.id);
  expect(stale.status).toBe(409);
  expect(stale.payload).toMatchObject({ok: false, error: {code: 'REVISION_CONFLICT'}});
  expect(await storedBytes(page)).toBe(committed);

  await page.reload();
  await page.getByRole('button', {name: 'Apri Molla ideale', exact: true}).click();
  await expect(inspector).toHaveAttribute('data-error-code', 'PLUGIN_DISABLED');
  expect(page.workers()).toHaveLength(0);

  // Hold an actual activation request, then let another session activate and disable.
  // The old request must be rejected by the real transaction after it is released.
  let releaseCommand!: () => void, reportRequest!: () => void;
  const held = new Promise<void>(resolve => {releaseCommand = resolve;});
  const requested = new Promise<void>(resolve => {reportRequest = resolve;});
  let staleCommandId: string | null = null, newWorkers = 0;
  page.on('worker', () => {newWorkers++;});
  await page.route('**/api/m3', async route => {
    const input = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
    if (input?.action === 'plugin-command' && input.command.kind === 'activate-plugin') {
      staleCommandId = input.command.commandId; reportRequest(); await held;
    }
    await route.continue();
  });
  let latestCommit: string | null = null;
  try {
    await openMarketplace(page);
    await page.getByRole('button', {name: 'Attiva Molla ideale', exact: true}).click();
    await requested;
    await second.getByRole('button', {name: 'Attiva Molla ideale', exact: true}).click();
    await expect(second.getByRole('button', {name: 'Disattiva Molla ideale', exact: true})).toBeEnabled();
    await second.getByRole('button', {name: 'Disattiva Molla ideale', exact: true}).click();
    await expect.poll(async () => (await storedWorkspace(second)).installations[0]!.status).toBe('disabled');
    latestCommit = await storedBytes(second);
  } finally {releaseCommand();}
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('REVISION_CONFLICT');
  expect(staleCommandId).not.toBeNull();
  expect(newWorkers).toBe(0);
  expect(page.workers()).toHaveLength(0);
  expect(await storedBytes(page)).toBe(latestCommit);
  expect(await storedSpring(page)).toEqual(saved);
  await second.close();
});
