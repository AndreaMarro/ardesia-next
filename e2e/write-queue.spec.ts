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

  test('two already open tabs preserve separate recovery intents when one tab discards its conflicted write', async ({page, context}) => {
    const before = await personalProjection(page), peer = await context.newPage();
    await peer.goto('/');
    await expect(peer.getByRole('heading', {name: 'Oscillazioni: osserva, misura, spiega', exact: true})).toBeVisible();
    const lost = await holdFirstInk(page, 'lose-response'), stale = await holdFirstInk(peer, 'conflict');
    try {
      // Capture B's original revision before A commits. Both clients were opened
      // before either intent existed, so neither may overwrite the other's row.
      await peer.getByRole('button', {name: 'Penna', exact: true}).click();
      await drawStroke(peer, 170);
      await expect.poll(stale.waiting).toBe(true);
      await page.getByRole('button', {name: 'Penna', exact: true}).click();
      await drawStroke(page, 0);
      await expect.poll(lost.waiting).toBe(true);
      const lostId = lost.attempts[0]!.request.command.commandId, staleId = stale.attempts[0]!.request.command.commandId;
      expect(lostId).not.toBe(staleId);
      await expect.poll(async () => (await recovery(page)).map(entry => entry.commandId).sort()).toEqual([lostId, staleId].sort());
      const originalReceipt = lost.attempts[0]!.receipt!;
      expect(originalReceipt.commandId).toBe(lostId);
      lost.release(); stale.release();
      await expect.poll(() => stale.attempts[0]?.errorCode).toBe('REVISION_CONFLICT');
      await expect.poll(async () => (await recovery(page)).find(entry => entry.commandId === lostId)?.status).toBe('uncertain');
      await expect.poll(async () => (await recovery(page)).find(entry => entry.commandId === staleId)?.status).toBe('conflict');
      const records = await recovery(page);
      expect(records.find(entry => entry.commandId === lostId)?.request).toEqual(lost.attempts[0]!.request);
      expect(records.find(entry => entry.commandId === staleId)?.request).toEqual(stale.attempts[0]!.request);
      const committed = await personalProjection(page);
      expect(inksOf(committed, page)).toHaveLength(1);
      expect(committed.events).toHaveLength(before.events.length + 1);

      await recoveryPanel(peer).getByRole('button', {name: 'Scarta comando in attesa', exact: true}).click();
      await expect(recoveryPanel(peer)).toHaveCount(0);
      expect((await recovery(page)).map(entry => entry.commandId)).toEqual([lostId]);
      await page.reload();
      await expect(recoveryPanel(page).locator('code')).toHaveText([lostId]);
      await expectUnconfirmed(page);
      expect(await personalProjection(page)).toEqual(committed);
      expect(lost.attempts).toHaveLength(1);
      expect(stale.attempts).toHaveLength(1);

      await recoveryPanel(page).getByRole('button', {name: 'Verifica e ritenta', exact: true}).click();
      await expect(recoveryPanel(page)).toHaveCount(0);
      expect(lost.attempts).toHaveLength(2);
      expect(lost.attempts[1]!.request).toEqual(lost.attempts[0]!.request);
      expect(lost.attempts[1]!.receipt).toEqual(originalReceipt);
      expect(await personalProjection(page)).toEqual(committed);
      expect(await recovery(page)).toEqual([]);
      expect(stale.attempts).toHaveLength(1);
    } finally {lost.release(); stale.release(); await peer.close();}
  });
});
