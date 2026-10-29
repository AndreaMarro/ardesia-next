import {useEffect, useState} from 'react';
import {ArrowUpRight, Download, FileText} from 'lucide-react';
import type {CoreService} from '@ardesia/core';
import {projectContinuity} from '@ardesia/lesson-os';
import type {LessonDocument} from '@ardesia/contracts';
import {localActor} from '../workspace';
import {Dialog} from './Dialog';
import {Marketplace} from './Marketplace';

export type DialogName = 'library' | 'settings' | 'new' | 'history' | 'modules';
type Props = {name: DialogName; core: CoreService; document: LessonDocument; onClose: () => void; onOpen: (id: string) => void; onCreate: (title: string) => Promise<void>; onAddLab: () => Promise<void>; addingLab: boolean; onModulesChanged: () => void};
export function WorkspaceDialogs({name, core, document, onClose, onOpen, onCreate, onAddLab, addingLab, onModulesChanged}: Props) {
  const [title, setTitle] = useState('');
  const [build, setBuild] = useState<{commit: string; sourceDigest: string} | null>(null);
  useEffect(() => {if(name === 'settings') void fetch('/build-info.json').then(r => r.ok ? r.json() : null).then(setBuild).catch(() => setBuild(null));}, [name]);
  const titles = {library:'Le mie lezioni', settings:'Il tuo spazio personale', new:'Nuova lezione', history:'Storia della lezione', modules:'Moduli'};
  function download() {
    const blob = new Blob([JSON.stringify(core.snapshot(), null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob), a = window.document.createElement('a');
    a.href=url; a.download='ardesia-next-spazio-personale.json'; a.click(); URL.revokeObjectURL(url);
  }
  return <Dialog title={titles[name]} onClose={onClose} className={name === 'modules' ? 'marketplace-dialog' : undefined}>
    {name === 'new' && <form className="new-lesson-form" onSubmit={async e => {e.preventDefault(); await onCreate(title.trim());}}><label>Titolo della lezione<input autoFocus value={title} required maxLength={240} aria-label="Titolo nuova lezione" placeholder="Da quale domanda vuoi partire?" onChange={e => setTitle(e.target.value)}/></label><p>Una nuova bozza con il suo spazio, le sue fonti e i suoi oggetti.</p><button className="primary-button" type="submit">Crea lezione</button></form>}
    {name === 'library' && <div className="lesson-list">{core.listDocuments(localActor).map(doc => <button key={doc.id} className="lesson-row" onClick={() => {onOpen(doc.id); onClose();}}><FileText size={24}/><span><strong>{doc.title}</strong><small>Bozza · {doc.objects.length} oggetti · revisione {doc.revision}</small></span><ArrowUpRight size={18}/></button>)}</div>}
    {name === 'history' && <><p className="dialog-intro">Le modifiche salvate di questa lezione. Ogni voce rimanda a una revisione effettiva.</p><ol className="history-list">{projectContinuity(core.events(localActor, document.id), document.id).changes.slice().reverse().map(item => <li key={item.eventId}><strong>Revisione {item.revision}</strong><span>{eventLabel(item.type)}</span><time dateTime={item.occurredAt}>{new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(item.occurredAt))}</time></li>)}</ol></>}
    {name === 'modules' && <Marketplace onAddLab={onAddLab} addingLab={addingLab} onChanged={onModulesChanged}/>}
    {name === 'settings' && <div className="settings-content"><p>Le lezioni sono salvate <strong>solo in questo browser</strong>. Non sono sincronizzate con altri dispositivi. Cancellare i dati del sito può rimuoverle.</p><p>La preview protetta consente l’accesso al prodotto; l’accesso individuale di docenti e studenti sarà un passaggio successivo.</p><button className="secondary-button" onClick={download}><Download size={18}/> Esporta una copia dei dati</button><details><summary>Versione di questa preview</summary><p>Ardesia Next · M2</p><code>{build?.commit ?? 'Ambiente di sviluppo locale'}</code>{build && <small>Impronta sorgenti: {build.sourceDigest}</small>}</details></div>}
  </Dialog>;
}
function eventLabel(type: string) {
  const labels:Record<string,string>={'create-document':'Lezione creata','rename-document':'Titolo aggiornato','add-object':'Oggetto aggiunto','replace-object':'Oggetto aggiornato','move-object':'Oggetto spostato','remove-object':'Oggetto rimosso','connect-objects':'Collegamento aggiunto','disconnect-objects':'Collegamento rimosso'};
  return labels[type] ?? type;
}

