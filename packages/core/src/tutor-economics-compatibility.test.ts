import {describe,expect,it} from 'vitest';
import {CoreSnapshotSchema,TutorCommandSchema,TutorInputSchema,canonicalJson,type TutorInput} from '@ardesia/contracts';
import {createCore,MemoryStorage} from './index';
import legacy from './fixtures/tutor-v9.json';
const actor={actorId:'teacher',role:'teacher'} as const;
const upgraded={...legacy,schemaVersion:10};
const historical=TutorCommandSchema.parse(legacy.events[1]!.payload.command);
const input=()=>{
 if(historical.kind!=='save-tutor-record'||historical.input.kind!=='appointment')throw Error('Historical appointment required');
 return structuredClone(historical.input);
};

describe('optional tutor economics preserves exact historical contracts',()=>{
 it('opens a golden snapshot emitted by a4835aa without rewriting records, commands, storage or fingerprints',async()=>{
  const storage=new MemoryStorage(structuredClone(legacy)),core=await createCore({storage});
  expect(CoreSnapshotSchema.parse(upgraded)).toEqual(upgraded);expect(core.snapshot()).toEqual(upgraded);expect(await storage.read()).toEqual(legacy);
  expect(core.snapshot().receipts.map(r=>r.fingerprint)).toEqual(['46c909bd2f09ee75b7299039156ea7dbcc544452b3b287e6be8a68a20503bf09','f60aaf597de30d578f820d4c1ba7661c9a394061296b731030713b57def779a5']);
  expect(await core.executeTutor(actor,historical)).toEqual(legacy.receipts[1]);expect(core.snapshot()).toEqual(upgraded);
  expect(TutorInputSchema.parse(input())).not.toHaveProperty('directCostMinor');
  expect(TutorInputSchema.parse(input())).not.toHaveProperty('preparationMinutes');
  const v8={...structuredClone(legacy),schemaVersion:8},oldStorage=new MemoryStorage(v8);expect((await createCore({storage:oldStorage})).snapshot()).toEqual(upgraded);expect(await oldStorage.read()).toEqual(v8);
 });
 it('stores costs/preparation through the same atomic revision/history path and reopens them exactly',async()=>{
  const storage=new MemoryStorage(structuredClone(legacy));const core=await createCore({storage,clock:()=> '2026-11-07T13:00:00.000Z',id:()=> 'cost-event'});
  const command={kind:'save-tutor-record' as const,recordId:'session',expectedRevision:1,reason:'Consuntivo costi e preparazione',commandId:'cost-command',input:{...input(),directCostMinor:450,preparationMinutes:25}};
  const receipt=await core.executeTutor(actor,command);expect(await core.executeTutor(actor,command)).toEqual(receipt);
  const snapshot=core.snapshot();expect(snapshot.events.slice(0,2)).toEqual(legacy.events);expect(snapshot.receipts.slice(0,2)).toEqual(legacy.receipts);
  expect(core.getTutorSpace(actor).records.find(r=>r.id==='session')).toMatchObject({revision:2,directCostMinor:450,preparationMinutes:25});
  expect((await createCore({storage})).snapshot()).toEqual(snapshot);
  for(const schemaVersion of [8,9]){const mislabeled={...snapshot,schemaVersion};const older=new MemoryStorage(mislabeled);await expect(createCore({storage:older})).rejects.toMatchObject({code:'INVALID_SNAPSHOT'});expect(await older.read()).toEqual(mislabeled);}
  expect(canonicalJson(snapshot.events[2])).toContain('preparationMinutes');
 });
 it('rejects invalid financial/time values before any mutation and preserves the existing reason gate',async()=>{
  const storage=new MemoryStorage(structuredClone(legacy)),core=await createCore({storage});
  const command={kind:'save-tutor-record' as const,recordId:'session',expectedRevision:1,reason:'Correzione',commandId:'invalid-cost',input:input()};
  for(const fields of [{directCostMinor:-1},{directCostMinor:.5},{directCostMinor:1000000000001},{preparationMinutes:-1},{preparationMinutes:2.5},{preparationMinutes:44641}]){
   await expect(core.executeTutor(actor,{...command,input:{...input(),...fields} as TutorInput})).rejects.toMatchObject({code:'INVALID_COMMAND'});
   expect(core.snapshot()).toEqual(upgraded);expect(await storage.read()).toEqual(legacy);
  }
  await expect(core.executeTutor(actor,{...command,reason:'',input:{...input(),directCostMinor:100}})).rejects.toMatchObject({code:'INVALID_COMMAND'});
  expect(core.snapshot()).toEqual(upgraded);
 });
});
