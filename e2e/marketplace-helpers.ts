import {expect, type Page} from '@playwright/test';
import type {CoreSnapshot, LabObject} from '@ardesia/contracts';

export const storageKey = 'ardesia-next.core.v1';
export const springId = 'ardesia.ideal-spring';
export const readConsentLabel = 'Consenti lettura dei parametri (state:read)';
export const writeConsentLabel = 'Consenti modifica dei parametri (state:write)';

export async function openMarketplace(page: Page): Promise<void> {
  await page.getByRole('button', {name: 'Apri moduli', exact: true}).click();
  await expect(page.getByRole('textbox', {name: 'Cerca moduli', exact: true})).toBeVisible();
}

export async function verifyAndInstallSpring(page: Page): Promise<void> {
  await page.getByRole('button', {name: 'Verifica Molla ideale', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Installa Molla ideale', exact: true})).toBeEnabled();
  await page.getByRole('button', {name: 'Installa Molla ideale', exact: true}).click();
  await expect(page.getByRole('checkbox', {name: readConsentLabel, exact: true})).toBeVisible();
  await expect(page.getByRole('checkbox', {name: readConsentLabel, exact: true})).not.toBeChecked();
  await expect(page.getByRole('checkbox', {name: writeConsentLabel, exact: true})).not.toBeChecked();
}

export async function authorizeSpring(page: Page): Promise<void> {
  await page.getByRole('checkbox', {name: readConsentLabel, exact: true}).check();
  await page.getByRole('checkbox', {name: writeConsentLabel, exact: true}).check();
  await page.getByRole('button', {name: 'Salva autorizzazioni', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Attiva Molla ideale', exact: true})).toBeEnabled();
}

export async function installAndActivateSpring(page: Page): Promise<void> {
  await page.goto('/');
  await openMarketplace(page);
  await verifyAndInstallSpring(page);
  await authorizeSpring(page);
  await page.getByRole('button', {name: 'Attiva Molla ideale', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Aggiungi molla alla lezione', exact: true})).toBeEnabled();
}

export async function addMarketplaceSpring(page: Page): Promise<void> {
  await installAndActivateSpring(page);
  await page.getByRole('button', {name: 'Aggiungi molla alla lezione', exact: true}).click();
  await expect(page.getByRole('complementary', {name: 'Proprietà del laboratorio', exact: true})).toHaveAttribute('data-plugin-status', 'ready');
}

export async function storedWorkspace(page: Page): Promise<CoreSnapshot> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as CoreSnapshot, storageKey);
}

export async function storedBytes(page: Page): Promise<string | null> {
  return page.evaluate(key => localStorage.getItem(key), storageKey);
}

export async function storedSpring(page: Page): Promise<LabObject> {
  const snapshot = await storedWorkspace(page);
  const lab = snapshot.documents.flatMap(document => document.objects).find((object): object is LabObject => object.type === 'lab');
  if (!lab) throw new Error('The scientific object was not persisted through Core.');
  return lab;
}
