import {test,expect,personalProjection} from './fixtures';

test('a manipulative physics model becomes the same editable portable Creator object after reopen',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Crea un oggetto',exact:true}).click();
 const creator=page.getByRole('dialog',{name:'Crea un oggetto',exact:true});
 await creator.getByRole('button',{name:'Esplora i laboratori di fisica',exact:true}).click();
 const labs=creator.getByRole('region',{name:'Laboratori di fisica',exact:true});
 await labs.getByRole('button',{name:/Pressione, profondità e galleggiamento/}).click();
 await expect(labs.getByRole('spinbutton',{name:'Profondità valore',exact:true})).toBeVisible();
 await labs.getByRole('spinbutton',{name:'Profondità valore',exact:true}).fill('2');
 await expect(labs.locator('.composition-value').filter({hasText:'Pressione relativa'})).toContainText('19,62');
 await labs.getByRole('button',{name:'Usa questo laboratorio nel Creator',exact:true}).click();
 // Experiment values do not silently become the authored initial state.
 await creator.locator('.creator-preview').getByRole('spinbutton',{name:'Profondità valore',exact:true}).fill('3');
 await creator.getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();await expect(creator).toHaveCount(0);
 const stored=(await personalProjection(page)).documents[0]!.objects.find(o=>o.type==='extension')!;
 expect(stored.type).toBe('extension');if(stored.type!=='extension')throw Error('Expected persisted Creator object');
 expect(stored.data.definition.typeId).toBe('ardesia.physics.hydrostatic');expect(stored.data.state.h).toBe(3);
 await page.reload();expect((await personalProjection(page)).documents[0]!.objects.find(o=>o.id===stored.id)).toEqual(stored);
 await page.getByRole('button',{name:'Taccuino',exact:true}).click();
 await page.getByRole('button',{name:'Modifica Pressione, profondità e galleggiamento',exact:true}).click();
 await expect(page.locator('.inspector').getByRole('spinbutton',{name:'Profondità valore',exact:true})).toHaveValue('3');
 await page.screenshot({path:info.outputPath('physics-model-reopened.png')});
});
