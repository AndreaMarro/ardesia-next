import {LearnerWorkSchema, type LearnerWork} from '@ardesia/contracts';

/** Rebuildable from an authorized work projection. No event-contiguity assumption:
 * teacher history deliberately omits private revisions. No inferred mastery. */
export function projectLearningDiary(input: LearnerWork) {
  const work = LearnerWorkSchema.parse(input);
  const entries = work.attempts.map(attempt => {
    const history = (work.feedback ?? []).filter(feedback => feedback.attemptId === attempt.id);
    const latest = history.at(-1) ?? null;
    const corrections = latest ? work.attempts.filter(entry => entry.replyToFeedbackId === latest.id).map(entry => entry.id) : [];
    const status = !latest ? 'awaiting-review' : latest.outcome === 'demonstrated' ? 'demonstrated'
      : corrections.length ? 'correction-submitted' : 'revision-requested';
    return {attempt, history, latest, corrections, status};
  });
  return {documentId: work.documentId, studentId: work.studentId, workRevision: work.revision, entries,
    awaitingReview: entries.filter(entry => entry.status === 'awaiting-review').length,
    toRevise: entries.filter(entry => entry.status === 'revision-requested').length,
    demonstrated: entries.filter(entry => entry.status === 'demonstrated').length};
}
