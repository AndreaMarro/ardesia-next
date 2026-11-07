import {randomUUID} from 'node:crypto';
import type {Browser, BrowserContext, Page} from '@playwright/test';
import {toObjectInput} from '@ardesia/contracts';
import type {LearnerWork} from '@ardesia/contracts';
import type {WorkspaceProjection} from '@ardesia/remote-client';
import {test, expect, api, rawApi, apiOrigin, loginContext, personalProjection, selectedWorkspace, selectWorkspace, type TestWorkspace} from './fixtures';

async function learnerContext(browser: Browser, teacher: TestWorkspace, project: string, viewport: {width: number; height: number}) {
  const context = await browser.newContext({baseURL: apiOrigin, viewport, hasTouch: project === 'mobile-chromium', isMobile: project === 'mobile-chromium', storageState: {cookies: [], origins: []}});
  const account = await loginContext(context, 'STUDENT_B', project);
  await selectWorkspace(context, {...teacher, account, actor: {actorId: account.id, role: 'student'}});
  return {context, account, page: await context.newPage()};
}
async function sharedDialog(page: Page) {
  await page.getByRole('button', {name: 'Assegna', exact: true}).click();
  await page.getByText(/Evidenze condivise · revisione/).click();
  return page.getByRole('dialog', {name: 'Assegna la lezione'});
}
async function work(page: Page): Promise<LearnerWork> {return (await personalProjection(page)).learnerWork[0]!;}
async function prepare(page: Page, browser: Browser, project: string) {
  const teacher = selectedWorkspace(page), student = await learnerContext(browser, teacher, project, page.viewportSize()!);
  await api(page.context().request, {action: 'learning-command', workspaceId: teacher.workspaceId, command: {kind: 'assign-lesson', commandId: randomUUID(), documentId: teacher.documentId, studentId: student.account.id, expectedRevision: 0}}, teacher.account.id);
  await student.page.goto('/');
  await student.page.getByLabel('Risposta del tentativo').fill('Se L quadruplica, il periodo quadruplica.');
  await student.page.getByRole('button', {name: 'Modifica Che cosa cambia il periodo?', exact: true}).click();
  await student.page.getByRole('button', {name: 'Salva tentativo sull’oggetto selezionato', exact: true}).click();
  await expect.poll(async () => (await work(student.page))?.attempts.length ?? 0).toBe(1);
  await expect(student.page.getByLabel('Risposta del tentativo')).toHaveValue('');
  expect((await personalProjection(page)).learnerWork).toEqual([]);
  await student.page.getByLabel('Condividi con il docente note, tentativi e stati salvati', {exact: true}).click();
  await expect.poll(async () => (await work(student.page)).evidenceShared).toBe(true);
  await page.goto('/');
  return {teacher, student};
}

test('feedback, correction and diary survive independent sessions with exact sources and revocable sharing', async ({page, browser}, info) => {
  test.setTimeout(100_000);
  const contexts: BrowserContext[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  try {
    const {teacher, student} = await prepare(page, browser, info.project.name); contexts.push(student.context);
    const dialog = await sharedDialog(page);
    await dialog.getByRole('button', {name: 'Leggi fonte del tentativo', exact: true}).click();
    await expect(dialog).toContainText('Prima osserva. Poi formula un’ipotesi e raccogli una misura.');
    await dialog.getByRole('button', {name: 'Scrivi feedback', exact: true}).click();
    await dialog.getByLabel('Commento docente').fill('La lunghezza compare sotto radice.');
    await dialog.getByLabel('Passo successivo', {exact: true}).fill('Confronta T(4L) con T(L), mantenendo costante g.');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible(); await expect(dialog.getByLabel('Commento docente')).toHaveValue('La lunghezza compare sotto radice.');
    await dialog.getByRole('button', {name: 'Salva feedback', exact: true}).click();
    await expect(dialog.getByRole('form', {name: 'Feedback docente'})).toHaveCount(0);
    const first = await work(student.page); expect(first.feedback).toHaveLength(1);
    const again = await learnerContext(browser, teacher, info.project.name, page.viewportSize()!); contexts.push(again.context);
    again.page.on('pageerror', error => errors.push(error.message));
    again.page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    await again.page.goto('/');
    await again.page.getByText('Tentativi salvati (1)', {exact: true}).click();
    await expect(again.page.getByRole('region', {name: 'Diario dei tentativi'})).toContainText('1 da rivedere');
    await again.page.getByRole('button', {name: 'Riprendi da questo feedback', exact: true}).click();
    const answer = again.page.getByLabel('Risposta del tentativo');
    await answer.fill('Il periodo raddoppia: √4 = 2.');
    // A real teacher source edit while the learner is drafting must not silently retarget the answer.
    const current = (await personalProjection(page)).documents.find(document => document.id === teacher.documentId)!;
    const note = current.objects.find(object => object.id === first.attempts[0]!.objectId)!;
    const changed = toObjectInput(note); if (changed.type !== 'note') throw Error('Expected note');
    changed.data.text = 'Specifica ora anche le ipotesi di piccole oscillazioni e gravità costante.';
    await api(page.context().request, {action: 'command', workspaceId: teacher.workspaceId, command: {kind: 'replace-object', commandId: randomUUID(), documentId: teacher.documentId, expectedRevision: current.revision, object: changed}}, teacher.account.id);
    const amendmentId = randomUUID();
    await api(page.context().request, {action: 'learning-command', workspaceId: teacher.workspaceId, command: {kind: 'review-learner-attempt', commandId: randomUUID(), documentId: teacher.documentId, studentId: student.account.id, expectedRevision: first.revision,
      attemptId: first.attempts[0]!.id, feedbackId: amendmentId, supersedesFeedbackId: first.feedback![0]!.id, outcome: 'partial', comment: 'La direzione della variazione è corretta; controlla il fattore.', nextStep: 'Confronta T(4L) con T(L).'}}, teacher.account.id);
    await again.page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(again.page.getByText('La fonte è cambiata durante la stesura.', {exact: false})).toBeVisible();
    await expect(answer).toHaveValue('Il periodo raddoppia: √4 = 2.');
    const save = again.page.getByRole('button', {name: 'Salva tentativo sull’oggetto selezionato', exact: true});
    await expect(save).toBeDisabled();
    await again.page.getByRole('button', {name: 'Modifica Che cosa cambia il periodo?', exact: true}).click();
    await expect(save).toBeDisabled(); // Reselecting the same object cannot erase the draft baseline.
    await again.page.getByRole('button', {name: 'Ho riletto il feedback aggiornato', exact: true}).click();
    await expect(answer).toHaveValue('Il periodo raddoppia: √4 = 2.'); await expect(save).toBeDisabled();
    await again.page.getByRole('button', {name: 'Ho riletto la fonte attuale', exact: true}).click();
    await answer.fill('Il periodo raddoppia: √4 = 2, per piccole oscillazioni e g costante.');
    await save.click();
    await expect.poll(async () => (await work(again.page)).attempts.length).toBe(2);
    const corrected = await work(again.page);
    expect(corrected.attempts[1]).toMatchObject({objectId: note.id, sourceObjectRevision: note.revision + 1, replyToFeedbackId: amendmentId});
    expect(corrected.attempts[0]).toEqual(first.attempts[0]);
    const oldAttempt = again.page.locator(`[data-attempt-id="${first.attempts[0]!.id}"]`);
    await oldAttempt.getByRole('button', {name: 'Leggi fonte del tentativo', exact: true}).click();
    await expect(oldAttempt).toContainText('Prima osserva. Poi formula un’ipotesi e raccogli una misura.');
    await page.reload(); const reopened = await sharedDialog(page);
    const secondAttempt = reopened.locator(`[data-attempt-id="${corrected.attempts[1]!.id}"]`);
    await secondAttempt.getByRole('button', {name: 'Scrivi feedback', exact: true}).click();
    await reopened.getByLabel('Esito del tentativo').selectOption('demonstrated');
    await reopened.getByLabel('Commento docente').fill('Rapporto e ipotesi sono corretti in questa risposta.');
    await reopened.getByRole('button', {name: 'Salva feedback', exact: true}).click();
    await expect(reopened.getByRole('form', {name: 'Feedback docente'})).toHaveCount(0);
    await expect(secondAttempt).toContainText('Dimostrato in questo tentativo');
    await page.screenshot({path: info.outputPath('teacher-feedback.png'), fullPage: false});
    await again.page.reload(); await again.page.getByText('Tentativi salvati (2)', {exact: true}).click();
    await expect(again.page.getByRole('region', {name: 'Diario dei tentativi'})).toContainText('0 da rivedere · 0 in attesa di feedback · 1 dimostrati');
    await again.page.getByRole('region', {name: 'Diario dei tentativi'}).scrollIntoViewIfNeeded();
    await again.page.screenshot({path: info.outputPath('learner-diary.png'), fullPage: false});
    await expect(again.page).toHaveTitle(/Ardesia/); expect(again.page.url()).toBe(apiOrigin + '/');
    await expect(again.page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await again.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await again.page.getByLabel('Condividi con il docente note, tentativi e stati salvati', {exact: true}).click();
    await expect.poll(async () => (await work(again.page)).evidenceShared).toBe(false);
    await page.reload(); await page.getByRole('button', {name: 'Assegna', exact: true}).click();
    await expect(page.getByRole('dialog')).toContainText('Nessuna evidenza condivisa disponibile.');
    await expect(page.getByRole('region', {name: 'Diario dei tentativi'})).toHaveCount(0);
    expect((await rawApi(page.context().request, {action: 'read-attempt-source', workspaceId: teacher.workspaceId, documentId: teacher.documentId, attemptId: first.attempts[0]!.id, studentId: student.account.id}, teacher.account.id)).status).toBe(404);
    expect((await work(again.page)).feedback).toHaveLength(3); expect(errors).toEqual([]);
  } finally {for (const context of contexts) await context.close();}
});

test('lost feedback acknowledgement recovers the original command and stale drafts stay blocked', async ({page, browser}, info) => {
  test.setTimeout(70_000);
  const {teacher, student} = await prepare(page, browser, info.project.name);
  try {
    const dialog = await sharedDialog(page);
    await dialog.getByRole('button', {name: 'Scrivi feedback', exact: true}).click();
    await dialog.getByLabel('Commento docente').fill('Feedback recuperabile.');
    await dialog.getByLabel('Passo successivo', {exact: true}).fill('Verifica la radice.');
    // Concurrent real student write invalidates the teacher's review baseline, preserving the draft.
    await student.page.getByLabel('Note personali').fill('Una nuova osservazione.');
    await student.page.getByRole('button', {name: 'Salva note personali', exact: true}).click();
    await expect.poll(async () => (await work(student.page)).revision).toBe(3);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(dialog.getByRole('button', {name: 'Salva feedback', exact: true})).toBeDisabled();
    await expect(dialog.getByLabel('Commento docente')).toHaveValue('Feedback recuperabile.');
    await dialog.getByRole('button', {name: 'Ho riletto le evidenze aggiornate', exact: true}).click();
    let original: Record<string, unknown> | undefined;
    await page.route('**/api/m3', async route => {
      const input = route.request().postDataJSON();
      if (input?.action !== 'learning-command' || input.command.kind !== 'review-learner-attempt') {await route.continue(); return;}
      const response = await route.fetch(); expect((await response.json()).ok).toBe(true); original = input;
      await route.abort('failed');
    });
    await dialog.getByRole('button', {name: 'Salva feedback', exact: true}).click();
    await expect(dialog.getByRole('alert').last()).toBeVisible();
    await expect.poll(async () => (await work(student.page)).feedback?.length).toBe(1);
    expect(original).toBeTruthy(); await page.unroute('**/api/m3');
    await dialog.getByRole('button', {name: 'Scarta bozza feedback', exact: true}).click();
    await dialog.getByRole('button', {name: 'Chiudi finestra', exact: true}).click();
    await page.getByRole('button', {name: 'Account e spazi', exact: true}).click();
    await page.getByRole('button', {name: 'Verifica e ritenta', exact: true}).click();
    await expect(page.getByRole('button', {name: 'Verifica e ritenta', exact: true})).toHaveCount(0);
    const confirmed = (await api<{projection: WorkspaceProjection}>(page.context().request, {action: 'export-personal', workspaceId: teacher.workspaceId}, teacher.account.id)).projection;
    expect(confirmed.learnerWork[0]!.feedback).toHaveLength(1);
    // Once sharing is withdrawn the same already-committed retry is forbidden.
    await student.page.reload();
    await student.page.getByLabel('Condividi con il docente note, tentativi e stati salvati', {exact: true}).click();
    await expect.poll(async () => (await work(student.page)).evidenceShared).toBe(false);
    expect((await rawApi(page.context().request, original!, teacher.account.id)).status).toBe(404);
  } finally {await student.context.close();}
});


test('late teacher acknowledgement cannot close a new draft after revocation and renewed sharing', async ({page, browser}, info) => {
  test.setTimeout(70_000);
  const {student} = await prepare(page, browser, info.project.name);
  let release!: () => void, delivered!: () => void, heldCommandId = '';
  const gate = new Promise<void>(resolve => {release = resolve;}), done = new Promise<void>(resolve => {delivered = resolve;});
  try {
    let dialog = await sharedDialog(page);
    await dialog.getByRole('button', {name: 'Scrivi feedback', exact: true}).click();
    await dialog.getByLabel('Commento docente').fill('Prima valutazione.');
    await dialog.getByLabel('Passo successivo', {exact: true}).fill('Verifica il rapporto.');
    await page.route('**/api/m3', async route => {
      const input = route.request().postDataJSON();
      if (input?.action !== 'learning-command' || input.command.kind !== 'review-learner-attempt') {await route.continue(); return;}
      const response = await route.fetch(); expect((await response.json()).ok).toBe(true);
      heldCommandId = input.command.commandId; await gate; await route.fulfill({response}); delivered();
    });
    await dialog.getByRole('button', {name: 'Salva feedback', exact: true}).click();
    await expect.poll(async () => (await work(student.page)).feedback?.length).toBe(1);
    await student.page.reload();
    const share = student.page.getByLabel('Condividi con il docente note, tentativi e stati salvati', {exact: true});
    await share.click(); await expect.poll(async () => (await work(student.page)).evidenceShared).toBe(false);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(dialog.getByRole('form', {name: 'Feedback docente'})).toHaveCount(0);
    await expect(dialog).toContainText('Nessuna evidenza condivisa disponibile.');
    await share.click(); await expect.poll(async () => (await work(student.page)).evidenceShared).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await dialog.getByText(/Evidenze condivise · revisione/).click();
    await dialog.getByRole('button', {name: 'Rettifica feedback', exact: true}).click();
    await dialog.getByLabel('Commento docente').fill('Nuova rettifica da conservare.');
    release(); await done; await page.unroute('**/api/m3');
    await expect.poll(() => page.evaluate(id => Object.keys(localStorage).filter(key => key.startsWith('ardesia-next.pending.')).every(key => !localStorage.getItem(key)?.includes(id)), heldCommandId)).toBe(true);
    await expect(dialog.getByRole('form', {name: 'Feedback docente'})).toBeVisible();
    await expect(dialog.getByLabel('Commento docente')).toHaveValue('Nuova rettifica da conservare.');
    await dialog.getByRole('button', {name: 'Salva feedback', exact: true}).click();
    await expect(dialog.getByRole('form', {name: 'Feedback docente'})).toHaveCount(0);
    await expect.poll(async () => (await work(student.page)).feedback?.length).toBe(2);
    expect((await work(student.page)).feedback![1]!.comment).toBe('Nuova rettifica da conservare.');
  } finally {release(); await student.context.close();}
});
