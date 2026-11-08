import {test, expect, personalProjection, selectedWorkspace, api} from './fixtures';
import {continueRouteWithAccess, fetchRouteWithAccess} from './remote-access';
import type {RecordingState, RecordingSummary} from '@ardesia/contracts';

import {syntheticMicrophone} from './audio-fixture';

test('records synthetic audio with timed ink, resumes a lost upload, seeks exact history and retries a transcript after reload', async ({page}, testInfo) => {
  await syntheticMicrophone(page); await page.goto('/');
  const workspace = selectedWorkspace(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error' && !message.text().includes('net::ERR_FAILED')) errors.push(message.text());});
  await page.getByRole('button', {name: /Audio e replay/}).click();
  await expect(page.getByRole('button', {name: 'Registra spiegazione', exact: true})).toBeDisabled();
  await page.getByLabel('Consenso alla registrazione audio').check();
  await page.getByRole('button', {name: 'Registra spiegazione', exact: true}).click();
  await expect(page.getByText('● Microfono attivo', {exact: false})).toBeVisible();
  // Close only the contextual panel; capture remains visible and the board stays editable.
  await page.getByRole('button', {name: /Audio e replay/}).click();
  await page.getByRole('button', {name: 'Scrittura immersiva', exact: true}).click();
  await expect(page.locator('.writing-status')).toContainText('Registrazione audio attiva');
  expect(await page.evaluate(() => (window as any).syntheticAudioStream.getTracks().every((track: MediaStreamTrack) => track.readyState === 'live'))).toBe(true);
  const bounds = (await page.locator('.board-surface').boundingBox())!;
  await page.mouse.move(bounds.x + 70, bounds.y + 210); await page.mouse.down();
  await page.mouse.move(bounds.x + 230, bounds.y + 245, {steps: 30}); await page.mouse.up();
  await expect.poll(async () => (await personalProjection(page)).documents[0]!.objects.filter(o => o.type === 'ink').length).toBe(1);
  await page.getByRole('button', {name: 'Esci dalla scrittura immersiva', exact: true}).click();
  await page.getByRole('button', {name: 'Interrompi registrazione', exact: true}).click();
  await page.getByRole('button', {name: /Audio e replay/}).click();
  const upload = page.getByRole('button', {name: 'Archivia / riprendi caricamento', exact: true});
  await expect(upload).toBeEnabled();
  let lostUpload = false;
  await page.route('**/api/m3', async route => {
    if (!lostUpload && route.request().postDataJSON()?.action === 'put-recording-part') {
      lostUpload = true; await fetchRouteWithAccess(route); await route.abort(); return;
    }
    await continueRouteWithAccess(route);
  });
  await upload.click(); await expect(page.getByRole('region', {name: 'Audio e replay', exact: true}).getByRole('alert').filter({hasText: 'Operazione non confermata'})).toBeVisible();
  await page.unroute('**/api/m3'); await page.reload(); await page.getByRole('button', {name: /Audio e replay/}).click();
  await page.getByRole('button', {name: 'Archivia / riprendi caricamento', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Apri replay', exact: true})).toBeEnabled();
  if (testInfo.project.name === 'desktop-chromium') {
    await page.getByRole('button', {name: /Audio e replay/}).click();
    await page.getByRole('button', {name: 'Apri Che cosa cambia il periodo?', exact: true}).click();
    await page.getByLabel('Testo nota').fill('Bozza da conservare durante il replay');
    await page.getByRole('button', {name: /Audio e replay/}).click();
    await expect(page.getByRole('button', {name: 'Apri replay', exact: true})).toBeDisabled();
    await expect(page.getByLabel('Testo nota')).toHaveValue('Bozza da conservare durante il replay');
    await page.getByRole('button', {name: /Audio e replay/}).click();
    await page.getByRole('button', {name: 'Ripristina versione salvata', exact: true}).click();
    await page.getByRole('button', {name: 'Chiudi proprietà', exact: true}).click();
  }
  const latest = (await personalProjection(page)).documents[0]!;
  await api(page.context().request, {action: 'command', workspaceId: workspace.workspaceId, command: {kind: 'rename-document', commandId: crypto.randomUUID(), documentId: workspace.documentId, expectedRevision: latest.revision, title: 'Titolo aggiornato dopo la registrazione'}}, workspace.account.id);
  // Reopen the persisted lesson on both viewports; the compact mobile layout hides the status refresh control.
  await page.reload(); await page.getByRole('button', {name: /Audio e replay/}).click();
  await expect(page.locator('.studio-title')).toHaveText('Titolo aggiornato dopo la registrazione');
  await page.getByRole('button', {name: 'Apri replay', exact: true}).click();
  await expect(page.locator('.studio-title')).toHaveText('Oscillazioni: osserva, misura, spiega');
  await expect(page.getByRole('button', {name: 'Penna', exact: true})).toBeDisabled();
  await page.getByRole('button',{name:'Oggetti',exact:true}).click();
  await expect(page.locator('.object-strip-items button').first()).toBeDisabled();
  await page.getByRole('button',{name:'Chiudi elenco oggetti',exact:true}).click();
  const surface = (await page.locator('.board-surface').boundingBox())!, panel = (await page.locator('.audio-panel').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(surface.height).toBeGreaterThan(170);
  expect(surface.y + surface.height).toBeLessThanOrEqual(viewport.height);
  if (testInfo.project.name === 'desktop-chromium') expect(surface.x + surface.width).toBeLessThanOrEqual(panel.x + 1);
  else expect(surface.y+surface.height).toBeLessThanOrEqual(panel.y+1);
  const list = await api<RecordingSummary[]>(page.context().request, {action: 'list-recordings', workspaceId: workspace.workspaceId, documentId: workspace.documentId}, workspace.account.id);
  expect(list).toHaveLength(1);
  const read = () => api<RecordingState>(page.context().request, {action: 'read-recording', workspaceId: workspace.workspaceId, recordingId: list[0]!.recordingId}, workspace.account.id);
  const saved = await read(); await expect(page.locator('.footer-history')).toContainText('Revisione ' + saved.capture!.baseRevision); expect(saved.summary.status).toBe('ready'); expect(saved.capture!.timeline[0]!.ink!.sampleTimesMs.length).toBeGreaterThan(2);
  await expect(page.locator('.board-object.type-ink')).toHaveCount(0);
  const range = page.getByLabel('Posizione nel replay', {exact: true}); await range.focus(); await range.press('End');
  await expect(page.locator('.board-object.type-ink')).toHaveCount(1);
  await range.press('Home'); await expect(page.locator('.board-object.type-ink')).toHaveCount(0);
  await page.locator('audio').evaluate(async element => {await (element as HTMLAudioElement).play();});
  await expect.poll(() => page.locator('audio').evaluate(element => (element as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  await page.locator('audio').evaluate(element => (element as HTMLAudioElement).pause());
  await page.getByLabel('Trascrizione da secondi').fill('0');
  await page.getByLabel('Trascrizione a secondi').fill(String(Math.max(.1, Math.floor(saved.capture!.durationMs / 10) / 100)));
  await page.getByLabel('Testo trascrizione').fill('L’energia elastica aumenta con il quadrato dello spostamento.');
  let lostTranscript = false;
  await page.route('**/api/m3', async route => {
    const body = route.request().postDataJSON();
    if (!lostTranscript && body?.action === 'recording-command' && body.command.kind === 'edit-recording-transcript') {
      lostTranscript = true; await fetchRouteWithAccess(route); await route.abort(); return;
    }
    await continueRouteWithAccess(route);
  });
  await page.getByRole('button', {name: 'Aggiungi segmento', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Verifica modifica trascrizione', exact: true})).toBeEnabled();
  await page.unroute('**/api/m3'); await page.reload(); await page.getByRole('button', {name: /Audio e replay/}).click();
  await page.getByRole('button', {name: 'Apri replay', exact: true}).click();
  await page.getByRole('button', {name: 'Verifica modifica trascrizione', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Verifica modifica trascrizione', exact: true})).toHaveCount(0);
  expect((await read()).transcripts).toHaveLength(1); expect((await read()).transcripts[0]!.cues).toHaveLength(1);
  await page.getByLabel('Cerca nella trascrizione').fill('quadrato');
  await page.getByRole('button', {name: /L’energia elastica aumenta/}).click();
  expect(Number(await range.inputValue())).toBe(0);
  await page.getByRole('button', {name: 'Torna alla lavagna attuale', exact: true}).click();
  await page.getByLabel('Cerca nelle registrazioni', {exact: true}).fill('quadrato');
  await page.getByRole('button', {name: 'Cerca nell’archivio audio', exact: true}).click();
  await expect(page.getByText('1 risultati', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: /audio · L’energia elastica aumenta/}).click();
  await expect(page.getByLabel('Versione trascrizione')).toHaveValue('1');
  await expect(page.locator('audio')).toBeInViewport({ratio: 1});
  await page.screenshot({path: testInfo.outputPath('replay.png')});
  await page.getByText('Elimina registrazione', {exact: true}).click();
  await page.getByRole('button', {name: 'Elimina definitivamente audio e trascrizioni', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Apri replay', exact: true})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('withdrawn consent stops a late synthetic microphone and never starts recording', async ({page}) => {
  await syntheticMicrophone(page, true); await page.goto('/'); await page.getByRole('button', {name: /Audio e replay/}).click();
  await page.getByLabel('Consenso alla registrazione audio').check(); await page.getByRole('button', {name: 'Registra spiegazione', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Annulla richiesta microfono', exact: true})).toBeVisible();
  await page.getByRole('button', {name: /Audio e replay/}).click();
  await page.getByRole('button', {name: 'Scrittura immersiva', exact: true}).click();
  await expect(page.locator('.writing-status')).toContainText('Attesa microfono');
  await expect(page.locator('.writing-status')).not.toContainText('Registrazione audio attiva');
  await page.getByRole('button', {name: 'Esci dalla scrittura immersiva', exact: true}).click();
  await page.getByRole('button', {name: /Audio e replay/}).click();
  await page.getByLabel('Consenso alla registrazione audio').uncheck();
  await page.evaluate(() => (window as any).releaseSyntheticMicrophone());
  await expect.poll(() => page.evaluate(() => (window as any).syntheticAudioStream.getTracks().every((track: MediaStreamTrack) => track.readyState === 'ended'))).toBe(true);
  await expect(page.getByText('● Microfono attivo', {exact: false})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Registra spiegazione', exact: true})).toBeDisabled();
});
