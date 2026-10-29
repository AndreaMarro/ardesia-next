import {randomUUID} from 'node:crypto';
import type {BrowserContext, Page} from '@playwright/test';
import type {LabObject, LearnerWork} from '@ardesia/contracts';
import type {WorkspaceProjection} from '@ardesia/remote-client';
import {
  test, expect, api, rawApi, apiOrigin, credentials, selectWorkspace, selectedWorkspace,
  personalProjection, type TestAccount, type TestWorkspace,
} from './fixtures';
import {authorizeSpring, openMarketplace, storedWorkspace, verifyAndInstallSpring} from './marketplace-helpers';

async function loginUi(page: Page, kind: 'STUDENT_A' | 'STUDENT_B'): Promise<TestAccount> {
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Il tuo spazio', exact: true})).toBeVisible();
  const account = credentials(kind);
  await page.getByLabel('Nome utente', {exact: true}).fill(account.username);
  await page.getByLabel('Password', {exact: true}).fill(account.password);
  await page.getByRole('button', {name: 'Accedi', exact: true}).click();
  await expect(page.getByLabel('Nome utente', {exact: true})).toHaveCount(0);
  return (await api<{account: TestAccount}>(page.context().request, {action: 'session'})).account;
}

async function logoutUi(page: Page): Promise<void> {
  const accountMenu = page.getByRole('button', {name: 'Account e spazi', exact: true});
  if (await accountMenu.count()) await accountMenu.click();
  await page.getByRole('button', {name: 'Esci', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Il tuo spazio', exact: true})).toBeVisible();
}

async function assignUi(page: Page, studentId: string): Promise<void> {
  await page.getByRole('button', {name: 'Assegna', exact: true}).click();
  await page.getByLabel('Identificativo studente', {exact: true}).fill(studentId);
  await page.getByRole('button', {name: 'Assegna lezione', exact: true}).click();
  await expect(page.getByRole('button', {name: `Revoca accesso a ${studentId}`, exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Chiudi finestra', exact: true}).click();
}

async function grantLearnerConsent(page: Page): Promise<void> {
  await page.getByLabel('Leggere il mio stato scientifico', {exact: true}).check();
  await page.getByLabel('Modificare e salvare i parametri', {exact: true}).check();
  await page.getByRole('button', {name: 'Autorizza laboratorio', exact: true}).click();
  await expect(page.getByRole('complementary', {name: 'Proprietà del laboratorio', exact: true})).toHaveAttribute('data-plugin-status', 'ready');
}

function studentWorkspace(teacher: TestWorkspace, student: TestAccount, documentId: string): TestWorkspace {
  return {...teacher, account: student, actor: {actorId: student.id, role: 'student'}, documentId};
}

const personalWork = (projection: WorkspaceProjection, documentId: string): LearnerWork => {
  const work = projection.learnerWork.find(work => work.documentId === documentId);
  if (!work) throw new Error('No authenticated learner work was returned.');
  return work;
};

test('[M3] teacher and two students preserve private laboratory work across independent sessions', async ({page, browser, playwright}, testInfo) => {
  test.setTimeout(120_000);
  const teacherWorkspace = selectedWorkspace(page), title = 'M3 · Continuità docente e studenti';
  const contexts: BrowserContext[] = [];
  const freshContext = async () => {
    const context = await browser.newContext({baseURL: apiOrigin, viewport: page.viewportSize() ?? {width: 1440, height: 960},
      isMobile: testInfo.project.name === 'mobile-chromium', hasTouch: testInfo.project.name === 'mobile-chromium',
      storageState: {cookies: [], origins: []}});
    contexts.push(context); expect(await context.cookies()).toEqual([]); return context;
  };
  try {
    await page.goto('/');
    await page.getByRole('button', {name: 'Nuova lezione', exact: true}).click();
    await page.getByLabel('Titolo nuova lezione', {exact: true}).fill(title);
    await page.getByRole('button', {name: 'Crea lezione', exact: true}).click();
    await page.getByRole('button', {name: 'Scrivi la prima nota', exact: true}).click();
    await page.getByLabel('Titolo oggetto', {exact: true}).fill('Obiettivo della lezione');
    await page.getByLabel('Testo nota', {exact: true}).fill('Varia massa e rigidità e spiega come cambia il periodo.');
    await page.getByRole('button', {name: 'Salva modifiche', exact: true}).click();
    await page.getByRole('button', {name: 'Chiudi proprietà', exact: true}).click();
    await openMarketplace(page); await verifyAndInstallSpring(page); await authorizeSpring(page);
    await page.getByRole('button', {name: 'Attiva Molla ideale', exact: true}).click();
    await page.getByRole('button', {name: 'Aggiungi molla alla lezione', exact: true}).click();
    await expect(page.getByRole('complementary', {name: 'Proprietà del laboratorio', exact: true})).toHaveAttribute('data-plugin-status', 'ready');
    const teacherProjection = await storedWorkspace(page);
    const lesson = teacherProjection.documents.find(document => document.title === title)!;
    const lab = lesson.objects.find((object): object is LabObject => object.type === 'lab')!;
    expect(lesson.ownerId).toBe(teacherWorkspace.actor.actorId);
    expect(lab.data.instanceId).toBeTruthy();

    const firstContext = await freshContext(), secondContext = await freshContext();
    const studentPage = await firstContext.newPage(), secondPage = await secondContext.newPage();
    const first = await loginUi(studentPage, 'STUDENT_A'), second = await loginUi(secondPage, 'STUDENT_B');
    expect(new Set([first.id, second.id, teacherWorkspace.account.id]).size).toBe(3);
    expect(first.role).toBe('student'); expect(second.role).toBe('student');
    await assignUi(page, first.id);
    await selectWorkspace(firstContext, studentWorkspace(teacherWorkspace, first, lesson.id));
    await studentPage.goto('/');
    await expect(studentPage.getByRole('heading', {name: title, exact: true, level: 1})).toBeVisible();
    await studentPage.getByRole('button', {name: 'Modifica Molla ideale', exact: true}).click();
    await expect(studentPage.getByRole('heading', {name: 'Autorizza questo laboratorio', exact: true})).toBeVisible();
    await grantLearnerConsent(studentPage);
    const inspector = studentPage.getByRole('complementary', {name: 'Proprietà del laboratorio', exact: true});
    await inspector.getByLabel('Massa (kg)', {exact: true}).fill('4');
    await inspector.getByLabel('Rigidità (N/m)', {exact: true}).fill('32');
    await inspector.getByRole('button', {name: 'Salva laboratorio', exact: true}).click();
    await expect.poll(async () => personalWork(await personalProjection(studentPage), lesson.id).labs[0]?.data.state.value).toMatchObject({massKg: 4, stiffnessNPerM: 32});
    await studentPage.getByLabel('Note personali', {exact: true}).fill('Appunti privati dello studente A: il periodo cresce con la radice della massa.');
    await studentPage.getByRole('button', {name: 'Salva note personali', exact: true}).click();
    await studentPage.getByLabel('Risposta del tentativo', {exact: true}).fill('Con massa 4 kg e rigidità 32 N/m il periodo è circa 2,22 s.');
    await studentPage.getByRole('button', {name: 'Salva tentativo sull’oggetto selezionato', exact: true}).click();
    await expect.poll(async () => personalWork(await personalProjection(studentPage), lesson.id).attempts.length).toBe(1);
    expect((await storedWorkspace(page)).learnerWork).toEqual([]);

    // Student B knows the exact workspace ID, but has no grant and receives an explicit refusal.
    const denied = await rawApi(secondContext.request, {action: 'open-workspace', workspaceId: teacherWorkspace.workspaceId}, second.id);
    expect(denied).toMatchObject({status: 404, payload: {ok: false, error: {code: 'NOT_FOUND'}}});
    const shareEvidence = studentPage.getByLabel('Condividi con il docente note, tentativi e stati salvati', {exact: true});
    await shareEvidence.click();
    await expect(shareEvidence).toBeChecked();
    await expect.poll(async () => (await storedWorkspace(page)).learnerWork.length).toBe(1);
    await page.reload();
    await page.getByRole('button', {name: 'Assegna', exact: true}).click();
    await page.getByText(/Evidenze condivise · revisione/).click();
    await expect(page.getByRole('dialog')).toContainText('Appunti privati dello studente A');
    await expect(page.getByRole('dialog')).toContainText('"massKg":4');
    await page.getByRole('button', {name: 'Chiudi finestra', exact: true}).click();
    const saved = personalWork(await personalProjection(studentPage), lesson.id);
    expect(saved.labs[0]).toMatchObject({objectId: lab.id, revision: 1, data: {instanceId: lab.data.instanceId}});
    await studentPage.screenshot({path: `artifacts/${testInfo.project.name}-m3-student-first-session.png`, fullPage: true});

    const oldSession = await firstContext.storageState();
    await logoutUi(studentPage);
    expect(await studentPage.evaluate(() => document.querySelector('.learner-content'))).toBeNull();
    const oldRequest = await playwright.request.newContext({baseURL: apiOrigin, storageState: oldSession});
    try {
      expect(await rawApi(oldRequest, {action: 'open-workspace', workspaceId: teacherWorkspace.workspaceId}, first.id))
        .toMatchObject({status: 401, payload: {ok: false, error: {code: 'UNAUTHENTICATED'}}});
    } finally {await oldRequest.dispose();}
    await firstContext.close();

    const resumedContext = await freshContext(), resumed = await resumedContext.newPage();
    const resumedAccount = await loginUi(resumed, 'STUDENT_A');
    expect(resumedAccount.id).toBe(first.id);
    await selectWorkspace(resumedContext, studentWorkspace(teacherWorkspace, first, lesson.id));
    await resumed.goto('/');
    await expect(resumed.getByLabel('Note personali', {exact: true})).toHaveValue(saved.notes);
    await resumed.getByRole('button', {name: 'Modifica Molla ideale', exact: true}).click();
    await expect(resumed.getByLabel('Massa (kg)', {exact: true})).toHaveValue('4');
    await expect(resumed.getByLabel('Rigidità (N/m)', {exact: true})).toHaveValue('32');
    expect(personalWork(await personalProjection(resumed), lesson.id)).toEqual(saved);
    expect(await resumed.evaluate(() => localStorage.getItem('ardesia-next.core.v1'))).toBeNull();
    expect(await resumed.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await resumed.screenshot({path: `artifacts/${testInfo.project.name}-m3-student-independent-session.png`, fullPage: true});

    await assignUi(page, second.id);
    await selectWorkspace(secondContext, studentWorkspace(teacherWorkspace, second, lesson.id));
    await secondPage.goto('/');
    await expect(secondPage.getByRole('heading', {name: title, exact: true, level: 1})).toBeVisible();
    expect((await personalProjection(secondPage)).learnerWork).toEqual([]);
    await expect(secondPage.getByLabel('Note personali', {exact: true})).toHaveValue('');
    expect(await secondPage.locator('body').textContent()).not.toContain(saved.notes);
    const forged = await rawApi(secondContext.request, {action: 'learning-command', workspaceId: teacherWorkspace.workspaceId,
      command: {kind: 'save-learner-note', commandId: randomUUID(), documentId: lesson.id, expectedRevision: saved.revision, studentId: first.id, text: 'Overwrite another learner'}}, second.id);
    expect(forged.payload).toMatchObject({ok: false, error: {code: 'INVALID_REQUEST'}});
    expect(forged.status).toBeGreaterThanOrEqual(400);
    const teacherCommand = await rawApi(secondContext.request, {action: 'command', workspaceId: teacherWorkspace.workspaceId,
      command: {kind: 'rename-document', commandId: randomUUID(), documentId: lesson.id, expectedRevision: lesson.revision, title: 'Unauthorized title'}}, second.id);
    expect(teacherCommand).toMatchObject({status: 403, payload: {ok: false, error: {code: 'FORBIDDEN'}}});
    expect(personalWork(await personalProjection(resumed), lesson.id)).toEqual(saved);

    await resumed.getByRole('button', {name: 'Revoca consenso laboratorio', exact: true}).click();
    await expect(resumed.getByRole('heading', {name: 'Autorizza questo laboratorio', exact: true})).toBeVisible();
    await expect.poll(() => resumed.workers().length).toBe(0);
    const revokedWork = personalWork(await personalProjection(resumed), lesson.id);
    expect(revokedWork.revision).toBe(saved.revision + 1);
    expect(revokedWork).toMatchObject({notes: saved.notes, labs: saved.labs, attempts: saved.attempts});
    const deniedSave = await rawApi(resumedContext.request, {action: 'learning-command', workspaceId: teacherWorkspace.workspaceId,
      command: {kind: 'save-learner-lab', commandId: randomUUID(), documentId: lesson.id, expectedRevision: revokedWork.revision,
        expectedDocumentRevision: lesson.revision, objectId: lab.id, instanceId: lab.data.instanceId, state: saved.labs[0]!.data.state}}, first.id);
    expect(deniedSave.payload).toMatchObject({ok: false, error: {code: 'PLUGIN_CONSENT_REQUIRED'}});
    expect(personalWork(await personalProjection(resumed), lesson.id)).toEqual(revokedWork);

    await page.getByRole('button', {name: 'Assegna', exact: true}).click();
    await page.getByRole('button', {name: `Revoca accesso a ${first.id}`, exact: true}).click();
    await expect(page.getByRole('dialog')).toContainText('Accesso revocato');
    expect(await rawApi(resumedContext.request, {action: 'open-workspace', workspaceId: teacherWorkspace.workspaceId}, first.id))
      .toMatchObject({status: 404, payload: {ok: false, error: {code: 'NOT_FOUND'}}});
    expect(await rawApi(resumedContext.request, {action: 'learning-command', workspaceId: teacherWorkspace.workspaceId,
      command: {kind: 'save-learner-note', commandId: randomUUID(), documentId: lesson.id, expectedRevision: revokedWork.revision, text: 'Write after assignment revocation'}}, first.id))
      .toMatchObject({status: 404, payload: {ok: false, error: {code: 'NOT_FOUND'}}});
    const secondStillAuthorized = await personalProjection(secondPage);
    expect(secondStillAuthorized.assignedDocuments[0]!.id).toBe(lesson.id);
    expect(secondStillAuthorized.learnerWork).toEqual([]);
    await resumed.reload();
    // Other scenarios may leave this account another authorized lesson; revocation is scoped to this document.
    await expect(resumed.getByRole('button', {name: 'Account e spazi', exact: true})
      .or(resumed.getByRole('button', {name: 'Esci', exact: true}))).toBeVisible();
    expect((await api<{account: TestAccount}>(resumedContext.request, {action: 'session'})).account.id).toBe(first.id);
    await expect(resumed.getByRole('heading', {name: title, exact: true, level: 1})).toHaveCount(0);
    await expect(resumed.locator(`.learner-content[data-document-id="${lesson.id}"]`)).toHaveCount(0);
    expect(await resumed.locator('body').textContent()).not.toContain(saved.notes);

    // Change account in the same browser storage without exposing A's state or pending requests to B.
    await logoutUi(resumed);
    const switched = await loginUi(resumed, 'STUDENT_B');
    expect(switched.id).toBe(second.id);
    await selectWorkspace(resumedContext, studentWorkspace(teacherWorkspace, second, lesson.id));
    await resumed.goto('/');
    await expect(resumed.getByLabel('Note personali', {exact: true})).toHaveValue('');
    expect(await resumed.locator('body').textContent()).not.toContain(saved.notes);
    expect((await personalProjection(resumed)).learnerWork).toEqual([]);
  } finally {for (const context of contexts) await context.close().catch(() => undefined);}
});

test('[M3] a lost response is recovered by the same command without duplicate revisions or events', async ({page}) => {
  await page.goto('/');
  const before = await personalProjection(page);
  const source = before.documents[0]!, note = source.objects.find(object => object.type === 'note')!;
  let lost = false, capturedCommandId: string | null = null;
  const receipts: unknown[] = [];
  await page.route('**/api/m3', async route => {
    const input = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
    if (input?.action !== 'command' || input.command.kind !== 'replace-object') {await route.continue(); return;}
    const response = await route.fetch(), body = await response.json();
    expect(body.ok).toBe(true);
    receipts.push(body.result.receipt);
    if (!lost) {lost = true; capturedCommandId = input.command.commandId; await route.abort('connectionfailed');}
    else {expect(input.command.commandId).toBe(capturedCommandId); await route.fulfill({response});}
  });
  await page.getByRole('button', {name: 'Apri Che cosa cambia il periodo?', exact: true}).click();
  await page.getByLabel('Testo nota', {exact: true}).fill('Confermato dal database, risposta iniziale persa.');
  await page.getByRole('button', {name: 'Salva modifiche', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Modifiche in attesa di conferma', exact: true})).toBeVisible();
  await expect(page.locator('.remote-status')).toContainText('Salvataggio da verificare');
  const committed = await personalProjection(page);
  expect(committed.workspaceRevision).toBe(before.workspaceRevision + 1);
  expect(committed.documents[0]!.revision).toBe(source.revision + 1);
  expect(committed.events).toHaveLength(before.events.length + 1);
  expect(committed.documents[0]!.objects.find(object => object.id === note.id)).toMatchObject({revision: note.revision + 1, data: {text: 'Confermato dal database, risposta iniziale persa.'}});
  await page.getByRole('button', {name: 'Verifica e ritenta', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Modifiche da recuperare', exact: true})).toHaveCount(0);
  await expect(page.locator('.remote-status')).toContainText('Confermato dal server');
  expect(receipts).toHaveLength(2);
  expect(receipts[1]).toEqual(receipts[0]);
  expect(await personalProjection(page)).toEqual(committed);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('ardesia-next.pending.v1.')))).toEqual([]);
});

test('[M3] concurrent authenticated writes reject an old revision and preserve the winner', async ({page, context}) => {
  await page.goto('/');
  const selected = selectedWorkspace(page), initial = await personalProjection(page), document = initial.documents[0]!;
  const commands = ['Prima scrittura concorrente', 'Seconda scrittura concorrente'].map(title => ({
    action: 'command', workspaceId: selected.workspaceId,
    command: {kind: 'rename-document', commandId: randomUUID(), documentId: document.id, expectedRevision: document.revision, title},
  }));
  const results = await Promise.all(commands.map(command => rawApi(context.request, command, selected.account.id)));
  expect(results.filter(result => result.payload.ok === true)).toHaveLength(1);
  expect(results.filter(result => result.payload.error?.code === 'REVISION_CONFLICT')).toHaveLength(1);
  const winnerIndex = results.findIndex(result => result.payload.ok === true), winner = results[winnerIndex]!;
  const committed = await personalProjection(page);
  expect(committed.documents[0]!.title).toBe(commands[winnerIndex]!.command.title);
  expect(committed.documents[0]!.revision).toBe(document.revision + 1);
  expect(committed.events).toHaveLength(initial.events.length + 1);
  const retry = await rawApi(context.request, commands[winnerIndex]!, selected.account.id);
  expect(retry.payload.result.receipt).toEqual(winner.payload.result.receipt);
  expect(await personalProjection(page)).toEqual(committed);
});
