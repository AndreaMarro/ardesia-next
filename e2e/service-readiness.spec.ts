import {test, expect} from '@playwright/test';
import {continueRouteWithAccess, installContextAccess} from './remote-access';

test('an upgrade-required service blocks login and preserves local export', async ({page, context}) => {
  await installContextAccess(context);
  const original = '{"original":"preserve-before-service-upgrade"}';
  await context.addInitScript(value => localStorage.setItem('ardesia-next.core.v1', value), original);
  // Inject only an unavailable health response. Authentication still comes from
  // the real server; this checks the UI, not a completed database upgrade.
  await page.route('**/api/m3', async route => {
    if (route.request().method() !== 'GET') {await continueRouteWithAccess(route); return;}
    await route.fulfill({status:503, json:{ok:false, error:{code:'SERVICE_UPGRADE_REQUIRED', message:'Servizio da aggiornare.'}}});
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('L’accesso richiede un aggiornamento del servizio.');
  await expect(page.getByRole('button', {name:'Accedi', exact:true})).toBeDisabled();
  await expect(page.getByText('Servizio non configurato.', {exact:false})).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name:'Esporta dati locali originali', exact:true}).click();
  expect((await downloadPromise).suggestedFilename()).toBe('ardesia-next-originale-locale.json');
  expect(await page.evaluate(() => localStorage.getItem('ardesia-next.core.v1'))).toBe(original);
});
