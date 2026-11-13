import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {CompositionBodySchema,ExtensionDataSchema,extensionDefinitionDigest,type CompositionNode,type ExtensionData} from '@ardesia/contracts';
import {compileExpression} from '@ardesia/plugin-host/composition';
import {PhysicsImportSchema} from './import';

type Question={id:string;prompt:string;solution:string;correctChoice:string;choices:{id:string;text:string;feedback:string}[]};
const sources=new URL('../../../../../docs/sources/physics-2026-27/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('distributed-assets.json',sources),'utf8')) as {files:{file:string}[]};
const originals=JSON.parse(readFileSync(new URL('editorial/original-problems.json',sources),'utf8')) as Question[];
const questions=originals.filter(q=>q.choices);
const packs=manifest.files.map(({file})=>PhysicsImportSchema.parse(JSON.parse(readFileSync(new URL('./data/'+file,import.meta.url),'utf8'))));
const distributed=packs.flatMap(p=>p.documents.flatMap(d=>d.objects)).filter(o=>o.type==='extension'&&o.data.definition.typeId==='ardesia.curriculum.choice-question');
const flatten=(nodes:CompositionNode[]):CompositionNode[]=>nodes.flatMap(node=>[node,...flatten(node.children??[])]);
function model(question:Question){
 const object=distributed.find(o=>o.type==='extension'&&o.data.state.questionId===question.id);
 if(!object||object.type!=='extension')throw Error('Missing guided question '+question.id);
 const data=object.data,nodes=flatten(CompositionBodySchema.parse(data.definition.body).nodes);
 const read=(id:string,state:ExtensionData['state'])=>compileExpression(String(nodes.find(n=>n.id===id)!.props.expression))(state);
 const action=(id:string,state:ExtensionData['state'])=>({...state,[String(nodes.find(n=>n.id===id)!.props.field)]:read(id,state)});
 return {data,read,action};
}

describe('guided alternatives retain their exact content and separate choice from feedback',()=>{
 it('distributes ten original five-choice questions using one portable definition',async()=>{
  expect(questions).toHaveLength(10);expect(distributed).toHaveLength(10);
  expect(new Set(questions.map(q=>q.id)).size).toBe(10);
  expect(new Set(questions.map(q=>q.correctChoice))).toEqual(new Set('ABCDE'));
  const digests=new Set<string>();
  for(const q of questions){
   const {data}=model(q);expect(ExtensionDataSchema.safeParse(data).success).toBe(true);
   expect(data.definitionDigest).toBe(await extensionDefinitionDigest(data.definition));digests.add(data.definitionDigest);
   expect(q.choices.map(c=>c.id)).toEqual(['A','B','C','D','E']);
   expect(data.state.prompt).toBe(q.prompt+'\n\n'+q.choices.map(c=>c.id+') '+c.text).join('\n'));
   expect(data.state.solution).toBe(q.solution);expect(data.state.kind).toBe('original');
   expect(data.state.correct).toBe('ABCDE'.indexOf(q.correctChoice)+1);
  }
  expect(digests.size).toBe(1);
  for(const pack of packs){expect(pack.status).toBe('DRAFT');expect(pack.humanApproval).toBe(false);}
 });

 it('explains each of the fifty alternatives and identifies exactly one correct choice per question',()=>{
  for(const q of questions){
   const {data,read,action}=model(q);let correct=0;
   for(const option of q.choices){
    const state=action('check',action('choose'+option.id,structuredClone(data.state)));
    const judgment=read('judgment',state);if(judgment==='Risposta corretta')correct++;
    expect(judgment).toBe(option.id===q.correctChoice?'Risposta corretta':'Risposta da rivedere');
    expect(read('feedback',state)).toBe(option.feedback);expect(read('reasoning',state)).toBe(q.solution);
   }
   expect(correct).toBe(1);
  }
 });

 it('does not grade an empty or changed selection and preserves the authored source',()=>{
  for(const q of questions){
   const {data,read,action}=model(q),before=JSON.stringify(data);
   expect(read('judgment',action('check',data.state))).toMatch(/^Scegli/);
   for(const option of q.choices){
    const selected=action('choose'+option.id,data.state);
    expect(read('judgment',selected)).toMatch(/^Scegli/);
    expect(read('feedback',selected)).not.toBe(option.feedback);
    const checked=action('check',selected),other=q.choices.find(c=>c.id!==option.id)!;
    const changed=action('choose'+other.id,checked);
    expect(read('judgment',changed)).toMatch(/^Scegli/);
    expect(read('feedback',changed)).not.toBe(option.feedback);
    expect(read('reasoning',changed)).not.toBe(q.solution);
    for(const reset of [action('choose'+option.id,changed),action('choose'+option.id,checked)]){
     expect(read('judgment',reset)).toMatch(/^Scegli/);expect(read('feedback',reset)).not.toBe(option.feedback);expect(read('reasoning',reset)).not.toBe(q.solution);
    }
   }
   expect(JSON.stringify(data)).toBe(before);
  }
 });

 it('rejects missing feedback and out-of-domain state through the existing portable contract',()=>{
  for(const q of questions){
   const {data}=model(q);
   for(const state of [{correct:0},{correct:6},{choice:-1},{choice:11}])
    expect(ExtensionDataSchema.safeParse({...data,state:{...data.state,...state}}).success).toBe(false);
   const state={...data.state};delete state.feedbackE;
   expect(ExtensionDataSchema.safeParse({...data,state}).success).toBe(false);
  }
 });
});
