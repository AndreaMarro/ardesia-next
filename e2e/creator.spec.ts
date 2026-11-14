import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test,expect,api,personalProjection,selectedWorkspace} from './fixtures';
import {continueRouteWithAccess,fetchRouteWithAccess,readApiJson} from './remote-access';
import {extensionDefinitionDigest,toObjectInput,type ExtensionDefinition,type ExtensionObject} from '@ardesia/contracts';
import type {Page,Locator} from '@playwright/test';

test.beforeEach(async({page})=>{await page.goto('/');});

const creator=(page:Page)=>page.getByRole('dialog',{name:/^(Crea un oggetto|Modifica oggetto)$/});
async function open(page:Page){await page.getByRole('button',{name:'Crea un oggetto',exact:true}).click();return creator(page);}
async function add(dialog:Locator,kind:string){await dialog.getByRole('button',{name:'Aggiungi elemento',exact:true}).click();await dialog.locator('.creator-palette').getByRole('button',{name:kind,exact:true}).click();}
async function extensions(page:Page){return (await personalProjection(page)).documents[0]!.objects.filter((o):o is ExtensionObject=>o.type==='extension');}
async function edit(page:Page,command:Record<string,unknown>){const w=selectedWorkspace(page),doc=(await personalProjection(page)).documents[0]!;return api(page.request,{action:'command',workspaceId:w.workspaceId,command:{...command,commandId:randomUUID(),documentId:doc.id,expectedRevision:doc.revision}},w.account.id);}
async function closeDraft(page:Page){await creator(page).getByRole('button',{name:'Chiudi finestra',exact:true}).click();await page.getByRole('button',{name:'Scarta modifiche',exact:true}).click();}

test('Creator composes a new nested type, preserves incomplete edits, saves values and publishes an exact next definition version',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const dialog=await open(page);
  await dialog.getByRole('button',{name:'Parti da zero',exact:true}).click();
  await dialog.getByLabel('Nome del tipo',{exact:true}).fill('Contatore delle coincidenze');
  await add(dialog,'Gruppo');await add(dialog,'Controllo');
  await dialog.getByLabel('Variabile controllo',{exact:true}).fill('count');
  await dialog.getByLabel('Etichetta controllo',{exact:true}).fill('');
  await expect(dialog.getByLabel('Etichetta controllo',{exact:true})).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true})).toBeDisabled();
  await dialog.getByLabel('Etichetta controllo',{exact:true}).fill('Conteggio');
  await dialog.locator('.creator-tree').getByRole('button',{name:'Gruppo',exact:true}).click();await add(dialog,'Risultato');
  await dialog.getByLabel('Etichetta',{exact:true}).fill('Coincidenze doppie');
  await dialog.getByLabel('Espressione',{exact:true}).fill('count*2');
  await dialog.locator('.creator-preview').getByRole('spinbutton',{name:'Conteggio valore',exact:true}).fill('7');
  await expect(dialog.locator('.composition-value output')).toHaveText('14');
  await expect(dialog).toHaveJSProperty('scrollWidth',await dialog.evaluate(e=>e.clientWidth));
  await page.screenshot({path:info.outputPath('creator-composition.png')});
  await dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();await expect(dialog).toHaveCount(0);
  const first=(await extensions(page))[0]!;expect(first.data.state).toEqual({count:7});
  expect(first.data.definition.body).toMatchObject({nodes:[{kind:'group',children:[{kind:'input'},{kind:'value'}]}]});
  await page.locator('.inspector').getByRole('spinbutton',{name:'Conteggio valore',exact:true}).fill('9');
  await page.getByRole('button',{name:'Salva modifiche',exact:true}).click();
  await expect.poll(async()=>(await extensions(page))[0]!.data.state.count).toBe(9);
  await page.getByRole('button',{name:'Modifica struttura',exact:true}).click();
  await creator(page).getByLabel('Nome del tipo',{exact:true}).fill('Conteggio di eventi');
  await creator(page).getByRole('button',{name:'Salva nuova versione',exact:true}).click();
  await expect(creator(page)).toHaveCount(0);await page.reload();
  const final=(await extensions(page))[0]!;expect(final).toMatchObject({id:first.id,revision:3,data:{state:{count:9},definition:{typeId:first.data.definition.typeId,version:2,name:'Conteggio di eventi'}}});
  expect(final.data.definitionDigest).not.toBe(first.data.definitionDigest);expect(errors).toEqual([]);
  await page.getByRole('button',{name:'Dispensa',exact:true}).click();const paper=page.getByRole('article',{name:'Dispensa pronta'});
  await expect(paper).toContainText('Conteggio di eventi');await expect(paper).toContainText('Rappresentazione statica');expect(await paper.locator('input').count()).toBe(0);
});

test('studio keeps contextual tools separate and visible at desktop and mobile sizes',async({page},info)=>{
  await expect(page.locator('.inspector')).toHaveCount(0);await expect(page.locator('.object-strip')).toHaveCount(0);
  await expect(page.getByText('Bozza personale',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Oggetti',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const dock=(await page.locator('.board-toolbar').boundingBox())!,zoom=(await page.locator('.board-navigation').boundingBox())!;
  expect(dock.x+dock.width<=zoom.x||zoom.x+zoom.width<=dock.x||dock.y+dock.height<=zoom.y||zoom.y+zoom.height<=dock.y).toBe(true);
  await page.screenshot({path:info.outputPath('studio.png')});
  const dialog=await open(page);await page.screenshot({path:info.outputPath('creator.png')});
  await expect(dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true})).toBeInViewport();
  expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});

test('Creator keeps unapplied JSON across close/reopen and protects it with the dirty-draft dialog',async({page})=>{
  const dialog=await open(page);await dialog.getByText('Formato aperto',{exact:true}).click();
  const json=dialog.getByLabel('Definizione JSON',{exact:true});await expect(json).toHaveValue(/Il mio strumento/);const original=await json.inputValue();
  const edited=original.replace('Il mio strumento','Struttura in preparazione');await json.fill(edited);
  await dialog.getByText('Formato aperto',{exact:true}).click();await dialog.getByText('Formato aperto',{exact:true}).click();
  await expect(json).toHaveValue(edited);await expect(dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true})).toBeDisabled();
  await dialog.getByRole('button',{name:'Chiudi finestra',exact:true}).click();
  const guard=page.getByRole('dialog',{name:'Hai modifiche da salvare',exact:true});await expect(guard).toBeVisible();
  expect(await page.locator('dialog').evaluateAll(nodes=>new Set(nodes.map(n=>n.getAttribute('aria-labelledby'))).size)).toBe(2);
  await guard.getByRole('button',{name:'Continua a modificare',exact:true}).click();await expect(json).toHaveValue(edited);
  await dialog.getByRole('button',{name:'Applica definizione',exact:true}).click();await expect(dialog.getByLabel('Nome del tipo',{exact:true})).toHaveValue('Struttura in preparazione');
  await closeDraft(page);expect(await extensions(page)).toHaveLength(0);
});

test('Creator rename updates scene expressions without changing literal text and exports exact source lineage for reimport',async({page},info)=>{
  const source=(await personalProjection(page)).documents[0]!.objects.find(o=>o.type==='source')!;
  const definition:ExtensionDefinition={format:'ardesia-extension/1',typeId:'personal.motion-'+randomUUID(),version:1,name:'Macchina di eventi',description:'Definizione sintetica',license:'CC-BY-4.0',renderer:'ardesia.composition/1',fallback:'Scena con un punto controllabile.',body:{fields:[{key:'L',kind:'number',initial:20,label:'Posizione',min:0,max:100}],nodes:[{id:'control',kind:'input',props:{field:'L',appearance:'slider'}},{id:'literal',kind:'value',props:{label:'Testo letterale',expression:'"L"'}},{id:'scene',kind:'scene',props:{label:'Punto mobile',width:200,height:100},children:[{id:'dot',kind:'shape',props:{shape:'circle',x:'L+1e1',y:'50',width:'10',height:'10',color:'#235e50'}}]}]}};
  await edit(page,{kind:'add-object',object:{id:'motion',type:'extension',title:definition.name,x:0,y:0,width:350,height:350,data:{definition,definitionDigest:await extensionDefinitionDigest(definition),state:{L:20}},provenance:{origin:'authored',sources:[{sourceId:source.id,revision:source.revision,locator:'Equazione citata'}]}}});
  await edit(page,{kind:'replace-object',object:{...toObjectInput(source),data:{...source.data,publisher:'NUOVA EDIZIONE',license:'Licenza nuova'}}});
  await page.reload();await page.getByRole('button',{name:'Oggetti',exact:true}).click();await page.getByRole('button',{name:'Seleziona Macchina di eventi',exact:true}).click();await page.getByRole('button',{name:'Modifica struttura',exact:true}).click();
  const dialog=creator(page);await dialog.getByRole('button',{name:'Controllo: Posizione',exact:true}).click();
  await dialog.getByLabel('Variabile controllo',{exact:true}).fill('distance');await dialog.getByLabel('Etichetta controllo',{exact:true}).click();
  await expect(dialog.locator('.composition-scene circle')).toHaveAttribute('cx','30');await expect(dialog.locator('.composition-value output')).toHaveText('L');
  await dialog.getByRole('button',{name:'Salva nuova versione',exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:'Modifica struttura',exact:true}).click();
  const pendingDownload=page.waitForEvent('download');await creator(page).getByRole('button',{name:'Esporta definizione',exact:true}).click();const downloaded=await pendingDownload;await downloaded.saveAs(info.outputPath('extension.ardesia.json'));
  const payload=JSON.parse(await readFile(info.outputPath('extension.ardesia.json'),'utf8'));
  expect(payload.definition.license).toBe('CC-BY-4.0');expect(payload.lineage).toHaveLength(2);
  expect(payload.lineage[1]).toMatchObject({definitionLicense:'CC-BY-4.0',objectId:'motion',objectRevision:2,definitionDigest:payload.definitionDigest,sources:[{id:source.id,revision:source.revision,referenceLocator:'Equazione citata',...source.data}]});
  expect(payload.lineage[1].sources[0].publisher).not.toBe('NUOVA EDIZIONE');
  await creator(page).getByRole('button',{name:'Chiudi finestra',exact:true}).click();
  await open(page);await creator(page).getByLabel('Importa definizione',{exact:true}).setInputFiles(info.outputPath('extension.ardesia.json'));
  await expect(creator(page).getByLabel('Nome del tipo',{exact:true})).toHaveValue('Macchina di eventi');
  await creator(page).getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();await expect(creator(page)).toHaveCount(0);
  const objects=await extensions(page);expect(objects).toHaveLength(2);expect(objects[1]).toMatchObject({provenance:{origin:'imported',createdBy:selectedWorkspace(page).actor.actorId},data:{lineage:payload.lineage,definition:payload.definition,state:{distance:20}}});
  await open(page);await creator(page).getByLabel('Importa definizione',{exact:true}).setInputFiles(info.outputPath('extension.ardesia.json'));
  await expect(creator(page).getByLabel('Nome del tipo',{exact:true})).toHaveValue('Macchina di eventi');
  await creator(page).getByLabel('Nome del tipo',{exact:true}).fill('Macchina derivata');
  await creator(page).getByText('Identità e versione',{exact:true}).click();await creator(page).getByLabel('Licenza',{exact:true}).fill('Tutti i diritti riservati');
  await creator(page).getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();await expect(creator(page)).toHaveCount(0);
  const derived=(await extensions(page))[2]!;
  expect(derived.data.definition).toMatchObject({typeId:payload.definition.typeId,version:3,name:'Macchina derivata',license:'Tutti i diritti riservati'});
  expect(derived.data.lineage).toEqual(expect.arrayContaining([{typeId:payload.definition.typeId,version:2,definitionDigest:payload.definitionDigest,definitionLicense:'CC-BY-4.0',sources:[],missingSources:[]}]));
});

test('Creator lost acknowledgement keeps a single pending object and recovers the original receipt',async({page})=>{
  const before=await personalProjection(page);let first=true;const ids:string[]=[],receipts:unknown[]=[];
  await page.route('**/api/m3',async route=>{
    const input=route.request().method()==='POST'?route.request().postDataJSON():null;
    if(input?.action!=='command'||input.command.kind!=='add-object'||input.command.object.type!=='extension'){await continueRouteWithAccess(route);return;}
    ids.push(input.command.commandId);const response=await fetchRouteWithAccess(route),body=await readApiJson(response);expect(body.ok).toBe(true);receipts.push(body.result.receipt);
    if(first){first=false;await route.abort('connectionfailed');}else await route.fulfill({response});
  });
  const dialog=await open(page);await dialog.getByLabel('Nome del tipo',{exact:true}).fill('Una sola creazione');
  await dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Salvataggio non confermato');
  await dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();expect(ids).toHaveLength(1);
  await closeDraft(page);await page.getByRole('button',{name:'Verifica e ritenta',exact:true}).click();
  await expect(page.getByRole('region',{name:'Modifiche da recuperare',exact:true})).toHaveCount(0);
  const after=await personalProjection(page);expect(after.workspaceRevision).toBe(before.workspaceRevision+1);expect(after.events).toHaveLength(before.events.length+1);expect(await extensions(page)).toHaveLength(1);
  expect(ids).toEqual([ids[0],ids[0]]);expect(receipts[0]).toEqual(receipts[1]);
});

test('Creator preserves unknown components through import rename export and save, and refuses local plot variable capture',async({page},info)=>{
  const future={id:'future',kind:'future/formula',props:{expression:'future.member(L)',field:'L',variable:'L',custom:{L:[1,2,3]}},fallback:'Formula futura conservata',children:[{id:'futurechild',kind:'value',props:{label:'Payload futuro',expression:'future.other(L)'}}]};
  const definition:ExtensionDefinition={format:'ardesia-extension/1',typeId:'personal.future-'+randomUUID(),version:1,name:'Struttura aperta',description:'Prova sintetica di conservazione',license:'CC0-1.0',renderer:'ardesia.composition/1',fallback:'Controllo e componente futuro',body:{fields:[{key:'L',kind:'number',label:'Lunghezza',initial:1}],nodes:[{id:'input',kind:'input',props:{field:'L'}},{id:'plot',kind:'plot',props:{label:'Curva',variable:'x',expression:'L+x',min:0,max:10}},future]}};
  const dialog=await open(page);
  await dialog.getByLabel('Importa definizione',{exact:true}).setInputFiles({name:'future.ardesia.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({definition,definitionDigest:await extensionDefinitionDigest(definition),state:{L:1}}))});
  await expect(dialog.locator('.creator-preview')).toContainText('Formula futura conservata');
  await dialog.getByRole('button',{name:'Controllo: Lunghezza',exact:true}).click();
  await dialog.getByLabel('Variabile controllo',{exact:true}).fill('x');await dialog.getByLabel('Etichetta controllo',{exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('variabile locale');await expect(dialog.getByLabel('Variabile controllo',{exact:true})).toHaveValue('L');
  await dialog.getByLabel('Variabile controllo',{exact:true}).fill('distance');await dialog.getByLabel('Etichetta controllo',{exact:true}).click();
  const pending=page.waitForEvent('download');await dialog.getByRole('button',{name:'Esporta definizione',exact:true}).click();await (await pending).saveAs(info.outputPath('future.ardesia.json'));
  const exported=JSON.parse(await readFile(info.outputPath('future.ardesia.json'),'utf8'));
  expect(exported.definition.body.nodes[2]).toEqual(future);expect(exported.definition.body.nodes[1].props).toMatchObject({variable:'x',expression:'distance+x'});expect(exported.state).toEqual({distance:1});
  await dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();await expect(dialog).toHaveCount(0);await page.reload();
  const saved=(await extensions(page))[0]!;expect(saved.data.definition.body).toEqual(exported.definition.body);expect(saved.data.definition.version).toBe(2);
});

test('extension inspector freezes edits until the pending save is confirmed and permits a subsequent revision',async({page})=>{
  const dialog=await open(page);await dialog.getByRole('button',{name:'Aggiungi alla lezione',exact:true}).click();await expect(dialog).toHaveCount(0);
  let release=()=>{},arrived=()=>{};const held=new Promise<void>(resolve=>release=resolve),entered=new Promise<void>(resolve=>arrived=resolve);let first=true;
  await page.route('**/api/m3',async route=>{
    const input=route.request().method()==='POST'?route.request().postDataJSON():null;
    if(!first||input?.action!=='command'||input.command.kind!=='replace-object'||input.command.object.type!=='extension'){await continueRouteWithAccess(route);return;}
    first=false;const response=await fetchRouteWithAccess(route);arrived();await held;await route.fulfill({response});
  });
  const value=page.locator('.inspector').getByRole('spinbutton',{name:'Lunghezza valore',exact:true});
  await value.fill('2');await page.getByRole('button',{name:'Salva modifiche',exact:true}).click();await entered;
  try{await expect(value).toBeDisabled();await expect(page.getByRole('button',{name:'Modifica struttura',exact:true})).toBeDisabled();}finally{release();}
  await expect(value).toBeEnabled();await expect(value).toHaveValue('2');
  await value.fill('3');await page.getByRole('button',{name:'Salva modifiche',exact:true}).click();
  await expect.poll(async()=>(await extensions(page))[0]!.data.state.L).toBe(3);expect((await extensions(page))[0]!.revision).toBe(3);
});
