import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {FlaskConical, X, Trash2, RotateCcw} from 'lucide-react';
import {LabDataSchema, toObjectInput, type LabObject, type NewEducationalObject} from '@ardesia/contracts';
import type {PluginEvaluation} from '@ardesia/plugin-sdk';
import type {PluginSession} from '@ardesia/plugin-host';
import {mountLab, pluginErrorCode, subscribeMarketplace, marketplaceVersion} from '../plugins/first-party';
import {ScienceView} from './ScienceView';

type Props = {object: LabObject; onClose: () => void; onDirtyChange: (dirty: boolean) => void; onSave: (object: NewEducationalObject) => Promise<boolean>; onRemove: (id: string) => Promise<boolean>};
export function LabInspector({object, onClose, onDirtyChange, onSave, onRemove}: Props) {
  const installationVersion = useSyncExternalStore(subscribeMarketplace, marketplaceVersion);
  const session = useRef<PluginSession|null>(null);
  const generation = useRef(0);
  const [evaluation, setEvaluation] = useState<PluginEvaluation|null>(null);
  const [title, setTitle] = useState(object.title);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [inputs, setInputs] = useState<Record<string,string>>({});
  useEffect(() => {
    let cancelled = false;
    generation.current += 1;
    setBusy(true); setEvaluation(null); setError(null); setTitle(object.title);
    void mountLab(object.data).then(result => {
      if (cancelled) {result.dispose(); return;}
      session.current = result; setEvaluation(result.current); setInputs(Object.fromEntries(result.current.view.parameters.map(p => [p.key, String(p.value)]))); setBusy(false); setDirty(false);
    }).catch(reason => {if (!cancelled) {setError(pluginErrorCode(reason)); setBusy(false);}});
    return () => {cancelled = true; generation.current += 1; session.current?.dispose(); session.current = null;};
  }, [object.id, object.revision, installationVersion]);
  useEffect(() => {onDirtyChange(dirty);}, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  async function calculate(persist: boolean) {
    const activeSession = session.current;
    if (!activeSession || !evaluation || busy || !dirty) return;
    const currentGeneration = generation.current;
    const active = () => generation.current === currentGeneration && session.current === activeSession;
    setBusy(true);
    try {
      const next = await activeSession.evaluate({schemaVersion: evaluation.state.schemaVersion,
        value: Object.fromEntries(evaluation.view.parameters.map(parameter => [parameter.key, inputs[parameter.key]?.trim() ? Number(inputs[parameter.key]) : NaN]))});
      if (!active()) return;
      setEvaluation(next); setError(null);
      if (persist) {
        const data = LabDataSchema.parse({...object.data, state: next.state});
        const saved = await onSave({...toObjectInput(object), type: 'lab', title, data});
        if (saved && active()) {setDirty(false); onDirtyChange(false);}
      }
    } catch (reason) {if (active()) setError(pluginErrorCode(reason));}
    finally {if (active()) setBusy(false);}
  }
  async function restore() {
    if (busy) return;
    const currentGeneration = generation.current;
    setBusy(true);
    try {
      const next = await mountLab(object.data);
      if (generation.current !== currentGeneration) {next.dispose(); return;}
      session.current?.dispose(); session.current = next; setEvaluation(next.current);
      setInputs(Object.fromEntries(next.current.view.parameters.map(parameter => [parameter.key, String(parameter.value)])));
      setTitle(object.title); setDirty(false); setError(null);
    } catch (reason) {if (generation.current === currentGeneration) setError(pluginErrorCode(reason));}
    finally {if (generation.current === currentGeneration) setBusy(false);}
  }
  return <aside className="inspector lab-inspector" aria-label="Proprietà del laboratorio" data-plugin-status={evaluation && !error ? 'ready' : error ? 'error' : 'loading'} data-error-code={error ?? undefined}>
    <div className="inspector-heading"><h2>Esplora il modello</h2><button className="icon-button" aria-label="Chiudi proprietà" onClick={onClose}><X size={19}/></button></div>
    <div className="object-type"><span><FlaskConical size={24}/></span><div><strong>Molla ideale</strong><small>Revisione {object.revision} · Bozza</small></div></div>
    {error && <p role="alert" className="lab-error">Il laboratorio non ha accettato la modifica o non è verificabile. I dati salvati sono conservati.</p>}
    {!evaluation && !error && <p aria-live="polite">Verifica e apertura del laboratorio…</p>}
    <form id="object-editor" className="inspector-form" onSubmit={event => {event.preventDefault(); void calculate(true);}}>
      <label>Titolo<input aria-label="Titolo laboratorio" value={title} maxLength={240} required onChange={event => {setTitle(event.target.value); setDirty(true);}}/></label>
      {evaluation && <><p className="hint">{evaluation.view.summary}</p><fieldset className="lab-parameters" disabled={busy || !session.current}><legend>Parametri del modello</legend>
        {evaluation.view.parameters.map(parameter => <label key={parameter.key}><span>{parameter.label} <small>({parameter.unit})</small></span><input aria-label={`${parameter.label} (${parameter.unit})`} type="number" min={parameter.min} max={parameter.max} step={parameter.step} required value={inputs[parameter.key] ?? String(parameter.value)} onChange={event => {setInputs(current => ({...current, [parameter.key]: event.target.value}));setDirty(true);}}/></label>)}
      </fieldset><button className="secondary-button" type="button" disabled={busy || !dirty} onClick={() => void calculate(false)}>Aggiorna grafico</button><ScienceView view={evaluation.view}/></>}
      <button className="primary-button" type="submit" disabled={!dirty || busy || !evaluation}>{busy && evaluation ? 'Calcolo…' : 'Salva laboratorio'}</button>
      {dirty && <button className="text-button" type="button" disabled={busy} onClick={() => void restore()}><RotateCcw size={15}/> Ripristina stato salvato</button>}
    </form>
    <p className="privacy-note">La bozza e i parametri rimangono in questo browser.</p>
    <details className="lab-identity"><summary>Identità del laboratorio</summary><p>Oggetto <code>{object.id}</code></p><p>Istanza <code>{object.data.instanceId}</code></p><p>{object.data.pluginId} · versione {object.data.pluginVersion} · stato {object.data.stateSchemaVersion}</p><p>Firma e integrità ricontrollate a ogni apertura.</p></details>
    <button className="text-button danger" disabled={busy} onClick={async () => {if (await onRemove(object.id)) onClose();}}><Trash2 size={16}/> Rimuovi oggetto</button>
  </aside>;
}
