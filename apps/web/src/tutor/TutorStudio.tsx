import {TutorEconomicsPanel} from './TutorEconomicsPanel';
import {useEffect,useRef,useState} from 'react';
import {projectDocumentRevision,tutorBalance,tutorCharges,tutorPackageUsage,type TutorInput,type TutorRecord,type TutorCommand,type LessonDocument} from '@ardesia/contracts';
import type {RemoteClient} from '@ardesia/remote-client';
import {Dialog} from '../components/Dialog';
import {ObjectContent} from '../components/ObjectContent';
import {ArrowUpRight,Plus} from '../components/Icons';
import {blank,inputOf,kindLabels,statusLabels,localDate,localInstant,readMoney,moneyInput,money,totals,calendarFile} from './values';
import {TutorEditor,DateField} from './TutorEditor';
import './tutor.css';

type Section='appointment'|'contact'|'request'|'group'|'package'|'payment';
type Draft={id:string;revision:number;input:TutorInput};
const download=(name:string,content:string,type='application/json')=>{const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);};
const timestamp=(at:string)=>new Date(at).toLocaleString('it-IT',{dateStyle:'medium',timeStyle:'short'});

export default function TutorStudio({client,onClose,onOpenLesson}:{client:RemoteClient;onClose:()=>void;onOpenLesson:(id:string)=>void}){
  const actor=client.projection!.actor,space=client.core.getTutorSpace(actor),records=space.records;
  const [section,setSection]=useState<Section>('appointment'),[day,setDay]=useState(localDate(new Date().toISOString()).slice(0,10));
  const [query,setQuery]=useState(''),[selected,setSelected]=useState<string|null>(null),[draft,setDraft]=useState<Draft|null>(null);
  const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [leave,setLeave]=useState<(()=>void)|null>(null),[cash,setCash]=useState<{target:TutorRecord;contactId:string;currency:string;dueMinor:number}|null>(null),[voiding,setVoiding]=useState<string|null>(null);
  const [material,setMaterial]=useState<LessonDocument|null>(null);
  const generation=useRef(0),lock=useRef(false),route=useRef('');route.current=draft?.id??selected??section;
  const action=useRef<{id:string;route:string;done?:()=>void}|null>(null);
  const blocked=busy||client.state.pending.length>0;
  useEffect(()=>client.subscribeReceipts((request,receipt)=>{
    if(request.action!=='tutor-command'||receipt.commandId!==action.current?.id)return;
    const pending=action.current;action.current=null;if(route.current===pending.route){pending.done?.();setError('');setMessage('Salvato nello spazio.');}
  }),[client]);
  useEffect(()=>{if(!dirty&&!busy&&!cash&&!voiding)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty,busy,cash,voiding]);
  function navigate(next:()=>void){if(busy)return;if(dirty)setLeave(()=>next);else{setError('');setMessage('');next();}}
  function home(next:Section=section){navigate(()=>{setSection(next);setSelected(null);setDraft(null);setDirty(false);setQuery('');});}
  function select(record:TutorRecord){navigate(()=>{setSelected(record.id);setDraft(null);setDirty(false);});}
  function edit(record?:Exclude<TutorRecord,{kind:'payment'}>,input?:TutorInput){navigate(()=>{
    const value=input??(record?inputOf(record):blank(section==='payment'?'contact':section,records.find(r=>r.kind==='contact')?.id??'',day));
    setDraft({id:record?.id??crypto.randomUUID(),revision:record?.revision??0,input:value});setDirty(!record);generation.current++;setSelected(null);
  });}
  async function run(command:TutorCommand,done?:()=>void){
    if(lock.current||blocked)return;lock.current=true;setBusy(true);setError('');setMessage('');action.current={id:command.commandId,route:route.current,done};
    try{await client.core.executeTutor(actor,command);}catch(reason){setError(reason instanceof Error?reason.message:'Operazione non confermata.');}finally{lock.current=false;setBusy(false);}
  }
  function save(input:TutorInput,reason:string){if(!draft)return;const sent=generation.current;
    void run({kind:'save-tutor-record',commandId:crypto.randomUUID(),recordId:draft.id,expectedRevision:draft.revision,input,reason},()=>{
      setDraft(current=>current?.id===draft.id?{...current,revision:draft.revision+1,input}:current);if(sent===generation.current)setDirty(false);
    });
  }
  function moveDay(days:number){const date=new Date(day+'T12:00');date.setDate(date.getDate()+days);setDay(localDate(date.toISOString()).slice(0,10));}
  const record=records.find(r=>r.id===selected),contactName=(id:string)=>{const found=records.find(r=>r.id===id);return found&&'title'in found?found.title:id;};
  const title=(record:TutorRecord)=>record.kind==='payment'?`${money(record.amountMinor,record.currency)} · ${contactName(record.contactId)}`:record.title;
  const subtitle=(record:TutorRecord)=>record.kind==='appointment'?`${timestamp(record.startAt)} · ${record.participants.map(p=>contactName(p.contactId)).join(', ')}`
    :record.kind==='payment'?`${timestamp(record.paidAt)} · ${record.method}`:record.kind==='contact'?record.email||record.phone||'Scheda personale'
    :record.kind==='package'?`${record.totalMinutes} minuti · ${contactName(record.contactId)}`:record.kind==='request'?contactName(record.contactId):`${record.contactIds.length} partecipanti`;
  const list=records.filter(r=>r.kind===section&&(!query||[title(r),subtitle(r),r.notes].join(' ').toLocaleLowerCase('it').includes(query.toLocaleLowerCase('it')))
    &&(section!=='appointment'||query||r.kind==='appointment'&&localDate(r.startAt).slice(0,10)===day))
    .sort((a,b)=>a.kind==='appointment'&&b.kind==='appointment'?a.startAt.localeCompare(b.startAt):a.kind==='payment'&&b.kind==='payment'?b.paidAt.localeCompare(a.paidAt):title(a).localeCompare(title(b),'it'));
  const stats=totals(records),appointments=records.filter(r=>r.kind==='appointment'),upcoming=appointments.filter(r=>r.status==='scheduled'&&Date.parse(r.endAt)>=Date.now());
  function openMaterial(value:Extract<TutorRecord,{kind:'appointment'}>){try{if(value.lesson)setMaterial(projectDocumentRevision(client.projection!.events,value.lesson.documentId,value.lesson.revision));}catch{setError('La revisione della lezione non è disponibile.');}}
  function chargeRows(target:TutorRecord){return tutorCharges(target).map(charge=>{const balance=tutorBalance(records,target.id,charge.contactId)!;return <div className="tutor-charge-row" key={charge.contactId}><div><strong>{contactName(charge.contactId)}</strong><span>{money(balance.amountMinor,charge.currency)} da registrare · {money(balance.paidMinor,charge.currency)} annotati</span></div><div><strong>{money(balance.dueMinor,charge.currency)}</strong><span>Residuo</span></div><button className="secondary-button" disabled={blocked||balance.dueMinor<=0} onClick={()=>setCash({target,contactId:charge.contactId,currency:charge.currency,dueMinor:balance.dueMinor})}>Registra pagamento</button></div>;});}
  return <div className="tutor-shell">
    <header className="tutor-header"><a className="wordmark" href="#" onClick={e=>{e.preventDefault();navigate(onClose);}}>Ardesia<span>.</span></a><span className="tutor-header-rule"/><span>Il tuo studio</span><button className="secondary-button" disabled={busy} onClick={()=>navigate(onClose)}>Torna alla lavagna <ArrowUpRight size={16}/></button></header>
    <div className="tutor-layout"><aside className="tutor-sidebar"><span className="eyebrow">Insieme, ogni giorno</span><h1>Studio<span>.</span></h1>
      <nav aria-label="Gestionale tutor">{(['appointment','contact','request','group','package','payment'] as const).map((kind,index)=><button key={kind} aria-current={section===kind?'page':undefined} onClick={()=>home(kind)}><span className="tutor-nav-index">0{index+1}</span>{kind==='payment'?'Conti':kindLabels[kind]}<small>{records.filter(r=>r.kind===kind).length}</small></button>)}</nav>
      <div className="tutor-sidebar-note"><span className="tutor-dot"/>Uno spazio privato<p>Le persone, il lavoro e il tempo che dedichi all’insegnamento.</p></div>
      <button className="text-button" onClick={()=>download('ardesia-studio.json',JSON.stringify({format:'ardesia-tutor-export/1',workspaceId:client.projection!.workspaceId,...space},null,2))}>Esporta lo studio ↗</button>
    </aside><main className="tutor-main">
      <div className="tutor-notices" aria-live="polite">{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</div>
      {!draft&&!record&&<><div className="tutor-page-heading"><div><span className="eyebrow">{section==='appointment'?'Il ritmo delle tue lezioni':'Ogni relazione, il suo percorso'}</span><h2>{section==='appointment'?'Un buon giorno per insegnare.':section==='payment'?'Il valore del tuo lavoro.':kindLabels[section]+'.'}</h2></div>
        {section!=='payment'&&<button className="primary-button" onClick={()=>edit()}><Plus size={18}/>{section==='appointment'?'Nuovo appuntamento':section==='contact'?'Nuovo studente':section==='request'?'Nuova richiesta':section==='group'?'Nuovo gruppo':'Nuovo pacchetto'}</button>}</div>
        {section==='appointment'&&<div className="tutor-summary"><div><span>In programma</span><strong>{upcoming.length}<small>lezioni</small></strong></div><div><span>Tempo dedicato</span><strong>{appointments.filter(r=>r.status==='completed').reduce((n,r)=>n+(Date.parse(r.endAt)-Date.parse(r.startAt))/60000,0)}<small>minuti svolti</small></strong></div><div><span>Da accogliere</span><strong>{records.filter(r=>r.kind==='request'&&r.status==='open'&&!appointments.some(a=>a.requestId===r.id&&a.status!=='cancelled')).length}<small>richieste</small></strong></div></div>}
        {section==='payment'&&<><p className="tutor-lead">Compensi singoli consuntivati e prezzi dei pacchetti, incassi annotati e importi ancora da ricevere. Ogni valuta ha il suo conto.</p><p className="hint">Registrazioni manuali: non eseguono pagamenti e non costituiscono verifica bancaria o documento fiscale.</p>{stats.map(([currency,value])=><div className="tutor-summary" key={currency}><div><span>Compensi e pacchetti · {currency}</span><strong>{money(value.charged,currency)}</strong></div><div><span>Incassi annotati</span><strong>{money(value.paid,currency)}</strong></div><div><span>Da ricevere</span><strong>{money(value.due,currency)}</strong></div></div>)}</>}
        {section==='payment'&&<TutorEconomicsPanel records={records}/>}
        <div className="tutor-list-controls">{section==='appointment'&&<div className="tutor-day-control"><button aria-label="Giorno precedente" onClick={()=>moveDay(-1)}>←</button><label><span className="sr-only">Giorno in agenda</span><input aria-label="Giorno in agenda" type="date" value={day} onChange={e=>{if(e.target.value)setDay(e.target.value);}}/></label><button aria-label="Giorno successivo" onClick={()=>moveDay(1)}>→</button><button onClick={()=>setDay(localDate(new Date().toISOString()).slice(0,10))}>Oggi</button></div>}
          <input className="tutor-search" aria-label="Cerca nello studio" placeholder={section==='appointment'?'Cerca in tutte le date…':'Cerca…'} value={query} onChange={e=>setQuery(e.target.value)}/>{section==='appointment'&&<button className="text-button" onClick={()=>download('ardesia-agenda.ics',calendarFile(records),'text/calendar')}>Esporta calendario</button>}</div>
        <section className="tutor-record-list" aria-label={section==='payment'?'Pagamenti registrati':kindLabels[section]}>{list.map((item,index)=><button className={`tutor-record-row ${item.kind==='appointment'?'tutor-appointment-row':''}`} key={item.id} onClick={()=>select(item)}>
          <span className="tutor-row-mark">{item.kind==='appointment'?new Date(item.startAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):String(index+1).padStart(2,'0')}</span>
          <span className="tutor-row-text"><strong>{title(item)}</strong><small>{subtitle(item)}</small></span><span className={`tutor-badge ${'status'in item?item.status:''}`}>{'status'in item?statusLabels[item.status]:'archived'in item&&item.archived?'Archiviato':item.kind==='package'?`${tutorPackageUsage(records,item.id).usedMinutes}/${item.totalMinutes} min`:'Apri scheda'}</span><ArrowUpRight size={18}/></button>)}</section>
        {!list.length&&<div className="tutor-empty"><span className="tutor-empty-symbol">✳</span><h3>{query?'Nessun risultato.':section==='appointment'?'C’è spazio per la prossima lezione.':section==='payment'?'I primi passi hanno valore.':'Comincia da una relazione.'}</h3><p>{query?'Prova un altro nome o argomento.':section==='payment'?'Apri un appuntamento svolto o un pacchetto per annotare un pagamento.':'Le schede che crei resteranno qui, collegate alle tue lezioni.'}</p></div>}
        {section==='payment'&&records.some(r=>tutorCharges(r).length>0)&&<section className="tutor-balances"><h3>Compensi e pacchetti</h3>{records.filter(r=>tutorCharges(r).length).map(target=><article key={target.id}><button className="text-button" onClick={()=>select(target)}>{title(target)} <ArrowUpRight size={16}/></button>{chargeRows(target)}</article>)}</section>}
      </>}
      {draft&&<><div className="tutor-page-heading"><div><span className="eyebrow">{kindLabels[draft.input.kind]} · {dirty?'Modifiche da salvare':`Salvato · r${draft.revision}`}</span><h2>{draft.revision?'La cura dei dettagli.':'Una nuova possibilità.'}</h2></div><button className="text-button" onClick={()=>home()}>Chiudi scheda</button></div>
        {records.some(r=>r.id===draft.id&&r.revision!==draft.revision)&&draft.revision>0&&<p role="alert">Esiste una revisione più recente. Esporta la bozza e riapri la scheda prima di ricomporre le modifiche.</p>}
        <TutorEditor key={draft.id} seed={draft.input} records={records} documents={client.projection!.documents} busy={busy} blocked={blocked} dirty={dirty} revision={draft.revision}
          onDirty={()=>{generation.current++;setDirty(true);}} onSave={save} onError={setError} onExport={raw=>download('ardesia-scheda-non-salvata.json',JSON.stringify({format:'ardesia-tutor-draft/1',...draft,fields:raw},null,2))}/>
      </>}
      {record&&!draft&&<><div className="tutor-page-heading"><div><span className="eyebrow">{kindLabels[record.kind]} · r{record.revision}</span><h2>{title(record)}</h2><p className="tutor-lead">{subtitle(record)}</p></div><button className="text-button" onClick={()=>home()}>Chiudi scheda</button></div>
        <div className="tutor-detail-actions">{record.kind!=='payment'&&<button className="primary-button" onClick={()=>edit(record)}>Modifica scheda</button>}
          {record.kind==='request'&&<button className="secondary-button" onClick={()=>{const input=blank('appointment',record.contactId,day);if(input.kind==='appointment')edit(undefined,{...input,title:record.title,requestId:record.id});}}>Programma lezione</button>}
          {record.kind==='appointment'&&record.lesson&&<><button className="primary-button" onClick={()=>openMaterial(record)}>Leggi lezione r{record.lesson.revision}</button><button className="secondary-button" onClick={()=>onOpenLesson(record.lesson!.documentId)}>Apri lavagna corrente</button></>}
          {record.kind==='payment'&&record.status==='recorded'&&<button className="secondary-button" disabled={blocked} onClick={()=>setVoiding(record.id)}>Storna registrazione</button>}
        </div>
        {'status'in record&&<span className={`tutor-badge ${record.status}`}>{statusLabels[record.status]}</span>}
        <div className="tutor-detail-content">{record.notes&&<p>{record.notes}</p>}{'custom'in record&&record.custom.map((field,index)=><div className="tutor-custom-value" key={index}><span>{field.label}</span><p>{field.value}</p></div>)}
          {record.kind==='contact'&&<p>{record.email}<br/>{record.phone}</p>}
          {record.kind==='group'&&<p>{record.contactIds.map(contactName).join(' · ')}</p>}
          {record.kind==='appointment'&&<><p>Costi diretti sostenuti: {record.directCostMinor===undefined?'Non indicati':money(record.directCostMinor,record.currency)} · Preparazione svolta: {record.preparationMinutes===undefined?'Non indicata':record.preparationMinutes+' min'}</p><p>{timestamp(record.startAt)} → {timestamp(record.endAt)}<br/><small>Fuso registrato: {record.timeZone}</small></p>{record.participants.map(p=><p key={p.contactId}>{contactName(p.contactId)} · {record.status==='completed'?(p.attended?'Presente':'Assente'):'Presenza da consuntivare'}{p.packageId?` · ${contactName(p.packageId)}`:''}</p>)}</>}
          {record.kind==='package'&&<><p>{record.totalMinutes} minuti inclusi · {record.expiresAt?`Scadenza ${timestamp(record.expiresAt)}`:'Senza scadenza'}</p><div className="tutor-summary"><div><span>Consumati</span><strong>{tutorPackageUsage(records,record.id).usedMinutes}<small>min</small></strong></div><div><span>Riservati</span><strong>{tutorPackageUsage(records,record.id).reservedMinutes}<small>min</small></strong></div><div><span>Disponibili</span><strong>{record.totalMinutes-tutorPackageUsage(records,record.id).usedMinutes-tutorPackageUsage(records,record.id).reservedMinutes}<small>min</small></strong></div></div></>}
          {record.kind==='payment'&&<p>{record.reference||'Senza riferimento esterno'} · {record.status==='void'?record.voidReason:'Registrazione manuale'}<br/>Riferito a {contactName(record.targetId)} · r{record.targetRevision}</p>}
        </div>{chargeRows(record)}
        <details className="tutor-history"><summary>Storia della scheda · {space.history.filter(e=>e.entityId===record.id).length} versioni</summary>{space.history.filter(e=>e.entityId===record.id).map(event=><article key={event.id}><h4>r{event.entityRevision} · {timestamp(event.occurredAt)}</h4><p>{event.payload.command.kind==='save-tutor-record'?event.payload.command.reason||'Scheda salvata':event.payload.command.kind==='void-tutor-payment'?event.payload.command.reason:'Pagamento annotato'}</p><pre>{JSON.stringify(event.payload.value,null,2)}</pre></article>)}</details>
      </>}
    </main></div>
    {leave&&<Dialog title="Conserva la scheda aperta" onClose={()=>setLeave(null)}><p>Ci sono modifiche non salvate. Puoi continuare o scartarle.</p><div className="dialog-actions"><button className="secondary-button" onClick={()=>setLeave(null)}>Continua a lavorare</button><button className="primary-button" onClick={()=>{const next=leave;setLeave(null);setDirty(false);next();}}>Scarta modifiche</button></div></Dialog>}
    {cash&&<Dialog title="Registra un pagamento" onClose={()=>{if(!busy){setCash(null);action.current=null;}}}><p>Annota un incasso già ricevuto per {title(cash.target)}. Il riferimento resta legato alla revisione {cash.target.revision}.</p><form className="tutor-form" onSubmit={e=>{
      e.preventDefault();const data=new FormData(e.currentTarget),text=(key:string)=>String(data.get(key)??''),balance=tutorBalance(records,cash.target.id,cash.contactId);
      try{if(!balance)throw Error('Compenso non disponibile.');void run({kind:'record-tutor-payment',commandId:crypto.randomUUID(),recordId:crypto.randomUUID(),expectedRevision:0,targetId:cash.target.id,targetRevision:cash.target.revision,contactId:cash.contactId,
        amountMinor:readMoney(text('amount'),cash.currency),paidAt:localInstant(text('paid'),text('paidOffset')),method:text('method'),reference:text('reference'),notes:text('notes')},()=>setCash(null));}catch(reason){setError(reason instanceof Error?reason.message:'Dati non validi.');}
    }}><fieldset disabled={blocked}><label>Importo ricevuto<input name="amount" inputMode="decimal" required defaultValue={moneyInput(cash.dueMinor,cash.currency)}/></label><DateField name="paid" label="Data pagamento" value={new Date(Math.floor(Date.now()/60000)*60000).toISOString()}/><label>Metodo<input name="method" required maxLength={100} placeholder="Bonifico, contanti…"/></label><label>Riferimento univoco<input name="reference" maxLength={500}/></label><label>Note pagamento<textarea name="notes" maxLength={10000}/></label></fieldset>{records.find(r=>r.id===cash.target.id)?.revision!==cash.target.revision&&<p role="alert">La scheda collegata è cambiata. Conserva i dati inseriti e riapri la registrazione dalla versione attuale.</p>}{error&&<p role="alert">{error}</p>}<button type="button" className="text-button" disabled={blocked} onClick={e=>download('ardesia-pagamento-non-salvato.json',JSON.stringify({targetId:cash.target.id,targetRevision:cash.target.revision,contactId:cash.contactId,currency:cash.currency,fields:Object.fromEntries(new FormData(e.currentTarget.form!))},null,2))}>Esporta dati inseriti</button><button className="primary-button" disabled={blocked}>Conferma registrazione</button></form></Dialog>}
    {voiding&&<Dialog title="Storna la registrazione" onClose={()=>{if(!busy){setVoiding(null);action.current=null;}}}><p>La registrazione originale rimane nello storico. Nessun rimborso viene eseguito.</p><form className="tutor-form" onSubmit={e=>{e.preventDefault();const reason=String(new FormData(e.currentTarget).get('reason')??''),payment=records.find(r=>r.id===voiding)!;void run({kind:'void-tutor-payment',recordId:payment.id,expectedRevision:payment.revision,commandId:crypto.randomUUID(),reason},()=>setVoiding(null));}}><label>Motivo dello storno<textarea name="reason" required maxLength={10000} disabled={blocked}/></label><button className="primary-button" disabled={blocked}>Conferma storno</button></form></Dialog>}
    {material&&<Dialog title={`${material.title} · r${material.revision}`} onClose={()=>setMaterial(null)}><div className="tutor-material">{material.objects.map(object=><section key={object.id}><h3>{object.title}</h3>{object.type==='lab'?<p>Laboratorio {object.data.pluginId} · {object.data.pluginVersion}</p>:<ObjectContent object={object} links/>}</section>)}</div></Dialog>}
  </div>;
}
