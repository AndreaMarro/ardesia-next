import test from 'node:test';
import assert from 'node:assert/strict';
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
const queue = () => ({tasks: [{id: 'TASK-1', status: 'queued', scope: ['tools'], dependsOn: [], blockers: []}], blockers: [], claims: []});
const select = (data, packet, q = queue()) => cycle.assignCycle(data, {expectedRevision: data.revision, actor: 'codex', runId: 'run-1', packet, queue: q}, {now: at(9)});
const finish = (data, packet, outcome) => cycle.finishCycle(data, {expectedRevision: data.revision, actor: 'codex', runId: 'run-1', packet, outcome, summary: 'Synthetic test result'}, {now: at(50)});

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
test('stale expected revision and expired active claim cannot be taken over', () => {
 const a = claim(fixture());
 assert.throws(() => cycle.claimCycle(a,{expectedRevision:a.revision,actor:'codex',runId:'run-2',startedAt:at(100).toISOString()},{now:at(100)}), /active claim/);
 assert.throws(() => cycle.claimCycle(fixture(),{expectedRevision:0,actor:'codex',runId:'run-1',startedAt:T},{now:at(1)}), /revision/);
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
 const q=queue(); q.tasks[0].status='ready_for_review'; q.tasks[0].blockers=['B-FREEZE'];q.blockers=[{id:'B-FREEZE',status:'blocked'}];
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
 const q=queue(); q.tasks.push({id:'OTHER',status:'in_progress',scope:['docs'],dependsOn:[],blockers:[]});
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
 const assigned=cycle.runCycleCli(['assign','claimed','--revision','5','--actor','codex','--run','cli-1','--packet','work','--queue','queue'],{readText:path=>input[path]});
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
