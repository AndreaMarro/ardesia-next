import {readFileSync, writeFileSync} from 'node:fs';
import {esc, frame} from './build-physics-demo.mjs';
import {loadReviewedQuestions, parts, renderMath, sha256} from './physics-reviewed-content.mjs';

const out = 'apps/web/public/fisica';
const courses = JSON.parse(readFileSync('docs/sources/physics-2026-27/editorial/courses.json','utf8'));
const inline = value => parts(value).map(({value, math}) => math ? '<span class="practice-math">'+renderMath(value)+'</span>' : esc(value)).join('');
const paragraph = value => `<p class='prose'>${inline(value)}</p>`;
const line = ([x1,y1,x2,y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;

function diagram(figure, id) {
  if (!figure) return '';
  const marker = 'arrow-'+id;
  const arrows = (figure.arrows ?? []).map(segment => line(segment).replace('/>', ` marker-end="url(#${marker})"/>`)).join('');
  const labels = figure.labels.map(({x,y,text}) => `<text x="${x}" y="${y}" text-anchor="middle">${esc(text)}</text>`).join('');
  return `<figure class='reviewed-figure'><svg viewBox="0 0 400 180" role="img" aria-label="${esc(figure.alt)}"><defs><marker id="${marker}" viewBox="0 0 9 8" refX="8" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L9 4L0 8Z"/></marker></defs>${figure.lines.map(line).join('')}${arrows}${labels}</svg><figcaption>${esc(figure.caption)}</figcaption></figure>`;
}

// MathML remains visible and navigable; the radio also has a speakable name when
// a platform's accessible-name computation skips MathML descendants.
function spokenFormula(value) {
  let spoken = value.replace(/\\(?:math(?:rm|bf|it)|text)\{([^{}]+)\}/g, '$1');
  spoken = spoken.replace(/\\(?:d|t)?frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1) diviso ($2)');
  return spoken.replace(/\\(?:left|right|big|Big)\b/g, '')
    .replace(/\\(?:cdot|times)\b/g, ' per ').replace(/\\,/g, ' ')
    .replace(/\\([A-Za-z]+)/g, ' $1 ').replace(/\^/g, ' elevato a ')
    .replace(/_/g, ' pedice ').replace(/\//g, ' diviso ').replace(/[{}]/g, '');
}
const spokenText = value => parts(value).map(({value, math}) => math ? spokenFormula(value) : value).join('');

function answerForm(q) {
  const choice = q.answer.kind === 'choice';
  const input = choice
    ? `<fieldset><legend>Scegli una risposta</legend>${q.options.map(({id,text}) => `<label class='reviewed-option'><input type='radio' name='answer' value='${id}' aria-label="${esc(id+'. '+spokenText(text))}" required><span>${id}. ${inline(text)}</span></label>`).join('')}</fieldset>`
    : `<label for='answer-${q.id}'>La tua risposta${q.answer.kind === 'rational' && q.answer.unit !== '1' ? ` (in ${esc(q.answer.unit)})` : ''}</label><input id='answer-${q.id}' name='answer' type='text' maxlength='80' autocomplete='off' required${q.answer.kind === 'rational' ? ` aria-describedby='format-${q.id}'` : ''}>${q.answer.kind === 'rational' ? `<small id='format-${q.id}'>Inserisci un numero senza unità. Puoi usare una frazione, la virgola o il punto decimale.</small>` : ''}`;
  const feedback = q.options.map(({id,feedback}) => `<div data-practice-option='${id}' hidden>${paragraph(feedback)}</div>`).join('');
  return `<form data-practice-answer="${esc(JSON.stringify(q.answer))}">${input}<button class='button' type='submit' disabled>Controlla la risposta</button><output aria-live='polite'></output>${feedback}</form><noscript><p>Puoi confrontare la risposta aprendo lo svolgimento. Il controllo immediato richiede JavaScript.</p></noscript>`;
}

function questionHTML(q) {
  const response = q.answer.kind === 'choice' ? `${q.answer.id}. ${q.options.find(o=>o.id === q.answer.id).text}`
    : q.answer.kind === 'text' ? q.answer.accepted[0] : `${q.answer.exact}${q.answer.unit==='1'?'':' '+q.answer.unit}`;
  const visual = diagram(q.figure, q.id);
  const workedVisual = q.solutionFigure ? diagram(q.solutionFigure, q.id+'-solution') : q.figure?.stage==='solution' ? visual : '';
  return `<details class='reviewed-question' id='${q.id}'><summary>${esc(q.title)} <small>· ${esc(q.origin.level)}</small></summary>
    ${paragraph(q.prompt)}${q.figure?.stage==='prompt'?visual:''}${answerForm(q)}
    ${q.hints.map((hint,i)=>`<details class='reviewed-hint'><summary>${q.hints.length===1?'Suggerimento':`Suggerimento ${i+1}`}</summary>${paragraph(hint)}</details>`).join('')}
    <details class='reviewed-solution'><summary>Leggi lo svolgimento completo</summary><p><strong>Risposta.</strong> ${inline(response)}</p>${workedVisual}${q.solution.map(paragraph).join('')}</details>
    ${q.lab?`<div class='reader-lab'>${paragraph(q.lab.activity)}<a class='button' href='./${q.lab.href}'>Apri il laboratorio collegato →</a></div>`:''}
  </details>`.replace(/[ \t]+$/gm, '');
}

const questions = loadReviewedQuestions();
const grouped = Map.groupBy(questions, q => q.unitId);
const linkedFrom = new Map();
for (const q of questions) {
  for (const id of q.origin.linkedLessons) {
    if (id === q.unitId) continue;
    if (!linkedFrom.has(id)) linkedFrom.set(id, []);
    linkedFrom.get(id).push(q);
  }
}
const link = q => `<a href='./${q.unitId}.html#${q.id}'>${esc(q.title)}</a>`;
export const reviewedAssetTags = "<link rel='stylesheet' href='./practice.css'><script defer src='./practice.js'></script>";
export function reviewedLesson(unitId) {
  const rows = grouped.get(unitId) ?? [];
  const links = linkedFrom.get(unitId) ?? [];
  if (!rows.length && !links.length) return '';
  return `<section class='reviewed-practice' id='esercizi-guidati'><h3>Esercizi guidati</h3>${rows.length
    ? '<p>Prova una risposta, apri un indizio se ti serve e confronta i passaggi.</p>'+rows.map(questionHTML).join('')
    : ''}${links.length
    ? '<h4>Esercizi collegati a questa lezione</h4><ul class="reviewed-links">'+links.map(q=>'<li>'+link(q)+'</li>').join('')+'</ul>'
    : ''}<p><a href='./esercizi-guidati.html'>Vedi tutti gli esercizi guidati</a></p></section>`;
}

export function writeReviewedCatalog() {
  const listings = courses.map((course,index) => {
    const rows = questions.filter(q => q.courseId === course.id);
    if (!rows.length) return '';
    return `<section id='c${index+1}'><h2>C${index+1} · ${esc(course.input.title)}</h2><ul>${rows.map(q => `<li>${link(q)} <small>· ${esc(q.origin.level)}</small></li>`).join('')}</ul><a href='./c${index+1}.html#programma'>Torna alle lezioni del percorso →</a></section>`;
  }).join('');
  const navigation = '<nav class="reader-jump" aria-label="Percorsi">'+courses.map((course, i)=>
    '<a href="#c'+(i+1)+'">C'+(i+1)+' · '+esc(course.input.title)+'</a>').join('')+'</nav>';
  const html = frame('Esercizi guidati di Fisica', `<div class='lesson-reader reviewed-catalog'><h1>Esercizi guidati</h1><p class='reader-outcome'>Scegli un quesito. Ogni collegamento apre la lezione con suggerimenti, risposta e svolgimento.</p>${navigation}${listings}</div>`)
    .replace('</head>', "<link rel='stylesheet' href='./lessons.css'><link rel='stylesheet' href='./practice.css'></head>");
  const page = 'esercizi-guidati.html';
  writeFileSync(out+'/'+page, html);
  writeFileSync(out+'/practice-manifest.json', JSON.stringify({
    status:'DRAFT', humanApproval:false, catalog:page, catalogSHA256:sha256(html),
    rows:questions.map(q=>({id:q.id,level:q.origin.level,courseId:q.courseId,lesson:q.unitId+'.html',figure:!!q.figure,stagedFigure:!!q.solutionFigure,linkedLessons:q.origin.linkedLessons.map(id=>id+'.html'),originalBlob:q.origin.blob,originalSHA256:q.origin.sha256}))
  },null,2)+'\n');
}
