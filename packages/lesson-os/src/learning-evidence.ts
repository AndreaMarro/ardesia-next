import {LearnerWorkSchema,type LearnerWork,type LearnerAttempt,type LearnerFeedback} from '@ardesia/contracts';

export type EvidenceLimit='no-attempts'|'unreviewed-responses'|'feedback-linked-corrections'|'independence-unrecorded'|'no-skill-rubric';
export type EvidenceStep={
  kind:'reread-amendment'|'revise'|'teacher-next'|'review-pending';
  origin:'teacher-feedback'|'workflow';
  attempt:LearnerAttempt;
  feedback:LearnerFeedback|null;
  instruction:string;
  relatedAttemptIds:string[];
};

/** Derived only from an already-authorized work snapshot. Feedback is a statement
 * about one attempt, not a binary skill label. No clock, mastery or storage. */
export function projectLearningEvidence(input:LearnerWork){
  const work=LearnerWorkSchema.parse(input);
  const histories=new Map<string,LearnerFeedback[]>(),feedbackById=new Map<string,LearnerFeedback>();
  const replies=new Map<string,LearnerAttempt[]>();
  for(const feedback of work.feedback??[]){
    const history=histories.get(feedback.attemptId)??[];history.push(feedback);histories.set(feedback.attemptId,history);feedbackById.set(feedback.id,feedback);
  }
  for(const attempt of work.attempts)if(attempt.replyToFeedbackId){
    const values=replies.get(attempt.replyToFeedbackId)??[];values.push(attempt);replies.set(attempt.replyToFeedbackId,values);
  }
  const observations=work.attempts.map(attempt=>{
    const history=histories.get(attempt.id)??[],currentFeedback=history.at(-1)??null;
    const previous=attempt.replyToFeedbackId?feedbackById.get(attempt.replyToFeedbackId)!:null;
    return {attempt,feedbackHistory:history,currentFeedback,
      respondsTo:previous?{attemptId:previous.attemptId,feedbackId:previous.id,isCurrentFeedback:histories.get(previous.attemptId)!.at(-1)!.id===previous.id}:null,
      corrections:history.flatMap(feedback=>(replies.get(feedback.id)??[]).map(reply=>({attemptId:reply.id,feedbackId:feedback.id,addressesCurrentFeedback:feedback.id===currentFeedback!.id})))};
  });
  const openSteps:EvidenceStep[]=[];
  for(const {attempt,currentFeedback:feedback,corrections} of observations){
    if(!feedback){openSteps.push({kind:'review-pending',origin:'workflow',attempt,feedback:null,instruction:'',relatedAttemptIds:[]});continue;}
    if(corrections.some(reply=>reply.addressesCurrentFeedback))continue;
    if(feedback.outcome==='demonstrated'&&!feedback.nextStep)continue;
    if(corrections.length){openSteps.push({kind:'reread-amendment',origin:'workflow',attempt,feedback,instruction:feedback.nextStep,relatedAttemptIds:corrections.map(reply=>reply.attemptId)});continue;}
    if(feedback.outcome!=='demonstrated'||feedback.nextStep){openSteps.push({kind:feedback.outcome==='demonstrated'?'teacher-next':'revise',origin:'teacher-feedback',attempt,feedback,instruction:feedback.nextStep,relatedAttemptIds:[]});}
  }
  const priority={ 'reread-amendment':0,revise:1,'teacher-next':2,'review-pending':3 };
  openSteps.sort((a,b)=>priority[a.kind]-priority[b.kind]); // Stable validated array order; dates are not a proxy for missing history.
  const reasons:EvidenceLimit[]=work.attempts.length?['independence-unrecorded','no-skill-rubric']:['no-attempts'];
  if(observations.some(value=>!value.currentFeedback))reasons.push('unreviewed-responses');
  if(observations.some(value=>value.respondsTo))reasons.push('feedback-linked-corrections');
  return {model:'evidence-only-v1' as const,documentId:work.documentId,studentId:work.studentId,workRevision:work.revision,
    observations,openSteps,nextStep:openSteps[0]??null,assessment:{status:'not-estimated' as const,reasons}};
}
export type LearningEvidence=ReturnType<typeof projectLearningEvidence>;
