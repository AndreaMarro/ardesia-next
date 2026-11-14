import {describe,expect,it} from 'vitest';
import type {TutorAppointment,TutorPackage,TutorPayment,TutorRecord} from '@ardesia/contracts';
import {projectTutorEconomics} from './tutor-economics';
const common={ownerId:'tutor',revision:1,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',notes:'',custom:[]};
const pack=(id='pack',currency='EUR',priceMinor=6000,totalMinutes=180):TutorPackage=>({...common,kind:'package',id,title:id,contactId:'ada',currency,priceMinor,totalMinutes,expiresAt:null});
const appointment=(id:string,minute=0,duration=60):TutorAppointment=>({...common,id,title:id,kind:'appointment',startAt:new Date(Date.UTC(2026,0,2,9,minute)).toISOString(),endAt:new Date(Date.UTC(2026,0,2,9,minute+duration)).toISOString(),timeZone:'UTC',status:'completed',currency:'EUR',groupId:null,requestId:null,lesson:null,
  participants:[{contactId:'ada',attended:true,packageId:null,chargeMinor:3000}],directCostMinor:0,preparationMinutes:0});
const cash=(currency='EUR',amountMinor=6000):TutorPayment=>({...common,id:'cash-'+currency,kind:'payment',targetId:'pack',targetRevision:1,contactId:'ada',currency,amountMinor,paidAt:'2026-01-01T09:00:00.000Z',method:'Bonifico annotato',reference:'',status:'recorded',voidReason:''});

describe('economics from authorized tutor records',()=>{
 it('combines group fees and a proportional package quota, counting actual tutor time and cost once',()=>{
  const lesson=appointment('group');lesson.groupId='group';lesson.directCostMinor=500;lesson.preparationMinutes=30;
  lesson.participants=[{contactId:'ada',attended:true,packageId:'pack',chargeMinor:0},{contactId:'bea',attended:true,packageId:null,chargeMinor:3000}];
  const records:TutorRecord[]=[pack(),lesson,cash()],before=structuredClone(records),result=projectTutorEconomics(records);
  expect(result.currencies).toEqual([{currency:'EUR',singleEarnedMinor:3000n,packageEarnedMinor:2000n,earnedMinor:5000n,directCostMinor:500n,operatingMarginMinor:4500n,paidMinor:6000n,chargedMinor:9000n,dueMinor:3000n,remainingPackageValueMinor:4000n,teachingMinutes:60,preparationMinutes:30,workMinutes:90,earnedPerHourMinor:3333n,operatingMarginPerHourMinor:3000n,unenteredCostCount:0,unenteredPreparationCount:0}]);
  expect(result.appointments[0]!.allocations).toEqual([{packageId:'pack',packageRevision:1,contactId:'ada',minutes:60,earnedMinor:2000n}]);
  expect(records).toEqual(before);
 });
 it('keeps scheduled work, cancellations, absent package participants and recorded/void cash distinct',()=>{
  const scheduled={...appointment('planned'),status:'scheduled' as const,directCostMinor:400,preparationMinutes:30,participants:[{contactId:'ada',attended:false,packageId:'pack',chargeMinor:0}]};
  const cancelled={...appointment('cancelled',60),status:'cancelled' as const,directCostMinor:300,preparationMinutes:20,participants:[{contactId:'bea',attended:false,packageId:null,chargeMinor:1200}]};
  const absent={...appointment('absent',120),participants:[{contactId:'ada',attended:false,packageId:'pack',chargeMinor:0}]};
  const result=projectTutorEconomics([pack(),scheduled,cancelled,absent,cash(),{...cash(),id:'void-cash',status:'void'}]);
  expect(result.currencies[0]).toMatchObject({earnedMinor:0n,chargedMinor:7200n,paidMinor:6000n,dueMinor:1200n,remainingPackageValueMinor:6000n,directCostMinor:700n,operatingMarginMinor:-700n,teachingMinutes:60,preparationMinutes:50,workMinutes:110,operatingMarginPerHourMinor:-382n});
 });
 it('allocates every package cent once with stable cumulative rounding regardless of input order',()=>{
  const lessons=[0,1,2].map(n=>({...appointment('part-'+n,n,1),participants:[{contactId:'ada',attended:true,packageId:'pack',chargeMinor:0}]}));
  const records=[pack('pack','EUR',100,3),...lessons],result=projectTutorEconomics(records);
  expect(result.appointments.map(row=>row.packageEarnedMinor)).toEqual([33n,34n,33n]);
  expect(result.currencies[0]).toMatchObject({packageEarnedMinor:100n,remainingPackageValueMinor:0n});
  expect(projectTutorEconomics([...records].reverse())).toEqual(result);
  expect(projectTutorEconomics([records[0]!,lessons[0]!]).currencies[0]).toMatchObject({packageEarnedMinor:33n,remainingPackageValueMinor:67n});
 });
 it('separates currencies and reports absent values without inventing persisted defaults',()=>{
  const euro=appointment('euro'),dollars={...appointment('dollars'),currency:'USD'},yen={...appointment('yen'),currency:'JPY',participants:[{contactId:'ada',attended:true,packageId:null,chargeMinor:1200}]};
  delete euro.directCostMinor;delete euro.preparationMinutes;
  const result=projectTutorEconomics([euro,dollars,yen,{...cash('USD',900),targetId:'dollars'}]);
  expect(result.currencies.map(c=>[c.currency,c.earnedMinor,c.paidMinor])).toEqual([['EUR',3000n,0n],['JPY',1200n,0n],['USD',3000n,900n]]);
  expect(result.currencies[0]).toMatchObject({unenteredCostCount:1,unenteredPreparationCount:1,directCostMinor:0n});
  expect(euro).not.toHaveProperty('directCostMinor');expect(euro).not.toHaveProperty('preparationMinutes');
 });
 it('does not divide by zero and preserves negative margins for incurred costs',()=>{
  const lesson={...appointment('planned'),status:'scheduled' as const,directCostMinor:300,participants:[{contactId:'ada',attended:false,packageId:null,chargeMinor:3000}]};
  expect(projectTutorEconomics([lesson]).currencies[0]).toMatchObject({earnedMinor:0n,operatingMarginMinor:-300n,earnedPerHourMinor:null,operatingMarginPerHourMinor:null});
  lesson.preparationMinutes=30;
  expect(projectTutorEconomics([lesson]).currencies[0]).toMatchObject({operatingMarginPerHourMinor:-600n,workMinutes:30});
 });
 it('preserves large totals exactly and rejects incomplete or inconsistent package evidence',()=>{
  const many=Array.from({length:10000},(_,n)=>({...appointment('large-'+n,n,1),participants:[{contactId:'ada',attended:true,packageId:null,chargeMinor:1000000000000}]}));
  expect(projectTutorEconomics(many).currencies[0]!.earnedMinor).toBe(10000000000000000n);
  const lesson={...appointment('linked'),participants:[{contactId:'ada',attended:true,packageId:'pack',chargeMinor:0}]};
  expect(()=>projectTutorEconomics([lesson])).toThrow('complete');
  for(const bad of [{...pack(),currency:'USD'},{...pack(),contactId:'bea'},{...pack(),ownerId:'another'},{...pack(),totalMinutes:30}])expect(()=>projectTutorEconomics([bad,lesson])).toThrow('consistent');
 });
 it('uses exact current package revisions when the recorded contract is corrected',()=>{
  const lesson={...appointment('linked'),participants:[{contactId:'ada',attended:true,packageId:'pack',chargeMinor:0}]};
  const result=projectTutorEconomics([{...pack(),revision:2,priceMinor:9000},lesson]);
  expect(result.appointments[0]!.allocations[0]).toMatchObject({packageRevision:2,earnedMinor:3000n});
 });
});
