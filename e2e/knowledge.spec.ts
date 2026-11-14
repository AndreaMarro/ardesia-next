import {randomUUID} from 'node:crypto';
import {conceptLinkDefinition,extensionDefinitionDigest,type ConceptLinkState,type ExtensionDefinition,type NewEducationalObject} from '@ardesia/contracts';
import type {WorkspaceProjection} from '@ardesia/remote-client';
import {test,expect,personalProjection,selectedWorkspace,api} from './fixtures';
test('concept links persist as portable objects and backlinks retain exact old targets',async({page},info)=>{
 await page.goto('/');await page.getByRole('button',{name:'Apri conoscenza',exact:true}).click();
 const original=(await personalProjection(page)).documents[0]!,note=original.objects.find(o=>o.type==='note')!,formula=original.objects.find(o=>o.type==='formula')!,source=original.objects.find(o=>o.type==='source')!;
 await page.locator('.knowledge-card').filter({hasText:note.title}).click();
 await page.getByRole('combobox',{name:'Destinazione',exact:true}).selectOption({label:original.title+' · '+formula.title});await page.getByRole('button',{name:'Crea collegamento',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Segui una connessione.',exact:true})).toBeVisible();
 await page.locator('.knowledge-card').filter({hasText:formula.title}).filter({hasNotText:'→'}).click();
 await page.getByRole('combobox',{name:'Destinazione',exact:true}).selectOption({label:original.title+' · '+source.title});await page.getByRole('button',{name:'Crea collegamento',exact:true}).click();
 await expect.poll(async()=>(await personalProjection(page)).documents[0]!.objects.filter(o=>o.type==='extension').length).toBe(2);
 await expect(page.getByRole('region',{name:'Mappa delle relazioni',exact:true})).toBeVisible();await page.getByRole('button',{name:'Esplora '+formula.title,exact:true}).click();await expect(page.getByRole('heading',{name:formula.title,exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('knowledge-map.png'),fullPage:true});
 await page.reload();await page.getByLabel('Cerca nel tuo archivio',{exact:true}).fill(formula.title);
 await page.locator('.knowledge-card').filter({hasText:formula.title}).filter({hasNotText:'→'}).click();await expect(page.locator('.knowledge-link')).toHaveCount(2);
 await expect(page.locator('.knowledge-link').first()).toContainText(note.title);await expect(page.locator('.knowledge-link').first()).toContainText('Revisioni 1 → 1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Apri la lezione originale',exact:true}).click();await expect(page.getByRole('region',{name:'Lavagna della lezione',exact:true})).toBeVisible();
});

test('archive searches Creator content, explores later neighbors and follows exact backlinks across lessons',async({page},info)=>{
 await page.goto('/');const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const workspace=selectedWorkspace(page);let projection=await personalProjection(page);
 const first=projection.documents[0]!.id,second=randomUUID();
 async function execute(documentId:string,command:Record<string,unknown>){
  const result=await api<{projection:WorkspaceProjection}>(page.request,{action:'command',workspaceId:workspace.workspaceId,command:{...command,commandId:randomUUID(),documentId,expectedRevision:projection.documents.find(d=>d.id===documentId)?.revision??0}},workspace.account.id);
  projection=result.projection;
 }
 await execute(second,{kind:'create-document',title:'Seconda lezione'});
 const nodes:Array<{documentId:string;object:NewEducationalObject}>=[];
 const definition:ExtensionDefinition={format:'ardesia-extension/1',typeId:'personal.knowledge-'+randomUUID(),version:1,name:'Ragionamento',description:'Tipo scritto per questa esperienza',license:'CC0',renderer:'ardesia.composition/1',fallback:'Un ragionamento conservato',body:{fields:[{key:'prompt',kind:'text',label:'Ipotesi',initial:''}],nodes:[{id:'text',kind:'value',props:{label:'Ipotesi',expression:'prompt'}}]}};
 for(let i=0;i<=10;i++){
  const documentId=i<6?first:second,base={id:i===10?'node-0':'node-'+i,title:i===0?'Nodo origine':i===10?'Idea dieci':'Idea '+i,x:i===10?12000:60+i*20,y:100,width:300,height:180};
  const object:NewEducationalObject=i===0||i===10?{...base,type:'extension',data:{definition,definitionDigest:await extensionDefinitionDigest(definition),state:{prompt:i===10?'La frazione di tempo acceso: ipotesi iniziale.':'Appunto di collegamento 0'}}}:{...base,type:'note',data:{text:'Appunto di collegamento '+i}};
  await execute(documentId,{kind:'add-object',object});nodes.push({documentId,object});
 }
 for(let i=1;i<=10;i++){
  const target=nodes[i]!,from=nodes[0]!,state:ConceptLinkState={sourceDocumentId:first,sourceDocumentRevision:projection.documents.find(d=>d.id===first)!.revision,sourceObjectId:from.object.id,sourceObjectRevision:1,targetDocumentId:target.documentId,targetDocumentRevision:projection.documents.find(d=>d.id===target.documentId)!.revision,targetObjectId:target.object.id,targetObjectRevision:1,sourceTitle:from.object.title,targetTitle:target.object.title,relation:'approfondisce'};
  const linkDefinition=conceptLinkDefinition(state);
  // The same link ID in two documents must not merge React keys or endpoints.
  await execute(i===10?second:first,{kind:'add-object',object:{id:i===1||i===10?'relation-shared':'relation-'+i,type:'extension',title:'Legame '+i,x:100,y:400,width:320,height:200,data:{definition:linkDefinition,definitionDigest:await extensionDefinitionDigest(linkDefinition),state}}});
 }
 const last=nodes[10]!.object;expect(last.type).toBe('extension');if(last.type!=='extension')throw Error('fixture');
 await execute(second,{kind:'replace-object',object:{...last,title:'Idea dieci aggiornata',data:{...last.data,state:{prompt:'La frazione di tempo acceso: ipotesi rivista.'}}}});
 await page.reload();await page.getByRole('button',{name:'Apri conoscenza',exact:true}).click();
 const map=page.getByRole('region',{name:'Mappa delle relazioni',exact:true}),aside=page.getByRole('complementary',{name:'Collegamenti e backlink',exact:true});
 await expect(map.getByRole('combobox',{name:'Centro della mappa',exact:true}).locator('option')).toHaveCount(11);
 await map.getByRole('button',{name:'Altri vicini',exact:true}).click();await expect(map.getByRole('button',{name:'Esplora Idea dieci aggiornata',exact:true})).toBeVisible();
 await page.getByLabel('Cerca nel tuo archivio',{exact:true}).fill('FRAZIONE DI TEMPO ACCESO');
 await expect(page.locator('.knowledge-card')).toHaveCount(1);await expect(page.locator('.knowledge-card')).toContainText('ipotesi rivista');await page.locator('.knowledge-card').click();
 await expect(map.getByRole('button',{name:'Esplora Idea dieci aggiornata',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(aside).toContainText('ipotesi rivista');
 await aside.getByRole('button',{name:'Segui fonte: Nodo origine · revisione 1',exact:true}).click();
 await expect(aside.getByRole('heading',{name:'Nodo origine',exact:true})).toBeVisible();
 await expect(aside.locator('.composition-view')).toContainText('Appunto di collegamento 0');
 await aside.getByRole('button',{name:'Segui destinazione: Idea dieci · revisione 1',exact:true}).click();
 await expect(aside.getByRole('heading',{name:'Idea dieci',exact:true})).toBeVisible();await expect(aside).toContainText('ipotesi iniziale');await expect(aside).not.toContainText('ipotesi rivista');
 await aside.getByRole('button',{name:'Segui fonte: Nodo origine · revisione 1',exact:true}).click();await expect(aside.locator('.composition-view')).toContainText('Appunto di collegamento 0');
 await aside.getByRole('button',{name:'Segui destinazione: Idea dieci · revisione 1',exact:true}).click();await expect(aside.locator('.composition-view')).toContainText('ipotesi iniziale');
 await expect(aside).toContainText('revisione conservata');await page.screenshot({path:info.outputPath('knowledge-exact-backlink.png'),fullPage:true});
 await aside.getByRole('button',{name:'Apri la versione corrente nella lezione',exact:true}).click();
 await expect(page.getByLabel('Titolo oggetto',{exact:true})).toHaveValue('Idea dieci aggiornata');
 const selected=page.locator('.board-object.selected');await expect(selected).toHaveAttribute('data-object-id','node-0');await expect(selected).toBeInViewport();
 await page.getByRole('button',{name:'Apri conoscenza',exact:true}).click();
 await execute(second,{kind:'remove-object',objectId:last.id});await page.reload();
 await page.getByLabel('Cerca nel tuo archivio',{exact:true}).fill('Nodo origine');await page.locator('.knowledge-card').filter({hasText:'Appunto di collegamento 0'}).click();
 await aside.getByRole('button',{name:'Segui destinazione: Idea dieci · revisione 1',exact:true}).click();
 await expect(aside).toContainText('ipotesi iniziale');await expect(aside).toContainText('non è più nella lezione corrente');await expect(aside.getByRole('button',{name:/Apri .*lezione/})).toHaveCount(0);
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
