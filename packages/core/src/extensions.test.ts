import {describe,expect,it} from 'vitest';
import {PROGRAM_RENDERER,ProgramBodySchema,COMPOSITION_RENDERER,CompositionBodySchema,CoreCommandSchema,ExtensionDataSchema,extensionDefinitionDigest,emptySnapshot,type ExtensionData,type ExtensionDefinition,type NewEducationalObject} from '@ardesia/contracts';
import {createCore,MemoryStorage} from './index';

const owner={actorId:'creator',role:'teacher' as const};
async function data(overrides:Partial<ExtensionDefinition>={}):Promise<ExtensionData>{
  const definition:ExtensionDefinition={format:'ardesia-extension/1',typeId:'personal.unseen-coincidence-counter',version:1,name:'Coincidenze',description:'Tipo non presente nel frontend',license:'CC0-1.0',renderer:COMPOSITION_RENDERER,fallback:'Conta coincidenze e calcola il doppio.',body:{fields:[{key:'count',label:'Coincidenze',kind:'number',initial:0,min:0,max:100}],nodes:[{id:'section',kind:'group',props:{layout:'stack'},children:[{id:'result',kind:'value',props:{label:'Doppio',expression:'count*2'}},{id:'button',kind:'action',props:{label:'Conta',field:'count',expression:'count+1'}}]}]},...overrides};
  return {definition,definitionDigest:await extensionDefinitionDigest(definition),state:{count:0}};
}
async function fixture(){const storage=new MemoryStorage();const core=await createCore({storage});await core.execute(owner,{kind:'create-document',commandId:'new',documentId:'lesson',expectedRevision:0,title:'Laboratorio'});return{core,storage};}
const object=(data:ExtensionData,id='object'):NewEducationalObject=>({id,type:'extension',title:'Coincidenze',x:0,y:0,width:300,height:300,data});

describe('versioned user-created types on the existing Core authority',()=>{
  it('does not reserve a release after a failed write or leak it into another Core',async()=>{
    const storage=new MemoryStorage();let fail=false;
    const core=await createCore({storage:{read:()=>storage.read(),write:async snapshot=>{if(fail)throw Error('Synthetic write failure');await storage.write(snapshot);}}});
    await core.execute(owner,{kind:'create-document',commandId:'new',documentId:'lesson',expectedRevision:0,title:'Laboratorio'});
    const first=await data(),alternative=await data({name:'Alternative release'}),before=core.snapshot();
    fail=true;
    await expect(core.execute(owner,{kind:'add-object',commandId:'failed',documentId:'lesson',expectedRevision:1,object:object(first)})).rejects.toMatchObject({code:'STORAGE_FAILURE'});
    expect(core.snapshot()).toEqual(before);expect(await storage.read()).toEqual(before);
    fail=false;
    await core.execute(owner,{kind:'add-object',commandId:'accepted',documentId:'lesson',expectedRevision:1,object:object(alternative)});
    const next=await data({version:2,name:'Uncommitted version'}),accepted=core.snapshot();fail=true;
    await expect(core.execute(owner,{kind:'replace-object',commandId:'failed-replace',documentId:'lesson',expectedRevision:2,object:object(next)})).rejects.toMatchObject({code:'STORAGE_FAILURE'});
    expect(core.snapshot()).toEqual(accepted);expect(await storage.read()).toEqual(accepted);fail=false;
    await core.execute(owner,{kind:'replace-object',commandId:'accepted-replace',documentId:'lesson',expectedRevision:2,object:object(await data({version:2,name:'Committed version'}))});
    const isolated=await fixture();
    await isolated.core.execute(owner,{kind:'add-object',commandId:'independent',documentId:'lesson',expectedRevision:1,object:object(first)});
    expect(isolated.core.getDocument(owner,'lesson').objects[0]).toMatchObject({data:first});
    expect((await createCore({storage})).snapshot()).toEqual(core.snapshot());
  });
  it('retains removed releases before and after reopen and rejects altered bytes with a known digest',async()=>{
    const {core,storage}=await fixture(),first=await data(),alternative=await data({name:'Conflicting removed release'});
    await core.execute(owner,{kind:'add-object',commandId:'add',documentId:'lesson',expectedRevision:1,object:object(first)});
    await core.execute(owner,{kind:'remove-object',commandId:'remove',documentId:'lesson',expectedRevision:2,objectId:'object'});
    const before=core.snapshot();
    for(const instance of [core,await createCore({storage})]){
      for(const [i,value] of [alternative,{...alternative,definitionDigest:first.definitionDigest}].entries()){
        await expect(instance.execute(owner,{kind:'add-object',commandId:'conflict'+i,documentId:'lesson',expectedRevision:3,object:object(value,'replacement')})).rejects.toMatchObject({code:'INVALID_REFERENCE'});
        expect(instance.snapshot()).toEqual(before);expect(await storage.read()).toEqual(before);
      }
    }
  });
  it('serializes release reservations across queued commands without keeping a rejected release',async()=>{
    const {core}=await fixture(),first=await data(),alternative=await data({name:'Queued collision'});
    const outcomes=await Promise.allSettled([
      core.execute(owner,{kind:'add-object',commandId:'first',documentId:'lesson',expectedRevision:1,object:object(first)}),
      core.execute(owner,{kind:'add-object',commandId:'second',documentId:'lesson',expectedRevision:2,object:object(alternative,'second')}),
    ]);
    expect(outcomes[0]!.status).toBe('fulfilled');expect(outcomes[1]).toMatchObject({status:'rejected',reason:{code:'INVALID_REFERENCE'}});
    await core.execute(owner,{kind:'add-object',commandId:'third',documentId:'lesson',expectedRevision:2,object:object(first,'third')});
    expect(core.getDocument(owner,'lesson').objects.map(o=>o.id)).toEqual(['object','third']);
    expect(core.snapshot().receipts.map(r=>r.commandId)).toEqual(['new','first','third']);
  });
  it('saves a new type, updates instance state, reopens exact history and changes definition through an explicit next version',async()=>{
    const {core,storage}=await fixture(),first=await data();
    const add={kind:'add-object' as const,commandId:'add',documentId:'lesson',expectedRevision:1,object:object(first)};
    const receipt=await core.execute(owner,add);
    await core.execute(owner,{kind:'replace-object',commandId:'value',documentId:'lesson',expectedRevision:2,object:object({...first,state:{count:7}})});
    const second=await data({version:2,name:'Contatore universale'});
    await core.execute(owner,{kind:'replace-object',commandId:'release',documentId:'lesson',expectedRevision:3,object:object({...second,state:{count:7}})});
    const reopened=await createCore({storage});
    expect(reopened.getDocument(owner,'lesson').objects[0]).toMatchObject({revision:3,data:{definition:{version:2},state:{count:7}}});
    expect(reopened.getObjectRevision(owner,'lesson','object',1)).toMatchObject({data:first});
    expect(await reopened.execute(owner,add)).toEqual(receipt);
  });
  it('rejects state type/range, digest tampering, identity changes, conflicting release names and permissions atomically',async()=>{
    const {core,storage}=await fixture(),first=await data();await core.execute(owner,{kind:'add-object',commandId:'add',documentId:'lesson',expectedRevision:1,object:object(first)});
    const before=await storage.read();
    const variants=[{...first,state:{count:'1'}},{...first,state:{count:-1}},{...first,state:{count:1,secret:'no'}},{...first,definitionDigest:'f'.repeat(64)},await data({typeId:'another.identity'}),await data({name:'Changed without version'}),await data({version:3,name:'Skipped version'})];
    for(const [i,invalid]of variants.entries()){
      await expect(core.execute(owner,{kind:'replace-object',commandId:'bad'+i,documentId:'lesson',expectedRevision:2,object:object(invalid)})).rejects.toBeTruthy();expect(await storage.read()).toEqual(before);
    }
    const other=await data({name:'Different data for the same identity'});
    await expect(core.execute(owner,{kind:'add-object',commandId:'collision',documentId:'lesson',expectedRevision:2,object:object(other,'second')})).rejects.toMatchObject({code:'INVALID_REFERENCE'});
    for(const actor of [{actorId:'student',role:'student' as const},{actorId:'other',role:'teacher' as const}])await expect(core.execute(actor,{kind:'add-object',commandId:'outsider',documentId:'lesson',expectedRevision:2,object:object(first,'third')})).rejects.toBeTruthy();
    expect(await storage.read()).toEqual(before);
  });
  it('keeps unknown renderers and nested JSON portable without executing them',async()=>{
    const {core,storage}=await fixture();const foreign=await data({renderer:'future.mechanics/4',body:{custom:{data:[1,2,3]}}});foreign.state={arbitrary:{position:[1,2]}};
    await core.execute(owner,{kind:'add-object',commandId:'unknown',documentId:'lesson',expectedRevision:1,object:object(foreign)});
    const reopened=await createCore({storage});expect(reopened.getDocument(owner,'lesson').objects[0]).toMatchObject({data:foreign});
  });
  it('preserves malformed and future program bodies as opaque v7 data without making them executable',async()=>{
    const {core,storage}=await fixture();const opaque=await data({renderer:PROGRAM_RENDERER,body:{code:42,intervalMs:1,unknown:[1,2,3]}});opaque.state={preserved:true};
    expect(ProgramBodySchema.safeParse(opaque.definition.body).success).toBe(false);
    await core.execute(owner,{kind:'add-object',commandId:'opaque',documentId:'lesson',expectedRevision:1,object:object(opaque)});
    const before=await storage.read(),reopened=await createCore({storage});
    expect(await storage.read()).toEqual(before);expect(reopened.snapshot().schemaVersion).toBe(11);
    expect(reopened.getDocument(owner,'lesson').objects[0]).toMatchObject({data:opaque});
    await reopened.execute(owner,{kind:'remove-object',commandId:'remove-opaque',documentId:'lesson',expectedRevision:2,objectId:'object'});
    expect((await createCore({storage})).getObjectRevision(owner,'lesson','object',1)).toMatchObject({data:opaque});
  });
  it('opens v5 with zero writes and preserves legacy receipts; refuses a disguised new object or corrupted hash',async()=>{
    const old={...preCourse(emptySnapshot()),schemaVersion:5};const storage=new MemoryStorage(old);const core=await createCore({storage});expect(core.snapshot().schemaVersion).toBe(11);expect(await storage.read()).toEqual(old);
    const live=await fixture(),first=await data();await live.core.execute(owner,{kind:'add-object',commandId:'add',documentId:'lesson',expectedRevision:1,object:object(first)});
    const snapshot=live.core.snapshot();await expect(createCore({storage:new MemoryStorage({...snapshot,schemaVersion:5})})).rejects.toMatchObject({code:'INVALID_SNAPSHOT'});
    const corrupt=structuredClone(snapshot);const o=corrupt.documents[0]!.objects[0]!;if(o.type==='extension')o.data.definition.name='Tampered';
    await expect(createCore({storage:new MemoryStorage(corrupt)})).rejects.toMatchObject({code:'INVALID_SNAPSHOT'});
  });
  it('rejects recursive/accessor/prototype content before accepting a command',async()=>{
    const value=await data(),cycle:Record<string,unknown>={};cycle.self=cycle;
    let read=false;const getter=Object.defineProperty({},'value',{enumerable:true,get(){read=true;return 1;}});
    const sparse:unknown[]=[];sparse.length=1;Object.assign(sparse,{extra:1});
    for(const body of [cycle,getter,JSON.parse('{"__proto__":{"polluted":true}}'),sparse])expect(ExtensionDataSchema.safeParse({...value,definition:{...value.definition,body}}).success).toBe(false);
    expect(read).toBe(false);
    expect(CoreCommandSchema.safeParse({kind:'add-object',commandId:'untrusted',documentId:'lesson',expectedRevision:1,object:object({...value,state:{count:NaN}})}).success).toBe(false);
  });
  it('treats inherited property names as unknown components and rejects reserved field and plot identifiers',async()=>{
    expect(CompositionBodySchema.safeParse({fields:[],nodes:[{id:'unknown',kind:'constructor',props:{},fallback:'Componente non disponibile'}]}).success).toBe(true);
    expect(CompositionBodySchema.safeParse({fields:[],nodes:[{id:'unknown',kind:'constructor',props:{}}]}).success).toBe(false);
    for(const key of ['pi','e','true','false','constructor','prototype']){
      expect(CompositionBodySchema.safeParse({fields:[{key,label:'Campo',kind:'number',initial:1}],nodes:[]}).success).toBe(false);
      expect(CompositionBodySchema.safeParse({fields:[],nodes:[{id:'plot',kind:'plot',props:{label:'Curva',expression:'1',variable:key,min:0,max:1}}]}).success).toBe(false);
    }
  });
  it('rejects v6 extensions disguised in any historical version and invalid objects remaining only in history',async()=>{
    const {core}=await fixture(),first=await data();await core.execute(owner,{kind:'add-object',commandId:'add',documentId:'lesson',expectedRevision:1,object:object(first)});
    await core.execute(owner,{kind:'remove-object',commandId:'remove',documentId:'lesson',expectedRevision:2,objectId:'object'});
    const snapshot=core.snapshot();expect(snapshot.documents[0]!.objects).toHaveLength(0);
    for(const schemaVersion of [1,2,3,4,5])await expect(createCore({storage:new MemoryStorage({...snapshot,schemaVersion})})).rejects.toMatchObject({code:'INVALID_SNAPSHOT'});
    const corrupt=structuredClone(snapshot);
    const event=corrupt.events.find(e=>e.type==='add-object')!;
    (event.payload as unknown as {object:{data:{state:unknown}}}).object.data.state={count:'corrupted'};
    await expect(createCore({storage:new MemoryStorage(corrupt)})).rejects.toMatchObject({code:'INVALID_SNAPSHOT'});
    const tampered=structuredClone(snapshot),removed=tampered.events.find(e=>e.type==='remove-object')!;
    (removed.payload as unknown as {previous:{data:ExtensionData}}).previous.data.definition.name='Corrupt deleted release';
    await expect(createCore({storage:new MemoryStorage(tampered)})).rejects.toMatchObject({code:'INVALID_SNAPSHOT'});
  });
  it('preserves imported lineage and exact source attribution while assigning the real current author',async()=>{
    const {core,storage}=await fixture(),first=await data();first.lineage=[{
      typeId:first.definition.typeId,version:1,definitionDigest:first.definitionDigest,definitionLicense:'CC-BY-4.0',objectId:'source-object',objectRevision:3,createdBy:'asserted-external-author',createdAt:'2026-11-01T12:00:00.000Z',
      sources:[{id:'source',revision:1,title:'Fonte originale',url:'https://example.com/source',publisher:'Autore',locator:'Capitolo 1',referenceLocator:'Equazione 1.2',sourceRevision:'Edizione 2024',license:'CC-BY-4.0'}],missingSources:[],
    }];
    await core.execute(owner,{kind:'add-object',commandId:'import',documentId:'lesson',expectedRevision:1,object:{...object(first),provenance:{origin:'imported',sources:[]}}});
    expect(core.getDocument(owner,'lesson').objects[0]).toMatchObject({provenance:{createdBy:'creator',origin:'imported'},data:{lineage:first.lineage}});
    const before=await storage.read();
    await expect(core.execute(owner,{kind:'replace-object',commandId:'erase-lineage',documentId:'lesson',expectedRevision:2,object:object({...first,lineage:[]})})).rejects.toMatchObject({code:'INVALID_REFERENCE'});
    expect(await storage.read()).toEqual(before);
    const second=await data({version:2,name:'Nuova versione',license:'Tutti i diritti riservati'});second.lineage=first.lineage;
    await core.execute(owner,{kind:'replace-object',commandId:'next',documentId:'lesson',expectedRevision:2,object:object(second)});
    expect((await createCore({storage})).getDocument(owner,'lesson').objects[0]).toMatchObject({data:{lineage:[...first.lineage,{typeId:first.definition.typeId,version:1,definitionDigest:first.definitionDigest,definitionLicense:'CC0-1.0',sources:[],missingSources:[]}],definition:{version:2}}});
  });
});

// Model historical envelopes with exactly their old fields, not a relabelled v7 snapshot.
function preCourse<T extends object>(snapshot: T) {
  const {notebookLibraries: _notebooks, tutorRecords: _t, courses: _c, courseEditions: _e, courseDeliveries: _d, courseWork: _w, ...legacy} = snapshot as T & {notebookLibraries?: unknown; tutorRecords?: unknown; courses?: unknown; courseEditions?: unknown; courseDeliveries?: unknown; courseWork?: unknown};
  return legacy;
}
