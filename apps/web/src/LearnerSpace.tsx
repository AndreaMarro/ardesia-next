import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {HandoutView} from './handout/HandoutDialog';
import {prepareHandout} from './handout/prepare';
import type {Handout} from '@ardesia/lesson-os';
import type {EducationalObject, LearningCommand} from '@ardesia/contracts';
import type {RemoteClient} from '@ardesia/remote-client';
import {LearningDiary} from './components/LearningDiary';
import {DocumentView} from './components/DocumentView';
import {LabInspector} from './components/LabInspector';
import {connectMarketplace, disconnectMarketplace, syncMarketplace, firstPartyLabName} from './plugins/first-party';
import {assertDraftUnchanged, draftConflictMessage, learnerObject, type SaveObject} from './workspace';

export function LearnerSpace({client, onAccount, onCourses}: {client: RemoteClient; onAccount: () => void; onCourses?: () => void}) {
  const projection = client.projection!, actor = projection.actor, core = client.core;
  const [documentId, setDocumentId] = useState(projection.assignedDocuments[0]?.id ?? '');
  const [handout,setHandout]=useState<Handout|null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [baseNotes, setBaseNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [answer, setAnswer] = useState('');
  const [answerBase, setAnswerBase] = useState<EducationalObject | null>(null);
  const [replyToFeedbackId, setReplyToFeedbackId] = useState<string | null>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [labDirty, setLabDirty] = useState(false);
  const [readConsent, setReadConsent] = useState(false), [writeConsent, setWriteConsent] = useState(false);
  const document = projection.assignedDocuments.find(item => item.id === documentId);
  const work = projection.learnerWork.find(item => item.documentId === documentId);
  const viewed = document && {...document, objects: document.objects.map(object => learnerObject(object, work))};
  const selected = viewed?.objects.find(object => object.id === selectedId);
  const access = projection.labAccess.find(item => item.documentId === documentId && item.objectId === selectedId);
  useEffect(() => {
    if (!document) return;
    connectMarketplace(core, actor, {documentId, refresh: client.refresh});
    return disconnectMarketplace;
  }, [core, actor.actorId, documentId, client, !!document]);
  useEffect(() => {syncMarketplace();}, [projection.workspaceRevision]);
  function restoreNotes(confirmed = work?.notes ?? '') {setNotes(confirmed); setBaseNotes(confirmed); setNotesDirty(false);}
  useLayoutEffect(() => {if (!notesDirty) restoreNotes();}, [work?.notes, documentId]);
  useEffect(() => {setReadConsent(false); setWriteConsent(false);}, [selectedId, access?.consented, access?.release?.bundleDigest, access?.status]);
  async function run(command: Omit<LearningCommand, 'commandId' | 'documentId' | 'expectedRevision'> & Record<string, unknown>, guard?: () => void): Promise<boolean> {
    setBusy(true); setError('');
    try {
      guard?.();
      await core.executeLearning(actor, {...command, commandId: crypto.randomUUID(), documentId,
        expectedRevision: core.getLearnerWork(actor, documentId)?.revision ?? 0} as LearningCommand);
      syncMarketplace(); return true;
    } catch (reason) {setError(reason instanceof Error ? reason.message : 'Il lavoro non è stato confermato.'); return false;}
    finally {setBusy(false);}
  }
  function canLeave() {
    if (!busy && !notesDirty && !labDirty && !answer.trim() && !replyToFeedbackId) return true;
    setError('Salva o ripristina il lavoro aperto prima di uscire.'); return false;
  }
  function confirmedObject(id: string) {
    const object = core.getAssignedDocument(actor, documentId).objects.find(item => item.id === id);
    return object && learnerObject(object, core.getLearnerWork(actor, documentId));
  }
  const saveLab: SaveObject = async (object, base) => {
    if (object.type !== 'lab' || !document) return null;
    const saved = await run({kind: 'save-learner-lab', expectedDocumentRevision: core.getAssignedDocument(actor, documentId).revision,
      objectId: object.id, instanceId: object.data.instanceId, state: object.data.state}, () => assertDraftUnchanged(base, confirmedObject(object.id)));
    return saved ? confirmedObject(object.id) ?? null : null;
  };
  const answerSource = document?.objects.find(object => object.id === selectedId);
  const answerSourceConflict = !!answerBase && (answerBase.id !== answerSource?.id || answerBase.revision !== answerSource.revision);
  const reply = work?.feedback?.find(entry => entry.id === replyToFeedbackId);
  const replyAttempt = work?.attempts.find(entry => entry.id === reply?.attemptId);
  const currentReply = work?.feedback?.filter(entry => entry.attemptId === reply?.attemptId).at(-1);
  const replyStale = !!replyToFeedbackId && (!reply || work?.feedback?.filter(entry => entry.attemptId === reply.attemptId).at(-1)?.id !== reply.id);
  useEffect(() => {
    if (!notesDirty && !labDirty && !answer.trim() && !busy) return;
    const guard = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [notesDirty, labDirty, answer, busy]);
  const notesConflict = notesDirty && baseNotes !== (work?.notes ?? '');
  return <div className="learner-shell">
    <header className="learner-header"><a className="wordmark" href="#" onClick={event => event.preventDefault()}>Ardesia<span>.</span></a><p>Area studente · {client.account?.displayName}</p>{onCourses && <button className="secondary-button" onClick={() => {if(canLeave()) onCourses();}}>Apri corsi</button>}<button className="secondary-button" onClick={() => {if (canLeave()) onAccount();}}>Account e spazi</button></header>
    <main className="learner-main">
      <nav aria-label="Lezioni assegnate">{projection.assignedDocuments.map(item => <button className="secondary-button" key={item.id} aria-pressed={item.id === documentId} onClick={() => {
        if (!canLeave()) return;
        setDocumentId(item.id); setSelectedId(null); setAnswerBase(null);
      }}>{item.title}</button>)}</nav>
      {!document ? <p>Nessuna lezione assegnata. Aggiorna dopo l’assegnazione.</p> : <>
        <header><h1>{document.title}</h1><p>Bozza assegnata · lezione revisione {document.revision} · lavoro personale revisione {work?.revision ?? 0}</p><button className="secondary-button" disabled={busy} onClick={()=>setHandout(prepareHandout(document))}>Dispensa</button></header>
        {handout && handout.document.id===document.id && handout.document.revision===document.revision && <HandoutView handout={handout} onClose={()=>setHandout(null)} notice="La dispensa contiene la lezione assegnata. Note personali, tentativi, feedback e stati personali dei laboratori restano nel tuo spazio."/>}
        {error && <p role="alert" className="error-banner">{error}</p>}
        <div className="learner-content" data-document-id={document.id} data-work-revision={work?.revision ?? 0}>
          <div><DocumentView document={viewed!} mode="notebook" onSelect={id => {if (id === selectedId) return; if ((labDirty || !!answer.trim() && !!answerBase || !!replyToFeedbackId || busy) && selectedId !== id) {setError('Salva o scarta il lavoro aperto prima di cambiare oggetto.'); return;} setSelectedId(id); setAnswerBase(answer.trim() ? document.objects.find(object => object.id === id) ?? null : null);}}/>
            <section className="learner-notes"><h2>Il mio lavoro</h2><p>Note, tentativi e stati sono privati finché non scegli di condividerli.</p>
              <label>Note personali<textarea disabled={busy} aria-label="Note personali" rows={6} value={notes} onChange={event => {setNotes(event.target.value); setNotesDirty(true);}} maxLength={100000}/></label>
              {notesConflict && <p role="alert" className="error-banner">{draftConflictMessage}</p>}
              <button className="primary-button" disabled={busy || !notesDirty || notesConflict} onClick={async () => {
                if (await run({kind: 'save-learner-note', text: notes}, () => assertDraftUnchanged(baseNotes, core.getLearnerWork(actor, documentId)?.notes ?? '')))
                  restoreNotes(core.getLearnerWork(actor, documentId)?.notes ?? '');
              }}>Salva note personali</button>
              {notesDirty && <button className="text-button" disabled={busy} onClick={() => restoreNotes()}>Ripristina note salvate</button>}
              {reply && <div className="correction-context"><strong>Correzione del tentativo {work!.attempts.findIndex(entry => entry.id === reply.attemptId) + 1}</strong><p>{reply.comment}</p><p>{reply.nextStep}</p>
                {replyAttempt && document.objects.find(entry => entry.id === replyAttempt.objectId)?.revision !== replyAttempt.sourceObjectRevision && <p>La fonte è cambiata: questa risposta userà la revisione attuale, conservando quella del tentativo precedente.</p>}</div>}
              {replyStale && <p role="alert">Il feedback è stato rettificato. Conserva la tua risposta e rileggi il diario prima di collegarla al nuovo feedback.</p>}
              {answerSourceConflict && <div role="alert"><p>La fonte è cambiata durante la stesura. La risposta è conservata: rileggi l’oggetto prima di salvarla.</p>{answerSource && <button className="secondary-button" disabled={busy} onClick={() => setAnswerBase(answerSource)}>Ho riletto la fonte attuale</button>}</div>}
              <label>Un tentativo o una spiegazione<textarea ref={answerRef} disabled={busy} aria-label="Risposta del tentativo" rows={3} value={answer} onChange={event => {if (!answerBase && answerSource) setAnswerBase(answerSource); setAnswer(event.target.value);}} maxLength={10000}/></label>
              <button className="secondary-button" disabled={busy || !answer.trim() || !selected || replyStale || answerSourceConflict} onClick={async () => {if (selected && await run({kind: 'record-learner-attempt', expectedDocumentRevision: document.revision,
                objectId: selected.id, attemptId: crypto.randomUUID(), answer: answer.trim(), ...(replyToFeedbackId ? {replyToFeedbackId} : {})}, () => assertDraftUnchanged(answerBase ?? answerSource, core.getAssignedDocument(actor, documentId).objects.find(object => object.id === selected.id)))) {setAnswer(''); setReplyToFeedbackId(null); setAnswerBase(null);}}}>Salva tentativo sull’oggetto selezionato</button>
              {(!!answer.trim() || replyToFeedbackId) && <button className="text-button" disabled={busy} onClick={() => {setAnswer(''); setReplyToFeedbackId(null); setAnswerBase(null);}}>Scarta bozza del tentativo</button>}
              {replyStale && currentReply && <button className="secondary-button" disabled={busy} onClick={() => setReplyToFeedbackId(currentReply.id)}>Ho riletto il feedback aggiornato</button>}
              {replyStale && <button className="secondary-button" disabled={busy} onClick={() => setReplyToFeedbackId(null)}>Scollega il feedback mantenendo la risposta</button>}
              {!!work?.attempts.length && <LearningDiary collapsible core={core} actor={actor} work={work} disabled={busy} onReply={(attempt, feedback) => {
                if (answer.trim() || labDirty) {setError('Salva o scarta la bozza aperta prima di riprendere un feedback.'); return;}
                if (!document.objects.some(object => object.id === attempt.objectId)) {setError('L’oggetto non è più nella lezione. La fonte del tentativo resta consultabile.'); return;}
                setReplyToFeedbackId(feedback.id); setSelectedId(attempt.objectId); setAnswerBase(document.objects.find(object => object.id === attempt.objectId)!); setError(''); answerRef.current?.focus(); answerRef.current?.scrollIntoView({block: 'center', behavior: 'smooth'});
              }}/>}
              <label className="consent-option"><input type="checkbox" checked={work?.evidenceShared ?? false} disabled={busy} onChange={event => void run({kind: 'share-learner-evidence', shared: event.target.checked})}/>Condividi con il docente note, tentativi e stati salvati</label>
              <p>{work?.evidenceShared ? 'Il docente vede il lavoro salvato finché condividi.' : 'Il docente non può leggere il tuo lavoro personale.'}</p>
            </section>
          </div>
          {selected?.type === 'lab' && <section className="learner-lab">
            {access?.status === 'active' && !access.consented && !labDirty ? <div className="learner-consent"><h2>Autorizza questo laboratorio</h2><p>{firstPartyLabName(selected.data.pluginId)} · versione {access.release?.version}. Consenso valido solo per questa release e istanza.</p>
              <label className="consent-option"><input type="checkbox" checked={readConsent} onChange={event => setReadConsent(event.target.checked)}/>Leggere il mio stato scientifico</label>
              <label className="consent-option"><input type="checkbox" checked={writeConsent} onChange={event => setWriteConsent(event.target.checked)}/>Modificare e salvare i parametri</label>
              <button className="primary-button" disabled={!readConsent || !writeConsent || busy} onClick={() => void run({kind: 'consent-lab', objectId: selected.id,
                releaseDigest: access.release!.bundleDigest, capabilities: ['state:read', 'state:write']})}>Autorizza laboratorio</button>
            </div> : (access?.status === 'active' && access.consented) || labDirty ? <>
              <LabInspector key={selected.id} object={selected} titleEditable={false} onClose={() => {if (labDirty || answer.trim() || replyToFeedbackId || busy) {setError('Salva o scarta il lavoro aperto prima di chiudere le proprietà.'); return;} setSelectedId(null);}} onDirtyChange={setLabDirty} onSave={saveLab}/>
              <button className="secondary-button" disabled={busy || access?.status !== 'active' || !access.consented} onClick={() => void run({kind: 'revoke-lab-consent', objectId: selected.id})}>Revoca consenso laboratorio</button>
            </> : <p>Laboratorio disattivato o non autorizzato. Lo stato salvato è conservato.</p>}
          </section>}
        </div>
      </>}
    </main>
  </div>;
}
