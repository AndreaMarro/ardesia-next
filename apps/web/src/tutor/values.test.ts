import {describe,it,expect} from 'vitest';
import type {TutorRecord} from '@ardesia/contracts';
import {money,readMoney,localInstant,totals,calendarFile} from './values';
describe('tutor exact display and interchange',()=>{
  it('keeps currencies and integer minor units exact, including totals beyond Number safe integers',()=>{
    expect(readMoney('12,01','EUR')).toBe(1201);expect(readMoney('12.001','KWD')).toBe(12001);expect(readMoney('12','JPY')).toBe(12);
    for(const value of ['1.001','NaN','-1','1e3','1.','9000000000000'])expect(()=>readMoney(value,'EUR')).toThrow();
    expect(money(1201,'EUR')).toContain('12,01');
    const base={kind:'package',id:'p',ownerId:'t',revision:1,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',title:'Pack',notes:'',custom:[],contactId:'s',totalMinutes:1,priceMinor:999999999999,currency:'EUR',expiresAt:null} as const;
    const records:TutorRecord[]=Array.from({length:10000},(_,i)=>({...base,id:String(i),custom:[]}));
    records.push({...base,id:'dollars',currency:'USD',priceMinor:20,custom:[]});
    expect(totals(records)).toEqual([['EUR',{charged:9999999999990000n,paid:0n,due:9999999999990000n}],['USD',{charged:20n,paid:0n,due:20n}]]);
    expect(money(9999999999990001n,'EUR')).toContain('99.999.999.999.900,01');
  });
  it('rejects nonexistent dates and ambiguous DST unless disambiguated by an offset',()=>{
    const previous=process.env.TZ;process.env.TZ='Europe/Rome';
    try{
      expect(()=>localInstant('2027-03-28T02:30')).toThrow();
      expect(()=>localInstant('2027-10-31T02:30')).toThrow();
      expect(localInstant('2027-10-31T02:30','+02:00')).toBe('2027-10-31T00:30:00.000Z');
      expect(localInstant('2027-10-31T02:30','+01:00')).toBe('2027-10-31T01:30:00.000Z');
      expect(()=>localInstant('2027-02-30T12:00')).toThrow();
      expect(()=>localInstant('2027-07-01T12:00','+01:00')).toThrow();
      process.env.TZ='Australia/Lord_Howe';
      expect(()=>localInstant('2027-04-04T01:45')).toThrow();
      expect(localInstant('2027-04-04T01:45','+10:30')).toBe('2027-04-03T15:15:00.000Z');
      expect(localInstant('2027-04-04T01:45','+11:00')).toBe('2027-04-03T14:45:00.000Z');
    }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
  });
  it('exports escaped, folded calendar data without private notes or participants',()=>{
    const record:TutorRecord={kind:'appointment',id:'session',ownerId:'t',revision:2,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',title:'È, una; lezione\r'.repeat(15),notes:'PRIVATE',custom:[],startAt:'2026-11-06T09:00:00.123456Z',endAt:'2026-11-06T10:00:00.000Z',timeZone:'Europe/Rome',status:'cancelled',currency:'EUR',participants:[],groupId:null,requestId:null,lesson:null};
    const result=calendarFile([record]);expect(result).toContain('DTSTART:20261106T090000Z\r\n');expect(result).toContain('STATUS:CANCELLED');expect(result).toContain('SEQUENCE:2');expect(result).not.toContain('PRIVATE');expect(result).toContain('È\\, una\\; lezione\\n');
    for(const line of result.split('\r\n'))expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
