import {createHash, randomUUID} from 'node:crypto';
import {expect, request as playwrightRequest} from '@playwright/test';
import {fetchApiWithAccess, fetchRouteWithAccess, continueRouteWithAccess,
  installContextAccess, closeContextWithAccess, readApiJson} from '../e2e/remote-access.ts';
import {m3ReportDigest} from './m3-evidence.mjs';

const now = () => new Date().toISOString();
const need = (condition, code = 'BROWSER_OBSERVATION_FAILED') => {if (!condition) throw Error(code);};
export function proof(observation) {
  const value = {...observation, observedAt: now(), passed: true};
  return {...value, artifactDigest: m3ReportDigest(value)};
}

/** Real browser/API observations. No fixtures, successful response mocks, traces or stored auth state. */
export async function collectBrowserAcceptance({browser, current, deployment, origin}) {
  const startedAt = now(), nonce = randomUUID(), contexts = [], checks = {}, accounts = {}, sessions = {};
  const pseudonym = value => createHash('sha256').update(nonce).update('\0').update(value).digest('hex');
  async function raw(context, body, accountId) {
    const response = await fetchApiWithAccess(context.request ?? context, `${origin}/api/m3`, {method: 'POST', data: body,
      headers: {Origin: origin, ...(accountId ? {'X-Ardesia-Account': accountId} : {})}});
    try {return {status: response.status(), body: await readApiJson(response)};} finally {await response.dispose();}
  }
  async function api(context, body, accountId) {
    const result = await raw(context, body, accountId);
    need(result.status === 200 && result.body.ok === true);
    return result.body.result;
  }
  async function fresh(name, kind, accountName) {
    const context = await browser.newContext({baseURL: origin, serviceWorkers: 'block', storageState: {cookies: [], origins: []}});
    contexts.push(context); need((await context.cookies()).length === 0);
    await installContextAccess(context);
    const page = await context.newPage();
    await page.goto('/');
    const password = page.getByLabel('Password', {exact: true});
    try {
      await expect(password).toHaveAttribute('type', 'password');
      await page.getByLabel('Nome utente', {exact: true}).fill(process.env[`ARDESIA_E2E_${kind}_USERNAME`]);
      await password.fill(process.env[`ARDESIA_E2E_${kind}_PASSWORD`]);
      await page.getByRole('button', {name: 'Accedi', exact: true}).click();
      await expect(page.getByLabel('Nome utente', {exact: true})).toHaveCount(0);
    } catch {
      await password.fill('', {timeout: 500}).catch(() => undefined);
      throw Error('QA_LOGIN_FAILED');
    }
    const {account} = await api(context, {action: 'session'});
    const session = (await context.cookies()).find(c => ['__Host-ardesia_session', 'ardesia_dev_session'].includes(c.name));
    need(session && account.role === (accountName === 'teacher' ? 'teacher' : 'student'));
    const accountHash = pseudonym(account.id);
    if (accounts[accountName]) need(accounts[accountName].idHash === accountHash);
    accounts[accountName] = {idHash: accountHash, role: account.role};
    sessions[name] = {accountIdHash: accountHash, sessionIdHash: pseudonym(session.value), contextId: randomUUID(), authenticatedAt: now()};
    return {context, page, account};
  }
  let result;
  try {
    const teacher = await fresh('teacher', 'TEACHER', 'teacher');
    const a1 = await fresh('studentA1', 'STUDENT_A', 'studentA');
    const b = await fresh('studentB', 'STUDENT_B', 'studentB');
    need(new Set([teacher.account.id, a1.account.id, b.account.id]).size === 3);
    const workspace = await api(teacher.context, {action: 'create-workspace', commandId: randomUUID(), title: `QA acceptance ${nonce}`}, teacher.account.id);
    const documentId = randomUUID(), objectId = randomUUID(), instanceId = randomUUID(), noteId = randomUUID();
    const command = (owner, value, action = 'command') => api(owner.context,
      {action, workspaceId: workspace.workspaceId, command: {commandId: randomUUID(), documentId, ...value}}, owner.account.id);
    const projection = owner => api(owner.context, {action: 'open-workspace', workspaceId: workspace.workspaceId}, owner.account.id);
    const work = projection => projection.learnerWork.find(w => w.documentId === documentId);
    await command(teacher, {kind: 'create-document', expectedRevision: 0, title: 'QA · Ripresa indipendente'});
    const manifestResponse = await fetchApiWithAccess(teacher.context.request, `${origin}/plugins/ideal-spring/1.0.0/manifest.json`);
    let manifest;
    try {need(manifestResponse.status() === 200); manifest = await readApiJson(manifestResponse);} finally {await manifestResponse.dispose();}
    const release = {pluginId: manifest.id, version: manifest.version, bundleDigest: manifest.integrity.digest, publisher: manifest.publisher,
      license: manifest.license, provenance: manifest.provenance, sdkVersion: manifest.sdkVersion, stateSchemaVersion: manifest.stateSchemaVersion, capabilities: manifest.capabilities};
    for (const spec of [{kind: 'install-plugin', expectedRevision: 0, release},
      {kind: 'consent-plugin', expectedRevision: 1, releaseDigest: release.bundleDigest, capabilities: release.capabilities},
      {kind: 'activate-plugin', expectedRevision: 2}]) {
      await api(teacher.context, {action: 'plugin-command', workspaceId: workspace.workspaceId,
        command: {...spec, pluginId: release.pluginId, commandId: randomUUID()}}, teacher.account.id);
    }
    const initialState = {schemaVersion: '1.0.0', value: {massKg: 1, stiffnessNPerM: 20, initialDisplacementM: 0.1, initialVelocityMPerS: 0, timeS: 0}};
    await command(teacher, {kind: 'add-object', expectedRevision: 1, object: {id: objectId, type: 'lab', title: 'Molla ideale',
      x: 20, y: 20, width: 420, height: 280, data: {pluginId: release.pluginId, pluginVersion: release.version, instanceId,
        stateSchemaVersion: release.stateSchemaVersion, bundleDigest: release.bundleDigest, publisher: release.publisher, state: initialState}}});
    await command(teacher, {kind: 'add-object', expectedRevision: 2, object: {id: noteId, type: 'note', title: 'Nota QA',
      x: 20, y: 340, width: 280, height: 160, data: {text: 'Risposta da recuperare'}}});
    await command(teacher, {kind: 'assign-lesson', expectedRevision: 0, studentId: a1.account.id}, 'learning-command');
    async function open(owner) {
      await owner.context.addInitScript(({key, value}) => sessionStorage.setItem(key, value),
        {key: `ardesia-next-remote-workspace:${owner.account.id}`, value: workspace.workspaceId});
      await owner.page.goto('/');
    }
    await open(a1);
    await a1.page.getByRole('button', {name: 'Modifica Molla ideale', exact: true}).click();
    await a1.page.getByLabel('Leggere il mio stato scientifico', {exact: true}).check();
    await a1.page.getByLabel('Modificare e salvare i parametri', {exact: true}).check();
    await a1.page.getByRole('button', {name: 'Autorizza laboratorio', exact: true}).click();
    await expect(a1.page.getByRole('complementary', {name: 'Proprietà del laboratorio', exact: true})).toHaveAttribute('data-plugin-status', 'ready');
    await a1.page.getByLabel('Massa (kg)', {exact: true}).fill('4');
    await a1.page.getByLabel('Rigidità (N/m)', {exact: true}).fill('32');
    await a1.page.getByRole('button', {name: 'Salva laboratorio', exact: true}).click();
    await expect.poll(async () => work(await projection(a1))?.labs[0]?.data.state.value.massKg).toBe(4);
    await a1.page.getByLabel('Note personali', {exact: true}).fill('QA privata: T = 2π√(m/k).');
    await a1.page.getByRole('button', {name: 'Salva note personali', exact: true}).click();
    await expect.poll(async () => work(await projection(a1))?.notes).toBe('QA privata: T = 2π√(m/k).');
    const privateCount = (await projection(teacher)).learnerWork.length;
    const denied = await raw(b.context, {action: 'open-workspace', workspaceId: workspace.workspaceId}, b.account.id);
    need([403, 404].includes(denied.status) && ['FORBIDDEN', 'NOT_FOUND'].includes(denied.body.error?.code));
    checks.idor = proof({session: 'studentB', resourceOwnerHash: accounts.studentA.idHash, responseStatus: denied.status, code: denied.body.error.code});
    const sharing = a1.page.getByLabel('Condividi con il docente note, tentativi e stati salvati', {exact: true});
    // This controlled checkbox changes only after the real server receipt arrives.
    await sharing.click(); await expect(sharing).toBeChecked();
    await expect.poll(async () => (await projection(teacher)).learnerWork.length).toBe(1);
    const sharedCount = (await projection(teacher)).learnerWork.length;
    await sharing.click(); await expect(sharing).not.toBeChecked();
    await expect.poll(async () => (await projection(teacher)).learnerWork.length).toBe(0);
    const afterRevokeCount = (await projection(teacher)).learnerWork.length;
    need(privateCount === 0 && sharedCount > 0 && afterRevokeCount === 0);
    checks.teacherEvidence = proof({accountIdHash: accounts.teacher.idHash, privateCount, sharedCount, afterRevokeCount});
    const savedProjection = await projection(a1), savedWork = work(savedProjection);
    need(savedWork.labs[0].data.state.value.stiffnessNPerM === 32);
    const snapshot = (saved, observed, session) => {
      const source = observed.assignedDocuments.find(d => d.id === documentId)?.objects.find(o => o.id === objectId);
      need(source?.type === 'lab' && saved.labs[0]?.objectId === source.id && saved.labs[0].data.instanceId === source.data.instanceId);
      return {workspaceId: observed.workspaceId, documentId, objectId: source.id, instanceId: source.data.instanceId,
        objectRevision: source.revision, workRevision: saved.revision, labRevision: saved.labs[0].revision,
        stateDigest: m3ReportDigest(saved), session, observedAt: now()};
    };
    const saved = snapshot(savedWork, savedProjection, 'studentA1'), oldState = await a1.context.storageState();
    const loggedOut = await raw(a1.context, {action: 'logout'}, a1.account.id);
    sessions.studentA1.endedAt = now();
    const oldRequest = await playwrightRequest.newContext({baseURL: origin, storageState: oldState});
    try {
      const old = await raw(oldRequest, {action: 'open-workspace', workspaceId: workspace.workspaceId}, a1.account.id);
      need(loggedOut.status === 200 && old.status === 401 && old.body.error?.code === 'UNAUTHENTICATED');
      checks.logout = proof({session: 'studentA1', responseStatus: loggedOut.status, afterStatus: old.status, code: old.body.error?.code});
    } finally {await oldRequest.dispose();}
    await closeContextWithAccess(a1.context); contexts.splice(contexts.indexOf(a1.context), 1);
    const a2 = await fresh('studentA2', 'STUDENT_A', 'studentA'); await open(a2);
    await expect(a2.page.getByLabel('Note personali', {exact: true})).toHaveValue(savedWork.notes);
    await a2.page.getByRole('button', {name: 'Modifica Molla ideale', exact: true}).click();
    await expect(a2.page.getByLabel('Massa (kg)', {exact: true})).toHaveValue('4');
    await expect(a2.page.getByLabel('Rigidità (N/m)', {exact: true})).toHaveValue('32');
    const reopenedProjection = await projection(a2), reopenedWork = work(reopenedProjection);
    need(m3ReportDigest(reopenedWork) === m3ReportDigest(savedWork));
    const reopened = snapshot(reopenedWork, reopenedProjection, 'studentA2');

    // Commit the actual UI request, then discard its response. Retry must preserve payload and receipt.
    await open(teacher);
    const beforeLost = await projection(teacher), receipts = [], payloads = [];
    let routeFailure = false;
    await teacher.page.route('**/api/m3', async route => {
      const input = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
      if (input?.action !== 'command' || input.command.kind !== 'replace-object') {await continueRouteWithAccess(route); return;}
      let response;
      try {
        response = await fetchRouteWithAccess(route);
        const body = await readApiJson(response); need(body.ok === true);
        receipts.push(m3ReportDigest(body.result.receipt)); payloads.push(m3ReportDigest(input));
        if (receipts.length === 1) await route.abort('connectionfailed'); else await route.fulfill({response});
      } catch {routeFailure = true; await route.abort('failed').catch(() => undefined);} finally {await response?.dispose();}
    });
    await teacher.page.getByRole('button', {name: 'Apri Nota QA', exact: true}).click();
    await teacher.page.getByLabel('Testo nota', {exact: true}).fill('Commit remoto prima della risposta persa.');
    await teacher.page.getByRole('button', {name: 'Salva modifiche', exact: true}).click();
    await expect(teacher.page.getByRole('heading', {name: 'Modifiche in attesa di conferma', exact: true})).toBeVisible();
    const afterFirst = await projection(teacher);
    await teacher.page.getByRole('button', {name: 'Verifica e ritenta', exact: true}).click();
    await expect(teacher.page.getByRole('region', {name: 'Modifiche da recuperare', exact: true})).toHaveCount(0);
    const afterRetry = await projection(teacher);
    need(!routeFailure && receipts.length === 2 && receipts[0] === receipts[1] && payloads[0] === payloads[1]
      && afterFirst.workspaceRevision === beforeLost.workspaceRevision + 1 && afterRetry.workspaceRevision === afterFirst.workspaceRevision
      && afterFirst.events.length === beforeLost.events.length + 1 && m3ReportDigest(afterRetry) === m3ReportDigest(afterFirst));
    checks.lostResponse = proof({firstResponseDelivered: false, receiptDigest: receipts[0], retriedReceiptDigest: receipts[1],
      payloadDigest: payloads[0], retriedPayloadDigest: payloads[1], beforeRevision: beforeLost.workspaceRevision,
      afterFirstRevision: afterFirst.workspaceRevision, afterRetryRevision: afterRetry.workspaceRevision});
    const beforeConflict = await projection(teacher), document = beforeConflict.documents[0];
    const racers = ['QA vincitore 1', 'QA vincitore 2'].map(title => ({action: 'command', workspaceId: workspace.workspaceId,
      command: {kind: 'rename-document', commandId: randomUUID(), documentId, expectedRevision: document.revision, title}}));
    const raced = await Promise.all(racers.map(value => raw(teacher.context, value, teacher.account.id)));
    need(raced.filter(r => r.status === 200).length === 1 && raced.filter(r => r.status === 409).length === 1);
    const conflict = raced.find(r => r.status === 409), winner = await projection(teacher);
    need(conflict.body.error?.code === 'REVISION_CONFLICT' && winner.documents[0].revision === document.revision + 1
      && winner.documents[0].title === racers[raced.findIndex(r => r.status === 200)].command.title);
    checks.conflict = proof({responseStatus: conflict.status, code: conflict.body.error.code, attemptedRevision: document.revision,
      winnerRevision: winner.documents[0].revision, persistedRevision: (await projection(teacher)).documents[0].revision});
    const priorWork = work(await projection(a2));
    await command(a2, {kind: 'revoke-lab-consent', objectId, expectedRevision: priorWork.revision}, 'learning-command');
    const revokedWork = work(await projection(a2));
    const refused = await raw(a2.context, {action: 'learning-command', workspaceId: workspace.workspaceId,
      command: {kind: 'save-learner-lab', commandId: randomUUID(), documentId, objectId, instanceId, expectedRevision: revokedWork.revision,
        expectedDocumentRevision: winner.documents[0].revision, state: savedWork.labs[0].data.state}}, a2.account.id);
    need(refused.status === 422 && refused.body.error?.code === 'PLUGIN_CONSENT_REQUIRED');
    checks.consentRevocation = proof({responseStatus: refused.status, code: refused.body.error.code});
    need(m3ReportDigest(work(await projection(a2))) === m3ReportDigest(revokedWork));
    const assignment = (await projection(teacher)).assignments.find(a => a.studentId === a2.account.id && a.documentId === documentId);
    const revoke = await command(teacher, {kind: 'revoke-assignment', studentId: a2.account.id, expectedRevision: assignment.revision}, 'learning-command');
    const readDenied = await raw(a2.context, {action: 'open-workspace', workspaceId: workspace.workspaceId}, a2.account.id);
    const retryDenied = await raw(a2.context, {action: 'learning-command', workspaceId: workspace.workspaceId,
      command: {kind: 'save-learner-note', commandId: randomUUID(), documentId, expectedRevision: revokedWork.revision, text: 'Refused QA'}}, a2.account.id);
    need([403, 404].includes(readDenied.status) && ['FORBIDDEN', 'NOT_FOUND'].includes(readDenied.body.error?.code)
      && [403, 404].includes(retryDenied.status) && revoke.projection.assignments.find(a => a.studentId === a2.account.id).revision === assignment.revision + 1);
    checks.revocation = proof({session: 'studentA2', responseStatus: readDenied.status, code: readDenied.body.error?.code, retryStatus: retryDenied.status,
      beforeRevision: assignment.revision, afterRevision: revoke.projection.assignments.find(a => a.studentId === a2.account.id).revision});
    await command(teacher, {kind: 'assign-lesson', studentId: b.account.id, expectedRevision: 0}, 'learning-command');
    // Real account change in A's browser, followed by an old-account command precondition.
    await api(a2.context, {action: 'logout'}, a2.account.id);
    await api(a2.context, {action: 'login', username: process.env.ARDESIA_E2E_STUDENT_B_USERNAME, password: process.env.ARDESIA_E2E_STUDENT_B_PASSWORD});
    const beforeSwitch = await projection(b);
    const switched = await raw(a2.context, {action: 'learning-command', workspaceId: workspace.workspaceId,
      command: {kind: 'save-learner-note', commandId: randomUUID(), documentId, expectedRevision: 0, text: 'Old account command'}}, a1.account.id);
    const afterSwitch = await projection(b); need(afterSwitch.learnerWork.length === 0);
    need(switched.status === 409 && switched.body.error?.code === 'SESSION_CHANGED' && beforeSwitch.workspaceRevision === afterSwitch.workspaceRevision);
    await open({...a2, account: b.account});
    await expect(a2.page.getByLabel('Note personali', {exact: true})).toHaveValue('');
    need(!(await a2.page.locator('body').textContent()).includes(savedWork.notes));
    checks.accountSwitch = proof({responseStatus: switched.status, code: switched.body.error?.code, fromAccountHash: accounts.studentA.idHash,
      currentAccountHash: accounts.studentB.idHash, beforeRevision: beforeSwitch.workspaceRevision, afterRevision: afterSwitch.workspaceRevision});
    result = {...current, url: origin, deploymentId: deployment.deploymentId, startedAt, completedAt: now(), accounts, sessions,
      continuity: {createdByAccountHash: accounts.teacher.idHash, assignedToAccountHash: accounts.studentA.idHash, saved, reopened}, checks,
      // Operator compares these identities to database rows; account IDs are not credentials.
      operatorScope: {accountIds: [teacher.account.id, a1.account.id, b.account.id], teacherId: teacher.account.id,
        workspaceId: workspace.workspaceId, nonce}};
  } finally {
    let failed = false;
    for (const context of contexts) {try {await closeContextWithAccess(context);} catch {failed = true;}}
    if (failed) throw Error('BROWSER_CONTEXT_ACCESS_FAILED');
  }
  return result;
}
