import {test, expect} from '@playwright/test';

test('one object survives board → notebook → reader → reload with provenance and draft status', async ({page}, testInfo) => {
  const errors:string[]=[]; page.on('pageerror', error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Oscillazioni: osserva, misura, spiega',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Apri Il pendolo semplice',exact:true}).click();
  await page.getByLabel('Descrizione formula').fill('La lunghezza quadruplica: il periodo raddoppia, nel modello ideale.');
  await page.getByRole('button',{name:'Salva modifiche',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Salvato');
  await page.getByRole('button',{name:'Chiudi proprietà'}).click();
  await page.getByRole('button',{name:'Taccuino',exact:true}).click();
  await expect(page.getByText('La lunghezza quadruplica: il periodo raddoppia, nel modello ideale.',{exact:true})).toBeVisible();
  const objectId = await page.locator('.reading-object.type-formula').getAttribute('data-object-id');
  await page.getByRole('button',{name:'Lezione',exact:true}).click();
  await expect(page.locator(`.reading-object[data-object-id="${objectId}"]`)).toContainText('il periodo raddoppia');
  await page.reload();
  await expect(page.getByText('La lunghezza quadruplica: il periodo raddoppia, nel modello ideale.',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('Bozza personale',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Apri Una fonte da esplorare',exact:true}).click();
  await expect(page.getByLabel('Revisione fonte')).toHaveValue(/15\.4/);
  await expect(page.getByLabel('Licenza fonte')).toHaveValue(/nessun testo/);
  await page.getByRole('button',{name:'Chiudi proprietà'}).click();
  await page.screenshot({path:`artifacts/${testInfo.project.name}-workspace.png`,fullPage:true});
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('a new lesson can create and update a note and reopen it from the library', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Nuova lezione',exact:true}).click();
  await page.getByLabel('Titolo nuova lezione').fill('Una lezione di elettrotecnica');
  await page.getByRole('button',{name:'Crea lezione',exact:true}).click();
  await page.getByRole('button',{name:'Scrivi la prima nota',exact:true}).click();
  await page.getByLabel('Titolo oggetto').fill('La mia ipotesi');
  await page.getByLabel('Testo nota').fill('La corrente dipende dalla resistenza a tensione fissata.');
  await page.getByRole('button',{name:'Salva modifiche',exact:true}).click();
  await page.getByRole('button',{name:'Chiudi proprietà'}).click();
  await page.getByRole('button',{name:'Apri libreria',exact:true}).click();
  await page.getByRole('button',{name:/Oscillazioni: osserva/}).click();
  await page.getByRole('button',{name:'Apri libreria',exact:true}).click();
  await page.getByRole('button',{name:/Una lezione di elettrotecnica/}).click();
  await expect(page.getByRole('button',{name:'Apri La mia ipotesi',exact:true})).toContainText('tensione fissata');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Una lezione di elettrotecnica',exact:true})).toBeVisible();
});

test('a stale second tab cannot overwrite committed work', async ({page, context}) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Oscillazioni: osserva, misura, spiega',exact:true})).toBeVisible();
  const second = await context.newPage(); await second.goto('/');
  await expect(second.getByRole('heading',{name:'Oscillazioni: osserva, misura, spiega',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Apri Che cosa cambia il periodo?',exact:true}).click();
  await page.getByLabel('Testo nota').fill('Versione corretta dalla prima scheda.');
  await page.getByRole('button',{name:'Salva modifiche',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Salvato');
  await second.getByRole('button',{name:'Apri Che cosa cambia il periodo?',exact:true}).click();
  await second.getByLabel('Testo nota').fill('Tentativo da una scheda obsoleta.');
  await second.getByRole('button',{name:'Salva modifiche',exact:true}).click();
  await expect(second.getByRole('alert')).toContainText('non salvata');
  await second.reload();
  await expect(second.getByText('Versione corretta dalla prima scheda.',{exact:true})).toBeVisible();
  await second.close();
});

test('corrupt existing data fails closed without replacing the stored bytes', async ({page}) => {
  await page.goto('/'); await expect(page.getByText('Bozza personale',{exact:true})).toBeVisible();
  await page.evaluate(()=>localStorage.setItem('ardesia-next.core.v1','{"invalid":"original-do-not-overwrite"}'));
  await page.reload();
  await expect(page.getByRole('heading',{name:'Il tuo spazio è al sicuro.'})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('ardesia-next.core.v1'))).toBe('{"invalid":"original-do-not-overwrite"}');
});

test('draft stays personal, marketplace grants no automatic consent, and export downloads a snapshot', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Apri moduli',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Cerca moduli',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Verifica Molla ideale',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/Acquista|Pubblica/})).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ardesia-next.core.v1')!).installations)).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Impostazioni',exact:true}).click();
  await expect(page.getByText('solo in questo browser',{exact:true})).toBeVisible();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Esporta una copia dei dati'}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('ardesia-next-spazio-personale.json');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('unsaved editor text remains available when navigation is cancelled', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Apri Che cosa cambia il periodo?',exact:true}).click();
  await page.getByLabel('Testo nota').fill('Ipotesi ancora in scrittura, da non perdere.');
  await expect(page.getByRole('status')).toContainText('Modifiche da salvare');
  await page.getByRole('button',{name:'Chiudi proprietà'}).click();
  await expect(page.getByRole('dialog',{name:'Hai modifiche da salvare'})).toBeVisible();
  await page.getByRole('button',{name:'Continua a modificare'}).click();
  await expect(page.getByLabel('Testo nota')).toHaveValue('Ipotesi ancora in scrittura, da non perdere.');
  await page.getByRole('button',{name:'Salva modifiche',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Salvato');
  await page.getByRole('button',{name:'Chiudi proprietà'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Ipotesi ancora in scrittura, da non perdere.',{exact:true})).toBeVisible();
});

