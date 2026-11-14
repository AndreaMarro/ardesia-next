const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const context={module:{exports:{}},TextEncoder};vm.runInNewContext(fs.readFileSync('apps/web/public/fisica/exam.js','utf8'),context);const engine=context.module.exports;
const sources=['a','b'].map(edition=>{const text=fs.readFileSync('docs/sources/physics-2026-27/editorial/exam-2026-'+edition+'.json');return{sourceSha256:crypto.createHash('sha256').update(text).digest('hex'),exam:JSON.parse(text)};});
const now=1800000000000,source=sources[0],exam=source.exam;
const snapshot=(mode='timed')=>engine.attempt(source,engine.createSession(exam,mode,now-100000));
const parse=(data,using=source,time=now)=>engine.parseAttempt(typeof data==='string'?data:JSON.stringify(data),using,time);
for(const src of sources)for(const mode of ['practice','timed'])test('fresh round trip '+src.exam.id+' '+mode,()=>{
 const session=engine.createSession(src.exam,mode,now-120000);session.index=24;
 for(const q of src.exam.questions)session.answers[q.id]=q.type==='choice'?'B':' -2,5e2 ';
 session.flagged.add(src.exam.questions[0].id);session.flagged.add(src.exam.questions[30].id);
 const stored=engine.attempt(src,session),restored=parse(stored,src);
 assert.ok(restored);assert.notEqual(restored,session);assert.equal(restored.index,24);assert.equal(restored.startedAt,session.startedAt);assert.equal(restored.deadline,session.deadline);assert.equal(restored.finished,false);assert.deepEqual(Array.from(restored.flagged),Array.from(session.flagged));assert.equal(Object.keys(restored.answers).length,31);
 for(const q of src.exam.questions)assert.equal(restored.answers[q.id],session.answers[q.id]);
 stored.answers[src.exam.questions[0].id]='E';stored.flagged.push(src.exam.questions[2].id);assert.equal(restored.answers[src.exam.questions[0].id],'B');assert.equal(restored.flagged.size,2);
});
const mutations={
 'missing version':d=>delete d.schemaVersion,'wrong version':d=>d.schemaVersion=2,'string version':d=>d.schemaVersion='1','result kind':d=>d.kind='ardesia-physics-practice-result','unknown field':d=>d.finished=false,
 'exam mismatch':d=>d.examId=sources[1].exam.id,'hash mismatch':d=>d.sourceSha256='0'.repeat(64),'hash type':d=>d.sourceSha256=1,'mode unknown':d=>d.mode='exam','mode type':d=>d.mode=['timed'],
 'future start':d=>{d.startedAt=now+1;d.deadline=d.startedAt+3000000},'negative start':d=>{d.startedAt=-1;d.deadline=2999999},'fraction start':d=>{d.startedAt=.5;d.deadline=3000000.5},'string start':d=>d.startedAt=String(d.startedAt),'null start':d=>d.startedAt=null,'unsafe start':d=>d.startedAt=Number.MAX_SAFE_INTEGER+1,
 'extended deadline':d=>d.deadline++,'shortened deadline':d=>d.deadline--,'null timed deadline':d=>d.deadline=null,'string deadline':d=>d.deadline=String(d.deadline),'practice deadline':d=>d.mode='practice',
 'index negative':d=>d.index=-1,'index 31':d=>d.index=31,'index fraction':d=>d.index=.5,'index string':d=>d.index='0','index null':d=>d.index=null,
 'answers null':d=>d.answers=null,'answers array':d=>d.answers=Object.values(d.answers),'answer missing':d=>delete d.answers[exam.questions[0].id],'answer extra':d=>d.answers.extra='A','answer id replacement':d=>{delete d.answers[exam.questions[0].id];d.answers.unknown='A'},
 'choice invalid':d=>d.answers[exam.questions[0].id]='F','choice lower-case':d=>d.answers[exam.questions[0].id]='a','choice spaces':d=>d.answers[exam.questions[0].id]=' A ','choice number':d=>d.answers[exam.questions[0].id]=1,
 'completion numeric type':d=>d.answers[exam.questions[21].id]=1,'completion nested':d=>d.answers[exam.questions[21].id]={value:'1'},'completion null':d=>d.answers[exam.questions[21].id]=null,'completion overlong':d=>d.answers[exam.questions[21].id]='a'.repeat(81),
 'flags null':d=>d.flagged=null,'flags object':d=>d.flagged={},'flags string':d=>d.flagged='a','flag unknown':d=>d.flagged=['unknown'],'flag numeric':d=>d.flagged=[1],'flag duplicates':d=>d.flagged=[exam.questions[0].id,exam.questions[0].id],'flag count':d=>d.flagged=Array(32).fill(exam.questions[0].id),
 'prototype top':d=>Object.defineProperty(d,'__proto__',{value:{polluted:true},enumerable:true}),'prototype answer':d=>Object.defineProperty(d.answers,'__proto__',{value:{polluted:true},enumerable:true})
};
for(const [label,mutate]of Object.entries(mutations))test('reject '+label,()=>{const d=JSON.parse(JSON.stringify(snapshot()));mutate(d);assert.equal(parse(d),null);assert.equal({}.polluted,undefined)});
for(const value of [null,[],{},'null','[]','42','true','"text"','', '{', '{"x":NaN}',new String('{}')])test('reject non-schema '+String(value),()=>assert.equal(parse(value),null));
test('edition A file cannot enter B',()=>assert.equal(parse(snapshot(),sources[1]),null));
test('expired import is immediately immutable, deadline preserved',()=>{
 const d=snapshot();const restored=parse(d,source,d.deadline);assert.ok(restored);assert.equal(restored.deadline,d.deadline);assert.equal(engine.expired(restored,d.deadline),true);assert.equal(engine.accept(restored,exam.questions[0],'A',d.deadline),false);assert.equal(engine.accept(restored,exam.questions[0],'A',d.deadline+1),false);assert.equal(restored.answers[exam.questions[0].id],'');
});
test('inclusive original deadline and subsecond remaining',()=>{const d=snapshot(),s=parse(d,source,d.deadline-1);assert.equal(engine.remaining(s,d.deadline-1),1);assert.equal(engine.accept(s,exam.questions[0],'A',d.deadline-1),true);assert.equal(engine.accept(s,exam.questions[0],'B',d.deadline),false)});
test('byte budget exact boundary and multibyte input',()=>{
 const text=JSON.stringify(snapshot());assert.ok(engine.parseAttempt(text+' '.repeat(65536-Buffer.byteLength(text)),source,now));assert.equal(engine.parseAttempt(text+' '.repeat(65537-Buffer.byteLength(text)),source,now),null);
 const d=snapshot();d.answers[exam.questions[21].id]='é'.repeat(80);const multi=JSON.stringify(d),padded=multi+' '.repeat(65536-multi.length);assert.ok(padded.length<=65536);assert.ok(Buffer.byteLength(padded)>65536);assert.equal(engine.parseAttempt(padded,source,now),null);
});
test('80-char completion is inert preserved content, not a trusted score',()=>{const d=snapshot();d.answers[exam.questions[21].id]='<script>globalThis.executed=1</script>';const restored=parse(d);assert.ok(restored);assert.equal(globalThis.executed,undefined);assert.equal(engine.grade(exam.questions[21],restored.answers[exam.questions[21].id]),'wrong');d.answers[exam.questions[21].id]='a'.repeat(80);assert.ok(parse(d))});
test('export canonicalizes exact question set and carries no grading',()=>{const s=engine.createSession(exam,'practice',now);s.answers.extra='A';const d=engine.attempt(source,s);assert.equal(Object.keys(d.answers).length,31);assert.equal(d.answers.extra,undefined);assert.equal(d.score,undefined);assert.equal(d.deadline,null)});
test('non-finite times cannot be encoded as an accepted start',()=>{const text=JSON.stringify(snapshot()).replace(String(now-100000),'1e309');assert.equal(parse(text),null)});
