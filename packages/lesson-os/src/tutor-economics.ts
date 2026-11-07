import {CoreError,tutorCharges,type TutorRecord,type TutorAppointment,type TutorPackage} from '@ardesia/contracts';

export interface TutorAppointmentEconomics {
  appointmentId:string; appointmentRevision:number; currency:string;
  singleEarnedMinor:bigint; packageEarnedMinor:bigint; directCostMinor:bigint;
  teachingMinutes:number; preparationMinutes:number;
  allocations:{packageId:string;packageRevision:number;contactId:string;minutes:number;earnedMinor:bigint}[];
}
export interface TutorCurrencyEconomics {
  currency:string;singleEarnedMinor:bigint;packageEarnedMinor:bigint;earnedMinor:bigint;
  directCostMinor:bigint;operatingMarginMinor:bigint;paidMinor:bigint;chargedMinor:bigint;dueMinor:bigint;
  remainingPackageValueMinor:bigint;teachingMinutes:number;preparationMinutes:number;workMinutes:number;
  earnedPerHourMinor:bigint|null;operatingMarginPerHourMinor:bigint|null;
  unenteredCostCount:number;unenteredPreparationCount:number;
}
const rounded=(numerator:bigint,denominator:bigint)=>numerator<0n?-((-numerator+denominator/2n)/denominator):(numerator+denominator/2n)/denominator;
const lexical=(a:string,b:string)=>a<b?-1:a>b?1:0;
const invalid=():never=>{throw new CoreError('INVALID_SNAPSHOT','Tutor economics requires complete, consistent authorized tutor records.');};

/** A disposable projection of current authorized Core records. It records no
 * accounting entries, performs no FX and grants no access. Values are integer
 * minor units; BigInt preserves totals above Number.MAX_SAFE_INTEGER.
 *
 * Package revenue follows completed attendance. Cumulative rounding per package
 * in chronological/ID order allocates all cents exactly when its time is used.
 * Direct costs/preparation mean already incurred work, even on cancelled or
 * scheduled appointments. Neither is multiplied by the number of participants.
 */
export function projectTutorEconomics(records:readonly TutorRecord[]):{currencies:TutorCurrencyEconomics[];appointments:TutorAppointmentEconomics[]} {
  const packages=new Map(records.filter((r):r is TutorPackage=>r.kind==='package').map(r=>[r.id,r]));
  const used=new Map<string,number>(),currencies=new Map<string,TutorCurrencyEconomics>();
  const currency=(code:string)=>{
    if(!currencies.has(code))currencies.set(code,{currency:code,singleEarnedMinor:0n,packageEarnedMinor:0n,earnedMinor:0n,directCostMinor:0n,operatingMarginMinor:0n,paidMinor:0n,chargedMinor:0n,dueMinor:0n,remainingPackageValueMinor:0n,
      teachingMinutes:0,preparationMinutes:0,workMinutes:0,earnedPerHourMinor:null,operatingMarginPerHourMinor:null,unenteredCostCount:0,unenteredPreparationCount:0});
    return currencies.get(code)!;
  };
  for(const record of records){
    for(const charge of tutorCharges(record))currency(charge.currency).chargedMinor+=BigInt(charge.amountMinor);
    if(record.kind==='payment'&&record.status==='recorded')currency(record.currency).paidMinor+=BigInt(record.amountMinor);
  }
  const appointments=records.filter((r):r is TutorAppointment=>r.kind==='appointment').sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)||lexical(a.id,b.id)).map(appointment=>{
    const row:TutorAppointmentEconomics={appointmentId:appointment.id,appointmentRevision:appointment.revision,currency:appointment.currency,
      singleEarnedMinor:0n,packageEarnedMinor:0n,directCostMinor:BigInt(appointment.directCostMinor??0),teachingMinutes:0,preparationMinutes:appointment.preparationMinutes??0,allocations:[]};
    const total=currency(appointment.currency);
    if(appointment.status==='completed'){
      row.teachingMinutes=(Date.parse(appointment.endAt)-Date.parse(appointment.startAt))/60000;
      for(const person of appointment.participants){
        if(!person.packageId){row.singleEarnedMinor+=BigInt(person.chargeMinor);continue;}
        const pack=packages.get(person.packageId);
        if(!pack||pack.currency!==appointment.currency||pack.ownerId!==appointment.ownerId||pack.contactId!==person.contactId)return invalid();
        if(!person.attended)continue;
        const before=used.get(pack.id)??0,after=before+row.teachingMinutes;
        if(after>pack.totalMinutes)return invalid();
        const earned=rounded(BigInt(pack.priceMinor)*BigInt(after),BigInt(pack.totalMinutes))-rounded(BigInt(pack.priceMinor)*BigInt(before),BigInt(pack.totalMinutes));
        used.set(pack.id,after);row.packageEarnedMinor+=earned;
        row.allocations.push({packageId:pack.id,packageRevision:pack.revision,contactId:person.contactId,minutes:row.teachingMinutes,earnedMinor:earned});
      }
    }
    total.singleEarnedMinor+=row.singleEarnedMinor;total.packageEarnedMinor+=row.packageEarnedMinor;
    total.directCostMinor+=row.directCostMinor;total.teachingMinutes+=row.teachingMinutes;total.preparationMinutes+=row.preparationMinutes;
    if(appointment.directCostMinor===undefined)total.unenteredCostCount++;
    if(appointment.preparationMinutes===undefined)total.unenteredPreparationCount++;
    return row;
  });
  for(const pack of packages.values())currency(pack.currency).remainingPackageValueMinor+=BigInt(pack.priceMinor)-rounded(BigInt(pack.priceMinor)*BigInt(used.get(pack.id)??0),BigInt(pack.totalMinutes));
  for(const total of currencies.values()){
    total.earnedMinor=total.singleEarnedMinor+total.packageEarnedMinor;total.operatingMarginMinor=total.earnedMinor-total.directCostMinor;
    total.dueMinor=total.chargedMinor-total.paidMinor;total.workMinutes=total.teachingMinutes+total.preparationMinutes;
    if(total.workMinutes>0){total.earnedPerHourMinor=rounded(total.earnedMinor*60n,BigInt(total.workMinutes));total.operatingMarginPerHourMinor=rounded(total.operatingMarginMinor*60n,BigInt(total.workMinutes));}
  }
  return {currencies:[...currencies.values()].sort((a,b)=>lexical(a.currency,b.currency)),appointments};
}
