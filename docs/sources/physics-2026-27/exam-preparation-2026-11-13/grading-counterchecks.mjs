import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseTrainingNumber,gradeTrainingAnswer} from './ardesia-exam-grading-proposal.ts';
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceHash=hash(new URL('./ardesia-exam-grading-proposal.ts',import.meta.url));
const results=[];
function check(name,fn){try{fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}}
const key=exact=>({kind:'number',exact});
const choice={kind:'choice',correctOptionId:'A',optionIds:['A','B','C','D','E']};
for(const [exact,value] of [
 ['1/4','0,25'],['1/4','.25'],['1/4','+25e-2'],['-1/2','1/-2'],['-1/2','−0,5'],
 ['1e-12','1e−12'],['1e12','1E+12'],['1','1.000'],['1','1,000'],['1','\u00a01\u00a0'],
 ['1/2',' 1 \n / \t 2 '],['0','-0e12'],['0','0/-1'],
 ['999999999999999999999999','999999999999999999999999'],
 ['999999999999999999999999e12','999999999999999999999999000000000000/1e12*1e12'],
 ['1','999999999999999999999999e12/999999999999999999999999e12'],
 ['1','999999999999999999999999e-12/999999999999999999999999e-12'],
 ['1e12','999999999999999999999999/999999999999999999999999e-12'],
]){
 if(value.includes('*'))continue; // Arithmetic expressions are tested separately as invalid.
 check('exact equivalence '+JSON.stringify(value),()=>assert.equal(gradeTrainingAnswer(key(exact),value).kind,'correct'));
}
for(const value of ['1/-0.000e12','1/+0e-12','1/−0','0/0','1//2','/2','2/','1/2/3',
 '1e13','1e-13','1e123456789','1e+','1e--1','1e1.0','1 e2','1\t0','1\u200b0',
 '1,2.3','1.2,3','1,2,3','1_000','0b10','0o10','0x10','Infinity','-Infinity','NaN',
 '１２','²','1×10^2','(1/2)','1+2','process.exit()','1;2','1\u00002',
 '1e2/Infinity','1e-13/1e-13','1.' ,'1,','+'.repeat(2)+'1','9'.repeat(25)]) {
 check('invalid '+JSON.stringify(value),()=>assert.deepEqual(gradeTrainingAnswer(key('1'),value).kind,'invalid'));
}
for(const value of ['', ' ', '\n\t', '\u00a0', ' '.repeat(100)]){
 check('blank '+JSON.stringify(value),()=>assert.deepEqual(gradeTrainingAnswer(key('1'),value),{kind:'blank',pointsTenths:0}));
}
check('96 normalized characters accepted',()=>assert.equal(gradeTrainingAnswer(key('1'),'1'+' '.repeat(46)+'/'+' '.repeat(47)+'1').kind,'correct'));
check('97 normalized characters rejected',()=>assert.equal(gradeTrainingAnswer(key('1'),'1'+' '.repeat(47)+'/'+' '.repeat(47)+'1').kind,'invalid'));
check('24 written integer digits accepted',()=>assert.equal(parseTrainingNumber('7'.repeat(24)).kind,'number'));
check('24 written fractional digits accepted without implicit leading zero',()=>assert.equal(parseTrainingNumber('.'+'7'.repeat(24)).kind,'number'));
check('25 written fractional digits rejected',()=>assert.equal(parseTrainingNumber('.'+'7'.repeat(25)).kind,'invalid'));
check('no floating rounding of close 24-digit integers',()=>assert.equal(gradeTrainingAnswer(key('999999999999999999999999'),'999999999999999999999998').kind,'wrong'));
check('ordinary wrong choice',()=>assert.deepEqual(gradeTrainingAnswer(choice,'B'),{kind:'wrong',pointsTenths:-1}));
check('choice unknown distinct invalid',()=>assert.equal(gradeTrainingAnswer(choice,'F').kind,'invalid'));
check('blank choice',()=>assert.deepEqual(gradeTrainingAnswer(choice,''),{kind:'blank',pointsTenths:0}));
for(const invalidKey of [
 {kind:'choice',correctOptionId:'F',optionIds:['A','B','C','D','E']},
 {kind:'choice',correctOptionId:'A',optionIds:['A','B','C','D','D']},
 {kind:'choice',correctOptionId:'',optionIds:['','B','C','D','E']},
 {kind:'choice',correctOptionId:' ',optionIds:[' ','B','C','D','E']},
 {kind:'choice',correctOptionId:'A',optionIds:['A',1,2,3,4]},
 {kind:'choice',correctOptionId:'A',optionIds:Object.assign(new Array(5),{0:'A',1:'B',2:'C',3:'D'})},
 {kind:'not-a-key',exact:'1'},
 {kind:'number',exact:''},{kind:'number',exact:'1/0'},{kind:'number',exact:'1e13'},
]) check('reject invalid key even blank '+JSON.stringify(invalidKey),()=>assert.throws(()=>gradeTrainingAnswer(invalidKey,'')));
let rationalPairs=0;
for(let n=-12;n<=12;n++)for(const d of [1,2,3,7,11])for(const multiplier of [2,3]){
 const original=`${n}/${d}`,equivalent=`${n*multiplier}/${d*multiplier}`,different=`${n*multiplier+1}/${d*multiplier}`;
 check('rational equivalence '+original+' = '+equivalent,()=>assert.equal(gradeTrainingAnswer(key(original),equivalent).kind,'correct'));
 check('rational difference '+original+' != '+different,()=>assert.equal(gradeTrainingAnswer(key(original),different).kind,'wrong'));
 rationalPairs++;
}
check('31 right answers total integer tenths',()=>assert.equal(Array.from({length:31},()=>gradeTrainingAnswer(choice,'A').pointsTenths).reduce((a,b)=>a+b,0),310));
check('31 wrong answers total integer tenths',()=>assert.equal(Array.from({length:31},()=>gradeTrainingAnswer(choice,'B').pointsTenths).reduce((a,b)=>a+b,0),-31));
check('mixed integer tenths',()=>assert.equal(16*gradeTrainingAnswer(choice,'A').pointsTenths+15*gradeTrainingAnswer(choice,'B').pointsTenths,145));
const report={sourceSha256:sourceHash,sourceUnchangedDuringChecks:sourceHash===hash(new URL('./ardesia-exam-grading-proposal.ts',import.meta.url)),
 testFileSha256:hash(new URL('./grading-counterchecks.mjs',import.meta.url)),caseCount:results.length,passed:results.filter(r=>r.passed).length,
 failed:results.filter(r=>!r.passed),rationalPairs,results,scope:'independent light runtime counterchecks; no official comparator, integration or human approval'};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,results:undefined}));

if(report.failed.length)process.exitCode=1;
