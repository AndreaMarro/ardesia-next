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

test('next steps distinguish pending corrections from amended feedback and preserve the exact evidence chain', async ({page, browser}, info) => {
  test.setTimeout(80_000);
  const {teacher,student}=await prepare(page,browser,info.project.name),errors:string[]=[];
  for(const target of [page,student.page]){
    target.on('pageerror',error=>errors.push(error.message));
    target.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  }
  try{
    const dialog=await sharedDialog(page),reviews=dialog.getByRole('region',{name:'Risposte da rivedere'});
    await expect(reviews).toContainText('Tentativo 1');
    await reviews.getByRole('button',{name:'Scrivi il feedback',exact:true}).click();
    await dialog.getByLabel('Commento docente').fill('Distingui il rapporto tra lunghezze dal rapporto tra periodi.');
    await dialog.getByLabel('Passo successivo',{exact:true}).fill('Confronta T(4L) e T(L), lasciando invariata g.');
    await dialog.getByRole('button',{name:'Salva feedback',exact:true}).click();
    await expect(dialog.getByRole('form',{name:'Feedback docente'})).toHaveCount(0);
    await student.page.reload();
    const next=student.page.getByRole('region',{name:'Prossimo passo'});
    await expect(next).toContainText('Confronta T(4L) e T(L), lasciando invariata g.');
    await expect(student.page.getByRole('region',{name:'Diario dei tentativi'})).toBeHidden();
    // The new entry point uses the existing guard; an unrelated draft is not overwritten.
    const answer=student.page.getByLabel('Risposta del tentativo');
    await answer.fill('Bozza ancora aperta.');
    await next.getByRole('button',{name:'Riprendi il feedback',exact:true}).click();
    await expect(answer).toHaveValue('Bozza ancora aperta.');
    await expect(student.page.getByRole('alert')).toContainText('Salva o scarta la bozza aperta');
    await student.page.getByRole('button',{name:'Scarta bozza del tentativo',exact:true}).click();
    await next.getByRole('button',{name:'Riprendi il feedback',exact:true}).click();
    await answer.fill('Il periodo raddoppia, perché la radice di quattro è due.');
    await student.page.getByRole('button',{name:'Salva tentativo sull’oggetto selezionato',exact:true}).click();
    await expect(next).toContainText('Correzione in attesa di feedback');
    await expect(next).toContainText('1 di 1');
    await expect(next.getByRole('button',{name:'Riprendi il feedback',exact:true})).toHaveCount(0);
    const corrected=await work(student.page),original=corrected.attempts[0]!,reply=corrected.attempts[1]!,feedback=corrected.feedback![0]!;
    expect(reply.replyToFeedbackId).toBe(feedback.id);
    await next.scrollIntoViewIfNeeded();
    await student.page.screenshot({path:info.outputPath('correction-pending.png'),fullPage:false});
    const amendmentId=randomUUID();
    await api(page.context().request,{action:'learning-command',workspaceId:teacher.workspaceId,command:{kind:'review-learner-attempt',commandId:randomUUID(),documentId:teacher.documentId,studentId:student.account.id,expectedRevision:corrected.revision,
      attemptId:original.id,feedbackId:amendmentId,supersedesFeedbackId:feedback.id,outcome:'partial',comment:'Il verso è corretto; esplicita anche le ipotesi.',nextStep:'Spiega perché servono piccole oscillazioni.'}},teacher.account.id);
    await student.page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(next).toContainText('Feedback rettificato dopo la correzione');
    await expect(next).toContainText('1 di 2');
    await expect(next).toContainText('Spiega perché servono piccole oscillazioni.');
    await expect(next.getByRole('button',{name:'Riprendi il feedback',exact:true})).toHaveCount(0);
    await next.getByText('Su quali prove si basa',{exact:true}).click();
    await expect(next).toContainText('Gli eventuali aiuti usati durante la risposta non sono registrati in campi strutturati.');
    await next.scrollIntoViewIfNeeded();
    await student.page.screenshot({path:info.outputPath('feedback-amended.png'),fullPage:false});
    await next.getByRole('button',{name:'Successivo',exact:true}).click();
    await expect(next).toContainText('Correzione in attesa di feedback');
    await next.getByRole('button',{name:'Vedi la prova',exact:true}).click();
    const sourceAttempt=student.page.locator(`[data-attempt-id="${original.id}"]`),correction=student.page.locator(`[data-attempt-id="${reply.id}"]`);
    await expect(correction).toBeFocused();
    await correction.getByText('Feedback a cui risponde',{exact:true}).click();
    await expect(correction).toContainText(feedback.nextStep);
    await expect(correction).not.toContainText('Spiega perché servono piccole oscillazioni.');
    await correction.getByRole('button',{name:'Vedi il tentativo di origine (1)',exact:true}).click();
    await expect(sourceAttempt).toBeFocused();
    await sourceAttempt.getByRole('button',{name:'Leggi fonte del tentativo',exact:true}).click();
    await expect(sourceAttempt).toContainText('Prima osserva. Poi formula un’ipotesi e raccogli una misura.');
    expect((await work(student.page)).attempts).toEqual(corrected.attempts);
    await page.reload();const reopened=await sharedDialog(page);
    const pending=reopened.getByRole('region',{name:'Risposte da rivedere'});
    await expect(pending).toContainText('Tentativo 2');
    await pending.getByRole('button',{name:'Scrivi il feedback',exact:true}).click();
    await reopened.getByLabel('Esito del tentativo').selectOption('demonstrated');
    await reopened.getByLabel('Commento docente').fill('Il rapporto calcolato è corretto in questo tentativo.');
    await reopened.getByRole('button',{name:'Salva feedback',exact:true}).click();
    await expect(pending).toContainText('Ogni tentativo condiviso ha un feedback.');
    await student.page.reload();
    await expect(next).toContainText('Feedback rettificato dopo la correzione');
    await expect(next).toContainText('1 di 1');
    await expect(next).not.toContainText('Correzione in attesa di feedback');
    const reviewed=await work(student.page);
    await api(page.context().request,{action:'learning-command',workspaceId:teacher.workspaceId,command:{kind:'review-learner-attempt',commandId:randomUUID(),documentId:teacher.documentId,studentId:student.account.id,expectedRevision:reviewed.revision,
      attemptId:original.id,feedbackId:randomUUID(),supersedesFeedbackId:amendmentId,outcome:'demonstrated',comment:'La rettifica conclude questa valutazione.',nextStep:''}},teacher.account.id);
    await student.page.reload();
    await expect(next).toContainText('Non ci sono indicazioni aperte nei feedback salvati.');
    const concluded=await work(student.page),replyFeedback=concluded.feedback!.find(value=>value.attemptId===reply.id)!;
    await api(page.context().request,{action:'learning-command',workspaceId:teacher.workspaceId,command:{kind:'review-learner-attempt',commandId:randomUUID(),documentId:teacher.documentId,studentId:student.account.id,expectedRevision:concluded.revision,
      attemptId:reply.id,feedbackId:randomUUID(),supersedesFeedbackId:replyFeedback.id,outcome:'demonstrated',comment:'Il rapporto resta corretto.',nextStep:'Applica ora il principio all’oggetto B proposto in classe.'}},teacher.account.id);
    await student.page.reload();
    await expect(next).toContainText('Un’indicazione del docente');
    await expect(next).toContainText('Applica ora il principio all’oggetto B proposto in classe.');
    await expect(next.getByRole('button',{name:'Riprendi il feedback',exact:true})).toHaveCount(0);
    await expect(student.page).toHaveTitle(/Ardesia/);expect(student.page.url()).toBe(apiOrigin+'/');
    await expect(student.page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await student.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  }finally{await student.context.close();}
});

test('attempt sources never cross lessons with equal attempt identifiers and work revisions',async({page,browser},info)=>{
  test.setTimeout(60_000);
  const {teacher,student}=await prepare(page,browser,info.project.name);
  try{
    const first=await work(student.page),original=first.attempts[0]!,otherDocument=randomUUID();
    let revision=0;
    for(const command of [{kind:'create-document',title:'Seconda lezione indipendente'},
      {kind:'add-object',object:{id:original.objectId,type:'note',title:'Fonte della seconda lezione',x:50,y:100,width:300,height:180,data:{text:'Seconda fonte distinta, senza contaminazioni.'}}}]){
      const result=await api<{projection:WorkspaceProjection}>(page.context().request,{action:'command',workspaceId:teacher.workspaceId,command:{...command,commandId:randomUUID(),documentId:otherDocument,expectedRevision:revision}},teacher.account.id);
      revision=result.projection.documents.find(document=>document.id===otherDocument)!.revision;
    }
    await api(page.context().request,{action:'learning-command',workspaceId:teacher.workspaceId,command:{kind:'assign-lesson',commandId:randomUUID(),documentId:otherDocument,studentId:student.account.id,expectedRevision:0}},teacher.account.id);
    await api(student.context.request,{action:'learning-command',workspaceId:teacher.workspaceId,command:{kind:'record-learner-attempt',commandId:randomUUID(),documentId:otherDocument,expectedRevision:0,expectedDocumentRevision:revision,objectId:original.objectId,attemptId:original.id,answer:'Tentativo indipendente nella seconda lezione.'}},student.account.id);
    await api(student.context.request,{action:'learning-command',workspaceId:teacher.workspaceId,command:{kind:'share-learner-evidence',commandId:randomUUID(),documentId:otherDocument,expectedRevision:1,shared:true}},student.account.id);
    await student.page.reload();
    await student.page.getByRole('region',{name:'Prossimo passo'}).getByRole('button',{name:'Vedi la prova',exact:true}).click();
    await student.page.getByRole('button',{name:'Leggi fonte del tentativo',exact:true}).click();
    await expect(student.page.locator('.attempt-source-content')).toContainText('Prima osserva. Poi formula un’ipotesi e raccogli una misura.');
    await student.page.evaluate(target=>{
      const audit={leaks:[] as string[]};Object.assign(window,{sourceIsolationAudit:audit});
      const check=()=>{const view=document.querySelector(`.learner-content[data-document-id="${target}"]`);const text=view?.querySelector('.attempt-source-content')?.textContent??'';if(text.includes('Prima osserva.'))audit.leaks.push(text);};
      new MutationObserver(check).observe(document.body,{childList:true,subtree:true,attributes:true,characterData:true});
    },otherDocument);
    await student.page.getByRole('navigation',{name:'Lezioni assegnate'}).getByRole('button',{name:'Seconda lezione indipendente',exact:true}).click();
    await expect(student.page.locator('.learner-content')).toHaveAttribute('data-document-id',otherDocument);
    await expect(student.page.locator('.attempt-source-content')).toHaveCount(0);
    const works=(await personalProjection(student.page)).learnerWork;
    expect(works.find(value=>value.documentId===otherDocument)!.revision).toBe(first.revision);
    await student.page.getByRole('button',{name:'Leggi fonte del tentativo',exact:true}).click();
    await expect(student.page.locator('.attempt-source-content')).toContainText('Seconda fonte distinta, senza contaminazioni.');
    expect(await student.page.evaluate(()=>(window as unknown as {sourceIsolationAudit:{leaks:string[]}}).sourceIsolationAudit.leaks)).toEqual([]);
  }finally{await student.context.close();}
});

test('next steps and a late source read disappear when evidence sharing is revoked',async({page,browser},info)=>{
  test.setTimeout(60_000);
  const {student}=await prepare(page,browser,info.project.name);
  let release!:()=>void,received!:()=>void,held!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;}),done=new Promise<void>(resolve=>{received=resolve;}),started=new Promise<void>(resolve=>{held=resolve;});
  try{
    const dialog=await sharedDialog(page);
    await dialog.getByRole('region',{name:'Risposte da rivedere'}).getByRole('button',{name:'Vedi la prova',exact:true}).click();
    await page.route('**/api/m3',async route=>{
      if(route.request().postDataJSON()?.action!=='read-attempt-source'){await route.continue();return;}
      const response=await route.fetch();expect((await response.json()).ok).toBe(true);held();await gate;await route.fulfill({response});received();
    });
    await dialog.getByRole('button',{name:'Leggi fonte del tentativo',exact:true}).click();await started;
    await student.page.getByLabel('Condividi con il docente note, tentativi e stati salvati',{exact:true}).click();
    await expect.poll(async()=>(await work(student.page)).evidenceShared).toBe(false);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(dialog).toContainText('Nessuna evidenza condivisa disponibile.');
    await expect(dialog.getByRole('region',{name:'Risposte da rivedere'})).toHaveCount(0);
    release();await done;await page.unroute('**/api/m3');
    await expect(dialog.getByRole('region',{name:'Diario dei tentativi'})).toHaveCount(0);
    await expect(dialog).not.toContainText('Prima osserva. Poi formula un’ipotesi e raccogli una misura.');
    await expect(student.page.getByRole('region',{name:'Prossimo passo'})).toContainText('Risposta in attesa di feedback');
    expect((await work(student.page)).attempts).toHaveLength(1);
  }finally{release();await student.context.close();}
});
