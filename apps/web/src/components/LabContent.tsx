import {useEffect, useState} from 'react';
import type {LabObject} from '@ardesia/contracts';
import type {PluginView} from '@ardesia/plugin-sdk';
import type {PluginSession} from '@ardesia/plugin-host';
import {mountLab, pluginErrorCode} from '../plugins/first-party';
import {ScienceView} from './ScienceView';

export function LabContent({object, compact = false}: {object: LabObject; compact?: boolean}) {
  const [view, setView] = useState<PluginView|null>(null);
  const [error, setError] = useState<string|null>(null);
  useEffect(() => {
    let cancelled = false, session: PluginSession|undefined;
    setView(null); setError(null);
    void mountLab(object.data).then(result => {
      if (cancelled) {result.dispose(); return;}
      session = result; setView(result.current.view);
    }).catch(reason => {if (!cancelled) setError(pluginErrorCode(reason));});
    return () => {cancelled = true; session?.dispose();};
  }, [object.id, object.revision]);
  return <div className="lab-content" data-plugin-status={error ? 'error' : view ? 'ready' : 'loading'} data-error-code={error ?? undefined} data-instance-id={object.data.instanceId}>
    {error ? <p className="lab-error">Non è possibile verificare questo laboratorio. Lo stato salvato è conservato.</p> : view ? <><p className="lab-kicker">Laboratorio · {view.title}</p><ScienceView view={view} compact={compact}/></> : <p aria-live="polite">Verifica e apertura del laboratorio…</p>}
  </div>;
}
