/** Capture the real built public UI; no simulated interface, account or external network. */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const output=resolve(process.argv[2]??'artifacts/showcase'),root=resolve('apps/web/dist/fisica');
mkdirSync(output,{recursive:true});
const source=JSON.parse(readFileSync('apps/web/dist/build-info.json','utf8'));
const browser=await chromium.launch({headless:true});
const manifest={kind:'authentic-browser-capture',capturedAt:new Date().toISOString(),source,renderer:'Chromium headless / software rendering when available',physicalDevices:'NOT_RUN',captures:[]};
const nap=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timestamp=n=>new Date(n*1000).toISOString().slice(11,23).replace('.',',');
async function capture(name,viewport,scenes){
 const directory=resolve(output,name);mkdirSync(directory,{recursive:true});
 const context=await browser.newContext({viewport,recordVideo:{dir:directory,size:viewport},offline:true});
 const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 const started=Date.now(),subtitles=[];
 const go=async file=>page.goto(pathToFileURL(resolve(root,file)).href);
 const shot=async label=>{const file=resolve(directory,label+'.png');await page.screenshot({path:file});manifest.captures.push({file,route:await page.url(),viewport,mode:'real UI screenshot'});};
 const stage=async(label,action,seconds=4)=>{await action();await nap(180);await shot(label);const clock=(Date.now()-started)/1000;subtitles.push(`${subtitles.length+1}\n${timestamp(clock)} --> ${timestamp(clock+seconds)}\n${label.replaceAll('-',' ')}\n`);await nap(seconds*1000);};
 await scenes({page,go,stage,shot});
 const video=page.video();await context.close();const original=await video.path();
 const srt=resolve(directory,'captions.srt');writeFileSync(srt,subtitles.join('\n'));
 const mp4=resolve(directory,name+'.mp4');
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',original,'-i',srt,'-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-c:s','mov_text','-metadata:s:s:0','language=ita','-movflags','+faststart',mp4]);
 const meta=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',mp4],{encoding:'utf8'}));
 manifest.captures.push({file:mp4,original,viewport,durationSeconds:Number(meta.format.duration),mode:'continuous actual UI recording',errors,externalRequests:requests,subtitles:srt});
 if(errors.length||requests.length)throw Error('Capture has errors or external requests: '+JSON.stringify({errors,requests}));
 console.log(name,meta.format.duration,mp4);
}
try{
 await capture('ardesia-demo-16x9',{width:1920,height:1080},async({page,go,stage})=>{
  await stage('Ardesia-Fisica-idee-esperimenti-ragionamenti',()=>go('index.html'),5);
  await stage('Cinque-percorsi-da-esplorare',()=>page.locator('#percorsi').scrollIntoViewIfNeeded(),5);
  await stage('Una-lezione-interattiva-sui-fluidi',()=>go('poiseuille.html'),5);
  await stage('Prima-formula-una-previsione',async()=>{await page.locator('[name=prediction][value=quarter]').check();await page.locator('#previsione').scrollIntoViewIfNeeded();},5);
  await stage('Modifica-il-raggio-del-tubo',async()=>{await page.locator('#laboratorio').scrollIntoViewIfNeeded();await page.locator('#radius').fill('1.5');},5);
  await stage('Meta-raggio-un-sedicesimo-della-portata',async()=>{await page.locator('#radius').fill('0.5');await page.locator('.lab').scrollIntoViewIfNeeded();},5);
  await stage('Una-risposta-sbagliata-indica-dove-ripartire',async()=>{await page.locator('[name=quiz][value=A]').check();await page.locator('#check-quiz').click();await page.locator('#quiz-feedback').scrollIntoViewIfNeeded();},6);
  await stage('Riprendi-il-passaggio-esatto',()=>page.locator('#quiz-feedback a').click(),5);
  await stage('Applica-la-legge-a-un-problema-diverso',async()=>{await page.locator('#transfer-answer').fill('40');await page.locator('#check-transfer').click();await page.locator('#transfer-feedback').scrollIntoViewIfNeeded();},5);
  await stage('Conserva-il-ragionamento-con-un-file-esplicito',async()=>{await page.locator('#journey-notes').fill('Ho distinto la velocità locale dalla media. Nel confronto tengo fisse le altre grandezze.');await page.locator('#ripresa').scrollIntoViewIfNeeded();},5);
  await stage('Esplora-campo-e-potenziale',async()=>{await go('campo.html');await page.locator('#experiment-title').scrollIntoViewIfNeeded();},5);
  await stage('Stesso-punto-due-grandezze-diverse',async()=>{await page.locator('#rotate-right').click();await page.locator('#probe-y').fill('0.7');await page.locator('.scene-wrap').scrollIntoViewIfNeeded();},5);
 });
 await capture('laboratorio-3d',{width:1920,height:1080},async({page,go,stage})=>{
  await stage('Il-paesaggio-del-potenziale',async()=>{await go('campo.html');await page.locator('.scene-wrap').scrollIntoViewIfNeeded();},4);
  await stage('Ruota-la-vista',async()=>{await page.locator('#rotate-right').click();await page.locator('.scene-wrap').scrollIntoViewIfNeeded();},4);
  await stage('Cambia-le-sorgenti',async()=>{await page.locator('[name=arrangement][value=positive]').check();await page.locator('.scene-wrap').scrollIntoViewIfNeeded();},4);
  await stage('La-stessa-fisica-anche-in-2D',async()=>{await page.locator('#view-2d').click();await page.locator('.scene-wrap').scrollIntoViewIfNeeded();},4);
 });
 await capture('microcorso-esercizio',{width:1280,height:720},async({page,go,stage})=>{
  await stage('Prevedi-prima-di-misurare',async()=>{await go('poiseuille.html');await page.locator('[name=prediction][value=half]').check();await page.locator('#previsione').scrollIntoViewIfNeeded();},4);
  await stage('Cambia-un-parametro-e-osserva',async()=>{await page.locator('#radius').fill('0.5');await page.locator('.lab').scrollIntoViewIfNeeded();},4);
  await stage('Comprendi-il-tuo-errore',async()=>{await page.locator('[name=quiz][value=D]').check();await page.locator('#check-quiz').click();await page.locator('#quiz-feedback').scrollIntoViewIfNeeded();},4);
  await stage('Riparti-dalle-unita',()=>page.locator('#quiz-feedback a').click(),4);
 });
 await capture('ardesia-mobile-9x16',{width:360,height:640},async({page,go,stage})=>{
  await stage('Ardesia-Fisica-anche-su-schermi-piccoli',()=>go('index.html'),4);
  await stage('Scegli-un-percorso',()=>page.locator('#percorsi .grid article').nth(1).scrollIntoViewIfNeeded(),4);
  await stage('Una-lezione-da-provare',()=>go('poiseuille.html'),4);
  await stage('Prevedi-e-confronta',async()=>{await page.locator('[name=prediction][value=quarter]').check();await page.locator('#radius').fill('0.5');await page.locator('.lab').scrollIntoViewIfNeeded();},5);
  await stage('Ogni-errore-ha-un-passaggio-da-riprendere',async()=>{await page.locator('[name=quiz][value=A]').check();await page.locator('#check-quiz').click();await page.locator('#quiz-feedback').scrollIntoViewIfNeeded();},5);
 });
}finally{await browser.close();writeFileSync(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');}
