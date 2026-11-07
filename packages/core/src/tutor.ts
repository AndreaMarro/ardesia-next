import {canonicalJson,CoreError,projectDocumentRevision,tutorBalance,tutorCharges,tutorPackageUsage,tutorTarget,
  type Actor,type CoreEvent,type CoreSnapshot,type TutorCommand,type TutorEvent,type TutorRecord,type TutorSpace} from '@ardesia/contracts';

const unavailable=():never=>{throw new CoreError('NOT_FOUND','The tutor record is unavailable.');};
function invalid(message:string):never{throw new CoreError('INVALID_COMMAND',message);}
function revision(actual:number,expected:number){if(actual!==expected)throw new CoreError('REVISION_CONFLICT','The tutor record changed. Read the saved version before retrying.');}
function own(state:CoreSnapshot,actor:Actor,id:string,kind?:TutorRecord['kind']){
  return state.tutorRecords.find(r=>r.id===id&&r.ownerId===actor.actorId&&(!kind||r.kind===kind))??unavailable();
}
export function authorizeTutor(state:CoreSnapshot,actor:Actor,command:TutorCommand){
  if(actor.role!=='teacher')throw new CoreError('FORBIDDEN','Tutor records are private to their professional owner.');
  if(state.tutorRecords.some(r=>r.id===command.recordId))own(state,actor,command.recordId);
  if(command.kind==='record-tutor-payment')own(state,actor,command.targetId);
}
function validateRecord(state:CoreSnapshot,actor:Actor,record:TutorRecord,at:string){
  const contact=(id:string)=>own(state,actor,id,'contact');
  if(record.kind==='group'){
    if(new Set(record.contactIds).size!==record.contactIds.length)invalid('Group members must be unique.');
    record.contactIds.forEach(contact);
  }
  if(record.kind==='request'||record.kind==='package')contact(record.contactId);
  if(record.kind!=='appointment')return;
  if(record.status==='completed'&&Date.parse(record.endAt)>Date.parse(at))invalid('A future appointment cannot be recorded as completed.');
  if(record.groupId)own(state,actor,record.groupId,'group');
  if(record.requestId){
    const request=own(state,actor,record.requestId,'request');
    if(request.kind!=='request'||!record.participants.some(p=>p.contactId===request.contactId))invalid('The request contact must participate in this appointment.');
    if(state.tutorRecords.some(r=>r.kind==='appointment'&&r.id!==record.id&&r.requestId===record.requestId&&r.status!=='cancelled'&&record.status!=='cancelled'))invalid('This request already has an appointment.');
  }
  if(record.lesson){
    const document=state.documents.find(d=>d.id===record.lesson!.documentId&&d.ownerId===actor.actorId)??unavailable();
    projectDocumentRevision(state.events.filter((e):e is CoreEvent=>'documentId'in e),document.id,record.lesson.revision);
  }
  for(const person of record.participants){
    contact(person.contactId);
    if(person.packageId){
      const pack=own(state,actor,person.packageId,'package');
      if(pack.kind!=='package'||pack.contactId!==person.contactId||pack.currency!==record.currency||person.chargeMinor!==0)invalid('A package covers only its own contact and currency, without a second session charge.');
      if(pack.expiresAt&&record.status!=='cancelled'&&Date.parse(record.endAt)>Date.parse(pack.expiresAt))invalid('The appointment exceeds the package expiry.');
    }
  }
  if(record.status!=='cancelled'&&state.tutorRecords.some(r=>r.kind==='appointment'&&r.id!==record.id&&r.ownerId===actor.actorId&&r.status!=='cancelled'
    &&Date.parse(r.startAt)<Date.parse(record.endAt)&&Date.parse(record.startAt)<Date.parse(r.endAt)))invalid('The tutor already has an overlapping appointment.');
}
/** Validate the whole resulting ledger, including references affected by a package or fee edit. */
function validateBalances(state:CoreSnapshot){
  for(const record of state.tutorRecords){
    if(record.kind==='request'&&state.tutorRecords.some(r=>r.kind==='appointment'&&r.requestId===record.id&&!r.participants.some(p=>p.contactId===record.contactId)))invalid('The request contact is fixed by a linked appointment.');
    if(record.kind==='package'){
      const usage=tutorPackageUsage(state.tutorRecords,record.id);
      if(usage.reservedMinutes+usage.usedMinutes>record.totalMinutes)invalid('The package has insufficient unreserved minutes.');
      for(const appointment of state.tutorRecords)if(appointment.kind==='appointment')for(const p of appointment.participants)if(p.packageId===record.id){
        if(record.contactId!==p.contactId||record.currency!==appointment.currency||record.expiresAt&&appointment.status!=='cancelled'&&Date.parse(appointment.endAt)>Date.parse(record.expiresAt))invalid('The package edit would invalidate a linked appointment.');
      }
    }
    if(record.kind==='payment'&&record.status==='recorded'){
      const target=state.tutorRecords.find(r=>r.id===record.targetId&&r.ownerId===record.ownerId);
      const balance=target&&tutorBalance(state.tutorRecords,target.id,record.contactId);
      if(!balance||balance.currency!==record.currency||balance.dueMinor<0)invalid('The payment exceeds or differs from the recorded charge. Void the payment explicitly before changing its billing context.');
    }
  }
}
export function applyTutor(state:CoreSnapshot,actor:Actor,command:TutorCommand,at:string):TutorRecord{
  authorizeTutor(state,actor,command);
  const old=state.tutorRecords.find(r=>r.id===command.recordId);revision(old?.revision??0,command.expectedRevision);
  let value:TutorRecord;
  const identity={id:command.recordId,ownerId:actor.actorId,revision:(old?.revision??0)+1,createdAt:old?.createdAt??at,updatedAt:at};
  if(command.kind==='save-tutor-record'){
    if(old&&old.kind!==command.input.kind)invalid('A tutor record identity cannot change its kind.');
    if(old?.kind==='appointment'&&old.status==='completed'){
      if(command.input.kind!=='appointment'||command.input.status!=='completed')invalid('A delivered appointment cannot be rescheduled or cancelled. Correct its attendance explicitly.');
      if(!command.reason.trim())invalid('A correction to a delivered appointment needs a reason.');
    }
    if(old?.kind==='appointment'&&old.status!=='completed'&&command.input.kind==='appointment'
      &&(old.startAt!==command.input.startAt||old.endAt!==command.input.endAt||old.status!==command.input.status&&command.input.status==='cancelled')&&!command.reason.trim())invalid('Moving or cancelling an appointment needs a reason.');
    value={...structuredClone(command.input),...identity};validateRecord(state,actor,value,at);
  }else if(command.kind==='record-tutor-payment'){
    const target=own(state,actor,command.targetId);revision(target.revision,command.targetRevision);
    const charge=tutorCharges(target).find(c=>c.contactId===command.contactId)??unavailable();
    if(Date.parse(command.paidAt)>Date.parse(at))invalid('A future payment cannot be recorded as received.');
    if(command.reference&&state.tutorRecords.some(r=>r.kind==='payment'&&r.ownerId===actor.actorId&&r.status==='recorded'&&r.reference===command.reference))invalid('This payment reference is already recorded.');
    value={...identity,kind:'payment',targetId:target.id,targetRevision:target.revision,contactId:command.contactId,amountMinor:command.amountMinor,currency:charge.currency,
      paidAt:command.paidAt,method:command.method,reference:command.reference,notes:command.notes,status:'recorded',voidReason:''};
  }else{
    if(!old||old.kind!=='payment')return unavailable();
    if(old.status!=='recorded')invalid('This payment is already void.');
    value={...old,...identity,status:'void',voidReason:command.reason};
  }
  const index=state.tutorRecords.findIndex(r=>r.id===value.id);if(index<0)state.tutorRecords.push(value);else state.tutorRecords[index]=value;
  validateBalances(state);return value;
}
export function tutorSpace(state:CoreSnapshot,actor:Actor):TutorSpace{return actor.role==='teacher'?structuredClone({
  records:state.tutorRecords.filter(r=>r.ownerId===actor.actorId),history:state.events.filter((e):e is TutorEvent=>'tutorEntity'in e&&e.actorId===actor.actorId),
}):{records:[],history:[]};}
export async function validateTutorHistory(state:CoreSnapshot){
  const replay:CoreSnapshot={...state,tutorRecords:[],events:[]};
  const invalidHistory=():never=>{throw new CoreError('INVALID_SNAPSHOT','Tutor history does not reproduce the committed records.');};
  for(const event of state.events){
    if('tutorEntity'in event){
      try{
        const actor:Actor={actorId:event.actorId,role:event.actorRole},target=tutorTarget(event.payload.command);
        const value=applyTutor(replay,actor,event.payload.command,event.occurredAt),receipt=state.receipts.find(r=>r.eventId===event.id);
        const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalJson({actor,command:event.payload.command})))),b=>b.toString(16).padStart(2,'0')).join('');
        if(event.tutorEntity!==target.tutorEntity||event.entityId!==target.entityId||canonicalJson(value)!==canonicalJson(event.payload.value)||!receipt||receipt.fingerprint!==fingerprint)return invalidHistory();
      }catch{return invalidHistory();}
    }
    replay.events.push(event);
  }
  if(canonicalJson(replay.tutorRecords)!==canonicalJson(state.tutorRecords))return invalidHistory();
}
