import {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {FlaskConical, X, Trash2, Undo2} from 'lucide-react';
import {canonicalJson, LabDataSchema, toObjectInput, type LabObject} from '@ardesia/contracts';
import type {PluginEvaluation} from '@ardesia/plugin-sdk';
import type {PluginSession} from '@ardesia/plugin-host';
import {mountLab, pluginErrorCode, subscribeMarketplace, marketplaceVersion} from '../plugins/first-party';
import {ScienceView} from './ScienceView';
import {draftConflictMessage, removedDraftMessage, type SaveObject} from '../workspace';

type Props = {object: LabObject; missing?: boolean; onClose: () => void; onDirtyChange: (dirty: boolean) => void; onSave: SaveObject; onRemove?: (id: string) => Promise<boolean>; titleEditable?: boolean};
export function LabInspector({object, missing = false, onClose, onDirtyChange, onSave, onRemove, titleEditable = true}: Props) {
  const installationVersion = useSyncExternalStore(subscribeMarketplace, marketplaceVersion);
  const session = useRef<PluginSession|null>(null);
  const generation = useRef(0);
  const [base, setBase] = useState(object);
  const [reopen, setReopen] = useState(0);
  const [evaluation, setEvaluation] = useState<PluginEvaluation|null>(null);
  const [title, setTitle] = useState(object.title);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [inputs, setInputs] = useState<Record<string,string>>({});
  const objectKey = canonicalJson(object), baseKey = canonicalJson(base), conflict = missing || (dirty && objectKey !== baseKey);
  useLayoutEffect(() => {if (!dirty) setBase(object);}, [objectKey]);
  useLayoutEffect(() => {
    let cancelled = false;
    generation.current += 1;
    setBusy(true); setError(null);
    if (missing) {setError('NOT_FOUND'); setBusy(false); return;}
    if (!dirty) {setEvaluation(null); setTitle(base.title);}
    void mountLab(base.data).then(result => {
      if (cancelled) {result.dispose(); return;}
      session.current = result;
      if (!dirty) {setEvaluation(result.current); setInputs(Object.fromEntries(result.current.view.parameters.map(p => [p.key, String(p.value)])));}
      setBusy(false);
    }).catch(reason => {if (!cancelled) {setError(pluginErrorCode(reason)); setBusy(false);}});
    return () => {cancelled = true; generation.current += 1; session.current?.dispose(); session.current = null;};
  }, [baseKey, reopen, installationVersion, missing]);
  // Keep the navigation guard aligned before the newly confirmed editor is painted.
  useLayoutEffect(() => {onDirtyChange(dirty); return () => onDirtyChange(false);}, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  async function calculate(persist: boolean) {
    const activeSession = session.current;
    if (!activeSession || !evaluation || busy || !dirty || (persist && conflict)) return;
    const currentGeneration = generation.current;
    const active = () => generation.current === currentGeneration && session.current === activeSession;
    setBusy(true);
    try {
      const next = await activeSession.evaluate({schemaVersion: evaluation.state.schemaVersion,
        value: Object.fromEntries(evaluation.view.parameters.map(parameter => [parameter.key, inputs[parameter.key]?.trim() ? Number(inputs[parameter.key]) : NaN]))});
      if (!active()) return;
      setEvaluation(next); setError(null);
      if (persist) {
        const data = LabDataSchema.parse({...base.data, state: next.state});
        const saved = await onSave({...toObjectInput(base), type: 'lab', title, data}, base);
        if (saved?.type === 'lab' && active()) restore(saved);
      }
    } catch (reason) {if (active()) setError(pluginErrorCode(reason));}
    finally {if (active()) setBusy(false);}
  }
  function restore(confirmed = object) {
    generation.current += 1; session.current?.dispose(); session.current = null;
    setBase(confirmed); setTitle(confirmed.title); setDirty(false); setBusy(true); setError(null); setEvaluation(null);
    setReopen(value => value + 1);
  }
  return <aside className="inspector lab-inspector" aria-label="Proprietà del laboratorio" data-plugin-status={evaluation && !error ? 'ready' : error ? 'error' : 'loading'} data-error-code={error ?? undefined}>
    <div className="inspector-heading"><h2>Esplora il modello</h2><button className="icon-button" aria-label="Chiudi proprietà" onClick={onClose}><X size={19}/></button></div>
    <div className="object-type"><span><FlaskConical size={24}/></span><div><strong>Molla ideale</strong><small>Revisione {object.revision} · Bozza</small></div></div>
    {conflict && <p role="alert" className="error-banner">{missing ? removedDraftMessage : draftConflictMessage}</p>}
    {error && <p role="alert" className="lab-error">Il laboratorio non ha accettato la modifica o non è verificabile. I dati salvati sono conservati.</p>}
    {!evaluation && !error && <p aria-live="polite">Verifica e apertura del laboratorio…</p>}
    <form id="object-editor" className="inspector-form" onSubmit={event => {event.preventDefault(); void calculate(true);}}>
      <label>Titolo<input aria-label="Titolo laboratorio" value={title} disabled={!titleEditable || busy || !session.current} maxLength={240} required onChange={event => {setTitle(event.target.value); setDirty(true);}}/></label>
      {evaluation && <><p className="hint">{evaluation.view.summary}</p><fieldset className="lab-parameters" disabled={busy || !session.current}><legend>Parametri del modello</legend>
        {evaluation.view.parameters.map(parameter => <label key={parameter.key}><span>{parameter.label} <small>({parameter.unit})</small></span><input aria-label={`${parameter.label} (${parameter.unit})`} type="number" min={parameter.min} max={parameter.max} step={parameter.step} required value={inputs[parameter.key] ?? String(parameter.value)} onChange={event => {setInputs(current => ({...current, [parameter.key]: event.target.value}));setDirty(true);}}/></label>)}
      </fieldset><button className="secondary-button" type="button" disabled={busy || !dirty || !session.current} onClick={() => void calculate(false)}>Aggiorna grafico</button><ScienceView view={evaluation.view}/></>}
      <button className="primary-button" type="submit" disabled={!dirty || busy || !evaluation || !session.current || conflict}>{busy && evaluation ? 'Calcolo…' : 'Salva laboratorio'}</button>
      {dirty && !missing && <button className="text-button" type="button" disabled={busy} onClick={() => restore()}><Undo2 size={15}/> Ripristina stato salvato</button>}
    </form>
    <p className="privacy-note">I parametri sono salvati solo dopo la conferma del server.</p>
    <details className="lab-identity"><summary>Identità del laboratorio</summary><p>Oggetto <code>{object.id}</code></p><p>Istanza <code>{object.data.instanceId}</code></p><p>{object.data.pluginId} · versione {object.data.pluginVersion} · stato {object.data.stateSchemaVersion}</p><p>Firma e integrità ricontrollate a ogni apertura.</p></details>
    {onRemove && <button className="text-button danger" disabled={busy || missing} onClick={async () => {if (await onRemove(object.id)) onClose();}}><Trash2 size={16}/> Rimuovi oggetto</button>}
  </aside>;
}
