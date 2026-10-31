import {useEffect, useState, useSyncExternalStore} from 'react';
import {Check, FlaskConical, Search, ShieldCheck, Power, ArrowUpRight} from './Icons';
import type {CatalogPlugin, PluginCatalog, Capability} from '@ardesia/plugin-sdk';
import {loadCatalog, verifyModule, getInstallation, changeInstallation, checkUpdates, moduleStatus, marketplaceVersion, subscribeMarketplace, pluginErrorCode} from '../plugins/first-party';

type Props = {onAddLab: () => Promise<void>; addingLab: boolean; onChanged: () => void};
export function Marketplace(props: Props) {
  useSyncExternalStore(subscribeMarketplace, marketplaceVersion);
  const [catalog, setCatalog] = useState<PluginCatalog|null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string|null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadCatalog().then(value => {if (!cancelled) setCatalog(value);}).catch(reason => {if (!cancelled) setError(pluginErrorCode(reason));});
    return () => {cancelled = true;};
  }, []);
  const modules = catalog?.entries.filter((entry): entry is CatalogPlugin => entry.kind === 'plugin') ?? [];
  const filtered = modules.filter(entry => (entry.manifest.name + ' ' + entry.summary + ' ' + entry.manifest.publisher.id).toLocaleLowerCase('it').includes(query.toLocaleLowerCase('it')));
  const content = catalog?.entries.filter(entry => entry.kind === 'content') ?? [];
  return <section className="marketplace" aria-label="Catalogo moduli">
    <div className="marketplace-intro"><p className="lab-kicker">Strumenti per le tue lezioni</p><h3>Un’idea. Un esperimento.</h3><p>Scegli un laboratorio, verifica la sua origine e decidi quali capacità concedere.</p></div>
    <label className="marketplace-search"><Search size={18}/><input aria-label="Cerca moduli" placeholder="Cerca un laboratorio…" value={query} onChange={event => setQuery(event.target.value)}/></label>
    {error && <p role="alert" className="lab-error">Il catalogo non ha superato la verifica. I dati precedenti sono conservati. <code>{error}</code></p>}
    {!catalog && !error && <p role="status">Caricamento del catalogo…</p>}
    {filtered.map(entry => <ModuleCard key={entry.manifest.id + '@' + entry.manifest.version} entry={entry} {...props}/>)}
    {catalog && !filtered.length && <p className="marketplace-empty">Nessun laboratorio corrisponde alla ricerca.</p>}
    <details className="content-catalog"><summary>Pack, lezioni, manuali e template</summary><p>I contenuti raccolgono materiale senza eseguire codice.</p>{content.length ? <ul>{content.map(entry => <li key={entry.id + '@' + entry.version}>{entry.name} · {entry.version} · {entry.status}</li>)}</ul> : <p>Nessun contenuto installabile nel catalogo.</p>}</details>
    {catalog && <p className="catalog-footer">Catalogo v{catalog.schemaVersion} · revisione {catalog.revision} · {modules.length} {modules.length === 1 ? 'plugin scientifico' : 'plugin scientifici'} · salvataggio su questo dispositivo</p>}
  </section>;
}
function ModuleCard({entry, onAddLab, addingLab, onChanged}: Props & {entry: CatalogPlugin}) {
  useSyncExternalStore(subscribeMarketplace, marketplaceVersion);
  const manifest = entry.manifest, installed = getInstallation(manifest.id);
  const repositoryUrl = new URL(manifest.provenance.repository);
  const sourceUrl = repositoryUrl.protocol === 'https:' && !repositoryUrl.username && !repositoryUrl.password
    ? manifest.provenance.repository + '/blob/' + manifest.provenance.commit + '/' + manifest.provenance.path : null;
  const [verified, setVerified] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string|null>(null), [message, setMessage] = useState('');
  const [grants, setGrants] = useState<Capability[]>(() => (installed?.consent?.capabilities ?? []) as Capability[]);
  const status = moduleStatus(manifest.id);
  const revoked = status === 'Revocato' || entry.status === 'revoked';
  const authorized = !!installed?.consent && installed.release.capabilities.every(capability => installed.consent!.capabilities.includes(capability));
  async function act(action: () => Promise<void>) {
    if (busy || addingLab) return;
    setBusy(true); setError(null); setMessage(''); setVerified(false);
    try {await action(); onChanged();}
    catch (reason) {setVerified(false); setError(pluginErrorCode(reason));}
    finally {setBusy(false);}
  }
  const permissionLabel = (capability: Capability) => ({
    'state:read':'Consenti lettura dei parametri (state:read)',
    'state:write':'Consenti modifica dei parametri (state:write)',
    'objects:read':'Consenti lettura degli oggetti (objects:read)',
    'evidence:propose':'Consenti proposta di evidenze (evidence:propose)',
  })[capability];
  return <article className="module-card" aria-label={'Modulo ' + manifest.name} data-module-status={installed?.status ?? 'available'}>
    <div className="module-overview"><div className="module-cover" aria-hidden="true"><FlaskConical size={25}/><svg viewBox="0 0 280 105"><path d="M18 53H42L53 33 67 73 81 33 95 73 109 33 123 73 137 33 151 73 163 53H193" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><rect x="193" y="30" width="44" height="46" rx="8" fill="currentColor"/><path d="M12 84H267" stroke="currentColor" strokeOpacity=".22"/><text x="215" y="59" textAnchor="middle" fill="white" fontSize="18">m</text></svg><span>MECCANICA · MOTO ARMONICO</span></div><p className="lab-kicker">Plugin scientifico · {manifest.publisher.id}</p><h4>{manifest.name}</h4><p>{entry.summary}</p><div className="module-tags"><span>Versione {manifest.version}</span><span>SDK {manifest.sdkVersion}</span><span>Stato {manifest.stateSchemaVersion}</span></div>
      <details className="module-provenance"><summary>Provenienza e verifiche</summary><dl><div><dt>Publisher</dt><dd>{manifest.publisher.id}</dd></div><div><dt>Licenza</dt><dd>{manifest.license}</dd></div><div><dt>Origine</dt><dd><>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">Sorgente della release <ArrowUpRight size={13}/></a> : 'Origine non verificata'}</></dd></div><div><dt>Integrità</dt><dd>SHA-256 <code>{manifest.integrity.digest}</code></dd></div><div><dt>Firma</dt><dd>Ed25519 · {manifest.publisher.keyId}</dd></div></dl><p>Solo questa release first-party può essere eseguita. Non vengono caricati plugin arbitrari di terzi.</p></details>
    </div>
    <div className="module-controls"><span className={'module-status ' + (installed?.status ?? 'available')}><span/>{revoked ? 'Revocato' : status}</span>
      <button className="secondary-button module-verify" disabled={busy || addingLab} onClick={() => void act(async () => {await verifyModule(entry); setVerified(true); setMessage('Firma Ed25519, bundle SHA-256, publisher e release verificati.');})}><ShieldCheck size={17}/>{'Verifica ' + manifest.name}</button>
      {verified && <p className="verification-result"><Check size={15}/> Firma e integrità verificate</p>}
      {!installed && <><p>Installa il modulo, poi autorizza le capacità e attivalo quando vuoi usarlo.</p><button className="primary-button" disabled={!verified || busy || revoked} onClick={() => void act(async () => {const release = await verifyModule(entry); await changeInstallation({kind:'install-plugin',pluginId:manifest.id,release}); setMessage('Modulo installato e inattivo. Scegli le capacità da autorizzare.');})}>{'Installa ' + manifest.name}</button></>}
      {installed && !revoked && <>
        {installed.status !== 'active' && <fieldset className="module-consent" disabled={busy}><legend>Le capacità sono una tua scelta</legend>{manifest.capabilities.map(capability => <label key={capability}><input type="checkbox" checked={grants.includes(capability)} onChange={event => setGrants(current => event.target.checked ? [...current,capability] : current.filter(item => item !== capability))}/><span>{permissionLabel(capability)}</span></label>)}<p>Queste capacità riguardano soltanto i parametri dell’istanza del laboratorio.</p><button className="secondary-button" onClick={() => void act(async () => {await changeInstallation({kind:'consent-plugin',pluginId:manifest.id,releaseDigest:installed.release.bundleDigest,capabilities:grants}); setMessage('Consenso salvato per questa release. Il modulo resta inattivo fino all’attivazione.');})}>Salva autorizzazioni</button></fieldset>}
        {installed.status === 'active' ? <><p className="consent-summary"><Check size={16}/> Capacità autorizzate per la versione {installed.release.version}</p><button className="primary-button" disabled={busy || addingLab} onClick={() => void act(onAddLab)}>{addingLab ? 'Apertura del laboratorio…' : 'Aggiungi molla alla lezione'}</button><button className="secondary-button" disabled={busy || addingLab} onClick={() => void act(async () => {await changeInstallation({kind:'disable-plugin',pluginId:manifest.id}); setMessage('Modulo disattivato. Esperimenti e consensi sono conservati.');})}><Power size={16}/>{'Disattiva ' + manifest.name}</button></> : <button className="primary-button" disabled={busy || !authorized} onClick={() => void act(async () => {await changeInstallation({kind:'activate-plugin',pluginId:manifest.id}); setMessage('Modulo attivo. Puoi aggiungerlo alla lezione o riaprire gli esperimenti salvati.');})}>{'Attiva ' + manifest.name}</button>}
        <button className="text-button" disabled={busy || addingLab} onClick={() => void act(async () => setMessage(await checkUpdates(manifest.id)))}>Controlla aggiornamenti</button>
        <details className="module-revocation"><summary>Revoca del modulo</summary><p>La revoca rimuove il consenso e blocca il modulo in questo spazio. Gli esperimenti rimangono salvati.</p><button className="text-button danger" disabled={busy || addingLab} onClick={() => void act(async () => {await changeInstallation({kind:'revoke-plugin',pluginId:manifest.id}); setGrants([]); setMessage('Modulo revocato. I dati degli esperimenti sono conservati.');})}>{'Revoca ' + manifest.name}</button></details>
      </>}
      {revoked && <p className="revoked-note">L’esecuzione è bloccata. I tuoi esperimenti e la storia delle modifiche restano conservati.</p>}
      {installed?.consent && <details className="module-provenance"><summary>Autorizzazioni salvate</summary><p>Versione {installed.consent.release.version} · consenso del <time dateTime={installed.consent.grantedAt}>{new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(new Date(installed.consent.grantedAt))}</time></p><ul>{installed.consent.capabilities.map(capability => <li key={capability}><code>{capability}</code></li>)}</ul></details>}
      {installed && <p className="installation-revision">Installazione · revisione {installed.revision}</p>}
      {message && <p className="marketplace-message" role="status">{message}</p>}
      {error && <p className="lab-error" role="alert">Il modulo non ha superato la verifica o l’operazione richiesta. I dati precedenti sono conservati. <code>{error}</code></p>}
    </div>
  </article>;
}
