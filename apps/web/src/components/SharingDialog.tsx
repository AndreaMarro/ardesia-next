import {useState} from 'react';
import type {CoreService} from '@ardesia/core';
import type {Actor, LearnerWork, LessonDocument} from '@ardesia/contracts';
import {Dialog} from './Dialog';

export function SharingDialog({core, actor, document, onClose}: {core: CoreService; actor: Actor; document: LessonDocument; onClose: () => void}) {
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
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
  return <Dialog title="Assegna la lezione" onClose={onClose}>
    <p className="dialog-intro">Assegna questa bozza a uno studente. Vedrai solo le evidenze che condivide.</p>
    <form className="new-lesson-form" onSubmit={event => {event.preventDefault(); void assign(studentId.trim(), false);}}>
      <label>Identificativo studente<input aria-label="Identificativo studente" value={studentId} onChange={event => setStudentId(event.target.value)} required maxLength={200}/></label>
      <button className="primary-button" disabled={busy}>Assegna lezione</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <div className="assignment-list">{assignments.map(assignment => {const work = sharedWork(assignment.studentId); return <section key={assignment.studentId}>
      <h3>{assignment.studentId}</h3><p>{assignment.status === 'active' ? 'Accesso attivo' : 'Accesso revocato'} · revisione {assignment.revision}</p>
      {assignment.status === 'active' && <button className="secondary-button" disabled={busy} onClick={() => void assign(assignment.studentId, true)}>Revoca accesso a {assignment.studentId}</button>}
      {work ? <details><summary>Evidenze condivise · revisione {work.revision}</summary><p className="preserve-lines">{work.notes || 'Nessuna nota condivisa.'}</p>
        {work.labs.map(lab => <p key={lab.objectId}>Laboratorio <code>{lab.objectId}</code> · revisione {lab.revision}: <code>{JSON.stringify(lab.data.state.value)}</code></p>)}
        {work.attempts.map(attempt => <p key={attempt.id}>Tentativo: {attempt.answer}</p>)}
      </details> : <p>Nessuna evidenza condivisa disponibile.</p>}
    </section>;})}</div>
  </Dialog>;
}
