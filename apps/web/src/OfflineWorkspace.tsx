import {MaterialProvider} from './materials/MaterialView';
import {useState} from 'react';
import {HandoutView} from './handout/HandoutView';
import {prepareHandout} from './handout/prepare';
import type {Handout} from '@ardesia/lesson-os';
import type {NewEducationalObject} from '@ardesia/contracts';
import type {RemoteClient} from '@ardesia/remote-client';
import {Board} from './components/Board';
import {pendingObjectsForDocument,pendingRemovalsForDocument} from './workspace';

export function OfflineWorkspace({client}: {client: RemoteClient}) {
  const copy = client.offline!;
  const [documentId, setDocumentId] = useState(copy.documents[0]?.id ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [handout,setHandout]=useState<Handout|null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [savingInk, setSavingInk] = useState(0);
  const document = copy.documents.find(item => item.id === documentId) ?? copy.documents[0];
  const state = client.state;
  const pending = state.pending.filter(entry => entry.workspaceId === copy.workspaceId);
  async function ink(object: NewEducationalObject) {
    if (object.type !== 'ink' || !document) return false;
    setError(''); setSavingInk(count => count + 1);
    try {const result=await client.queueOfflineInk(document.id, object);return result.recovery==='durable';} catch (reason) {setError(reason instanceof Error ? reason.message : 'Tratto non salvato.');return false;}
    finally {setSavingInk(count => count - 1);}
  }
  async function erase(objectId:string){
    if(!document)return false;
    setSavingInk(count=>count+1);setError('');
    try {await client.queueOfflineEraseInk(document.id,objectId);return true;}catch(reason){setError(reason instanceof Error?reason.message:'Cancellazione non conservata.');return false;}
    finally{setSavingInk(count=>count-1);}
  }
  function exportCopy() {
    const bytes = JSON.stringify({format: 'ardesia-offline-recovery-v1', copy, recovery: client.exportPendingRecovery()}, null, 2);
    const url = URL.createObjectURL(new Blob([bytes], {type: 'application/json'}));
    const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = 'ardesia-copia-offline-e-recupero.json'; anchor.click(); URL.revokeObjectURL(url);
  }
  return <MaterialProvider access={client.offlineMaterials}><div className="offline-workspace" inert={busy} aria-busy={busy}>
    <header className="offline-heading"><a className="wordmark" href="#">Ardesia<span>.</span></a><div><strong>Il tuo spazio offline</strong><p>Copia personale di {copy.account.displayName} · nessuna sessione online attiva</p></div>
      <button className="secondary-button" disabled={busy || drawing || savingInk > 0} onClick={() => {setBusy(true); void client.logout().catch(() => undefined).finally(() => setBusy(false));}}>Chiudi ed esci</button></header>
    <main className="offline-main">
      <section className="offline-notice" aria-label="Stato della copia offline"><div><h1>{document?.title ?? copy.title}</h1>
        <p>Ultima copia dal server: <time dateTime={copy.savedAt}>{new Date(copy.savedAt).toLocaleString('it-IT')}</time>. Puoi continuare a scrivere; note e formule salvate restano consultabili.</p>
        <p role="status">{savingInk ? 'Salvataggio dei tratti sul dispositivo…' : state.recovery !== 'durable' ? 'Recupero non durevole: esporta prima di chiudere.' : `${pending.length} modifiche conservate sul dispositivo, da confermare online.`}</p></div>
        <div className="offline-actions"><button className="primary-button" disabled={busy || drawing || savingInk > 0} onClick={() => {setBusy(true); setError(''); void client.reconnect().catch(reason => setError(reason instanceof Error ? reason.message : 'Riconnessione non riuscita.')).finally(() => setBusy(false));}}>{busy ? 'Riconnessione…' : 'Ricollegati al server'}</button>
          <button className="secondary-button" onClick={exportCopy}>Esporta copia e tratti</button><button className="secondary-button" disabled={!document || drawing || savingInk>0} onClick={()=>{if(document)setHandout(prepareHandout(document));}}>Dispensa</button></div></section>
      {(error || state.error) && <div className="error-banner" role="alert">{error || state.error?.message}</div>}
      {copy.documents.length > 1 && <label className="offline-selector">Lezione disponibile <select disabled={busy || drawing || savingInk > 0} value={documentId} onChange={event => {setDocumentId(event.target.value); setSelectedId(null);}}>{copy.documents.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
      {document && <Board key={document.id} writingStatus={error||state.error?.message||(savingInk?'Conservazione sul dispositivo…':state.recovery!=='durable'?'Recupero non durevole · esporta i tratti':`Offline · ${pending.length} modifiche da confermare`)} inkRecovery={client.inkRecovery} onErase={erase} pendingRemovals={pendingRemovalsForDocument(pending,copy.workspaceId,document.id)} readOnlyObjects onInkActiveChange={setDrawing} document={document} selectedId={selectedId} onSelect={setSelectedId}
        pendingObjects={pendingObjectsForDocument(pending, copy.workspaceId, document.id)} onInk={object => ink(object)}
        onMove={() => undefined} onAdd={async () => undefined} onUndo={() => undefined} canUndo={false}/>}
      <p className="offline-footnote">La copia conserva la revisione {document?.revision ?? '—'}. I nuovi tratti saranno confermati soltanto dopo la verifica dell’account e delle revisioni. Laboratori e condivisioni richiedono la rete.</p>
    </main>
    {handout&&<HandoutView handout={handout} onClose={()=>setHandout(null)} notice={`Copia offline del ${new Date(copy.savedAt).toLocaleString('it-IT')}. I tratti in attesa di conferma non sono inclusi.`}/>}
  </div></MaterialProvider>;
}
