import {randomUUID} from 'node:crypto';
import {test as base, expect, type APIRequestContext, type BrowserContext, type Page} from '@playwright/test';
import type {Actor, CoreCommand, NewEducationalObject} from '@ardesia/contracts';
import type {WorkspaceProjection} from '@ardesia/remote-client';
import {resolveE2ETarget} from './target.ts';

export {expect};
export const legacyStorageKey = 'ardesia-next.core.v1';
export const workspaceSelectionKey = (accountId: string) => `ardesia-next-remote-workspace:${accountId}`;
export const apiOrigin = resolveE2ETarget().origin;

export interface TestAccount {id: string; role: Actor['role']; displayName: string}
export interface TestWorkspace {account: TestAccount; actor: Actor; workspaceId: string; documentId: string}
interface TeacherSession {account: TestAccount; storageState: Awaited<ReturnType<APIRequestContext['storageState']>>}
const contexts = new WeakMap<BrowserContext, TestWorkspace>();

export function credentials(kind: 'TEACHER' | 'STUDENT_A' | 'STUDENT_B') {
  const username = process.env[`ARDESIA_E2E_${kind}_USERNAME`], password = process.env[`ARDESIA_E2E_${kind}_PASSWORD`];
  if (!username || !password) throw new Error(`Missing synthetic ${kind} credentials: the real M3 test database must be seeded before browser tests.`);
  return {username, password};
}

export async function rawApi(request: APIRequestContext, body: Record<string, unknown>, accountId?: string) {
  const response = await request.post(`${apiOrigin}/api/m3`, {data: body, headers: {
    Origin: apiOrigin, ...(accountId ? {'X-Ardesia-Account': accountId} : {}),
  }});
  const payload = await response.json();
  return {status: response.status(), payload};
}

export async function api<T>(request: APIRequestContext, body: Record<string, unknown>, accountId?: string): Promise<T> {
  const {status, payload} = await rawApi(request, body, accountId);
  if (status < 200 || status >= 300 || payload.ok !== true) throw new Error(`M3 API ${String(body.action)} rejected (${status} ${payload.error?.code ?? 'INVALID_RESPONSE'}).`);
  return payload.result as T;
}

export async function loginContext(context: BrowserContext, kind: 'TEACHER' | 'STUDENT_A' | 'STUDENT_B'): Promise<TestAccount> {
  const result = await api<{account: TestAccount}>(context.request, {action: 'login', ...credentials(kind)});
  return result.account;
}

export async function selectWorkspace(context: BrowserContext, workspace: TestWorkspace): Promise<void> {
  contexts.set(context, workspace);
  await context.addInitScript(({key, value}) => sessionStorage.setItem(key, value), {
    key: workspaceSelectionKey(workspace.account.id), value: workspace.workspaceId,
  });
}

export function selectedWorkspace(page: Page): TestWorkspace {
  const workspace = contexts.get(page.context());
  if (!workspace) throw new Error('This browser context has no authorized test workspace.');
  return workspace;
}

export async function personalProjection(page: Page): Promise<WorkspaceProjection> {
  const selected = selectedWorkspace(page);
  const exported = await api<{format: string; accountId: string; workspaceId: string; projection: WorkspaceProjection}>(page.context().request,
    {action: 'export-personal', workspaceId: selected.workspaceId}, selected.account.id);
  expect(exported.format).toBe('ardesia-personal-v1');
  expect(exported.accountId).toBe(selected.account.id);
  expect(exported.workspaceId).toBe(selected.workspaceId);
  expect(exported).not.toHaveProperty('snapshot');
  expect(exported).not.toHaveProperty('receipts');
  return exported.projection;
}

/** Deliberately corrupt an actual authenticated read response, never the database or an invented success. */
export async function mutateReadProjection(page: Page, mutate: (projection: WorkspaceProjection) => void): Promise<() => number> {
  let intercepted = 0;
  await page.route('**/api/m3', async route => {
    const request = route.request();
    if (request.method() !== 'POST' || request.postDataJSON()?.action !== 'open-workspace') {await route.continue(); return;}
    const response = await route.fetch(), body = await response.json();
    if (body.ok !== true) {await route.fulfill({response}); return;}
    mutate(body.result as WorkspaceProjection); intercepted++;
    await route.fulfill({response, json: body});
  });
  return () => intercepted;
}

async function seedWorkspace(context: BrowserContext, account: TestAccount, suffix: string): Promise<TestWorkspace> {
  const projection = await api<WorkspaceProjection>(context.request, {action: 'create-workspace', commandId: randomUUID(), title: `E2E ${suffix}`.slice(0, 240)}, account.id);
  const documentId = randomUUID(), sourceId = randomUUID(), noteId = randomUUID(), formulaId = randomUUID();
  let revision = 0;
  const execute = async (command: Omit<CoreCommand, 'commandId' | 'documentId' | 'expectedRevision'> | Record<string, unknown>) => {
    const result = await api<{projection: WorkspaceProjection}>(context.request, {action: 'command', workspaceId: projection.workspaceId,
      command: {...command, commandId: randomUUID(), documentId, expectedRevision: revision}}, account.id);
    revision = result.projection.documents.find(document => document.id === documentId)!.revision;
  };
  await execute({kind: 'create-document', title: 'Oscillazioni: osserva, misura, spiega'});
  const objects: NewEducationalObject[] = [
    {id: sourceId, type: 'source', title: 'Una fonte da esplorare', x: 700, y: 355, width: 280, height: 156,
      data: {url: 'https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums', publisher: 'OpenStax · University Physics', locator: '§ 15.4 · Pendulums',
        sourceRevision: 'Volume 1, sezione 15.4 · consultata 29 ottobre 2026', license: 'Collegamento alla fonte; nessun testo o figura riprodotti'}},
    {id: noteId, type: 'note', title: 'Che cosa cambia il periodo?', x: 45, y: 100, width: 250, height: 204,
      data: {text: 'Prima osserva. Poi formula un’ipotesi e raccogli una misura.'}},
    {id: formulaId, type: 'formula', title: 'Il pendolo semplice', x: 365, y: 210, width: 290, height: 240,
      data: {latex: 'T = 2\\pi \\sqrt{\\frac{L}{g}}', description: 'Piccole oscillazioni · modello ideale'},
      provenance: {origin: 'authored', sources: [{sourceId, revision: 1, locator: 'Eq. 15.19; ipotesi di piccole oscillazioni'}]}},
  ];
  for (const object of objects) await execute({kind: 'add-object', object});
  await execute({kind: 'connect-objects', connection: {id: randomUUID(), from: noteId, to: formulaId, label: 'Ipotesi e modello'}});
  await execute({kind: 'connect-objects', connection: {id: randomUUID(), from: formulaId, to: sourceId, label: 'Fonte del modello'}});
  return {account, actor: projection.actor, workspaceId: projection.workspaceId, documentId};
}

export const test = base.extend<{remoteWorkspace: TestWorkspace}, {teacherSession: TeacherSession}>({
  teacherSession: [async ({playwright}, use) => {
    const request = await playwright.request.newContext({baseURL: apiOrigin});
    const session = await api<{account: TestAccount}>(request, {action: 'login', ...credentials('TEACHER')});
    await use({account: session.account, storageState: await request.storageState()});
    await request.dispose();
  }, {scope: 'worker'}],
  storageState: async ({teacherSession}, use) => {await use(teacherSession.storageState);},
  remoteWorkspace: [async ({context, teacherSession}, use, testInfo) => {
    const workspace = await seedWorkspace(context, teacherSession.account, `${testInfo.project.name} ${testInfo.title} ${randomUUID().slice(0, 8)}`);
    await selectWorkspace(context, workspace);
    await use(workspace);
  }, {auto: true}],
});
