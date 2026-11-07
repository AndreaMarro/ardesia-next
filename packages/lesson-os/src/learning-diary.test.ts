import {describe, expect, it} from 'vitest';
import type {LearnerWork} from '@ardesia/contracts';
import {projectLearningDiary} from './index';
const at = '2026-11-07T12:00:00.000Z';
const work: LearnerWork = {documentId: 'lesson', studentId: 'learner', revision: 9, notes: '', labs: [], consents: [], evidenceShared: true, createdAt: at, updatedAt: at,
  attempts: [{id: 'first', objectId: 'object', sourceObjectRevision: 1, answer: 'Raddoppia', createdAt: at},
    {id: 'second', objectId: 'object', sourceObjectRevision: 2, answer: 'Quadruplica', createdAt: at, replyToFeedbackId: 'feedback'}],
  feedback: [{id: 'feedback', attemptId: 'first', authorId: 'teacher', createdAt: at, outcome: 'revise', comment: 'Dipendenza quadratica', nextStep: 'Sostituisci 2x'}]};
describe('educational diary as an evidence projection', () => {
  it('uses current authorized evidence even without a contiguous teacher event stream', () => {
    const before = structuredClone(work), diary = projectLearningDiary(work);
    expect(diary).toMatchObject({workRevision: 9, awaitingReview: 1, toRevise: 0, demonstrated: 0,
      entries: [{status: 'correction-submitted', corrections: ['second']}, {status: 'awaiting-review'}]});
    expect(diary.entries.map(entry => entry.attempt.sourceObjectRevision)).toEqual([1, 2]);
    diary.entries[0]!.attempt.answer = 'Caller mutation'; expect(work).toEqual(before);
  });
  it('counts only explicit feedback and preserves amendments without averaging scores', () => {
    const candidate = structuredClone(work);
    candidate.feedback!.push({id: 'amendment', attemptId: 'first', supersedesFeedbackId: 'feedback', authorId: 'teacher', createdAt: at, outcome: 'partial', comment: 'Direzione corretta', nextStep: 'Calcola il rapporto'});
    const diary = projectLearningDiary(candidate); expect(diary.toRevise).toBe(1); expect(diary.demonstrated).toBe(0);
    expect(diary.entries[0]!.history).toHaveLength(2);
    candidate.feedback!.push({id: 'second-feedback', attemptId: 'second', authorId: 'teacher', createdAt: at, outcome: 'demonstrated', comment: 'Rapporto corretto', nextStep: ''});
    expect(projectLearningDiary(candidate)).toMatchObject({toRevise: 1, awaitingReview: 0, demonstrated: 1});
  });
});
