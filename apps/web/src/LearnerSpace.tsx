import {useEffect, useLayoutEffect, useState} from 'react';
import type {LearningCommand} from '@ardesia/contracts';
import type {RemoteClient} from '@ardesia/remote-client';
import {DocumentView} from './components/DocumentView';
import {LabInspector} from './components/LabInspector';
import {connectMarketplace, disconnectMarketplace, syncMarketplace} from './plugins/first-party';
import {assertDraftUnchanged, draftConflictMessage, learnerObject, type SaveObject} from './workspace';

export function LearnerSpace({client, onAccount}: {client: RemoteClient; onAccount: () => void}) {
  const projection = client.projection!, actor = projection.actor, core = client.core;
  const [documentId, setDocumentId] = useState(projection.assignedDocuments[0]?.id ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [baseNotes, setBaseNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [answer, setAnswer] = useState('');
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
    connectMarketplace(core, actor, {documentId, refresh: () => client.refresh()});
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
    if (!notesDirty && !labDirty && !answer.trim()) return true;
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
  const notesConflict = notesDirty && baseNotes !== (work?.notes ?? '');
  return <div className="learner-shell">
    <header className="learner-header"><a className="wordmark" href="#" onClick={event => event.preventDefault()}>Ardesia<span>.</span></a><p>Area studente · {client.account?.displayName}</p><button className="secondary-button" onClick={() => {if (canLeave()) onAccount();}}>Account e spazi</button></header>
    <main className="learner-main">
      <nav aria-label="Lezioni assegnate">{projection.assignedDocuments.map(item => <button className="secondary-button" key={item.id} aria-pressed={item.id === documentId} onClick={() => {
        if (!canLeave()) return;
        setDocumentId(item.id); setSelectedId(null);
      }}>{item.title}</button>)}</nav>
      {!document ? <p>Nessuna lezione assegnata. Aggiorna dopo l’assegnazione.</p> : <>
        <header><h1>{document.title}</h1><p>Bozza assegnata · lezione revisione {document.revision} · lavoro personale revisione {work?.revision ?? 0}</p></header>
        {error && <p role="alert" className="error-banner">{error}</p>}
        <div className="learner-content" data-document-id={document.id} data-work-revision={work?.revision ?? 0}>
          <div><DocumentView document={viewed!} mode="notebook" onSelect={id => {if (labDirty && selectedId !== id) {setError('Salva o ripristina i parametri prima di cambiare oggetto.'); return;} setSelectedId(id);}}/>
            <section className="learner-notes"><h2>Il mio lavoro</h2><p>Note, tentativi e stati sono privati finché non scegli di condividerli.</p>
              <label>Note personali<textarea disabled={busy} aria-label="Note personali" rows={6} value={notes} onChange={event => {setNotes(event.target.value); setNotesDirty(true);}} maxLength={100000}/></label>
              {notesConflict && <p role="alert" className="error-banner">{draftConflictMessage}</p>}
              <button className="primary-button" disabled={busy || !notesDirty || notesConflict} onClick={async () => {
                if (await run({kind: 'save-learner-note', text: notes}, () => assertDraftUnchanged(baseNotes, core.getLearnerWork(actor, documentId)?.notes ?? '')))
                  restoreNotes(core.getLearnerWork(actor, documentId)?.notes ?? '');
              }}>Salva note personali</button>
              {notesDirty && <button className="text-button" disabled={busy} onClick={() => restoreNotes()}>Ripristina note salvate</button>}
              <label>Un tentativo o una spiegazione<textarea disabled={busy} aria-label="Risposta del tentativo" rows={3} value={answer} onChange={event => setAnswer(event.target.value)} maxLength={10000}/></label>
              <button className="secondary-button" disabled={busy || !answer.trim() || !selected} onClick={async () => {if (selected && await run({kind: 'record-learner-attempt', expectedDocumentRevision: document.revision,
                objectId: selected.id, attemptId: crypto.randomUUID(), answer: answer.trim()})) setAnswer('');}}>Salva tentativo sull’oggetto selezionato</button>
              {!!work?.attempts.length && <details><summary>Tentativi salvati ({work.attempts.length})</summary><ol>{work.attempts.map(attempt => <li key={attempt.id}><p className="preserve-lines">{attempt.answer}</p></li>)}</ol></details>}
              <label className="consent-option"><input type="checkbox" checked={work?.evidenceShared ?? false} disabled={busy} onChange={event => void run({kind: 'share-learner-evidence', shared: event.target.checked})}/>Condividi con il docente note, tentativi e stati salvati</label>
              <p>{work?.evidenceShared ? 'Il docente vede il lavoro salvato finché condividi.' : 'Il docente non può leggere il tuo lavoro personale.'}</p>
            </section>
          </div>
          {selected?.type === 'lab' && <section className="learner-lab">
            {access?.status === 'active' && !access.consented && !labDirty ? <div className="learner-consent"><h2>Autorizza questo laboratorio</h2><p>Molla ideale · versione {access.release?.version}. Consenso valido solo per questa release e istanza.</p>
              <label className="consent-option"><input type="checkbox" checked={readConsent} onChange={event => setReadConsent(event.target.checked)}/>Leggere il mio stato scientifico</label>
              <label className="consent-option"><input type="checkbox" checked={writeConsent} onChange={event => setWriteConsent(event.target.checked)}/>Modificare e salvare i parametri</label>
              <button className="primary-button" disabled={!readConsent || !writeConsent || busy} onClick={() => void run({kind: 'consent-lab', objectId: selected.id,
                releaseDigest: access.release!.bundleDigest, capabilities: ['state:read', 'state:write']})}>Autorizza laboratorio</button>
            </div> : (access?.status === 'active' && access.consented) || labDirty ? <>
              <LabInspector key={selected.id} object={selected} titleEditable={false} onClose={() => {if (!labDirty) setSelectedId(null);}} onDirtyChange={setLabDirty} onSave={saveLab}/>
              <button className="secondary-button" disabled={busy || access?.status !== 'active' || !access.consented} onClick={() => void run({kind: 'revoke-lab-consent', objectId: selected.id})}>Revoca consenso laboratorio</button>
            </> : <p>Laboratorio disattivato o non autorizzato. Lo stato salvato è conservato.</p>}
          </section>}
        </div>
      </>}
    </main>
  </div>;
}
