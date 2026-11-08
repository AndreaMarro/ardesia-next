import type {LearnerWork} from '@ardesia/contracts';
import {projectLearningEvidence} from './learning-evidence';

/** Rebuildable from an authorized work projection. No event-contiguity assumption:
 * teacher history deliberately omits private revisions. No inferred mastery. */
export function projectLearningDiary(input: LearnerWork) {
  const evidence = projectLearningEvidence(input);
  const entries = evidence.observations.map(({attempt,feedbackHistory:history,currentFeedback:latest,respondsTo,corrections:allCorrections}) => {
    const corrections = allCorrections.filter(reply=>reply.addressesCurrentFeedback).map(reply=>reply.attemptId);
    const status = !latest ? 'awaiting-review' : latest.outcome === 'demonstrated' ? 'demonstrated'
      : corrections.length ? 'correction-submitted' : 'revision-requested';
    return {attempt, history, latest, corrections, allCorrections, respondsTo, status};
  });
  return {documentId:evidence.documentId,studentId:evidence.studentId,workRevision:evidence.workRevision,entries,evidence,
    awaitingReview: entries.filter(entry => entry.status === 'awaiting-review').length,
    toRevise: entries.filter(entry => entry.status === 'revision-requested').length,
    demonstrated: entries.filter(entry => entry.status === 'demonstrated').length};
}
