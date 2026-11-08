import type {InkObject, MaterialObject} from '@ardesia/contracts';
import {inkPath, radius,type Point} from '../components/board-geometry';

export type Bounds = {left:number;top:number;width:number;height:number};
export type PlacedInk = {object:InkObject;dx:number;dy:number};
export type InkPlate = {id:string;bounds:Bounds;ink:PlacedInk[];material?:MaterialObject};
export const INK_TILE = {width:640,height:800,maxPages:64};
export const INK_PRINT_MM_PER_UNIT=180/INK_TILE.height;
export const HANDOUT_INK_LIMITS={sourceSamples:200_000,plateSamples:25_000};
const n=(value:number)=>String(Number(value.toFixed(6)));
export function inkBounds(object:InkObject):Bounds {
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const p of object.data.points){const r=radius(p,object.data.width);left=Math.min(left,p.x-r);top=Math.min(top,p.y-r);right=Math.max(right,p.x+r);bottom=Math.max(bottom,p.y+r);}
  return {left,top,width:Math.max(1,right-left),height:Math.max(1,bottom-top)};
}
function union(a:Bounds,b:Bounds):Bounds {
  const left=Math.min(a.left,b.left),top=Math.min(a.top,b.top);
  return {left,top,width:Math.max(a.left+a.width,b.left+b.width)-left,height:Math.max(a.top+a.height,b.top+b.height)-top};
}
export function materialPlate(material:MaterialObject,annotations:InkObject[]):InkPlate {
  let bounds:Bounds={left:0,top:0,width:material.width,height:material.height};
  const ink=annotations.map(object=>{
    const anchor=object.data.anchor!;
    const dx=object.x-anchor.x,dy=object.y-anchor.y,b=inkBounds(object);
    bounds=union(bounds,{...b,left:b.left+dx,top:b.top+dy});return {object,dx,dy};
  });
  return {id:'material-'+material.id,bounds,ink,material};
}
// Segment versus an expanded rectangle: visits only occupied tiles, including
// capsule edges. Huge jumps never allocate the empty bounding rectangle.
function hits(x:number,y:number,qx:number,qy:number,left:number,top:number,right:number,bottom:number) {
  return interval(x,y,qx,qy,left,top,right,bottom)!==null;
}
function interval(x:number,y:number,qx:number,qy:number,left:number,top:number,right:number,bottom:number):[number,number]|null {
  let lo=0,hi=1;
  for(const [p,d,a,b] of [[x,qx-x,left,right],[y,qy-y,top,bottom]]){
    if(d===0){if(p!<a!||p!>b!)return null;continue;}
    const s=(a!-p!)/d!,t=(b!-p!)/d!;lo=Math.max(lo,Math.min(s,t));hi=Math.min(hi,Math.max(s,t));if(lo>hi)return null;
  }
  return [lo,hi];
}
/** Clip only the disposable geometry, including the maximum capsule radius.
 * The fixed viewport performs the final clip; no source samples are rewritten. */
export function visibleInk({object,dx,dy}:PlacedInk,b:Bounds):Point[][] {
  const groups:Point[][]=[];let active:Point[]|undefined,count=0;
  const points=object.data.points;
  for(let i=0;i<points.length;i++){
    const p=points[i]!,q=points[i+1]??p,r=Math.max(radius(p,object.data.width),radius(q,object.data.width));
    const x=p.x+dx,y=p.y+dy,qx=q.x+dx,qy=q.y+dy;
    const range=interval(x,y,qx,qy,b.left-r,b.top-r,b.left+b.width+r,b.top+b.height+r);
    if(!range){active=undefined;continue;}
    const at=(t:number)=>({x:x+(qx-x)*t,y:y+(qy-y)*t,pressure:p.pressure+(q.pressure-p.pressure)*t});
    const a=at(range[0]),z=at(range[1]),last=active?.at(-1);
    if(!last||last.x!==a.x||last.y!==a.y||last.pressure!==a.pressure){active=[a];groups.push(active);count++;}
    if(a.x!==z.x||a.y!==z.y||a.pressure!==z.pressure){active!.push(z);count++;}
    if(count>HANDOUT_INK_LIMITS.plateSamples)throw Error('Una tavola contiene troppi campioni per la dispensa. Nessun tratto è stato omesso.');
  }
  return groups;
}
function plateGeometry(plate:InkPlate){
  const geometry=plate.ink.map(ink=>({...ink,groups:visibleInk(ink,plate.bounds)}));
  if(geometry.reduce((sum,ink)=>sum+ink.groups.reduce((n,g)=>n+g.length,0),0)>HANDOUT_INK_LIMITS.plateSamples)throw Error('Una tavola contiene troppi campioni per la dispensa. Nessun tratto è stato omesso.');
  return geometry;
}
export function placedInkPath(ink:PlacedInk,bounds:Bounds):string{return visibleInk(ink,bounds).map(points=>inkPath(points,ink.object.data.width)).join('');}
/** Fixed-scale, occupied spatial tiles; a crossing stroke is clipped at the
 * page edge rather than independently resized. No source sample is changed. */
export function inkPlates(objects:InkObject[]):InkPlate[] {
  if(objects.reduce((sum,o)=>sum+o.data.points.length,0)>HANDOUT_INK_LIMITS.sourceSamples)throw Error('La scrittura supera il budget di preparazione. Nessun tratto è stato omesso.');
  const tiles=new Map<string,InkPlate>(),w=INK_TILE.width,h=INK_TILE.height;
  for(const object of objects){
    const occupied=new Set<string>(),points=object.data.points;
    for(let i=0;i<points.length;i++){
      const p=points[i]!,q=points[i+1]??p,r=Math.max(radius(p,object.data.width),radius(q,object.data.width));
      const x=p.x+object.x,y=p.y+object.y,qx=q.x+object.x,qy=q.y+object.y;
      const x0=Math.floor((Math.min(x,qx)-r)/w),x1=Math.floor((Math.max(x,qx)+r)/w);
      const y0=Math.floor((Math.min(y,qy)-r)/h),y1=Math.floor((Math.max(y,qy)+r)/h);
      // Coordinates are bounded by the document schema. Reject an excessive
      // spatial extent before an adversarial segment can monopolize the UI.
      if((x1-x0+1)+(y1-y0+1)>INK_TILE.maxPages*2)throw Error('La scrittura supera 64 tavole. Esporta una lezione con un’area più contenuta; nessun tratto è stato omesso.');
      for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
        if(!hits(x,y,qx,qy,tx*w-r,ty*h-r,(tx+1)*w+r,(ty+1)*h+r))continue;
        const key=tx+','+ty;if(occupied.has(key))continue;occupied.add(key);
        let tile=tiles.get(key);
        if(!tile){if(tiles.size>=INK_TILE.maxPages)throw Error('La scrittura supera 64 tavole. Nessun tratto è stato omesso.');tile={id:'ink-'+tx+'-'+ty,bounds:{left:tx*w,top:ty*h,width:w,height:h},ink:[]};tiles.set(key,tile);}
        tile.ink.push({object,dx:object.x,dy:object.y});
      }
    }
  }
  return [...tiles.values()].sort((a,b)=>a.bounds.top-b.bounds.top||a.bounds.left-b.bounds.left).map(tile=>{
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const {object,groups} of plateGeometry(tile))for(const points of groups)for(const p of points){
      const r=radius(p,object.data.width);left=Math.min(left,p.x-r);top=Math.min(top,p.y-r);right=Math.max(right,p.x+r);bottom=Math.max(bottom,p.y+r);
    }
    const b=tile.bounds,x=Math.max(b.left,Math.floor(left)-12),y=Math.max(b.top,Math.floor(top)-12);
    return {...tile,bounds:{left:x,top:y,width:Math.max(1,Math.min(b.left+b.width,Math.ceil(right)+12)-x),height:Math.max(1,Math.min(b.top+b.height,Math.ceil(bottom)+12)-y)}};
  });
}
export function plateSvg(plate:InkPlate):string {
  const b=plate.bounds;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+[b.left,b.top,b.width,b.height].map(n).join(' ')+'">'+plateGeometry(plate).map(({object,groups})=>
    '<path fill="'+object.data.color+'" d="'+groups.map(points=>inkPath(points,object.data.width)).join('')+'"/>').join('')+'</svg>';
}
export function plateTikz(plate:InkPlate,rasterPath?:string):string {
  const b=plate.bounds,scale=plate.material?Math.min(17.4/b.width,18/b.height):INK_PRINT_MM_PER_UNIT/10;
  const xy=(x:number,y:number)=>'('+n((x-b.left)*scale)+','+n((y-b.top)*scale)+')';
  const lines=['\\begin{tikzpicture}[x=1cm,y=-1cm]', '\\path[use as bounding box] (0,0) rectangle ('+n(b.width*scale)+','+n(b.height*scale)+');','\\begin{scope}','\\clip (0,0) rectangle ('+n(b.width*scale)+','+n(b.height*scale)+');'];
  if(plate.material&&rasterPath){
    if(!/^assets\/[a-f0-9]{64}\.png$/.test(rasterPath))throw Error('Invalid generated asset path');
    lines.push('\\node[anchor=north west,inner sep=0pt] at '+xy(0,0)+' {\\includegraphics[width='+n(plate.material.width*scale)+'cm,height='+n(plate.material.height*scale)+'cm]{'+rasterPath+'}};');
  }
  for(const {object,groups} of plateGeometry(plate)){
    lines.push('\\definecolor{ardesiaink}{HTML}{'+object.data.color.slice(1)+'}');
    for(const points of groups)for(let i=0;i<points.length;i++){
      const p=points[i]!,q=points[i+1],r=radius(p,object.data.width),x=p.x,y=p.y;
      lines.push('\\path[fill=ardesiaink,draw=none] '+xy(x,y)+' circle[radius='+n(r*scale)+'cm];');
      if(!q)continue;const length=Math.hypot(q.x-p.x,q.y-p.y);if(!length)continue;
      const a=(q.y-p.y)/length,c=(p.x-q.x)/length,s=radius(q,object.data.width);
      lines.push('\\path[fill=ardesiaink,draw=none] '+xy(x+a*r,y+c*r)+' -- '+xy(x-a*r,y-c*r)+' -- '+xy(q.x-a*s,q.y-c*s)+' -- '+xy(q.x+a*s,q.y+c*s)+' -- cycle;');
    }
  }
  return lines.concat('\\end{scope}','\\end{tikzpicture}').join('\n');
}
