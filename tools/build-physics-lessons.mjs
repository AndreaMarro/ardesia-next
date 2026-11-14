/** Static reading edition of the same courses; private work stays in the Core. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {esc,frame} from './build-physics-demo.mjs';
const root='docs/sources/physics-2026-27/editorial/';
const courses=JSON.parse(readFileSync(root+'courses.json','utf8'));
const out='apps/web/public/fisica';mkdirSync(out,{recursive:true});
const paragraphs=text=>String(text).split(/\n\s*\n/).filter(Boolean).map(p=>`<p class='prose'>${esc(p)}</p>`).join('');
const pages=[],sourcePacks=[];
for(const [index,course] of courses.entries()){
 const packFile=`apps/web/src/courses/physics/data/${course.id}.json`;
 const packBytes=readFileSync(packFile);
 const pack=JSON.parse(packBytes);
 sourcePacks.push({file:packFile,sha256:createHash('sha256').update(packBytes).digest('hex')});
 for(const [position,unit] of course.input.units.entries()){
  const reference=pack.input.units.find(value=>value.id===unit.id)?.lesson;
  const document=pack.documents.find(d=>d.id===reference?.documentId);
  if(!document)throw Error('Missing lesson: '+unit.id);
  const questions=document.objects.filter(o=>o.type==='extension'&&['ardesia.curriculum.question','ardesia.curriculum.choice-question'].includes(o.data.definition.typeId)&&['original','assessment'].includes(o.data.state.kind));
  const practice=questions.map(object=>{
   const q=object.data.state;
   return `<details class='reader-question'><summary>${q.kind==='original'?'Problema originale':'Verifica'} · ${esc(object.title)}</summary>${paragraphs(q.prompt)}<details><summary>Confronta il ragionamento</summary>${paragraphs(q.solution)}${Object.keys(q).filter(k=>/^feedback[A-E]$/.test(k)).map(k=>`<p><strong>Alternativa ${k.slice(-1)}</strong> · ${esc(q[k])}</p>`).join('')}</details></details>`;
  }).join('');
  const sources=unit.sources.map(source=>{if(!/^https?:$/.test(new URL(source.url).protocol))throw Error('Invalid source URL');return `<li><a href='${esc(source.url)}' rel='noreferrer'>${esc(source.title)}</a><small>${esc(source.revision)} · ${esc(source.license)}</small></li>`;}).join('');
  const previous=course.input.units[position-1],next=course.input.units[position+1];
  const body=`<div class='lesson-reader'>
   <a href='./c${index+1}.html#programma'>← C${index+1} · ${esc(course.input.title)}</a>
   <p class='eyebrow'>Lezione ${position+1} di ${course.input.units.length} · edizione di lettura</p>
   <h1>${esc(unit.title)}</h1><p class='reader-outcome'>${esc(unit.objective)}</p>
   <nav class='reader-jump' aria-label='In questa lezione'><a href='#teoria'>Capire</a><a href='#indagine'>Esplorare</a><a href='#pratica'>Mettersi alla prova</a><a href='#recupero'>Ripassare</a></nav>
   <div class='reader-layout'><aside><h2>Il percorso</h2><ol>${course.input.units.map(u=>`<li><a ${u.id===unit.id?'aria-current=page':''} href='./${esc(u.id)}.html'>${esc(u.title)}</a></li>`).join('')}</ol>
   <p class='notice'>Lettura e confronto sono disponibili senza account. Per conservare risposte e usare gli oggetti nella tua lavagna, apri lo spazio Ardesia.</p><a class='button' href='/#corsi'>Apri lo spazio di studio →</a></aside>
   <article><section><h2>Prima di cominciare</h2>${paragraphs(unit.prerequisites)}</section>
   <section id='teoria'><p class='eyebrow'>Il modello, i passaggi, i limiti</p><h2>Costruisci il ragionamento.</h2>${paragraphs(unit.explanation)}</section>
   <section id='indagine'><p class='eyebrow'>Una previsione prima della risposta</p><h2>Esplora l’idea.</h2><h3>Che cosa ti aspetti?</h3>${paragraphs(unit.prediction)}<h3>Metti alla prova la previsione</h3>${paragraphs(unit.activity)}<details><summary>Apri il confronto guidato</summary>${paragraphs(unit.referenceFeedback)}</details></section>
   <section id='pratica'><p class='eyebrow'>${questions.length} problemi e verifiche</p><h2>Ora prova tu.</h2><p>Lavora su carta o nella tua lavagna prima di aprire lo svolgimento. Questi esercizi non assegnano voti e non registrano tentativi.</p>${practice}<h3>Cambia contesto</h3>${paragraphs(unit.transfer)}</section>
   <section id='recupero'><h2>Se un passaggio non torna.</h2>${paragraphs(unit.recovery)}<p><a href='./simulazione.html'>Allenati con la prova completa da 31 domande →</a></p></section>
   <section class='reader-sources'><h2>Fonti e versione</h2><ul>${sources}</ul><p class='notice'>Edizione in bozza. La copertura degli obiettivi e i controlli automatici non sostituiscono la revisione scientifica umana.</p></section>
   <nav class='reader-next' aria-label='Lezione precedente e successiva'>${previous?`<a href='./${esc(previous.id)}.html'>← ${esc(previous.title)}</a>`:'<span></span>'}${next?`<a href='./${esc(next.id)}.html'>${esc(next.title)} →</a>`:`<a href='./c${index+1}.html#programma'>Torna al percorso →</a>`}</nav>
   </article></div></div>`;
  const html=frame(unit.title,body).replace('</head>',`<link rel='stylesheet' href='./lessons.css'></head>`);
  const file=unit.id+'.html';writeFileSync(out+'/'+file,html);
  pages.push({file,unitId:unit.id,courseId:course.id,questions:questions.length,sha256:createHash('sha256').update(html).digest('hex'),rawBytes:Buffer.byteLength(html),gzipBytes:gzipSync(html).length});
 }
}
writeFileSync(out+'/lessons-manifest.json',JSON.stringify({format:'ardesia-reading-edition/1',status:'DRAFT',humanApproval:false,pages,sourcePacks,sourceSha256:createHash('sha256').update(readFileSync(root+'courses.json')).digest('hex'),totalRawBytes:pages.reduce((n,p)=>n+p.rawBytes,0),totalGzipBytes:pages.reduce((n,p)=>n+p.gzipBytes,0)},null,2)+'\n');
console.log(`Physics reading edition: ${pages.length} complete lessons, no account or progress storage.`);
