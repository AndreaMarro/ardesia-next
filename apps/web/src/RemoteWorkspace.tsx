import {MaterialProvider} from './materials/MaterialView';
import {lazy, Suspense, useEffect, useState, useSyncExternalStore} from 'react';
import {createRemoteClient, type WorkspaceSummary} from '@ardesia/remote-client';
import {App} from './App';
import {ownsWorkspace} from '@ardesia/contracts';
import {WorkspaceHome} from './components/WorkspaceHome';
import {OfflineWorkspace} from './OfflineWorkspace';
import {prepareOfflineShell} from './offline-shell';
import {CourseStudio} from './courses/CourseStudio';
import {LearnerSpace} from './LearnerSpace';
import {newLesson} from './workspace';
import {connectMarketplace, disconnectMarketplace, syncMarketplace} from './plugins/first-party';

const KnowledgeStudio = lazy(() => import('./knowledge/KnowledgeStudio'));
const TutorStudio = lazy(() => import('./tutor/TutorStudio'));
const InkConflictRecovery = lazy(() => import('./components/InkConflictRecovery'));
const client = createRemoteClient();
const selectionKey = (id: string) => 'ardesia-next-remote-workspace:' + id;
function download(name: string, bytes: string) {
  const url = URL.createObjectURL(new Blob([bytes], {type: 'application/json'}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}
function legacyBytes() {try {return localStorage.getItem('ardesia-next.core.v1');} catch {return null;}}

export function RemoteWorkspace() {
  const state = useSyncExternalStore(client.subscribe, () => client.state);
  const projection = client.projection;
  const [tutorOpen, setTutorOpen] = useState(() => location.hash === '#tutor');
  function tutor(open: boolean) {setTutorOpen(open); history.replaceState(null, '', open ? '#tutor' : location.pathname);}
  const [knowledgeOpen, setKnowledgeOpen] = useState(() => location.hash === '#idee');
  const [knowledgeTarget,setKnowledgeTarget]=useState<{accountId:string;workspaceId:string;documentId:string;objectId:string;objectRevision:number}>();
  useEffect(()=>{if(!knowledgeOpen)setKnowledgeTarget(undefined);},[knowledgeOpen]);
  function knowledge(open: boolean) {setKnowledgeOpen(open); history.replaceState(null, '', open ? '#idee' : location.pathname);}
  const [coursesOpen, setCoursesOpen] = useState(() => location.hash === '#corsi');
  function courses(open: boolean) {setCoursesOpen(open); history.replaceState(null, '', open ? '#corsi' : location.pathname);}
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | 'upgrade' | null>(null);
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState(''), [manage, setManage] = useState(false);
  const [inkRecoveryOpen, setInkRecoveryOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [title, setTitle] = useState('');
  const [legacy, setLegacy] = useState<string | null>(legacyBytes);
  const [confirmImport, setConfirmImport] = useState(false);
  async function select(id: string) {
    const next = await client.openWorkspace(id);
    try {sessionStorage.setItem(selectionKey(client.account!.id), next.workspaceId);} catch { /* A server-confirmed workspace remains available from its list. */ }
    setManage(false); setError('');
  }
  async function discover() {
    const list = await client.listWorkspaces(); setWorkspaces(list);
    let preferred: string | null = null;
    try {preferred = sessionStorage.getItem(selectionKey(client.account!.id));} catch { /* Optional navigation preference. */ }
    const found = list.find(item => item.workspaceId === preferred) ?? list[0];
    if (found) await select(found.workspaceId);
  }
  useEffect(() => {
    let stopped = false;
    void fetch('/api/m3', {cache: 'no-store'}).then(response => response.json()).then(value => {if (!stopped) setConfigured(value?.error?.code === 'SERVICE_UPGRADE_REQUIRED' ? 'upgrade' : value?.result?.configured === true);}).catch(() => {if (!stopped) setConfigured(null);});
    void client.session().then(discover).catch(async reason => {
      if (['NETWORK_ERROR', 'REQUEST_TIMEOUT'].includes(reason?.code)) {
        try {await client.openOffline(); return;} catch { /* Show the original connectivity failure if no usable copy exists. */ }
      }
      if (reason?.code !== 'UNAUTHENTICATED' && !stopped) setError(reason instanceof Error ? reason.message : 'Servizio non disponibile.');
    }).finally(() => {if (!stopped) setLoading(false);});
    return () => {stopped = true; disconnectMarketplace();};
  }, []);
  useEffect(() => {
    const disconnected = () => setError(client.state.offlineAvailable
      ? 'Rete assente. La bozza resta aperta. Per scrivere offline, apri la copia locale dalle Impostazioni.'
      : 'Rete assente. La bozza resta aperta; le nuove modifiche non sono ancora confermate.');
    window.addEventListener('offline', disconnected);
    return () => window.removeEventListener('offline', disconnected);
  }, []);
  useEffect(() => {
    if (!projection || !state.account || manage) {disconnectMarketplace(); return;}
    if (ownsWorkspace(projection)) connectMarketplace(client.core, projection.actor, {refresh: client.refresh});
    return disconnectMarketplace;
  }, [projection?.workspaceId, projection?.actor.actorId, state.account?.id, manage]);
  useEffect(() => {if (projection) syncMarketplace();}, [projection?.workspaceRevision]);
  useEffect(() => {
    if (!projection || !state.account) return;
    const refresh = () => {if (document.visibilityState === 'visible') void client.refresh().catch(() => undefined);};
    const timer = window.setInterval(refresh, 10_000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => {window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh);};
  }, [projection?.workspaceId, state.account?.id]);
  async function perform(action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try {await action();} catch (reason) {setError(reason instanceof Error ? reason.message : 'Operazione non confermata.');}
    finally {setBusy(false);}
  }
  async function exportPersonal() {await perform(async () => download('ardesia-next-esportazione-personale.json', JSON.stringify(await client.exportPersonal(), null, 2)));}
  function recovery() {
    return <section className="remote-recovery" aria-label="Recupero dati locali">
      <h2>Conserva il lavoro precedente</h2><p>Il lavoro precedente rimane intatto. Scegli tu se importarlo nel tuo account.</p>
      <label>Apri una copia esportata<input aria-label="Apri copia locale" type="file" accept="application/json,.json" onChange={event => {
        const file = event.target.files?.[0]; if (!file) return;
        if (file.size > 4 * 1024 * 1024) {setError('Limite di 4 MiB superato. Originale conservato.'); return;}
        void file.text().then(bytes => {setLegacy(bytes); setConfirmImport(false);});
      }}/></label>
      {legacy !== null && <><button className="secondary-button" onClick={() => download('ardesia-next-originale-locale.json', legacy)}>Esporta dati locali originali</button>
        {state.account && <><label className="consent-option"><input type="checkbox" checked={confirmImport} onChange={event => setConfirmImport(event.target.checked)}/>
          La copia è mia: importala nell’account {state.account.displayName} ({state.account.id})</label>
          <p>Importerai una copia con gli stessi ID e lo storico. Dovrai autorizzare nuovamente i moduli.</p>
          <button className="primary-button" disabled={busy || !confirmImport} onClick={() => void perform(async () => {
            const next = await client.importLocal({expectedAccountId: client.account!.id, snapshotText: legacy, title: 'Copia locale importata', commandId: crypto.randomUUID()});
            try {sessionStorage.setItem(selectionKey(client.account!.id), next.workspaceId);} catch { /* Optional selection. */ }
            setManage(false); setConfirmImport(false);
          })}>Importa copia nell’account</button></>}
      </>}
    </section>;
  }
  if (loading) return <main className="boot-screen"><h1>Ardesia</h1><p>Verifica accesso…</p></main>;
  if (client.offline) return <OfflineWorkspace key={client.offline.workspaceId} client={client}/>;
  const banner = <>
    {(error || state.error) && <div role="alert" className="remote-alert"><span>{error || state.error?.message}</span></div>}
    {state.recovery === 'invalid' && <section className="pending-panel"><h2>Copia di recupero da controllare</h2><p>Esporta l’originale prima di scartarlo.</p><button className="secondary-button" onClick={() => download('ardesia-next-recupero-originale.json', client.exportPendingRecovery() ?? '')}>Esporta recupero originale</button><button className="text-button" onClick={() => client.discardInvalidRecovery()}>Scarta copia di recupero non valida</button></section>}
    {state.pending.length > 0 && <section className="pending-panel pending-drawer" aria-label="Modifiche da recuperare"><details open={['conflict','uncertain','error'].includes(state.status)}><summary>{state.pending.length} modifiche da confermare · Apri recupero</summary>
      <h2>{state.status === 'conflict' ? 'Conflitto di revisione' : 'Modifiche in attesa di conferma'}</h2>
      <p>Verifica prima le richieste dall’esito incerto. Per i tratti respinti perché la lezione è cambiata, controlla l’anteprima e scegli se recuperarli.</p>
      {state.pending.map(pending => <div key={pending.commandId}><code>{pending.commandId}</code><span>{pending.status === 'blocked' ? 'Non inviata' : pending.status === 'queued' ? 'In coda, non inviata' : pending.status}</span>
        {pending.edit?.predecessorId && !state.pending.some(entry => entry.commandId === pending.edit!.predecessorId) && <span>Conferma precedente non disponibile. Esporta la bozza prima di ricomporla.</span>}
        {pending.status === 'blocked' || pending.status === 'queued'
          ? <button className="secondary-button" disabled={busy || pending.status === 'queued' || !!pending.edit?.predecessorId} onClick={() => void perform(() => client.resumePending(pending.commandId))}>Riprendi modifica non inviata</button>
          : <button className="secondary-button" disabled={busy || pending.status === 'pending'} onClick={() => void perform(() => client.retryPending(pending.commandId))}>Verifica e ritenta</button>}
        <button className="text-button" disabled={busy || pending.status === 'pending' || pending.status === 'queued'} onClick={() => void perform(async () => client.discardPending(pending.commandId))}>Scarta comando in attesa</button></div>)}
      <button className="secondary-button" onClick={() => download('ardesia-next-comandi-da-recuperare.json', client.exportPendingRecovery() ?? '')}>Esporta modifiche da recuperare</button>
      {projection && ownsWorkspace(projection) && state.pending.some(entry => entry.workspaceId === projection.workspaceId && entry.request.action === 'command' && entry.request.command.kind === 'add-object' && entry.request.command.object.type === 'ink' && ['blocked','conflict'].includes(entry.status)) && <button className="primary-button" disabled={busy} onClick={() => setInkRecoveryOpen(true)}>Anteprima recupero tratti</button>}
      {projection && <button className="secondary-button" onClick={() => void perform(() => client.refresh())}>Rileggi dal server</button>}
      {state.recovery === 'memory' && <p>Esporta i comandi prima di chiudere: il browser non può conservarli.</p>}
    </details></section>}
    {inkRecoveryOpen && state.account && projection && <Suspense fallback={<p role="status">Apertura recupero…</p>}><InkConflictRecovery key={state.account.id + ':' + projection.workspaceId} client={client} onClose={() => setInkRecoveryOpen(false)} onExport={() => download('ardesia-next-recupero-tratti.json', client.exportPendingRecovery() ?? '')}/></Suspense>}
  </>;
  if (!state.account) return <main className="account-page"><div className="account-card"><a className="wordmark" href="#">Ardesia<span>.</span></a><h1>Il tuo spazio</h1>
    <p>Accedi al tuo account.</p>
    {configured === false && <p role="status" className="service-unavailable">Servizio non configurato. Puoi esportare il lavoro precedente.</p>}
    {configured === 'upgrade' && <p role="status" className="service-unavailable">L’accesso richiede un aggiornamento del servizio. Contatta chi gestisce lo spazio. Puoi esportare il lavoro precedente.</p>}
    {banner}<form className="account-form" onSubmit={event => {event.preventDefault(); void perform(async () => {await client.login(username.trim(), password); setPassword(''); await discover();});}}>
      <label>Nome utente<input aria-label="Nome utente" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required maxLength={100}/></label>
      <label>Password<input aria-label="Password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={256}/></label>
      <button className="primary-button" disabled={busy || configured === false || configured === 'upgrade'}>Accedi</button>
    </form>{recovery()}</div></main>;
  const account = state.account;
  const personal = projection ? ownsWorkspace(projection) : false;
  const canOpenTutor = personal && account.role === 'teacher';
  if (manage || !projection || (personal && projection.documents.length === 0 && !coursesOpen && !knowledgeOpen && !(tutorOpen && canOpenTutor))) return <WorkspaceHome
    account={account} projection={projection} workspaces={workspaces} title={title} onTitle={setTitle} busy={busy || state.pending.length > 0} banner={banner} recovery={recovery()}
    onLogout={() => void perform(async () => {await client.logout(); setWorkspaces([]); setConfirmImport(false); setManage(false);})}
    onSelect={id => void perform(() => select(id))} onRefresh={() => void perform(async () => setWorkspaces(await client.listWorkspaces()))}
    onKnowledge={() => {setManage(false); knowledge(true);}} onReturn={() => setManage(false)} onCourses={() => {setManage(false); courses(true);}} onTutor={() => {setManage(false); tutor(true);}}
    onExport={() => void exportPersonal()} onCreate={() => void perform(async () => {
      let next = client.projection;
      if (!next || manage || !ownsWorkspace(next)) next = await client.createWorkspace(title.trim());
      await newLesson(client.core, next.actor, title.trim());
      try {sessionStorage.setItem(selectionKey(account.id), next.workspaceId);} catch { /* Optional navigation preference. */ }
      setTitle(''); setManage(false); setWorkspaces(await client.listWorkspaces());
    })}/>;
  const saveStatus = state.status === 'confirmed' && state.pending.length === 0 ? 'Confermato dal server' : state.status === 'loading' ? 'Aggiornamento dal server…' : 'Salvataggio da verificare';
  if (tutorOpen && canOpenTutor) return <>{banner}<Suspense fallback={<main className="boot-screen">Apertura dello studio…</main>}><TutorStudio key={projection.workspaceId} client={client} onClose={() => tutor(false)} onOpenLesson={id => {try {sessionStorage.setItem(`ardesia-next-document:${projection.actor.actorId}:${projection.workspaceId}`, id);} catch {setError('Seleziona la lezione dalla libreria.');} tutor(false);}}/></Suspense></>;
  if (knowledgeOpen && personal) return <MaterialProvider key={account.id+projection.workspaceId} access={client.materials}>{banner}<Suspense fallback={<main className="boot-screen">Apertura dell’archivio…</main>}><KnowledgeStudio key={projection.workspaceId} client={client} onClose={() => knowledge(false)} onOpenLesson={(documentId,objectId,objectRevision) => {setKnowledgeTarget({accountId:account.id,workspaceId:projection.workspaceId,documentId,objectId,objectRevision});try {sessionStorage.setItem(`ardesia-next-document:${projection.actor.actorId}:${projection.workspaceId}`, documentId);} catch { /* Explicit in-memory navigation still works. */ } knowledge(false);}}/></Suspense></MaterialProvider>;
  if (coursesOpen) return <MaterialProvider key={account.id+projection.workspaceId} access={client.materials}>{banner}<CourseStudio key={projection.workspaceId} client={client} onClose={() => courses(false)}/></MaterialProvider>;
  return <MaterialProvider key={account.id+projection.workspaceId} access={client.materials}>{banner}{personal
    ? <App initialSelection={knowledgeTarget?.accountId===account.id&&knowledgeTarget.workspaceId===projection.workspaceId?knowledgeTarget:undefined} onKnowledge={() => knowledge(true)} inkRecovery={client.inkRecovery} onTutor={account.role === 'teacher' ? () => tutor(true) : undefined} onCourses={() => courses(true)} sourceRevision={projection.workspaceRevision} recordingAccess={client.recordings} offlineControl={transition => <section className="offline-settings"><h2>Continua anche senza rete</h2><p>Conserva su questo dispositivo le tue lezioni personali di questo spazio. Le nuove annotazioni restano da confermare online. Non sono inclusi lavori degli studenti o autorizzazioni dei moduli.</p><button className="secondary-button" disabled={busy} onClick={() => {
        if (state.offlineAvailable) transition(() => perform(() => client.openOffline()));
        else void perform(async () => {await prepareOfflineShell(); await client.makeAvailableOffline();});
      }}>{busy ? 'Preparazione copia locale…' : state.offlineAvailable ? 'Usa copia offline' : 'Rendi disponibile offline'}</button>{error && <p role="alert">{error}</p>}</section>} pending={state.pending.filter(entry => entry.accountId === account.id)} key={projection.workspaceId} workspaceId={projection.workspaceId} core={client.core} actor={projection.actor} onEdit={client.edit} saveStatus={saveStatus} onAccount={() => {setManage(true); void client.listWorkspaces().then(setWorkspaces).catch(() => undefined);}} onExport={exportPersonal}/>
    : <LearnerSpace onCourses={() => courses(true)} key={projection.workspaceId} client={client} onAccount={() => {setManage(true); void client.listWorkspaces().then(setWorkspaces).catch(() => undefined);}}/>}
    <div className="remote-status" aria-live="polite">{saveStatus} · <button onClick={() => void perform(() => client.refresh())}>Aggiorna</button></div>
  </MaterialProvider>;
}
