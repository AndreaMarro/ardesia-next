import {useRef, useState} from 'react';
import {notebookPages, type LessonDocument, type NotebookCommand, type NotebookSpace, type PageLayout} from '@ardesia/contracts';
import {Dialog} from '../components/Dialog';
import {Plus, NotebookPen, ArrowUpRight} from '../components/Icons';
import {PagePreview} from './PagePreview';
import './notebooks.css';

type WithoutMeta<T> = T extends unknown ? Omit<T, 'commandId' | 'expectedRevision'> : never;
export type NotebookEdit = WithoutMeta<NotebookCommand>;
export const defaultPageLayout: PageLayout = {format: 'a4', orientation: 'portrait', background: 'ruled', paper: 'ivory'};
type Editor = {kind: 'new-book' | 'new-section' | 'new-page' | 'rename-book' | 'rename-section' | 'rename-page' | 'layout' | 'attach' | 'move-page' | 'move-section';
  id: string; title: string; target: string; layout: PageLayout};
type Props = {space: NotebookSpace; documents: LessonDocument[]; currentDocumentId: string; blocked?: boolean;
  onOpen: (id: string) => void; onClose: () => void; onCommand?: (command: NotebookEdit) => Promise<void>;
  onRename?: (documentId: string, title: string) => Promise<void>};

export function PageLayoutFields({value, onChange}: {value: PageLayout; onChange: (next: PageLayout) => void}) {
  return <fieldset className="page-layout-fields"><legend>Carta</legend>
    <label>Formato<select value={value.format} onChange={event => onChange({...value, format: event.target.value as PageLayout['format']})}><option value="a4">A4</option><option value="a5">A5</option><option value="letter">Letter</option></select></label>
    <label>Orientamento<select value={value.orientation} onChange={event => onChange({...value, orientation: event.target.value as PageLayout['orientation']})}><option value="portrait">Verticale</option><option value="landscape">Orizzontale</option></select></label>
    <label>Sfondo<select value={value.background} onChange={event => onChange({...value, background: event.target.value as PageLayout['background']})}><option value="plain">Bianco</option><option value="ruled">Righe</option><option value="grid">Quadretti</option><option value="dots">Puntini</option></select></label>
    <label>Colore carta<select value={value.paper} onChange={event => onChange({...value, paper: event.target.value as PageLayout['paper']})}><option value="ivory">Avorio</option><option value="white">Bianco</option></select></label>
  </fieldset>;
}

export function NotebookLibrary(p: Props) {
  const current = notebookPages(p.space).find(item => item.page.documentId === p.currentDocumentId);
  const [bookId, setBookId] = useState(current?.notebook.id ?? ''), [sectionId, setSectionId] = useState(current?.section.id ?? '');
  const [archived, setArchived] = useState(false), [query, setQuery] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const initialEditor = useRef(''), [closing, setClosing] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const books = p.space.notebooks.filter(book => archived || !book.archived);
  const book = books.find(item => item.id === bookId) ?? books[0];
  const sections = book?.sections.filter(section => archived || !section.archived) ?? [];
  const section = sections.find(item => item.id === sectionId) ?? sections[0];
  const editable = !!p.onCommand, disabled = busy || !!p.blocked;
  const allPages = notebookPages(p.space), documentById = new Map(p.documents.map(document => [document.id, document]));
  const available = p.documents.filter(document => !allPages.some(item => item.page.documentId === document.id));
  const pages = (section?.pages ?? []).filter(page => (archived || !page.archived)
    && (documentById.get(page.documentId)?.title ?? '').toLocaleLowerCase('it').includes(query.trim().toLocaleLowerCase('it')));
  function edit(kind: Editor['kind'], id = '', title = '', layout = defaultPageLayout) {
    const value = {kind, id, title, layout, target: kind === 'attach' ? available[0]?.id ?? '' : kind === 'move-section' ? book?.id ?? '' : section?.id ?? ''};
    initialEditor.current = JSON.stringify(value); setError(''); setEditor(value);
  }
  async function commit(command: NotebookEdit) {
    if (!p.onCommand || disabled) return;
    setBusy(true); setError('');
    try {await p.onCommand(command); setEditor(null);
      for (const menu of content.current?.querySelectorAll<HTMLDetailsElement>('details[open]') ?? []) {menu.open = false; menu.querySelector('summary')?.focus();}
      if (command.kind === 'create-notebook') {setBookId(command.notebookId); setSectionId(command.sectionId);}
    }
    catch (reason) {setError(reason instanceof Error ? reason.message : 'Modifica non confermata. Rileggi il quaderno prima di riprovare.');}
    finally {setBusy(false);}
  }
  async function submit() {
    if (!editor || disabled) return;
    const title = editor.title.trim(), id = () => crypto.randomUUID();
    switch (editor.kind) {
      case 'new-book': return commit({kind: 'create-notebook', notebookId: id(), title, sectionId: id(), sectionTitle: 'Appunti',
        firstPage: {pageId: id(), documentId: id(), title: 'Pagina 1', layout: editor.layout}});
      case 'new-section': return commit({kind: 'create-notebook-section', notebookId: editor.id, sectionId: id(), title, beforeId: null});
      case 'new-page': return commit({kind: 'create-notebook-page', sectionId: editor.id, pageId: id(), documentId: id(), title, layout: editor.layout, beforeId: null});
      case 'rename-book': return commit({kind: 'rename-notebook', notebookId: editor.id, title});
      case 'rename-section': return commit({kind: 'rename-notebook-section', sectionId: editor.id, title});
      case 'layout': return commit({kind: 'set-notebook-page-layout', pageId: editor.id, layout: editor.layout});
      case 'move-page': return commit({kind: 'move-notebook-page', pageId: editor.id, targetSectionId: editor.target, beforeId: null});
      case 'move-section': return commit({kind: 'move-notebook-section', sectionId: editor.id, targetNotebookId: editor.target, beforeId: null});
      case 'attach': {
        const document = documentById.get(editor.target); if (!document) return;
        return commit({kind: 'attach-document-to-notebook', sectionId: editor.id, pageId: id(), documentId: document.id,
          expectedDocumentRevision: document.revision, layout: editor.layout, beforeId: null});
      }
      case 'rename-page':
        if (!p.onRename) return;
        setBusy(true); setError('');
        try {await p.onRename(editor.id, title); setEditor(null);}
        catch (reason) {setError(reason instanceof Error ? reason.message : 'Titolo non confermato.');}
        finally {setBusy(false);}
    }
  }
  function archive(kind: 'notebook' | 'section' | 'page', id: string, value: boolean) {
    void commit({kind: 'set-notebook-entry-archived', entry: {kind, id}, archived: value});
  }
  const titles: Record<Editor['kind'], string> = {'new-book': 'Nuovo quaderno', 'new-section': 'Nuova sezione', 'new-page': 'Nuova pagina',
    'rename-book': 'Rinomina quaderno', 'rename-section': 'Rinomina sezione', 'rename-page': 'Rinomina pagina', layout: 'Formato e sfondo',
    attach: 'Aggiungi una lezione esistente', 'move-page': 'Sposta pagina', 'move-section': 'Sposta sezione'};
  const hasTitle = editor && !['layout', 'attach', 'move-page', 'move-section'].includes(editor.kind);
  return <Dialog title="I miei quaderni" className="notebooks-dialog" onClose={() => {if (busy) return; if (editor && JSON.stringify(editor) !== initialEditor.current) setClosing(true); else p.onClose();}}>
    {closing && <Dialog title="Conservare le modifiche al quaderno?" onClose={() => setClosing(false)}><p className="dialog-intro">Titolo e scelte del foglio non sono ancora salvati.</p><div className="notebook-form-actions"><button className="primary-button" onClick={() => setClosing(false)}>Continua a modificare</button><button className="secondary-button" onClick={p.onClose}>Scarta e chiudi</button></div></Dialog>}
    {error && <p role="alert" className="error-banner">{error}</p>}
    {p.blocked && <p role="status" className="notebooks-notice">Una modifica è ancora da verificare. Puoi leggere le pagine; per organizzarle completa il recupero.</p>}
    {!editable && <p className="notebooks-notice">Quaderni disponibili offline. Puoi leggere e scrivere sulle pagine; ricollegati per organizzarle.</p>}
    {editor ? <form className="notebook-editor" onSubmit={event => {event.preventDefault(); void submit();}}>
      <h3>{titles[editor.kind]}</h3><fieldset disabled={disabled}>
      {hasTitle && <label>Titolo<input autoFocus required maxLength={240} value={editor.title} onChange={event => setEditor({...editor, title: event.target.value})}/></label>}
      {['new-book', 'new-page', 'layout', 'attach'].includes(editor.kind) && <PageLayoutFields value={editor.layout} onChange={layout => setEditor({...editor, layout})}/>}
      {['layout', 'attach'].includes(editor.kind) && <PagePreview layout={editor.layout} document={documentById.get(editor.kind === 'attach' ? editor.target : allPages.find(item => item.page.id === editor.id)?.page.documentId ?? '')}/>}
      {editor.kind === 'attach' && <><label>Lezione<select value={editor.target} required onChange={event => setEditor({...editor, target: event.target.value})}>{available.map(document => <option key={document.id} value={document.id}>{document.title}</option>)}</select></label><p>La pagina usa la lezione originale, con tutti i suoi oggetti e collegamenti.</p></>}
      {editor.kind === 'move-page' && <label>Sezione di destinazione<select value={editor.target} onChange={event => setEditor({...editor, target: event.target.value})}>{p.space.notebooks.flatMap(book => book.sections.map(section => <option key={section.id} value={section.id}>{book.title} / {section.title}{book.archived || section.archived ? ' · archiviata' : ''}</option>))}</select></label>}
      {editor.kind === 'move-section' && <label>Quaderno di destinazione<select value={editor.target} onChange={event => setEditor({...editor, target: event.target.value})}>{p.space.notebooks.map(book => <option key={book.id} value={book.id}>{book.title}{book.archived ? ' · archiviato' : ''}</option>)}</select></label>}
      {editor.kind === 'layout' && <p>Il foglio cambia formato; i tratti e gli oggetti mantengono posizione e dimensioni. Il contenuto fuori pagina resta accessibile.</p>}
      <div className="notebook-form-actions"><button className="primary-button" type="submit">{busy ? 'Salvataggio…' : 'Salva'}</button><button type="button" className="text-button" onClick={() => setEditor(null)}>Annulla</button></div>
      </fieldset></form> : <>
    <div className="notebooks-heading"><p>Un posto per ogni idea.<span>Le tue pagine, nello stesso spazio della lavagna.</span></p>{editable && <button className="primary-button" disabled={disabled} onClick={() => edit('new-book')}><Plus size={18}/>Nuovo quaderno</button>}</div>
    <div className="notebooks-layout" ref={content}><nav className="notebook-shelf" aria-label="Quaderni">
      {books.map(item => <button className="notebook-spine" key={item.id} aria-pressed={item.id === book?.id} disabled={busy} onClick={() => {setBookId(item.id); setSectionId(''); setQuery('');}}><NotebookPen size={22}/><span><strong>{item.title}</strong><small>{item.archived ? 'Archiviato' : `${item.sections.reduce((sum, section) => sum + section.pages.length, 0)} pagine`}</small></span></button>)}
      {!books.length && <p className="notebooks-empty">Raccogli appunti ed esperimenti nel tuo primo quaderno.</p>}
      <label className="notebooks-archive"><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)}/>Mostra archivio</label>
    </nav><section className="notebook-pages" aria-label="Pagine del quaderno">
      {book && <><div className="notebook-title"><h3>{book.title}</h3>{editable && <details><summary aria-label="Opzioni quaderno">•••</summary><div className="notebook-actions">
        <button disabled={disabled} onClick={() => edit('rename-book', book.id, book.title)}>Rinomina quaderno</button>
        <button disabled={disabled || p.space.notebooks.indexOf(book) === 0} onClick={() => void commit({kind: 'move-notebook', notebookId: book.id, beforeId: p.space.notebooks[p.space.notebooks.indexOf(book) - 1]!.id})}>Sposta quaderno su</button>
        <button disabled={disabled || p.space.notebooks.indexOf(book) === p.space.notebooks.length - 1} onClick={() => void commit({kind: 'move-notebook', notebookId: book.id, beforeId: p.space.notebooks[p.space.notebooks.indexOf(book) + 2]?.id ?? null})}>Sposta quaderno giù</button>
        <button disabled={disabled} onClick={() => archive('notebook', book.id, !book.archived)}>{book.archived ? 'Ripristina quaderno' : 'Archivia quaderno'}</button>
      </div></details>}</div>
      <div className="notebook-sections" role="group" aria-label="Sezioni">{sections.map(item => <button key={item.id} aria-pressed={item.id === section?.id} onClick={() => {setSectionId(item.id); setQuery('');}}>{item.title}{item.archived ? ' · archiviata' : ''}</button>)}{editable && <button disabled={disabled} onClick={() => edit('new-section', book.id)}><Plus size={16}/>Sezione</button>}</div>
      {section && <><div className="notebook-page-tools"><label><span className="sr-only">Cerca pagine per titolo</span><input type="search" placeholder="Cerca una pagina…" aria-label="Cerca pagine per titolo" value={query} onChange={event => setQuery(event.target.value)}/></label>{editable && <><button className="secondary-button" disabled={disabled} onClick={() => edit('new-page', section.id, `Pagina ${section.pages.length + 1}`)}><Plus size={16}/>Pagina</button><details><summary>Organizza sezione</summary><div className="notebook-actions">
        <button disabled={disabled} onClick={() => edit('rename-section', section.id, section.title)}>Rinomina sezione</button>
        <button disabled={disabled || book.sections.indexOf(section) === 0} onClick={() => void commit({kind: 'move-notebook-section', sectionId: section.id, targetNotebookId: book.id, beforeId: book.sections[book.sections.indexOf(section) - 1]!.id})}>Sposta sezione su</button>
        <button disabled={disabled || book.sections.indexOf(section) === book.sections.length - 1} onClick={() => void commit({kind: 'move-notebook-section', sectionId: section.id, targetNotebookId: book.id, beforeId: book.sections[book.sections.indexOf(section) + 2]?.id ?? null})}>Sposta sezione giù</button>
        <button disabled={disabled} onClick={() => edit('move-section', section.id)}>Sposta in altro quaderno</button>
        <button disabled={disabled || !available.length} onClick={() => edit('attach', section.id)}>Aggiungi lezione esistente</button>
        <button disabled={disabled} onClick={() => archive('section', section.id, !section.archived)}>{section.archived ? 'Ripristina sezione' : 'Archivia sezione'}</button>
      </div></details></>}</div>
      <div className="notebook-page-grid">{pages.map(page => {const document = documentById.get(page.documentId)!; const index = section.pages.indexOf(page); return <article key={page.id} className="notebook-page-card" data-page-id={page.id} data-current={page.documentId === p.currentDocumentId}>
        <button className="notebook-page-open" aria-label={`Apri pagina ${document.title}`} onClick={() => p.onOpen(page.documentId)}><span className={`page-miniature paper-${page.layout.paper} pattern-${page.layout.background} orientation-${page.layout.orientation}`} aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span></span><strong>{document.title}</strong><small>{page.archived ? 'Archiviata · ' : ''}{page.layout.format.toUpperCase()} · {document.objects.length} oggetti</small><ArrowUpRight size={18}/></button>
        {editable && <details><summary aria-label={`Opzioni pagina ${document.title}`}>Organizza pagina</summary><div className="notebook-actions">
          <button disabled={disabled} onClick={() => edit('rename-page', document.id, document.title)}>Rinomina pagina</button>
          <button disabled={disabled} onClick={() => edit('layout', page.id, '', page.layout)}>Formato e sfondo</button>
          <button disabled={disabled || index === 0} onClick={() => void commit({kind: 'move-notebook-page', pageId: page.id, targetSectionId: section.id, beforeId: section.pages[index - 1]!.id})}>Sposta pagina su</button>
          <button disabled={disabled || index === section.pages.length - 1} onClick={() => void commit({kind: 'move-notebook-page', pageId: page.id, targetSectionId: section.id, beforeId: section.pages[index + 2]?.id ?? null})}>Sposta pagina giù</button>
          <button disabled={disabled} onClick={() => edit('move-page', page.id)}>Sposta in altra sezione</button>
          <button disabled={disabled} onClick={() => archive('page', page.id, !page.archived)}>{page.archived ? 'Ripristina pagina' : 'Archivia pagina'}</button>
        </div></details>}
      </article>;})}</div>{!pages.length && <p className="notebooks-empty">{query ? 'Nessuna pagina con questo titolo.' : 'Questa sezione è pronta per le tue prime idee.'}</p>}</>}
      {!sections.length && <p className="notebooks-empty">Aggiungi una sezione per raccogliere nuove pagine.</p>}</>}
    </section></div><p className="notebooks-footnote">Archiviare conserva pagine, oggetti e condivisioni. Puoi ripristinare tutto da “Mostra archivio”.</p>
    </>}
  </Dialog>;
}
