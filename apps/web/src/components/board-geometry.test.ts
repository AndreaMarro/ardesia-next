import {describe,it,expect} from 'vitest';
import {CoreCommandSchema} from '@ardesia/contracts';
import {initialCamera,toWorld,zoomAt,inkObject,inkPath,isVisible,strokeBuffer,appendSample,inkIntersectsEraser} from './board-geometry';

describe('spatial whiteboard geometry',()=>{
  it('keeps the world point under the cursor fixed across zoom and pan',()=>{
    const c={x:-3200,y:1700,zoom:.35},anchor={x:345,y:234};
    const world=toWorld(anchor,c),next=zoomAt(c,anchor,2);
    expect(toWorld(anchor,next).x).toBeCloseTo(world.x,10);expect(toWorld(anchor,next).y).toBeCloseTo(world.y,10);
  });
  it('uses bounded zoom without changing the anchored point at either extreme',()=>{
    for(const factor of [.0001,1000]){const c=zoomAt(initialCamera,{x:200,y:300},factor);expect(c.zoom).toBe(factor<1?.1:8);expect(toWorld({x:200,y:300},c)).toEqual({x:200,y:300});}
  });
  it('keeps raw pressure, negative world coordinates and dots in the existing contract',()=>{
    const input=[{x:-3400,y:9000,pressure:0},{x:-3300,y:9050,pressure:1}];
    const o=inkObject(input,'#203e62',2.5);expect(CoreCommandSchema.safeParse({kind:"add-object",commandId:"c",documentId:"d",expectedRevision:1,object:o}).success).toBe(true);
    expect(o.x).toBe(-3400);expect(o.data).toMatchObject({points:[{x:0,y:0,pressure:0},{x:100,y:50,pressure:1}]});
    const dot=inkObject([input[0]!],'#203e62',2.5);expect(CoreCommandSchema.safeParse({kind:"add-object",commandId:"c",documentId:"d",expectedRevision:1,object:dot}).success).toBe(true);
    expect(inkPath([input[0]!],2.5)).toContain('a0.38');
    expect(inkPath([{...input[0]!,pressure:1}],2.5)).toContain('a2.13');
    expect(input[0]!.x).toBe(-3400);
  });
  it('culls only outside the viewport plus overscan in transformed world space',()=>{
    const o={x:5000,y:-1000,width:200,height:100};
    expect(isVisible(o,initialCamera,1000,500)).toBe(false);
    expect(isVisible(o,{x:-5000,y:1000,zoom:1},1000,500)).toBe(true);
    expect(isVisible({x:-101,y:0,width:2,height:2},initialCamera,1000,500)).toBe(true);
  });
});

it('segments reversals, large jumps and terminal samples without invalid dimensions or missing endpoints',()=>{
  const buffer=strokeBuffer({x:0,y:0,pressure:.1}),chunks:ReturnType<typeof inkObject>[]=[];
  const emit=(points:typeof buffer.points)=>chunks.push(inkObject(points,'#203e62',2.5));
  for(const x of [-4400,4600,-8800,30000])appendSample(buffer,{x,y:0,pressure:.8},emit);
  emit(buffer.points);
  for(const object of chunks)expect(CoreCommandSchema.safeParse({kind:'add-object',commandId:'c',documentId:'d',expectedRevision:1,object}).success).toBe(true);
  const last=chunks.at(-1)!;expect(last.type==='ink'&&last.x+last.data.points.at(-1)!.x).toBe(30000);
  for(let i=1;i<chunks.length;i++){const a=chunks[i-1]!,b=chunks[i]!;if(a.type==='ink'&&b.type==='ink')expect(a.x+a.data.points.at(-1)!.x).toBe(b.x+b.data.points[0]!.x);}
});

it('segments more than 20000 samples without dropping the tail',()=>{
 const buffer=strokeBuffer({x:0,y:0,pressure:.5}),chunks:typeof buffer.points[]=[];
 for(let i=1;i<=25000;i++)appendSample(buffer,{x:i%100,y:Math.floor(i/100),pressure:.5},p=>chunks.push(p));
 chunks.push(buffer.points);expect(chunks).toHaveLength(2);expect(chunks[0]!.length).toBe(19999);
 expect(chunks.reduce((n,p)=>n+p.length,0)-(chunks.length-1)).toBe(25001);expect(chunks.at(-1)!.at(-1)).toEqual({x:0,y:250,pressure:.5});
});

it('a swept eraser hits ink and dots while ignoring empty regions inside the bounding box',()=>{
 const object=inkObject([{x:100,y:100,pressure:.5},{x:200,y:200,pressure:.5}],'#203e62',2.5,'stable-gesture');
 if(object.type!=='ink')throw Error('Ink required');
 expect(object.id).toBe('stable-gesture');
 expect(inkIntersectsEraser(object,{x:100,y:200},{x:200,y:100},2)).toBe(true);
 expect(inkIntersectsEraser(object,{x:195,y:105},{x:195,y:105},2)).toBe(false);
 expect(inkIntersectsEraser(object,{x:0,y:0},{x:0,y:0},2)).toBe(false);
 const dot=inkObject([{x:-400,y:300,pressure:1}],'#203e62',5);
 if(dot.type!=='ink')throw Error('Ink required');
 expect(inkIntersectsEraser(dot,{x:-405,y:300},{x:-400,y:300},2)).toBe(true);
});
