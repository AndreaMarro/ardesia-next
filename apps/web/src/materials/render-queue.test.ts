import {it,expect} from 'vitest';
import {renderMaterialInTurn,materialRasterSize} from './render-queue';
it('does not start another decoder until cleanup and ignores pages removed while queued',async()=>{
  let release!:()=>void,active=0,peak=0,ran=0;const signal=new AbortController(),cancelled=new AbortController();
  const first=renderMaterialInTurn(async()=>{active++;peak=Math.max(peak,active);await new Promise<void>(r=>release=r);active--;},signal.signal);
  await Promise.resolve();await Promise.resolve();
  const second=renderMaterialInTurn(async()=>{ran++;},cancelled.signal),third=renderMaterialInTurn(async()=>{active++;peak=Math.max(peak,active);ran++;active--;},signal.signal);
  cancelled.abort();release();await Promise.all([first,second,third]);expect(peak).toBe(1);expect(ran).toBe(1);
});
it('bounds the actual decoded page independently of manifest claims',()=>{
  for(const [width,height] of [[600,800],[1e9,1e9],[1e9,1],[1,1e9]]){
    const size=materialRasterSize(width!,height!);expect(size.width).toBeLessThanOrEqual(1600);expect(size.height).toBeLessThanOrEqual(2000);expect(size.width*size.height).toBeLessThanOrEqual(3_200_000);
  }
  expect(()=>materialRasterSize(Infinity,10)).toThrow();
});
