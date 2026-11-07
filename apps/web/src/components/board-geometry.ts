import type {NewEducationalObject} from '@ardesia/contracts';

export type Point = {x: number; y: number; pressure: number; sampledAt?: number};
export type Camera = {x: number; y: number; zoom: number};
export const initialCamera: Camera = {x: 0, y: 0, zoom: 1};
export const toWorld = (p: {x: number; y: number}, c: Camera) => ({x: (p.x-c.x)/c.zoom, y: (p.y-c.y)/c.zoom});
export function zoomAt(c: Camera, p: {x: number; y: number}, factor: number): Camera {
  const world = toWorld(p,c), zoom = Math.max(.1, Math.min(8,c.zoom*factor));
  return {x:p.x-world.x*zoom, y:p.y-world.y*zoom, zoom};
}
export function isVisible(o: {x: number; y: number; width: number; height: number}, c: Camera, width: number, height: number) {
  return (o.x+o.width)*c.zoom+c.x > -100 && o.x*c.zoom+c.x < width+100 && (o.y+o.height)*c.zoom+c.y > -100 && o.y*c.zoom+c.y < height+100;
}
export const radius = (p: Point, width: number) => width*(.15+.7*p.pressure);
/** Original capsule geometry. Raw pressure samples remain the persisted source;
 * generated outlines are disposable, not a new document format. */
export function inkPath(points: readonly Point[], width: number): string {
  const parts: string[] = [];
  const n = (v: number) => Math.round(v*100)/100;
  for (let i=0;i<points.length;i++) {
    const p=points[i]!, r=radius(p,width);
    parts.push(`M${n(p.x-r)} ${n(p.y)}a${n(r)} ${n(r)} 0 1 0 ${n(2*r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2*r)} 0Z`);
    const q=points[i+1]; if(!q) continue;
    const length=Math.hypot(q.x-p.x,q.y-p.y); if(!length) continue;
    const dx=(q.y-p.y)/length, dy=(p.x-q.x)/length, s=radius(q,width);
    // Same clockwise winding as the disks so overlapping joins stay filled.
    parts.push(`M${n(p.x+dx*r)} ${n(p.y+dy*r)}L${n(p.x-dx*r)} ${n(p.y-dy*r)}L${n(q.x-dx*s)} ${n(q.y-dy*s)}L${n(q.x+dx*s)} ${n(q.y+dy*s)}Z`);
  }
  return parts.join('');
}
export function inkObject(points: readonly Point[], color: string, width: number): NewEducationalObject {
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
  for(const p of points) {x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
  return {id:crypto.randomUUID(),type:'ink',title:'Annotazione a penna',x,y,width:Math.max(2,right-x),height:Math.max(2,bottom-y),
    data:{points:points.map(p=>({x:p.x-x,y:p.y-y,pressure:p.pressure})),color,width}};
}

export type StrokeBuffer = {points:Point[];left:number;right:number;top:number;bottom:number};
export function strokeBuffer(p:Point):StrokeBuffer {return {points:[p],left:p.x,right:p.x,top:p.y,bottom:p.y};}
/** Segment both long gestures and large input jumps within the unchanged Core
 * format. Each emitted chunk shares its seam sample with its successor. */
export function appendSample(buffer:StrokeBuffer,p:Point,emit:(points:Point[])=>void) {
  const from=buffer.points.at(-1)!;
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(p.x-from.x),Math.abs(p.y-from.y))/4500));
  for(let i=1;i<=steps;i++) {
    const t=i/steps,q={x:from.x+(p.x-from.x)*t,y:from.y+(p.y-from.y)*t,pressure:from.pressure+(p.pressure-from.pressure)*t,...(p.sampledAt === undefined ? {} : {sampledAt:(from.sampledAt ?? p.sampledAt)+(p.sampledAt-(from.sampledAt ?? p.sampledAt))*t})};
    if(buffer.points.length>=19999 || Math.max(buffer.right,q.x)-Math.min(buffer.left,q.x)>9000 || Math.max(buffer.bottom,q.y)-Math.min(buffer.top,q.y)>9000){
      emit(buffer.points);Object.assign(buffer,strokeBuffer(buffer.points.at(-1)!));
    }
    buffer.points.push(q);buffer.left=Math.min(buffer.left,q.x);buffer.right=Math.max(buffer.right,q.x);buffer.top=Math.min(buffer.top,q.y);buffer.bottom=Math.max(buffer.bottom,q.y);
  }
}
