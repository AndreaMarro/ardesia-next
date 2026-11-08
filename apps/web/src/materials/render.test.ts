import {it,expect,vi} from 'vitest';
import {renderMaterial} from './render';
import type {MaterialData} from '@ardesia/contracts';
const data:MaterialData={assetId:'asset',sha256:'a'.repeat(64),mimeType:'image/png',name:'fixture.png',license:'CC0',page:1,pageCount:1,pageWidth:20,pageHeight:10};
it('acquires originals only inside the decoder queue and never loads a cancelled queued page',async()=>{
  const first=new AbortController(),second=new AbortController(),third=new AbortController(),calls:string[]=[];
  let release!:()=>void;const wait=new Promise<void>(r=>release=r);
  vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){}})})});
  vi.stubGlobal('createImageBitmap',async()=>({width:20,height:10,close(){}}));
  try{
    const a=renderMaterial(async()=>{calls.push('first');await wait;return new Blob();},data,first.signal);
    await vi.waitFor(()=>expect(calls).toEqual(['first']));
    const b=renderMaterial(async()=>{calls.push('cancelled');return new Blob();},data,second.signal).catch(error=>error);
    const c=renderMaterial(async()=>{calls.push('third');return new Blob();},data,third.signal);
    await Promise.resolve();expect(calls).toEqual(['first']);second.abort();release();
    await a;expect(await b).toMatchObject({name:'AbortError'});await c;
    expect(calls).toEqual(['first','third']);
  }finally{release();vi.unstubAllGlobals();}
});
