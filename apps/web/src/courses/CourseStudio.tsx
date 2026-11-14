import type {EducationalObject} from '@ardesia/contracts';
import {CourseMaterials,courseQuestion} from './physics/CourseMaterials';
import {MaterialProvider} from '../materials/MaterialView';
import {lazy,Suspense,useEffect, useRef, useState} from 'react';
import {ownsWorkspace,canonicalJson, CourseInputSchema, type Course, type CourseCommand, type CourseInput, type LessonDocument} from '@ardesia/contracts';
import type {RemoteClient} from '@ardesia/remote-client';
import {Dialog} from '../components/Dialog';
import {ObjectContent} from '../components/ObjectContent';
import {ArrowUpRight, LibraryBig, Plus, Save, Share2, Trash2} from '../components/Icons';
import {blankUnit, springCourse, phaseLabels, helpLabels} from './content';
import './courses.css';

const PhysicsCatalog=lazy(()=>import('./physics/PhysicsCatalog'));
type Draft = {id: string; revision: number; input: CourseInput; original: string};
type Stage = keyof typeof phaseLabels;
const inputOf = (course: Course): CourseInput => ({title: course.title, description: course.description, license: course.license,
  units: course.units.map(({revision: _revision, ...unit}) => unit)});
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type: 'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export function CourseStudio({client, onClose}: {client: RemoteClient; onClose: () => void}) {
  const canAuthor = ownsWorkspace(client.projection!);
  const actor = client.projection!.actor, space = client.core.getCourseSpace(actor);
  const [draft, setDraft] = useState<Draft | null>(null), [unitIndex, setUnitIndex] = useState(0);
  const [deliveryId, setDeliveryId] = useState<string | null>(null), [editionId, setEditionId] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [attemptFilter,setAttemptFilter]=useState('');
  const [answerContext, setAnswerContext] = useState<{deliveryId: string; editionId: string; unitId: string; unitRevision: number; stage: Stage} | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [leave, setLeave] = useState<(() => void) | null>(null), [recipient, setRecipient] = useState('');
  const [material, setMaterial] = useState<LessonDocument | null>(null),[materialBusy,setMaterialBusy]=useState(false);
  const [hiddenHelp, setHiddenHelp] = useState<string[]>([]);
  const [questionContext,setQuestionContext]=useState<{object:EducationalObject;unitId:string;unitRevision:number;lessonRevision:number}|null>(null),[openSolutions,setOpenSolutions]=useState<string[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);
  const lock = useRef(false), materialRead = useRef(0);
  const routeRef = useRef(''), draftRef = useRef(draft); draftRef.current = draft;
  routeRef.current = draft?.id ?? deliveryId ?? editionId ?? 'library';
  const pendingAction = useRef<{id: string; route: string; done?: () => void} | null>(null);
  useEffect(() => client.subscribeReceipts((request, receipt) => {
    if (request.action !== 'course-command' || receipt.commandId !== pendingAction.current?.id) return;
    const action = pendingAction.current; pendingAction.current = null;
    if (routeRef.current === action.route) {action.done?.(); setError(''); setMessage('Salvato nello spazio.');}
  }), [client]);
  const dirty = !!draft && canonicalJson(draft.input) !== draft.original;
  const blocked = busy || client.state.pending.length > 0;
  const delivery = space.deliveries.find(value => value.id === deliveryId);
  const pack = space.editions.find(value => value.edition.id === (delivery?.editionId ?? editionId));
  const work = space.work.find(value => value.id === deliveryId);
  const pinned = answer.trim() && answerContext?.deliveryId === deliveryId ? answerContext : null;
  const stage = pinned?.stage ?? work?.currentStage ?? 'prediction';
  const unit = pack?.course.units.find(value => value.id === (pinned?.unitId ?? work?.currentUnitId)) ?? pack?.course.units[0];
  const attempts=(work?.attempts.filter(value=>value.unitId===unit?.id)??[]).map((value,index)=>({value,index}));
  const shownAttempts=attempts.filter(({value})=>!attemptFilter||(attemptFilter==='help'?value.helpUsed.length>0:attemptFilter==='no-help'?value.helpUsed.length===0:value.stage===attemptFilter));
  const selectedQuestion=questionContext&&questionContext.unitId===unit?.id&&questionContext.unitRevision===unit.revision&&questionContext.lessonRevision===unit.lesson?.revision?questionContext.object:null;
  const answerPrefix=selectedQuestion?`[Domanda ${courseQuestion(selectedQuestion)!.questionId} · oggetto ${selectedQuestion.id} r${selectedQuestion.revision} · lezione r${unit!.lesson!.revision}]\n`:'';
  const answerLimit=10000-answerPrefix.length;
  const positionPending = client.state.pending.some(value => value.request.action === 'course-command'
    && value.request.command.kind === 'set-course-position' && value.request.command.deliveryId === deliveryId);
  const positionChanged = !!pinned && !!work && (pinned.stage !== work.currentStage || pinned.unitId !== work.currentUnitId);
  const invalidDelivery = !!deliveryId && (!delivery || delivery.status !== 'active' || !pack);
  useEffect(() => {window.scrollTo({top: 0});}, [draft?.id, deliveryId, editionId]);
  useEffect(() => {
    if (!dirty && !answer.trim() && !busy) return;
    const guard = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, answer, busy]);
  useEffect(() => {materialRead.current++; setMaterial(null);setMaterialBusy(false);setQuestionContext(null);setOpenSolutions([]);setAttemptFilter('');}, [editionId, deliveryId, unit?.id, invalidDelivery]);
  async function run(command: CourseCommand, done?: () => void) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    pendingAction.current = {id: command.commandId, route: routeRef.current, done};
    try {await client.core.executeCourse(actor, command);}
    catch (reason) {setError(reason instanceof Error ? reason.message : 'Salvataggio non confermato.');}
    finally {lock.current = false; setBusy(false);}
  }
  function navigate(action: () => void) {
    if (busy) return;
    if (dirty || answer.trim()) setLeave(() => action);
    else {setError(''); setMessage(''); action();}
  }
  function home() {navigate(() => {setDraft(null); setEditionId(null); setDeliveryId(null); setAnswer('');});}
  function edit(course?: Course, sample = false) {
    navigate(() => {
      const input = course ? inputOf(course) : sample ? springCourse() : {title: 'Nuovo corso', description: '', license: 'Tutti i diritti riservati', units: [blankUnit()]};
      setDraft({id: course?.id ?? crypto.randomUUID(), revision: course?.revision ?? 0, input,
        original: course ? canonicalJson(input) : ''}); setUnitIndex(0); setEditionId(null); setDeliveryId(null); setAnswer('');
    });
  }
  function change(input: CourseInput) {setDraft(value => value && {...value, input});}
  function changeUnit(patch: Partial<CourseInput['units'][number]>) {
    if (draft) change({...draft.input, units: draft.input.units.map((value, index) => index === unitIndex ? {...value, ...patch} : value)});
  }
  function save() {
    if (!draft) return;
    const parsed = CourseInputSchema.safeParse(draft.input);
    if (!parsed.success) {setError('Controlla titoli, fonti e diritti: tutti i riferimenti devono essere completi.'); return;}
    void run({kind: 'save-course', courseId: draft.id, expectedRevision: draft.revision, input: parsed.data, commandId: crypto.randomUUID()}, () => {
      // A retry may carry a projection advanced by another authoring session.
      // Adopt only the exact acknowledged input and revision, never silently rebase.
      const input = parsed.data; setDraft(current => current?.id === draft.id ? {...current, revision: draft.revision + 1,
        input: canonicalJson(current.input) === canonicalJson(draft.input) ? input : current.input, original: canonicalJson(input)} : current);
    });
  }
  function freeze() {
    if (!draft) return;
    const editionId = crypto.randomUUID();
    void run({kind: 'create-course-edition', editionId, courseId: draft.id, courseRevision: draft.revision,
      label: `Edizione · revisione ${draft.revision}`, expectedRevision: 0, commandId: crypto.randomUUID()}, () => {if (canonicalJson(draftRef.current?.input) === draft.original) {setDraft(null); setEditionId(editionId);}});
  }
  function assign(learnerId: string, study = false) {
    if (!pack) return;
    const id = crypto.randomUUID();
    void run({kind: 'assign-course', editionId: pack.edition.id, deliveryId: id, learnerId, expectedRevision: 0, commandId: crypto.randomUUID()}, () => {
      setRecipient(''); if (study) setDeliveryId(id);
    });
  }
  function study(id: string) {navigate(() => {setDraft(null); setDeliveryId(id); setEditionId(null); setAnswer('');});}
  function workCommand(command: Record<string, unknown>, done?: () => void) {
    if (!delivery || invalidDelivery) return;
    void run({...command, deliveryId: delivery.id, expectedRevision: work?.revision ?? 0, commandId: crypto.randomUUID()} as CourseCommand, done);
  }
  async function openMaterial() {
    if (!pack || !unit || blocked || materialBusy) return;
    const read = ++materialRead.current; setError('');setMaterialBusy(true);
    try {const value = await client.core.readCourseLesson(actor, pack.edition.id, unit.id); if (read === materialRead.current) setMaterial(value);}
    catch (reason) {if (read === materialRead.current) setError(reason instanceof Error ? reason.message : 'Materiale non disponibile.');}
    finally {if(read===materialRead.current)setMaterialBusy(false);}
  }
  const editorUnit = draft?.input.units[unitIndex];
  const phaseFields = {objective: 'Obiettivo', prerequisites: 'Prerequisiti', explanation: 'Spiegazione', prediction: 'Previsione iniziale', activity: 'Attività', referenceFeedback: 'Feedback di riferimento', recovery: 'Recupero', transfer: 'Transfer'} as const;
  const displayTitle = draft?.input.title ?? pack?.course.title ?? 'I tuoi percorsi';
  return <div className="course-shell">
    <header className="course-header"><a className="wordmark" href="#" onClick={e => {e.preventDefault(); navigate(onClose);}}>Ardesia<span>.</span></a>
      <button className="text-button" onClick={home}><LibraryBig size={18}/>Corsi</button><span className="course-breadcrumb">{displayTitle}</span>
      <button className="secondary-button" disabled={busy} onClick={() => navigate(onClose)}>Torna alla lavagna</button></header>
    <div className="course-notices" aria-live="polite">{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}</div>
    {!draft && !pack && !deliveryId && <main className="course-library">
      <div className="course-intro"><div><span className="eyebrow">Uno spazio per imparare</span><h1>Un’idea diventa<br/>un percorso.</h1><p>Metti in relazione spiegazioni, esperimenti e domande. Ritrova ogni risposta, con il tempo e gli aiuti che hai scelto.</p></div>
        {canAuthor && <div className="course-intro-actions"><button className="primary-button" onClick={() => edit()}><Plus size={18}/>Crea un corso</button><button className="text-button" onClick={() => edit(undefined, true)}>Parti da una molla <ArrowUpRight size={16}/></button></div>}</div>
      {canAuthor && <Suspense fallback={<p>Apertura dei percorsi di Fisica…</p>}><PhysicsCatalog client={client} onBusy={setBusy} onStudy={id=>{setDeliveryId(id);setDraft(null);setEditionId(null);setAnswer('');}} onImported={course=>{const input=inputOf(course);setDraft({id:course.id,revision:course.revision,input,original:canonicalJson(input)});setUnitIndex(0);setMessage('Corso e lezioni salvati nel tuo spazio. Puoi modificarli o fissare un’edizione.');}}/></Suspense>}
      {canAuthor && <section aria-label="Corsi in preparazione"><div className="course-section-title"><h2>Il tuo laboratorio di corsi</h2><span>{space.courses.length} bozze</span></div>
        {!space.courses.length && <p className="course-empty">Il prossimo percorso parte da te. Puoi scriverlo da zero, in qualunque disciplina.</p>}
        <div className="course-grid">{space.courses.map(course => <article className="course-card" key={course.id}><span className="course-tag">Bozza · r{course.revision}</span><h3>{course.title}</h3><p>{course.description || 'Una nuova idea da sviluppare.'}</p><footer><span>{course.units.length} {course.units.length === 1 ? 'unità' : 'unità'}</span><button className="text-button" onClick={() => edit(course)}>Continua a creare <ArrowUpRight size={16}/></button></footer></article>)}</div></section>}
      {space.editions.some(value => value.edition.ownerId === actor.actorId) && <section aria-label="Edizioni dei corsi"><div className="course-section-title"><h2>Edizioni fissate</h2><span>Revisioni conservate</span></div>
        {space.editions.filter(value => value.edition.ownerId === actor.actorId).map(({edition, course}) => <button className="course-row" key={edition.id} onClick={() => setEditionId(edition.id)}><span><strong>{course.title}</strong><small>{edition.label} · Bozza</small></span><ArrowUpRight size={18}/></button>)}</section>}
      <section aria-label="I miei percorsi"><div className="course-section-title"><h2>Riprendi il tuo studio</h2><span>Le tue risposte restano tue</span></div>
        {!space.deliveries.some(value => value.learnerId === actor.actorId) && <p className="course-empty">I percorsi che inizierai compariranno qui, pronti da riprendere.</p>}
        {space.deliveries.filter(value => value.learnerId === actor.actorId).map(value => {
          const course = space.editions.find(item => item.edition.id === value.editionId)?.course;
          const saved = space.work.find(item => item.id === value.id);
          return <article className="course-row" key={value.id}><span><strong>{course?.title ?? 'Percorso revocato'}</strong><small>{value.status === 'revoked' ? 'Accesso ai materiali revocato · risposte conservate' : `${saved?.attempts.length ?? 0} risposte salvate · ${saved?.shared ? 'condivise' : 'private'}`}</small></span>
            {value.status === 'active' ? <button className="secondary-button" onClick={() => study(value.id)}>{saved ? 'Riprendi' : 'Inizia'}</button>
              : <button className="text-button" onClick={() => download('ardesia-risposte.json', {delivery: value, work: saved ?? null})}>Esporta le mie risposte</button>}</article>;
        })}</section>
    </main>}
    {draft && editorUnit && <main className="course-editor">
      <aside className="course-outline"><span className="eyebrow">Struttura del corso</span><h2>Un passo alla volta.</h2>
        <ol>{draft.input.units.map((value, index) => <li key={value.id}><button aria-current={index === unitIndex ? 'step' : undefined} disabled={busy} onClick={() => setUnitIndex(index)}><span>{String(index + 1).padStart(2, '0')}</span>{value.title}</button></li>)}</ol>
        <button className="text-button" disabled={blocked} onClick={() => {change({...draft.input, units: [...draft.input.units, blankUnit()]}); setUnitIndex(draft.input.units.length);}}><Plus size={16}/>Aggiungi unità</button>
        <p className="hint">Una bozza può crescere liberamente. L’edizione conserva la versione che scegli di usare.</p>
      </aside>
      <section className="course-editor-page"><div className="course-editor-heading"><span className="course-tag">{dirty ? 'Modifiche da salvare' : `Bozza salvata · r${draft.revision}`}</span><h1>Dai forma al percorso.</h1></div>
        <fieldset disabled={busy}><label>Titolo del corso<input maxLength={240} value={draft.input.title} onChange={e => change({...draft.input, title: e.target.value})}/></label>
          <label>Presentazione<textarea rows={2} maxLength={10000} value={draft.input.description} onChange={e => change({...draft.input, description: e.target.value})}/></label>
          <div className="course-unit-heading"><h2>Unità {unitIndex + 1}</h2><div><button className="text-button" disabled={unitIndex === 0 || blocked} onClick={() => {const units = [...draft.input.units]; [units[unitIndex - 1], units[unitIndex]] = [units[unitIndex]!, units[unitIndex - 1]!]; change({...draft.input, units}); setUnitIndex(unitIndex - 1);}}>Sposta prima</button><button className="text-button" disabled={draft.input.units.length === 1 || blocked} onClick={() => {change({...draft.input, units: draft.input.units.filter((_, i) => i !== unitIndex)}); setUnitIndex(Math.max(0, unitIndex - 1));}}><Trash2 size={16}/>Rimuovi unità</button></div></div>
          <label>Titolo dell’unità<input maxLength={240} value={editorUnit.title} onChange={e => changeUnit({title: e.target.value})}/></label>
          {Object.entries(phaseFields).map(([key, label]) => <label key={key}>{label}<textarea rows={key === 'explanation' ? 7 : 3} maxLength={10000} value={editorUnit[key as keyof typeof phaseFields]} onChange={e => changeUnit({[key]: e.target.value})}/></label>)}
          <details className="course-details"><summary>Materiali, fonti e diritti</summary><label>Lezione collegata<select value={editorUnit.lesson?.documentId ?? ''} onChange={e => {const doc = client.projection?.documents.find(d => d.id === e.target.value); changeUnit({lesson: doc ? {documentId: doc.id, revision: doc.revision} : null});}}><option value="">Nessuna lezione collegata</option>{client.projection?.documents.map(doc => <option key={doc.id} value={doc.id}>{doc.title} · r{doc.revision}</option>)}</select></label>
            {editorUnit.lesson && <p className="hint">Revisione fissata: {editorUnit.lesson.revision}. Il collegamento conserva gli stessi oggetti; il corso non riceve gli aggiornamenti successivi.</p>}
            <label>Diritti dei testi del corso<input maxLength={300} value={draft.input.license} onChange={e => change({...draft.input, license: e.target.value})}/></label>
            {editorUnit.sources.map((source, index) => <div className="course-source-editor" key={index}>{(['title','url','revision','license'] as const).map((key, i) => <label key={key}>{['Titolo della fonte','URL della fonte','Revisione della fonte','Diritti della fonte'][i]}<input value={source[key]} type={key === 'url' ? 'url' : 'text'} onChange={e => changeUnit({sources: editorUnit.sources.map((item, j) => index === j ? {...item, [key]: e.target.value} : item)})}/></label>)}<button className="text-button" onClick={() => changeUnit({sources: editorUnit.sources.filter((_, j) => j !== index)})}>Rimuovi fonte {index + 1}</button></div>)}
            <button className="secondary-button" onClick={() => changeUnit({sources: [...editorUnit.sources, {title: '', url: '', revision: '', license: ''}]})}>Aggiungi fonte</button><p className="hint">Una citazione conserva la provenienza. Riportare il testo di una fonte richiede diritti adeguati. I contenuti restano bozze.</p>
          </details>
        </fieldset>
        {space.courses.some(course => course.id === draft.id && course.revision !== draft.revision) && <p role="alert">Esiste una revisione più recente. Esporta la bozza prima di riaprire il corso dalla libreria.</p>}
      </section>
      <aside className="course-editor-note"><span className="eyebrow">Una buona unità</span><h3>Una domanda.<br/>Più modi di capirla.</h3><p>Lascia spazio alla previsione, alla prova e al ragionamento. Il transfer deve cambiare il contesto, non soltanto i numeri.</p><div className="course-note-line"/><p className="hint">Il feedback di riferimento è consultabile nello studio personale. Non è una valutazione del tentativo né un contenuto segreto.</p></aside>
      <footer className="course-editor-footer"><button className="text-button" onClick={() => download('ardesia-bozza-corso.json', {format: 'ardesia-course-draft/1', courseId: draft.id, expectedRevision: draft.revision, input: draft.input})}>Esporta bozza</button><span className="hint">Bozza · revisione scientifica ed editoriale da svolgere</span><button className="secondary-button" disabled={blocked || dirty || !draft.revision} onClick={freeze}>Fissa un’edizione</button><button className="primary-button" disabled={blocked || !dirty} onClick={save}><Save size={17}/>{busy ? 'Salvataggio…' : 'Salva corso'}</button></footer>
    </main>}
    {!draft && pack && !deliveryId && <main className="course-edition"><span className="eyebrow">{pack.edition.label} · Bozza</span><h1>{pack.course.title}</h1><p className="course-lead">{pack.course.description}</p>
      <div className="course-edition-layout"><section><h2>Il percorso</h2>{pack.course.units.map((value, i) => <div className="course-edition-unit" key={value.id}><span>{String(i + 1).padStart(2, '0')}</span><div><h3>{value.title}</h3><p>{value.objective}</p><small>Unità r{value.revision}{value.lesson ? ` · lezione r${value.lesson.revision}` : ''}</small></div></div>)}<p className="hint">Corso r{pack.edition.courseRevision} · {pack.course.license}</p><details className="course-details"><summary>Identità e provenienza</summary><p>Edizione <code>{pack.edition.id}</code></p><p>Integrità SHA-256 <code>{pack.edition.courseDigest}</code></p><p>Il digest identifica la versione; non certifica autore o qualità scientifica.</p></details></section>
        <aside className="course-start-card"><h2>Portalo nello studio.</h2><p>Inizia un percorso personale da questa edizione. I contenuti sono ancora una bozza.</p><button className="primary-button" disabled={blocked} onClick={() => assign(actor.actorId, true)}>Inizia il mio percorso</button>
          {actor.role === 'teacher' && <form onSubmit={e => {e.preventDefault(); assign(recipient.trim());}}><label>ID account studente<input required value={recipient} onChange={e => setRecipient(e.target.value)} maxLength={200}/></label><button className="secondary-button" disabled={blocked || !recipient.trim()}><Share2 size={16}/>Assegna edizione</button></form>}</aside></div>
      <section aria-label="Percorsi assegnati"><h2>Percorsi assegnati</h2>{space.deliveries.filter(value => value.editionId === pack.edition.id).map(value => <div className="course-assignment" key={value.id}><div className="course-row"><span><strong>{value.learnerId === actor.actorId ? 'Il mio percorso' : value.learnerId}</strong><small>{value.status === 'active' ? 'Accesso attivo' : 'Accesso revocato'}</small></span>{value.status === 'active' && <div>{value.learnerId === actor.actorId && <button className="secondary-button" onClick={() => study(value.id)}>Riprendi</button>}<button className="text-button" disabled={blocked} onClick={() => setRevoking(value.id)}>Revoca accesso</button></div>}</div>
        {value.learnerId !== actor.actorId && <div className="course-shared-evidence">{space.work.find(item => item.id === value.id)?.attempts.map(attempt => <blockquote key={attempt.id}><small>{phaseLabels[attempt.stage]} · unità r{attempt.unitRevision} · {attempt.helpUsed.length} aiuti consultati</small><p>{attempt.answer}</p></blockquote>) ?? <p className="hint">Nessuna evidenza condivisa. Le risposte personali restano private.</p>}</div>}</div>)}</section>
    </main>}
    {deliveryId && !invalidDelivery && pack && unit && <main className="course-study">
      <aside className="course-outline"><span className="eyebrow">Il tuo percorso</span><h2>{pack.course.title}</h2><ol>{pack.course.units.map((value, index) => <li key={value.id}><button aria-current={unit.id === value.id ? 'step' : undefined} disabled={blocked} onClick={() => navigate(() => workCommand({kind: 'set-course-position', unitId: value.id}))}><span>{String(index + 1).padStart(2, '0')}</span>{value.title}</button></li>)}</ol>
        <p className="hint">{work?.attempts.length ?? 0} risposte salvate.<br/>Ogni tentativo racconta un passaggio.</p><button className="text-button" onClick={() => download('ardesia-il-mio-percorso.json', {edition: pack.edition, delivery, work: work ?? null})}>Esporta le mie risposte</button>
        {delivery?.learnerId !== delivery?.ownerId && <button className="secondary-button" disabled={blocked} onClick={() => workCommand({kind: 'share-course-work', shared: !work?.shared})}>{work?.shared ? 'Rendi private le risposte' : 'Condividi le risposte col docente'}</button>}
      </aside>
      <article className="course-study-page"><span className="course-tag">Bozza · unità r{unit.revision}</span><h1>{unit.title}</h1><p className="course-lead">{unit.objective}</p><div className="course-prerequisites"><span className="eyebrow">Prima di cominciare</span><p>{unit.prerequisites}</p></div>
        <nav className="course-phases" aria-label="Fasi dell’attività">{Object.entries(phaseLabels).map(([key, label]) => <button key={key} aria-pressed={stage === key} disabled={blocked} onClick={() => navigate(() => {setQuestionContext(null);workCommand({kind: 'set-course-position', unitId: unit.id, stage: key});})}>{label}</button>)}</nav>
        {positionChanged && <p role="status" className="hint">La posizione salvata è cambiata in un’altra sessione. La risposta aperta resta collegata a questa domanda.</p>}
        <section className="course-question"><span className="eyebrow">{phaseLabels[stage]}</span><p className="course-rich-text">{unit[stage]}</p>{selectedQuestion&&<div className="course-selected-question"><strong>{selectedQuestion.title}</strong><p className="course-rich-text">{courseQuestion(selectedQuestion)?.prompt}</p><button className="text-button" disabled={blocked} onClick={()=>navigate(()=>{setQuestionContext(null);setAnswer('');})}>Torna alla domanda dell’attività</button></div>}<label>Il tuo ragionamento<textarea rows={6} maxLength={answerLimit} value={answer} disabled={busy || positionPending} onChange={e => {setAnswerContext({deliveryId: deliveryId!, editionId: pack.edition.id, unitId: unit.id, unitRevision: unit.revision, stage}); setAnswer(e.target.value);}} placeholder="Scrivi la tua idea, i passaggi e le domande che restano…"/></label><div className="course-answer-actions"><span className="hint">{work?.shared ? 'Visibile al docente' : 'Privato'} · nessun voto automatico</span><button className="primary-button" disabled={blocked || !answer.trim() || answer.length>answerLimit} onClick={() => workCommand({kind: 'record-course-attempt', unitId: unit.id, stage, attemptId: crypto.randomUUID(), answer:answerPrefix+answer}, () => setAnswer(value => value === answer ? '' : value))}><Save size={17}/>Salva risposta</button></div></section>
        <section className="course-study-help" aria-label="Strumenti per capire">{Object.entries(helpLabels).map(([key, label]) => {
          const viewed = work?.help.some(value => value.unitId === unit.id && value.kind === key);
          return <div className="course-help" key={key}><button className="text-button" disabled={blocked && !viewed} aria-expanded={!!viewed && !hiddenHelp.includes(key)} onClick={() => {if (!viewed) workCommand({kind: 'view-course-help', unitId: unit.id, help: key}); else setHiddenHelp(keys => keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key]);}}>{viewed && !hiddenHelp.includes(key) ? '−' : '+'} {label}</button>{viewed && !hiddenHelp.includes(key) && <p className="course-rich-text">{unit[key as keyof typeof helpLabels]}</p>}</div>;
        })}</section>
        {unit.lesson && <section className="course-materials"><h2>La lezione accanto</h2><p className="hint">Revisione {unit.lesson.revision} conservata in questa edizione.</p><button className="secondary-button" disabled={blocked||materialBusy} aria-busy={materialBusy} onClick={() => void openMaterial()}>{materialBusy?'Apertura materiali…':'Apri materiali della lezione'}</button>{material && <MaterialProvider access={client.materials} course={{editionId:pack.edition.id,unitId:unit.id}}><CourseMaterials document={material} blocked={blocked} openSolutions={openSolutions} onReveal={id=>{const reveal=()=>setOpenSolutions(ids=>ids.includes(id)?ids:[...ids,id]);if(work?.help.some(h=>h.unitId===unit.id&&h.kind==='referenceFeedback'))reveal();else workCommand({kind:'view-course-help',unitId:unit.id,help:'referenceFeedback'},reveal);}} onQuestion={object=>navigate(()=>workCommand({kind:'set-course-position',unitId:unit.id,stage:courseQuestion(object)?.kind==='assessment'?'transfer':'activity'},()=>{setAnswer('');setQuestionContext({object,unitId:unit.id,unitRevision:unit.revision,lessonRevision:unit.lesson!.revision});setAnswerContext(null);window.document.querySelector('.course-question')?.scrollIntoView({behavior:'smooth',block:'start'});} ))}/></MaterialProvider>}</section>}
        {!!unit.sources.length && <section className="course-sources"><h2>Da dove partiamo</h2>{unit.sources.map((source, i) => <p key={i}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><small>{source.revision} · {source.license}</small></p>)}</section>}
        <section className="course-attempts"><h2>Il filo dei tuoi tentativi</h2>{!!attempts.length&&<div className="course-practice-filters"><label>Rileggi i tentativi<select value={attemptFilter} onChange={e=>setAttemptFilter(e.target.value)}><option value="">Tutti</option>{Object.entries(phaseLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}<option value="help">Con aiuti nel percorso</option><option value="no-help">Senza aiuti nel percorso</option></select></label><p role="status">Risposte: {shownAttempts.length} di {attempts.length}. Aiuti registrati prima del salvataggio.</p></div>}{shownAttempts.map(({value,index}) => <article key={value.id}><span className="eyebrow">{String(index + 1).padStart(2, '0')} · {phaseLabels[value.stage]}</span><p>{value.answer}</p><small>{new Date(value.createdAt).toLocaleString('it-IT')} · {value.helpUsed.length ? value.helpUsed.map(help => helpLabels[help]).join(', ') : 'Nessun aiuto consultato nel percorso prima della risposta'}</small></article>)}{!attempts.length && <p className="hint">La prima risposta non deve essere perfetta. Serve a capire da dove partire.</p>}</section>
      </article>
    </main>}
    {invalidDelivery && <main className="course-edition"><h1>Il percorso non è più attivo.</h1><p>Le risposte salvate restano esportabili dalla tua libreria. Un nuovo percorso avrà una nuova identità.</p>{answer && <button className="secondary-button" onClick={() => download('ardesia-risposta-non-inviata.json', {deliveryId, stage, answer, context: answerContext})}>Esporta risposta non inviata</button>}<button className="primary-button" onClick={home}>Torna ai corsi</button></main>}
    {leave && <Dialog title="Conserva il lavoro aperto" onClose={() => setLeave(null)}><p>Ci sono modifiche non salvate. Puoi tornare al lavoro oppure scartarle per continuare.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => setLeave(null)}>Continua a lavorare</button><button className="primary-button" onClick={() => {const action = leave; setLeave(null); setAnswer(''); setDraft(null); action();}}>Scarta modifiche</button></div></Dialog>}
    {revoking && <Dialog title="Revoca questo percorso" onClose={() => setRevoking(null)}><p>Il partecipante perderà l’accesso ai materiali di questa edizione. Le sue risposte resteranno conservate ed esportabili.</p><button className="primary-button" disabled={blocked} onClick={() => {const target = space.deliveries.find(value => value.id === revoking)!; void run({kind: 'revoke-course-delivery', commandId: crypto.randomUUID(), deliveryId: target.id, expectedRevision: target.revision}, () => setRevoking(null));}}>Revoca accesso al percorso</button></Dialog>}
  </div>;
}
