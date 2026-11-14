import {describe,expect,it} from 'vitest';
import type {Actor,CourseCommand} from '@ardesia/contracts';
import {createCore,MemoryStorage} from '@ardesia/core';
import type {RemoteClient} from '@ardesia/remote-client';
import {springCourse} from '../content';
import {startPhysicsStudy} from './start';

async function fixture(){
 const actor={actorId:'learner',role:'student'} as const;
 const storage=new MemoryStorage(),core=await createCore({storage});
 await core.executeCourse(actor,{kind:'save-course',courseId:'physics',expectedRevision:0,commandId:'save',input:springCourse()});
 const client={core,projection:{actor,workspaceId:'personal',access:'owner'},state:{pending:[]}} as unknown as RemoteClient;
 return {actor,core,client,storage,course:core.getCourseSpace(actor).courses[0]!};
}
describe('direct physics study through the authoritative course commands',()=>{
 it('converges two stale devices on one delivery using the same Core command identity',async()=>{
  const {actor,core,course}=await fixture();
  await core.executeCourse(actor,{kind:'create-course-edition',courseId:course.id,courseRevision:1,editionId:'edition',expectedRevision:0,commandId:'edition',label:'r1'});
  const device=()=>{let snapshot=core.getCourseSpace(actor);return {
   projection:{actor,workspaceId:'personal',access:'owner'},state:{pending:[]},
   core:{getCourseSpace:()=>structuredClone(snapshot),executeCourse:async(a:Actor,c:CourseCommand)=>{
    const receipt=await core.executeCourse(a,c);snapshot=core.getCourseSpace(actor);return receipt;
   }},
  } as unknown as RemoteClient;};
  const a=device(),b=device();
  const [first,second]=await Promise.all([startPhysicsStudy(a,course),startPhysicsStudy(b,course)]);
  expect(first).toBe(second);
  expect(core.getCourseSpace(actor).deliveries).toHaveLength(1);
 });
 it('does not fork a course when a stale device starts a different edition',async()=>{
  const {actor,core,course}=await fixture();
  const freeze=async(revision:number)=>core.executeCourse(actor,{kind:'create-course-edition',courseId:course.id,courseRevision:revision,editionId:'edition-'+revision,expectedRevision:0,commandId:'edition-'+revision,label:'r'+revision});
  const device=()=>{let snapshot=core.getCourseSpace(actor);return {
   projection:{actor,workspaceId:'personal',access:'owner'},state:{pending:[]},
   core:{getCourseSpace:()=>structuredClone(snapshot),executeCourse:async(a:Actor,c:CourseCommand)=>{
    const receipt=await core.executeCourse(a,c);snapshot=core.getCourseSpace(actor);return receipt;
   }},
  } as unknown as RemoteClient;};
  await freeze(1);const a=device();
  const input=springCourse();input.title='Nuova revisione';
  await core.executeCourse(actor,{kind:'save-course',courseId:course.id,expectedRevision:1,commandId:'revise',input});
  await freeze(2);const b=device(),revised=core.getCourseSpace(actor).courses[0]!;
  const first=await startPhysicsStudy(a,course);
  await expect(startPhysicsStudy(b,revised)).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  expect(core.getCourseSpace(actor).deliveries).toHaveLength(1);
  expect(core.getCourseSpace(actor).deliveries[0]!.id).toBe(first);
 });
 it('starts a private edition, resumes it after author edits, and retains attempts after reopening storage',async()=>{
  const {actor,core,client,storage,course}=await fixture();
  const id=await startPhysicsStudy(client,course);
  await core.executeCourse(actor,{kind:'record-course-attempt',deliveryId:id,expectedRevision:0,commandId:'answer',attemptId:'answer',unitId:course.units[0]!.id,stage:'prediction',answer:'Il mio ragionamento iniziale.'});
  const input=springCourse();input.title='Revisione successiva';
  await core.executeCourse(actor,{kind:'save-course',courseId:course.id,expectedRevision:1,commandId:'edit',input});
  expect(await startPhysicsStudy(client,core.getCourseSpace(actor).courses[0]!)).toBe(id);
  const reopened=await createCore({storage}),space=reopened.getCourseSpace(actor);
  expect(space.deliveries).toHaveLength(1);expect(space.editions).toHaveLength(1);
  expect(space.editions[0]!.course.title).toBe(course.title);
  expect(space.work[0]!.shared).toBe(false);expect(space.work[0]!.attempts[0]!.answer).toBe('Il mio ragionamento iniziale.');
 });
 it('retains a revoked delivery and creates a distinct new personal path',async()=>{
  const {actor,core,client,course}=await fixture(),id=await startPhysicsStudy(client,course);
  await core.executeCourse(actor,{kind:'revoke-course-delivery',deliveryId:id,expectedRevision:1,commandId:'revoke'});
  const next=await startPhysicsStudy(client,course);expect(next).not.toBe(id);
  const space=core.getCourseSpace(actor);expect(space.deliveries).toHaveLength(2);expect(space.editions).toHaveLength(1);
  expect(space.deliveries.find(d=>d.id===id)!.status).toBe('revoked');
 });
 it('reuses the confirmed edition after interruption before assignment',async()=>{
  const {actor,core,client,course}=await fixture();
  await core.executeCourse(actor,{kind:'create-course-edition',courseId:course.id,courseRevision:course.revision,editionId:'saved-edition',expectedRevision:0,commandId:'freeze',label:'Già confermata'});
  const id=await startPhysicsStudy(client,course);
  expect(core.getCourseSpace(actor).editions).toHaveLength(1);
  expect(core.getCourseSpace(actor).deliveries.find(d=>d.id===id)!.editionId).toBe('saved-edition');
 });
 it('does not write while recovery is pending or from an assigned workspace',async()=>{
  const {core,actor,client,course}=await fixture(),before=core.getCourseSpace(actor);
  const pending={...client,state:{pending:[{}]}} as unknown as RemoteClient;
  await expect(startPhysicsStudy(pending,course)).rejects.toThrow('recupero');
  const assigned={...client,projection:{...client.projection,access:'assigned'}} as unknown as RemoteClient;
  await expect(startPhysicsStudy(assigned,course)).rejects.toThrow('personale');
  expect(core.getCourseSpace(actor)).toEqual(before);
 });
});
