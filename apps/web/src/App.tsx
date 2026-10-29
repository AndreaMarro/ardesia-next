import {useState} from 'react';
import {NotebookPen, Settings2, SquarePen, Plus, LibraryBig, Save, Smartphone, History, Layers3, Type, SquareFunction, Link2, X, FlaskConical} from 'lucide-react';
import type {CoreService} from '@ardesia/core';
import {toObjectInput, type NewEducationalObject} from '@ardesia/contracts';
import {localActor, edit, newLesson, type EditCommand} from './workspace';
import {Board} from './components/Board';
import {DocumentView} from './components/DocumentView';
import {Inspector} from './components/Inspector';
import {WorkspaceDialogs, type DialogName} from './components/WorkspaceDialogs';
import {Dialog} from './components/Dialog';
import {createFirstPartyLab} from './plugins/first-party';

type Mode = 'board' | 'notebook' | 'reader';
export function App({core}: {core: CoreService}) {
  const initial = core.listDocuments(localActor).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
  const [documentId, setDocumentId] = useState(initial.id);
  const [version, setVersion] = useState(0);
  const [mode, setMode] = useState<Mode>('board');
  const [selectedId, setSelectedId] = useState<string|null>(initial.objects.find(o => o.type === 'formula')?.id ?? null);
  const [inspectorOpen, setInspectorOpen] = useState(!window.matchMedia('(max-width: 1100px)').matches);
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [message, setMessage] = useState('Salvato su questo dispositivo');
  const [error, setError] = useState<string|null>(null);
  const [undo, setUndo] = useState<EditCommand[]>([]);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [addingLab, setAddingLab] = useState(false);
  const document = core.getDocument(localActor, documentId);
  const selected = document.objects.find(object => object.id === selectedId);
  async function run(command: EditCommand, inverse?: EditCommand): Promise<boolean> {
    setMessage('Salvataggio…'); setError(null);
    try {await edit(core, documentId, command); setVersion(value => value + 1); if(inverse) setUndo(history => [...history, inverse]); setMessage('Salvato su questo dispositivo'); return true;}
    catch {setError('Modifica non salvata. La versione precedente è conservata. Se hai un’altra scheda aperta, ricarica; se lo spazio è pieno, esporta i dati dalle impostazioni.'); setMessage('Salvataggio non riuscito'); return false;}
  }
  function navigate(action: () => void) {
    if(editorDirty) setPendingNavigation(() => action);
    else action();
  }
  function select(id: string) {if(id === selectedId && inspectorOpen) return; navigate(() => {setSelectedId(id); setInspectorOpen(true);});}
  async function add(type: 'note'|'formula'|'source') {
    const id=crypto.randomUUID(), count=document.objects.length;
    const base={id, title:'', x:70 + count * 18 % 350, y:95 + count * 24 % 240, width:270,height:190};
    const object:NewEducationalObject=type==='note' ? {...base, type, title:'Nuova nota', data:{text:''}} : type==='formula' ? {...base,type,title:'Nuova formula',data:{latex:'y = x',description:''}} : {...base,type,title:'Nuova fonte',data:{url:'https://openstax.org',publisher:'Da indicare',locator:'Da indicare',sourceRevision:'Da verificare',license:'Da verificare'}};
    if(await run({kind:'add-object',object},{kind:'remove-object',objectId:id})) select(id);
  }
  function openDocument(id:string) {navigate(() => {setDocumentId(id); setSelectedId(null); setInspectorOpen(false); setUndo([]);});}
  async function addLab() {
    if (addingLab) return;
    setAddingLab(true); setError(null);
    try {
      const data = await createFirstPartyLab();
      const id = crypto.randomUUID();
      if (await run({kind:'add-object', object:{id, type:'lab', title:'Molla ideale', x:55, y:100, width:430, height:320, data}}, {kind:'remove-object', objectId:id})) {
        setDialog(null); select(id); setMode('notebook');
      }
    } catch {setError('Il laboratorio non ha superato la verifica. Nessun oggetto è stato aggiunto.');setDialog(null);}
    finally {setAddingLab(false);}
  }
  const icons = {note:Type,formula:SquareFunction,source:Link2,ink:SquarePen,lab:FlaskConical};
  return <div className={`app-shell ${inspectorOpen && selected ? 'with-inspector' : ''}`} data-revision={document.revision} data-ui-version={version}>
    <a href="#workspace" className="skip-link">Vai alla lezione</a>
    <nav className="app-rail" aria-label="Spazio personale"><div className="rail-monogram" aria-label="Ardesia">A<span/></div>
      <button className={mode==='board'?'active':''} aria-label="Vai alla lavagna" onClick={() => setMode('board')}><SquarePen size={23}/><span>Lavagna</span></button>
      <button className={mode==='notebook'?'active':''} aria-label="Vai al taccuino" onClick={() => setMode('notebook')}><NotebookPen size={23}/><span>Taccuino</span></button>
      <button aria-label="Apri libreria" onClick={() => setDialog('library')}><LibraryBig size={23}/><span>Libreria</span></button>
      <button aria-label="Apri moduli" onClick={() => navigate(() => setDialog('modules'))}><Layers3 size={23}/><span>Moduli</span></button>
      <button className="rail-settings" aria-label="Impostazioni" onClick={() => setDialog('settings')}><Settings2 size={23}/><span>Impostazioni</span></button>
    </nav>
    <header className="app-header"><a className="wordmark" href="#" onClick={e => {e.preventDefault();setDialog('library');}}>Ardesia<span>.</span></a><span className="header-divider"/><span className="space-name">Il mio spazio</span><button className="primary-button new-button" onClick={() => setDialog('new')}><Plus size={19}/><span>Nuova lezione</span></button></header>
    <main id="workspace" className="workspace" tabIndex={-1}>
      <header className="lesson-header"><div className="lesson-title"><h1>{document.title}</h1><p>Bozza personale</p></div>
        <div className="view-tabs" role="group" aria-label="Vista della lezione">{([['board','Lavagna'],['notebook','Taccuino'],['reader','Lezione']] as const).map(([id,label]) => <button key={id} aria-pressed={mode===id} onClick={() => setMode(id)}>{label}</button>)}</div>
        <button className="save-button" form="object-editor" type="submit" aria-label="Salva oggetto selezionato" disabled={!inspectorOpen || !selected}><Save size={17}/><span>Salva</span></button>
      </header>
      {error && <div role="alert" className="error-banner"><span>{error}</span><button className="icon-button" aria-label="Chiudi avviso" onClick={() => setError(null)}><X size={17}/></button></div>}
      {mode==='board' ? <Board document={document} selectedId={selectedId} onSelect={select}
        onMove={(id,x,y) => {const before=document.objects.find(o => o.id===id)!;void run({kind:'move-object',objectId:id,x,y},{kind:'move-object',objectId:id,x:before.x,y:before.y});}}
        onAdd={type => void add(type)} onInk={object => {void run({kind:'add-object',object},{kind:'remove-object',objectId:object.id});}}
        canUndo={undo.length>0} onUndo={() => {const last=undo.at(-1);if(last) void run(last).then(ok => {if(ok)setUndo(history=>history.slice(0,-1));});}}/>
        : <DocumentView document={document} mode={mode} onSelect={select}/>}
      <section className="object-strip" aria-label="Fonti e oggetti"><h2>Fonti e oggetti</h2><div className="object-strip-items">{document.objects.map(object => {const Icon=icons[object.type];return <button key={object.id} onClick={() => select(object.id)} aria-label={`Seleziona ${object.title}`}><span className={`mini-object type-${object.type}`}><Icon size={19}/></span><span><strong>{object.title}</strong><small>{object.type==='note'?'Nota testuale':object.type==='formula'?'Formula':object.type==='source'?'Collegamento':object.type==='lab'?'Laboratorio scientifico':'Annotazione'}</small></span></button>;})}</div></section>
    </main>
    {inspectorOpen && selected && <Inspector key={selected.id} object={selected} onClose={() => navigate(() => setInspectorOpen(false))} onDirtyChange={setEditorDirty}
      onSave={async object => run({kind:'replace-object',object},{kind:'replace-object',object:toObjectInput(selected)})}
      onRemove={async id => {const ok=await run({kind:'remove-object',objectId:id}); if(ok){setSelectedId(null);setUndo([]);}return ok;}}/>}
    <footer className="app-footer"><div role="status" aria-live="polite"><Smartphone size={15}/><span>{editorDirty ? 'Modifiche da salvare' : message}</span></div><button className="footer-history" aria-label="Apri storia lezione" onClick={() => setDialog('history')}><History size={15}/><span>Revisione {document.revision}</span></button><span className="footer-brand">Ardesia Next</span></footer>
    {dialog && <WorkspaceDialogs name={dialog} core={core} document={document} onClose={() => {if (!addingLab) setDialog(null);}} onOpen={openDocument} onAddLab={addLab} addingLab={addingLab} onModulesChanged={() => setVersion(value => value + 1)}
      onCreate={async title => {try {const id=await newLesson(core,title);openDocument(id);setDialog(null);setMode('board');}catch {setError('Impossibile creare la lezione. I dati esistenti sono conservati.');}}}/>}
    {pendingNavigation && <Dialog title="Hai modifiche da salvare" onClose={() => setPendingNavigation(null)}><p className="dialog-intro">Il testo nel pannello non è ancora stato applicato alla lezione.</p><div className="confirm-actions"><button className="primary-button" onClick={() => setPendingNavigation(null)}>Continua a modificare</button><button className="secondary-button" onClick={() => {const action=pendingNavigation;setPendingNavigation(null);setEditorDirty(false);action();}}>Scarta modifiche</button></div></Dialog>}
  </div>;
}

