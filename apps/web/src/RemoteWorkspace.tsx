import {useEffect, useState, useSyncExternalStore} from 'react';
import {createRemoteClient, type WorkspaceSummary} from '@ardesia/remote-client';
import {App} from './App';
import {LearnerSpace} from './LearnerSpace';
import {newLesson} from './workspace';
import {connectMarketplace, disconnectMarketplace, syncMarketplace} from './plugins/first-party';

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
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState(''), [manage, setManage] = useState(false);
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
    void fetch('/api/m3', {cache: 'no-store'}).then(response => response.json()).then(value => {if (!stopped) setConfigured(value?.result?.configured === true);}).catch(() => {if (!stopped) setConfigured(null);});
    void client.session().then(discover).catch(reason => {if (reason?.code !== 'UNAUTHENTICATED' && !stopped) setError(reason instanceof Error ? reason.message : 'Servizio non disponibile.');}).finally(() => {if (!stopped) setLoading(false);});
    return () => {stopped = true; disconnectMarketplace();};
  }, []);
  useEffect(() => {
    if (!projection || !state.account || manage) {disconnectMarketplace(); return;}
    if (projection.actor.role === 'teacher') connectMarketplace(client.core, projection.actor, {refresh: () => client.refresh()});
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
        {state.account?.role === 'teacher' && <><label className="consent-option"><input type="checkbox" checked={confirmImport} onChange={event => setConfirmImport(event.target.checked)}/>
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
  const banner = <>
    {(error || state.error) && <div role="alert" className="remote-alert"><span>{error || state.error?.message}</span></div>}
    {state.recovery === 'invalid' && <section className="pending-panel"><h2>Copia di recupero da controllare</h2><p>Esporta l’originale prima di scartarlo.</p><button className="secondary-button" onClick={() => download('ardesia-next-recupero-originale.json', client.exportPendingRecovery() ?? '')}>Esporta recupero originale</button><button className="text-button" onClick={() => client.discardInvalidRecovery()}>Scarta copia di recupero non valida</button></section>}
    {state.pending.length > 0 && <section className="pending-panel" aria-label="Modifiche da recuperare">
      <h2>{state.status === 'conflict' ? 'Conflitto di revisione' : 'Modifiche in attesa di conferma'}</h2>
      <p>Verifica la richiesta inviata senza duplicarla. Riprendi poi esplicitamente le modifiche non inviate; le revisioni originali restano vincolanti.</p>
      {state.pending.map(pending => <div key={pending.commandId}><code>{pending.commandId}</code><span>{pending.status === 'blocked' ? 'Non inviata' : pending.status === 'queued' ? 'In coda, non inviata' : pending.status}</span>
        {pending.edit?.predecessorId && !state.pending.some(entry => entry.commandId === pending.edit!.predecessorId) && <span>Conferma precedente non disponibile. Esporta la bozza prima di ricomporla.</span>}
        {pending.status === 'blocked' || pending.status === 'queued'
          ? <button className="secondary-button" disabled={busy || pending.status === 'queued' || !!pending.edit?.predecessorId} onClick={() => void perform(() => client.resumePending(pending.commandId))}>Riprendi modifica non inviata</button>
          : <button className="secondary-button" disabled={busy || pending.status === 'pending'} onClick={() => void perform(() => client.retryPending(pending.commandId))}>Verifica e ritenta</button>}
        <button className="text-button" disabled={busy || pending.status === 'pending' || pending.status === 'queued'} onClick={() => void perform(async () => client.discardPending(pending.commandId))}>Scarta comando in attesa</button></div>)}
      <button className="secondary-button" onClick={() => download('ardesia-next-comandi-da-recuperare.json', JSON.stringify(state.pending, null, 2))}>Esporta modifiche da recuperare</button>
      {projection && <button className="secondary-button" onClick={() => void perform(() => client.refresh())}>Rileggi dal server</button>}
      {state.recovery === 'memory' && <p>Esporta i comandi prima di chiudere: il browser non può conservarli.</p>}
    </section>}
  </>;
  if (!state.account) return <main className="account-page"><div className="account-card"><a className="wordmark" href="#">Ardesia<span>.</span></a><h1>Il tuo spazio</h1>
    <p>Accedi al tuo account.</p>
    {configured === false && <p role="status" className="service-unavailable">Servizio non configurato. Puoi esportare il lavoro precedente.</p>}
    {banner}<form className="account-form" onSubmit={event => {event.preventDefault(); void perform(async () => {await client.login(username.trim(), password); setPassword(''); await discover();});}}>
      <label>Nome utente<input aria-label="Nome utente" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required maxLength={100}/></label>
      <label>Password<input aria-label="Password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={256}/></label>
      <button className="primary-button" disabled={busy || configured === false}>Accedi</button>
    </form>{recovery()}</div></main>;
  const account = state.account;
  if (manage || !projection || (account.role === 'teacher' && projection.documents.length === 0)) return <main className="account-page"><div className="account-card wide"><header className="account-heading"><h1>{account.displayName}</h1><button className="secondary-button" onClick={() => void perform(async () => {await client.logout(); setWorkspaces([]); setConfirmImport(false); setManage(false);})}>Esci</button></header>
    <p>{account.role === 'teacher' ? 'Account docente' : 'Account studente'} · <code>{account.id}</code></p>{banner}
    {projection && (account.role === 'student' || projection.documents.length > 0) && <button className="primary-button" onClick={() => setManage(false)}>Torna alla lezione</button>}
    <button className="secondary-button" disabled={busy} onClick={() => void perform(async () => {setWorkspaces(await client.listWorkspaces());})}>Aggiorna i miei spazi</button>
    <div className="lesson-list">{workspaces.map(workspace => <button className="lesson-row" key={workspace.workspaceId} onClick={() => void perform(() => select(workspace.workspaceId))}>{workspace.title}</button>)}</div>
    {account.role === 'teacher' && <form className="account-form" onSubmit={event => {event.preventDefault(); void perform(async () => {
      let next = client.projection;
      if (!next || manage) next = await client.createWorkspace(title.trim());
      await newLesson(client.core, next.actor, title.trim());
      try {sessionStorage.setItem(selectionKey(account.id), next.workspaceId);} catch { /* Optional selection. */ }
      setTitle(''); setManage(false);
    });}}><label>Titolo della lezione<input aria-label="Titolo prima lezione" value={title} onChange={event => setTitle(event.target.value)} required maxLength={240}/></label>
      <button className="primary-button" disabled={busy}>Crea lezione nel mio account</button></form>}
    {account.role === 'student' && !workspaces.length && <p>Attendi un’assegnazione dal docente, poi aggiorna gli spazi.</p>}
    {projection && <button className="secondary-button" onClick={() => void exportPersonal()}>Esporta i miei dati autorizzati</button>}{recovery()}
  </div></main>;
  const saveStatus = state.status === 'confirmed' && state.pending.length === 0 ? 'Confermato dal server' : state.status === 'loading' ? 'Aggiornamento dal server…' : 'Salvataggio da verificare';
  return <>{banner}{account.role === 'teacher'
    ? <App key={projection.workspaceId} workspaceId={projection.workspaceId} core={client.core} actor={projection.actor} onEdit={client.edit} saveStatus={saveStatus} onAccount={() => {setManage(true); void client.listWorkspaces().then(setWorkspaces).catch(() => undefined);}} onExport={exportPersonal}/>
    : <LearnerSpace key={projection.workspaceId} client={client} onAccount={() => {setManage(true); void client.listWorkspaces().then(setWorkspaces).catch(() => undefined);}}/>}
    <div className="remote-status" aria-live="polite">{saveStatus} · <button onClick={() => void perform(() => client.refresh())}>Aggiorna</button></div>
  </>;
}
