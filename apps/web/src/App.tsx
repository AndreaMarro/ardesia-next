import {MaterialImport} from './materials/MaterialImport';
import {Creator} from './creator/Creator';
import type {ExtensionObject,ExtensionLineage} from '@ardesia/contracts';
import {StudioChrome} from './components/StudioChrome';
import {AudioSession} from './recordings/AudioSession';
import {HandoutView} from './handout/HandoutView';
import {prepareHandout} from './handout/prepare';
import type {Handout} from '@ardesia/lesson-os';
import type {AudioCapture, CaptureStatus} from './recordings/capture';
import type {RecordingAccess} from '@ardesia/remote-client';
import type {LessonDocument} from '@ardesia/contracts';
import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {SquarePen, History, Type, SquareFunction, Link2, X, FlaskConical} from './components/Icons';
import type {CoreService} from '@ardesia/core';
import {canonicalJson, CoreError, toObjectInput, type EducationalObject, type NewEducationalObject} from '@ardesia/contracts';
import {newLesson, type EditCommand} from './workspace';
import type {RemoteClient, PendingCommand} from '@ardesia/remote-client';
import {pendingObjectsForDocument,pendingRemovalsForDocument} from './workspace';
import type {Actor} from '@ardesia/contracts';
import {SharingDialog} from './components/SharingDialog';
import {Board} from './components/Board';
import {DocumentView} from './components/DocumentView';
import {Inspector} from './components/Inspector';
import {WorkspaceDialogs, type DialogName} from './components/WorkspaceDialogs';
import {Dialog} from './components/Dialog';
import {createFirstPartyLab, firstPartyLabName, type LabCondition} from './plugins/first-party';

type Mode = 'board' | 'notebook' | 'reader';
export function App({core, actor, onEdit, saveStatus, onAccount, onExport, onCourses, onTutor, onKnowledge, workspaceId, pending = [], offlineControl, recordingAccess, sourceRevision,inkRecovery,initialSelection}: {initialSelection?:{documentId:string;objectId:string;objectRevision:number};inkRecovery?: RemoteClient['inkRecovery']; onTutor?: () => void; onCourses?: () => void; onKnowledge?: () => void; sourceRevision?: number; recordingAccess?: () => RecordingAccess; offlineControl?: (transition: (action: () => Promise<unknown>) => void) => import('react').ReactNode; pending?: readonly PendingCommand[]; workspaceId: string; core: CoreService; actor: Actor; onEdit: RemoteClient['edit']; saveStatus: string; onAccount: () => void; onExport: () => Promise<void>}) {
  const [importing,setImporting]=useState(false);
  const capture = useRef<AudioCapture | null>(null);
  const [audioBusy, setAudioBusy] = useState(false), [inkActive, setInkActive] = useState(false);
  const [captureStatus,setCaptureStatus]=useState<CaptureStatus>('idle');
  const [replay, setReplay] = useState<LessonDocument | null>(null);
  const editorDirtyRef = useRef(false), inkActiveRef = useRef(false);
  const [version, setVersion] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [handout, setHandout] = useState<Handout | null>(null);
  const documents = useMemo(() => core.listDocuments(actor).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)), [core, actor.actorId, sourceRevision, version]);
  const navigationKey = `ardesia-next-document:${actor.actorId}:${workspaceId}`;
  let savedId: string | null = null; try {savedId = sessionStorage.getItem(navigationKey);} catch { /* Optional navigation. */ }
  const initial = documents.find(document => document.id === initialSelection?.documentId) ?? documents.find(document => document.id === savedId) ?? documents[0]!;
  const initialObject=initial.id===initialSelection?.documentId?initial.objects.find(object=>object.id===initialSelection.objectId&&object.revision===initialSelection.objectRevision):undefined;
  const [documentId, setDocumentId] = useState(initial.id);
  const [mode, setMode] = useState<Mode>('board');
  const [selectedId, setSelectedId] = useState<string|null>(initialObject?.id??null);
  const [inspectorOpen, setInspectorOpen] = useState(!!initialObject);
  const [objectsOpen, setObjectsOpen] = useState(false);
  const [creator, setCreator] = useState<ExtensionObject | null | undefined>(undefined);
  const [creationId,setCreationId]=useState(()=>crypto.randomUUID());
  const [creatorDirty, setCreatorDirty] = useState(false);
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [error, setError] = useState<string|null>(initialSelection&&!initialObject?'L’oggetto scelto è cambiato o non è più disponibile. Seleziona la sua versione corrente dalla lezione.':null);
  const [undo, setUndo] = useState<EditCommand[]>([]);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorReset, setEditorReset] = useState(0);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [switching, setSwitching] = useState(false);
  const [addingLab, setAddingLab] = useState(false);
  const document = useMemo(() => core.getDocument(actor, documentId), [core, actor.actorId, documentId, sourceRevision, version]);
  const events = useMemo(() => core.events(actor, documentId), [core, actor.actorId, documentId, document.revision]);
  const viewDocument = replay ?? document;
  const selected = document.objects.find(object => object.id === selectedId);
  const previousSelected = useRef<EducationalObject | undefined>(undefined);
  useLayoutEffect(() => {if (selected) previousSelected.current = selected;}, [selected]);
  const edited = selected ?? (editorDirty && previousSelected.current?.id === selectedId ? previousSelected.current : undefined);
  function openHandout(){
    if(replay||inkActiveRef.current||audioBusy)return;
    try {const saved=core.getDocument(actor,documentId);setHandout(prepareHandout(saved,ref=>core.getObjectRevision(actor,documentId,ref.sourceId,ref.revision)));}
    catch {setError('La lezione non è disponibile per la dispensa. Riapri lo spazio e riprova.');}
  }
  async function run(command: EditCommand, inverse?: EditCommand, base?: EducationalObject): Promise<boolean> {
    setError(null);
    try {await onEdit(actor, documentId, command, base); setVersion(value => value + 1); if(inverse) setUndo(history => [...history, inverse]); return true;}
    catch (reason) {setError(reason instanceof CoreError ? reason.message : 'Modifica non confermata. Verifica il pannello di recupero.'); return false;}
  }
  function navigate(action: () => void) {
    if(audioBusy || inkActive) {setError('Termina il tratto e interrompi la registrazione prima di cambiare spazio o lezione.'); return;}
    if(editorDirty || creatorDirty) setPendingNavigation(() => action);
    else action();
  }
  function transition(action: () => Promise<unknown>) {
    navigate(() => {
      // Freeze input after the dirty-draft decision until the async switch settles.
      setSwitching(true);
      void action().finally(() => setSwitching(false));
    });
  }
  function select(id: string) {if(id === selectedId && inspectorOpen) return; navigate(() => {setSelectedId(id); setInspectorOpen(true); setObjectsOpen(false);});}
  async function add(type: 'note'|'formula'|'source', position?: {x:number;y:number}) {
    const id=crypto.randomUUID(), count=document.objects.length;
    const base={id, title:'', x:position?.x ?? 70 + count * 18 % 350, y:position?.y ?? 95 + count * 24 % 240, width:270,height:190};
    const object:NewEducationalObject=type==='note' ? {...base, type, title:'Nuova nota', data:{text:''}} : type==='formula' ? {...base,type,title:'Nuova formula',data:{latex:'y = x',description:''}} : {...base,type,title:'Nuova fonte',data:{url:'https://openstax.org',publisher:'Da indicare',locator:'Da indicare',sourceRevision:'Da verificare',license:'Da verificare'}};
    if(await run({kind:'add-object',object},{kind:'remove-object',objectId:id})) select(id);
  }
  function openDocument(id:string) {navigate(() => {setDocumentId(id); try {sessionStorage.setItem(navigationKey, id);} catch { /* Optional navigation. */ } setSelectedId(null); setInspectorOpen(false); setUndo([]);});}
  async function addLab(pluginId: string, condition?: LabCondition) {
    if (addingLab) return;
    setAddingLab(true); setError(null);
    try {
      const data = await createFirstPartyLab(pluginId, condition);
      const id = crypto.randomUUID();
      if (await run({kind:'add-object', object:{id, type:'lab', title:firstPartyLabName(pluginId), x:55, y:100, width:430, height:320, data}}, {kind:'remove-object', objectId:id})) {
        setDialog(null); select(id); setMode('notebook');
      }
    } catch {setError('Il laboratorio non ha superato la verifica. Nessun oggetto è stato aggiunto.');setDialog(null);}
    finally {setAddingLab(false);}
  }
  const lineageSource:ExtensionLineage|undefined=creator?{
    typeId:creator.data.definition.typeId,version:creator.data.definition.version,definitionDigest:creator.data.definitionDigest,definitionLicense:creator.data.definition.license,
    objectId:creator.id,objectRevision:creator.revision,createdBy:creator.provenance.createdBy,createdAt:creator.provenance.createdAt,
    sources:creator.provenance.sources.flatMap(ref=>{try{const source=core.getObjectRevision(actor,documentId,ref.sourceId,ref.revision);return source.type==='source'?[{id:source.id,revision:source.revision,title:source.title,...source.data,referenceLocator:ref.locator}]:[];}catch{return[];}}),
    missingSources:creator.provenance.sources.filter(ref=>{try{return core.getObjectRevision(actor,documentId,ref.sourceId,ref.revision).type!=='source';}catch{return true;}}),
  }:undefined;
  const icons = {material:Link2,note:Type,formula:SquareFunction,source:Link2,ink:SquarePen,lab:FlaskConical,extension:SquarePen};
  return <div className={`app-shell ${!replay && inspectorOpen && edited ? 'with-inspector' : ''} ${replay?'is-replaying':''}`} inert={switching} aria-busy={switching} data-revision={viewDocument.revision} data-ui-version={version}>
    <a href="#workspace" className="skip-link">Vai alla lezione</a>
    <StudioChrome title={viewDocument.title} replay={!!replay} canExport={!replay&&!inkActive&&!audioBusy}
      onMaterial={()=>navigate(()=>setImporting(true))}
      objectsOpen={objectsOpen} onObjects={()=>setObjectsOpen(open=>!open)}
      onLibrary={()=>setDialog('library')} onNew={()=>navigate(()=>setDialog('new'))}
      onCreator={()=>navigate(()=>{setInspectorOpen(false);setCreationId(crypto.randomUUID());setCreator(null);})}
      onTutor={onTutor ? () => navigate(onTutor) : undefined}
      onCourses={onCourses ? () => navigate(onCourses) : undefined}
      onKnowledge={onKnowledge ? () => navigate(onKnowledge) : undefined}
      onModules={()=>navigate(()=>setDialog('modules'))} onSettings={()=>setDialog('settings')}
      onAccount={()=>navigate(onAccount)} onShare={actor.role === 'teacher' ? ()=>setSharing(true) : undefined} onHandout={openHandout}
      audio={recordingAccess && <AudioSession key={document.id} access={recordingAccess} document={document} events={events} bridge={capture} onBusy={setAudioBusy} onCaptureStatus={setCaptureStatus} onReplay={frame => {
        if (frame && (editorDirtyRef.current || inkActiveRef.current)) {setError('Salva o scarta la bozza e termina il tratto prima del replay.'); return false;}
        setReplay(frame); return true;
      }} canReplay={() => !editorDirtyRef.current && !inkActiveRef.current} replayBlocked={editorDirty || inkActive} inkActive={inkActive}/>} />
    <main id="workspace" className="workspace" tabIndex={-1}>
      <header className="lesson-header">
        <div className="view-tabs" role="group" aria-label="Vista della lezione">{([['board','Lavagna'],['notebook','Taccuino'],['reader','Lezione']] as const).map(([id,label]) => <button key={id} aria-pressed={mode===id} disabled={!!replay} onClick={() => {if (!inkActiveRef.current) setMode(id);}}>{label}</button>)}</div>
        <span className="lesson-state">{replay ? 'Replay · sola lettura' : 'Bozza personale'}</span>
      </header>
      {error && <div role="alert" className="error-banner"><span>{error}</span><button className="icon-button" aria-label="Chiudi avviso" onClick={() => setError(null)}><X size={17}/></button></div>}
      <div className="lesson-content">
      <div className="lesson-stage">
      {replay ? <Board key={'replay-' + replay.id} document={replay} selectedId={null} onSelect={() => {}} onMove={() => {}} onAdd={async () => {}} onInk={() => {}} onUndo={() => {}} canUndo={false} readOnlyObjects replayOnly/> : mode!=='reader' ? <Board key={document.id} appearance={mode} inkRecovery={inkRecovery} pendingRemovals={pendingRemovalsForDocument(pending,workspaceId,document.id)} onErase={objectId=>run({kind:'remove-object',objectId})} pendingObjects={pendingObjectsForDocument(pending, workspaceId, document.id)} document={document} selectedId={selectedId} onSelect={select}
        onMove={(id,x,y) => {const before=document.objects.find(o => o.id===id)!;void run({kind:'move-object',objectId:id,x,y},{kind:'move-object',objectId:id,x:before.x,y:before.y});}}
        onAdd={add} writingStatus={captureStatus==='recording'?'Registrazione audio attiva · '+saveStatus:captureStatus==='requesting'?'Attesa microfono · '+saveStatus:captureStatus==='stopping'?'Salvataggio audio · '+saveStatus:saveStatus} onWritingMode={enter=>{if(inkActiveRef.current)return;const action=()=>{setInspectorOpen(false);setObjectsOpen(false);enter();};if(editorDirty||creatorDirty)setPendingNavigation(()=>action);else action();}} onInkActiveChange={active => {inkActiveRef.current = active; setInkActive(active);}} onInk={(object, sampleTimes,recovered) => {if(!recovered)capture.current?.ink(object.id, sampleTimes); return run({kind:'add-object',object},{kind:'remove-object',objectId:object.id});}}
        canUndo={undo.length>0} onUndo={() => {const last=undo.at(-1);if(last) void run(last).then(ok => {if(ok)setUndo(history=>history.slice(0,-1));});}}/>
        : <DocumentView document={document} mode={mode} onSelect={select}/>}
      {objectsOpen && <section id="lesson-objects" className="object-strip" aria-label="Fonti e oggetti"><div className="object-drawer-heading"><h2>Fonti e oggetti</h2><button className="icon-button" aria-label="Chiudi elenco oggetti" onClick={()=>setObjectsOpen(false)}><X size={18}/></button></div><div className="object-strip-items">{viewDocument.objects.map(object => {const Icon=icons[object.type];return <button key={object.id} disabled={!!replay} onClick={() => select(object.id)} aria-label={`Seleziona ${object.title}`}><span className={`mini-object type-${object.type}`}><Icon size={19}/></span><span><strong>{object.title}</strong><small>{object.type==='note'?'Nota testuale':object.type==='formula'?'Formula':object.type==='source'?'Collegamento':object.type==='lab'?'Laboratorio scientifico':object.type==='extension'?'Oggetto componibile':'Annotazione'}</small></span></button>;})}</div></section>}
      </div>
      </div>
    </main>
    {!replay && inspectorOpen && edited && <Inspector key={`${edited.id}:${editorReset}`} object={edited} missing={!selected} onHandout={!audioBusy&&!inkActive?openHandout:undefined} onDefinition={edited.type==='extension'?()=>navigate(()=>{setInspectorOpen(false);setCreator(edited);}):undefined} onClose={() => navigate(() => setInspectorOpen(false))} onDirtyChange={dirty => {editorDirtyRef.current = dirty; setEditorDirty(dirty);}}
      onSave={async (object, base) => await run({kind:'replace-object',object},{kind:'replace-object',object:toObjectInput(base)},base)
        ? core.getDocument(actor, documentId).objects.find(saved => saved.id === object.id) ?? null : null}
      onRemove={async id => {const ok=await run({kind:'remove-object',objectId:id}); if(ok){setSelectedId(null);setUndo([]);}return ok;}}/>}
    <footer className="app-footer"><div role="status" aria-live="polite"><span>{replay ? 'Replay · sola lettura' : editorDirty ? 'Modifiche da salvare' : saveStatus}</span></div><button className="footer-history" aria-label="Apri storia lezione" disabled={!!replay} onClick={() => setDialog('history')}><History size={15}/><span>Revisione {viewDocument.revision}</span></button></footer>
    {dialog && <WorkspaceDialogs name={dialog} offlineControl={offlineControl?.(transition)} core={core} actor={actor} onExport={onExport} document={document} onClose={() => {if (!addingLab) setDialog(null);}} onOpen={openDocument} onAddLab={addLab} addingLab={addingLab} onModulesChanged={() => setVersion(value => value + 1)}
      onCreate={async title => {try {const id=await newLesson(core,actor,title);openDocument(id);setDialog(null);setMode('board');}catch {setError('Impossibile creare la lezione. I dati esistenti sono conservati.');}}}/>}
    {creator !== undefined && <Creator original={creator??undefined} lineageSource={lineageSource} onDirtyChange={setCreatorDirty} onClose={()=>navigate(()=>{setCreator(undefined);setCreatorDirty(false);})} onSave={async(data,base,imported)=>{
      const id=base?.id??creationId;
      if(!base){
        const confirmed=core.getDocument(actor,documentId).objects.find(o=>o.id===id);
        if(confirmed){
          if(confirmed.type==='extension'&&JSON.stringify(confirmed.data)===JSON.stringify(data)){setCreator(undefined);setCreatorDirty(false);setSelectedId(id);setInspectorOpen(true);return true;}
          setError('L’oggetto è già stato salvato. Riaprilo dalla lavagna per continuare.');return false;
        }
        if(pendingObjectsForDocument(pending,workspaceId,documentId).some(o=>o.id===id)){setError('Questa creazione è già in attesa di verifica. Risolvi il comando originale nel pannello di recupero.');return false;}
      }
      const object:NewEducationalObject=base?{...toObjectInput(base),type:'extension',title:data.definition.name,data}:{id,type:'extension',title:data.definition.name,x:110,y:150,width:440,height:400,data,provenance:{origin:imported||data.lineage?.length?'imported':'authored',sources:[]}};
      const ok=await run(base?{kind:'replace-object',object}:{kind:'add-object',object},undefined,base);
      if(ok){setCreator(undefined);setCreatorDirty(false);setSelectedId(id);setInspectorOpen(true);}
      return ok;
    }}/>}
    {importing && <MaterialImport origin={{x:Math.min(990000,Math.max(0,...document.objects.map(o=>o.x+o.width))+80),y:100}} documentId={documentId} onClose={()=>setImporting(false)} onAdd={async objects=>{
      for(const object of objects){
        const saved=core.getDocument(actor,documentId).objects.find(o=>o.id===object.id);
        if(saved){
          if(saved.type!==object.type||canonicalJson(saved.data)!==canonicalJson(object.data))throw Error('Una pagina con questa identità ha un contenuto diverso. L’importazione è conservata.');
          continue;
        }
        if(pendingObjectsForDocument(pending,workspaceId,documentId).some(o=>o.id===object.id))return false;
        if(!await run({kind:'add-object',object}))return false;
      }
      setMode('board');setSelectedId(objects[0]?.id??null);setInspectorOpen(true);return true;
    }}/>}
    {sharing && <SharingDialog core={core} actor={actor} document={document} onClose={() => setSharing(false)}/> }
    {handout && <HandoutView handout={handout} onClose={()=>setHandout(null)} notice={editorDirty || pending.some(entry=>entry.workspaceId===workspaceId) ? 'Le modifiche non confermate restano nella lezione e non sono incluse nella dispensa.' : ''}/>}
    {pendingNavigation && <Dialog title="Hai modifiche da salvare" onClose={() => setPendingNavigation(null)}><p className="dialog-intro">Il testo nel pannello non è ancora stato applicato alla lezione.</p><div className="confirm-actions"><button className="primary-button" onClick={() => setPendingNavigation(null)}>Continua a modificare</button><button className="secondary-button" onClick={() => {const action=pendingNavigation;setPendingNavigation(null);editorDirtyRef.current=false;setEditorDirty(false);setCreatorDirty(false);setEditorReset(value => value + 1);action();}}>Scarta modifiche</button></div></Dialog>}
  </div>;
}

