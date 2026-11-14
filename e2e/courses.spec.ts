import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {Page} from '@playwright/test';
import {toObjectInput, type CourseCommand} from '@ardesia/contracts';
import type {WorkspaceProjection} from '@ardesia/remote-client';
import {springCourse} from '../apps/web/src/courses/content';
import {test, expect, api, apiOrigin, loginContext, personalProjection, selectedWorkspace, selectWorkspace} from './fixtures';
import {continueRouteWithAccess, fetchRouteWithAccess, readApiJson} from './remote-access';

async function courseCommand(page: Page, command: CourseCommand) {
  const space = selectedWorkspace(page);
  return api<{projection: WorkspaceProjection}>(page.context().request, {action: 'course-command', workspaceId: space.workspaceId, command}, space.account.id);
}
async function edition(page: Page, linked = false) {
  const courseId = randomUUID(), editionId = randomUUID(), input = springCourse();
  if (linked) {const document = (await personalProjection(page)).documents[0]!; input.units[0]!.lesson = {documentId: document.id, revision: document.revision};}
  await courseCommand(page, {kind: 'save-course', commandId: randomUUID(), courseId, expectedRevision: 0, input});
  await courseCommand(page, {kind: 'create-course-edition', commandId: randomUUID(), courseId, courseRevision: 1, editionId, expectedRevision: 0, label: 'Edizione di prova'});
  return {courseId, editionId, input};
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
async function library(page: Page) {await page.getByRole('button', {name: 'Corsi', exact: true}).click();}

test('course authoring, exact edition and personal study resume the saved phase', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#corsi'); await noOverflow(page);
  await page.getByRole('button', {name: 'Parti da una molla'}).click();
  await expect(page.getByRole('heading', {name: 'Dai forma al percorso.'})).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', {name: 'Salva corso', exact: true}).click();
  await expect(page.getByText('Bozza salvata · r1', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Fissa un’edizione', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Portalo nello studio.'})).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', {name: 'Inizia il mio percorso', exact: true}).click();
  const answer = page.getByLabel('Il tuo ragionamento', {exact: true});
  await answer.fill('A forza uguale la molla con k si allunga il doppio.');
  await page.getByRole('button', {name: '+ Il modello', exact: true}).click();
  await expect(answer).toHaveValue('A forza uguale la molla con k si allunga il doppio.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', {name: 'Salva risposta', exact: true}).click();
  await expect(answer).toHaveValue('');
  await page.getByRole('button', {name: 'Metti alla prova', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Metti alla prova', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await answer.fill('3 N / 150 N/m = 0,02 m; con 300 N/m ottengo 0,01 m.');
  await page.getByRole('button', {name: 'Salva risposta', exact: true}).click();
  await expect(answer).toHaveValue(''); await noOverflow(page);
  const before = (await personalProjection(page)).courseSpace!;
  expect(before.work[0]).toMatchObject({currentStage: 'activity', shared: false});
  expect(before.work[0]!.attempts).toHaveLength(2);
  expect(before.work[0]!.attempts[0]!.helpUsed).toEqual(['explanation']);
  await page.reload(); await page.getByRole('button', {name: 'Riprendi', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Metti alla prova', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.course-attempts article')).toHaveCount(2);
  expect((await personalProjection(page)).courseSpace).toEqual(before);
  expect(errors).toEqual([]);
});

test('courses are accessible in a teacher workspace without any lesson', async ({page, browser}) => {
  const teacher = selectedWorkspace(page);
  const empty = await api<WorkspaceProjection>(page.context().request, {action: 'create-workspace', commandId: randomUUID(), title: 'Solo corsi'}, teacher.account.id);
  const context = await browser.newContext({baseURL: apiOrigin, viewport: page.viewportSize(), storageState: await page.context().storageState()});
  try {
    await selectWorkspace(context, {...teacher, workspaceId: empty.workspaceId, actor: empty.actor, documentId: ''});
    const reader = await context.newPage(); await edition(reader);
    await reader.goto('/#corsi');
    await expect(reader.getByRole('heading', {name: 'Il tuo laboratorio di corsi'})).toBeVisible();
    await expect(reader.getByRole('heading', {name: 'Una molla, un modello, una scelta'})).toBeVisible();
    await reader.getByRole('button', {name: 'Continua a creare'}).click();
    await expect(reader.getByLabel('Titolo del corso')).toHaveValue('Una molla, un modello, una scelta');
    expect((await personalProjection(reader)).documents).toEqual([]);
  } finally {await context.close();}
});

test('lost course acknowledgements reconcile drafts and preserve newer edits without duplicate editions or answers', async ({page}) => {
  const seen = new Map<string, string[]>(), receipts = new Map<string, unknown[]>();
  const lose = new Set(['save-course', 'create-course-edition', 'assign-course', 'record-course-attempt']);
  await page.route('**/api/m3', async route => {
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
    if (body?.action !== 'course-command') {await continueRouteWithAccess(route); return;}
    const kind = body.command.kind;
    const response = await fetchRouteWithAccess(route), result = await readApiJson(response);
    expect(result.ok).toBe(true);
    seen.set(kind, [...seen.get(kind) ?? [], body.command.commandId]);
    receipts.set(kind, [...receipts.get(kind) ?? [], result.result.receipt]);
    if (lose.delete(kind)) await route.abort('connectionfailed'); else await route.fulfill({response});
  });
  async function retry() {
    const button = page.getByRole('button', {name: 'Verifica e ritenta', exact: true});
    await expect(button).toBeEnabled(); await button.click();
    await expect(page.getByRole('region', {name: 'Modifiche da recuperare', exact: true})).toHaveCount(0);
  }
  await page.goto('/#corsi'); await page.getByRole('button', {name: 'Parti da una molla'}).click();
  await page.getByRole('button', {name: 'Salva corso', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Verifica e ritenta', exact: true})).toBeEnabled();
  await page.getByLabel('Titolo del corso', {exact: true}).fill('Una scelta migliore dopo l’invio');
  await retry();
  await expect(page.getByLabel('Titolo del corso', {exact: true})).toHaveValue('Una scelta migliore dopo l’invio');
  await page.getByRole('button', {name: 'Salva corso', exact: true}).click();
  await expect(page.getByText('Bozza salvata · r2', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Fissa un’edizione', exact: true}).click(); await retry();
  await expect(page.getByRole('heading', {name: 'Portalo nello studio.'})).toBeVisible();
  await page.getByRole('button', {name: 'Inizia il mio percorso', exact: true}).click(); await retry();
  await page.getByLabel('Il tuo ragionamento', {exact: true}).fill('La prima previsione resta un tentativo unico.');
  await page.getByRole('button', {name: 'Salva risposta', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Verifica e ritenta', exact: true})).toBeEnabled();
  await page.getByLabel('Il tuo ragionamento', {exact: true}).fill('Un nuovo ragionamento non ancora inviato.');
  await retry();
  await expect(page.getByLabel('Il tuo ragionamento', {exact: true})).toHaveValue('Un nuovo ragionamento non ancora inviato.');
  const space = (await personalProjection(page)).courseSpace!;
  expect(space.courses).toHaveLength(1); expect(space.courses[0]!.revision).toBe(2);
  expect(space.editions).toHaveLength(1); expect(space.deliveries).toHaveLength(1); expect(space.work[0]!.attempts).toHaveLength(1);
  for (const kind of ['save-course', 'create-course-edition', 'assign-course', 'record-course-attempt']) {
    expect(seen.get(kind)![0]).toBe(seen.get(kind)![1]); expect(receipts.get(kind)![0]).toEqual(receipts.get(kind)![1]);
  }
});

test('course grants pin lesson material, keep work private and preserve own exports after revocation', async ({page, browser}, info) => {
  test.setTimeout(90_000);
  const teacher = selectedWorkspace(page), pack = await edition(page, true);
  const context = await browser.newContext({baseURL: apiOrigin, viewport: page.viewportSize(), storageState: {cookies: [], origins: []}});
  try {
    const account = await loginContext(context, 'STUDENT_A', info.project.name);
    await selectWorkspace(context, {...teacher, account, actor: {actorId: account.id, role: 'student'}});
    const student = await context.newPage(), deliveryId = randomUUID();
    await courseCommand(page, {kind: 'assign-course', deliveryId, editionId: pack.editionId, learnerId: account.id, expectedRevision: 0, commandId: randomUUID()});
    await student.goto('/#corsi'); await student.getByRole('button', {name: 'Inizia', exact: true}).click();
    const answer = student.getByLabel('Il tuo ragionamento', {exact: true});
    await answer.fill('Una previsione privata da conservare.');
    await student.getByRole('button', {name: 'Apri materiali della lezione', exact: true}).click();
    await expect(student.locator('.course-materials')).toContainText('Prima osserva. Poi formula un’ipotesi e raccogli una misura.');
    await expect(answer).toHaveValue('Una previsione privata da conservare.');
    await student.getByRole('button', {name: 'Salva risposta', exact: true}).click(); await expect(answer).toHaveValue('');
    expect((await personalProjection(page)).courseSpace!.work).toEqual([]);
    const personal = await personalProjection(student); expect(personal.assignments).toEqual([]); expect(personal.assignedDocuments).toEqual([]);
    const document = (await personalProjection(page)).documents[0]!, note = document.objects.find(value => value.type === 'note')!;
    const changed = toObjectInput(note); if (changed.type !== 'note') throw Error('Expected note'); changed.data.text = 'Testo nuovo non assegnato al corso.';
    await api(page.context().request, {action: 'command', workspaceId: teacher.workspaceId, command: {kind: 'replace-object', documentId: document.id, expectedRevision: document.revision, object: changed, commandId: randomUUID()}}, teacher.account.id);
    await student.getByRole('button', {name: 'Apri materiali della lezione', exact: true}).click();
    await expect(student.locator('.course-materials')).not.toContainText('Testo nuovo non assegnato al corso.');
    await answer.fill('Una bozza durante la condivisione.');
    await student.getByRole('button', {name: 'Condividi le risposte col docente', exact: true}).click();
    await expect(answer).toHaveValue('Una bozza durante la condivisione.');
    await expect.poll(async () => (await personalProjection(page)).courseSpace!.work.length).toBe(1);
    await student.getByRole('button', {name: 'Rendi private le risposte', exact: true}).click();
    await expect.poll(async () => (await personalProjection(page)).courseSpace!.work.length).toBe(0);
    await courseCommand(page, {kind: 'revoke-course-delivery', deliveryId, expectedRevision: 1, commandId: randomUUID()});
    await student.getByRole('button', {name: 'Apri materiali della lezione', exact: true}).click();
    await expect(student.getByRole('heading', {name: 'Il percorso non è più attivo.'})).toBeVisible();
    await expect(student.locator('.course-materials')).toHaveCount(0);
    const download = student.waitForEvent('download');
    await student.getByRole('button', {name: 'Esporta risposta non inviata', exact: true}).click();
    const unsentPath = await (await download).path(); if (!unsentPath) throw Error('Download absent');
    const unsent = JSON.parse(await readFile(unsentPath, 'utf8'));
    expect(unsent.answer).toBe('Una bozza durante la condivisione.');
    expect(unsent.context).toMatchObject({editionId: pack.editionId, unitId: pack.input.units[0]!.id, unitRevision: 1, stage: 'prediction'});
    await library(student); await student.getByRole('button', {name: 'Scarta modifiche', exact: true}).click();
    // A fresh authorized read updates the revoked delivery label, while retaining the participant's own evidence.
    await student.reload();
    const savedDownload = student.waitForEvent('download');
    await student.getByRole('button', {name: 'Esporta le mie risposte', exact: true}).click();
    const path = await (await savedDownload).path(); if (!path) throw Error('Download absent');
    const exported = JSON.parse(await readFile(path, 'utf8'));
    expect(exported.work.attempts[0].answer).toBe('Una previsione privata da conservare.');
    expect(exported.delivery.status).toBe('revoked');
    const final = (await personalProjection(student)).courseSpace!;
    expect(final.editions).toEqual([]); expect(final.work[0]!.attempts).toHaveLength(1);
    await noOverflow(student);
  } finally {await context.close();}
});

test('retrying a course save cannot silently rebase over a concurrent author edit', async ({page}) => {
  let lose = true;
  await page.route('**/api/m3', async route => {
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
    if (!lose || body?.action !== 'course-command' || body.command.kind !== 'save-course') {await continueRouteWithAccess(route); return;}
    lose = false; await fetchRouteWithAccess(route); await route.abort('connectionfailed');
  });
  await page.goto('/#corsi'); await page.getByRole('button', {name: 'Parti da una molla'}).click();
  await page.getByRole('button', {name: 'Salva corso', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Verifica e ritenta', exact: true})).toBeEnabled();
  const saved = (await personalProjection(page)).courseSpace!.courses[0]!;
  const {id, revision: _revision, ownerId: _ownerId, createdAt: _createdAt, updatedAt: _updatedAt, status: _status, ...input} = saved;
  const changed = {...input, title: 'Modifica concorrente da conservare', units: input.units.map(({revision: _r, ...unit}) => unit)};
  await courseCommand(page, {kind: 'save-course', courseId: id, expectedRevision: 1, commandId: randomUUID(), input: changed});
  await page.getByLabel('Titolo del corso').fill('Modifica locale successiva all’invio');
  await page.getByRole('button', {name: 'Verifica e ritenta', exact: true}).click();
  await expect(page.getByText(/Esiste una revisione più recente/)).toBeVisible();
  await expect(page.getByLabel('Titolo del corso')).toHaveValue('Modifica locale successiva all’invio');
  await page.getByRole('button', {name: 'Salva corso', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Conflitto di revisione', exact: true})).toBeVisible();
  expect((await personalProjection(page)).courseSpace!.courses[0]).toMatchObject({revision: 2, title: 'Modifica concorrente da conservare'});
});

test('uncertain and concurrent study navigation cannot discard or retarget an open answer', async ({page}) => {
  const pack = await edition(page), deliveryId = randomUUID();
  await courseCommand(page, {kind: 'assign-course', commandId: randomUUID(), deliveryId, editionId: pack.editionId, learnerId: selectedWorkspace(page).actor.actorId, expectedRevision: 0});
  let lose = true;
  await page.route('**/api/m3', async route => {
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
    if (!lose || body?.action !== 'course-command' || body.command.kind !== 'set-course-position') {await continueRouteWithAccess(route); return;}
    lose = false; await fetchRouteWithAccess(route); await route.abort('connectionfailed');
  });
  await page.goto('/#corsi'); await page.getByRole('button', {name: 'Inizia', exact: true}).click();
  await page.getByRole('button', {name: 'Metti alla prova', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Verifica e ritenta', exact: true})).toBeEnabled();
  const answer = page.getByLabel('Il tuo ragionamento', {exact: true}); await expect(answer).toBeDisabled();
  await page.getByRole('button', {name: 'Verifica e ritenta', exact: true}).click();
  await expect(answer).toBeEnabled();
  await expect(page.getByRole('button', {name: 'Metti alla prova', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await answer.fill('Questa risposta riguarda i 3 N della fase attività.');
  const work = (await personalProjection(page)).courseSpace!.work[0]!;
  await courseCommand(page, {kind: 'set-course-position', commandId: randomUUID(), deliveryId, expectedRevision: work.revision, unitId: pack.input.units[0]!.id, stage: 'transfer'});
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText(/La posizione salvata è cambiata in un’altra sessione/)).toBeVisible();
  await expect(page.getByRole('button', {name: 'Metti alla prova', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(answer).toHaveValue('Questa risposta riguarda i 3 N della fase attività.');
  await page.getByRole('button', {name: 'Salva risposta', exact: true}).click(); await expect(answer).toHaveValue('');
  const after = (await personalProjection(page)).courseSpace!.work[0]!;
  expect(after.attempts[0]).toMatchObject({unitId: pack.input.units[0]!.id, stage: 'activity', answer: 'Questa risposta riguarda i 3 N della fase attività.'});
});
