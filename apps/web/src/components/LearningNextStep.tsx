import {useState} from 'react';
import type {LearnerAttempt,LearnerFeedback} from '@ardesia/contracts';
import type {LearningEvidence,EvidenceLimit} from '@ardesia/lesson-os';

const limits:Record<EvidenceLimit,string>={
  'no-attempts':'Non ci sono ancora tentativi salvati.',
  'unreviewed-responses':'Alcune risposte non hanno ancora ricevuto un feedback.',
  'feedback-linked-corrections':'Le correzioni seguono un feedback: sono distinte dai tentativi iniziali.',
  'independence-unrecorded':'Gli eventuali aiuti usati durante la risposta non sono registrati in campi strutturati.',
  'no-skill-rubric':'Questi giudizi riguardano singoli tentativi; non misurano competenze generali.'
};
export function LearningNextStep({evidence,onShowAttempt,onReply,onReview,disabled}:{
  evidence:LearningEvidence;onShowAttempt:(id:string)=>void;disabled:boolean;
  onReply?:(attempt:LearnerAttempt,feedback:LearnerFeedback)=>void;
  onReview?:(attempt:LearnerAttempt,feedback:LearnerFeedback|null)=>void;
}){
  const [index,setIndex]=useState(0);
  const steps=onReview?evidence.openSteps.filter(step=>step.kind==='review-pending'):evidence.openSteps;
  const selected=Math.min(index,Math.max(steps.length-1,0)),step=steps[selected];
  const number=step?evidence.observations.findIndex(item=>item.attempt.id===step.attempt.id)+1:0;
  return <section className="learning-next-step" aria-label={onReview?'Risposte da rivedere':'Prossimo passo'}>
    <header><h2>{onReview?'Risposte da rivedere':'Prossimo passo'}</h2>{!!steps.length&&<small>{selected+1} di {steps.length}</small>}</header>
    {!step?<p>{onReview?evidence.observations.length?'Ogni tentativo condiviso ha un feedback.':'Non ci sono tentativi condivisi da rivedere.':evidence.observations.length?'Non ci sono indicazioni aperte nei feedback salvati. Puoi rileggere le prove nel diario.':'Salva una spiegazione su un oggetto della lezione per ritrovarla qui.'}</p>:<>
      <strong>{step.kind==='reread-amendment'?'Feedback rettificato dopo la correzione':step.kind==='review-pending'?step.attempt.replyToFeedbackId?'Correzione in attesa di feedback':'Risposta in attesa di feedback':step.kind==='teacher-next'?'Un’indicazione del docente':'Da riprendere'}</strong>
      <p className="learning-caption">Tentativo {number} · fonte revisione {step.attempt.sourceObjectRevision}</p>
      {step.kind==='reread-amendment'&&<p>La correzione resta collegata al feedback precedente. Rileggi la rettifica prima di decidere come proseguire.</p>}
      {step.instruction&&<blockquote><small>Indicazione del docente</small><p className="preserve-lines">{step.instruction}</p></blockquote>}
      <div className="learning-actions"><button className="secondary-button" disabled={disabled} onClick={()=>onShowAttempt(step.attempt.id)}>Vedi la prova</button>
        {onReply&&step.feedback&&step.kind==='revise'&&<button className="primary-button" disabled={disabled} onClick={()=>onReply(step.attempt,step.feedback!)}>Riprendi il feedback</button>}
        {onReview&&<button className="primary-button" disabled={disabled} onClick={()=>onReview(step.attempt,step.feedback)}>Scrivi il feedback</button>}
      </div>
      {steps.length>1&&<nav aria-label="Passi aperti"><button className="text-button" disabled={disabled||selected===0} onClick={()=>setIndex(selected-1)}>Precedente</button><button className="text-button" disabled={disabled||selected===steps.length-1} onClick={()=>setIndex(selected+1)}>Successivo</button></nav>}
    </>}
    <details><summary>Su quali prove si basa</summary><p>Risposte e feedback salvati alla revisione {evidence.workRevision}. Nessuna competenza viene stimata automaticamente.</p><ul>{evidence.assessment.reasons.map(reason=><li key={reason}>{limits[reason]}</li>)}</ul></details>
  </section>;
}
