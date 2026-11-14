import {describe,it,expect} from 'vitest';
import {ExtensionDataSchema, type CompositionBody, type CompositionNode} from '@ardesia/contracts';
import {compileExpression} from '@ardesia/plugin-host';
import {physicsLabs,physicsLabData} from './labs';
const model=(id:string)=>physicsLabs.find(l=>l.id==='physics-'+id)!;
const body=(id:string)=>model(id).definition.body as unknown as CompositionBody;
const measure=(id:string,node:string,patch:Record<string,number>={})=>{
 const b=body(id),n=b.nodes.find(n=>n.id===node)!;
 return Number(compileExpression(String(n.props.expression))({...Object.fromEntries(b.fields.map(f=>[f.key,f.initial])),...patch}));
};
describe('Laboratori: identità e controprove fisiche',()=>{
 it('preserves portable Creator data and finite output over declared parameter boundaries',async()=>{
  for(const lab of physicsLabs){const data=await physicsLabData(lab.id);expect(ExtensionDataSchema.safeParse(data).success,lab.id).toBe(true);
   const b=lab.definition.body as unknown as CompositionBody;
   const nodes:CompositionNode[]=b.nodes.flatMap(n=>[n,...n.children??[]]);
   for(const patch of [{},...b.fields.flatMap(f=>[{[f.key]:f.min!},{[f.key]:f.max!}])])for(const n of nodes){
    const state={...data.state,...patch};
    if(n.kind==='plot')state[String(n.props.variable)]=Number(n.props.min);
    for(const name of n.kind==='shape'?['x','y','width','height']:['value','plot'].includes(n.kind)?['expression']:[])
     expect(Number.isFinite(Number(compileExpression(String(n.props[name]))(state))),lab.id+':'+n.id).toBe(true);
   }
  }
 });
 it('distinguishes dot and cross products and their independence of camera orientation',()=>{
  expect(measure('vectors-3d','scalar',{theta:90})).toBeCloseTo(0,10);
  expect(measure('vectors-3d','cross',{theta:90})).toBeCloseTo(4,10);
  expect(measure('vectors-3d','scalar',{theta:180})).toBeCloseTo(-4,10);
  expect(measure('vectors-3d','cross',{yaw:120})).toBeCloseTo(measure('vectors-3d','cross'),10);
 });
 it('matches complementary projectile ranges, time scaling and energy conservation',()=>{
  expect(measure('projectile','range',{angle:30})).toBeCloseTo(measure('projectile','range',{angle:60}),10);
  expect(measure('projectile','range',{speed:20})).toBeCloseTo(4*measure('projectile','range'),10);
  expect(measure('projectile','flight',{speed:20})).toBeCloseTo(2*measure('projectile','flight'),10);
  expect(measure('energy','kinetic')+measure('energy','heat')).toBeCloseTo(9.81,10);
  expect(measure('oscillator','K',{phase:37})+measure('oscillator','U',{phase:37})).toBeCloseTo(.4,10);
 });
 it('checks fluid dimensions and inverse power laws',()=>{
  expect(measure('hydrostatic','p',{h:0})).toBe(0);
  expect(measure('hydrostatic','buoyancy')).toBeCloseTo(9.81,10);
  expect(measure('continuity','v2',{r2:2})).toBeCloseTo(4*measure('continuity','v2',{r2:4}),10);
  expect(measure('poiseuille','flow',{r:.8})/measure('poiseuille','flow',{r:1})).toBeCloseTo(.4096,10);
 });
 it('uses kelvin, natural logarithms, thermal balance and electrical units',()=>{
  expect(measure('ideal-gas','pressure')).toBeCloseTo(124.71693927,6);
  expect(measure('ideal-gas','work',{ratio:2})).toBeCloseTo(-measure('ideal-gas','work',{ratio:.5}),9);
  expect(measure('calorimetry','Tf')).toBeCloseTo(40,10);
  expect(measure('calorimetry','Q1')+measure('calorimetry','Q2')).toBeCloseTo(0,9);
  expect(measure('circuit','series')).toBeCloseTo(40,10);
  expect(measure('coulomb','field',{r:.6})).toBeCloseTo(measure('coulomb','field',{r:.3})/4,10);
 });
 it('distinguishes total internal reflection, half-lives and EM amplitudes',()=>{
  expect(measure('refraction','tir',{n1:1.5,n2:1,angle:42})).toBe(1);
  expect(measure('refraction','tir',{n1:1,n2:1.5,angle:89})).toBe(0);
  expect(measure('decay','fraction',{elapsed:20,half:10})).toBeCloseTo(.25,10);
  expect(measure('decay','activity',{elapsed:0,half:1,N0:6000})).toBeCloseTo(100*Math.log(2),9);
  expect(measure('em-wave-3d','Bmax')).toBeCloseTo(33.35640952,6);
  expect(measure('em-wave-3d','intensity',{amplitude:20})).toBeCloseTo(4*measure('em-wave-3d','intensity'),10);
 });
});
