import {recordingCommandRecovery} from './recovery';
import {useEffect, useMemo, useRef, useState, type MutableRefObject} from 'react';
import {RECORDING_PART_BYTES, type CoreEvent, type LessonDocument, type RecordingState, type RecordingSummary, type TranscriptCue, type RecordingCommand, type RecordingSearch} from '@ardesia/contracts';
import type {RecordingAccess} from '@ardesia/remote-client';
import {createRecordingReplay} from '@ardesia/lesson-os';
import {AudioCapture, browserTakeStore, finalizeTake, type CaptureStatus, type LocalTake} from './capture';

const stamp = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
function download(blob: Blob, filename: string) {const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);}
export function AudioSession({access, document: lesson, events, bridge, onBusy, onReplay, inkActive, canReplay, replayBlocked}: {
  access: () => RecordingAccess; document: LessonDocument; events: CoreEvent[]; bridge: MutableRefObject<AudioCapture | null>;
  onBusy: (busy: boolean) => void; onReplay: (document: LessonDocument | null) => boolean; inkActive: boolean; canReplay: () => boolean; replayBlocked: boolean;
}) {
  const api = useMemo(access, [access]), store = useMemo(browserTakeStore, []);
  const [open, setOpen] = useState(false), [consent, setConsent] = useState(false), [status, setStatus] = useState<CaptureStatus>('idle');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [local, setLocal] = useState<LocalTake[]>([]), [archive, setArchive] = useState<RecordingSummary[]>([]);
  const [selected, setSelected] = useState<RecordingState | null>(null), [media, setMedia] = useState<string | null>(null), [time, setTime] = useState(0);
  const [query, setQuery] = useState(''), [text, setText] = useState(''), [from, setFrom] = useState('0'), [to, setTo] = useState('1');
  const [transcriptVersion, setTranscriptVersion] = useState(0);
  const [archiveQuery, setArchiveQuery] = useState(''), [hits, setHits] = useState<RecordingSearch | null>(null);
  const [pending, setPending] = useState<RecordingCommand | null>(null);
  const recovery = useMemo(() => recordingCommandRecovery(localStorage, api.accountId, api.workspaceId), [api]);
  const mounted = useRef(true), audio = useRef<HTMLAudioElement>(null), panel = useRef<HTMLDivElement>(null), frame = useRef(0), operation = useRef(0), latest = useRef({events, lesson});
  const replayReader = useRef<{events: CoreEvent[]; capture: RecordingState['capture']; replay: ReturnType<typeof createRecordingReplay>} | null>(null);
  latest.current = {events, lesson};
  async function reload() {
    const takes = await store.list(api.accountId, api.workspaceId, lesson.id);
    if (mounted.current) setLocal(takes);
    const summaries = await api.list(lesson.id); if (mounted.current) setArchive(summaries);
  }
  async function perform(action: () => Promise<void>) {
    if (busy) return; setBusy(true); setError('');
    try {await action();} catch (error) {if (mounted.current) setError(error instanceof Error ? error.message : 'Operazione non confermata.');}
    finally {if (mounted.current) setBusy(false);}
  }
  useEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false; operation.current++; bridge.current?.cancelPermission(); bridge.current = null; cancelAnimationFrame(frame.current); onBusy(false); onReplay(null);};
  }, []);
  useEffect(() => {if (open) void perform(reload);}, [open]);
  useEffect(() => {if (selected) panel.current?.scrollTo({top: 0});}, [selected?.summary.recordingId]);
  useEffect(() => {bridge.current?.observe(events);}, [lesson.revision]);
  useEffect(() => {onBusy(status !== 'idle' || busy || text.length > 0);}, [status, busy, text]);
  useEffect(() => {
    if (status === 'idle' && open) void store.list(api.accountId, api.workspaceId, lesson.id).then(takes => {if (mounted.current) setLocal(takes);});
    const unload = (event: BeforeUnloadEvent) => {event.preventDefault();};
    if (status !== 'idle') window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [status]);
  useEffect(() => () => {if (media) URL.revokeObjectURL(media);}, [media]);
  useEffect(() => {
    if (!selected?.capture) {onReplay(null); return;}
    try {
      if (replayReader.current?.events !== events || replayReader.current.capture !== selected.capture) replayReader.current = {events, capture: selected.capture, replay: createRecordingReplay(selected.capture, events)};
      if (!onReplay(replayReader.current.replay.frame(time))) {audio.current?.pause(); setSelected(null); setMedia(null); setError('Salva o scarta la bozza prima del replay.');}} catch {audio.current?.pause(); cancelAnimationFrame(frame.current); setError('Storico incompleto: replay sospeso sull’ultimo fotogramma verificato.');}
  }, [selected, time, lesson.revision]);
  function followAudio() {
    if (audio.current) setTime(audio.current.currentTime * 1000);
    if (audio.current && !audio.current.paused) frame.current = requestAnimationFrame(followAudio);
  }
  function stopReplay() {operation.current++; replayReader.current = null; audio.current?.pause(); cancelAnimationFrame(frame.current); setSelected(null); setMedia(null); setText(''); onReplay(null);}
  function seek(ms: number) {setTime(ms); if (audio.current) audio.current.currentTime = ms / 1000;}
  async function start() {
    if (!consent || inkActive) return;
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) throw Error('Registrazione non disponibile in questo browser. Usa HTTPS o localhost e un browser con MediaRecorder.');
    stopReplay();
    const recorder = new AudioCapture(store, (status, failure) => {
      if (!mounted.current) return; setStatus(status);
      if (failure) setError('Registrazione da recuperare: ' + (failure instanceof Error ? failure.message : 'errore audio'));
    });
    bridge.current = recorder;
    await recorder.start({accountId: api.accountId, workspaceId: api.workspaceId, documentId: lesson.id, title: lesson.title + ' · audio', baseRevision: latest.current.lesson.revision}, () => latest.current.lesson.revision);
    recorder.observe(latest.current.events);
  }
  async function upload(take: LocalTake) {
    const blob = await store.audio(take), capture = await finalizeTake(take, blob, latest.current.events);
    // Persist the exact request before dispatch. Retry IDs are deterministic per capture.
    const durable = {...take, capture}; await store.save(durable);
    await api.command({kind: 'prepare-recording', commandId: take.id + ':prepare', recordingId: take.id, expectedRevision: 0, capture});
    for (const part of capture.parts) await api.upload(take.id, part, blob.slice(part.index * RECORDING_PART_BYTES, part.index * RECORDING_PART_BYTES + part.bytes));
    await api.command({kind: 'finish-recording', commandId: take.id + ':finish', recordingId: take.id, expectedRevision: 1});
    await store.remove(take.id); await reload();
  }
  async function play(id: string, atMs = 0, expectedRevision?: number) {
    if (!canReplay()) throw Error('Salva o scarta la bozza e termina il tratto prima del replay.');
    const generation = ++operation.current;
    const state = await api.read(id), blob = await api.download(state);
    if (!mounted.current || generation !== operation.current) return;
    if (!canReplay()) throw Error('La bozza è cambiata: salvala o scartala prima di aprire il replay.');
    if (state.summary.documentId !== lesson.id) throw Error('La registrazione appartiene a un’altra lezione.');
    if (!state.capture) throw Error('Registrazione non disponibile.');
    if (expectedRevision !== undefined && state.summary.revision !== expectedRevision) throw Error('La registrazione è cambiata: ripeti la ricerca per aprire il riferimento corretto.');
    const commands = recovery.list(id), replay = createRecordingReplay(state.capture, latest.current.events);
    if (!onReplay(replay.frame(atMs))) throw Error('Salva o scarta la bozza prima del replay.');
    replayReader.current = {events: latest.current.events, capture: state.capture, replay};
    setPending(commands[0] ?? null);
    setSelected(state); setMedia(URL.createObjectURL(blob)); setTime(atMs); setTranscriptVersion(state.transcripts.at(-1)?.revision ?? 0); setQuery('');
  }
  async function sendTranscript(command: RecordingCommand) {
    recovery.remember(command); setPending(command);
    const next = await api.command(command);
    if (!mounted.current) return;
    recovery.acknowledge(command);
    setPending(recovery.list(command.recordingId)[0] ?? null);
    if (next.summary.status === 'erased') {stopReplay(); await reload(); return;}
    setSelected(next);
    setTranscriptVersion(next.transcripts.at(-1)?.revision ?? 0); setText('');
  }
  async function addCue() {
    if (!selected?.capture) return;
    const cue: TranscriptCue = {id: crypto.randomUUID(), fromMs: Number(from) * 1000, toMs: Number(to) * 1000, text};
    const cues = [...(selected.transcripts.at(-1)?.cues ?? []), cue].sort((a,b) => a.fromMs - b.fromMs);
    await sendTranscript({kind: 'edit-recording-transcript', commandId: crypto.randomUUID(), recordingId: selected.summary.recordingId, expectedRevision: selected.summary.revision, origin: 'manual', cues});
  }
  const transcript = selected?.transcripts.find(transcript => transcript.revision === transcriptVersion);
  return <section className={`audio-session ${open ? 'is-open' : ''}`} aria-label="Audio e replay">
    <div className="audio-heading"><button className="text-button" aria-label="Audio e replay" aria-expanded={open} onClick={() => {if (selected) {if (text || busy) return; stopReplay();} setOpen(!open);}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg><span>Audio{status === 'recording' ? ' · In corso' : ''}</span></button>
      {status !== 'idle' && <button className="secondary-button" disabled={status === 'stopping' || (status === 'recording' && inkActive)} onClick={() => bridge.current?.stop()}>{status === 'requesting' ? 'Annulla richiesta microfono' : 'Interrompi registrazione'}</button>}
      {selected && <button className="secondary-button" disabled={busy || !!text} onClick={stopReplay}>Torna alla lavagna attuale</button>}
    </div>
    {open && <div className="audio-panel" ref={panel}>
      {!selected && <p>Registra la spiegazione insieme alla scrittura. Audio personale, accessibile soltanto dal tuo account.</p>}
      {!selected && <><label className="consent-option"><input aria-label="Consenso alla registrazione audio" type="checkbox" checked={consent} onChange={event => {setConsent(event.target.checked); if (!event.target.checked) bridge.current?.cancelPermission();}}/>Autorizzo il microfono e ho il consenso delle persone registrate.</label>
        <button className="primary-button" disabled={!consent || busy || status !== 'idle' || inkActive} onClick={() => void perform(start)}>Registra spiegazione</button>
        {status === 'recording' && <p role="status" className="recording-live">● Microfono attivo · frammenti salvati sul dispositivo, caricamento solo a fine registrazione.</p>}</>}
      {error && <p role="alert">{error}</p>}
      {bridge.current?.memoryAudio()?.size && error ? <button className="secondary-button" onClick={() => {const blob = bridge.current?.memoryAudio(); if (blob) download(blob, 'ardesia-audio-recupero');}}>Esporta audio in memoria</button> : null}
      {local.length > 0 && <div className="audio-list"><h2>Da archiviare</h2>{local.map(take => <div key={take.id}><span>{take.title} · {stamp(take.durationMs)} · {take.complete ? 'sul dispositivo' : 'registrazione interrotta'}</span>
        <button className="secondary-button" disabled={busy || status !== 'idle' || !take.complete} onClick={() => void perform(() => upload(take))}>Archivia / riprendi caricamento</button>
        <button className="text-button" disabled={busy || status !== 'idle'} onClick={() => void perform(async () => download(await store.audio(take, !take.complete), take.id + (take.complete ? '.audio' : '.partial-audio')))}>{take.complete ? 'Esporta audio originale' : 'Esporta frammenti disponibili'}</button>
        <button className="text-button" disabled={busy || status !== 'idle'} onClick={() => void perform(async () => {download(new Blob([JSON.stringify(take, null, 2)], {type: 'application/json'}), take.id + '.json');})}>Esporta tempi e riferimenti</button>
      </div>)}</div>}
      {!selected && <div className="audio-list"><h2>Archivio della lezione</h2><form onSubmit={event => {event.preventDefault(); void perform(async () => {setHits(await api.search(lesson.id, archiveQuery));});}}><label>Cerca nelle registrazioni<input aria-label="Cerca nelle registrazioni" value={archiveQuery} maxLength={200} onChange={event => setArchiveQuery(event.target.value)} required/></label><button className="secondary-button" disabled={busy || !archiveQuery.trim()}>Cerca nell’archivio audio</button></form>
        {hits && <div className="transcript-cues"><p>{hits.total} risultati{hits.total > hits.matches.length ? ' · primi 100, affina la ricerca' : ''}</p>{hits.matches.map((hit, index) => <button key={index} disabled={busy || replayBlocked || status !== 'idle'} onClick={() => void perform(() => play(hit.recordingId, hit.atMs, hit.recordingRevision))}><time>{stamp(hit.atMs)}</time><span>{hit.title} · {hit.excerpt}</span></button>)}</div>}
        <button className="text-button" disabled={busy} onClick={() => void perform(reload)}>Aggiorna registrazioni</button>
        {archive.length === 0 && <p>Nessuna registrazione archiviata.</p>}{archive.map(item => <div key={item.recordingId}><span>{item.title} · {stamp(item.durationMs ?? 0)}</span>
          <button className="secondary-button" disabled={busy || replayBlocked || status !== 'idle' || item.status !== 'ready'} onClick={() => void perform(() => play(item.recordingId))}>{item.status === 'ready' ? 'Apri replay' : 'Caricamento da completare sul dispositivo originale'}</button></div>)}</div>}
      {selected?.capture && <div className="audio-player"><h2>{selected.summary.title}</h2><p>Replay della revisione {selected.capture.baseRevision}–{selected.capture.endRevision} · {stamp(time)} / {stamp(selected.capture.durationMs)}</p>
        <audio ref={audio} src={media ?? undefined} controls preload="metadata" aria-label="Riproduci registrazione" onLoadedMetadata={() => {if (audio.current) audio.current.currentTime = time / 1000;}} onPlay={() => {cancelAnimationFrame(frame.current); followAudio();}} onPause={() => cancelAnimationFrame(frame.current)} onTimeUpdate={event => setTime(event.currentTarget.currentTime * 1000)} onSeeked={event => setTime(event.currentTarget.currentTime * 1000)}/>
        <label>Posizione nel replay<input type="range" aria-label="Posizione nel replay" min="0" max={selected.capture.durationMs} step="any" value={time} onChange={event => seek(Number(event.target.value))}/></label>
        <div className="transcript-panel"><h3>Trascrizione</h3><p>Aggiungi segmenti con i tempi in secondi, oppure importa un file JSON con campi fromMs, toMs e text. Il riconoscimento automatico non è attivo.</p>
          <label>Versione<select aria-label="Versione trascrizione" value={transcriptVersion} onChange={event => setTranscriptVersion(Number(event.target.value))}>{selected.transcripts.length === 0 ? <option value="0">Nessuna</option> : selected.transcripts.map(version => <option key={version.revision} value={version.revision}>{version.revision} · {version.origin === 'manual' ? 'manuale' : 'importata'}</option>)}</select></label>
          <label>Cerca nella trascrizione<input aria-label="Cerca nella trascrizione" value={query} onChange={event => setQuery(event.target.value)}/></label>
          <div className="transcript-cues">{transcript?.cues.filter(cue => cue.text.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(cue => <button key={cue.id} onClick={() => seek(cue.fromMs)}><time>{stamp(cue.fromMs)}</time><span>{cue.text}</span></button>)}</div>
          {pending && <div role="status"><p>Una modifica attende conferma. Il tentativo conserva testo, tempi e identificatore originali.</p><button className="secondary-button" disabled={busy} onClick={() => void perform(() => sendTranscript(pending))}>Verifica modifica trascrizione</button><button className="text-button" disabled={busy} onClick={() => {recovery.acknowledge(pending); setPending(recovery.list(pending.recordingId)[0] ?? null);}}>Scarta richiesta locale (non annulla il server)</button></div>}
          <form onSubmit={event => {event.preventDefault(); void perform(addCue);}}><div className="cue-times"><label>Da (secondi)<input aria-label="Trascrizione da secondi" type="number" step="0.01" min="0" value={from} onChange={event => setFrom(event.target.value)} required/></label><label>A (secondi)<input aria-label="Trascrizione a secondi" type="number" step="0.01" min="0" value={to} onChange={event => setTo(event.target.value)} required/></label></div><label>Testo<textarea aria-label="Testo trascrizione" value={text} onChange={event => setText(event.target.value)} maxLength={10000} required/></label><button className="secondary-button" disabled={busy || !!pending}>Aggiungi segmento</button>{text && <button type="button" className="text-button" onClick={() => setText('')}>Scarta testo non salvato</button>}</form>
          <label>Importa trascrizione<input aria-label="Importa trascrizione JSON" type="file" accept="application/json,.json" disabled={busy || !!pending} onChange={event => {const file = event.target.files?.[0]; if (!file) return; void perform(async () => {
            if (file.size > 2_000_000) throw Error('Il file supera il limite di 2 MB.');
            const value: unknown = JSON.parse(await file.text()); if (!Array.isArray(value)) throw Error('Il file deve contenere un elenco di segmenti.');
            const cues = value.map(cue => ({...cue, id: crypto.randomUUID()}));
            await sendTranscript({kind: 'edit-recording-transcript', commandId: crypto.randomUUID(), recordingId: selected.summary.recordingId, expectedRevision: selected.summary.revision, origin: 'imported', cues});
          });}}/></label>
        </div>
        <button className="text-button" disabled={busy} onClick={() => void perform(async () => {const blob = await api.download(selected); if (mounted.current) download(blob, selected.summary.recordingId + '.audio');})}>Esporta audio</button>
        <button className="text-button" onClick={() => download(new Blob([JSON.stringify(selected, null, 2)], {type: 'application/json'}), selected.summary.recordingId + '.json')}>Esporta trascrizioni e riferimenti</button>
        <details><summary>Elimina registrazione</summary><p>Rimuove l’audio e tutte le versioni della trascrizione dal server. Le esportazioni già scaricate restano sul dispositivo.</p><button className="secondary-button" disabled={busy} onClick={() => void perform(async () => {
          await api.command({kind: 'erase-recording', commandId: selected.summary.recordingId + ':erase:' + selected.summary.revision, recordingId: selected.summary.recordingId, expectedRevision: selected.summary.revision});
          stopReplay(); await reload();
        })}>Elimina definitivamente audio e trascrizioni</button></details>
      </div>}
    </div>}
  </section>;
}
