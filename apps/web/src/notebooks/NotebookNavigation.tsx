import {notebookPages, type NotebookSpace} from '@ardesia/contracts';
import './notebooks.css';

export function NotebookNavigation({space, documentId, disabled, onOpen, onLibrary}: {space: NotebookSpace; documentId: string; disabled: boolean; onOpen: (id: string) => void; onLibrary: () => void}) {
  const all = notebookPages(space), current = all.find(item => item.page.documentId === documentId);
  if (!current) return null;
  const pages = all.filter(item => item.notebook.id === current.notebook.id && !item.section.archived && !item.page.archived);
  const index = pages.findIndex(item => item.page.id === current.page.id);
  return <nav className="notebook-page-navigation" aria-label="Pagine del quaderno corrente">
    <button className="notebook-location" title={`${current.notebook.title} / ${current.section.title}`} disabled={disabled} onClick={onLibrary}>{current.notebook.title} / {current.section.title}</button>
    <button aria-label="Pagina precedente" disabled={disabled || index <= 0} onClick={() => onOpen(pages[index - 1]!.page.documentId)}>←</button>
    <span>{current.notebook.archived || current.section.archived || current.page.archived ? 'Archiviata' : `${index + 1} / ${pages.length}`}</span>
    <button aria-label="Pagina successiva" disabled={disabled || index < 0 || index === pages.length - 1} onClick={() => onOpen(pages[index + 1]!.page.documentId)}>→</button>
  </nav>;
}
