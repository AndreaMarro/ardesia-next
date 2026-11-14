// Risultato del lavoro di una chat Pro. Checks the distributed consumer data, not a duplicate model.
import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {CompositionBodySchema,ExtensionDataSchema,extensionDefinitionDigest} from '@ardesia/contracts';
import {compileExpression} from '@ardesia/plugin-host';
import {PhysicsImportSchema} from './import';

const pack=PhysicsImportSchema.parse(JSON.parse(readFileSync(new URL('./data/sf-2026-fluidi.json',import.meta.url),'utf8')));
const unit=pack.input.units.find(value=>value.id==='sf-2026-u3-01')!;
const document=pack.documents.find(value=>value.id===unit.lesson!.documentId)!;
const lab=document.objects.find(value=>value.type==='extension'&&value.data.definition.typeId==='ardesia.physics.pressure');
if(!lab||lab.type!=='extension')throw Error('First pressure unit must carry its actual pressure model');
const data=lab.data,body=CompositionBodySchema.parse(data.definition.body);
const output=(id:string,state:Record<string,number>={})=>{
 const node=body.nodes.find(value=>value.id===id);if(!node)throw Error(id);
 return Number(compileExpression(String(node.props.expression))({...data.state,...state}));
};

describe('pressure unit: normal force, reference and a separate new application',()=>{
 it('carries a portable, bounded model with exact definition identity',async()=>{
  expect(ExtensionDataSchema.safeParse(data).success).toBe(true);
  expect(data.definitionDigest).toBe(await extensionDefinitionDigest(data.definition));
  expect(data.definition.description).toContain('Risultato del lavoro di una chat Pro');
  // ExtensionView uses plot.unit for the horizontal variable, which is area, not pressure.
  expect(body.nodes.find(node=>node.id==='pressureByArea')!.props.unit).toBe('cm²');
  expect(ExtensionDataSchema.safeParse({...data,state:{...data.state,area:0}}).success).toBe(false);
  expect(ExtensionDataSchema.safeParse({...data,state:{...data.state,force:-1}}).success).toBe(false);
  for(const force of [0,120])for(const area of [1,100])for(const external of [0,120]){
   for(const id of ['areaSI','relative','absolute'])expect(Number.isFinite(output(id,{force,area,external}))).toBe(true);
   expect(output('absolute',{force,area,external})).toBeGreaterThanOrEqual(external);
  }
 });
 it('matches independent piston balances and distinguishes relative from absolute changes',()=>{
  expect(output('areaSI')).toBeCloseTo(.002,12);
  expect(output('relative')).toBeCloseTo(30,10);
  expect(output('absolute')).toBeCloseTo(130,10);
  expect(output('relative',{area:10})).toBeCloseTo(60,10);
  expect(output('absolute',{area:10})).toBeCloseTo(160,10);
  expect(output('relative',{force:30,area:10})).toBeCloseTo(30,10);
  expect(output('absolute',{force:30,area:10})).toBeCloseTo(130,10);
  expect(output('relative',{external:90})).toBeCloseTo(30,10);
  expect(output('absolute',{external:90})).toBeCloseTo(120,10);
  expect(output('relative',{force:0})).toBe(0);
  expect(output('absolute',{force:0})).toBe(100);
  // Transfer force is oblique: the model accepts its normal component, 18 N.
  expect(output('absolute',{force:18,area:2.4,external:98})).toBeCloseTo(173,10);
  expect(output('absolute',{force:48,area:4.8,external:98})).toBeCloseTo(198,10);
  expect(output('pressureByArea',{a:20})).toBeCloseTo(output('relative'),10);
  expect(output('pressureByArea',{a:10})).toBeCloseTo(60,10);
 });
 it('keeps the new solution out of activity feedback and retains the existing identities',()=>{
  expect(pack.courseId).toBe('sf-2026-fluidi-v1');
  expect(unit.lesson!.documentId).toBe('sf-2026-fluidi-v1:sf-2026-u3-01');
  expect(unit.lesson!.revision).toBe(document.objects.length+1);
  expect(unit.activity).toContain('Pressione nel pistone');
  expect(unit.transfer).toContain('60° con la normale');
  expect(unit.referenceFeedback).not.toContain('F=96 N');
  expect(unit.referenceFeedback).not.toContain('173 kPa');
  const question=document.objects.find(value=>value.type==='extension'&&value.data.state.questionId==='original-U3-01-pro-transfer-v1');
  expect(question?.type).toBe('extension');
  if(question?.type!=='extension')throw Error('Separate transfer solution missing');
  expect(String(question.data.state.solution)).toContain('F=96 N');
  expect(String(question.data.state.source)).toContain('Risultato del lavoro di una chat Pro');
  expect(String(question.data.state.source)).not.toContain('Confronto contro259');
  expect(pack.status).toBe('DRAFT');expect(pack.humanApproval).toBe(false);
 });
});
