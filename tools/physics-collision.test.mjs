import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context={module:{exports:{}}};
vm.runInNewContext(readFileSync('apps/web/public/fisica/urti.js','utf8'),context);
const {solve,pose,bounds}=context.module.exports;
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);

test('all control combinations preserve momentum and the stated energy balance, with physical contact order',()=>{
 let cases=0;
 for(let m1=.5;m1<=4;m1+=.5)for(let m2=.5;m2<=4;m2+=.5)
 for(let u1=.5;u1<=4;u1+=.5)for(let u2=-2;u2<=0;u2+=.5)for(const mode of ['elastic','stick']){
  const s=solve(m1,m2,u1,u2,mode),[low,high]=bounds(s);
  near(s.pf,m1*u1+m2*u2);near(s.kf,(m1*s.v1**2+m2*s.v2**2)/2);
  if(mode==='elastic'){near(s.ki,s.kf);near(s.v2-s.v1,u1-u2);assert.equal(s.loss,0);}
  else {near(s.v1,s.v2);near(s.loss,.5*m1*m2/(m1+m2)*(u1-u2)**2);near(s.ki,s.kf+s.loss);}
  near(pose(s,.8)[0],0);near(pose(s,.8)[1],0);
  for(const t of [0,.4,.8,1.2,1.6]){const [a,b]=pose(s,t);assert.ok(a<=b+1e-10);assert.ok(a>=low&&a<=high&&b>=low&&b<=high);}
  cases++;
 }
 assert.equal(cases,5120);
});
test('equal speeds do not imply zero momentum; invalid scientific inputs are rejected',()=>{
 const s=solve(1,3,1,-1,'stick');near(s.p,-2);near(s.v1,-.5);near(s.ki,2);near(s.kf,.5);near(s.loss,1.5);
 for(const args of [[0,1,1,0,'stick'],[1,5,1,0,'stick'],[1,1,-1,0,'elastic'],[1,1,1,1,'elastic'],[1,1,Infinity,0,'stick'],[1,1,1,0,'unknown']])assert.throws(()=>solve(...args));
});
