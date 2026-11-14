import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const model=file=>{const context={module:{exports:{}}};vm.runInNewContext(readFileSync(new URL(file,root),'utf8'),context);return context.module.exports.solve;};
const solve=model('apps/web/public/fisica/termodinamica.js');
const readable=model('tools/physics-runtime/termodinamica.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const R=8.31446261815324,n=1,Ti=300,pi=100000,Cv=1.5*R,Cp=2.5*R,Vi=n*R*Ti/pi;
test('all 961 control pairs agree with independent per-leg calorimetry and SI work',()=>{
 let cases=0;
 for(let iv=10;iv<=40;iv++)for(let ip=10;ip<=40;ip++){
  const v=iv/20,p=ip/20,s=solve(v,p),plain=readable(v,p),Vf=v*Vi,pf=p*pi,Tf=pf*Vf/(n*R),Ta=pi*Vf/(n*R),Tb=pf*Vi/(n*R);
  near(s.Tf,Tf);near(s.Vf,Vf);near(s.Vi,Vi);
  // A: constant-p calorimetry then constant-V calorimetry.
  near(s.qa,n*Cp*(Ta-Ti)+n*Cv*(Tf-Ta));
  // B: constant-V calorimetry then constant-p calorimetry.
  near(s.qb,n*Cv*(Tb-Ti)+n*Cp*(Tf-Tb));
  near(s.wa,pi*(Vf-Vi));near(s.wb,pf*(Vf-Vi));
  near(s.du,n*Cv*(Tf-Ti));near(s.qa-s.wa,s.du);near(s.qb-s.wb,s.du);
  near(s.qb-s.qa,s.dw);near(s.dw,(pf-pi)*(Vf-Vi));
  assert.equal(Math.sign(s.wa),Math.sign(v-1));assert.equal(Math.sign(s.wb),Math.sign(v-1));
  assert.ok(s.Tf>=75&&s.Tf<=1200);
  for(const key of Object.keys(s))near(s[key],plain[key]);
  cases++;
 }
 assert.equal(cases,961);
});
test('same final temperature can require nonzero negative heat; signed comparisons reverse in compression',()=>{
 const s=solve(.5,2);near(s.Tf,300);near(s.du,0);near(s.wa,-n*R*Ti/2);near(s.wb,-n*R*Ti);near(s.qb,s.wb);assert.ok(s.wa>s.wb);
 const isochoric=solve(1,1.5);near(isochoric.wa,0);near(isochoric.wb,0);near(isochoric.qa,isochoric.du);near(isochoric.qb,isochoric.du);
 const isobaric=solve(1.5,1);near(isobaric.wa,isobaric.wb);near(isobaric.qa,isobaric.qb);
 for(const key of ['du','wa','wb','qa','qb','dw'])near(solve(1,1)[key],0);
});
test('default worked example matches published rounding',()=>{
 const s=solve(1.5,1.5);assert.equal(s.Tf,675);
 for(const [key,expected] of Object.entries({du:4676.89,wa:1247.17,wb:1870.75,qa:5924.05,qb:6547.64,dw:623.58}))assert.equal(Number(s[key].toFixed(2)),expected);
});
test('invalid ratios fail closed',()=>{
 for(const values of [[0,1],[1,0],[2.01,1],[1,.49],[Infinity,1],[1,NaN],['1',1],[null,1],[undefined,1]])assert.throws(()=>solve(...values));
});
