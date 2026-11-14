import type {ReactNode} from 'react';
import {ownsWorkspace} from '@ardesia/contracts';
import type {RemoteAccount,WorkspaceProjection,WorkspaceSummary} from '@ardesia/remote-client';
import {ArrowUpRight,Plus} from './Icons';
import './workspace-home.css';

type Props={
  account:RemoteAccount; projection:WorkspaceProjection|null; workspaces:WorkspaceSummary[];
  title:string; onTitle:(value:string)=>void; busy:boolean; banner:ReactNode; recovery:ReactNode;
  onCreate:()=>void; onSelect:(id:string)=>void; onRefresh:()=>void; onLogout:()=>void;
  onReturn:()=>void; onCourses:()=>void; onKnowledge?:()=>void; onTutor:()=>void; onExport:()=>void;
};
export function WorkspaceHome(p:Props){
  const owned=(value:WorkspaceSummary)=>(value.access??(p.account.role==='teacher'?'owner':'assigned'))==='owner';
  const personal=p.workspaces.filter(owned),assigned=p.workspaces.filter(value=>!owned(value));
  const currentIsOwned=p.projection&&ownsWorkspace(p.projection);
  const canReturn=!!p.projection&&(p.projection.documents.length>0||p.projection.assignedDocuments.length>0);
  const group=(title:string,items:WorkspaceSummary[],privateSpace:boolean)=><section className="spaces-collection" aria-label={title}>
    <div className="spaces-section-heading"><h2>{title}</h2><span>{items.length}</span></div>
    {items.length?<div className="spaces-list">{items.map((workspace,index)=><button className="spaces-entry" disabled={p.busy} key={workspace.workspaceId} onClick={()=>p.onSelect(workspace.workspaceId)}>
      <span className="spaces-number">{String(index+1).padStart(2,'0')}</span><span><strong>{workspace.title}</strong><small>{privateSpace?'Solo tuo · crea e studia':'Condiviso con te · continua a studiare'}</small></span><ArrowUpRight size={20}/>
    </button>)}</div>:<p className="spaces-empty">Le tue idee possono cominciare da una domanda, un disegno o una pagina vuota.</p>}
  </section>;
  return <main className="spaces-page">
    <header className="spaces-header"><span className="wordmark">Ardesia<span>.</span></span><span>Il tuo studio</span><button className="text-button" disabled={p.busy} onClick={p.onLogout}>Esci</button></header>
    {p.banner}
    <div className="spaces-content"><section className="spaces-welcome"><span className="eyebrow">Bentornato, {p.account.displayName}</span><h1>Uno spazio per<br/>le tue idee<span>.</span></h1><p>Studia, disegna, costruisci un nuovo strumento.<br/>Ogni progetto comincia da ciò che vuoi capire.</p>
      {p.projection&&<div className="spaces-resume">{canReturn&&<button className="primary-button" disabled={p.busy} onClick={p.onReturn}>Torna alla lezione <ArrowUpRight size={18}/></button>}<button className="secondary-button" disabled={p.busy} onClick={p.onCourses}>Apri corsi</button>{currentIsOwned&&p.onKnowledge&&<button className="text-button" disabled={p.busy} onClick={p.onKnowledge}>Apri conoscenza</button>}{currentIsOwned&&p.account.role==='teacher'&&<button className="text-button" disabled={p.busy} onClick={p.onTutor}>Apri studio tutor</button>}</div>}
    </section>
    <div className="spaces-layout"><div className="spaces-library">{group('I tuoi progetti',personal,true)}{assigned.length>0&&group('Condivisi con te',assigned,false)}<button className="text-button" disabled={p.busy} onClick={p.onRefresh}>Aggiorna i miei spazi</button></div>
      <aside className="spaces-new"><span className="eyebrow">Un nuovo inizio</span><h2>Che cosa ti<br/>incuriosisce?</h2><p>Apri una lavagna personale. Potrai aggiungere appunti, formule e oggetti inventati da te.</p><form onSubmit={event=>{event.preventDefault();p.onCreate();}}><label>Titolo della lezione<input aria-label="Titolo prima lezione" autoComplete="off" placeholder="Una domanda da esplorare…" value={p.title} onChange={event=>p.onTitle(event.target.value)} required maxLength={240}/></label><button className="primary-button" disabled={p.busy}><Plus size={18}/>Crea lezione nel mio account</button></form><small>Personale, anche se studi con un docente.</small></aside>
    </div>
    <footer className="spaces-footer"><details><summary>Account e portabilità</summary><p>{p.account.displayName} · {p.account.role==='teacher'?'Account docente':'Account studente'} · <code>{p.account.id}</code></p>{p.projection&&<button className="secondary-button" disabled={p.busy} onClick={p.onExport}>Esporta i miei dati autorizzati</button>}{p.recovery}</details><span>Studiare e creare, nello stesso luogo.</span></footer>
    </div>
  </main>;
}
