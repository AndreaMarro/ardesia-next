import {z} from 'zod';

const id=z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const title=z.string().trim().min(1).max(240),text=z.string().trim().max(10_000),timestamp=z.iso.datetime();
const amount=z.number().int().nonnegative().max(1_000_000_000_000);
const currency=z.string().regex(/^[A-Z]{3}$/);
const custom=z.array(z.object({label:title,value:text}).strict()).max(64);
const common={title,notes:text,custom};
export const TutorContactInputSchema=z.object({...common,kind:z.literal('contact'),email:z.union([z.literal(''),z.email().max(320)]),phone:z.string().max(100),archived:z.boolean()}).strict();
export const TutorRequestInputSchema=z.object({...common,kind:z.literal('request'),contactId:id,status:z.enum(['open','declined','closed'])}).strict();
export const TutorGroupInputSchema=z.object({...common,kind:z.literal('group'),contactIds:z.array(id).min(1).max(100),archived:z.boolean()}).strict();
export const TutorPackageInputSchema=z.object({...common,kind:z.literal('package'),contactId:id,totalMinutes:z.number().int().positive().max(10_000_000),priceMinor:amount,currency,expiresAt:timestamp.nullable()}).strict();
export const TutorAppointmentInputSchema=z.object({...common,kind:z.literal('appointment'),startAt:timestamp,endAt:timestamp,
  timeZone:z.string().min(1).max(100).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}}),
  status:z.enum(['scheduled','completed','cancelled']),currency,
  // Optional on purpose: reading an old command/event must not materialize defaults
  // and change its receipt fingerprint. Consumers interpret absence as zero entered.
  directCostMinor:amount.optional(),preparationMinutes:z.number().int().nonnegative().max(44640).optional(),
  participants:z.array(z.object({contactId:id,attended:z.boolean(),packageId:id.nullable(),chargeMinor:amount}).strict()).min(1).max(100),
  groupId:id.nullable(),requestId:id.nullable(),lesson:z.object({documentId:id,revision:z.number().int().positive()}).strict().nullable(),
}).strict().superRefine((value,ctx)=>{
  const duration=(Date.parse(value.endAt)-Date.parse(value.startAt))/60000;
  if(!Number.isInteger(duration)||duration<=0||duration>44640)ctx.addIssue({code:'custom',message:'An appointment needs a positive duration in whole minutes, within 31 days.'});
  if(new Set(value.participants.map(p=>p.contactId)).size!==value.participants.length)ctx.addIssue({code:'custom',message:'A contact participates only once.'});
  if(value.status!=='completed'&&value.participants.some(p=>p.attended))ctx.addIssue({code:'custom',message:'Only completed appointments record attendance.'});
});
export const TutorInputSchema=z.discriminatedUnion('kind',[TutorContactInputSchema,TutorRequestInputSchema,TutorGroupInputSchema,TutorPackageInputSchema,TutorAppointmentInputSchema]);
export type TutorInput=z.infer<typeof TutorInputSchema>;
const identity={id,ownerId:id,revision:z.number().int().positive(),createdAt:timestamp,updatedAt:timestamp};
export const TutorPaymentSchema=z.object({...identity,kind:z.literal('payment'),targetId:id,targetRevision:z.number().int().positive(),contactId:id,amountMinor:amount.refine(v=>v>0),currency,
  paidAt:timestamp,method:z.string().trim().min(1).max(100),reference:z.string().trim().max(500),notes:text,
  status:z.enum(['recorded','void']),voidReason:text,
}).strict();
export const TutorRecordSchema=z.discriminatedUnion('kind',[
  TutorContactInputSchema.extend(identity),TutorRequestInputSchema.extend(identity),TutorGroupInputSchema.extend(identity),
  TutorPackageInputSchema.extend(identity),TutorAppointmentInputSchema.safeExtend(identity),TutorPaymentSchema,
]);
export type TutorRecord=z.infer<typeof TutorRecordSchema>;
export type TutorAppointment=Extract<TutorRecord,{kind:'appointment'}>;
export type TutorPackage=Extract<TutorRecord,{kind:'package'}>;
export type TutorPayment=Extract<TutorRecord,{kind:'payment'}>;
const command={commandId:id,expectedRevision:z.number().int().nonnegative(),recordId:id};
export const TutorCommandKinds=['save-tutor-record','record-tutor-payment','void-tutor-payment'] as const;
export const TutorCommandSchema=z.discriminatedUnion('kind',[
  z.object({...command,kind:z.literal('save-tutor-record'),input:TutorInputSchema,reason:text.default('')}).strict(),
  z.object({...command,kind:z.literal('record-tutor-payment'),expectedRevision:z.literal(0),targetId:id,targetRevision:z.number().int().positive(),contactId:id,
    amountMinor:amount.refine(v=>v>0),paidAt:timestamp,method:z.string().trim().min(1).max(100),reference:z.string().trim().max(500),notes:text}).strict(),
  z.object({...command,kind:z.literal('void-tutor-payment'),reason:text.refine(v=>v.length>0)}).strict(),
]);
export type TutorCommand=z.infer<typeof TutorCommandSchema>;
const entity=z.enum(['contact','request','group','package','appointment','payment']);
export const TutorEventSchema=z.object({id,sequence:z.number().int().positive(),tutorEntity:entity,entityId:id,entityRevision:z.number().int().positive(),
  type:z.enum(TutorCommandKinds),actorId:id,actorRole:z.literal('teacher'),occurredAt:timestamp,payload:z.object({command:TutorCommandSchema,value:TutorRecordSchema}).strict(),
}).strict();
export type TutorEvent=z.infer<typeof TutorEventSchema>;
export const TutorReceiptSchema=z.object({commandId:id,actorId:id,fingerprint:z.string().regex(/^[a-f0-9]{64}$/),tutorEntity:entity,entityId:id,entityRevision:z.number().int().positive(),eventId:id}).strict();
export type TutorReceipt=z.infer<typeof TutorReceiptSchema>;
export const TutorSpaceSchema=z.object({records:z.array(TutorRecordSchema).max(10_000),history:z.array(TutorEventSchema)}).strict()
  .refine(value=>new Set(value.records.map(record=>record.id)).size===value.records.length,'Tutor record identities must be unique.');
export type TutorSpace=z.infer<typeof TutorSpaceSchema>;
export function tutorTarget(command:TutorCommand){return {entityId:command.recordId,tutorEntity:command.kind==='save-tutor-record'?command.input.kind:'payment' as const};}
/** Values use the currency's minor unit; different currencies are never added together. */
export function tutorCharges(record:TutorRecord):{contactId:string;currency:string;amountMinor:number}[]{
  if(record.kind==='package')return [{contactId:record.contactId,currency:record.currency,amountMinor:record.priceMinor}];
  if(record.kind==='appointment'&&record.status!=='scheduled')return record.participants.filter(p=>!p.packageId).map(p=>({contactId:p.contactId,currency:record.currency,amountMinor:p.chargeMinor}));
  return [];
}
export function tutorBalance(records:readonly TutorRecord[],targetId:string,contactId:string){
  const target=records.find(r=>r.id===targetId),charge=target&&tutorCharges(target).find(c=>c.contactId===contactId);
  const paid=records.filter((r):r is TutorPayment=>r.kind==='payment'&&r.status==='recorded'&&r.targetId===targetId&&r.contactId===contactId).reduce((sum,p)=>sum+p.amountMinor,0);
  return charge?{...charge,paidMinor:paid,dueMinor:charge.amountMinor-paid}:null;
}
export function tutorPackageUsage(records:readonly TutorRecord[],packageId:string){
  let reservedMinutes=0,usedMinutes=0;
  for(const record of records)if(record.kind==='appointment')for(const person of record.participants)if(person.packageId===packageId){
    const minutes=(Date.parse(record.endAt)-Date.parse(record.startAt))/60000;
    if(record.status==='scheduled')reservedMinutes+=minutes;
    if(record.status==='completed'&&person.attended)usedMinutes+=minutes;
  }
  return {reservedMinutes,usedMinutes};
}
