import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {Page} from '@playwright/test';
import type {WorkspaceProjection} from '@ardesia/remote-client';
import type {TutorInput} from '@ardesia/contracts';
import {test,expect,api,personalProjection,selectedWorkspace} from './fixtures';
import {continueRouteWithAccess,fetchRouteWithAccess} from './remote-access';
const nav=(page:Page,name:string)=>page.getByRole('navigation',{name:'Gestionale tutor'}).getByRole('button',{name});
async function save(page:Page,revision=1){await page.getByRole('button',{name:'Salva scheda',exact:true}).click();await expect(page.getByText(`Salvato · r${revision}`,{exact:false})).toBeVisible();}
async function close(page:Page){await page.getByRole('button',{name:'Chiudi scheda',exact:true}).click();}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);}
async function seed(page:Page,id:string,input:TutorInput,revision=0){const space=selectedWorkspace(page);return api<WorkspaceProjection>(page.context().request,{action:'tutor-command',workspaceId:space.workspaceId,command:{kind:'save-tutor-record',commandId:randomUUID(),recordId:id,expectedRevision:revision,input,reason:''}},space.account.id);}
const person:TutorInput={kind:'contact',title:'Ada Bianchi',email:'',phone:'',archived:false,notes:'',custom:[]};

test('tutor connects a request to a real lesson, attendance, partial payment, void and durable private history',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const chunks:string[]=[];page.on('request',request=>{if(request.url().includes('/assets/TutorStudio-'))chunks.push(request.url());});
  await page.goto('/');await expect(page.getByRole('button',{name:'Apri studio tutor',exact:true})).toBeVisible();expect(chunks).toEqual([]);await page.getByRole('button',{name:'Apri studio tutor',exact:true}).click();
  await expect.poll(()=>chunks.some(url=>url.endsWith('.js'))).toBe(true);
  await nav(page,'Studenti').click();await page.getByRole('button',{name:'Nuovo studente',exact:true}).click();
  await page.getByLabel('Nome e cognome',{exact:true}).fill('Ada Bianchi');
  await page.getByText('Campi personalizzati',{exact:true}).click();await page.getByRole('button',{name:'+ Aggiungi campo',exact:true}).click();
  await page.getByLabel('Nome campo 1',{exact:true}).fill('Obiettivo');await page.getByLabel('Valore campo 1',{exact:true}).fill('Capire le derivate');
  await save(page);await close(page);await noOverflow(page);
  await nav(page,'Richieste').click();await page.getByRole('button',{name:'Nuova richiesta',exact:true}).click();
  await page.getByLabel('Titolo',{exact:true}).fill('Ripartiamo dalle derivate');await save(page);await close(page);
  await page.getByRole('button',{name:/Ripartiamo dalle derivate/}).click();await page.getByRole('button',{name:'Programma lezione',exact:true}).click();
  await page.getByLabel('Inizio',{exact:true}).fill('2026-01-02T09:00');await page.getByLabel('Fine',{exact:true}).fill('2026-01-02T10:00');
  await page.getByLabel('Compenso per Ada Bianchi',{exact:true}).fill('30.00');
  const document=(await personalProjection(page)).documents[0]!;
  await page.getByLabel('Lezione collegata',{exact:true}).selectOption(document.id);await noOverflow(page);await save(page);
  await api(page.context().request,{action:'command',workspaceId:selectedWorkspace(page).workspaceId,command:{kind:'rename-document',documentId:document.id,expectedRevision:document.revision,commandId:randomUUID(),title:'Lezione aggiornata altrove'}},selectedWorkspace(page).account.id);
  const refreshed=page.waitForResponse(response=>response.url().endsWith('/api/m3')&&response.request().postDataJSON()?.action==='open-workspace');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;
  await page.getByLabel('Stato appuntamento',{exact:true}).selectOption('completed');await page.getByLabel('Presente · Ada Bianchi',{exact:true}).check();
  await save(page,2);await close(page);await nav(page,'Agenda').click();
  await page.getByLabel('Cerca nello studio',{exact:true}).fill('Ripartiamo');await page.getByRole('button',{name:/09:00 Ripartiamo/}).click();
  await page.getByRole('button',{name:`Leggi lezione r${document.revision}`,exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Prima osserva. Poi formula un’ipotesi');
  await page.getByRole('button',{name:'Chiudi finestra',exact:true}).click();
  await page.getByRole('button',{name:'Registra pagamento',exact:true}).click();
  await page.getByLabel('Importo ricevuto',{exact:true}).fill('10.00');await page.getByLabel('Metodo',{exact:true}).fill('Bonifico');await page.getByLabel('Riferimento univoco',{exact:true}).fill('bonifico-uno');
  await page.getByRole('button',{name:'Conferma registrazione',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.tutor-charge-row')).toContainText('20,00');
  const before=(await personalProjection(page)).tutorSpace!;expect(before.records.filter(r=>r.kind==='payment')).toHaveLength(1);
  expect(before.records.find(r=>r.kind==='appointment')).toMatchObject({revision:2,status:'completed',lesson:{documentId:document.id,revision:document.revision}});
  await nav(page,'Conti').click();await noOverflow(page);await expect(page.locator('.tutor-summary')).toContainText('10,00');
  await page.getByRole('button',{name:/10,00.*Ada Bianchi/}).click();await page.getByRole('button',{name:'Storna registrazione',exact:true}).click();
  await page.getByLabel('Motivo dello storno',{exact:true}).fill('Registrazione di prova errata');await page.getByRole('button',{name:'Conferma storno',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();expect((await personalProjection(page)).tutorSpace!.records.find(r=>r.kind==='payment')).toMatchObject({status:'void',targetRevision:2,revision:2});
  await page.screenshot({path:`../../work/rea-tutor/tutor-${test.info().project.name}.png`,fullPage:true});
  expect(errors).toEqual([]);
});

test('a concurrent billing change preserves the open payment fields without crashing or changing the target',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await seed(page,'ada',person);await seed(page,'bea',{...person,title:'Bea Rossi'});
  const pack:TutorInput={kind:'package',title:'Percorso da sei ore',notes:'',custom:[],contactId:'ada',totalMinutes:360,priceMinor:18000,currency:'EUR',expiresAt:null};
  await seed(page,'pack',pack);await page.goto('/#tutor');await nav(page,'Pacchetti').click();
  await page.getByRole('button',{name:/Percorso da sei ore/}).click();await page.getByRole('button',{name:'Registra pagamento',exact:true}).click();
  await page.getByLabel('Importo ricevuto',{exact:true}).fill('40.00');await page.getByLabel('Metodo',{exact:true}).fill('Bonifico già ricevuto');
  await seed(page,'pack',{...pack,contactId:'bea'},1);
  const refreshed=page.waitForResponse(response=>response.url().endsWith('/api/m3')&&response.request().postDataJSON()?.action==='open-workspace');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;
  await expect(page.getByRole('dialog')).toContainText('La scheda collegata è cambiata');await expect(page.getByLabel('Importo ricevuto',{exact:true})).toHaveValue('40.00');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Esporta dati inseriti',exact:true}).click();const path=await(await download).path();
  expect(JSON.parse(await readFile(path!,'utf8'))).toMatchObject({targetId:'pack',targetRevision:1,contactId:'ada',fields:{amount:'40.00'}});
  await page.getByRole('button',{name:'Conferma registrazione',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Compenso non disponibile');
  expect((await personalProjection(page)).tutorSpace!.records.some(r=>r.kind==='payment')).toBe(false);expect(errors).toEqual([]);
});

test('tutor retains newer draft edits after a lost receipt and never rebases a stale save',async({page})=>{
  await seed(page,'ada',person);let lose=true;const ids:string[]=[];
  await page.route('**/api/m3',async route=>{const body=route.request().method()==='POST'?route.request().postDataJSON():null;
    if(body?.action!=='tutor-command'){await continueRouteWithAccess(route);return;}
    ids.push(body.command.commandId);const response=await fetchRouteWithAccess(route);
    if(lose){lose=false;await route.abort('connectionfailed');}else await route.fulfill({response});
  });
  await page.goto('/#tutor');await nav(page,'Studenti').click();await page.getByRole('button',{name:/Ada Bianchi/}).click();await page.getByRole('button',{name:'Modifica scheda',exact:true}).click();
  await page.getByLabel('Nome e cognome',{exact:true}).fill('Ada dopo la prima modifica');
  // Still focused: dirty tracking must use input events, including the Preact build.
  await expect(page.getByRole('button',{name:'Salva scheda',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Salva scheda',exact:true}).click();await expect(page.getByRole('button',{name:'Verifica e ritenta',exact:true})).toBeEnabled();
  await page.getByLabel('Nome e cognome',{exact:true}).fill('Bozza più recente ancora locale');
  await seed(page,'ada',{...person,title:'Versione concorrente'},2);
  await page.getByRole('button',{name:'Verifica e ritenta',exact:true}).click();
  await expect.poll(()=>ids.length).toBe(2);expect(ids[0]).toBe(ids[1]);await expect(page.getByLabel('Nome e cognome',{exact:true})).toHaveValue('Bozza più recente ancora locale');
  await expect(page.getByText(/Esiste una revisione più recente/)).toBeVisible();
  await page.getByRole('button',{name:'Salva scheda',exact:true}).click();await expect(page.getByRole('heading',{name:'Conflitto di revisione',exact:true})).toBeVisible();
  expect((await personalProjection(page)).tutorSpace!.records.find(r=>r.id==='ada')).toMatchObject({title:'Versione concorrente',revision:3});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Esporta bozza',exact:true}).click();const path=await(await download).path();expect(JSON.parse(await readFile(path!,'utf8')).fields.title).toEqual(['Bozza più recente ancora locale']);
  await nav(page,'Agenda').click();await expect(page.getByRole('dialog')).toContainText('modifiche non salvate');await page.getByRole('button',{name:'Continua a lavorare',exact:true}).click();
  await expect(page.getByLabel('Nome e cognome',{exact:true})).toHaveValue('Bozza più recente ancora locale');
});

test('tutor exports structural edits and rejects a package overbooking without losing the draft',async({page})=>{
  await seed(page,'ada',person);await seed(page,'bea',{...person,title:'Bea Rossi'});
  await seed(page,'pack',{kind:'package',title:'Cinque ore insieme',notes:'',custom:[],contactId:'ada',totalMinutes:60,priceMinor:15000,currency:'EUR',expiresAt:null});
  await seed(page,'group',{kind:'group',title:'Gruppo analisi',contactIds:['ada','bea'],archived:false,notes:'',custom:[]});
  await page.goto('/#tutor');await page.getByRole('button',{name:'Nuovo appuntamento',exact:true}).click();
  await page.getByLabel('Titolo',{exact:true}).fill('Due ore insieme');await page.getByLabel('Gruppo',{exact:true}).selectOption('group');
  await page.getByLabel('Inizio',{exact:true}).fill('2026-01-03T09:00');await page.getByLabel('Fine',{exact:true}).fill('2026-01-03T11:00');
  await page.getByLabel('Pacchetto per Ada Bianchi',{exact:true}).selectOption('pack');await page.getByLabel('Stato appuntamento',{exact:true}).selectOption('completed');
  await page.getByLabel('Presente · Ada Bianchi',{exact:true}).check();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Esporta bozza',exact:true}).click();const path=await(await download).path();
  expect(JSON.parse(JSON.parse(await readFile(path!,'utf8')).fields.structural)).toMatchObject({status:'completed',group:'group',people:['ada','bea'],packages:{ada:'pack'}});
  await page.getByRole('button',{name:'Salva scheda',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:/insufficient/}).first()).toBeVisible();
  await expect(page.getByLabel('Titolo',{exact:true})).toHaveValue('Due ore insieme');
  expect((await personalProjection(page)).tutorSpace!.records.filter(r=>r.kind==='appointment')).toEqual([]);
  await noOverflow(page);
});
