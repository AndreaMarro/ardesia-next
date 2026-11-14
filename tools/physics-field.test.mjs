import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const context={module:{exports:{}},RangeError};vm.runInNewContext(readFileSync(new URL('../apps/web/public/fisica/campo.js',import.meta.url),'utf8'),context);
const {fieldAt,chargesFor,heightForPotential,COULOMB_K,EXCLUSION_RADIUS_M,projectionMatrix}=context.module.exports;
const dipole={qNanoC:1,separationM:1.6,arrangement:'dipole'},positive={...dipole,arrangement:'positive'};
const near=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
test('dipole center: zero scalar potential and nonzero +x vector sum',()=>{const r=fieldAt(dipole,0,0);assert.equal(r.valid,true);assert.equal(r.potentialV,0);near(r.ex,2*COULOMB_K*1e-9/.8**2);assert.equal(r.ey,0);assert.ok(r.contributions.every(c=>c.ex>0));assert.equal(r.contributions[0].potentialV,-r.contributions[1].potentialV);});
test('equal positive charges: nonzero potential, zero field only at center',()=>{const r=fieldAt(positive,0,0);near(r.potentialV,2*COULOMB_K*1e-9/.8);assert.equal(r.magnitude,0);assert.ok(fieldAt(positive,0,1).ey>0);});
test('dipole symmetry and equal positive symmetry across axes',()=>{for(const[x,y]of [[.4,.7],[1.7,-.8],[0,1.3]]){const a=fieldAt(dipole,x,y),b=fieldAt(dipole,-x,y),c=fieldAt(dipole,x,-y);near(a.potentialV,-b.potentialV);near(a.ex,b.ex);near(a.ey,-b.ey);near(a.potentialV,c.potentialV);near(a.ey,-c.ey);const p=fieldAt(positive,x,y),q=fieldAt(positive,-x,y);near(p.potentialV,q.potentialV);near(p.ex,-q.ex);near(p.ey,q.ey);}});
test('field equals negative potential gradient away from exclusions',()=>{const h=1e-5;for(const config of[dipole,positive])for(const[x,y]of[[.2,.6],[-1.8,.4],[.6,-1.3]]){const r=fieldAt(config,x,y),dx=(fieldAt(config,x+h,y).potentialV-fieldAt(config,x-h,y).potentialV)/(2*h),dy=(fieldAt(config,x,y+h).potentialV-fieldAt(config,x,y-h).potentialV)/(2*h);near(r.ex,-dx,2e-7);near(r.ey,-dy,2e-7);}});
test('charge and distance scalings preserve signs and dimensions',()=>{const a=fieldAt(dipole,.1,.7),b=fieldAt({...dipole,qNanoC:2},.1,.7);near(b.ex,2*a.ex);near(b.ey,2*a.ey);near(b.potentialV,2*a.potentialV);const center=fieldAt(dipole,0,0),half=fieldAt({...dipole,separationM:.8},0,0);near(half.ex,4*center.ex);});
test('sum of independently displayed contributions equals reported fields',()=>{for(const config of[dipole,positive])for(const[x,y]of[[-2,-1],[.1,.5],[1.3,1.4]]){const r=fieldAt(config,x,y);near(r.potentialV,r.contributions.reduce((n,c)=>n+c.potentialV,0));near(r.ex,r.contributions.reduce((n,c)=>n+c.ex,0));near(r.ey,r.contributions.reduce((n,c)=>n+c.ey,0));near(r.magnitude,Math.hypot(r.ex,r.ey));}});
test('singular and excluded points yield no invented finite measurement',()=>{for(const x of[-.8,.8,-.8+EXCLUSION_RADIUS_M/2]){const r=fieldAt(dipole,x,0);assert.equal(r.valid,false);assert.equal(r.potentialV,null);assert.equal(r.ex,null);assert.equal(r.magnitude,null);assert.ok(Array.isArray(r.contributions));assert.equal(r.contributions.length,0);}assert.equal(fieldAt(dipole,.8,EXCLUSION_RADIUS_M).valid,true);});
test('display saturation never modifies scientific readings',()=>{const config={...positive,qNanoC:3},r=fieldAt(config,.8,.2);assert.ok(r.potentialV>60);assert.equal(heightForPotential(r.potentialV),1.5);const before=r.potentialV;heightForPotential(r.potentialV);assert.equal(r.potentialV,before);assert.equal(heightForPotential(-100),-1.5);near(heightForPotential(20),.5);});
test('nonfinite coordinates, invalid ranges and arrangements rejected',()=>{for(const v of[NaN,Infinity,-Infinity,2.51,-2.51,'1'])assert.throws(()=>fieldAt(dipole,v,0),RangeError);for(const c of[{qNanoC:0},{qNanoC:4},{separationM:0},{separationM:3},{arrangement:'other'},{qNanoC:NaN}])assert.throws(()=>chargesFor({...dipole,...c}),RangeError);assert.throws(()=>heightForPotential(Infinity),RangeError);});

test('camera contains every domain corner and normalized arrow tip across narrow and wide views',()=>{
 for(const[width,height]of[[356.8,390],[294,390],[800,560],[1024,400]])for(const yaw of[-3.14,-1.57,-.785,-.46,0,.785,1.57,3.14])for(const elevation of[.22,.76,1.42]){
  const m=projectionMatrix(width,height,yaw,elevation);
  const project=(x,y,z)=>[(m[0]*x+m[4]*y+m[8]*z+1)*width/2,(1-m[1]*x-m[5]*y-m[9]*z)*height/2];
  for(const x of[-2.5,2.5])for(const y of[-2.5,2.5])for(const z of[-1.5,0,1.5])for(const angle of[0,Math.PI/4,Math.PI/2,Math.PI,1.5*Math.PI]){
   const p=project(x+.66*Math.cos(angle),y+.66*Math.sin(angle),z);
   assert.ok(p[0]>=43.9&&p[0]<=width-43.9,JSON.stringify({width,height,yaw,elevation,p}));
   assert.ok(p[1]>=64.9&&p[1]<=height-64.9,JSON.stringify({width,height,yaw,elevation,p}));
  }
 }
});
test('camera does not alter physical probe values and rejects nonfinite camera inputs',()=>{
 const config={qNanoC:1,separationM:1.6,arrangement:'dipole'},before=fieldAt(config,2.5,2.5);
 projectionMatrix(356.8,390,-.46,.76);assert.equal(fieldAt(config,2.5,2.5).potentialV,before.potentialV);
 for(const bad of[NaN,Infinity])assert.throws(()=>projectionMatrix(390,390,bad,.76),RangeError);
});
