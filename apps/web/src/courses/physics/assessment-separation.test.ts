import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {PhysicsImportSchema} from './import';

const sources = new URL('../../../../../docs/sources/physics-2026-27/', import.meta.url);
const assets = new URL('./data/', import.meta.url);
type Assessment = {id: string; unitId: string; prompt: string; answer: string};
const assessments = JSON.parse(readFileSync(new URL('editorial/assessments.json', sources), 'utf8')) as Assessment[];
const manifest = JSON.parse(readFileSync(new URL('distributed-assets.json', sources), 'utf8')) as {files: {file: string}[]};
const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/gu, ' ').trim();
const exposedPrompts = (text: string, questions: Assessment[]) => questions.filter(q => normalize(text).includes(normalize(q.prompt))).map(q => q.id);

describe('physics assessment answers require an explicit comparison, not opening the theory', () => {
  it.each(manifest.files)('keeps final question/answer pairs out of the theory in $file', ({file}) => {
    const pack = PhysicsImportSchema.parse(JSON.parse(readFileSync(new URL(file, assets), 'utf8')));
    for (const unit of pack.input.units) {
      const questions = assessments.filter(q => q.unitId === unit.id);
      expect(questions.length).toBeGreaterThan(0);
      // Scan the served learning content, rather than checking an editorial marker.
      // NFKC/whitespace normalization prevents layout-only changes hiding a duplicate.
      for (const field of ['explanation', 'prerequisites', 'prediction', 'activity', 'recovery'] as const) {
        expect(exposedPrompts(unit[field], questions), `${unit.id}: ${field}`).toEqual([]);
      }
      expect(unit.explanation).toContain('Esempio svolto');
      const document = pack.documents.find(doc => doc.id === unit.lesson?.documentId)!;
      const explanation = document.objects.find(object => object.id.endsWith(':explanation'))!;
      expect(explanation.type).toBe('note');
      if (explanation.type !== 'note') throw Error('Missing readable theory');
      expect(exposedPrompts(explanation.data.text, questions)).toEqual([]);
      for (const question of questions) {
        expect(normalize(unit.referenceFeedback)).toContain(normalize(question.prompt));
        expect(normalize(unit.referenceFeedback)).toContain(normalize(question.answer));
        const object = document.objects.find(o => o.id.endsWith(':' + question.id))!;
        expect(object.type).toBe('extension');
        if (object.type !== 'extension') throw Error('Missing assessment');
        expect(object.data.state.prompt).toBe(question.prompt);
      }
    }
  });

  it('detects the original leak even with changed line breaks and nonbreaking spaces', () => {
    const question = assessments.find(q => q.id === 'final-U1-01.01')!;
    const leakedTheory = 'Esempio svolto\n' + question.prompt.replaceAll(' ', '\u00a0\n') + '\nRisposta: ' + question.answer;
    expect(exposedPrompts(leakedTheory, [question])).toEqual([question.id]);
    expect(exposedPrompts('La notazione scientifica esprime la scala con una potenza di dieci.', [question])).toEqual([]);
  });
});
