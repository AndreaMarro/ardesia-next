const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('apps/web/public/fisica/exam.js','utf8'),context);
const engine = context.module.exports;
const exam = JSON.parse(fs.readFileSync('docs/sources/physics-2026-27/editorial/exam-2026-a.json','utf8'));

test('decimal normalization accepts equivalent locale formats, not units or expressions', () => {
  for (const text of ['  +02,500  ','2.5','02.50','25e-1']) assert.equal(engine.normalize(text),'2.5');
  for (const text of ['2x','2 m','2e','1e309','NaN','Infinity','1,2,3','2/3','<img src=x>','0x10','1 000']) assert.equal(engine.normalize(text),null);
  assert.equal(engine.normalize('  '),'');
  assert.equal(engine.normalize('−0'),'0');
});
test('all 31 correct answers produce 31, blanks produce zero, and wrong choices subtract tenths', () => {
  const correct = Object.fromEntries(exam.questions.map(q=>[q.id,q.type==='choice'?q.correctChoice:q.acceptedAnswers[0]]));
  const result = engine.summarize(exam,correct);
  assert.equal(result.correct,31);assert.equal(result.score,31);assert.equal(result.wrong,0);
  assert.equal(engine.summarize(exam,{}).score,0);assert.equal(engine.summarize(exam,{}).blank,31);
  const mixed={...correct}; mixed[exam.questions[0].id]=exam.questions[0].choices.find(c=>c.id!==exam.questions[0].correctChoice).id;
  mixed[exam.questions[1].id]='';
  const graded=engine.summarize(exam,mixed);
  assert.equal(graded.correct,29);assert.equal(graded.wrong,1);assert.equal(graded.blank,1);assert.equal(graded.score,28.9);
});
test('all wrong can score negative; invalid numeric content is wrong rather than blank or prefix parsed', () => {
  const answers=Object.fromEntries(exam.questions.map(q=>[q.id,q.type==='choice'?q.choices.find(c=>c.id!==q.correctChoice).id:'wrong']));
  assert.equal(engine.summarize(exam,answers).score,-3.1);
  const q=exam.questions.find(q=>q.type==='completion');
  assert.equal(engine.grade(q,q.acceptedAnswers[0]+'kPa'),'wrong');assert.equal(engine.grade(q,'  '),'blank');
  assert.equal(engine.grade(q,'4e1'),'correct');assert.equal(engine.grade(q,'40.00000001'),'correct');assert.equal(engine.grade(q,'40.0001'),'wrong');
});
test('deadline is inclusive, wall-clock based, and blocks stale input independent of UI ticking', () => {
  const session=engine.createSession(exam,'timed',1000),q=exam.questions[0];
  assert.equal(session.deadline,3_001_000);assert.equal(engine.remaining(session,1000),3000);
  assert.equal(engine.accept(session,q,'A',session.deadline-1),true);
  assert.equal(engine.accept(session,q,'B',session.deadline),false);
  assert.equal(session.answers[q.id],'A');assert.equal(engine.expired(session,session.deadline),true);
  assert.equal(engine.remaining(session,session.deadline+500_000),0);
});
test('practice does not expire, answers can change or clear, and finished sessions reject mutation', () => {
  const session=engine.createSession(exam,'practice',1000),q=exam.questions[0];
  assert.equal(engine.expired(session,1000+999_999_999),false);assert.equal(engine.remaining(session,0),null);
  assert.equal(engine.accept(session,q,'A',2000),true);assert.equal(engine.accept(session,q,'E',3000),true);
  assert.equal(engine.accept(session,q,'',4000),true);assert.equal(engine.grade(q,session.answers[q.id]),'blank');
  assert.equal(engine.accept(session,q,'Z',4000),false);
  session.finished=true;assert.equal(engine.accept(session,q,'A',5000),false);
});
test('new sessions cannot share mutable answer or flag state', () => {
  const a=engine.createSession(exam,'practice',1),b=engine.createSession(exam,'practice',2);
  a.answers.x='A';a.flagged.add('x');assert.equal(Object.keys(b.answers).length,0);assert.equal(b.flagged.size,0);
  assert.throws(()=>engine.createSession(exam,'other',1));
});
test('inert data parsing preserves hostile text and rejects malformed schema before startup', () => {
  const data={sourceFile:'editorial.json',sourceSha256:'a'.repeat(64),exam:JSON.parse(JSON.stringify(exam))};
  const text='</script><script>globalThis.injection=1</script><img src=x onerror=alert(1)> & >';
  data.exam.questions[0].prompt=text;
  assert.equal(engine.parseData(JSON.stringify(data)).exam.questions[0].prompt,text);
  assert.equal(engine.parseData('{broken'),null);
  data.exam.questions[0].correctChoice='Z';assert.equal(engine.parseData(JSON.stringify(data)),null);
  data.exam.questions[0].correctChoice='A';data.exam.questions[1].id=data.exam.questions[0].id;
  assert.equal(engine.parseData(JSON.stringify(data)),null);
});
