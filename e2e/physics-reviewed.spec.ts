import {test, expect} from '@playwright/test';

test('guided questions open in the real lessons and keep feedback, hints and solutions separate', async ({page}) => {
  await page.goto('/fisica/c5.html#programma');
  await page.getByRole('link',{name:'Apri gli esercizi guidati →',exact:true}).click();
  await expect(page).toHaveURL(/esercizi-guidati\.html#c5$/);
  await page.getByRole('link',{name:'Quando due onde si compensano solo in parte',exact:true}).click();
  const question = page.locator('#u4-coherent-constructive-06');
  await expect(question).toHaveAttribute('open','');
  await question.getByText('Suggerimento 1', {exact:true}).press('Enter');
  await expect(question.getByText(/Prima di pensare all’intensità/)).toBeVisible();
  await expect(question.locator('.reviewed-solution math').first()).toBeHidden();
  await question.getByRole('radio',{name:/^B\. .*diviso/}).check();
  await question.getByRole('button',{name:'Controlla la risposta'}).click();
  await expect(question.locator('output')).toHaveText('Rivedi la scelta.');
  await expect(question.locator('[data-practice-option=B]')).toContainText('rapporto delle ampiezze');
  await expect(question.locator('[data-practice-option=B]')).toBeVisible();
  await expect(question.locator('[data-practice-option=C]')).toBeHidden();
  await question.getByRole('radio',{name:/^A\. .*diviso/}).check();
  await expect(question.locator('output')).toBeEmpty();
  await question.getByRole('button',{name:'Controlla la risposta'}).click();
  await expect(question.locator('output')).toHaveText('Risposta corretta.');
  await question.getByText('Leggi lo svolgimento completo',{exact:true}).press('Enter');
  await expect(question.locator('.reviewed-solution math mfrac').last()).toBeVisible();
  await expect(question.getByRole('img',{name:/Due segmenti orientati/})).toBeVisible();
  await question.getByRole('link',{name:'Apri il laboratorio collegato →'}).click();
  await expect(page.getByRole('radio',{name:'Opposte e diverse'})).toBeVisible();
});

test('numeric practice accepts equivalent fractions and decimal commas without guessing units',async ({page})=>{
  await page.goto('/fisica/sf-2026-u4-03.html#u4-oscillator-energy-13');
  const question = page.locator('#u4-oscillator-energy-13');
  const input = question.getByRole('textbox',{name:'La tua risposta',exact:true});
  const output = question.locator('output');
  for (const answer of ['1,5', '6/4', '1.5e0']) {
    await input.fill(answer);
    await input.press('Enter');
    await expect(output).toHaveText('Risposta corretta.');
  }
  for (const answer of ['3/0','1,5 m','1e999/1e999','1,5,0']) {
    await input.fill(answer);
    await input.press('Enter');
    await expect(output).toContainText('Il valore non coincide.');
  }
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
});

test('an associated lesson links to one exercise with separate prediction and solution diagrams', async ({page}) => {
  await page.goto('/fisica/sf-2026-u7-01.html#esercizi-guidati');
  const link=page.getByRole('link',{name:'Assorbire di più quando cresce la potenza',exact:true});
  await link.click();
  await expect(page).toHaveURL(/sf-2026-u7-04\.html#u7-absorbed-radiant-power-13$/);
  const question=page.locator('#u7-absorbed-radiant-power-13');
  await expect(question).toHaveAttribute('open','');
  await expect(question.getByRole('img',{name:/potenza incidente rispettivamente/})).toBeVisible();
  const secondDiagram=question.locator('.reviewed-solution svg');
  await expect(secondDiagram).toBeHidden();
  const answer=question.getByRole('textbox',{name:'La tua risposta',exact:true});
  await answer.fill('0,5');
  await answer.press('Enter');
  await expect(question.locator('output')).toHaveText('Risposta corretta.');
  await question.getByText('Leggi lo svolgimento completo',{exact:true}).press('Enter');
  await expect(secondDiagram).toBeVisible();
  await expect(secondDiagram).toHaveAttribute('aria-label',/9 watt assorbiti e 3 trasmessi/);
});
