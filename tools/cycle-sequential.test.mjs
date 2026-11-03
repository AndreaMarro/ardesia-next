import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import * as cycle from './cycle.mjs';
const T = '2026-11-01T10:00:00.000Z';
const at = minutes => new Date(Date.parse(T) + minutes * 60000);
const ref = 'a'.repeat(40), hash = 'b'.repeat(64);
const fixture = (serial = true) => ({
  schemaVersion: serial ? '2.0.0' : '1.0.0', kind: serial ? 'ardesia-sequential-state' : 'ardesia-dual-run-state',
  repository: 'AndreaMarro/ardesia-next', acceptanceEvidence: false, revision: 3, updatedAt: T,
  procedureRef: ref, activeRun: null, lastRun: null,
  packet: {id: 'bootstrap', taskId: 'OPS-003', nextActor: serial ? 'codex' : 'pro', disposition: 'READY', kind: 'coordination',
    notBefore: T, expiresAt: null, source: {baseSha: ref, headSha: ref, branch: 'setup/sequential', pr: null, sourceDigest: hash},
    goal: 'Prepare one bounded increment', allowedPaths: [], exitCriteria: ['Consumer and evidence'], evidence: [], blockers: [], nextAction: 'Select eligible work',
    ...(serial ? {review: null} : {})}
});
const claim = data => cycle.claimCycle(data, {expectedRevision: data.revision, actor: 'codex', runId: 'run-1', startedAt: T}, {now: at(8)});
const evidence = (kind, result = 'PASS') => ({kind, name: kind === 'ci' ? 'verify' : 'review', reference: 'https://github.com/AndreaMarro/ardesia-next/pull/20', headSha: ref, sourceDigest: hash, result, scope: 'Synthetic scope', access: 'metadata', artifactDigest: null});
const implementation = () => ({...fixture().packet, id: 'impl-1', taskId: 'TASK-1', kind: 'implementation', expiresAt: at(180).toISOString(), allowedPaths: ['tools'], review: null});
const task = (id = 'TASK-1', scope = ['tools']) => ({id, title:'Bounded synthetic consumer', status:'queued', priority:1, owner:'coordinator',
 scope, dependsOn:[], blockers:[], exitCriteria:['Consumer and evidence'], evidence:[], nextAction:'Implement the bounded task'});
const blocker = (id='B') => ({id,status:'blocked',reason:'Missing prerequisite',lastCheckedAt:T,recheckWhen:'Prerequisite changes',sources:['docs/history.md']});
const queue = () => ({...JSON.parse(readFileSync(new URL('../operations/coordination.json', import.meta.url), 'utf8')),
 policy:{maxActiveIncrements:1,maxRemoteWriters:1,productionAuthorized:false,newSpendAuthorized:false,
  agentLaunchedCodexJobsAuthorized:false,ownerScheduledCodexAllowed:true,mainFrozen:true,stagingFrozen:true},
 updatedAt:T, tasks:[task()], blockers:[], claims:[]});
const select = (data, packet, q = queue()) => cycle.assignCycle(data, {expectedRevision: data.revision, actor: 'codex', runId: 'run-1', packet, queue: q}, {now: at(9),readQueue:()=>q});
const finish = (data, packet, outcome, q = queue()) => cycle.finishCycle(data, {expectedRevision: data.revision, actor: 'codex', runId: 'run-1', packet, outcome, queue:q, summary: 'Synthetic test result'}, {now: at(50),readQueue:()=>q});

test('post-M3 selection reads baseline at the immutable procedure ref, never a local substitute', () => {
 const q=JSON.parse(readFileSync(new URL('../operations/coordination.json',import.meta.url),'utf8'));
 const canonical=q.tasks.find(t=>t.id==='OPS-004');
 const p={...implementation(),taskId:canonical.id,allowedPaths:canonical.scope,exitCriteria:canonical.exitCriteria};
 const s=fixture();s.procedureRef=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const a=claim(s), input={expectedRevision:a.revision,actor:'codex',runId:'run-1',packet:p,queue:q};
 assert.equal(cycle.assignCycle(a,input,{now:at(9),readQueue:()=>q}).packet.taskId,'OPS-004');
 const missing=structuredClone(a);missing.procedureRef='f'.repeat(40);
 assert.throws(()=>cycle.assignCycle(missing,input,{now:at(9),readQueue:()=>q}),/policy/);
});

test('v1 historical coordination remains valid', () => assert.deepEqual(cycle.validateCycle(fixture(false)), []));
test('v2 accepts Codex coordinator without a Pro worker', () => assert.deepEqual(cycle.validateCycle(fixture()), []));
test('v2 rejects a Pro successor and active owner', () => {
 const s = fixture(); s.packet.nextActor = 'pro'; assert.ok(cycle.validateCycle(s).length);
 const a = claim(fixture()); a.activeRun.actor = 'pro'; assert.ok(cycle.validateCycle(a).length);
});
test('Codex claim charges bootstrap time and does not mutate input', () => {
 const s = fixture(), before = structuredClone(s), a = claim(s);
 assert.equal(a.activeRun.writeUntil, at(45).toISOString()); assert.equal(a.activeRun.closeBy, at(55).toISOString()); assert.deepEqual(s,before);
});

test('read-only bootstrap may overlap a prior run, but the next claim cannot overlap its release or reset the budget', () => {
 const prior=claim(fixture());
 const closed=cycle.finishCycle(prior,{expectedRevision:prior.revision,actor:'codex',runId:'run-1',outcome:'INTERRUPTED',
  packet:{...prior.packet,disposition:'INTERRUPTED'},summary:'Previous writer has stopped'},{now:at(20)});
 const next=cycle.claimCycle(closed,{expectedRevision:closed.revision,actor:'codex',runId:'run-2',startedAt:at(10).toISOString()},{now:at(25)});
 assert.equal(next.activeRun.startedAt,at(10).toISOString());assert.equal(next.activeRun.claimedAt,at(25).toISOString());
 assert.equal(next.activeRun.writeUntil,at(55).toISOString());assert.equal(next.activeRun.closeBy,at(65).toISOString());
 assert.deepEqual(cycle.validateCycle(next),[]);
 const overlap=structuredClone(next);overlap.activeRun.claimedAt=at(19).toISOString();
 assert.ok(cycle.validateCycle(overlap).some(error=>error.includes('lastRun completion')));
 assert.throws(()=>cycle.claimCycle(prior,{expectedRevision:prior.revision,actor:'codex',runId:'run-2',startedAt:at(10).toISOString()},{now:at(25)}),/active claim/);
});
test('stale expected revision and expired active claim cannot be taken over', () => {
 const a = claim(fixture());
 assert.throws(() => cycle.claimCycle(a,{expectedRevision:a.revision,actor:'codex',runId:'run-2',startedAt:at(100).toISOString()},{now:at(100)}), /active claim/);
 assert.throws(() => cycle.claimCycle(fixture(),{expectedRevision:0,actor:'codex',runId:'run-1',startedAt:T},{now:at(1)}), /revision/);
});

const recoveryFixture = () => {
 const q=queue(), active=select(claim(fixture()),implementation(),q);
 const terminal={kind:'ardesia-native-terminal-recovery',runId:'run-1',threadId:'native-thread-1',status:'failed',
  completedAt:at(30).toISOString(),observedAt:at(70).toISOString(),writersStopped:true,
  preservationDigest:'c'.repeat(64),reference:'private-preserved-work-manifest'};
 const input={expectedRevision:active.revision,actor:'codex',runId:'run-1',terminal,packet:{...active.packet,nextAction:'Resume preserved browser diagnosis'},queue:q,summary:'Coordinator reconstructed the failed native turn checkpoint after observing stopped writers'};
 return {q,active,input,adapters:{now:at(70),readQueue:()=>q}};
};
test('explicit terminal recovery preserves source/evidence/deadlines and does not renew the failed run', () => {
 const {active,input,adapters}=recoveryFixture(),before=structuredClone(active);
 active.packet.evidence=[evidence('check','FAIL')];input.packet.evidence=structuredClone(active.packet.evidence);
 const snapshot=structuredClone(active),result=cycle.recoverCycle(active,input,adapters);
 assert.equal(result.activeRun,null);assert.equal(result.lastRun.runId,'run-1');assert.equal(result.lastRun.late,true);
 for(const key of ['startedAt','claimedAt','writeUntil','closeBy'])assert.equal(result.lastRun[key],active.activeRun[key]);
 assert.deepEqual(result.packet.source,active.packet.source);assert.deepEqual(result.packet.evidence,active.packet.evidence);
 assert.equal(result.packet.disposition,'READY');assert.deepEqual(active,snapshot);assert.equal(result.revision,before.revision+1);
 const claimed=cycle.claimCycle(result,{expectedRevision:result.revision,actor:'codex',runId:'new-run',startedAt:at(65).toISOString()},{now:at(71)});
 assert.equal(claimed.activeRun.closeBy,at(120).toISOString());
});
test('expiry, native status alone, live writers and incomplete preservation cannot recover a claim', () => {
 const {active,input,adapters}=recoveryFixture();
 for(const delta of [null, {status:'running'},{status:'completed'},{runId:'another-run'},{threadId:''},
  {writersStopped:false},{writersStopped:undefined},{preservationDigest:null},{reference:''},
  {completedAt:at(7).toISOString()},{observedAt:at(29).toISOString()},{observedAt:at(71).toISOString()}]) {
  const terminal=delta===null?null:{...input.terminal,...delta};
  assert.throws(()=>cycle.recoverCycle(active,{...input,terminal},adapters),/observed matching terminal/);
 }
 assert.throws(()=>cycle.recoverCycle(active,{...input,expectedRevision:0},adapters),/revision/);
 assert.throws(()=>cycle.recoverCycle(active,{...input,runId:'another-run'},adapters),/active owner/);
});
test('recovery cannot change the preserved assignment or hide a failure or pending CI', () => {
 const {active,input,adapters}=recoveryFixture();
 for(const mutate of [p=>p.source.headSha='f'.repeat(40),p=>p.evidence=[evidence('ci')],p=>p.allowedPaths.push('apps'),p=>p.exitCriteria=['Weaker'],p=>p.taskId='OTHER']) {
  const packet=structuredClone(input.packet);mutate(packet);
  assert.throws(()=>cycle.recoverCycle(active,{...input,packet},adapters),/preserve the complete/);
 }
 const pending=structuredClone(active);pending.packet.disposition='WAITING_CI';pending.packet.evidence=[evidence('ci','PENDING')];
 assert.throws(()=>cycle.recoverCycle(pending,input,adapters),/pending CI/);
 const noncanonical=structuredClone(input.queue);noncanonical.tasks[0].scope.push('apps');
 assert.throws(()=>cycle.recoverCycle(active,{...input,queue:noncanonical},adapters),/hypothetical/);
});
test('migrate is explicit, inactive-only and preserves old evidence', () => {
 assert.equal(typeof cycle.migrateCycle, 'function');
 const old = fixture(false); old.packet.disposition='BLOCKED'; old.packet.blockers=['B-OLD-AUTOMATION'];
 const m = cycle.migrateCycle(old,{expectedRevision:3,procedureRef:ref,packet:fixture().packet},{now:at(1)});
 assert.equal(m.schemaVersion,'2.0.0'); assert.equal(m.packet.nextActor,'codex'); assert.equal(m.revision,4); assert.equal(old.schemaVersion,'1.0.0');
 const active = cycle.claimCycle(old,{expectedRevision:3,actor:'pro',runId:'old-run',startedAt:T},{now:at(1)});
 assert.throws(()=>cycle.migrateCycle(active,{expectedRevision:4,procedureRef:ref,packet:fixture().packet},{now:at(2)}),/active/);
});
test('same run may select one canonical implementation without resetting budget', () => {
 const a=claim(fixture()), b=select(a,implementation());
 assert.equal(b.packet.taskId,'TASK-1'); assert.deepEqual(b.activeRun,a.activeRun); assert.equal(b.revision,a.revision+1);
 assert.throws(()=>select(b,{...implementation(),id:'another'}),/assignment|coordination/);
});
test('selection rejects missing task, unmet dependency, blockers, overlapping claim and out-of-scope path', () => {
 for (const mutate of [q=>q.tasks=[],q=>q.tasks[0].dependsOn=['missing'],q=>{q.tasks[0].blockers=['blocked'];q.blockers=[{id:'blocked',status:'blocked'}];},q=>q.claims=[{taskId:'TASK-1',paths:['tools/a']}],q=>q.tasks[0].scope=['docs']]) {
  const q=queue(); mutate(q); assert.throws(()=>select(claim(fixture()),implementation(),q));
 }
});
test('review can examine ready work despite a merge-only freeze, without granting writes', () => {
 const q=queue(); q.tasks[0].status='ready_for_review';q.tasks[0].evidence=['https://example.test/original']; q.tasks[0].blockers=['B-FREEZE'];q.blockers=[blocker('B-FREEZE')];
 const p={...implementation(),kind:'review',allowedPaths:[]};
 assert.deepEqual(select(claim(fixture()),p,q).packet.allowedPaths,[]);
});
test('implementation cannot target protected branch or traversal', () => {
 for(const p of [{...implementation(),source:{...implementation().source,branch:'main'}},{...implementation(),allowedPaths:['../tools']}]) assert.throws(()=>select(claim(fixture()),p));
});
test('sequential WAITING_CI stays with Codex and keeps original pending run', () => {
 const a=select(claim(fixture()),implementation());
 const p={...a.packet, disposition:'WAITING_CI', evidence:[evidence('ci','PENDING')]};
 const done=finish(a,p,'WAITING_CI'); assert.equal(done.packet.nextActor,'codex');assert.equal(done.activeRun,null);assert.equal(done.packet.evidence[0].result,'PENDING');
});
test('Codex may hand off to its next scheduled cycle without self-accepting', () => {
 const a=claim(fixture()), p=implementation(); const done=finish(a,p,'HANDOFF');
 assert.equal(done.packet.nextActor,'codex');assert.equal(done.packet.disposition,'READY');assert.equal(done.lastRun.packetId,'bootstrap');
});
test('completion requires exact CI, distinct review contexts and a matching review reference', () => {
 const a=select(claim(fixture()),{...implementation(),kind:'review',allowedPaths:[]});
 const p={...a.packet,disposition:'COMPLETE_INCREMENT',evidence:[evidence('ci'),evidence('review')],review:{authorContextId:'author',reviewerContextId:'reviewer',sourceSha:ref,reference:evidence('review').reference}};
 assert.equal(finish(a,p,'COMPLETE_INCREMENT').packet.disposition,'COMPLETE_INCREMENT');
 for(const patch of [{review:null},{review:{...p.review,reviewerContextId:'author'}},{review:{...p.review,sourceSha:'c'.repeat(40)}},{evidence:[evidence('review')]},{review:{...p.review,reference:'https://example.org/unrelated'}}]) assert.throws(()=>finish(a,{...p,...patch},'COMPLETE_INCREMENT'));
});
test('review identity is immutable and old FAIL cannot be promoted to complete', () => {
 const a=select(claim(fixture()),{...implementation(),kind:'review',allowedPaths:[]});
 assert.throws(()=>finish(a,{...a.packet,disposition:'BLOCKED',blockers:['B-REVIEW'],source:{...a.packet.source,headSha:'c'.repeat(40)}},'BLOCKED'),/identity/);
 const p={...a.packet,disposition:'READY_FOR_REVIEW',evidence:[evidence('ci'),evidence('check','FAIL')]};assert.throws(()=>finish(a,p,'READY_FOR_REVIEW'),/unresolved/);
});
test('expired packet supports reconciliation only, not product budget', () => {
 const s=fixture();s.packet=implementation();s.packet.expiresAt=at(1).toISOString();
 const a=cycle.claimCycle(s,{expectedRevision:3,actor:'codex',runId:'late',startedAt:at(2).toISOString()},{now:at(3)});
 assert.equal(cycle.cycleBrief(a,{now:at(3)}).activeRun.reconciliationOnly,true);
 assert.throws(()=>cycle.cycleBudget(a,{actor:'codex',runId:'late',seconds:60},{now:at(4)}),/Expired/);
});
test('source scope and gates are not granted by a valid cursor', () => {
 const s=fixture();s.acceptanceEvidence=true;assert.ok(cycle.validateCycle(s).length);
 const a=claim(fixture());assert.throws(()=>cycle.cycleBudget(a,{actor:'codex',runId:'run-1',seconds:301},{now:at(40)}),/fit/);
});

test('one active increment forbids starting an unrelated implementation even with disjoint paths', () => {
 const q=queue(); q.tasks.push({...task('OTHER',['docs']),status:'in_progress'});
 q.claims=[{taskId:'OTHER',owner:'coordinator',baseSha:ref,branch:'ops/other',paths:['docs'],claimedAt:T,expiresAt:at(180).toISOString()}];
 assert.throws(()=>select(claim(fixture()),implementation(),q), /active increment/);
});
test('malformed queue ownership cannot be silently ignored', () => {
 for(const bad of [null,{}, {taskId:'OTHER',paths:null},{taskId:'OTHER',paths:['../escape']}, {taskId:'OTHER',paths:[]}]) {
  const q=queue(); q.claims=[bad]; assert.throws(()=>select(claim(fixture()),implementation(),q), /claim/);
 }
});
test('duplicate canonical task and blocker identities are refused before selection', () => {
 const q=queue();q.tasks.push({...q.tasks[0]});assert.throws(()=>select(claim(fixture()),implementation(),q));
 const b=queue(); b.tasks[0].blockers=['B'];b.blockers=[{id:'B',status:'resolved'},{id:'B',status:'blocked'}];
 assert.throws(()=>select(claim(fixture()),implementation(),b), /blocker/);
});
test('an implementation cannot hand off unfinished work as a new ready assignment', () => {
 const a=select(claim(fixture()),implementation());
 assert.throws(()=>finish(a,{...implementation(),id:'next'},'HANDOFF'), /Resolve or preserve/);
});
test('CLI v2 migration and assignment use existing files and never perform writes', () => {
 const now=new Date(Date.now()-60_000).toISOString();
 const old=fixture(false); old.updatedAt=now;old.packet.notBefore=now;
 const p={...fixture().packet,notBefore:now};
 const input={old:JSON.stringify(old), packet:JSON.stringify(p)};
 const migrated=cycle.runCycleCli(['migrate','old','--revision','3','--procedure-ref',ref,'--packet','packet'],{readText:path=>input[path]});
 assert.equal(migrated.exitCode,0,migrated.stderr); const state=JSON.parse(migrated.stdout);
 assert.equal(state.schemaVersion,'2.0.0');assert.equal(state.activeRun,null);
 const args=['claim','state','--revision','4','--actor','codex','--run','cli-1','--started-at',new Date().toISOString()];
 input.state=JSON.stringify(state); const claimed=cycle.runCycleCli(args,{readText:path=>input[path]});
 assert.equal(claimed.exitCode,0,claimed.stderr);
 input.claimed=claimed.stdout;input.queue=JSON.stringify(queue());input.work=JSON.stringify({...implementation(),notBefore:now,expiresAt:new Date(Date.now()+3_600_000).toISOString()});
 const assigned=cycle.runCycleCli(['assign','claimed','--revision','5','--actor','codex','--run','cli-1','--packet','work','--queue','queue'],{readText:path=>input[path],readQueue:()=>queue()});
 assert.equal(assigned.exitCode,0,assigned.stderr);assert.equal(JSON.parse(assigned.stdout).packet.taskId,'TASK-1');
 assert.equal(JSON.parse(input.old).schemaVersion,'1.0.0');
});

test('a later cycle can select work from a completed packet without spending a scheduling-only slot', () => {
 const s=fixture();s.packet={...implementation(),kind:'review',allowedPaths:[],disposition:'COMPLETE_INCREMENT',evidence:[evidence('ci'),evidence('review')],review:{authorContextId:'author',reviewerContextId:'reviewer',sourceSha:ref,reference:evidence('review').reference}};
 const a=claim(s), b=select(a,implementation());
 assert.equal(b.packet.kind,'implementation');assert.deepEqual(a.activeRun,b.activeRun);
});

// Version migration must update the whole schema, not only its version string.
test('partial v1-to-v2 relabelling is rejected and unknown future versions stay unsupported', () => {
 const hybrid=fixture(false);hybrid.schemaVersion='2.0.0';
 const errors=cycle.validateCycle(hybrid);
 assert.ok(errors.some(error=>error.startsWith('kind:')));
 assert.ok(errors.some(error=>error.includes('packet.review')));
 const future=fixture();future.schemaVersion='999.0.0';
 assert.ok(cycle.validateCycle(future).some(error=>error.startsWith('schemaVersion:')));
 assert.deepEqual(cycle.validateCycle(fixture()),[]);
});

for (const outcome of ['WAITING_CI', 'BLOCKED', 'INTERRUPTED']) {
 test(`v2 ${outcome} closes the current assignment near its deadline without extending it`, () => {
  const packet={...implementation(),expiresAt:at(55).toISOString()};
  const active=select(claim(fixture()),packet);
  const next={...active.packet,disposition:outcome,
   evidence:outcome==='WAITING_CI' ? [evidence('ci','PENDING')] : [],
   blockers:outcome==='BLOCKED' ? ['B-OBSERVED'] : []};
  const done=finish(active,next,outcome);
  assert.equal(done.activeRun,null);assert.equal(done.packet.expiresAt,packet.expiresAt);
  assert.equal(done.lastRun.late,false);assert.deepEqual(done.packet.evidence,next.evidence);
 });
}
test('v2 new HANDOFF still requires a useful successor window', () => {
 const active=claim(fixture()),packet={...implementation(),expiresAt:at(55).toISOString()};
 assert.throws(()=>finish(active,packet,'HANDOFF'),/window/);
});

test('v2 late closure records the overrun without extending an expired assignment', () => {
 const active=select(claim(fixture()),{...implementation(),expiresAt:at(55).toISOString()});
 const packet={...active.packet,disposition:'INTERRUPTED'};
 const done=cycle.finishCycle(active,{expectedRevision:active.revision,actor:'codex',runId:'run-1',packet,
  outcome:'INTERRUPTED',summary:'Observed late closure'}, {now:at(56)});
 assert.equal(done.activeRun,null);assert.equal(done.lastRun.late,true);
 assert.equal(done.packet.expiresAt,active.packet.expiresAt);
});

// OPS-005: these must fail through HANDOFF too, rather than only through assign.
for (const [name,mutate] of [
 ['missing task',q=>q.tasks=[]], ['scope escape',q=>q.tasks[0].scope=['docs']],
 ['incomplete dependency',q=>{q.tasks.push(task('PREREQUISITE'));q.tasks[0].dependsOn=['PREREQUISITE'];}],
 ['unresolved blocker',q=>{q.tasks[0].blockers=['B'];q.blockers=[blocker()];}],
 ['competing claim',q=>{q.tasks[0].status='in_progress';q.claims=[{taskId:'TASK-1',owner:'coordinator',baseSha:ref,
  branch:'ops/other',paths:['tools/a'],claimedAt:T,expiresAt:at(180).toISOString()}];}]
]) {
 test(`HANDOFF refuses ${name} in an otherwise valid canonical queue`, () => {
  const q=queue();mutate(q);const a=claim(fixture());
  assert.throws(()=>cycle.finishCycle(a,{expectedRevision:a.revision,actor:'codex',runId:'run-1',
   packet:implementation(),outcome:'HANDOFF',summary:'Adversarial successor',queue:q},{now:at(10),readQueue:()=>q}));
 });
}

test('COMPLETE_INCREMENT may retain the exact existing claim for canonical closure', () => {
 const a=select(claim(fixture()),implementation());
 const p={...a.packet,disposition:'COMPLETE_INCREMENT',evidence:[evidence('ci'),evidence('review')],
  review:{authorContextId:'author',reviewerContextId:'reviewer',sourceSha:ref,reference:evidence('review').reference}};
 const b=cycle.finishCycle(a,{expectedRevision:a.revision,actor:'codex',runId:'run-1',packet:p,
  outcome:'COMPLETE_INCREMENT',summary:'Verified source, retain closure budget',retainClaim:true},{now:at(20)});
 assert.deepEqual(b.activeRun,a.activeRun);assert.deepEqual(b.lastRun,a.lastRun);
 assert.equal(b.packet.disposition,'COMPLETE_INCREMENT');assert.equal(b.revision,a.revision+1);
});

test('selection and HANDOFF reject hypothetical queues and changed mandate policy', () => {
 const canonical=queue(), hypothetical=queue();hypothetical.tasks.push(task('INVENTED'));
 const active=claim(fixture()), input={expectedRevision:active.revision,actor:'codex',runId:'run-1',queue:hypothetical,
  packet:implementation(),outcome:'HANDOFF',summary:'Untrusted local queue'};
 assert.throws(()=>cycle.assignCycle(active,input,{now:at(10),readQueue:()=>canonical}),/hypothetical/);
 assert.throws(()=>cycle.finishCycle(active,input,{now:at(10),readQueue:()=>canonical}),/hypothetical/);
 for(const key of ['mainFrozen','stagingFrozen','productionAuthorized','newSpendAuthorized']) {
  const q=queue();q.policy[key]=!q.policy[key];
  assert.throws(()=>cycle.assignCycle(active,{...input,queue:q},{now:at(10),readQueue:()=>q}),/policy/);
 }
});

test('retained completion still rejects author review, mismatched SHA, expiry and unsupported outcomes', () => {
 const active=select(claim(fixture()),implementation());
 const packet={...active.packet,disposition:'COMPLETE_INCREMENT',evidence:[evidence('ci'),evidence('review')],
  review:{authorContextId:'author',reviewerContextId:'reviewer',sourceSha:ref,reference:evidence('review').reference}};
 const input={expectedRevision:active.revision,actor:'codex',runId:'run-1',packet,outcome:'COMPLETE_INCREMENT',summary:'Retained completion',retainClaim:true};
 for(const p of [{...packet,review:{...packet.review,reviewerContextId:'author'}},
  {...packet,evidence:[{...evidence('ci'),headSha:'c'.repeat(40)},evidence('review')]}]) {
  assert.throws(()=>cycle.finishCycle(active,{...input,packet:p},{now:at(20)}));
 }
 assert.throws(()=>cycle.finishCycle(active,input,{now:at(45)}),/writeUntil/);
 assert.throws(()=>cycle.finishCycle(active,{...input,outcome:'INTERRUPTED',packet:{...active.packet,disposition:'INTERRUPTED'}},{now:at(20)}),/Retaining/);
 assert.throws(()=>cycle.finishCycle(active,{...input,retainClaim:'true'},{now:at(20)}),/Retaining/);
});

const complete = (active, head, minute, adapters={}) => {
 const proof = kind => ({...evidence(kind),headSha:head,reference:`https://example.test/${head}/${kind}`});
 const packet={...active.packet,kind:'coordination',allowedPaths:[],disposition:'COMPLETE_INCREMENT',source:{...active.packet.source,headSha:head},
  evidence:[proof('ci'),proof('review')],review:{authorContextId:'author',reviewerContextId:'reviewer',sourceSha:head,reference:proof('review').reference}};
 return cycle.finishCycle(active,{expectedRevision:active.revision,actor:'codex',runId:'run-1',packet,outcome:'COMPLETE_INCREMENT',
  summary:'Synthetic exact-source completion',retainClaim:true},{now:at(minute),...adapters});
};
const closureFixture = () => {
 const q=queue();q.tasks.push(task('OPS-004',['operations/coordination.json','docs/history.md']),{...task('TASK-2'),dependsOn:['TASK-1']});
 const work=select(claim(fixture()),implementation(),q), done=complete(work,ref,11);
 const admin={...implementation(),id:'close-1',taskId:'OPS-004',allowedPaths:['operations/coordination.json','docs/history.md'],
  source:{...implementation().source,branch:'ops/reconcile'}};
 const active=cycle.assignCycle(done,{expectedRevision:done.revision,actor:'codex',runId:'run-1',packet:admin,queue:q},{now:at(12),readQueue:()=>q});
 return {q,done,admin,active};
};
const reconcileInput = s => ({expectedRevision:s.active.revision,actor:'codex',runId:'run-1',queue:s.q,completionRef:'1'.repeat(40),nextAction:'Prepared source complete; integration still frozen'});

test('canonical reconciliation emits only the completed row, evidence, next action and timestamp', () => {
 const s=closureFixture(),before=structuredClone(s);
 const q=cycle.reconcileCycle(s.active,reconcileInput(s),{now:at(13),readQueue:()=>s.q,readCompletion:()=>s.done});
 const expected=structuredClone(s.q);expected.updatedAt=s.done.updatedAt;
 Object.assign(expected.tasks[0],{status:'done',evidence:[`https://github.com/AndreaMarro/ardesia-next/blob/${reconcileInput(s).completionRef}/handoff.json`,...s.done.packet.evidence.map(item=>item.reference)],nextAction:reconcileInput(s).nextAction});
 assert.deepEqual(q,expected);assert.deepEqual(s,before);assert.equal(q.tasks.find(t=>t.id==='OPS-004').status,'queued');
});

test('reconciliation rejects wrong owner, scope, completion lineage, reviewer, policy and task claims', () => {
 const s=closureFixture(), input=reconcileInput(s), adapters={now:at(13),readQueue:()=>s.q,readCompletion:()=>s.done};
 assert.throws(()=>cycle.reconcileCycle(s.active,{...input,actor:'pro'},adapters),/owner/);
 assert.throws(()=>cycle.reconcileCycle({...s.active,packet:{...s.active.packet,taskId:'TASK-2'}},input,adapters),/OPS-004/);
 assert.throws(()=>cycle.reconcileCycle({...s.active,packet:{...s.active.packet,allowedPaths:['operations/coordination.json']}},input,adapters),/scope/);
 assert.throws(()=>cycle.reconcileCycle(s.active,input,{...adapters,now:at(45)}),/budget/);
 for(const mutate of [s=>s.revision=100,s=>s.activeRun.runId='other',s=>s.packet.review.reviewerContextId='author',
  s=>s.packet.evidence[0].headSha='c'.repeat(40),s=>s.packet.taskId='MISSING']) {
  const bad=structuredClone(s.done);mutate(bad);
  assert.throws(()=>cycle.reconcileCycle(s.active,input,{...adapters,readCompletion:()=>bad}));
 }
 const foreign=queue();foreign.policy.mainFrozen=false;
 assert.throws(()=>cycle.reconcileCycle(s.active,{...input,queue:foreign},{...adapters,readQueue:()=>foreign}),/policy/);
 const changed=structuredClone(s.q);changed.tasks[0].nextAction='Unreviewed queue change';
 const done={...s.done,packet:{...s.done.packet,source:{...s.done.packet.source,headSha:'c'.repeat(40)},
  evidence:s.done.packet.evidence.map(e=>({...e,headSha:'c'.repeat(40)})),review:{...s.done.packet.review,sourceSha:'c'.repeat(40)}}};
 const separate=cycle.reconcileCycle(s.active,input,{...adapters,readCompletion:()=>done,
  readQueue:head=>{assert.equal(head,ref,'runtime queue must not grant task authority');return s.q;}});
 assert.equal(separate.tasks[0].status,'done');
 const claimed=structuredClone(s.q);claimed.tasks[0].status='in_progress';claimed.claims=[{taskId:'TASK-1',owner:'coordinator',baseSha:ref,
  branch:'ops/claimed',paths:['tools'],claimedAt:T,expiresAt:at(180).toISOString()}];
 assert.throws(()=>cycle.reconcileCycle(s.active,{...input,queue:claimed},{...adapters,readQueue:()=>claimed}),/active increment|task claim/);
});

test('two consecutive increments reconcile and select successors inside one unchanged budget', () => {
 let s=closureFixture(), state=s.active, q=s.q, completed=s.done;
 const original=structuredClone(state.activeRun), refs=new Map([[ref,q]]);
 for(let index=1;index<=2;index++) {
  const minute=10+index*6;
  q=cycle.reconcileCycle(state,{...reconcileInput(s),expectedRevision:state.revision,queue:q},
   {now:at(minute),readQueue:head=>refs.get(head),readCompletion:()=>completed});
  const head=String(index+2).repeat(40);refs.set(head,structuredClone(q));
  // Simulate publishing/reviewing the administrative source and explicit procedure adoption.
  state=complete(state,head,minute+1);
  state={...state,procedureRef:head,revision:state.revision+1};
  assert.deepEqual(state.activeRun,original);
  if(index===1) {
   const packet={...implementation(),id:'impl-2',taskId:'TASK-2',source:{...implementation().source,baseSha:head,headSha:head}};
   state=cycle.assignCycle(state,{expectedRevision:state.revision,actor:'codex',runId:'run-1',packet,queue:q},
    {now:at(minute+2),readQueue:ref=>refs.get(ref)});
   completed=complete(state,head,minute+3);
   const packet2={...s.admin,id:'close-2',source:{...s.admin.source,baseSha:head,headSha:head}};
   state=cycle.assignCycle(completed,{expectedRevision:completed.revision,actor:'codex',runId:'run-1',packet:packet2,queue:q},
    {now:at(minute+4),readQueue:ref=>refs.get(ref)});
  }
 }
 assert.deepEqual(q.tasks.filter(t=>t.id.startsWith('TASK-')).map(t=>t.status),['done','done']);
 assert.equal(q.tasks.find(t=>t.id==='OPS-004').status,'queued');assert.deepEqual(state.activeRun,original);
 assert.deepEqual(q.policy,s.q.policy);
});

test('CLI binds the queue to real immutable Git bytes and refuses a plausible invented task', () => {
 const now=new Date(Date.now()-1000).toISOString(), state=fixture();state.updatedAt=now;state.packet.notBefore=now;
 state.procedureRef=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const active=cycle.claimCycle(state,{expectedRevision:state.revision,actor:'codex',runId:'run-1',startedAt:now});
 const packet={...implementation(),notBefore:now,expiresAt:new Date(Date.now()+3_600_000).toISOString()};
 const files={state:JSON.stringify(active),queue:JSON.stringify(queue()),packet:JSON.stringify(packet)};
 for(const command of ['assign','finish']) {
  const args=[command,'state','--revision',String(active.revision),'--actor','codex','--run','run-1','--packet','packet','--queue','queue'];
  if(command==='finish')args.push('--outcome','HANDOFF','--summary','Plausible invented queue');
  const result=cycle.runCycleCli(args,{readText:path=>files[path]});
  assert.equal(result.exitCode,1);assert.match(result.stderr,/hypothetical/);
 }
});

test('coordination cannot discard an original pending CI through assign or HANDOFF', () => {
 const state=fixture();state.packet={...state.packet,disposition:'WAITING_CI',evidence:[evidence('ci','PENDING')]};
 const active=claim(state),original=structuredClone(active);
 assert.throws(()=>select(active,implementation()),/pending CI/);
 assert.throws(()=>finish(active,implementation(),'HANDOFF'),/Resolve or preserve/);
 assert.deepEqual(active,original);
});

test('CLI retain, assign and reconcile emit recoverable JSON without writing their inputs', () => {
 const q=queue();q.tasks.push(task('OPS-004',['operations/coordination.json','docs/history.md']));
 const now=new Date(Date.now()-10_000).toISOString(), initial=fixture();initial.updatedAt=now;initial.packet.notBefore=now;
 let state=cycle.claimCycle(initial,{expectedRevision:initial.revision,actor:'codex',runId:'run-1',startedAt:now});
 const packet={...implementation(),notBefore:now,expiresAt:new Date(Date.now()+3_600_000).toISOString()};
 state=cycle.assignCycle(state,{expectedRevision:state.revision,actor:'codex',runId:'run-1',packet,queue:q},{readQueue:()=>q});
 const completed={...state.packet,kind:'coordination',allowedPaths:[],disposition:'COMPLETE_INCREMENT',evidence:[evidence('ci'),evidence('review')],
  review:{authorContextId:'author',reviewerContextId:'reviewer',sourceSha:ref,reference:evidence('review').reference}};
 const files={state:JSON.stringify(state),packet:JSON.stringify(completed),queue:JSON.stringify(q)}, original=structuredClone(files);
 const adapters={readText:path=>files[path],readQueue:()=>q};
 const args=['finish','state','--revision',String(state.revision),'--actor','codex','--run','run-1','--packet','packet',
  '--outcome','COMPLETE_INCREMENT','--summary','Exact source completion','--retain-claim','true'];
 const retained=cycle.runCycleCli(args,adapters);assert.equal(retained.exitCode,0,retained.stderr);
 const done=JSON.parse(retained.stdout);assert.deepEqual(done.activeRun,state.activeRun);assert.deepEqual(files,original);
 assert.equal(cycle.runCycleCli([...args.slice(0,-1),'yes'],adapters).exitCode,1);
 files.state=retained.stdout;files.packet=JSON.stringify({...packet,id:'admin',taskId:'OPS-004',allowedPaths:['operations/coordination.json','docs/history.md']});
 const assigned=cycle.runCycleCli(['assign','state','--revision',String(done.revision),'--actor','codex','--run','run-1',
  '--packet','packet','--queue','queue'],adapters);assert.equal(assigned.exitCode,0,assigned.stderr);
 files.state=assigned.stdout;const before=structuredClone(files);
 const reconciled=cycle.runCycleCli(['reconcile','state','--revision',String(JSON.parse(assigned.stdout).revision),'--actor','codex','--run','run-1',
  '--queue','queue','--completion-ref','1'.repeat(40),'--next-action','Prepared source complete; freeze remains'],
  {...adapters,readCompletion:()=>done});
 assert.equal(reconciled.exitCode,0,reconciled.stderr);assert.equal(JSON.parse(reconciled.stdout).tasks[0].status,'done');
 assert.deepEqual(files,before);
});

test('assign and HANDOFF preserve canonical criteria and permit additional bounded checks', () => {
 const active=claim(fixture()), q=queue(), weak={...implementation(),exitCriteria:['Check a file exists']};
 assert.throws(()=>select(active,weak,q),/canonical exit criterion/);
 assert.throws(()=>finish(active,weak,'HANDOFF',q),/canonical exit criterion/);
 const extra={...implementation(),exitCriteria:[...q.tasks[0].exitCriteria,'Also exercise retry']};
 assert.deepEqual(select(active,extra,q).packet.exitCriteria,extra.exitCriteria);
});

test('reconciliation refuses a historical completion with weaker canonical criteria', () => {
 const s=closureFixture(), done=structuredClone(s.done);done.packet.exitCriteria=['Check a file exists'];
 assert.throws(()=>cycle.reconcileCycle(s.active,reconcileInput(s),
  {now:at(13),readQueue:()=>s.q,readCompletion:()=>done}),/canonical task contract/);
});

test('same durable completion emits identical bytes at different times', () => {
 const s=closureFixture(), input=reconcileInput(s), adapters={readQueue:()=>s.q,readCompletion:()=>s.done};
 const first=cycle.reconcileCycle(s.active,input,{...adapters,now:at(13)});
 const replay=cycle.reconcileCycle(s.active,input,{...adapters,now:at(20)});
 assert.equal(JSON.stringify(first),JSON.stringify(replay));
});

test('published completion survives INTERRUPTED and a new legitimate claim without renewing that claim', () => {
 const s=closureFixture(), input=reconcileInput(s), adapters={readQueue:()=>s.q,readCompletion:()=>s.done};
 const expected=cycle.reconcileCycle(s.active,input,{...adapters,now:at(13)});
 const interrupted=cycle.finishCycle(s.active,{expectedRevision:s.active.revision,actor:'codex',runId:'run-1',outcome:'INTERRUPTED',
  packet:{...s.active.packet,disposition:'INTERRUPTED'},summary:'Durable completion published; admin checkpoint interrupted'},{now:at(14)});
 const resumed=cycle.claimCycle(interrupted,{expectedRevision:interrupted.revision,actor:'codex',runId:'run-2',startedAt:at(15).toISOString()},{now:at(16)});
 const before=structuredClone(resumed);
 const actual=cycle.reconcileCycle(resumed,{...input,expectedRevision:resumed.revision,runId:'run-2'},{...adapters,now:at(17)});
 assert.deepEqual(actual,expected);assert.deepEqual(resumed,before);
 const bootstrap=cycle.claimCycle(interrupted,{expectedRevision:interrupted.revision,actor:'codex',runId:'run-2',startedAt:at(12).toISOString()},{now:at(16)});
 assert.deepEqual(cycle.reconcileCycle(bootstrap,{...input,expectedRevision:bootstrap.revision,runId:'run-2'},{...adapters,now:at(17)}),expected);
 assert.equal(bootstrap.activeRun.writeUntil,at(57).toISOString());
 const bad=structuredClone(resumed);bad.lastRun.runId='unrelated';
 assert.throws(()=>cycle.reconcileCycle(bad,{...input,expectedRevision:bad.revision,runId:'run-2'},{...adapters,now:at(17)}),/matching released run/);
 const restored=cycle.reconcileCycle(bad,{...input,expectedRevision:bad.revision,runId:'run-2',releaseRef:'2'.repeat(40)},
  {...adapters,now:at(17),readCompletion:ref=>ref==='2'.repeat(40)?interrupted:s.done});
 assert.deepEqual(restored,expected);
 assert.throws(()=>cycle.reconcileCycle(bad,{...input,expectedRevision:bad.revision,runId:'run-2',releaseRef:'2'.repeat(40)},
  {...adapters,now:at(17),readCompletion:ref=>ref==='2'.repeat(40)?s.active:s.done}),/Release receipt/);
});

test('replay after queue publication and explicit adoption is a no-op, conflicting receipt is rejected', () => {
 const s=closureFixture(), input=reconcileInput(s);
 const output=cycle.reconcileCycle(s.active,input,{now:at(13),readQueue:()=>s.q,readCompletion:()=>s.done});
 const adopted='4'.repeat(40), active={...s.active,procedureRef:adopted,revision:s.active.revision+1,updatedAt:at(14).toISOString()};
 const readQueue=head=>head===adopted?output:s.q;
 const replay=cycle.reconcileCycle(active,{...input,expectedRevision:active.revision,queue:output},
  {now:at(15),readQueue,readCompletion:()=>s.done});
 assert.deepEqual(replay,output);
 assert.throws(()=>cycle.reconcileCycle(active,{...input,expectedRevision:active.revision,queue:output,completionRef:'5'.repeat(40)},
  {now:at(15),readQueue,readCompletion:()=>s.done}),/another completion/);
 assert.throws(()=>cycle.reconcileCycle(active,{...input,expectedRevision:active.revision,queue:output,nextAction:'A different next step'},
  {now:at(15),readQueue,readCompletion:()=>s.done}),/another completion/);
});

test('a completion that released its own claim remains a durable release after intervening runs', () => {
 const s=closureFixture();
 const closed=cycle.finishCycle(s.done,{expectedRevision:s.done.revision,actor:'codex',runId:'run-1',
  outcome:'COMPLETE_INCREMENT',packet:s.done.packet,summary:'Synthetic final completion with release'},{now:at(13)});
 const claimed=cycle.claimCycle(closed,{expectedRevision:closed.revision,actor:'codex',runId:'run-2',startedAt:at(14).toISOString()},{now:at(15)});
 const active=cycle.assignCycle(claimed,{expectedRevision:claimed.revision,actor:'codex',runId:'run-2',packet:s.admin,queue:s.q},
  {now:at(16),readQueue:()=>s.q});
 const later={...active,lastRun:{...active.lastRun,runId:'intervening-run'}};
 const input={...reconcileInput(s),expectedRevision:later.revision,runId:'run-2'};
 const adapters={now:at(17),readQueue:()=>s.q,readCompletion:()=>closed};
 const implicit=cycle.reconcileCycle(later,input,adapters);
 const explicit=cycle.reconcileCycle(later,{...input,releaseRef:input.completionRef},adapters);
 assert.deepEqual(explicit,implicit);assert.equal(implicit.tasks[0].status,'done');
});

test('changed canonical contracts, dependencies and blockers cannot inherit completion', () => {
 const s=closureFixture(), adopted='4'.repeat(40), active={...s.active,procedureRef:adopted,revision:s.active.revision+1};
 for(const key of ['scope','dependsOn','blockers','exitCriteria']) {
  const q=structuredClone(s.q);
  if(key==='dependsOn')q.tasks[0][key]=['OPS-004'];
  else if(key==='blockers'){q.blockers=[blocker()];q.tasks[0][key]=['B'];}
  else q.tasks[0][key]=[...q.tasks[0][key],key==='scope'?'docs':'Extra criterion'];
  assert.throws(()=>cycle.reconcileCycle(active,{...reconcileInput(s),expectedRevision:active.revision,queue:q},
   {now:at(13),readQueue:head=>head===adopted?q:s.q,readCompletion:()=>s.done}),/canonical task contract/);
 }
});


test('a reopened canonical task cannot reuse its already recorded completion', () => {
 const s=closureFixture(), input=reconcileInput(s);
 const output=cycle.reconcileCycle(s.active,input,{now:at(13),readQueue:()=>s.q,readCompletion:()=>s.done});
 const reopened=structuredClone(output), row=reopened.tasks.find(task=>task.id==='TASK-1');
 row.status='queued';row.nextAction='Previous completion invalidated: reproduce the regression before closure';
 const adopted='6'.repeat(40), active={...s.active,procedureRef:adopted,revision:s.active.revision+1,updatedAt:at(14).toISOString()};
 const before=structuredClone(reopened);
 assert.throws(()=>cycle.reconcileCycle(active,{...input,expectedRevision:active.revision,queue:reopened},
  {now:at(15),readQueue:ref=>ref===adopted?reopened:s.q,readCompletion:()=>s.done}),/reopened|already recorded/);
 assert.deepEqual(reopened,before);
});


test('reopened tasks reject aliases of recorded candidates and accept genuinely new candidates', () => {
 const s=closureFixture(), input=reconcileInput(s), oldRef=input.completionRef, aliasRef='7'.repeat(40);
 const output=cycle.reconcileCycle(s.active,input,{now:at(13),readQueue:()=>s.q,readCompletion:()=>s.done});
 const reopened=structuredClone(output);reopened.tasks[0].status='queued';reopened.tasks[0].nextAction='Fix the reopened regression';
 const adopted='6'.repeat(40), active={...s.active,procedureRef:adopted,revision:s.active.revision+3,updatedAt:at(14).toISOString()};
 const alias={...s.done,revision:s.done.revision+1,updatedAt:at(12).toISOString()};
 const readQueue=ref=>ref===adopted?reopened:s.q;
 const args={...input,expectedRevision:active.revision,queue:reopened,completionRef:aliasRef};
 assert.throws(()=>cycle.reconcileCycle(active,args,{now:at(15),readQueue,readCompletion:ref=>ref===oldRef?s.done:alias}),/reopened/);
 for (const mutate of [packet=>packet.evidence.push({...packet.evidence[0],artifactDigest:null,access:'metadata'}),
  packet=>{packet.evidence[0].artifactDigest=null;},packet=>{packet.evidence[0].artifactDigest='e'.repeat(64);},
  packet=>{packet.evidence.reverse();packet.evidence.push({...packet.evidence[0]});}]) {
  const metadataOnly=structuredClone(alias);metadataOnly.packet.evidence[0].artifactDigest='f'.repeat(64);mutate(metadataOnly.packet);
  assert.throws(()=>cycle.reconcileCycle(active,args,{now:at(15),readQueue,readCompletion:ref=>ref===oldRef?s.done:metadataOnly}),/reopened/);
 }
 const fresh=structuredClone(alias);fresh.packet.source.headSha='c'.repeat(40);fresh.packet.source.sourceDigest='d'.repeat(64);
 fresh.packet.evidence=fresh.packet.evidence.map(item=>({...item,headSha:fresh.packet.source.headSha,sourceDigest:fresh.packet.source.sourceDigest,reference:item.reference+'/fresh'}));
 fresh.packet.review.sourceSha=fresh.packet.source.headSha;fresh.packet.review.reference=fresh.packet.evidence.find(item=>item.kind==='review').reference;
 const result=cycle.reconcileCycle(active,{...args,completionRef:'8'.repeat(40),nextAction:'New candidate verified after reopening'},
  {now:at(15),readQueue,readCompletion:ref=>ref===oldRef?s.done:fresh});
 assert.equal(result.tasks[0].status,'done');assert.equal(result.tasks[0].nextAction,'New candidate verified after reopening');
 const renewed=structuredClone(alias);renewed.packet.evidence=renewed.packet.evidence.map(item=>({...item,reference:item.reference+'/new-evidence'}));
 renewed.packet.review.reference=renewed.packet.evidence.find(item=>item.kind==='review').reference;
 const renewedResult=cycle.reconcileCycle(active,{...args,completionRef:'9'.repeat(40),nextAction:'Same candidate with genuinely new evidence'},
  {now:at(15),readQueue,readCompletion:ref=>ref===oldRef?s.done:renewed});
 assert.equal(renewedResult.tasks[0].status,'done');
});


test('removing or combining recorded proof references does not make a reopened completion fresh', () => {
 const s=closureFixture(), input=reconcileInput(s), oldRef=input.completionRef, otherRef='2'.repeat(40), aliasRef='7'.repeat(40);
 const first=structuredClone(s.done);first.packet.evidence.push({...first.packet.evidence[0],reference:first.packet.evidence[0].reference+'/attempts/1'});
 const second=structuredClone(s.done);second.packet.evidence.push({...second.packet.evidence[0],reference:second.packet.evidence[0].reference+'/attempts/2'});
 const output=cycle.reconcileCycle(s.active,input,{now:at(13),readQueue:()=>s.q,readCompletion:()=>first});
 const reopened=structuredClone(output);reopened.tasks[0].status='queued';
 reopened.tasks[0].evidence.push(`https://github.com/AndreaMarro/ardesia-next/blob/${otherRef}/handoff.json`);
 const adopted='6'.repeat(40), active={...s.active,procedureRef:adopted,revision:s.active.revision+3,updatedAt:at(14).toISOString()};
 for(const joined of [false,true]) {
  const alias={...structuredClone(s.done),revision:s.done.revision+1,updatedAt:at(12).toISOString()};
  if(joined)alias.packet.evidence.push(first.packet.evidence.at(-1),second.packet.evidence.at(-1));
  assert.throws(()=>cycle.reconcileCycle(active,{...input,expectedRevision:active.revision,queue:reopened,completionRef:aliasRef},
   {now:at(15),readQueue:ref=>ref===adopted?reopened:s.q,readCompletion:ref=>ref===oldRef?first:ref===otherRef?second:alias}),/reopened/);
 }
});

test('post-M3 reconciliation is independent of the local checkout baseline', () => {
 const s=closureFixture(), q=JSON.parse(readFileSync(new URL('../operations/coordination.json',import.meta.url),'utf8'));
 s.q.policy=q.policy;
 s.q.tasks.push(q.tasks.find(t=>t.id==='M3-REMOTE'));
 s.q.blockers=q.blockers;
 const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 s.active.procedureRef=head;s.done.procedureRef=head;
 const root=mkdtempSync(join(tmpdir(),'ardesia-immutable-reconcile-'));
 try {
  const code=`import {readFileSync} from 'node:fs';import {reconcileCycle} from ${JSON.stringify(new URL('./cycle.mjs',import.meta.url).href)};
   const s=JSON.parse(readFileSync(0,'utf8'));
   const result=reconcileCycle(s.active,s.input,{now:new Date(s.now),readQueue:()=>s.q,readCompletion:()=>s.done});
   console.log(result.tasks.find(t=>t.id==='TASK-1').status);`;
  const gitDir=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
  const output=execFileSync(process.execPath,['--input-type=module','-e',code],{cwd:root,encoding:'utf8',
   env:{...process.env,GIT_DIR:gitDir},input:JSON.stringify({...s,input:reconcileInput(s),now:at(13).toISOString()}),stdio:['pipe','pipe','pipe']});
  assert.equal(output.trim(),'done');
 } finally {rmSync(root,{recursive:true,force:true});}
});
