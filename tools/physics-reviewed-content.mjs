import {readdirSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderToString} from 'katex';
import {z} from 'zod';

export const reviewDirectory = 'docs/sources/physics-2026-27/question-review';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const text = z.string().trim().min(1);
const content = z.string().trim().min(1).max(4000);
const x = z.number().min(0).max(400);
const y = z.number().min(0).max(180);
const line = z.tuple([x, y, x, y]).refine(([a,b,c,d]) => a !== c || b !== d);
const figure = z.object({
  stage: z.enum(['prompt', 'solution']),
  alt: text,
  caption: text,
  lines: z.array(line).max(60),
  arrows: z.array(line).max(20).optional(),
  labels: z.array(z.object({x, y, text: text.max(65)}).strict()).max(30)
}).strict();

const question = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: text,
  prompt: content,
  options: z.array(z.object({id: z.enum(['A','B','C','D','E']), text: content, feedback: content}).strict()),
  answer: z.discriminatedUnion('kind', [
    z.object({kind: z.literal('choice'), id: z.enum(['A','B','C','D','E'])}).strict(),
    z.object({kind: z.literal('rational'), exact: z.string().regex(/^-?\d+(?:\/[1-9]\d*)?$/), unit: text}).strict(),
    z.object({kind: z.literal('text'), accepted: z.array(text).min(1)}).strict()
  ]),
  hints: z.array(content).min(1).max(3),
  solution: z.array(content).min(1).max(8),
  reason: content,
  check: content,
  figure: figure.optional(),
  lab: z.object({href: z.enum(['urti.html','poiseuille.html','termodinamica.html','campo.html','c5.html#interferenza']), activity: content}).strict().optional()
}).strict();

export function parts(value) {
  const split = value.split('$');
  if (split.length % 2 === 0 || split.some((part, i) => i % 2 && !part.trim())) throw Error('Delimitatore matematico incompleto: '+value);
  return split.map((value, i) => ({value, math: i % 2 === 1}));
}

export function renderMath(latex) {
  return renderToString(latex, {output:'mathml', trust:false, throwOnError:true, strict:'error', maxExpand:100});
}

export function loadReviewedQuestions() {
  const records = JSON.parse(readFileSync(reviewDirectory+'/origins.json','utf8'));
  const units = JSON.parse(readFileSync('docs/sources/physics-2026-27/editorial/units.json','utf8'));
  const origins = new Map(records.map(origin => [origin.id, origin]));
  const unitIds = new Map(units.map(unit => [unit.unitId, unit]));
  const ids = new Set();
  const questions = [];
  for (const name of readdirSync(reviewDirectory+'/lots').sort()) {
    if (!name.endsWith('.json')) continue;
    const rows = z.array(question).parse(JSON.parse(readFileSync(reviewDirectory+'/lots/'+name,'utf8')));
    for (const q of rows) {
      const origin = origins.get(q.id);
      const unit = unitIds.get(origin?.lessonId);
      if (!origin || !unit || origin.taxonomyUnit !== unit.syllabusUnitId || ids.has(q.id)) throw Error('Provenienza o lezione incoerente: '+q.id);
      const choice = q.answer.kind === 'choice';
      if (choice ? origin.format !== 'multiple_choice' || q.options.map(o=>o.id).join('') !== 'ABCDE' ||
        new Set(q.options.map(o=>o.text)).size !== 5 || q.answer.id !== origin.answer.correctOptionId
        : origin.format !== 'completion' || q.options.length) throw Error('Formato o chiave cambiata: '+q.id);
      if (q.answer.kind === 'rational' && (q.answer.exact !== origin.answer.exact || q.answer.unit !== origin.answer.unit))
        throw Error('Risposta numerica cambiata: '+q.id);
      for (const field of [q.prompt, ...q.hints, ...q.solution, ...q.options.flatMap(o=>[o.text,o.feedback]), ...(q.lab?[q.lab.activity]:[])])
        for (const part of parts(field)) if (part.math) renderMath(part.value);
      ids.add(q.id);
      questions.push({...q, origin, unitId:origin.lessonId, courseId:unit.courseId});
    }
  }
  if (ids.size !== origins.size || records.length !== origins.size) throw Error('Provenienza senza record univoco.');
  return questions;
}
