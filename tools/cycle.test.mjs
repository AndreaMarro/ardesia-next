import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCycle, cycleBrief, claimCycle, cycleBudget, finishCycle, runCycleCli} from './cycle.mjs';

const NOW = '2026-10-31T12:00:00Z';
const HEAD = 'a'.repeat(40), DIGEST = 'd'.repeat(64);
const fixture = () => ({
  schemaVersion: '1.0.0', kind: 'ardesia-dual-run-state', repository: 'AndreaMarro/ardesia-next', acceptanceEvidence: false,
  revision: 0, updatedAt: '2026-10-31T11:50:00Z', procedureRef: 'b'.repeat(40), activeRun: null,
  packet: {id: 'ticket-1', taskId: 'OPS-001', nextActor: 'codex', disposition: 'READY', kind: 'implementation',
    notBefore: NOW, expiresAt: '2026-10-31T13:00:00Z',
    source: {baseSha: HEAD, headSha: HEAD, branch: 'codex/scoped-change', pr: null, sourceDigest: DIGEST},
    goal: 'Correct the assigned reproducible issue.', allowedPaths: ['tools/assigned.mjs'],
    exitCriteria: ['The reproducer passes and the unchanged behavior remains covered.'], evidence: [], blockers: [], nextAction: 'Implement the scoped correction.'},
  lastRun: null
});
const evidence = (overrides = {}) => ({kind: 'ci', name: 'verify', reference: 'https://example.test/run/1', headSha: HEAD,
  sourceDigest: DIGEST, result: 'PASS', scope: 'Synthetic exact-head verification; toolchain/fixture/environment fixture-v1.',
  access: 'metadata', artifactDigest: null, ...overrides});
const claimed = (data = fixture(), actor = 'codex') => claimCycle(data, {expectedRevision: data.revision, runId: 'run-1', actor, startedAt: NOW}, {now: NOW});
const nextPacket = (data, overrides = {}) => ({...structuredClone(data.packet), kind: 'review', allowedPaths: [], nextActor: 'pro',
  disposition: 'READY_FOR_REVIEW', evidence: [evidence()], ...overrides});
const finish = (data, packet, outcome = 'READY_FOR_REVIEW', now = '2026-10-31T12:40:00Z') => finishCycle(data,
  {expectedRevision: data.revision, runId: data.activeRun.runId, actor: data.activeRun.actor, outcome, packet, summary: 'Synthetic result; not product acceptance.'}, {now});
const invalid = (data, pattern) => assert.ok(validateCycle(data).some(error => pattern.test(error)), `Expected ${pattern}`);

test('real start includes bootstrap time and rejects future or overlapping starts', () => {
  const input = {expectedRevision: 0, runId: 'run-1', actor: 'codex', startedAt: NOW};
  const active = claimCycle(fixture(), input, {now: '2026-10-31T12:08:00Z'});
  assert.equal(active.activeRun.startedAt, '2026-10-31T12:00:00.000Z');
  assert.equal(active.activeRun.claimedAt, '2026-10-31T12:08:00.000Z');
  assert.equal(active.activeRun.writeUntil, '2026-10-31T12:45:00.000Z');
  assert.equal(active.activeRun.closeBy, '2026-10-31T12:55:00.000Z');
  for (const startedAt of [undefined, '2026-10-31T12:09:00Z', 'not-a-date']) {
    assert.throws(() => claimCycle(fixture(), {...input, startedAt}, {now: '2026-10-31T12:08:00Z'}), /startedAt|start/i);
  }
  assert.throws(() => claimCycle(fixture(), input, {now: '2026-10-31T12:46:00Z'}), /insufficient time/);
  const packet = nextPacket(active, {kind: 'coordination', disposition: 'BLOCKED', blockers: ['B-QA'], evidence: [], expiresAt: null});
  const done = finish(active, packet, 'BLOCKED', '2026-10-31T12:20:00Z');
  assert.throws(() => claimCycle(done, {expectedRevision: 2, runId: 'pro-2', actor: 'pro', startedAt: '2026-10-31T12:19:00Z'}, {now: '2026-10-31T12:30:00Z'}), /lastRun completion/);
  const expiredDuringBootstrap = fixture(); expiredDuringBootstrap.packet.expiresAt = '2026-10-31T12:05:00Z';
  const reconciliation = claimCycle(expiredDuringBootstrap, {...input, actor: 'pro'}, {now: '2026-10-31T12:08:00Z'});
  assert.equal(cycleBrief(reconciliation, {now: '2026-10-31T12:08:00Z'}).activeRun.reconciliationOnly, true);
});

test('review cannot change the reviewed head, digest or PR while finishing', () => {
  const data = fixture(); Object.assign(data.packet, {kind: 'review', allowedPaths: [], nextActor: 'pro', disposition: 'READY_FOR_REVIEW', evidence: [evidence()]});
  const active = claimed(data, 'pro');
  for (const change of [{headSha: 'c'.repeat(40)}, {sourceDigest: 'e'.repeat(64)}, {pr: 'https://example.test/pr/other'}]) {
    const source = {...data.packet.source, ...change};
    const packet = nextPacket(active, {source, kind: 'coordination', disposition: 'COMPLETE_INCREMENT', evidence: [
      evidence({headSha: source.headSha, sourceDigest: source.sourceDigest}),
      evidence({kind: 'review', name: 'separate review', headSha: source.headSha, sourceDigest: source.sourceDigest})
    ]});
    assert.throws(() => finish(active, packet, 'COMPLETE_INCREMENT'), /review.*source|reviewed.*identity/i);
  }
});

test('ready dispositions require no unresolved blockers for every task kind', () => {
  for (const [kind, disposition] of [['implementation', 'READY'], ['review', 'READY'], ['coordination', 'READY'], ['review', 'READY_FOR_REVIEW'], ['coordination', 'COMPLETE_INCREMENT']]) {
    const data = fixture(); Object.assign(data.packet, {kind, disposition, nextActor: 'pro', allowedPaths: kind === 'implementation' ? ['tools/assigned.mjs'] : [],
      blockers: ['required-fixture-missing'], evidence: [evidence(), evidence({kind: 'review', name: 'separate review'})]});
    invalid(data, /blockers.*requires no blockers/);
  }
});

test('Codex handoff requires an unexpired useful window while allowing a future start', () => {
  const data = fixture(); data.packet.nextActor = 'pro';
  const active = claimed(data, 'pro');
  for (const [notBefore, expiresAt] of [
    [NOW, '2026-10-31T12:40:00Z'], [NOW, '2026-10-31T12:50:00Z'],
    ['2026-10-31T13:30:00Z', '2026-10-31T13:40:00Z']
  ]) {
    const packet = {...fixture().packet, id: 'next-ticket', notBefore, expiresAt};
    assert.throws(() => finish(active, packet, 'HANDOFF'), /Codex.*window/);
  }
  const packet = {...fixture().packet, id: 'future-ticket', notBefore: '2026-10-31T13:30:00Z', expiresAt: '2026-10-31T14:30:00Z'};
  assert.equal(finish(active, packet, 'HANDOFF').packet.id, 'future-ticket');
  const review = nextPacket(active, {nextActor: 'codex', expiresAt: '2026-10-31T12:45:00Z'});
  assert.throws(() => finish(active, review, 'READY_FOR_REVIEW'), /Codex.*window/);
});

test('a valid ticket is structural coordination only and validation does not mutate it', () => {
  const data = fixture(), before = structuredClone(data);
  assert.deepEqual(validateCycle(data), []);
  assert.deepEqual(data, before);
  const brief = cycleBrief(data, {now: NOW});
  assert.equal(brief.acceptanceEvidence, false); assert.equal(brief.ticketExpired, false);
  brief.packet.allowedPaths.push('unrelated'); assert.deepEqual(data, before);
});

test('malformed roots, missing fields and invented acceptance are refused without throwing', () => {
  for (const data of [null, [], 'PASS', 1, {}, {...fixture(), packet: null}, {...fixture(), activeRun: {}}, {...fixture(), lastRun: {}}]) {
    assert.doesNotThrow(() => validateCycle(data)); assert.ok(validateCycle(data).length);
  }
  for (const [key, value] of [['acceptanceEvidence', true], ['repository', 'AndreaMarro/ardesia'], ['schemaVersion', '2.0.0'], ['M3', 'ACCEPTED'], ['revision', -1]]) {
    const data = fixture(); data[key] = value; invalid(data, new RegExp(key));
  }
  for (const key of Object.keys(fixture().packet)) { const data = fixture(); delete data.packet[key]; assert.ok(validateCycle(data).length, key); }
});

test('identity and dates must be full, explicit and possible', () => {
  for (const value of ['2026-10-31', '2026-02-30T12:00:00Z', '2026-10-31T24:00:00Z', 'yesterday']) {
    const data = fixture(); data.updatedAt = value; invalid(data, /updatedAt/);
  }
  for (const field of ['baseSha', 'headSha']) { const data = fixture(); data.packet.source[field] = 'abcdef0'; invalid(data, new RegExp(field)); }
  const data = fixture(); data.procedureRef = 'main'; invalid(data, /procedureRef/);
  data.packet.source.sourceDigest = '123'; invalid(data, /sourceDigest/);
  data.packet.expiresAt = data.packet.notBefore; invalid(data, /expiresAt/);
});

test('writable scopes reject traversal, filesystem roots, globs, metadata and empty scope', () => {
  for (const path of ['', '.', '..', '/tmp/file', '../file', 'tools/../file', 'tools/./file', 'tools//file', 'C:\\file', 'tools/**', 'tools/%2e%2e/file', '.git/config']) {
    const data = fixture(); data.packet.allowedPaths = [path]; invalid(data, /allowedPaths/);
  }
  const data = fixture(); data.packet.allowedPaths = []; invalid(data, /allowedPaths/);
  data.packet.allowedPaths = ['tools', 'tools/a.mjs']; invalid(data, /overlapping/);
  data.packet.allowedPaths = ['tools/a', 'tools/ab']; assert.deepEqual(validateCycle(data), []);
  data.packet.kind = 'review'; invalid(data, /only implementation/);
});

test('Codex and implementation tickets cannot target protected or malformed branches', () => {
  for (const branch of ['main', 'preview/m3', 'staging', 'production', 'ops/dual-run-state', 'refs/heads/topic', 'HEAD', 'bad branch', 'a..b', 'x.lock']) {
    const data = fixture(); data.packet.source.branch = branch; invalid(data, /source.branch/);
    assert.throws(() => claimed(data), /source.branch/);
  }
  const data = fixture(); data.packet.nextActor = 'pro'; data.packet.kind = 'coordination'; data.packet.allowedPaths = []; data.packet.source.branch = 'main';
  assert.deepEqual(validateCycle(data), []);
});

test('evidence URLs are structural references and credentialed or malformed input is refused', () => {
  for (const reference of ['http://example.test/run', 'https://user:secret@example.test/run', '../artifact', 'https://example.test/\nrun']) {
    const data = fixture(); data.packet.evidence = [evidence({reference})]; invalid(data, /reference/);
  }
  const data = fixture(); data.packet.evidence = [evidence({reference: 'operations/example.json'})]; assert.deepEqual(validateCycle(data), []);
  data.packet.evidence = [null, {}, 'PASS']; assert.doesNotThrow(() => validateCycle(data)); invalid(data, /evidence/);
});

test('claim requires the expected revision and creates bounded deadlines without mutating input', () => {
  const data = fixture(), before = structuredClone(data), active = claimed(data);
  assert.equal(active.revision, 1); assert.deepEqual(data, before);
  assert.equal(active.activeRun.writeUntil, '2026-10-31T12:45:00.000Z');
  assert.equal(active.activeRun.closeBy, '2026-10-31T12:55:00.000Z');
  assert.equal(active.procedureRef, data.procedureRef);
  for (const expectedRevision of [undefined, -1, 1, 0.5, '0']) assert.throws(() => claimCycle(data, {expectedRevision, actor: 'codex', runId: 'run-1', startedAt: NOW}, {now: NOW}), /revision/);
});

test('an existing claim blocks both actors even after every deadline has expired', () => {
  const data = claimed();
  for (const actor of ['pro', 'codex']) assert.throws(() => claimCycle(data, {expectedRevision: 1, actor, runId: 'run-2', startedAt: '2026-11-01T12:00:00Z'}, {now: '2026-11-01T12:00:00Z'}), /expiry never authorizes takeover/);
  const brief = cycleBrief(data, {now: '2026-11-01T12:00:00Z'});
  assert.equal(brief.activeRun.closeExpired, true); assert.equal(brief.activeRun.takeoverAuthorized, false);
});

test('wrong actors, Codex coordination and inactive Codex tickets are rejected', () => {
  assert.throws(() => claimed(fixture(), 'pro'), /different actor/);
  for (const disposition of ['BLOCKED', 'WAITING_CI', 'COMPLETE_INCREMENT', 'INTERRUPTED', 'IDLE']) {
    const data = fixture(); data.packet.disposition = disposition; invalid(data, /Codex requires/);
  }
  const data = fixture(); data.packet.kind = 'coordination'; data.packet.allowedPaths = []; invalid(data, /Codex requires/);
});

test('early or expired Codex tickets cannot start and a short remaining window retains closure time', () => {
  assert.throws(() => claimCycle(fixture(), {expectedRevision: 0, actor: 'codex', runId: 'run-1', startedAt: '2026-10-31T11:59:00Z'}, {now: '2026-10-31T11:59:00Z'}), /not active yet/);
  assert.throws(() => claimCycle(fixture(), {expectedRevision: 0, actor: 'codex', runId: 'run-1', startedAt: '2026-10-31T13:00:00Z'}, {now: '2026-10-31T13:00:00Z'}), /expired/);
  const data = fixture(); data.packet.expiresAt = '2026-10-31T12:20:00Z';
  const active = claimed(data); assert.equal(active.activeRun.writeUntil, '2026-10-31T12:10:00.000Z'); assert.equal(active.activeRun.closeBy, '2026-10-31T12:20:00.000Z');
  data.packet.expiresAt = '2026-10-31T12:10:00Z'; assert.throws(() => claimed(data), /insufficient time/);
});

test('Pro can reconcile an expired unclaimed Codex ticket but receives no product-work budget', () => {
  const data = fixture();
  const active = claimCycle(data, {expectedRevision: 0, actor: 'pro', runId: 'reconcile-1', startedAt: '2026-11-02T12:00:00Z'}, {now: '2026-11-02T12:00:00Z'});
  assert.equal(cycleBrief(active, {now: '2026-11-02T12:01:00Z'}).activeRun.reconciliationOnly, true);
  assert.throws(() => cycleBudget(active, {actor: 'pro', runId: 'reconcile-1', seconds: 1}, {now: '2026-11-02T12:01:00Z'}), /reconciliation only/);
  const packet = {...structuredClone(data.packet), id: 'ticket-2', notBefore: '2026-11-02T13:30:00Z', expiresAt: '2026-11-02T14:30:00Z'};
  const done = finish(active, packet, 'HANDOFF', '2026-11-02T12:10:00Z');
  assert.equal(done.activeRun, null); assert.equal(done.packet.id, 'ticket-2'); assert.equal(done.procedureRef, data.procedureRef);
});

test('an undated Pro coordination expiry keeps the prepared bootstrap usable and grants no Codex ticket', () => {
  const data = fixture(); Object.assign(data.packet, {kind: 'coordination', nextActor: 'pro', disposition: 'IDLE', allowedPaths: [], expiresAt: null}); data.packet.source.branch = 'main';
  const active = claimCycle(data, {expectedRevision: 0, actor: 'pro', runId: 'future-run', startedAt: '2030-01-01T12:00:00Z'}, {now: '2030-01-01T12:00:00Z'});
  assert.equal(active.activeRun.actor, 'pro'); assert.equal(cycleBrief(active, {now: '2030-01-01T12:00:00Z'}).ticketExpired, false);
  data.packet.nextActor = 'codex'; invalid(data, /null is reserved/);
});

test('budget rejects wrong ownership, nonpositive or oversized commands, and backward or invalid clocks', () => {
  const data = claimed(), input = {runId: 'run-1', actor: 'codex', seconds: 30};
  assert.equal(cycleBudget(data, input, {now: NOW}).remainingSeconds, 2700);
  for (const change of [{runId: 'other'}, {actor: 'pro'}]) assert.throws(() => cycleBudget(data, {...input, ...change}, {now: NOW}), /active owner/);
  for (const seconds of [0, -1, 0.5, NaN, 2701]) assert.throws(() => cycleBudget(data, {...input, seconds}, {now: NOW}), /seconds|does not fit/);
  assert.throws(() => cycleBudget(data, input, {now: '2026-10-31T12:44:45Z'}), /does not fit/);
  assert.throws(() => cycleBudget(data, input, {now: '2026-10-31T11:59:00Z'}), /Clock precedes/);
  assert.throws(() => cycleBudget(data, input, {now: 'not-a-date'}), /Clock must/);
});

test('Codex finishes review-ready only with verify PASS on the exact head and digest, routed to Pro', () => {
  const data = claimed(), packet = nextPacket(data), done = finish(data, packet);
  assert.equal(done.activeRun, null); assert.equal(done.packet.nextActor, 'pro'); assert.equal(done.revision, 2); assert.equal(done.lastRun.late, false);
  for (const change of [{headSha: 'c'.repeat(40)}, {sourceDigest: 'e'.repeat(64)}, {result: 'PENDING'}, {name: 'unrelated'}]) {
    const bad = nextPacket(data, {evidence: [evidence(change)]}); assert.throws(() => finish(data, bad), /verify PASS/);
  }
  assert.throws(() => finish(data, {...packet, nextActor: 'codex'}), /actor\/disposition/);
});

test('pending CI is preserved as WAITING_CI and never turns into review-ready through a handoff', () => {
  const data = claimed();
  const packet = nextPacket(data, {kind: 'coordination', disposition: 'WAITING_CI', evidence: [evidence({result: 'PENDING'})]});
  const done = finish(data, packet, 'WAITING_CI'); assert.equal(done.packet.disposition, 'WAITING_CI');
  assert.equal(done.packet.evidence[0].reference, packet.evidence[0].reference);
  assert.throws(() => finish(data, {...packet, evidence: []}, 'WAITING_CI'), /pending verify/);
  assert.throws(() => finish(data, nextPacket(data, {evidence: packet.evidence})), /verify PASS/);
});

test('BLOCKED must explain a real blocker and Pro may claim it for reconciliation', () => {
  const data = claimed(), packet = nextPacket(data, {kind: 'coordination', disposition: 'BLOCKED', evidence: [], blockers: ['B-QA'], expiresAt: null});
  const done = finish(data, packet, 'BLOCKED');
  assert.throws(() => finish(data, {...packet, blockers: []}, 'BLOCKED'), /requires a blocker/);
  const active = claimCycle(done, {expectedRevision: 2, actor: 'pro', runId: 'pro-2', startedAt: '2026-10-31T13:30:00Z'}, {now: '2026-10-31T13:30:00Z'});
  assert.equal(active.activeRun.actor, 'pro');
});

test('only Pro can complete an increment, requiring same-source CI and review without certifying product', () => {
  const data = fixture(); data.packet.nextActor = 'pro';
  const active = claimed(data, 'pro');
  const packet = nextPacket(active, {kind: 'coordination', disposition: 'COMPLETE_INCREMENT', evidence: [evidence(), evidence({kind: 'review', name: 'separate model review'})]});
  const done = finish(active, packet, 'COMPLETE_INCREMENT'); assert.equal(done.acceptanceEvidence, false);
  assert.throws(() => finish(active, {...packet, evidence: [evidence()]}, 'COMPLETE_INCREMENT'), /review reference/);
  assert.throws(() => finish(claimed(), packet, 'COMPLETE_INCREMENT'), /Only Pro/);
  const wrongReview = {...packet, evidence: [evidence(), evidence({kind: 'review', sourceDigest: 'e'.repeat(64)})]};
  assert.throws(() => finish(active, wrongReview, 'COMPLETE_INCREMENT'), /review reference/);
});

test('Pro can hand off a new coordination task after completing the previous increment', () => {
  const data = fixture(); data.packet.nextActor = 'pro';
  const active = claimed(data, 'pro');
  const completion = nextPacket(active, {kind: 'coordination', disposition: 'COMPLETE_INCREMENT', expiresAt: null,
    evidence: [evidence(), evidence({kind: 'review', name: 'separate model review'})]});
  const done = finish(active, completion, 'COMPLETE_INCREMENT');
  const coordinator = claimCycle(done, {expectedRevision: 2, runId: 'pro-2', actor: 'pro', startedAt: '2026-10-31T13:30:00Z'}, {now: '2026-10-31T13:30:00Z'});
  const packet = {...structuredClone(completion), id: 'ticket-m3', taskId: 'M3-REMOTE', disposition: 'READY',
    notBefore: '2026-10-31T13:30:00Z', source: {...completion.source, branch: 'main'},
    goal: 'Reconcile the existing remote prerequisites.', exitCriteria: ['Read the material capability delta.'], evidence: [], nextAction: 'Inspect the existing prerequisite evidence.'};
  const next = finish(coordinator, packet, 'HANDOFF', '2026-10-31T13:40:00Z');
  assert.equal(next.packet.taskId, 'M3-REMOTE'); assert.equal(next.packet.nextActor, 'pro');
  assert.deepEqual(next.packet.allowedPaths, []); assert.equal(next.activeRun, null);
  assert.equal(next.lastRun.packetId, done.packet.id); assert.equal(next.lastRun.outcome, 'HANDOFF');
  assert.equal(next.procedureRef, done.procedureRef); assert.deepEqual(validateCycle(next), []);
});

test('finishing preserves control identity and rejects ownership, revision, scope and assignment drift', () => {
  const data = claimed(), packet = nextPacket(data), before = structuredClone(data);
  for (const change of [{taskId: 'OTHER'}, {id: 'other-ticket'}, {goal: 'A new goal'}, {exitCriteria: ['Weaker criteria']}, {source: {...packet.source, branch: 'codex/other'}}]) {
    assert.throws(() => finish(data, {...packet, ...change}), /silently change/);
  }
  assert.throws(() => finish(data, {...packet, allowedPaths: ['tools/unassigned.mjs']}), /expand/);
  for (const change of [{runId: 'other'}, {actor: 'pro'}, {expectedRevision: 0}]) assert.throws(() => finishCycle(data,
    {expectedRevision: 1, runId: 'run-1', actor: 'codex', outcome: 'READY_FOR_REVIEW', packet, summary: 'Synthetic.', ...change}, {now: NOW}), /active owner|revision/);
  const done = finish(data, packet); assert.equal(done.procedureRef, data.procedureRef); assert.deepEqual(data, before);
});

test('Pro hands off explicit new work to Codex but Codex cannot create its own successor', () => {
  const data = fixture(); data.packet.nextActor = 'pro';
  const active = claimed(data, 'pro'), packet = fixture().packet; packet.id = 'ticket-new';
  assert.equal(finish(active, packet, 'HANDOFF').packet.id, 'ticket-new');
  assert.throws(() => finish(claimed(), packet, 'HANDOFF'), /Only Pro/);
  for (const kind of ['implementation', 'review']) assert.throws(() => finish(active,
    {...packet, nextActor: 'pro', kind, allowedPaths: kind === 'review' ? [] : packet.allowedPaths}, 'HANDOFF'), /actor\/disposition|coordination/);
});

test('a late owner can record completion with an explicit overrun but its run ID cannot be replayed', () => {
  const active = claimed(), packet = nextPacket(active, {kind: 'coordination', disposition: 'INTERRUPTED', evidence: [], expiresAt: null});
  const done = finish(active, packet, 'INTERRUPTED', '2026-10-31T13:10:00Z');
  assert.equal(done.lastRun.late, true); assert.equal(done.lastRun.outcome, 'INTERRUPTED'); assert.equal(done.activeRun, null);
  assert.throws(() => claimCycle(done, {expectedRevision: 2, actor: 'pro', runId: 'run-1', startedAt: '2026-10-31T13:30:00Z'}, {now: '2026-10-31T13:30:00Z'}), /cannot be reused/);
  const tampered = structuredClone(done); tampered.lastRun.late = false; invalid(tampered, /actual deadline overrun/);
});

test('contradictory same-source evidence cannot pass readiness while historical evidence remains identifiable', () => {
  const active = claimed();
  for (const result of ['FAIL', 'PENDING']) {
    const packet = nextPacket(active, {evidence: [evidence(), evidence({kind: 'check', name: 'affected flow', result})]});
    assert.throws(() => finish(active, packet), /unresolved/);
  }
  const packet = nextPacket(active, {evidence: [evidence(), evidence({kind: 'check', result: 'FAIL', headSha: 'f'.repeat(40)})]});
  assert.equal(finish(active, packet).packet.evidence[1].result, 'FAIL');
});

test('CLI validate is clock-independent and malformed JSON, flags and clock overrides fail closed', () => {
  const data = fixture(), readText = () => JSON.stringify(data);
  const result = runCycleCli(['validate', 'state.json'], {readText});
  assert.equal(result.exitCode, 0, result.stderr); assert.equal(JSON.parse(result.stdout).acceptanceEvidence, false);
  for (const args of [[], ['unknown', 'state.json'], ['claim', 'state.json'], ['claim', 'state.json', '--revision', '0', '--actor', 'codex', '--run', 'cli-1'], ['brief', 'state.json', '--now', NOW], ['validate', 'state.json', '--ignore-errors', 'true']]) {
    const rejected = runCycleCli(args, {readText}); assert.equal(rejected.exitCode, 1); assert.equal(rejected.stdout, ''); assert.match(rejected.stderr, /Usage/);
  }
  const malformed = runCycleCli(['validate', 'state.json'], {readText: () => '{bad json'}); assert.equal(malformed.exitCode, 1); assert.match(malformed.stderr, /invalid JSON/);
});

test('exported CLI entry supports a real-clock claim, budget and finish without subprocesses or file writes', () => {
  const now = Date.now(), data = fixture();
  data.updatedAt = new Date(now - 60_000).toISOString(); data.packet.notBefore = data.updatedAt; data.packet.expiresAt = new Date(now + 120 * 60_000).toISOString();
  const files = new Map([['state.json', JSON.stringify(data)]]), readText = path => { assert.ok(files.has(path)); return files.get(path); };
  const claim = runCycleCli(['claim', 'state.json', '--revision', '0', '--actor', 'codex', '--run', 'cli-1', '--started-at', new Date(now).toISOString()], {readText});
  assert.equal(claim.exitCode, 0, claim.stderr); const active = JSON.parse(claim.stdout); files.set('state.json', claim.stdout);
  assert.equal(runCycleCli(['brief', 'state.json'], {readText}).exitCode, 0);
  const budget = runCycleCli(['budget', 'state.json', '--actor', 'codex', '--run', 'cli-1', '--seconds', '30'], {readText}); assert.equal(budget.exitCode, 0, budget.stderr);
  files.set('packet.json', JSON.stringify(nextPacket(active)));
  const done = runCycleCli(['finish', 'state.json', '--revision', '1', '--actor', 'codex', '--run', 'cli-1', '--outcome', 'READY_FOR_REVIEW', '--packet', 'packet.json', '--summary', 'Synthetic CLI completion.'], {readText});
  assert.equal(done.exitCode, 0, done.stderr); assert.equal(JSON.parse(done.stdout).activeRun, null); assert.equal(files.get('state.json'), claim.stdout);
  const duplicate = runCycleCli(['claim', 'state.json', '--revision', '1', '--actor', 'codex', '--actor', 'pro', '--run', 'cli-2', '--started-at', new Date(now).toISOString()], {readText}); assert.equal(duplicate.exitCode, 1);
});
