import {describe,expect,it} from 'vitest';
import {createCore,MemoryStorage} from './index';

const student={actorId:'personal-learner',role:'student'} as const;
const teacher={actorId:'their-teacher',role:'teacher'} as const;
const other={actorId:'other-learner',role:'student'} as const;
const create={kind:'create-document',commandId:'personal-create',documentId:'personal-lesson',expectedRevision:0,title:'Il mio laboratorio'} as const;

describe('personal authoring independent of teaching role',()=>{
  it('lets a learner own, edit, reopen and replay their private document without becoming a teacher',async()=>{
    const storage=new MemoryStorage(),core=await createCore({storage});
    const first=await core.execute(student,create);
    await core.execute(student,{kind:'add-object',commandId:'personal-note',documentId:create.documentId,expectedRevision:1,
      object:{id:'my-note',type:'note',title:'Una mia idea',x:0,y:0,width:280,height:180,data:{text:'Una domanda ancora aperta'}}});
    const reopened=await createCore({storage});
    expect(reopened.getDocument(student,create.documentId)).toMatchObject({ownerId:student.actorId,revision:2,status:'draft'});
    expect(await reopened.execute(student,create)).toEqual(first);
    expect(reopened.getObjectRevision(student,create.documentId,'my-note',1).provenance.createdBy).toBe(student.actorId);
    for(const outsider of [teacher,other]){
      expect(reopened.listDocuments(outsider)).toEqual([]);
      expect(()=>reopened.events(outsider,create.documentId)).toThrow();
      await expect(reopened.execute(outsider,{kind:'rename-document',commandId:'outsider-'+outsider.actorId,documentId:create.documentId,expectedRevision:2,title:'No'})).rejects.toMatchObject({code:'NOT_FOUND'});
    }
    await expect(reopened.executeLearning(student,{kind:'assign-lesson',commandId:'not-a-teaching-grant',documentId:create.documentId,studentId:other.actorId,expectedRevision:0})).rejects.toMatchObject({code:'FORBIDDEN'});
    expect(reopened.getTutorSpace(student)).toEqual({records:[],history:[]});
  });

  it('lets the same learner create a versioned course and resume personal study without sharing other learners data',async()=>{
    const storage=new MemoryStorage(),core=await createCore({storage});
    await core.execute(student,create);
    const input={title:'Il mio microcorso',description:'Un percorso personale',license:'Private',units:[{id:'unit',title:'Una domanda',objective:'Spiegare',prerequisites:'Osservare',explanation:'Un modello',prediction:'Prevedi',activity:'Prova',referenceFeedback:'Confronta',recovery:'Rivedi',transfer:'Applica',sources:[],lesson:{documentId:create.documentId,revision:1}}]};
    await core.executeCourse(student,{kind:'save-course',commandId:'save',courseId:'course',expectedRevision:0,input});
    await core.executeCourse(student,{kind:'create-course-edition',commandId:'freeze',courseId:'course',courseRevision:1,editionId:'edition',expectedRevision:0,label:'Prima edizione'});
    await core.executeCourse(student,{kind:'assign-course',commandId:'self',editionId:'edition',deliveryId:'self-study',learnerId:student.actorId,expectedRevision:0});
    await core.executeCourse(student,{kind:'record-course-attempt',commandId:'answer',deliveryId:'self-study',expectedRevision:0,unitId:'unit',attemptId:'attempt',stage:'prediction',answer:'La mia ipotesi privata'});
    const reopened=await createCore({storage});
    expect(reopened.getCourseSpace(student).courses[0]?.ownerId).toBe(student.actorId);
    expect(reopened.getCourseSpace(student).work[0]?.attempts[0]?.answer).toBe('La mia ipotesi privata');
    expect(await reopened.readCourseLesson(student,'edition','unit')).toMatchObject({id:create.documentId,revision:1});
    expect(reopened.getCourseSpace(teacher)).toEqual({courses:[],editions:[],deliveries:[],work:[]});
    await expect(reopened.executeCourse(student,{kind:'assign-course',commandId:'other-student',editionId:'edition',deliveryId:'other',learnerId:other.actorId,expectedRevision:0})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
});
