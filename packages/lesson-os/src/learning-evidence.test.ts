import {it,expect} from 'vitest';
import type {LearnerWork} from '@ardesia/contracts';
import {projectLearningEvidence} from './learning-evidence';
const at='2026-11-08T12:00:00.000Z';
const initial:LearnerWork={documentId:'lesson',studentId:'student',revision:41,notes:'Private notes',labs:[],consents:[],evidenceShared:false,createdAt:at,updatedAt:at,
  attempts:[{id:'a',objectId:'problem',sourceObjectRevision:3,answer:'First reasoning',createdAt:at}],feedback:[{id:'f',attemptId:'a',authorId:'teacher',createdAt:at,outcome:'partial',comment:'Direction identified',nextStep:'Compare the units before calculating.'}]};
const corrected=():LearnerWork=>({...structuredClone(initial),attempts:[...initial.attempts,{id:'b',objectId:'problem',sourceObjectRevision:4,answer:'Revised reasoning',createdAt:at,replyToFeedbackId:'f'}]});
it('replaces an addressed request with the pending correction without inventing an outcome',()=>{
  const model=projectLearningEvidence(corrected());
  expect(model.openSteps.map(s=>[s.kind,s.attempt.id])).toEqual([['review-pending','b']]);
  expect(model.observations[1]!.respondsTo).toEqual({attemptId:'a',feedbackId:'f',isCurrentFeedback:true});
  expect(model.assessment).toEqual({status:'not-estimated',reasons:['independence-unrecorded','no-skill-rubric','unreviewed-responses','feedback-linked-corrections']});
});
it('keeps a correction tied to its exact feedback when a later amendment changes the request',()=>{
  const work=corrected();work.feedback!.push({...initial.feedback![0]!,id:'f2',supersedesFeedbackId:'f',nextStep:'Explain the sign as well.'});
  const model=projectLearningEvidence(work);
  expect(model.openSteps.map(s=>[s.kind,s.attempt.id])).toEqual([['reread-amendment','a'],['review-pending','b']]);
  expect(model.nextStep).toMatchObject({origin:'workflow',feedback:{id:'f2'},instruction:'Explain the sign as well.',relatedAttemptIds:['b']});
  expect(model.observations[1]!.respondsTo?.isCurrentFeedback).toBe(false);
  expect(model.observations[0]!.feedbackHistory.map(f=>f.id)).toEqual(['f','f2']);
});
it('continues the explicit correction chain while keeping independent attempts separate',()=>{
  const work=corrected();work.feedback!.push({...initial.feedback![0]!,id:'fb',attemptId:'b'});
  work.attempts.push({...work.attempts[0]!,id:'c'}, {...work.attempts[1]!,id:'d',replyToFeedbackId:'fb'});
  const model=projectLearningEvidence(work);
  expect(model.openSteps.map(s=>[s.kind,s.attempt.id])).toEqual([['review-pending','c'],['review-pending','d']]);
  expect(model.observations[2]!.respondsTo).toBeNull();
});
it('never turns demonstrated feedback into a mastery score or a fabricated exercise',()=>{
  const work=corrected();work.feedback!.push({...initial.feedback![0]!,id:'fb',attemptId:'b',outcome:'demonstrated',nextStep:''});
  const model=projectLearningEvidence(work);expect(model.nextStep).toBeNull();expect(model.assessment.status).toBe('not-estimated');
  work.feedback![1]!.nextStep='Try the new setting proposed in class.';
  expect(projectLearningEvidence(work).nextStep).toMatchObject({kind:'teacher-next',origin:'teacher-feedback',instruction:'Try the new setting proposed in class.'});
});
it('keeps a conclusive amendment as provenance without requiring a fictitious new correction',()=>{
  const work=corrected();
  work.feedback!.push({...initial.feedback![0]!,id:'fb',attemptId:'b',outcome:'demonstrated',nextStep:''},
    {...initial.feedback![0]!,id:'f2',supersedesFeedbackId:'f',outcome:'demonstrated',nextStep:''});
  const model=projectLearningEvidence(work);
  expect(model.nextStep).toBeNull();
  expect(model.observations[0]!.feedbackHistory.map(value=>value.id)).toEqual(['f','f2']);
  expect(model.observations[1]!.respondsTo).toEqual({attemptId:'a',feedbackId:'f',isCurrentFeedback:false});
});
it('orders explicit amendments, requests and waits deterministically, without merging independent evidence',()=>{
  const work=corrected();
  work.attempts.push({...initial.attempts[0]!,id:'independent'});
  work.feedback!.push({...initial.feedback![0]!,id:'f2',supersedesFeedbackId:'f'},
    {...initial.feedback![0]!,id:'fi',attemptId:'independent'});
  const model=projectLearningEvidence(work);
  expect(model.openSteps.map(step=>[step.kind,step.attempt.id])).toEqual([['reread-amendment','a'],['revise','independent'],['review-pending','b']]);
  work.attempts.push({...work.attempts[1]!,id:'addresses-amendment',replyToFeedbackId:'f2'});
  expect(projectLearningEvidence(work).openSteps.map(step=>[step.kind,step.attempt.id])).toEqual([['revise','independent'],['review-pending','b'],['review-pending','addresses-amendment']]);
});
it('uses the authorized snapshot only and returns independent copies without requiring a contiguous event stream',()=>{
  const work=corrected(),before=structuredClone(work),model=projectLearningEvidence(work);
  model.observations[0]!.attempt.answer='external mutation';model.observations[0]!.feedbackHistory[0]!.nextStep='external mutation';
  expect(work).toEqual(before);expect(model.workRevision).toBe(41);expect(model).not.toHaveProperty('notes');
  expect(projectLearningEvidence({...initial,attempts:[],feedback:[]})).toMatchObject({nextStep:null,observations:[],assessment:{status:'not-estimated',reasons:['no-attempts']}});
  expect(()=>projectLearningEvidence({...initial,attempts:[...initial.attempts,...initial.attempts]})).toThrow();
});
