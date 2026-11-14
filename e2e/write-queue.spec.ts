import {randomUUID} from 'node:crypto';
import type {Page, Request} from '@playwright/test';
import type {CommandReceipt, CoreCommand} from '@ardesia/contracts';
import type {PendingCommand, WorkspaceProjection} from '@ardesia/remote-client';
import {api, expect, personalProjection, selectedWorkspace, test} from './fixtures';
import {continueRouteWithAccess, fetchRouteWithAccess, isRemoteExecution, readApiJson} from './remote-access';

type InkRequest = {action: 'command'; workspaceId: string; command: Extract<CoreCommand, {kind: 'add-object'}>};
type Attempt = {request: InkRequest; accountId: string | undefined; status?: number; receipt?: CommandReceipt; errorCode?: string};

function inkRequest(request: Request): InkRequest | null {
  if (request.method() !== 'POST') return null;
  const body = request.postDataJSON();
  return body?.action === 'command' && body.command?.kind === 'add-object' && body.command.object?.type === 'ink'
    ? structuredClone(body) as InkRequest : null;
}

/** The held request always reaches the real handler. Only response delivery is fault-injected. */
async function holdFirstInk(page: Page, mode: 'confirm' | 'conflict' | 'lose-response') {
  const attempts: Attempt[] = [];
  let release!: () => void, waiting = false;
  const released = new Promise<void>(resolve => {release = () => resolve();});
  await page.route('**/api/m3', async route => {
    const request = inkRequest(route.request());
    if (!request) {await continueRouteWithAccess(route); return;}
    const attempt: Attempt = {request, accountId: route.request().headers()['x-ardesia-account']};
    attempts.push(attempt);
    const first = attempts.length === 1;
    // A competing real writer advances the document before this stale request is sent.
    if (first && mode === 'conflict') {waiting = true; await released;}
    const response = await fetchRouteWithAccess(route);
    try {
      const body = await readApiJson(response);
      attempt.status = response.status();
      if (body.ok === true) attempt.receipt = body.result.receipt as CommandReceipt;
      else attempt.errorCode = body.error?.code;
      if (first && mode !== 'conflict') {waiting = true; await released;}
      if (first && mode === 'lose-response') await route.abort('failed');
      else await route.fulfill({response});
    } finally {await response.dispose();}
  });
  return {attempts, release, waiting: () => waiting};
}

const recoveryPanel = (page: Page) => page.getByRole('region', {name: 'Modifiche da recuperare', exact: true});
async function recovery(page: Page): Promise<PendingCommand[]> {
  const accountId = selectedWorkspace(page).account.id;
  return page.evaluate(id => {
    // Observe the durable bytes only. Do not import or call the client's recovery
    // implementation: UI actions below must independently prove their behavior.
    const namespace = `ardesia-next.pending.v1.${encodeURIComponent(id)}`;
    const legacy: PendingCommand[] = JSON.parse(localStorage.getItem(namespace) ?? '[]');
    if (!Array.isArray(legacy)) throw new Error('Invalid legacy recovery array');
    const values = new Map<string, PendingCommand>();
    function checked(entry: PendingCommand, commandId?: string) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || entry.accountId !== id
        || typeof entry.commandId !== 'string' || !entry.commandId
        || commandId !== undefined && entry.commandId !== commandId) throw new Error('Invalid recovery identity');
      return entry;
    }
    for (const entry of legacy) {
      checked(entry);
      if (values.has(entry.commandId)) throw new Error('Duplicate legacy recovery ID');
      values.set(entry.commandId, entry);
    }
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(namespace + '/')) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      const commandId = decodeURIComponent(key.slice(namespace.length + 1));
      const entry: PendingCommand | null = JSON.parse(raw);
      if (entry === null) values.delete(commandId);
      else values.set(commandId, checked(entry, commandId));
    }
    // localStorage enumeration has no ordering contract. A predecessor must
    // precede its successor even when its row happens to be enumerated last.
    const ordered = new Map<string, PendingCommand>(), visiting = new Set<string>();
    function visit(entry: PendingCommand) {
      if (ordered.has(entry.commandId)) return;
      if (visiting.has(entry.commandId)) throw new Error('Cyclic recovery dependency');
      visiting.add(entry.commandId);
      const predecessor = entry.edit?.predecessorId ? values.get(entry.edit.predecessorId) : undefined;
      if (predecessor) visit(predecessor);
      visiting.delete(entry.commandId);
      ordered.set(entry.commandId, entry);
    }
    for (const entry of [...values.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.commandId.localeCompare(b.commandId))) visit(entry);
    return [...ordered.values()];
  }, accountId);
}
const documentOf = (projection: WorkspaceProjection, page: Page) => projection.documents.find(document => document.id === selectedWorkspace(page).documentId)!;
const inksOf = (projection: WorkspaceProjection, page: Page) => documentOf(projection, page).objects.filter(object => object.type === 'ink');

async function drawStroke(page: Page, offset: number) {
  const surface = page.locator('.board-surface');
  // The recovery banner changes the page height while the first response is held.
  await surface.evaluate(element => element.scrollIntoView({block: 'start'}));
  const box = await surface.boundingBox();
  if (!box) throw new Error('Missing drawing surface');
  await page.mouse.move(box.x + 100 + offset, box.y + 430);
  await page.mouse.down();
  await page.mouse.move(box.x + 200 + offset, box.y + 460, {steps: 6});
  await page.mouse.up();
}

async function expectUnconfirmed(page: Page) {
  await expect(recoveryPanel(page)).toBeAttached();
  await expect(page.locator('.app-footer [role="status"]')).not.toContainText('Confermato dal server');
  await expect(page.locator('.remote-status')).not.toContainText('Confermato dal server');
}

async function drawPair(page: Page, held: Awaited<ReturnType<typeof holdFirstInk>>) {
  await page.getByRole('button', {name: 'Penna', exact: true}).click();
  await drawStroke(page, 0);
  await expect.poll(held.waiting).toBe(true);
  await drawStroke(page, 170);
  await expect.poll(async () => (await recovery(page)).length).toBe(2);
  expect(held.attempts).toHaveLength(1);
  const records = await recovery(page);
  expect(new Set(records.map(record => record.commandId)).size).toBe(2);
  await expectUnconfirmed(page);
  return records;
}

test.describe('[M3 queue] acknowledgement and explicit recovery', () => {
  // Pen input is intentionally available only on the wide board. Both configured
  // Chromium projects exercise it without changing the mobile device's input flags.
  test.use({viewport: {width: 1440, height: 960}});
  test.setTimeout(60_000);
  test.beforeEach(async ({page}) => {
    expect(isRemoteExecution()).toBe(false);
    await page.goto('/');
    await expect(page.getByRole('heading', {name: 'Oscillazioni: osserva, misura, spiega', exact: true})).toBeVisible();
  });

  test('two rapid strokes advance only after the preceding positive acknowledgement', async ({page}) => {
    const before = await personalProjection(page), initialRevision = documentOf(before, page).revision;
    const held = await holdFirstInk(page, 'confirm');
    try {
      const records = await drawPair(page, held);
      expect(inksOf(await personalProjection(page), page)).toHaveLength(1);
      expect(held.attempts[0]!.status).toBe(200);
      held.release();

      await expect.poll(async () => inksOf(await personalProjection(page), page).length).toBe(2);
      await expect(recoveryPanel(page)).toHaveCount(0);
      await expect(page.locator('.app-footer [role="status"]')).toContainText('Confermato dal server');
      await expect(page.locator('.remote-status')).toContainText('Confermato dal server');
      const after = await personalProjection(page);
      expect(documentOf(after, page).revision).toBe(initialRevision + 2);
      expect(after.events).toHaveLength(before.events.length + 2);
      expect(held.attempts).toHaveLength(2);
      expect(held.attempts.map(attempt => attempt.request.command.commandId)).toEqual(records.map(record => record.commandId));
      expect(held.attempts.map(attempt => attempt.request.command.expectedRevision)).toEqual([initialRevision, initialRevision + 1]);
      expect(held.attempts.map(attempt => attempt.receipt?.documentRevision)).toEqual([initialRevision + 1, initialRevision + 2]);
      expect(held.attempts.every(attempt => attempt.accountId === selectedWorkspace(page).account.id)).toBe(true);
      for (const attempt of held.attempts) expect(after.events.filter(event => event.id === attempt.receipt!.eventId)).toHaveLength(1);
      await page.reload();
      await expect(page.getByRole('button', {name: 'Apri Annotazione a penna', exact: true})).toHaveCount(2);
    } finally {held.release();}
  });

  test('a real revision conflict preserves both intents and never sends the successor, including after reload', async ({page}) => {
    const before = await personalProjection(page), document = documentOf(before, page), selected = selectedWorkspace(page);
    const held = await holdFirstInk(page, 'conflict');
    try {
      const records = await drawPair(page, held);
      // This independent authenticated write creates the conflict in PostgreSQL;
      // no fabricated error response or projection is used.
      await api(page.context().request, {action: 'command', workspaceId: selected.workspaceId, command: {
        kind: 'rename-document', commandId: randomUUID(), documentId: document.id,
        expectedRevision: document.revision, title: 'Titolo confermato dal writer concorrente',
      }}, selected.account.id);
      held.release();
      await expect.poll(() => held.attempts[0]?.errorCode).toBe('REVISION_CONFLICT');
      await expect(recoveryPanel(page)).toContainText('Non inviata');
      await expectUnconfirmed(page);
      const committed = await personalProjection(page);
      expect(inksOf(committed, page)).toHaveLength(0);
      expect(documentOf(committed, page).revision).toBe(document.revision + 1);
      expect(documentOf(committed, page).title).toBe('Titolo confermato dal writer concorrente');
      expect(committed.events).toHaveLength(before.events.length + 1);
      expect(held.attempts).toHaveLength(1);
      expect((await recovery(page)).map(record => record.request)).toEqual(records.map(record => record.request));

      await page.reload();
      await expect(recoveryPanel(page).locator('code')).toHaveText(records.map(record => record.commandId));
      await expect(recoveryPanel(page)).toContainText('Non inviata');
      await expectUnconfirmed(page);
      expect((await recovery(page)).map(record => record.request)).toEqual(records.map(record => record.request));
      expect(await personalProjection(page)).toEqual(committed);
      expect(held.attempts).toHaveLength(1);
    } finally {held.release();}
  });

  test('three conflicted strokes are previewed and explicitly recovered against PostgreSQL without changing their content', async ({page}, testInfo) => {
    const before = await personalProjection(page), document = documentOf(before, page), selected = selectedWorkspace(page);
    const held = await holdFirstInk(page, 'conflict');
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await drawPair(page, held); await drawStroke(page, 340);
      await expect.poll(async () => (await recovery(page)).length).toBe(3);
      const originals = await recovery(page), first = originals[0]!.request;
      if (first.action !== 'command' || first.command.kind !== 'add-object') throw Error('Expected ink');
      await api(page.context().request, {action: 'command', workspaceId: selected.workspaceId, command: {
        kind: 'add-object', commandId: randomUUID(), documentId: document.id, expectedRevision: document.revision,
        object: {...first.command.object, id: randomUUID(), title: 'Tratto del writer concorrente', x: first.command.object.x - 30},
      }}, selected.account.id);
      held.release();
      await expect.poll(() => held.attempts[0]?.errorCode).toBe('REVISION_CONFLICT');
      if (testInfo.project.name === 'mobile-chromium') await page.setViewportSize({width: 820, height: 1180});
      await recoveryPanel(page).getByRole('button', {name: 'Anteprima recupero tratti', exact: true}).click();
      const dialog = page.getByRole('dialog', {name: 'Recupera i tuoi tratti', exact: true});
      await expect(dialog.getByRole('button', {name: 'Conferma recupero di 3 tratti', exact: true})).toBeEnabled();
      await expect(dialog.getByRole('img', {name: 'Anteprima dei tratti sulla lezione aggiornata'})).toBeVisible();
      expect(held.attempts).toHaveLength(1); expect(inksOf(await personalProjection(page), page)).toHaveLength(1);
      await page.screenshot({path: testInfo.outputPath('ink-recovery-preview.png'), fullPage: false});

      // Changing the document after preview invalidates this concrete decision.
      const current = documentOf(await personalProjection(page), page);
      await api(page.context().request, {action: 'command', workspaceId: selected.workspaceId, command: {
        kind: 'rename-document', commandId: randomUUID(), documentId: document.id, expectedRevision: current.revision, title: 'Lezione aggiornata durante l’anteprima',
      }}, selected.account.id);
      await dialog.getByRole('button', {name: 'Conferma recupero di 3 tratti', exact: true}).click();
      await expect(dialog.getByRole('alert')).toContainText('nuova anteprima');
      expect(held.attempts).toHaveLength(1);
      await dialog.getByRole('button', {name: 'Rileggi e prepara anteprima', exact: true}).click();
      await expect(dialog).toContainText('Lezione aggiornata durante l’anteprima');
      await dialog.getByRole('button', {name: 'Conferma recupero di 3 tratti', exact: true}).click();
      await expect(dialog).toHaveCount(0); await expect(recoveryPanel(page)).toHaveCount(0);
      const after = await personalProjection(page);
      expect(inksOf(after, page)).toHaveLength(4); expect(held.attempts).toHaveLength(4);
      for (const [index, attempt] of held.attempts.slice(1).entries()) {
        const original = originals[index]!.request;
        if (original.action !== 'command' || original.command.kind !== 'add-object') throw Error('Expected ink');
        expect(attempt.request.command.object).toEqual(original.command.object);
        expect(attempt.request.command.commandId).not.toBe(original.command.commandId);
        expect(attempt.request.command.expectedRevision).toBe(document.revision + 2 + index);
        expect(after.events.filter(event => event.id === attempt.receipt!.eventId)).toHaveLength(1);
      }
      expect(after.events).toHaveLength(before.events.length + 5); expect(await recovery(page)).toEqual([]);
      await page.reload(); await expect(page.getByRole('button', {name: 'Apri Annotazione a penna', exact: true})).toHaveCount(3);
      expect(inksOf(await personalProjection(page), page)).toHaveLength(4); expect(errors).toEqual([]);
    } finally {held.release();}
  });

  test('a replacement committed before response loss reopens with its original and retries the same replacement receipt', async ({page}) => {
    const before = await personalProjection(page), selected = selectedWorkspace(page), document = documentOf(before, page);
    const held = await holdFirstInk(page, 'conflict');
    try {
      const originals = await drawPair(page, held);
      await api(page.context().request, {action: 'command', workspaceId: selected.workspaceId, command: {
        kind: 'rename-document', commandId: randomUUID(), documentId: document.id, expectedRevision: document.revision, title: 'Lezione concorrente',
      }}, selected.account.id);
      held.release(); await expect.poll(() => held.attempts[0]?.errorCode).toBe('REVISION_CONFLICT');
      const replacements: {request: InkRequest; receipt: CommandReceipt}[] = [];
      await page.route('**/api/m3', async route => {
        const request = inkRequest(route.request());
        if (!request) {await continueRouteWithAccess(route); return;}
        const response = await fetchRouteWithAccess(route);
        try {
          const body = await readApiJson(response); expect(body.ok).toBe(true);
          replacements.push({request, receipt: body.result.receipt});
          if (replacements.length === 1) await route.abort('failed'); else await route.fulfill({response});
        } finally {await response.dispose();}
      });
      await recoveryPanel(page).getByRole('button', {name: 'Anteprima recupero tratti', exact: true}).click();
      const dialog = page.getByRole('dialog', {name: 'Recupera i tuoi tratti', exact: true});
      await dialog.getByRole('button', {name: 'Conferma recupero di 2 tratti', exact: true}).click();
      await expect(dialog.getByRole('alert')).toContainText('non confermata');
      expect(replacements).toHaveLength(1); expect(inksOf(await personalProjection(page), page)).toHaveLength(1);
      const retained = await recovery(page);
      expect(retained.map(entry => entry.request)).toEqual(originals.map(entry => entry.request));
      expect(retained[0]?.reconciliation?.attempts[0]?.commandId).toBe(replacements[0]!.request.command.commandId);
      await page.reload();
      await recoveryPanel(page).getByRole('button', {name: 'Verifica e ritenta', exact: true}).click();
      await expect(recoveryPanel(page).locator('code')).toHaveText([originals[1]!.commandId]);
      expect(replacements).toHaveLength(2); expect(replacements[1]).toEqual(replacements[0]);
      await recoveryPanel(page).getByRole('button', {name: 'Anteprima recupero tratti', exact: true}).click();
      await page.getByRole('dialog').getByRole('button', {name: 'Conferma recupero di 1 tratto', exact: true}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0); await expect(recoveryPanel(page)).toHaveCount(0);
      const after = await personalProjection(page);
      expect(inksOf(after, page)).toHaveLength(2); expect(after.events).toHaveLength(before.events.length + 3);
      expect(replacements).toHaveLength(3); expect(await recovery(page)).toEqual([]);
      const last = originals[1]!.request;
      if (last.action !== 'command' || last.command.kind !== 'add-object') throw Error('Expected original ink');
      expect(replacements[2]!.request.command.object).toEqual(last.command.object);
    } finally {held.release();}
  });

  test('a committed response loss requires the identical retry and an explicit separate resume of the unsent stroke', async ({page}) => {
    const before = await personalProjection(page), selected = selectedWorkspace(page);
    const held = await holdFirstInk(page, 'lose-response');
    try {
      const records = await drawPair(page, held), firstId = records[0]!.commandId, secondId = records[1]!.commandId;
      const firstReceipt = held.attempts[0]!.receipt!;
      expect(firstReceipt.commandId).toBe(firstId);
      const committed = await personalProjection(page);
      expect(inksOf(committed, page)).toHaveLength(1);
      expect(committed.events).toHaveLength(before.events.length + 1);
      held.release();
      await expect.poll(async () => (await recovery(page)).find(record => record.commandId === firstId)?.status).toBe('uncertain');
      await expect(recoveryPanel(page)).toContainText('Non inviata');
      await expectUnconfirmed(page);
      expect(held.attempts).toHaveLength(1);

      await page.reload();
      const panel = recoveryPanel(page);
      await expect(panel.locator('code')).toHaveText([firstId, secondId]);
      await expect(panel).toContainText('Non inviata');
      await expectUnconfirmed(page);
      expect((await recovery(page)).map(record => record.request)).toEqual(records.map(record => record.request));
      expect(await personalProjection(page)).toEqual(committed);
      expect(held.attempts).toHaveLength(1);

      await panel.getByRole('button', {name: 'Verifica e ritenta', exact: true}).click();
      await expect(panel.locator('code')).toHaveText([secondId]);
      expect(held.attempts).toHaveLength(2);
      expect(held.attempts[1]!.request).toEqual(held.attempts[0]!.request);
      expect(held.attempts[1]!.accountId).toBe(selected.account.id);
      expect(held.attempts[1]!.receipt).toEqual(firstReceipt);
      expect(await personalProjection(page)).toEqual(committed);
      expect(committed.events.filter(event => event.id === firstReceipt.eventId)).toHaveLength(1);
      await expectUnconfirmed(page);
      await expect(panel).toContainText('Non inviata');

      await panel.getByRole('button', {name: 'Riprendi modifica non inviata', exact: true}).click();
      await expect(panel).toHaveCount(0);
      await expect(page.locator('.app-footer [role="status"]')).toContainText('Confermato dal server');
      await expect(page.locator('.remote-status')).toContainText('Confermato dal server');
      const resolved = await personalProjection(page);
      expect(held.attempts).toHaveLength(3);
      expect(held.attempts[2]!.request.command.commandId).toBe(secondId);
      expect(held.attempts[2]!.accountId).toBe(selected.account.id);
      const unsent = records[1]!.request;
      if (unsent.action !== 'command' || unsent.command.kind !== 'add-object') throw new Error('Expected the original unsent stroke');
      expect(held.attempts[2]!.request.command.object).toEqual(unsent.command.object);
      expect(inksOf(resolved, page)).toHaveLength(2);
      expect(documentOf(resolved, page).revision).toBe(documentOf(before, page).revision + 2);
      expect(resolved.events).toHaveLength(before.events.length + 2);
      expect(resolved.events.filter(event => event.id === firstReceipt.eventId)).toHaveLength(1);
      expect(await recovery(page)).toEqual([]);
      await page.reload();
      await expect(page.getByRole('button', {name: 'Apri Annotazione a penna', exact: true})).toHaveCount(2);
    } finally {held.release();}
  });

  test('already open tabs share the pending barrier and discarding an unsent stroke preserves the peer receipt', async ({page, context}) => {
    const before = await personalProjection(page), peer = await context.newPage();
    await peer.goto('/');
    await expect(peer.getByRole('heading', {name: 'Oscillazioni: osserva, misura, spiega', exact: true})).toBeVisible();
    const lost = await holdFirstInk(peer, 'lose-response');
    const ownAttempts: InkRequest[] = [];
    page.on('request', request => {const body = inkRequest(request); if (body) ownAttempts.push(body);});
    try {
      await peer.getByRole('button', {name: 'Penna', exact: true}).click(); await drawStroke(peer, 170);
      await expect.poll(lost.waiting).toBe(true);
      const lostId = lost.attempts[0]!.request.command.commandId, originalReceipt = lost.attempts[0]!.receipt!;
      await page.getByRole('button', {name: 'Penna', exact: true}).click(); await drawStroke(page, 0);
      await expect.poll(async () => (await recovery(page)).length).toBe(2);
      const originals = await recovery(page), own = originals.find(entry => entry.commandId !== lostId)!;
      expect(own.edit?.predecessorId).toBe(lostId); expect(own.status).toBe('blocked'); expect(ownAttempts).toEqual([]);
      lost.release();
      await expect.poll(async () => (await recovery(page)).find(entry => entry.commandId === lostId)?.status).toBe('uncertain');
      const committed = await personalProjection(page); expect(inksOf(committed, page)).toHaveLength(1);
      expect(committed.events).toHaveLength(before.events.length + 1);
      const row = recoveryPanel(page).locator('code').filter({hasText: own.commandId}).locator('..');
      await row.getByRole('button', {name: 'Scarta comando in attesa', exact: true}).click();
      await expect.poll(async () => (await recovery(page)).map(entry => entry.commandId)).toEqual([lostId]);
      await page.reload(); await expect(recoveryPanel(page).locator('code')).toHaveText([lostId]);
      expect(await personalProjection(page)).toEqual(committed);
      await recoveryPanel(peer).locator('code').filter({hasText: lostId}).locator('..').getByRole('button', {name: 'Verifica e ritenta', exact: true}).click();
      await expect(recoveryPanel(peer)).toHaveCount(0);
      expect(lost.attempts).toHaveLength(2); expect(lost.attempts[1]!.request).toEqual(lost.attempts[0]!.request);
      expect(lost.attempts[1]!.receipt).toEqual(originalReceipt);
      expect(await personalProjection(page)).toEqual(committed); expect(await recovery(page)).toEqual([]); expect(ownAttempts).toEqual([]);
    } finally {lost.release(); await peer.close();}
  });
});
