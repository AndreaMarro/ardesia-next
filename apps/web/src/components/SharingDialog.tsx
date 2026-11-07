import {useEffect, useRef, useState} from 'react';
import type {CoreService} from '@ardesia/core';
import type {Actor, LearnerFeedback, LearnerWork, LessonDocument} from '@ardesia/contracts';
import {Dialog} from './Dialog';
import {LearningDiary, feedbackLabels} from './LearningDiary';

function FeedbackEditor({core, actor, work, attemptId, onDone, onDirty}: {core: CoreService; actor: Actor; work: LearnerWork;
  attemptId: string; onDone: () => void; onDirty: (dirty: boolean) => void}) {
  const latest = work.feedback?.filter(entry => entry.attemptId === attemptId).at(-1);
  const [base, setBase] = useState({revision: work.revision, feedbackId: latest?.id});
  const [outcome, setOutcome] = useState<LearnerFeedback['outcome']>(latest?.outcome ?? 'revise');
  const [comment, setComment] = useState(latest?.comment ?? ''), [nextStep, setNextStep] = useState(latest?.nextStep ?? '');
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const conflict = base.revision !== work.revision;
  const live = useRef(true);
  useEffect(() => {live.current = true; return () => {live.current = false;};}, []);
  useEffect(() => {onDirty(dirty || busy); return () => onDirty(false);}, [dirty, busy, onDirty]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const guard = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, busy]);
  async function save() {
    setBusy(true); setError('');
    try {
      await core.executeLearning(actor, {kind: 'review-learner-attempt', commandId: crypto.randomUUID(), documentId: work.documentId,
        studentId: work.studentId, expectedRevision: base.revision, attemptId, feedbackId: crypto.randomUUID(),
        outcome, comment, nextStep, ...(base.feedbackId ? {supersedesFeedbackId: base.feedbackId} : {})});
      if (live.current) {onDirty(false); onDone();}
    } catch (reason) {if (live.current) setError(reason instanceof Error ? reason.message : 'Feedback non confermato.');}
    finally {if (live.current) setBusy(false);}
  }
  return <form className="feedback-editor" aria-label="Feedback docente" onSubmit={event => {event.preventDefault(); void save();}}>
    <h3>{base.feedbackId ? 'Rettifica della valutazione' : 'Feedback sul tentativo'}</h3>
    <p>Risposta originale e valutazioni precedenti restano conservate.</p>
    <label>Esito del tentativo<select aria-label="Esito del tentativo" disabled={busy} value={outcome} onChange={event => {setOutcome(event.target.value as LearnerFeedback['outcome']); setDirty(true);}}>
      {Object.entries(feedbackLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Commento docente<textarea aria-label="Commento docente" disabled={busy} value={comment} required maxLength={10000} rows={4} onChange={event => {setComment(event.target.value); setDirty(true);}}/></label>
    <label>Passo successivo<textarea aria-label="Passo successivo" disabled={busy} value={nextStep} required={outcome !== 'demonstrated'} maxLength={4000} rows={3} onChange={event => {setNextStep(event.target.value); setDirty(true);}}/></label>
    {conflict && <div role="alert"><p>Il lavoro condiviso è cambiato. Rileggi le evidenze prima di inviare la bozza.</p><button type="button" className="secondary-button" disabled={busy}
      onClick={() => setBase({revision: work.revision, feedbackId: latest?.id})}>Ho riletto le evidenze aggiornate</button></div>}
    {error && <p role="alert">{error}</p>}
    <div className="learning-actions"><button className="primary-button" disabled={busy || conflict || !comment.trim() || outcome !== 'demonstrated' && !nextStep.trim()}>Salva feedback</button>
      <button type="button" className="text-button" disabled={busy} onClick={() => {onDirty(false); onDone();}}>Scarta bozza feedback</button></div>
  </form>;
}

export function SharingDialog({core, actor, document, onClose}: {core: CoreService; actor: Actor; document: LessonDocument; onClose: () => void}) {
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<{studentId: string; attemptId: string} | null>(null);
  const [dirty, setDirty] = useState(false);
  const [, update] = useState(0);
  const assignments = core.listAssignments(actor).filter(item => item.documentId === document.id);
  async function assign(id: string, revoke: boolean) {
    setBusy(true); setError('');
    try {
      await core.executeLearning(actor, {kind: revoke ? 'revoke-assignment' : 'assign-lesson', commandId: crypto.randomUUID(),
        documentId: document.id, studentId: id, expectedRevision: assignments.find(item => item.studentId === id)?.revision ?? 0});
      setStudentId(''); update(n => n + 1);
    } catch (reason) {setError(reason instanceof Error ? reason.message : 'Assegnazione non confermata.');}
    finally {setBusy(false);}
  }
  function sharedWork(id: string): LearnerWork | null {try {return core.getLearnerWork(actor, document.id, id);} catch {return null;}}
  const reviewAvailable = review && sharedWork(review.studentId)?.attempts.some(attempt => attempt.id === review.attemptId);
  useEffect(() => {if (review && !reviewAvailable) {setReview(null); setDirty(false);}}, [review, reviewAvailable]);
  function close() {if (busy || dirty) {setError('Salva o scarta la bozza feedback prima di chiudere.'); return;} onClose();}
  return <Dialog title="Assegna la lezione" onClose={close}>
    <p className="dialog-intro">Assegna questa bozza a uno studente. Vedrai solo le evidenze che condivide.</p>
    <form className="new-lesson-form" onSubmit={event => {event.preventDefault(); void assign(studentId.trim(), false);}}>
      <label>Identificativo studente<input aria-label="Identificativo studente" value={studentId} onChange={event => setStudentId(event.target.value)} required maxLength={200}/></label>
      <button className="primary-button" disabled={busy || dirty}>Assegna lezione</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <div className="assignment-list">{assignments.map(assignment => {const work = sharedWork(assignment.studentId); return <section key={assignment.studentId}>
      <h3>{assignment.studentId}</h3><p>{assignment.status === 'active' ? 'Accesso attivo' : 'Accesso revocato'} · revisione {assignment.revision}</p>
      {assignment.status === 'active' && <button className="secondary-button" disabled={busy || dirty} onClick={() => void assign(assignment.studentId, true)}>Revoca accesso a {assignment.studentId}</button>}
      {work ? <details><summary>Evidenze condivise · revisione {work.revision}</summary><p className="preserve-lines">{work.notes || 'Nessuna nota condivisa.'}</p>
        {work.labs.map(lab => <p key={lab.objectId}>Laboratorio <code>{lab.objectId}</code> · revisione {lab.revision}: <code>{JSON.stringify(lab.data.state.value)}</code></p>)}
        {!!work.attempts.length && <LearningDiary core={core} actor={actor} work={work} disabled={busy || dirty} onReview={attempt => {
          setReview({studentId: work.studentId, attemptId: attempt.id}); setError('');
        }}/>}
        {review?.studentId === work.studentId && work.attempts.some(attempt => attempt.id === review.attemptId) && <FeedbackEditor key={work.studentId + ':' + review.attemptId}
          core={core} actor={actor} work={work} attemptId={review.attemptId} onDirty={setDirty} onDone={() => {setReview(null); update(n => n + 1);}}/>}
      </details> : <p>Nessuna evidenza condivisa disponibile.</p>}
    </section>;})}</div>
  </Dialog>;
}
