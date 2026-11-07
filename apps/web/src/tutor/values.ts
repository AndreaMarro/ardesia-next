import {tutorCharges, type TutorInput, type TutorRecord} from '@ardesia/contracts';

export const kindLabels={contact:'Studenti',request:'Richieste',appointment:'Agenda',group:'Gruppi',package:'Pacchetti',payment:'Pagamenti'} as const;
export const statusLabels={scheduled:'Programmato',completed:'Svolto',cancelled:'Annullato',recorded:'Registrato',void:'Stornato',open:'Aperta',closed:'Chiusa',declined:'Declinata'} as const;
export function inputOf(record:Exclude<TutorRecord,{kind:'payment'}>):TutorInput {
  const {id:_id,ownerId:_owner,revision:_revision,createdAt:_created,updatedAt:_updated,...input}=record;return input;
}
export function fractionDigits(currency:string){return new Intl.NumberFormat('it-IT',{style:'currency',currency}).resolvedOptions().maximumFractionDigits??2;}
export function moneyInput(minor:number,currency:string){const digits=fractionDigits(currency),value=String(minor).padStart(digits+1,'0');return digits?value.slice(0,-digits)+'.'+value.slice(-digits):value;}
export function readMoney(value:string,currency:string){
  const digits=fractionDigits(currency),match=/^(\d+)(?:[.,](\d+))?$/.exec(value.trim());
  if(!match||(match[2]?.length??0)>digits)throw Error(`Importo non valido: ${currency} usa ${digits} cifre decimali.`);
  const amount=BigInt(match[1]!)*10n**BigInt(digits)+BigInt((match[2]??'').padEnd(digits,'0')||'0');
  if(amount>1_000_000_000_000n)throw Error('Importo troppo grande.');return Number(amount);
}
/** Empty optional fields remain absent, so editing an old record cannot invent
 * zero-valued history or change its old command fingerprint. */
export function appointmentEconomicsInput(directCost:string,preparation:string,currency:string):{directCostMinor?:number;preparationMinutes?:number}{
  const result:{directCostMinor?:number;preparationMinutes?:number}={};
  if(directCost.trim())result.directCostMinor=readMoney(directCost,currency);
  if(preparation.trim()){
    if(!/^\d+$/.test(preparation.trim())||Number(preparation)>44640)throw Error('Preparazione: indica minuti interi da 0 a 44640.');
    result.preparationMinutes=Number(preparation);
  }
  return result;
}
export function money(minor:number|bigint,currency:string){
  const value=BigInt(minor),digits=fractionDigits(currency),divisor=10n**BigInt(digits),absolute=value<0n?-value:value;
  return (value<0n?'−':'')+new Intl.NumberFormat('it-IT',{style:'currency',currency}).formatToParts(absolute/divisor)
    .map(part=>part.type==='fraction'?(absolute%divisor).toString().padStart(digits,'0'):part.value).join('');
}
export function totals(records:readonly TutorRecord[]){
  const currencies=new Map<string,{charged:bigint;paid:bigint;due:bigint}>();
  const item=(currency:string)=>{if(!currencies.has(currency))currencies.set(currency,{charged:0n,paid:0n,due:0n});return currencies.get(currency)!;};
  for(const record of records){for(const charge of tutorCharges(record))item(charge.currency).charged+=BigInt(charge.amountMinor);
    if(record.kind==='payment'&&record.status==='recorded')item(record.currency).paid+=BigInt(record.amountMinor);}
  for(const value of currencies.values())value.due=value.charged-value.paid;return [...currencies.entries()];
}
export function localDate(iso:string){const date=new Date(iso),pad=(n:number)=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;}
export function utcOffset(iso:string){const n=-new Date(iso).getTimezoneOffset();return `${n<0?'-':'+'}${String(Math.floor(Math.abs(n)/60)).padStart(2,'0')}:${String(Math.abs(n)%60).padStart(2,'0')}`;}
/** Round-trip in the actual IANA device zone; repeated local times require an explicit offset. */
export function localInstant(value:string,offset=''){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)||offset&&!/^[+-]\d{2}:\d{2}$/.test(offset))throw Error('Data o offset non valido.');
  const date=new Date(value+offset);
  if(!Number.isFinite(date.getTime())||localDate(date.toISOString())!==value||offset&&utcOffset(date.toISOString())!==offset)throw Error('L’ora non esiste in questo fuso o l’offset non corrisponde alla data.');
  if(!offset){
    const offsets=new Set(Array.from({length:97},(_,i)=>new Date(date.getTime()+(i-48)*3600000).getTimezoneOffset()));
    const wall=Date.parse(value+'Z');
    if([...offsets].some(minutes=>wall+minutes*60000!==date.getTime()&&localDate(new Date(wall+minutes*60000).toISOString())===value))throw Error('L’ora si ripete nel cambio di fuso: specifica l’offset UTC, per esempio +01:00 o +02:00.');
  }
  return date.toISOString();
}
export function blank(kind:TutorInput['kind'],contactId='',day?:string):TutorInput{
  const common={title:'',notes:'',custom:[]};
  if(kind==='contact')return {...common,kind,email:'',phone:'',archived:false};
  if(kind==='request')return {...common,kind,contactId,status:'open'};
  if(kind==='group')return {...common,kind,contactIds:[],archived:false};
  if(kind==='package')return {...common,kind,contactId,totalMinutes:300,priceMinor:0,currency:'EUR',expiresAt:null};
  const start=day?new Date(day+'T09:00'):new Date();start.setSeconds(0,0);
  return {...common,kind,startAt:start.toISOString(),endAt:new Date(start.getTime()+3600000).toISOString(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,
    status:'scheduled',currency:'EUR',participants:contactId?[{contactId,attended:false,packageId:null,chargeMinor:0}]:[],groupId:null,requestId:null,lesson:null};
}
export function calendarFile(records:readonly TutorRecord[]){
  const escape=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/[,;]/g,'\\$&');
  const date=(value:string)=>new Date(value).toISOString().slice(0,19).replace(/[-:]/g,'')+'Z';
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Ardesia//Tutor//IT','CALSCALE:GREGORIAN'];
  for(const record of records)if(record.kind==='appointment')lines.push('BEGIN:VEVENT',`UID:${record.id}@ardesia.local`,`DTSTAMP:${date(record.updatedAt)}`,`DTSTART:${date(record.startAt)}`,`DTEND:${date(record.endAt)}`,`SEQUENCE:${record.revision}`,`SUMMARY:${escape(record.title)}`,`STATUS:${record.status==='cancelled'?'CANCELLED':'CONFIRMED'}`,'END:VEVENT');
  lines.push('END:VCALENDAR');
  // RFC 5545 folds by UTF-8 octets, never inside a code point.
  return lines.map(line=>{let result='',column=0;for(const character of line){const size=new TextEncoder().encode(character).length;if(column+size>75){result+='\r\n ';column=1;}result+=character;column+=size;}return result;}).join('\r\n')+'\r\n';
}
