import {describe,it,expect} from 'vitest';
import {materialPosition,materialPage,MaterialManifestSchema,migrateSnapshotForOpen,CoreSnapshotSchema,toObjectInput, type NewEducationalObject} from '@ardesia/contracts';
import {createCore,MemoryStorage,validateMaterialReference} from './index';

const manifest=MaterialManifestSchema.parse({format:'ardesia-material-v1',assetId:'asset',documentId:'lesson',name:'Fonte.pdf',mimeType:'application/pdf',sha256:'a'.repeat(64),bytes:8,license:'CC0',pages:[{width:600,height:800},{width:600,height:800}],parts:[{index:0,bytes:8,sha256:'a'.repeat(64)}]});
const material:NewEducationalObject={id:'page',type:'material',title:'Fonte p. 2',x:100,y:200,width:600,height:800,data:materialPage(manifest,2)};
const ink:NewEducationalObject={id:'annotation',type:'ink',title:'Appunto',x:120,y:240,width:50,height:60,data:{points:[{x:0,y:0,pressure:.5},{x:30,y:40,pressure:.5}],color:'#203e62',width:2,anchor:{objectId:'page',x:100,y:200}}};
describe('material identity and anchored ink',()=>{
  it('preserves original/page identity, moves the annotation with the page, replays and reopens without changing ink samples',async()=>{
    const storage=new MemoryStorage(),core=await createCore({storage}),actor={actorId:'owner',role:'student' as const};
    await core.execute(actor,{kind:'create-document',commandId:'c1',documentId:'lesson',expectedRevision:0,title:'Lesson'});
    await core.execute(actor,{kind:'add-object',commandId:'c2',documentId:'lesson',expectedRevision:1,object:material});
    await core.execute(actor,{kind:'add-object',commandId:'c3',documentId:'lesson',expectedRevision:2,object:ink});
    await core.execute(actor,{kind:'move-object',commandId:'c4',documentId:'lesson',expectedRevision:3,objectId:'page',x:400,y:700});
    const reopened=await createCore({storage}),doc=reopened.getDocument(actor,'lesson');
    const saved=doc.objects.find(o=>o.id==='annotation')!;
    expect(materialPosition(saved,doc.objects)).toMatchObject({x:420,y:740,data:ink.data});
    expect(saved).toMatchObject({x:120,y:240});
    const page=doc.objects.find(o=>o.id==='page')!;
    await expect(reopened.execute(actor,{kind:'replace-object',commandId:'bad',documentId:'lesson',expectedRevision:4,object:{...toObjectInput(page),type:'material',data:materialPage(manifest,1)}})).rejects.toMatchObject({code:'INVALID_REFERENCE'});
    await expect(reopened.execute(actor,{kind:'remove-object',commandId:'remove',documentId:'lesson',expectedRevision:4,objectId:'page'})).rejects.toMatchObject({code:'INVALID_REFERENCE'});
    expect(reopened.getDocument(actor,'lesson')).toEqual(doc);
    const old={...core.snapshot(),schemaVersion:8};expect(CoreSnapshotSchema.safeParse(migrateSnapshotForOpen(old)).success).toBe(false);
  });
  it('refuses incomplete media and mismatched exact references',()=>{
    const state={manifest,status:'ready' as const,ownerId:'owner',createdAt:'2026-11-07T12:00:00Z'};
    expect(()=>validateMaterialReference(state,'lesson',materialPage(manifest,2))).not.toThrow();
    expect(()=>validateMaterialReference({...state,status:'uploading'},'lesson',materialPage(manifest,2))).toThrow();
    expect(()=>validateMaterialReference(state,'other',materialPage(manifest,2))).toThrow();
    expect(()=>validateMaterialReference(state,'lesson',{...materialPage(manifest,2),sha256:'b'.repeat(64)})).toThrow();
    expect(()=>MaterialManifestSchema.parse({...manifest,bytes:9})).toThrow();
  });
});
