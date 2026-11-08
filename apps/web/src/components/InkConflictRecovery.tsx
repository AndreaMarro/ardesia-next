import {useEffect, useRef, useState} from 'react';
import {materialPosition} from '@ardesia/contracts';
import type {InkRecoveryPreview, RemoteClient} from '@ardesia/remote-client';
import {inkPath} from './board-geometry';

export default function InkConflictRecovery({client, onClose, onExport}: {client: RemoteClient; onClose: () => void; onExport: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<InkRecoveryPreview>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [selected, setSelected] = useState<string>('all');
  const alive = useRef(true);
  async function prepare() {
    setBusy(true); setError(''); setPreview(undefined);
    try {const next = await client.prepareInkRecovery(); if (alive.current) {setPreview(next); setSelected('all');}}
    catch (reason) {if (alive.current) setError(reason instanceof Error ? reason.message : 'Recupero interrotto. I tratti restano conservati.');}
    finally {if (alive.current) setBusy(false);}
  }
  useEffect(() => {
    alive.current = true; dialog.current?.showModal(); void prepare();
    return () => {alive.current = false; dialog.current?.close();};
  }, []);
  const focused = preview?.entries.filter(entry => selected === 'all' || entry.recoveryId === selected) ?? [];
  const left = Math.min(...focused.map(entry => entry.x)), top = Math.min(...focused.map(entry => entry.y));
  const right = Math.max(...focused.map(entry => entry.x + entry.object.width)), bottom = Math.max(...focused.map(entry => entry.y + entry.object.height));
  const padding = Math.max(24, (right - left) * .08, (bottom - top) * .08);
  async function confirm() {
    if (!preview) return;
    setBusy(true); setError('');
    try {await client.confirmInkRecovery(preview.token); if (alive.current) onClose();}
    catch (reason) {if (alive.current) {setPreview(undefined); setError(reason instanceof Error ? reason.message : 'Recupero interrotto. I tratti restano conservati.');}}
    finally {if (alive.current) setBusy(false);}
  }
  return <dialog ref={dialog} className="ink-recovery-dialog" aria-labelledby="ink-recovery-title" onCancel={event => {event.preventDefault(); if (!busy) onClose();}}>
    <div className="ink-recovery-heading"><div><p className="eyebrow">Riprendi la scrittura</p><h2 id="ink-recovery-title">Recupera i tuoi tratti</h2></div><button className="text-button" disabled={busy} onClick={onClose} aria-label="Chiudi recupero tratti">Chiudi</button></div>
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">{preview ? 'Recupero in corso. Attendi la conferma dei tratti…' : 'Lettura della lezione e dei tratti conservati…'}</p>}
    {preview && <>
      <p><strong>{preview.document.title}</strong> · {preview.entries.length} {preview.entries.length === 1 ? 'tratto' : 'tratti'} · account {preview.accountId}</p>
      <label>Inquadratura<select value={selected} onChange={event => setSelected(event.target.value)} disabled={busy}><option value="all">Tutti i tratti da recuperare</option>{preview.entries.map((entry, index) => <option value={entry.recoveryId} key={entry.recoveryId}>Tratto {index + 1} · {entry.object.title}</option>)}</select></label>
      <svg className="ink-recovery-preview" role="img" aria-label="Anteprima dei tratti sulla lezione aggiornata" viewBox={`${left - padding} ${top - padding} ${right - left + padding * 2} ${bottom - top + padding * 2}`}>
        {preview.document.objects.map(original => {
          const object = materialPosition(original, preview.document.objects);
          if (object.x + object.width < left - padding || object.x > right + padding || object.y + object.height < top - padding || object.y > bottom + padding) return null;
          if (object.type === 'ink') return <path key={object.id} d={inkPath(object.data.points, object.data.width)} fill={object.data.color} opacity=".35" transform={`translate(${object.x} ${object.y})`}/>;
          return <g key={object.id} opacity=".35"><rect x={object.x} y={object.y} width={object.width} height={object.height} fill="#dbe3e8" stroke="#526576"/><text x={object.x + 8} y={object.y + 18} fontSize="12">{object.title.slice(0, 80)}</text></g>;
        })}
        {preview.entries.map(entry => <path key={entry.recoveryId} d={inkPath(entry.object.data.points, entry.object.data.width)} fill={entry.object.data.color} transform={`translate(${entry.x} ${entry.y})`}/>) }
      </svg>
      <p className="muted">A colore pieno: tratti da recuperare. Attenuati: tratti salvati e ingombri degli altri oggetti.</p>
      {preview.entries.some(entry => entry.movedAnchor) && <p>Una pagina è stata spostata: l’anteprima segue la sua posizione attuale. Il tratto rimane legato alla stessa pagina.</p>}
      {preview.remaining > 0 && <p>{preview.remaining} altre modifiche restano in attesa. {preview.stoppedReason}</p>}
      <p>Tratti e fonti restano invariati. Se la lezione cambia, ricontrolla l’anteprima.</p>
    </>}
    <div className="ink-recovery-actions"><button className="secondary-button" disabled={busy} onClick={onExport}>Esporta tutti i tratti conservati</button>{preview
      ? <button className="primary-button" disabled={busy} onClick={() => void confirm()}>Conferma recupero di {preview.entries.length} {preview.entries.length === 1 ? 'tratto' : 'tratti'}</button>
      : <button className="primary-button" disabled={busy} onClick={() => void prepare()}>Rileggi e prepara anteprima</button>}</div>
  </dialog>;
}
