import type {ReactNode} from 'react';
import {LibraryBig, Plus, Layers3, Settings2, Shapes, FileText, Share2, Puzzle, NotebookPen} from './Icons';

type Props = {
  title: string; replay: boolean; canExport: boolean; audio?: ReactNode;
  objectsOpen: boolean; onObjects: () => void; onLibrary: () => void;
  onNotebooks?: () => void; onMaterial?: () => void; onTutor?: () => void; onCourses?: () => void; onKnowledge?: () => void; onNew: () => void; onCreator?: () => void; onModules: () => void;
  onSettings: () => void; onAccount: () => void; onShare?: () => void; onHandout: () => void;
};
export function StudioChrome(p: Props) {
  return <>
    <header className="app-header studio-header">
      <a className="wordmark" href="#" onClick={e => {e.preventDefault();p.onLibrary();}}>Ardesia<span>.</span></a>
      <span className="header-divider"/>
      <h1 className="studio-title"><button title={p.title} onClick={p.onLibrary} disabled={p.replay}>{p.title}<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8"/></svg></button></h1>
      <div className="studio-actions">
        {p.audio}
        <button className="secondary-button objects-toggle" aria-label="Oggetti" aria-expanded={p.objectsOpen} aria-controls="lesson-objects" onClick={p.onObjects}><Layers3 size={19}/><span>Oggetti</span></button>
        <button className="secondary-button handout-open" disabled={!p.canExport} onClick={p.onHandout}><FileText size={18}/>Dispensa</button>
        {p.onShare && <button className="primary-button share-button" aria-label="Assegna" disabled={p.replay} onClick={p.onShare}><Share2 size={18}/>Condividi</button>}
        <button className="icon-button account-toggle" aria-label="Account e spazi" title="Account e spazi" onClick={p.onAccount}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></svg></button>
      </div>
    </header>
    <nav className="app-rail studio-rail" aria-label="Spazio personale">
      <button aria-label="Apri libreria" title="Libreria" disabled={p.replay} onClick={p.onLibrary}><LibraryBig size={22}/><span>Libreria</span></button>
      {p.onNotebooks && <button aria-label="Apri quaderni" title="Quaderni" disabled={p.replay} onClick={p.onNotebooks}><NotebookPen size={22}/><span>Quaderni</span></button>}
      <button aria-label="Nuova lezione" title="Nuova lezione" disabled={p.replay} onClick={p.onNew}><Plus size={22}/><span>Nuova</span></button>
      {p.onMaterial && <button aria-label="Importa materiale" title="PDF e immagini" disabled={p.replay} onClick={p.onMaterial}><FileText size={22}/><span>Materiali</span></button>}
      {p.onCreator && <button aria-label="Crea un oggetto" title="Crea un oggetto" disabled={p.replay} onClick={p.onCreator}><Shapes size={22}/><span>Crea</span></button>}
      {p.onCourses && <button aria-label="Apri corsi" title="Corsi" disabled={p.replay} onClick={p.onCourses}><FileText size={22}/><span>Corsi</span></button>}
      {p.onKnowledge && <button aria-label="Apri conoscenza" title="Conoscenza" disabled={p.replay} onClick={p.onKnowledge}><Share2 size={22}/><span>Idee</span></button>}
      {p.onTutor && <button aria-label="Apri studio tutor" title="Studio tutor" disabled={p.replay} onClick={p.onTutor}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/></svg><span>Tutor</span></button>}
      <button aria-label="Apri moduli" title="Moduli" disabled={p.replay} onClick={p.onModules}><Puzzle size={22}/><span>Moduli</span></button>
      <button aria-label="Impostazioni" title="Impostazioni" disabled={p.replay} onClick={p.onSettings}><Settings2 size={22}/><span>Spazio</span></button>
    </nav>
  </>;
}
