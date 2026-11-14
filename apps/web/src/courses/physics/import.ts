import {z} from 'zod';
import {canonicalJson,CourseInputSchema,NewObjectSchema,ownsWorkspace,toObjectInput,type Course,type CourseInput,type NewEducationalObject} from '@ardesia/contracts';
import type {RemoteClient} from '@ardesia/remote-client';

const id=z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
export const PhysicsImportSchema=z.object({format:z.literal('ardesia-physics-course/1'),courseId:id,
 input:CourseInputSchema,documents:z.array(z.object({id,title:z.string().min(1).max(240),objects:z.array(NewObjectSchema).max(200)}).strict()).min(1).max(38),
 counts:z.object({objectives:z.number().int().positive(),practice:z.number().int().nonnegative(),originals:z.number().int().nonnegative().optional(),assessments:z.number().int().positive(),labs:z.number().int().nonnegative()}).strict(),
 status:z.literal('DRAFT'),humanApproval:z.literal(false),sourceRevision:z.string().min(1),
}).strict().superRefine((pack,ctx)=>{
 const docs=new Map(pack.documents.map(doc=>[doc.id,doc]));
 if(docs.size!==pack.documents.length||pack.input.units.length!==docs.size)ctx.addIssue({code:'custom',message:'Course lessons must be unique and complete'});
 for(const unit of pack.input.units){const doc=unit.lesson&&docs.get(unit.lesson.documentId);if(!doc||unit.lesson?.revision!==doc.objects.length+1||new Set(doc.objects.map(o=>o.id)).size!==doc.objects.length)ctx.addIssue({code:'custom',message:'Each unit needs its exact planned lesson revision'});}
});
export type PhysicsImportPack=z.infer<typeof PhysicsImportSchema>;
const comparable=(object:NewEducationalObject)=>({id:object.id,type:object.type,title:object.title,x:object.x,y:object.y,width:object.width,height:object.height,data:object.data,provenance:object.provenance??{origin:'authored',sources:[]}});
/** Imports ordinary, versioned Core objects. Fixed command IDs let a partially
 * completed import resume without duplicating or overwriting authored work.
 * A lost response stays in Remote Client recovery; it is never bypassed. */
export async function importPhysicsCourse(client:RemoteClient,input:unknown,onProgress:(text:string)=>void):Promise<Course>{
 const pack=PhysicsImportSchema.parse(input),projection=client.projection;
 if(!projection||!ownsWorkspace(projection))throw Error('Apri un tuo spazio personale per aggiungere il corso.');
 const actor=projection.actor,workspaceId=projection.workspaceId;
 const check=()=>{if(client.projection?.workspaceId!==workspaceId||client.projection?.actor.actorId!==actor.actorId)throw Error('Lo spazio è cambiato. Importazione interrotta; i materiali già salvati restano conservati.');if(client.state.pending.length)throw Error('Conferma le modifiche nel pannello di recupero, poi riprendi l’importazione.');};
 check();
 const existing=client.core.getCourseSpace(actor).courses.find(c=>c.id===pack.courseId);if(existing)return existing;
 let count=0;const total=pack.documents.reduce((n,d)=>n+d.objects.length+1,0)+1;
 for(const planned of pack.documents){
  check();onProgress(`${++count}/${total} · ${planned.title}`);
  let document=client.projection!.documents.find(d=>d.id===planned.id);
  if(!document){await client.core.execute(actor,{kind:'create-document',commandId:planned.id+':create',documentId:planned.id,expectedRevision:0,title:planned.title});document=client.projection!.documents.find(d=>d.id===planned.id);}
  if(!document||document.title!==planned.title||document.connections.length||document.revision!==document.objects.length+1||document.objects.some((o,i)=>!planned.objects[i]||canonicalJson(comparable(toObjectInput(o)))!==canonicalJson(comparable(planned.objects[i]!))))throw Error('Una lezione importata è stata modificata. Conservala ed esportala: l’importazione non sovrascrive il tuo lavoro.');
  for(const [index,object] of planned.objects.entries()){
   check();onProgress(`${++count}/${total} · ${planned.title}`);
   if(index<document.objects.length)continue;
   await client.core.execute(actor,{kind:'add-object',commandId:planned.id+':add:'+index,documentId:planned.id,expectedRevision:index+1,object});
  }
 }
 check();onProgress(`${total}/${total} · Salvataggio del percorso`);
 await client.core.executeCourse(actor,{kind:'save-course',courseId:pack.courseId,expectedRevision:0,input:pack.input as CourseInput,commandId:pack.courseId+':create'});
 return client.core.getCourseSpace(actor).courses.find(c=>c.id===pack.courseId)!;
}
