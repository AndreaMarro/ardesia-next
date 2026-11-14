import {useEffect, useRef, useState} from 'react';
import type {Actor, EducationalObject, LearnerAttempt, LearnerFeedback, LearnerWork} from '@ardesia/contracts';
import type {CoreService} from '@ardesia/core';
import {projectLearningDiary} from '@ardesia/lesson-os';
import {ObjectContent} from './ObjectContent';
import {LearningNextStep} from './LearningNextStep';

export const feedbackLabels: Record<LearnerFeedback['outcome'], string> = {revise: 'Da rivedere', partial: 'Parzialmente dimostrato', demonstrated: 'Dimostrato in questo tentativo'};
function Feedback({value}: {value: LearnerFeedback}) {
  return <div className="learning-feedback"><strong>{feedbackLabels[value.outcome]}</strong><p className="preserve-lines">{value.comment}</p>
    {value.nextStep && <p className="preserve-lines"><b>Passo successivo</b><br/>{value.nextStep}</p>}
    <small>Docente {value.authorId} · {new Date(value.createdAt).toLocaleString('it-IT')}{value.supersedesFeedbackId ? ' · rettifica' : ''}</small></div>;
}

function AttemptSource({core, actor, work, attempt}: {core: CoreService; actor: Actor; work: LearnerWork; attempt: LearnerAttempt}) {
  const scope = JSON.stringify([actor.actorId, actor.role, work.documentId, work.studentId, work.revision, attempt.id, attempt.sourceObjectRevision]);
  const [source, setSource] = useState<{core: CoreService; scope: string; object: EducationalObject} | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const epoch = useRef(0);
  useEffect(() => {epoch.current++; setSource(null); setError(''); setLoading(false); return () => {epoch.current++;};},
    [core, actor.actorId, actor.role, work.documentId, work.studentId, work.revision, attempt.id]);
  async function show() {
    const expected = epoch.current; setLoading(true); setError('');
    try {const object = await core.readAttemptSource(actor, work.documentId, attempt.id, work.studentId);
      if (expected === epoch.current) setSource({core, scope, object});
    } catch {if (expected === epoch.current) {setSource(null); setError('Fonte non disponibile. Aggiorna la lezione e verifica l’accesso.');}}
    finally {if (expected === epoch.current) setLoading(false);}
  }
  // Synchronous scope check: a passive-effect reset alone can briefly show a
  // previous lesson when two authorized works reuse an attempt ID/revision.
  const visible = source?.core === core && source.scope === scope ? source.object : null;
  return <div className="attempt-source">
    <button className="text-button" disabled={loading} onClick={() => visible ? setSource(null) : void show()}>{loading ? 'Lettura della fonte…' : visible ? 'Chiudi fonte del tentativo' : 'Leggi fonte del tentativo'}</button>
    {error && <p role="alert">{error}</p>}
    {visible && <div className="attempt-source-content"><h4>{visible.title}</h4><p>{visible.status === 'draft' ? 'Bozza' : 'Approvato'} · fonte revisione {visible.revision}</p>
      {visible.type === 'lab' ? <><p>Stato storico · {visible.data.pluginId} {visible.data.pluginVersion}. Consultazione senza eseguire il laboratorio.</p><pre>{JSON.stringify(visible.data.state, null, 2)}</pre></> : <ObjectContent object={visible}/>}
    </div>}
  </div>;
}

export function LearningDiary({core, actor, work, onReview, onReply, disabled = false,collapsible=false}: {
  core: CoreService; actor: Actor; work: LearnerWork; disabled?: boolean;collapsible?:boolean;
  onReview?: (attempt: LearnerAttempt, latest: LearnerFeedback | null) => void;
  onReply?: (attempt: LearnerAttempt, feedback: LearnerFeedback) => void;
}) {
  const diary = projectLearningDiary(work);
  const container=useRef<HTMLDivElement>(null),details=useRef<HTMLDetailsElement>(null);
  function showAttempt(id:string){
    if(details.current)details.current.open=true;
    const item=[...(container.current?.querySelectorAll<HTMLElement>('[data-attempt-id]')??[])].find(element=>element.dataset.attemptId===id);
    item?.focus();item?.scrollIntoView({block:'center',behavior:'smooth'});
  }
  const entries=<section className="learning-diary" aria-label="Diario dei tentativi">
    <header><h2>Riprendi da qui</h2><p>{diary.toRevise} da rivedere · {diary.awaitingReview} in attesa di feedback · {diary.demonstrated} dimostrati</p></header>
    <p className="learning-caption">Ogni valutazione riguarda la risposta e la revisione indicate.</p>
    <ol>{diary.entries.map(({attempt, history, latest, allCorrections, respondsTo, status}, index) => <li key={attempt.id} data-attempt-id={attempt.id} tabIndex={-1}>
      <header><h3>Tentativo {index + 1}</h3><span>{status === 'awaiting-review' ? 'In attesa di feedback' : status === 'correction-submitted' ? 'Correzione inviata' : latest ? feedbackLabels[latest.outcome] : ''}</span></header>
      <p className="preserve-lines">{attempt.answer}</p><small>Oggetto {attempt.objectId} · fonte revisione {attempt.sourceObjectRevision}{attempt.replyToFeedbackId ? ' · risposta a un feedback' : ''}</small>
      {respondsTo && <div className="correction-context"><button className="text-button" disabled={disabled} onClick={()=>showAttempt(respondsTo.attemptId)}>Vedi il tentativo di origine ({work.attempts.findIndex(entry=>entry.id===respondsTo.attemptId)+1})</button>
        {!respondsTo.isCurrentFeedback && <p>Questa correzione risponde a un feedback poi rettificato.</p>}
        <details><summary>Feedback a cui risponde</summary><Feedback value={work.feedback!.find(value=>value.id===respondsTo.feedbackId)!}/></details>
      </div>}
      <AttemptSource core={core} actor={actor} work={work} attempt={attempt}/>
      {latest && <Feedback value={latest}/>}
      {history.length > 1 && <details><summary>Valutazioni precedenti ({history.length - 1})</summary>{history.slice(0, -1).map(value => <Feedback key={value.id} value={value}/>)}</details>}
      {!!allCorrections.length && <div className="learning-corrections"><p>Correzioni collegate</p>{allCorrections.map(correction=><button className="text-button" key={correction.attemptId} disabled={disabled} onClick={()=>showAttempt(correction.attemptId)}>Vedi correzione {work.attempts.findIndex(entry=>entry.id===correction.attemptId)+1}{correction.addressesCurrentFeedback?'':' · feedback precedente'}</button>)}</div>}
      {onReview && <button className="secondary-button" disabled={disabled} onClick={() => onReview(attempt, latest)}>{latest ? 'Rettifica feedback' : 'Scrivi feedback'}</button>}
      {onReply && latest && <button className="secondary-button" disabled={disabled} onClick={() => onReply(attempt, latest)}>Riprendi da questo feedback</button>}
    </li>)}</ol>
  </section>;
  return <div ref={container}><LearningNextStep key={work.documentId+':'+work.studentId+':'+work.revision} evidence={diary.evidence} onShowAttempt={showAttempt} disabled={disabled} onReply={onReply} onReview={onReview}/>
    {collapsible?<details ref={details}><summary>Tentativi salvati ({work.attempts.length})</summary>{entries}</details>:entries}</div>;
}
