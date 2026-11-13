import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseTrainingNumber,gradeTrainingAnswer} from './ardesia-exam-grading-proposal.ts';
const quarter={kind:'number',exact:'1/4'};
for(const value of ['1/4','2/8','0.25','0,2500','.25',',25','2.5e-1','25E-2','-1/-4','−1 / −4','0.5 / 2','+0,25'])assert.equal(gradeTrainingAnswer(quarter,value).kind,'correct',value);
for(const value of ['0.249999','0.250001','-0.25','4','250'])assert.equal(gradeTrainingAnswer(quarter,value).kind,'wrong',value);
for(const value of ['',' ','\n\t'])assert.deepEqual(gradeTrainingAnswer(quarter,value),{kind:'blank',pointsTenths:0});
for(const value of ['NaN','Infinity','1/0','0/0','1/-0','1/2/2','1e99','1e-13','1e','1e1.2','1 000','1.000,5','0,25 giri','0x10','1+3','1.','1,','--1','<script>','9'.repeat(25),'1'.repeat(97)]){
 const result=gradeTrainingAnswer(quarter,value);assert.equal(result.kind,'invalid',value);assert.equal(result.pointsTenths,-1,value);
}
assert.equal(gradeTrainingAnswer({kind:'number',exact:'0'},'-0').kind,'correct');
assert.equal(gradeTrainingAnswer({kind:'number',exact:'1e12'},'1000000000000').kind,'correct');
assert.equal(gradeTrainingAnswer({kind:'number',exact:'1e-12'},'0.000000000001').kind,'correct');
assert.throws(()=>gradeTrainingAnswer({kind:'number',exact:'bad'},'1'));
assert.throws(()=>gradeTrainingAnswer({kind:'number',exact:'bad'},''));
assert.equal(parseTrainingNumber(' '.repeat(100)).kind,'blank');
assert.throws(()=>gradeTrainingAnswer({kind:'choice',correctOptionId:'F',optionIds:['A','B']},'A'));
const candidates=JSON.parse(readFileSync('/tmp/ardesia-exam-candidate-selection-2026-11-13.json','utf8')).candidates;
let alternativeChecks=0,totalTenths=0;
for(const candidate of candidates){
 const key=candidate.type==='multiple_choice'?{kind:'choice',correctOptionId:candidate.structuredKey.correctOptionId,optionIds:candidate.options.map(x=>x.id)}:{kind:'number',exact:candidate.structuredKey.exact};
 const correct=key.kind==='choice'?key.correctOptionId:key.exact;
 assert.equal(gradeTrainingAnswer(key,correct).kind,'correct',candidate.id);totalTenths+=gradeTrainingAnswer(key,correct).pointsTenths;
 assert.deepEqual(gradeTrainingAnswer(key,''),{kind:'blank',pointsTenths:0});
 if(key.kind==='choice')for(const id of key.optionIds){assert.equal(gradeTrainingAnswer(key,id).pointsTenths,id===key.correctOptionId?10:-1);alternativeChecks++;}
 else for(const accepted of candidate.structuredKey.acceptedLegacyStrings)assert.equal(gradeTrainingAnswer(key,accepted).kind,'correct',candidate.id+': '+accepted);
}
assert.equal(totalTenths,310);assert.equal(alternativeChecks,105);
assert.equal([10,10,-1,-1,0].reduce((n,p)=>n+p,0),18);
console.log(JSON.stringify({status:'PROTOTYPE_ONLY_PASS',candidateKeys:31,alternativeChecks,maximumPointsTenths:totalTenths,arbitraryCodeExecuted:false,officialComparator:false,persistence:false}));
