import {useEffect, useRef, useState} from 'react';
import type {Actor, EducationalObject, LearnerAttempt, LearnerFeedback, LearnerWork} from '@ardesia/contracts';
import type {CoreService} from '@ardesia/core';
import {projectLearningDiary} from '@ardesia/lesson-os';
import {ObjectContent} from './ObjectContent';

export const feedbackLabels: Record<LearnerFeedback['outcome'], string> = {revise: 'Da rivedere', partial: 'Parzialmente dimostrato', demonstrated: 'Dimostrato in questo tentativo'};
function Feedback({value}: {value: LearnerFeedback}) {
  return <div className="learning-feedback"><strong>{feedbackLabels[value.outcome]}</strong><p className="preserve-lines">{value.comment}</p>
    {value.nextStep && <p className="preserve-lines"><b>Passo successivo</b><br/>{value.nextStep}</p>}
    <small>Docente {value.authorId} · {new Date(value.createdAt).toLocaleString('it-IT')}{value.supersedesFeedbackId ? ' · rettifica' : ''}</small></div>;
}

function AttemptSource({core, actor, work, attempt}: {core: CoreService; actor: Actor; work: LearnerWork; attempt: LearnerAttempt}) {
  const [source, setSource] = useState<{revision: number; object: EducationalObject} | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const epoch = useRef(0);
  useEffect(() => {epoch.current++; setSource(null); setError(''); setLoading(false); return () => {epoch.current++;};},
    [core, actor.actorId, actor.role, work.documentId, work.studentId, work.revision, attempt.id]);
  async function show() {
    const expected = epoch.current; setLoading(true); setError('');
    try {const object = await core.readAttemptSource(actor, work.documentId, attempt.id, work.studentId);
      if (expected === epoch.current) setSource({revision: work.revision, object});
    } catch {if (expected === epoch.current) {setSource(null); setError('Fonte non disponibile. Aggiorna la lezione e verifica l’accesso.');}}
    finally {if (expected === epoch.current) setLoading(false);}
  }
  const visible = source?.revision === work.revision ? source.object : null;
  return <div className="attempt-source">
    <button className="text-button" disabled={loading} onClick={() => visible ? setSource(null) : void show()}>{loading ? 'Lettura della fonte…' : visible ? 'Chiudi fonte del tentativo' : 'Leggi fonte del tentativo'}</button>
    {error && <p role="alert">{error}</p>}
    {visible && <div className="attempt-source-content"><h4>{visible.title}</h4><p>{visible.status === 'draft' ? 'Bozza' : 'Approvato'} · fonte revisione {visible.revision}</p>
      {visible.type === 'lab' ? <><p>Stato storico · {visible.data.pluginId} {visible.data.pluginVersion}. Consultazione senza eseguire il laboratorio.</p><pre>{JSON.stringify(visible.data.state, null, 2)}</pre></> : <ObjectContent object={visible}/>}
    </div>}
  </div>;
}

export function LearningDiary({core, actor, work, onReview, onReply, disabled = false}: {
  core: CoreService; actor: Actor; work: LearnerWork; disabled?: boolean;
  onReview?: (attempt: LearnerAttempt, latest: LearnerFeedback | null) => void;
  onReply?: (attempt: LearnerAttempt, feedback: LearnerFeedback) => void;
}) {
  const diary = projectLearningDiary(work);
  return <section className="learning-diary" aria-label="Diario dei tentativi">
    <header><h2>Riprendi da qui</h2><p>{diary.toRevise} da rivedere · {diary.awaitingReview} in attesa di feedback · {diary.demonstrated} dimostrati</p></header>
    <p className="learning-caption">Ogni valutazione riguarda la risposta e la revisione indicate.</p>
    <ol>{diary.entries.map(({attempt, history, latest, corrections, status}, index) => <li key={attempt.id} data-attempt-id={attempt.id}>
      <header><h3>Tentativo {index + 1}</h3><span>{status === 'awaiting-review' ? 'In attesa di feedback' : status === 'correction-submitted' ? 'Correzione inviata' : latest ? feedbackLabels[latest.outcome] : ''}</span></header>
      <p className="preserve-lines">{attempt.answer}</p><small>Oggetto {attempt.objectId} · fonte revisione {attempt.sourceObjectRevision}{attempt.replyToFeedbackId ? ' · risposta a un feedback' : ''}</small>
      <AttemptSource core={core} actor={actor} work={work} attempt={attempt}/>
      {latest && <Feedback value={latest}/>}
      {history.length > 1 && <details><summary>Valutazioni precedenti ({history.length - 1})</summary>{history.slice(0, -1).map(value => <Feedback key={value.id} value={value}/>)}</details>}
      {!!corrections.length && <p>Correzioni collegate: {corrections.map(id => work.attempts.findIndex(entry => entry.id === id) + 1).join(', ')}</p>}
      {onReview && <button className="secondary-button" disabled={disabled} onClick={() => onReview(attempt, latest)}>{latest ? 'Rettifica feedback' : 'Scrivi feedback'}</button>}
      {onReply && latest && <button className="secondary-button" disabled={disabled} onClick={() => onReply(attempt, latest)}>Riprendi da questo feedback</button>}
    </li>)}</ol>
  </section>;
}
