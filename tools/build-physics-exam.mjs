import {readFileSync, writeFileSync, mkdirSync, readdirSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {buildPhysicsRuntime} from './build-physics-runtime.mjs';
await buildPhysicsRuntime();

const out = 'apps/web/public/fisica';
const readingUnits=new Map(JSON.parse(readFileSync('docs/sources/physics-2026-27/editorial/courses.json','utf8')).flatMap((course,index)=>course.input.units.map(unit=>[unit.id,{courseId:'c'+(index+1),syllabusUnit:'U'+unit.id.match(/-u([1-7])-/)[1]}])));
function buildExamPage(sourceFile,file,label) {
const raw = readFileSync(sourceFile);
const exam = JSON.parse(raw);
const sha = createHash('sha256').update(raw).digest('hex');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if (exam.status !== 'DRAFT' || exam.humanApproval !== false || exam.durationMinutes !== 50 || exam.questions.length !== 31) throw Error('Unexpected exam metadata');
if (exam.score?.correct !== 1 || exam.score?.wrong !== -0.1 || exam.score?.blank !== 0) throw Error('Unexpected scoring rules');
if (exam.questions.filter(q => q.type === 'choice').length !== 21 || exam.questions.filter(q => q.type === 'completion').length !== 10) throw Error('Expected 21 choice and 10 completion questions');
const ids = new Set();
for (const q of exam.questions) {
  if (ids.has(q.id) || !q.id || !/^c[1-5]$/.test(q.courseId) || !/^U[1-7]$/.test(q.syllabusUnit) || q.status !== 'DRAFT' || q.humanApproval !== false) throw Error('Invalid question identity: ' + q.id);
  ids.add(q.id);
  const unit=readingUnits.get(q.unitId);
  if(!unit||unit.courseId!==q.courseId||unit.syllabusUnit!==q.syllabusUnit)throw Error('Invalid recovery lesson: '+q.id);
  for (const key of ['topic','title','prompt','explanation','recoveryHint']) if (typeof q[key] !== 'string' || !q[key].trim()) throw Error('Missing ' + key + ': ' + q.id);
  if (q.type === 'choice') {
    if (q.choices?.length !== 5 || q.choices.some((c,i) => c.id !== 'ABCDE'[i] || !c.text?.trim() || !c.feedback?.trim()) || !q.choices.some(c => c.id === q.correctChoice)) throw Error('Invalid choices: ' + q.id);
  } else if (!q.acceptedAnswers?.length || q.acceptedAnswers.some(a => typeof a !== 'string' || !/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(a))) throw Error('Invalid completion: ' + q.id);
}
for (const source of exam.sources) if (new URL(source.url).protocol !== 'https:') throw Error('Source URL must use HTTPS');
mkdirSync(out, {recursive:true});
const payload = {sourceFile,sourceSha256:sha,exam};
const data = JSON.stringify(payload).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const html = offline => `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="description" content="Una prova libera di Fisica: 31 quesiti originali, 50 minuti o allenamento senza timer, spiegazioni e ripasso C1–C5."><title>La prova ragionata · Fisica · Ardesia Next</title><link rel="stylesheet" href="./exam.css"><script type="application/json" id="exam-data">${data}</script><script src="./exam.js" defer></script></head>
<body><a class="skip" href="#main">Vai al contenuto</a><header><a class="brand" href="./index.html">ardesia<span>next / fisica</span></a><a href="./index.html#percorsi">Torna ai cinque percorsi →</a></header>
<main id="main" tabindex="-1">
<div id="intro"><nav aria-label="Scegli la prova" class="edition-picker"><a href="./simulazione.html" ${label==='A'?'aria-current="page"':''}>Prova A</a><a href="./simulazione-b.html" ${label==='B'?'aria-current="page"':''}>Prova B · nuove domande</a></nav><p class="eyebrow">Fisica · semestre aperto 2026/27 · prova ${label}</p><h1 id="intro-heading" tabindex="-1">Metti alla prova le idee.<br>Poi ritrova il <em>perché.</em></h1><p class="lead">Trentuno domande per collegare le leggi ai problemi. Scegli il ritmo, prova da solo, poi ricostruisci ogni passaggio con spiegazioni e indicazioni per il ripasso.</p>
<div class="intro-layout"><div><div class="facts"><div><strong>31</strong><span>quesiti originali</span></div><div><strong>50′</strong><span>oppure senza timer</span></div><div><strong>7</strong><span>unità del syllabus</span></div></div><h2>Un tentativo. Un’occasione per capire.</h2><p>21 domande a scelta singola, con cinque alternative, e 10 completamenti numerici. Puoi cambiare risposta, lasciare bianco e segnare le domande da rivedere prima della consegna.</p><p><strong>+1</strong> per una risposta corretta · <strong>−0,1</strong> per una risposta errata · <strong>0</strong> se lasci bianco. Nei completamenti inserisci solo il numero, nell’unità indicata.</p><p class="notice">Prova libera, non ufficiale e non sorvegliata. I contenuti sono DRAFT, con revisione scientifica umana da completare. Il risultato descrive soltanto queste risposte: non certifica competenze né garantisce un esito d’esame.</p></div>
<aside class="start-card" aria-labelledby="choose-mode"><p class="eyebrow">Il tuo ritmo</p><h2 id="choose-mode">Come vuoi cominciare?</h2><button id="start-timed" type="button" disabled>Prova a tempo · 50 minuti</button><button id="start-practice" class="secondary" type="button" disabled>Allenati senza timer</button><p class="small">Il timer continua anche se cambi scheda. Alla scadenza le risposte vengono consegnate automaticamente.</p><p class="small"><strong>Solo in questa pagina.</strong> Nessun account e nessun salvataggio automatico. Se ricarichi o chiudi la pagina, perdi il tentativo. Alla fine puoi esportare il risultato sul tuo dispositivo.</p>${offline ? '<p class="small">Copia offline: la prova e le demo C1–C5 funzionano senza rete. I collegamenti alle fonti esterne richiedono una connessione.</p>' : '<p class="link-line"><a href="./ardesia-prova-fisica-offline.zip" download>Scarica la prova e le demo offline ↓</a></p><p class="small">Estrai lo ZIP e apri simulazione.html. Nessuna installazione.</p>'}<noscript><p class="notice">Per rispondere e calcolare il risultato occorre JavaScript. Le demo dei corsi restano leggibili anche senza JavaScript.</p></noscript><p id="load-error" class="notice" hidden>Non è stato possibile caricare la prova. Ricarica la pagina oppure estrai nuovamente tutto lo ZIP offline.</p></aside></div>
<details class="source-details"><summary>Formato, provenienza e limiti della prova</summary><p>Formato 2026/27 verificato il 14 novembre 2026. La distribuzione delle domande fra gli argomenti è editoriale: una sola prova non copre ogni obiettivo del programma. Difficoltà non calibrata su studenti. Le chiavi sono presenti nel browser: questa esperienza serve ad allenarsi, non è una verifica con controllo anti-frode.</p><ul>${exam.sources.map(s=>`<li><a href="${esc(s.url)}" rel="noreferrer">${esc(s.title)}</a></li>`).join('')}</ul><p class="small">Sorgente: <code>${esc(sourceFile)}</code><br>SHA-256: <code>${sha}</code></p></details></div>
<section id="active-exam" hidden aria-label="Prova in corso"><div class="exam-bar"><p><strong id="mode-name"></strong><br><span id="answered-count"></span></p><div class="timer-block"><span>Tempo restante</span><span id="timer" class="timer" role="timer" aria-live="off"></span></div></div><div class="exam-grid"><div><article class="question-panel"><p id="question-meta" class="eyebrow"></p><h2 id="question-title" tabindex="-1"></h2><p id="question-prompt" class="prompt"></p><div id="answer-area"></div><p id="input-help" class="input-help"></p><div class="question-tools"><button id="flag-question" type="button" class="quiet" aria-pressed="false">Segna da rivedere</button><button id="clear-answer" type="button" class="quiet">Lascia bianco</button></div></article><nav class="previous-next" aria-label="Scorri le domande"><button id="previous" type="button" class="secondary">← Precedente</button><button id="next" type="button">Successiva →</button></nav></div><aside class="navigator" aria-labelledby="nav-title"><h3 id="nav-title">Il tuo percorso</h3><progress id="progress" max="31" value="0" aria-label="Risposte inserite"></progress><p id="flag-count"></p><nav id="question-nav" class="question-nav" aria-label="Scegli una domanda"></nav><p class="legend-note">Verde chiaro: risposta inserita.<br>⚑: domanda segnata da rivedere.<br>Ogni numero apre la sua domanda.</p><button id="submit-exam" type="button">Consegna la prova</button><p>Le soluzioni si aprono soltanto dopo la consegna.</p></aside></div></section>
<section id="results" hidden aria-label="Risultato e ripasso"><p class="eyebrow">Il tuo tentativo · prova ${label}</p><h1 id="result-heading" tabindex="-1"></h1><div class="result-summary"><div><div id="result-score" class="score"></div><span class="score-label">punti grezzi / 31</span></div><div><h2 id="result-counts"></h2><p id="result-context" class="small"></p></div></div><div class="result-actions"><button id="export-readable" type="button">Salva il ripasso leggibile ↓</button><button id="export-result" type="button">Esporta il risultato JSON ↓</button><button id="new-attempt" type="button" class="secondary">Un nuovo tentativo</button></div><p class="small">Il ripasso HTML conserva tutte le spiegazioni e si può stampare in PDF dal browser. Il JSON contiene le tue risposte e i tempi, la provenienza dei quesiti e i limiti della prova. Resta sul tuo dispositivo finché scegli di condividerlo. La pagina non invia il risultato.</p><section class="recovery-section"><p class="eyebrow">Dalle risposte al prossimo passo</p><h2>Argomenti da riprendere</h2><p>Questi collegamenti raccolgono gli argomenti delle risposte errate o mancanti. Sono una traccia di ripasso, non una stima automatica della tua preparazione.</p><ul id="recovery-list"></ul></section><section><h2>Rileggi il ragionamento</h2><p>Apri ogni domanda per confrontare la tua risposta, capire gli errori possibili e scegliere il prossimo passo.</p><div id="review-list"></div></section></section>
<div id="live-status" role="status" aria-live="polite" aria-atomic="true" class="visually-hidden"></div>
</main><footer><p>Ardesia Next · preparazione indipendente, senza affiliazione al MUR. Contenuti DRAFT: revisione scientifica umana pendente. Nessun risultato viene salvato automaticamente su server o nel browser dopo la chiusura della pagina. I file che scegli di esportare restano sul tuo dispositivo.</p></footer>
<dialog id="submit-dialog" aria-labelledby="submit-title" aria-describedby="submit-summary"><h2 id="submit-title">Consegniamo questo tentativo?</h2><p id="submit-summary"></p><p class="small">Nella prova a tempo il timer continua anche mentre questa finestra è aperta.</p><div class="dialog-actions"><button id="continue-exam" class="secondary" type="button">Continua a ragionare</button><button id="confirm-submit" type="button">Sì, consegna</button></div></dialog>
<dialog id="restart-dialog" aria-labelledby="restart-title"><h2 id="restart-title">Cominciare da capo?</h2><p>Il risultato attuale verrà rimosso dalla pagina. Se vuoi conservarlo, scegli prima «Esporta il risultato JSON».</p><div class="dialog-actions"><button id="keep-result" class="secondary" type="button">Conserva questa schermata</button><button id="confirm-restart" type="button">Sì, nuovo tentativo</button></div></dialog></body></html>\n`;
writeFileSync(out+'/'+file,html(false));
return {file,label,sourceFile,sha,data,html};
}
const variants=[
 buildExamPage('docs/sources/physics-2026-27/editorial/exam-2026-a.json','simulazione.html','A'),
 buildExamPage('docs/sources/physics-2026-27/editorial/exam-2026-b.json','simulazione-b.html','B'),
];
const {html,sha,data,sourceFile}=variants[0];

// ZIP stored entries: no compression dependency, deterministic bytes and no executable archive paths.
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function storedZip(entries) {
  const local = [], central = []; let offset = 0;
  for (const [name, value] of entries) {
    if (!/^[a-z0-9_./-]+$/i.test(name) || name.startsWith('/') || name.split('/').some(part=>part === '..' || part === '')) throw Error('Unsafe ZIP path');
    const filename = Buffer.from(name), bytes = Buffer.from(value), crc = crc32(bytes);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20,4); h.writeUInt16LE(0x21,12); h.writeUInt32LE(crc,14); h.writeUInt32LE(bytes.length,18); h.writeUInt32LE(bytes.length,22); h.writeUInt16LE(filename.length,26);
    local.push(h, filename, bytes);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50); c.writeUInt16LE(20,4); c.writeUInt16LE(20,6); c.writeUInt16LE(0x21,14); c.writeUInt32LE(crc,16); c.writeUInt32LE(bytes.length,20); c.writeUInt32LE(bytes.length,24); c.writeUInt16LE(filename.length,28); c.writeUInt32LE(offset,42);
    central.push(c, filename); offset += h.length + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10); end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...local, directory, end]);
}
const offlineLimits={files:256,totalBytes:16*1024*1024,fileBytes:2*1024*1024,depth:8};
function offlineFiles(directory, prefix='', bounded={count:variants.length+1,bytes:variants.reduce((total,v)=>total+Buffer.byteLength(v.html(true)),0)}) {
  if(prefix.split('/').length>offlineLimits.depth)throw Error('Offline archive nesting limit');
  const result=[];
  for (const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
    const relative=prefix+entry.name;
    if (entry.isDirectory()) result.push(...offlineFiles(directory+'/'+entry.name,relative+'/',bounded));
    else if (entry.isFile() && /\.(?:html|css|js|json|mp4|png|vtt|txt)$/.test(entry.name) && !variants.some(v=>v.file===relative) && entry.name !== 'exam-data.js' && !/manifest.*\.json$/i.test(entry.name)) {
      const bytes=statSync(directory+'/'+entry.name).size;
      bounded.count++;bounded.bytes+=bytes;
      if(bounded.count>offlineLimits.files||bytes>offlineLimits.fileBytes||bounded.bytes>offlineLimits.totalBytes)throw Error('Offline archive resource limit');
      result.push(relative);
    }
  }
  return result;
}
const files = offlineFiles(out);
function offlineFile(file) {
  const bytes=readFileSync(out+'/'+file);
  if(!file.endsWith('.html'))return bytes;
  const text=bytes.toString('utf8')
    .replace("<a class='button' href='/#corsi'>Apri lo spazio di studio →</a>","<p class='notice'>Questa copia serve alla lettura e alla pratica offline. Per salvare il lavoro nello spazio Ardesia occorre un accesso online fornito separatamente.</p>")
    .replace(/<a\b[^>]*href=["']\.\/ardesia-prova-fisica-offline\.zip["'][^>]*>[\s\S]*?<\/a>/g,"<span>Stai usando la copia offline: lezioni, laboratori e prova sono già in questa cartella.</span>");
  if(/\b(?:href|src)\s*=\s*["']?\s*\//i.test(text))throw Error('Generated offline page contains a root-relative URL: '+file);
  return Buffer.from(text);
}
const entries = [...variants.map(v=>[v.file,v.html(true)]), ...files.map(file=>[file,offlineFile(file)]), ['LEGGIMI.txt','Ardesia Next · prova libera di Fisica\nEstrai tutti i file nella stessa cartella e apri simulazione.html.\nLa prova e le demo funzionano offline con JavaScript. I collegamenti a fonti e contatti esterni richiedono rete. Lo spazio Ardesia con salvataggio richiede un accesso online fornito separatamente.\nLe risposte restano solo nella memoria della pagina: esporta il risultato prima di chiudere.\nContenuti DRAFT, approvazione scientifica umana pendente. Prova non ufficiale, non sorvegliata.\nSHA-256 sorgente: '+sha+'\n']];
if(entries.length>offlineLimits.files)throw Error('Offline archive file count limit');
let totalBytes=0;for(const [,value] of entries){const bytes=Buffer.byteLength(value);if(bytes>offlineLimits.fileBytes)throw Error('Offline archive file size limit');totalBytes+=bytes;}
if(totalBytes>offlineLimits.totalBytes)throw Error('Offline archive total size limit');
const zip = storedZip(entries);
writeFileSync(out+'/ardesia-prova-fisica-offline.zip',zip);
writeFileSync(out+'/exam-manifest.json',JSON.stringify({kind:'physics-practice-exam',status:'DRAFT',humanApproval:false,sourceFile,sourceSha256:sha,questionCount:31,choice:21,completion:10,embeddedData:{format:'inert application/json',rawBytes:Buffer.byteLength(data),gzipBytes:gzipSync(data).length,sha256:createHash('sha256').update(data).digest('hex')},editionCount:variants.length,totalQuestionCount:31*variants.length,editions:variants.map(v=>({label:v.label,file:v.file,sourceFile:v.sourceFile,sourceSha256:v.sha,embeddedData:{rawBytes:Buffer.byteLength(v.data),gzipBytes:gzipSync(v.data).length}})),files:[...variants.map(v=>v.file),'exam.js','exam.css','ardesia-prova-fisica-offline.zip'].map(file=>({file,bytes:readFileSync(out+'/'+file).length,sha256:createHash('sha256').update(readFileSync(out+'/'+file)).digest('hex')})),offlineFiles:entries.map(([name])=>name),offlineLimits},null,2)+'\n');
console.log('Physics practice exam and self-contained offline ZIP generated; DRAFT, no storage or publication.');
