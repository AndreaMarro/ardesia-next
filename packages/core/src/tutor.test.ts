import {describe,expect,it} from 'vitest';
import {emptySnapshot,tutorBalance,tutorPackageUsage,type TutorInput,type TutorCommand} from '@ardesia/contracts';
import {createCore,MemoryStorage} from './index';
const teacher={actorId:'teacher',role:'teacher'} as const,student={actorId:'student',role:'student'} as const,other={actorId:'other',role:'teacher'} as const;
const common={title:'Analisi',notes:'',custom:[{label:'Obiettivo',value:'Derivate'}]};
const contact:TutorInput={...common,kind:'contact',title:'Ada',email:'ada@example.test',phone:'',archived:false};
const appointment=():Extract<TutorInput,{kind:'appointment'}>=>({...common,kind:'appointment',startAt:'2026-11-06T09:00:00.000Z',endAt:'2026-11-06T10:00:00.000Z',timeZone:'Europe/Rome',status:'scheduled',currency:'EUR',participants:[{contactId:'ada',attended:false,packageId:null,chargeMinor:3000}],groupId:null,requestId:null,lesson:null});
async function fixture(){
  let n=0;const storage=new MemoryStorage(),core=await createCore({storage,clock:()=> '2026-11-07T12:00:00.000Z',id:()=>`event-${++n}`});
  const save=(recordId:string,input:TutorInput,expectedRevision=0,reason='')=>core.executeTutor(teacher,{kind:'save-tutor-record',recordId,input,expectedRevision,reason,commandId:`cmd-${++n}`});
  await save('ada',contact);return {core,storage,save};
}
const payment=(amountMinor=1000):Extract<TutorCommand,{kind:'record-tutor-payment'}>=>({kind:'record-tutor-payment',recordId:'cash',expectedRevision:0,commandId:'cash-command',targetId:'session',targetRevision:2,contactId:'ada',amountMinor,paidAt:'2026-11-06T11:00:00.000Z',method:'Bonifico dichiarato',reference:'ref-1',notes:''});

describe('private tutor operations through Core',()=>{
  it('connects request, group, exact lesson, attendance, partial payment, void and durable history',async()=>{
    const {core,storage,save}=await fixture();
    await core.execute(teacher,{kind:'create-document',commandId:'lesson',documentId:'lesson',expectedRevision:0,title:'Derivate'});
    await save('request',{...common,kind:'request',contactId:'ada',status:'open'});
    await save('group',{...common,kind:'group',contactIds:['ada'],archived:false});
    const input={...appointment(),requestId:'request',groupId:'group',lesson:{documentId:'lesson',revision:1}};
    await save('session',input);expect(tutorBalance(core.getTutorSpace(teacher).records,'session','ada')).toBeNull();
    await save('session',{...input,status:'completed',participants:input.participants.map(p=>({...p,attended:true}))},1);
    const command=payment(),receipt=await core.executeTutor(teacher,command);
    expect(await core.executeTutor(teacher,command)).toEqual(receipt);
    expect(tutorBalance(core.getTutorSpace(teacher).records,'session','ada')).toMatchObject({amountMinor:3000,paidMinor:1000,dueMinor:2000});
    expect(core.getTutorSpace(teacher).records.find(r=>r.id==='cash')).toMatchObject({targetRevision:2});
    await core.executeTutor(teacher,{kind:'void-tutor-payment',recordId:'cash',expectedRevision:1,commandId:'void',reason:'Data inserita per errore'});
    expect(tutorBalance(core.getTutorSpace(teacher).records,'session','ada')?.paidMinor).toBe(0);
    const space=core.getTutorSpace(teacher);expect(space.history.filter(e=>e.entityId==='cash')).toHaveLength(2);
    expect(space.history.find(e=>e.entityId==='session')!.payload.value).toMatchObject({status:'scheduled',lesson:{revision:1}});
    expect((await createCore({storage})).getTutorSpace(teacher)).toEqual(space);
    space.records[0]!.notes='Not authority';expect(core.getTutorSpace(teacher).records[0]!.notes).toBe('');
  });
  it('reserves capacity atomically, admits adjacent intervals and consumes only attended minutes',async()=>{
    const {core,save}=await fixture();
    await save('pack',{...common,kind:'package',contactId:'ada',totalMinutes:90,priceMinor:5000,currency:'EUR',expiresAt:null});
    const input={...appointment(),participants:[{contactId:'ada',attended:false,packageId:'pack',chargeMinor:0}]};
    await save('session',input);
    await expect(save('overlap',{...appointment()})).rejects.toMatchObject({code:'INVALID_COMMAND'});
    const adjacent={...input,startAt:input.endAt,endAt:'2026-11-06T11:00:00.000Z'};
    await expect(save('capacity',adjacent)).rejects.toMatchObject({code:'INVALID_COMMAND'});
    expect(tutorPackageUsage(core.getTutorSpace(teacher).records,'pack')).toEqual({reservedMinutes:60,usedMinutes:0});
    await save('session',{...input,status:'cancelled'},1,'Indisponibilità');
    await save('adjacent',adjacent);expect(tutorPackageUsage(core.getTutorSpace(teacher).records,'pack').reservedMinutes).toBe(60);
    await save('adjacent',{...adjacent,status:'completed',participants:adjacent.participants.map(p=>({...p,attended:true}))},1);
    expect(tutorPackageUsage(core.getTutorSpace(teacher).records,'pack')).toEqual({reservedMinutes:0,usedMinutes:60});
    await save('adjacent',{...adjacent,status:'completed'},2,'Presenza rettificata: assente');
    expect(tutorPackageUsage(core.getTutorSpace(teacher).records,'pack').usedMinutes).toBe(0);
    const results=await Promise.allSettled([save('race-a',input),save('race-b',input)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  });
  it('prevents calendar edits rewriting a delivered session and keeps correction snapshots',async()=>{
    const {core,save}=await fixture(),input={...appointment(),status:'completed' as const};
    await save('session',input);
    await expect(save('session',appointment(),1,'Move')).rejects.toMatchObject({code:'INVALID_COMMAND'});
    await expect(save('session',{...input,endAt:'2026-11-06T09:30:00.000Z'},1)).rejects.toMatchObject({code:'INVALID_COMMAND'});
    await save('session',{...input,endAt:'2026-11-06T09:30:00.000Z'},1,'Durata effettiva: 30 minuti');
    const history=core.getTutorSpace(teacher).history.filter(e=>e.entityId==='session');
    expect(history[0]!.payload.value).toMatchObject({endAt:input.endAt});expect(history[1]!.payload.command).toMatchObject({reason:'Durata effettiva: 30 minuti'});
  });
  it('enforces exact target revisions, no excess payment, duplicate references, future cash, immutable billing context',async()=>{
    const {core,save}=await fixture();await save('session',appointment());await save('session',{...appointment(),status:'completed'},1);
    await expect(core.executeTutor(teacher,{...payment(),targetRevision:1})).rejects.toMatchObject({code:'REVISION_CONFLICT'});
    await expect(core.executeTutor(teacher,payment(3001))).rejects.toMatchObject({code:'INVALID_COMMAND'});
    await expect(core.executeTutor(teacher,{...payment(),paidAt:'2026-11-08T00:00:00.000Z'})).rejects.toMatchObject({code:'INVALID_COMMAND'});
    await core.executeTutor(teacher,payment());
    await expect(core.executeTutor(teacher,{...payment(),recordId:'cash-2',commandId:'cash-2'})).rejects.toMatchObject({code:'INVALID_COMMAND'});
    await expect(save('session',{...appointment(),status:'completed',currency:'USD'},2,'Correction')).rejects.toMatchObject({code:'INVALID_COMMAND'});
    await expect(save('session',{...appointment(),status:'completed',participants:[{contactId:'ada',attended:true,packageId:null,chargeMinor:900}]},2,'Correction')).rejects.toMatchObject({code:'INVALID_COMMAND'});
    expect(core.getTutorSpace(teacher).records.find(r=>r.id==='session')?.revision).toBe(2);
  });
  it('keeps student and other tutor data private, including retries and referenced records',async()=>{
    const {core}=await fixture();
    for(const actor of [student,other])expect(core.getTutorSpace(actor)).toEqual({records:[],history:[]});
    const command:TutorCommand={kind:'save-tutor-record',recordId:'ada',expectedRevision:1,commandId:'edit',input:contact,reason:''};
    await expect(core.executeTutor(student,command)).rejects.toMatchObject({code:'FORBIDDEN'});
    await expect(core.executeTutor(other,command)).rejects.toMatchObject({code:'NOT_FOUND'});
    await core.executeTutor(teacher,command);await expect(core.executeTutor(other,command)).rejects.toMatchObject({code:'NOT_FOUND'});
    await expect(core.executeTutor(other,{...command,commandId:'foreign-reference',recordId:'group',expectedRevision:0,input:{...common,kind:'group',contactIds:['ada'],archived:false}})).rejects.toMatchObject({code:'NOT_FOUND'});
  });
  it('does not reassign a linked request to a person outside its appointment',async()=>{
    const {save}=await fixture();await save('bea',{...contact,title:'Bea'});
    await save('request',{...common,kind:'request',contactId:'ada',status:'open'});
    await save('session',{...appointment(),requestId:'request'});
    await expect(save('request',{...common,kind:'request',contactId:'bea',status:'open'},1)).rejects.toMatchObject({code:'INVALID_COMMAND'});
  });
  it('leaves memory and disk unchanged on write failure and keeps caller inputs immutable',async()=>{
    const {core,storage}=await fixture(),before=core.snapshot();
    storage.write=async()=>{throw Error('disk unavailable');};
    await expect(core.executeTutor(teacher,{kind:'save-tutor-record',recordId:'session',expectedRevision:0,commandId:'failure',input:appointment(),reason:''})).rejects.toThrow();
    expect(core.snapshot()).toEqual(before);expect(await storage.read()).toEqual(before);
  });
  it.each(['value','event','receipt','payment-target'] as const)('rejects %s corruption',async kind=>{
    const {core,save}=await fixture();await save('session',appointment());await save('session',{...appointment(),status:'completed'},1);await core.executeTutor(teacher,payment());
    const state=core.snapshot();
    if(kind==='value')state.tutorRecords[0]!.notes='Forged';
    if(kind==='event'){const event=state.events[0]!;if('tutorEntity'in event)event.payload.value.notes='Forged';}
    if(kind==='receipt')state.receipts[0]!.fingerprint='0'.repeat(64);
    if(kind==='payment-target'){const record=state.tutorRecords.at(-1)!;if(record.kind==='payment')record.targetRevision=1;}
    await expect(createCore({storage:new MemoryStorage(state)})).rejects.toMatchObject({code:'INVALID_SNAPSHOT'});
  });
  it('opens authentic v7 without rewriting storage and refuses hidden tutor fields in old versions',async()=>{
    const {tutorRecords:_t,...old}=emptySnapshot(),legacy={...old,schemaVersion:7},storage=new MemoryStorage(legacy);
    expect((await createCore({storage})).snapshot().schemaVersion).toBe(9);expect(await storage.read()).toEqual(legacy);
    for(const schemaVersion of [4,5,6,7])await expect(createCore({storage:new MemoryStorage({...legacy,schemaVersion,tutorRecords:[]})})).rejects.toMatchObject({code:'INVALID_SNAPSHOT'});
  });
});
