import {useState,type FormEvent} from 'react';
import {TutorInputSchema,type TutorInput,type TutorRecord,type LessonDocument} from '@ardesia/contracts';
import {localDate,localInstant,utcOffset,moneyInput,readMoney,appointmentEconomicsInput} from './values';

export function DateField({name,label,value,required=true}:{name:string;label:string;value:string;required?:boolean}){
  const [local,setLocal]=useState(value?localDate(value):''),[offset,setOffset]=useState(value?utcOffset(value):'');
  return <div className="tutor-date-field"><label>{label}<input name={name} type="datetime-local" required={required} value={local} onChange={e=>{setLocal(e.target.value);setOffset('');}}/></label>
    <label className="tutor-offset">Offset UTC<input name={`${name}Offset`} aria-label={`Offset UTC ${label}`} placeholder="Automatico" pattern="[+\-][0-9]{2}:[0-9]{2}" value={offset} onChange={e=>setOffset(e.target.value)} maxLength={6}/></label></div>;
}
export function TutorEditor({seed,records,documents,busy,blocked,dirty,revision,onDirty,onSave,onError,onExport}:
  {seed:TutorInput;records:TutorRecord[];documents:LessonDocument[];busy:boolean;blocked:boolean;dirty:boolean;revision:number;onDirty:()=>void;
    onSave:(input:TutorInput,reason:string)=>void;onError:(message:string)=>void;onExport:(raw:Record<string,FormDataEntryValue|FormDataEntryValue[]>)=>void}){
  const contacts=records.filter(r=>r.kind==='contact');
  const [status,setStatus]=useState(seed.kind==='appointment'?seed.status:'scheduled');
  const [currency,setCurrency]=useState('currency'in seed?seed.currency:'EUR');
  const [people,setPeople]=useState(seed.kind==='appointment'?seed.participants.map(p=>p.contactId):seed.kind==='group'?seed.contactIds:[]);
  const [custom,setCustom]=useState(seed.custom.map((value,index)=>({...value,key:index}))),[nextKey,setNextKey]=useState(seed.custom.length);
  const [packages,setPackages]=useState<Record<string,string>>(seed.kind==='appointment'?Object.fromEntries(seed.participants.map(p=>[p.contactId,p.packageId??''])):{});
  const [lesson,setLesson]=useState(seed.kind==='appointment'?seed.lesson:null);
  const [group,setGroup]=useState(seed.kind==='appointment'?seed.groupId??'':'');
  const name=(id:string)=>contacts.find(r=>r.id===id)?.title??id;
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const data=new FormData(event.currentTarget),text=(key:string)=>String(data.get(key)??'');
    try{
      const common={title:text('title'),notes:text('notes'),custom:custom.map(({key:_key,...value})=>value)};
      let input:unknown;
      if(seed.kind==='contact')input={...common,kind:seed.kind,email:text('email'),phone:text('phone'),archived:data.has('archived')};
      if(seed.kind==='request')input={...common,kind:seed.kind,contactId:text('contactId'),status:text('status')};
      if(seed.kind==='group')input={...common,kind:seed.kind,contactIds:people,archived:data.has('archived')};
      if(seed.kind==='package')input={...common,kind:seed.kind,contactId:text('contactId'),currency,totalMinutes:Number(text('minutes')),priceMinor:readMoney(text('price'),currency),expiresAt:text('expiry')?localInstant(text('expiry'),text('expiryOffset')):null};
      if(seed.kind==='appointment'){
        input={...common,kind:seed.kind,startAt:localInstant(text('start'),text('startOffset')),endAt:localInstant(text('end'),text('endOffset')),
          timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,status,currency,groupId:group||null,requestId:text('request')||null,
          lesson,...appointmentEconomicsInput(text('directCost'),text('preparationMinutes'),currency),
          participants:people.map(contactId=>({contactId,attended:status==='completed'&&data.has(`attended:${contactId}`),packageId:packages[contactId]||null,chargeMinor:packages[contactId]?0:readMoney(text(`charge:${contactId}`),currency)}))};
      }
      const parsed=TutorInputSchema.safeParse(input);
      if(!parsed.success)throw Error('Controlla i campi: titolo, persone, date, importi e campi personalizzati devono essere validi.');
      onSave(parsed.data,text('reason'));
    }catch(reason){onError(reason instanceof Error?reason.message:'Dati non validi.');}
  }
  function currencyField(){return <label>Valuta<input name="currency" value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())} pattern="[A-Z]{3}" minLength={3} maxLength={3} required/></label>;}
  function personField(){return <label>Studente<select aria-label="Studente" name="contactId" defaultValue={'contactId'in seed?seed.contactId:''} required><option value="">Scegli una persona</option>{contacts.map(r=><option key={r.id} value={r.id}>{r.title}{r.archived?' · archiviato':''}</option>)}</select></label>;}
  function members(){return <fieldset className="tutor-members"><legend>Partecipanti</legend>{!contacts.length&&<p>Salva prima una persona nella sezione Studenti.</p>}{contacts.map(person=><label className="tutor-check" key={person.id}><input type="checkbox" checked={people.includes(person.id)} onChange={e=>setPeople(ids=>e.target.checked?[...ids,person.id]:ids.filter(id=>id!==person.id))}/>{person.title}</label>)}</fieldset>;}
  return <form id="tutor-editor" className="tutor-form" onInput={onDirty} onChange={onDirty} onSubmit={submit}>
    <fieldset disabled={busy}>
      <label>{seed.kind==='contact'?'Nome e cognome':'Titolo'}<input name="title" defaultValue={seed.title} required maxLength={240} autoFocus/></label>
      {seed.kind==='contact'&&<div className="tutor-form-pair"><label>Email<input name="email" type="email" defaultValue={seed.email} maxLength={320}/></label><label>Telefono<input name="phone" type="tel" defaultValue={seed.phone} maxLength={100}/></label></div>}
      {seed.kind==='request'&&<div className="tutor-form-pair">{personField()}<label>Stato richiesta<select aria-label="Stato richiesta" name="status" defaultValue={seed.status}><option value="open">Aperta</option><option value="closed">Chiusa</option><option value="declined">Declinata</option></select></label></div>}
      {seed.kind==='group'&&members()}
      {seed.kind==='package'&&<>{personField()}<div className="tutor-form-pair"><label>Minuti inclusi<input name="minutes" type="number" min="1" max="10000000" step="1" required defaultValue={seed.totalMinutes}/></label>{currencyField()}<label>Prezzo del pacchetto<input name="price" inputMode="decimal" required defaultValue={moneyInput(seed.priceMinor,seed.currency)}/></label></div><DateField name="expiry" label="Scadenza" required={false} value={seed.expiresAt??''}/></>}
      {seed.kind==='appointment'&&<>
        <div className="tutor-form-pair"><DateField name="start" label="Inizio" value={seed.startAt}/><DateField name="end" label="Fine" value={seed.endAt}/></div>
        <p className="hint">Orari in {Intl.DateTimeFormat().resolvedOptions().timeZone}. Per un’ora ripetuta nel cambio stagionale, scegli l’offset UTC.</p>
        <div className="tutor-form-pair"><label>Stato appuntamento<select aria-label="Stato appuntamento" value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="scheduled" disabled={seed.status==='completed'}>Programmato</option><option value="completed">Svolto</option><option value="cancelled" disabled={seed.status==='completed'}>Annullato</option></select></label>{currencyField()}</div>
        <label>Gruppo<select aria-label="Gruppo" value={group} onChange={e=>{setGroup(e.target.value);const found=records.find(r=>r.id===e.target.value);if(found?.kind==='group')setPeople(found.contactIds);}}><option value="">Lezione individuale / partecipanti liberi</option>{records.filter(r=>r.kind==='group').map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
        {members()}
        {people.map(id=>{const original=seed.participants.find(p=>p.contactId===id);return <section className="tutor-person-charge" key={id}><h3>{name(id)}</h3><label>Pacchetto per {name(id)}<select aria-label={`Pacchetto per ${name(id)}`} value={packages[id]??''} onChange={e=>setPackages(values=>({...values,[id]:e.target.value}))}><option value="">Compenso per questa lezione</option>{records.filter((r):r is Extract<TutorRecord,{kind:'package'}>=>r.kind==='package'&&r.contactId===id).map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
          {!packages[id]&&<label>Compenso per {name(id)}<input name={`charge:${id}`} inputMode="decimal" required defaultValue={moneyInput(original?.chargeMinor??0,seed.currency)}/></label>}
          {status==='completed'&&<label className="tutor-check"><input name={`attended:${id}`} type="checkbox" defaultChecked={original?.attended??false}/>Presente · {name(id)}</label>}
        </section>;})}
        <p className="hint">Il pacchetto riserva minuti in agenda e li consuma con la presenza. Il compenso singolo matura solo dopo il consuntivo; su un annullamento indica esplicitamente l’eventuale addebito.</p>
        <div className="tutor-form-pair"><label>Costi diretti sostenuti · {currency}<input name="directCost" aria-label="Costi diretti sostenuti" inputMode="decimal" placeholder="Non indicati" defaultValue={seed.directCostMinor===undefined?'':moneyInput(seed.directCostMinor,seed.currency)}/></label>
          <label>Minuti di preparazione svolti<input name="preparationMinutes" aria-label="Minuti di preparazione svolti" type="number" min="0" max="44640" step="1" placeholder="Non indicati" defaultValue={seed.preparationMinutes??''}/></label></div>
        <p className="hint">Inserisci solo costi e preparazione già sostenuti, anche se la lezione è ancora in programma o è annullata. Sono conteggiati una volta per appuntamento. Cambiare valuta non converte gli importi.</p>
        <div className="tutor-form-pair"><label>Richiesta collegata<select aria-label="Richiesta collegata" name="request" defaultValue={seed.requestId??''}><option value="">Nessuna richiesta</option>{records.filter(r=>r.kind==='request').map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
          <label>Lezione collegata<select aria-label="Lezione collegata" name="lesson" value={lesson?.documentId??''} onChange={e=>{const document=documents.find(d=>d.id===e.target.value);setLesson(document?{documentId:document.id,revision:document.revision}:null);}}><option value="">Nessuna lezione</option>{documents.map(doc=><option key={doc.id} value={doc.id}>{doc.title} · r{lesson?.documentId===doc.id?lesson.revision:doc.revision}</option>)}</select></label></div>
        <p className="hint">Il collegamento conserva la revisione scelta. Condividi i materiali dalla lavagna quando vuoi assegnarli allo studente.</p>
        {revision>0&&<label>Motivo della modifica<input name="reason" maxLength={10000} required={seed.status==='completed'} placeholder="Necessario per spostamenti, annullamenti e correzioni di un consuntivo"/></label>}
      </>}
      <label>Note<textarea name="notes" rows={4} maxLength={10000} defaultValue={seed.notes}/></label>
      {(seed.kind==='contact'||seed.kind==='group')&&<label className="tutor-check"><input name="archived" type="checkbox" defaultChecked={seed.archived}/>Archiviato</label>}
      <details className="tutor-custom" open={custom.length>0}><summary>Campi personalizzati</summary>
        {custom.map((field,index)=><div className="tutor-custom-row" key={field.key}><label>Nome campo {index+1}<input value={field.label} required maxLength={240} onChange={e=>setCustom(fields=>fields.map(f=>f.key===field.key?{...f,label:e.target.value}:f))}/></label><label>Valore campo {index+1}<input value={field.value} maxLength={10000} onChange={e=>setCustom(fields=>fields.map(f=>f.key===field.key?{...f,value:e.target.value}:f))}/></label><button type="button" className="text-button" aria-label={`Rimuovi campo ${index+1}`} onClick={()=>{setCustom(fields=>fields.filter(f=>f.key!==field.key));onDirty();}}>Rimuovi</button></div>)}
        <button type="button" className="text-button" disabled={custom.length>=64} onClick={()=>{setCustom(fields=>[...fields,{key:nextKey,label:'',value:''}]);setNextKey(nextKey+1);onDirty();}}>+ Aggiungi campo</button>
      </details>
    </fieldset>
    <footer className="tutor-form-footer"><button type="button" className="text-button" disabled={busy} onClick={e=>{const form=e.currentTarget.form!;const data=new FormData(form);const raw:Record<string,FormDataEntryValue|FormDataEntryValue[]>={};for(const key of new Set(data.keys()))raw[key]=data.getAll(key);onExport({...raw,custom:JSON.stringify(custom),structural:JSON.stringify({status,currency,people,packages,group,lesson})});}}>Esporta bozza</button>
      <button className="primary-button" disabled={blocked||!dirty}>{busy?'Salvataggio…':'Salva scheda'}</button></footer>
  </form>;
}
