import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {arch, cpus, platform, release, totalmem} from 'node:os';
import type {BrowserContext, Page, Request} from '@playwright/test';
import {CommandReceiptSchema, type CommandReceipt, type CoreCommand, type LessonDocument, type NewEducationalObject} from '@ardesia/contracts';
import type {InkDraft, PendingCommand, WorkspaceProjection} from '@ardesia/remote-client';
import {test, expect, personalProjection, selectedWorkspace, apiOrigin} from './fixtures';
import {resolveE2ETarget} from './target';

// Fail before any automatic fixture can provision a workspace against another target.
if (resolveE2ETarget().mode !== 'local') throw Error('The synthetic lesson workload requires the local E2E target.');

const ONLINE = 100, OFFLINE = 20, SAMPLES = 96, TOTAL = ONLINE + OFFLINE;
const COLOR = '#203e62', WIDTH = 2.5;
type Ink = Extract<NewEducationalObject, {type: 'ink'}>;
type InkCommand = Extract<CoreCommand, {kind: 'add-object'}> & {object: Ink};
type InkRequest = {action: 'command'; workspaceId: string; command: InkCommand};
type Scope = {accountId: string; workspaceId: string; documentId: string};
type EventKind = 'pointerdown' | 'pointermove' | 'pointerup';
type Gesture = {
  index: number; phase: 'online' | 'offline'; object: Ink;
  firstWorld: {x: number; y: number};
  input: {dx: number; dy: number; pressure: number}[];
  handler: {kind: EventKind; ms: number}[];
  pointerUpEpochMs: number; pendingObserved: number;
};
type Attempt = {
  request: InkRequest; accountId?: string; status?: number; receipt?: CommandReceipt;
  failure?: string; responseEndEpochMs?: number; requestToResponseBodyMs?: number;
};
type RecoveryRow = {key: string; raw: string; value: PendingCommand};

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]! : null;
  return {n: sorted.length, min: sorted[0] ?? null, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99),
    max: sorted.at(-1) ?? null, mean: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null};
}

/** Passive observers: no routes, fabricated responses, artificial network delay, or Core writes. */
function observeCommands(context: BrowserContext, scope: Scope) {
  const attempts: Attempt[] = [], requests = new Map<Request, Attempt>(), tasks = new Set<Promise<void>>();
  const violations: string[] = [];
  const onRequest = (request: Request) => {
    if (request.method() !== 'POST' || request.url() !== `${apiOrigin}/api/m3`) return;
    const body = request.postDataJSON();
    if (body?.action !== 'command' || body.workspaceId !== scope.workspaceId) return;
    if (body.command?.kind !== 'add-object' || body.command.object?.type !== 'ink'
      || body.command.documentId !== scope.documentId) {violations.push('Unexpected workspace command'); return;}
    const attempt: Attempt = {request: structuredClone(body) as InkRequest, accountId: request.headers()['x-ardesia-account']};
    attempts.push(attempt); requests.set(request, attempt);
  };
  const onFinished = (request: Request) => {
    const attempt = requests.get(request); if (!attempt) return;
    const task = (async () => {
      try {
        const response = await request.response();
        if (!response) throw Error('Missing command response');
        attempt.status = response.status();
        const body = await response.json();
        if (!response.ok() || body?.ok !== true) throw Error('Command response was not a positive receipt');
        attempt.receipt = CommandReceiptSchema.parse(body.result?.receipt);
        const timing = request.timing();
        if (timing.startTime < 0 || timing.responseEnd < 0) throw Error('Missing completed request timing');
        attempt.responseEndEpochMs = timing.startTime + timing.responseEnd;
        attempt.requestToResponseBodyMs = timing.responseEnd;
      } catch (reason) {attempt.failure = reason instanceof Error ? reason.message : 'Response collection failed';}
    })();
    tasks.add(task); void task.finally(() => tasks.delete(task));
  };
  const onFailed = (request: Request) => {
    const attempt = requests.get(request); if (attempt) attempt.failure = 'Browser command request failed';
  };
  context.on('request', onRequest); context.on('requestfinished', onFinished); context.on('requestfailed', onFailed);
  return {
    attempts, violations,
    async flush() {while (tasks.size) await Promise.all([...tasks]);},
    stop() {context.off('request', onRequest); context.off('requestfinished', onFinished); context.off('requestfailed', onFailed);},
  };
}

/** Observe actual per-command bytes, with account, workspace, and document scope. Never mutate storage. */
async function recovery(page: Page, scope: Scope): Promise<RecoveryRow[]> {
  return page.evaluate(scope => {
    const namespace = `ardesia-next.pending.v1.${encodeURIComponent(scope.accountId)}/`;
    return Object.keys(localStorage).filter(key => key.startsWith(namespace)).flatMap(key => {
      const raw = localStorage.getItem(key)!;
      const value: PendingCommand | null = JSON.parse(raw);
      if (value === null || value.workspaceId !== scope.workspaceId) return [];
      if (value.accountId !== scope.accountId || decodeURIComponent(key.slice(namespace.length)) !== value.commandId)
        throw Error('Recovery identity mismatch');
      if (value.request.action !== 'command' || value.request.command.documentId !== scope.documentId) return [];
      return [{key, raw, value}];
    }).sort((a, b) => a.value.commandId.localeCompare(b.value.commandId));
  }, scope);
}
const immutableRecovery = (rows: RecoveryRow[]) => rows.map(({key, value}) => ({key, commandId: value.commandId,
  accountId: value.accountId, actorId: value.actorId, workspaceId: value.workspaceId,
  createdAt: value.createdAt, request: value.request, edit: value.edit}));

async function storageBytes(page: Page, scope: Scope) {
  return page.evaluate(async scope => {
    const bytes = (value: string) => new TextEncoder().encode(value).byteLength;
    const pendingPrefix = `ardesia-next.pending.v1.${encodeURIComponent(scope.accountId)}/`;
    const draftPrefix = 'ardesia-next.ink-draft.v1.' + [scope.accountId, scope.workspaceId, scope.documentId].map(encodeURIComponent).join('/') + '/';
    let appLocalStorageBytes = 0, pendingBytes = 0, pendingRows = 0, draftBytes = 0, draftRows = 0;
    for (const key of Object.keys(localStorage)) {
      const raw = localStorage.getItem(key)!;
      const size = bytes(key) + bytes(raw);
      if (key.startsWith('ardesia-')) appLocalStorageBytes += size;
      if (key.startsWith(draftPrefix)) {draftBytes += size; draftRows++;}
      if (key.startsWith(pendingPrefix)) {
        const value = JSON.parse(raw);
        if (value?.workspaceId === scope.workspaceId && value.request?.action === 'command'
          && value.request.command?.documentId === scope.documentId) {pendingBytes += size; pendingRows++;}
      }
    }
    const name = 'ardesia-next.offline.v1';
    if (!(await indexedDB.databases()).some(database => database.name === name)) throw Error('Expected an existing offline database');
    const copy = await new Promise<{snapshotBytes: number; gateBytes: number; revision: number; inkCount: number}>((resolve, reject) => {
      const open = indexedDB.open(name);
      open.onerror = () => reject(open.error);
      open.onupgradeneeded = () => {open.transaction!.abort(); reject(Error('Offline database must already exist'));};
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction('local', 'readonly'), store = tx.objectStore('local');
        const key = ['snapshot', scope.accountId, scope.workspaceId];
        const snapshot = store.get(key), gate = store.get('gate');
        tx.onabort = () => {db.close(); reject(tx.error ?? Error('Offline measurement aborted'));};
        tx.oncomplete = () => {
          db.close();
          const document = snapshot.result?.documents?.find((item: {id: string}) => item.id === scope.documentId);
          if (!document || gate.result?.accountId !== scope.accountId || gate.result?.workspaceId !== scope.workspaceId) {
            reject(Error('Missing selected offline snapshot')); return;
          }
          resolve({snapshotBytes: bytes(JSON.stringify(key)) + bytes(JSON.stringify(snapshot.result)),
            gateBytes: bytes(JSON.stringify('gate')) + bytes(JSON.stringify(gate.result)),
            revision: document.revision, inkCount: document.objects.filter((object: {type: string}) => object.type === 'ink').length});
        };
      };
    });
    return {appLocalStorageBytes, pendingBytes, pendingRows, draftBytes, draftRows, ...copy,
      measuredSerializedBytes: appLocalStorageBytes + copy.snapshotBytes + copy.gateBytes};
  }, scope);
}

async function penStyle(page: Page) {
  await page.getByRole('button', {name: 'Penna', exact: true}).click();
  await page.getByRole('button', {name: 'Inchiostro Blu', exact: true}).click();
  await page.getByLabel('Spessore della penna', {exact: true}).selectOption(String(WIDTH));
  await page.getByRole('button', {name: /^Zoom \d+%, ripristina 100%$/}).click();
  await expect(page.getByRole('button', {name: 'Zoom 100%, ripristina 100%', exact: true})).toBeVisible();
}

/** One synchronous 96-event gesture, then an animation-frame yield. No hardware event is claimed. */
async function draw(page: Page, scope: Scope, index: number, phase: Gesture['phase']): Promise<Gesture> {
  return page.locator('.board-surface').evaluate(async (element, {scope, index, phase, samples}) => {
    const surface = element as HTMLElement, rect = surface.getBoundingClientRect();
    const prefix = 'ardesia-next.ink-draft.v1.' + [scope.accountId, scope.workspaceId, scope.documentId].map(encodeURIComponent).join('/') + '/';
    const previous = new Set(Object.keys(localStorage).filter(key => key.startsWith(prefix)));
    const handler: Gesture['handler'] = [], input: Gesture['input'] = [];
    const columns = 8, column = index % columns, row = Math.floor(index / columns);
    const cellX = Math.floor((rect.width - 48) / columns), cellY = Math.floor((rect.height - 150) / 15);
    if (cellX < 24 || cellY < 10) throw Error('Drawing surface too small for this workload');
    const startX = Math.ceil(rect.left) + 24 + column * cellX, startY = Math.ceil(rect.top) + 80 + row * cellY;
    const spanX = Math.min(95, cellX - 8), spanY = Math.min(18, cellY - 4);
    let draftKey = '', firstWorld = {x: 0, y: 0}, object: Ink | undefined, pointerUpEpochMs = 0;
    const captureDescriptor = Object.getOwnPropertyDescriptor(surface, 'setPointerCapture');
    // Native pointer capture rejects synthetic IDs. Preserve and restore the exact original descriptor.
    Object.defineProperty(surface, 'setPointerCapture', {configurable: true, writable: true, value: () => undefined});
    try {
      for (let sample = 0; sample < samples; sample++) {
        const kind: EventKind = sample === 0 ? 'pointerdown' : sample === samples - 1 ? 'pointerup' : 'pointermove';
        const pressure = (4 + ((sample === samples - 1 ? sample - 1 : sample) % 9)) / 16;
        const dx = Math.round(sample * spanX / (samples - 1)), dy = Math.round((sample % 16) * spanY / 15);
        const event = new PointerEvent(kind, {bubbles: true, cancelable: true, isPrimary: true,
          pointerId: 1000 + index, pointerType: 'pen', button: 0, buttons: kind === 'pointerup' ? 0 : 1,
          pressure, clientX: startX + dx, clientY: startY + dy});
        // Constructor time, checkpoint inspection, and rAF are outside this synchronous measurement.
        const started = performance.now();
        if (kind === 'pointerup') pointerUpEpochMs = performance.timeOrigin + started;
        surface.dispatchEvent(event);
        handler.push({kind, ms: performance.now() - started});
        input.push({dx: event.clientX - startX, dy: event.clientY - startY, pressure: event.pressure});
        if (sample === 0) {
          const added = Object.keys(localStorage).filter(key => key.startsWith(prefix) && !previous.has(key));
          if (added.length !== 1) throw Error('One initial stable-ID ink checkpoint was expected');
          draftKey = added[0]!;
          const initial: InkDraft = JSON.parse(localStorage.getItem(draftKey)!);
          firstWorld = {x: initial.object.x, y: initial.object.y};
        }
      }
      // publish() updates this checkpoint synchronously before handing it to the immutable queue.
      const final: InkDraft = JSON.parse(localStorage.getItem(draftKey)!);
      if (final.object.id !== decodeURIComponent(draftKey.slice(prefix.length))) throw Error('Gesture ID changed');
      object = final.object;
    } finally {
      if (captureDescriptor) Object.defineProperty(surface, 'setPointerCapture', captureDescriptor);
      else delete (surface as Partial<HTMLElement>).setPointerCapture;
    }
    const pendingPrefix = `ardesia-next.pending.v1.${encodeURIComponent(scope.accountId)}/`;
    const pendingObserved = Object.keys(localStorage).filter(key => key.startsWith(pendingPrefix)).filter(key => {
      const entry = JSON.parse(localStorage.getItem(key)!);
      return entry?.workspaceId === scope.workspaceId && entry.request?.command?.documentId === scope.documentId;
    }).length;
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    return {index, phase, object: object!, firstWorld, input, handler, pointerUpEpochMs, pendingObserved};
  }, {scope, index, phase, samples: SAMPLES});
}

function checkGesture(gesture: Gesture) {
  const object = gesture.object;
  expect(object.data.points).toHaveLength(SAMPLES);
  expect(object.data.color).toBe(COLOR); expect(object.data.width).toBe(WIDTH);
  expect(object.data.anchor).toBeUndefined();
  expect(object.x).toBe(gesture.firstWorld.x); expect(object.y).toBe(gesture.firstWorld.y);
  for (let sample = 0; sample < SAMPLES; sample++) {
    const actual = object.data.points[sample]!, input = gesture.input[sample]!;
    expect(actual.pressure).toBe(input.pressure);
    // At UI-selected 100% zoom, only floating-point normalization can differ from integer screen deltas.
    // Every later persistence comparison below is exact; this is not a data-loss tolerance.
    expect(actual.x).toBeCloseTo(input.dx, 9); expect(actual.y).toBeCloseTo(input.dy, 9);
  }
  expect(gesture.handler).toHaveLength(SAMPLES);
}
function checkCore(projection: WorkspaceProjection, initial: LessonDocument, gestures: Gesture[]) {
  const document = projection.documents.find(item => item.id === initial.id)!;
  expect(document).toBeDefined();
  const initialIds = new Set(initial.objects.map(object => object.id));
  expect(document.objects.filter(object => initialIds.has(object.id))).toEqual(initial.objects);
  expect(document.connections).toEqual(initial.connections);
  expect(document.title).toBe(initial.title); expect(document.ownerId).toBe(initial.ownerId);
  expect(document.objects).toHaveLength(initial.objects.length + gestures.length);
  expect(document.revision).toBe(initial.revision + gestures.length);
  const newObjects = document.objects.filter(object => !initialIds.has(object.id));
  expect(new Set(newObjects.map(object => object.id)).size).toBe(gestures.length);
  expect(newObjects.map(object => object.id).sort()).toEqual(gestures.map(gesture => gesture.object.id).sort());
  for (const gesture of gestures) {
    const saved = newObjects.find(object => object.id === gesture.object.id)!;
    expect(saved).toMatchObject(gesture.object);
    expect(saved.data).toEqual(gesture.object.data); // all coordinates, pressure samples, color, width, and optional fields
  }
  return document;
}
async function openRecovery(page: Page) {
  const panel = page.getByRole('region', {name: 'Modifiche da recuperare', exact: true});
  await expect(panel).toBeAttached();
  if (await panel.locator('details').getAttribute('open') === null) await panel.locator('summary').click();
  return panel;
}

test.describe('bounded synthetic lesson workload', () => {
  // Also remains runnable in the full suite. The documented Mac measurement uses desktop-chromium only.
  test.use({viewport: {width: 1440, height: 960}});
  test.setTimeout(240_000); // execution safety bound, not a performance acceptance threshold
  test('120 synthetic strokes preserve exact Core ink across offline page closure and explicit recovery', async ({page, context, browser}, testInfo) => {
    expect(resolveE2ETarget().mode).toBe('local');
    const selected = selectedWorkspace(page), scope: Scope = {accountId: selected.account.id, workspaceId: selected.workspaceId, documentId: selected.documentId};
    const observed = observeCommands(context, scope), gestures: Gesture[] = [], pageErrors: string[] = [];
    const storage: {stage: string; values: Awaited<ReturnType<typeof storageBytes>>}[] = [];
    const resumeClicks = new Map<string, number>();
    let activePage = page, stage = 'initial', completed = false, failure: string | null = null;
    let retained: RecoveryRow[] = [], reopenMs: number | null = null, finalReloadMs: number | null = null;
    let initial: LessonDocument | null = null, finalDocument: LessonDocument | null = null;
    let build: {commit: string; sourceDigest: string; generatedAt: string} | null = null;
    const startedAt = new Date().toISOString(), started = performance.now();
    const watchPage = (target: Page) => target.on('pageerror', error => pageErrors.push(error.message));
    const measure = async (label: string) => {storage.push({stage: label, values: await storageBytes(activePage, scope)});};
    watchPage(page);
    try {
      build = JSON.parse(readFileSync(new URL('../apps/web/dist/build-info.json', import.meta.url), 'utf8'));
      const served = await context.request.get(`${apiOrigin}/build-info.json`);
      expect(served.ok()).toBe(true);
      const servedBuild = await served.json();
      expect(servedBuild.commit).toBe(build!.commit); expect(servedBuild.sourceDigest).toBe(build!.sourceDigest);
      await page.goto('/');
      const before = await personalProjection(page);
      initial = before.documents.find(document => document.id === scope.documentId)!;
      expect(initial.objects.filter(object => object.type === 'ink')).toEqual([]);
      expect(initial.objects.length + TOTAL).toBeLessThanOrEqual(2_000);
      expect(TOTAL).toBeLessThanOrEqual(500); // existing limits are retained, not patched or bypassed
      expect(await recovery(page, scope)).toEqual([]);
      await page.getByRole('button', {name: 'Impostazioni', exact: true}).click();
      await page.getByRole('button', {name: 'Rendi disponibile offline', exact: true}).click();
      await expect(page.getByRole('button', {name: 'Usa copia offline', exact: true})).toBeVisible();
      await page.getByRole('button', {name: 'Chiudi finestra', exact: true}).click();
      await measure('prepared-before-writing'); await penStyle(page);

      stage = '100 online strokes';
      for (let index = 0; index < ONLINE; index++) {
        const gesture = await draw(page, scope, index, 'online'); gestures.push(gesture); checkGesture(gesture);
      }
      await expect.poll(() => observed.attempts.filter(attempt => attempt.receipt).length, {timeout: 90_000}).toBe(ONLINE);
      await observed.flush();
      await expect.poll(async () => (await recovery(page, scope)).length, {timeout: 30_000}).toBe(0);
      const online = await personalProjection(page); checkCore(online, initial, gestures);
      expect(observed.attempts).toHaveLength(ONLINE);
      await measure('100-online-confirmed');
      expect(storage.at(-1)!.values.inkCount).toBe(ONLINE);

      stage = '20 offline strokes';
      await page.getByRole('button', {name: 'Impostazioni', exact: true}).click();
      await context.setOffline(true);
      await page.getByRole('button', {name: 'Usa copia offline', exact: true}).click();
      await expect(page.getByText('Il tuo spazio offline', {exact: true})).toBeVisible();
      await penStyle(page);
      for (let index = ONLINE; index < TOTAL; index++) {
        const gesture = await draw(page, scope, index, 'offline'); gestures.push(gesture); checkGesture(gesture);
      }
      await expect.poll(async () => (await recovery(page, scope)).length).toBe(OFFLINE);
      await expect(page.getByLabel('Tratto in attesa di conferma', {exact: true})).toHaveCount(OFFLINE);
      await expect(page.getByRole('button', {name: 'Ricollegati al server', exact: true})).toBeEnabled();
      retained = await recovery(page, scope);
      for (const row of retained) {
        expect(row.value.status).toBe('blocked');
        const request = row.value.request as InkRequest;
        expect(request.command.object).toEqual(gestures.find(gesture => gesture.object.id === request.command.object.id)!.object);
      }
      expect(observed.attempts).toHaveLength(ONLINE);
      expect((await personalProjection(page)).documents).toEqual(online.documents);
      await measure('20-offline-durable-before-close');
      expect(storage.at(-1)!.values.pendingRows).toBe(OFFLINE); expect(storage.at(-1)!.values.draftRows).toBe(0);

      stage = 'offline close and reopen';
      await page.close();
      const reopenStart = performance.now();
      activePage = await context.newPage(); watchPage(activePage);
      await activePage.goto('/');
      await expect(activePage.getByText('Il tuo spazio offline', {exact: true})).toBeVisible();
      await expect(activePage.getByLabel('Tratto in attesa di conferma', {exact: true})).toHaveCount(OFFLINE);
      const reopened = await recovery(activePage, scope);
      expect(immutableRecovery(reopened)).toEqual(immutableRecovery(retained));
      reopenMs = performance.now() - reopenStart;
      await measure('offline-reopened');
      expect(observed.attempts).toHaveLength(ONLINE);

      stage = 'reconnect without sending';
      await context.setOffline(false);
      expect((await personalProjection(activePage)).documents).toEqual(online.documents);
      expect(observed.attempts).toHaveLength(ONLINE);
      await activePage.getByRole('button', {name: 'Ricollegati al server', exact: true}).click();
      await openRecovery(activePage);
      expect(immutableRecovery(await recovery(activePage, scope))).toEqual(immutableRecovery(retained));
      expect(observed.attempts).toHaveLength(ONLINE);
      expect((await personalProjection(activePage)).documents).toEqual(online.documents);
      await measure('reconnected-before-explicit-confirmation');

      stage = '20 explicit confirmations';
      for (let index = 0; index < OFFLINE; index++) {
        const panel = await openRecovery(activePage), resume = panel.getByRole('button', {name: 'Riprendi modifica non inviata', exact: true});
        await expect(resume).toHaveCount(OFFLINE - index); await expect(resume.first()).toBeEnabled();
        if (index + 1 < OFFLINE) await expect(resume.nth(1)).toBeDisabled();
        const commandId = (await panel.locator('code').first().textContent())!;
        const original = retained.find(row => row.value.commandId === commandId)!;
        expect(original).toBeDefined();
        // Measure the actual DOM click in the same browser epoch as network timing.
        await resume.first().evaluate(element => element.addEventListener('click', () => {
          (window as typeof window & {__workloadResumeEpoch?: number}).__workloadResumeEpoch = performance.timeOrigin + performance.now();
        }, {once: true, capture: true}));
        await resume.first().click();
        resumeClicks.set(commandId, await activePage.evaluate(() => (window as typeof window & {__workloadResumeEpoch: number}).__workloadResumeEpoch));
        await expect.poll(() => observed.attempts.filter(attempt => attempt.receipt).length).toBe(ONLINE + index + 1);
        await observed.flush();
        const attempt = observed.attempts.at(-1)!;
        expect(attempt.request).toEqual(original.value.request);
        expect(attempt.receipt?.commandId).toBe(commandId);
        await expect.poll(async () => (await recovery(activePage, scope)).length).toBe(OFFLINE - index - 1);
        expect(observed.attempts).toHaveLength(ONLINE + index + 1);
      }

      stage = 'authoritative Core verification';
      await observed.flush();
      expect(observed.violations).toEqual([]); expect(observed.attempts).toHaveLength(TOTAL);
      expect(new Set(gestures.map(gesture => gesture.object.id)).size).toBe(TOTAL);
      expect(new Set(observed.attempts.map(attempt => attempt.request.command.commandId)).size).toBe(TOTAL);
      for (const [index, attempt] of observed.attempts.entries()) {
        expect(attempt.failure).toBeUndefined(); expect(attempt.status).toBe(200); expect(attempt.accountId).toBe(scope.accountId);
        expect(attempt.request.command.expectedRevision).toBe(initial.revision + index);
        expect(attempt.receipt).toMatchObject({commandId: attempt.request.command.commandId, actorId: selected.actor.actorId,
          documentId: scope.documentId, documentRevision: initial.revision + index + 1});
        const gesture = gestures.find(value => value.object.id === attempt.request.command.object.id)!;
        expect(attempt.request.command.object).toEqual(gesture.object);
        const origin = gesture.phase === 'online' ? gesture.pointerUpEpochMs : resumeClicks.get(attempt.request.command.commandId)!;
        expect(attempt.responseEndEpochMs! - origin).toBeGreaterThanOrEqual(0);
      }
      const confirmed = await personalProjection(activePage); finalDocument = checkCore(confirmed, initial, gestures);
      expect(confirmed.events).toHaveLength(before.events.length + TOTAL);
      for (const attempt of observed.attempts) expect(confirmed.events.filter(event => event.id === attempt.receipt!.eventId)).toHaveLength(1);
      expect(confirmed.documents.filter(document => document.id !== initial!.id)).toEqual(before.documents.filter(document => document.id !== initial!.id));
      await expect(activePage.getByLabel('Tratto in attesa di conferma', {exact: true})).toHaveCount(0);
      expect(await recovery(activePage, scope)).toEqual([]);
      await measure('120-confirmed');
      expect(storage.at(-1)!.values.inkCount).toBe(TOTAL); expect(storage.at(-1)!.values.draftRows).toBe(0);

      stage = 'final reload';
      const reloadStart = performance.now();
      await activePage.reload();
      await expect(activePage.getByRole('heading', {name: initial.title, exact: true})).toBeVisible();
      await expect(activePage.locator('.board-surface')).toBeVisible();
      finalReloadMs = performance.now() - reloadStart;
      const afterReload = await personalProjection(activePage);
      expect(afterReload.documents).toEqual(confirmed.documents); checkCore(afterReload, initial, gestures);
      expect(await recovery(activePage, scope)).toEqual([]); expect(observed.attempts).toHaveLength(TOTAL);
      await measure('final-reload'); expect(pageErrors).toEqual([]);
      await activePage.screenshot({path:testInfo.outputPath('lesson-workload.png')});
      completed = true; stage = 'complete';
    } catch (reason) {failure = reason instanceof Error ? reason.message : 'Workload failed'; throw reason;}
    finally {
      await observed.flush(); observed.stop();
      const receiptLatency = (phase: Gesture['phase']) => observed.attempts.flatMap(attempt => {
        const gesture = gestures.find(value => value.object.id === attempt.request.command.object.id);
        if (!gesture || gesture.phase !== phase || attempt.responseEndEpochMs === undefined) return [];
        const start = phase === 'online' ? gesture.pointerUpEpochMs : resumeClicks.get(attempt.request.command.commandId);
        return start === undefined ? [] : [attempt.responseEndEpochMs - start];
      });
      const report = {
        kind: 'ardesia-synthetic-ink-workload-v1', completed, stage, failure, startedAt, finishedAt: new Date().toISOString(), elapsedMs: performance.now() - started,
        sourceBuild: build, environment: {platform: platform(), arch: arch(), osRelease: release(), node: process.version,
          cpuModel: cpus()[0]?.model ?? null, logicalCpus: cpus().length, totalMemoryBytes: totalmem(),
          browser: browser.browserType().name(), browserVersion: browser.version(), project: testInfo.project.name, viewport: activePage.viewportSize(),
          isMobileEmulation: testInfo.project.use.isMobile ?? false}, scope,
        workload: {planned: {onlineStrokes: ONLINE, offlineStrokes: OFFLINE, samplesPerStroke: SAMPLES, pointerEvents: TOTAL * SAMPLES},
          observed: {strokes: gestures.length, samples: gestures.reduce((n, gesture) => n + gesture.object.data.points.length, 0),
            commandAttempts: observed.attempts.length, positiveReceipts: observed.attempts.filter(attempt => attempt.receipt).length,
            maximumPendingObservedAtGestureBoundary: Math.max(0, ...gestures.map(gesture => gesture.pendingObserved), ...storage.map(value => value.values.pendingRows))},
          existingLimits: {objectsPerDocument: 2_000, pendingCommands: 500, modified: false},
          schedule: 'Each stroke is 96 synchronous synthetic PointerEvents, followed by one requestAnimationFrame yield. Online requests may queue. Offline resumption is one explicit UI click per command.'},
        measurements: {
          synchronousDispatchMs: Object.fromEntries((['all', 'pointerdown', 'pointermove', 'pointerup'] as const).map(kind => [kind,
            distribution(gestures.flatMap(gesture => gesture.handler.filter(event => kind === 'all' || event.kind === kind).map(event => event.ms)))])),
          synchronousDispatchByPhaseMs: Object.fromEntries((['online', 'offline'] as const).map(phase => [phase,
            distribution(gestures.filter(gesture => gesture.phase === phase).flatMap(gesture => gesture.handler.map(event => event.ms)))])),
          onlinePointerUpToPositiveReceiptBodyMs: distribution(receiptLatency('online')),
          offlineExplicitClickToPositiveReceiptBodyMs: distribution(receiptLatency('offline')),
          requestToPositiveReceiptBodyMs: distribution(observed.attempts.flatMap(attempt => attempt.requestToResponseBodyMs === undefined ? [] : [attempt.requestToResponseBodyMs])),
          offlinePageReopenMs: reopenMs, finalOnlineReloadUiMs: finalReloadMs, storage,
        },
        definitions: {
          input: 'performance.now around dispatchEvent; synchronous listeners and synchronous work only. Excludes event construction, observer inspection, asynchronous work, paint, hardware, and OS input delivery.',
          receipt: 'Browser network responseEnd for a real positive receipt minus pointerup dispatch start (online) or the explicit DOM click (offline). Includes queue/server/response transfer; excludes later client JSON validation, offline-copy persistence, and paint. Completion and exact Core data are independently asserted.',
          reopen: 'Host monotonic elapsed time from context.newPage, after closing the original page, through offline shell visibility, 20 pending SVGs, and immutable recovery equality. Same BrowserContext, cookies, service worker, localStorage, and IndexedDB; no process or device restart.',
          storage: 'UTF-8 key plus stored-string bytes for app localStorage; UTF-8 JSON key plus JSON value bytes for selected IndexedDB snapshot and gate. pending/draft are subsets of appLocalStorageBytes, not additional totals. Excludes CacheStorage, other IndexedDB stores, media, browser overhead, filesystem allocation, and quota usage.',
          precision: 'Exact checkpoint-to-command-to-Core data and identity equality. Input screen deltas use 1e-9 decimal precision to allow only floating-point coordinate normalization at 100% zoom. Pressure values are binary fractions; pointerup retains the preceding pressure.',
          timingAcceptance: 'No arbitrary speed threshold. The 240-second test timeout only bounds execution.'},
        limitations: ['Synthetic input on the reported host; not handwriting or real Apple Pencil.', 'Desktop Chromium is the prescribed Mac run; not iPad, Safari, touch hardware, or native app validation.',
          'A bounded accelerated workload, not a lesson duration or educational acceptance.', 'No pressure/tilt hardware quality, frame-rate, ink-to-photon, battery, thermal, long-session, or storage-limit qualification.'],
        integrity: {initialRevision: initial?.revision ?? null, finalRevision: finalDocument?.revision ?? null,
          offlineImmutableRecoverySha256: digest(immutableRecovery(retained)), finalDocumentSha256: finalDocument ? digest(finalDocument) : null,
          pageErrors, unexpectedCommands: observed.violations},
        gestures,
        commands: observed.attempts.map(attempt => ({commandId: attempt.request.command.commandId, objectId: attempt.request.command.object.id,
          expectedRevision: attempt.request.command.expectedRevision, immutableRequestSha256: digest(attempt.request), status: attempt.status,
          receipt: attempt.receipt, failure: attempt.failure, responseEndEpochMs: attempt.responseEndEpochMs, requestToResponseBodyMs: attempt.requestToResponseBodyMs})),
      };
      const path = testInfo.outputPath('lesson-workload.json');
      await writeFile(path, JSON.stringify(report, null, 2) + '\n');
      await testInfo.attach('lesson-workload', {path, contentType: 'application/json'});
    }
  });
});
