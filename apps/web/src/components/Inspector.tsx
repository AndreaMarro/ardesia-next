import {useEffect, useLayoutEffect, useState} from 'react';
import {X, Link2, Trash2, SquareFunction, Type, SquarePen, FlaskConical} from 'lucide-react';
import {canonicalJson, toObjectInput, type EducationalObject, type NewEducationalObject} from '@ardesia/contracts';
import {draftConflictMessage, removedDraftMessage, type SaveObject} from '../workspace';
import {MathFormula} from './MathFormula';
import {LabInspector} from './LabInspector';
const labels = {note: 'Nota testuale', formula: 'Formula', source: 'Fonte', ink: 'Annotazione', lab: 'Laboratorio'};
const icons = {note: Type, formula: SquareFunction, source: Link2, ink: SquarePen, lab: FlaskConical};
type Props = {object: EducationalObject; missing?: boolean; onClose: () => void; onDirtyChange: (dirty: boolean) => void; onSave: SaveObject; onRemove: (id: string) => Promise<boolean>};

export function Inspector(props: Props) {
  return props.object.type === 'lab' ? <LabInspector {...props} object={props.object}/> : <StandardInspector {...props}/>;
}
function StandardInspector({object, missing = false, onClose, onDirtyChange, onSave, onRemove}: Props) {
  const [base, setBase] = useState(object);
  const [draft, setDraft] = useState<NewEducationalObject>(() => toObjectInput(object));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const Icon = icons[draft.type];
  const objectKey = canonicalJson(object), conflict = missing || (dirty && objectKey !== canonicalJson(base));
  function restore(confirmed = object) {setBase(confirmed); setDraft(toObjectInput(confirmed)); setDirty(false);}
  // A dirty draft keeps its original base; successful saves adopt their explicit confirmation.
  useLayoutEffect(() => {if (!dirty) restore(object);}, [objectKey]);
  useLayoutEffect(() => {onDirtyChange(dirty); return () => onDirtyChange(false);}, [dirty, onDirtyChange]);
  useEffect(() => {
    if(!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {event.preventDefault();};
    window.addEventListener('beforeunload',guard);
    return () => window.removeEventListener('beforeunload',guard);
  }, [dirty]);
  function change(next: NewEducationalObject) {setDraft(next); setDirty(true);}
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if(!dirty || saving || conflict) return; setSaving(true);
    try {const confirmed = await onSave(draft, base); if (confirmed) restore(confirmed);}
    finally {setSaving(false);}
  }
  return <aside className="inspector" aria-label="Proprietà dell’oggetto">
    <div className="inspector-heading"><h2>Oggetto della lezione</h2><button className="icon-button" aria-label="Chiudi proprietà" onClick={onClose}><X size={19}/></button></div>
    <div className="object-type"><span><Icon size={24}/></span><div><strong>{labels[draft.type]}</strong><small>Revisione {object.revision} · Bozza</small></div></div>
    {conflict && <p role="alert" className="error-banner">{missing ? removedDraftMessage : draftConflictMessage}</p>}
    <form id="object-editor" onSubmit={submit} className="inspector-form">
      <label>Titolo<input disabled={saving} aria-label="Titolo oggetto" required maxLength={240} value={draft.title} onChange={e => change({...draft, title:e.target.value})}/></label>
      {draft.type === 'note' && <label>Contenuto<textarea disabled={saving} aria-label="Testo nota" rows={7} maxLength={100000} value={draft.data.text} onChange={e => change({...draft, data:{text:e.target.value}})}/></label>}
      {draft.type === 'formula' && <>
        <div className="inspector-formula"><MathFormula latex={draft.data.latex}/></div>
        <label>Formula LaTeX<textarea disabled={saving} aria-label="Formula LaTeX" rows={2} value={draft.data.latex} required maxLength={10000} onChange={e => change({...draft, data:{...draft.data, latex:e.target.value}})}/></label>
        <label>Nota o descrizione<textarea disabled={saving} aria-label="Descrizione formula" rows={3} maxLength={10000} value={draft.data.description} onChange={e => change({...draft, data:{...draft.data, description:e.target.value}})}/></label>
      </>}
      {draft.type === 'source' && <>
        <label>Collegamento<input disabled={saving} aria-label="URL fonte" type="url" required value={draft.data.url} onChange={e => change({...draft, data:{...draft.data,url:e.target.value}})}/></label>
        <label>Autore o editore<input disabled={saving} aria-label="Editore fonte" required maxLength={300} value={draft.data.publisher} onChange={e => change({...draft, data:{...draft.data,publisher:e.target.value}})}/></label>
        <label>Pagina o sezione<input disabled={saving} aria-label="Sezione fonte" required maxLength={1000} value={draft.data.locator} onChange={e => change({...draft, data:{...draft.data,locator:e.target.value}})}/></label>
        <label>Edizione o revisione<input disabled={saving} aria-label="Revisione fonte" required maxLength={300} value={draft.data.sourceRevision} onChange={e => change({...draft, data:{...draft.data,sourceRevision:e.target.value}})}/></label>
        <label>Licenza o diritti<input disabled={saving} aria-label="Licenza fonte" required maxLength={300} value={draft.data.license} onChange={e => change({...draft, data:{...draft.data,license:e.target.value}})}/></label>
        <a className="source-open" href={object.type === 'source' ? object.data.url : '#'} target="_blank" rel="noreferrer">Apri la fonte <Link2 size={15}/></a>
      </>}
      {draft.type === 'ink' && <p className="hint">Il tratto è un oggetto della stessa lezione. Puoi rinominarlo o rimuoverlo.</p>}
      <button className="primary-button" type="submit" disabled={!dirty || saving || conflict}>{saving ? 'Salvataggio…' : 'Salva modifiche'}</button>
      {dirty && !missing && <button className="text-button" type="button" disabled={saving} onClick={() => restore()}>Ripristina versione salvata</button>}
    </form>
    <div className="privacy-note"><p>La bozza è privata fino all’assegnazione.</p></div>
    <div className="provenance-summary"><span>Provenienza</span><p>{object.provenance.origin === 'authored' ? 'Oggetto creato nello spazio personale.' : 'Oggetto importato.'}</p>{object.provenance.sources.length > 0 && <p>{object.provenance.sources.length} fonte collegata con revisione esatta.</p>}</div>
    <button className="text-button danger" disabled={saving || missing} onClick={async () => {if(await onRemove(object.id)) onClose();}}><Trash2 size={16}/> Rimuovi oggetto</button>
  </aside>;
}

