import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {validateCoordination, coordinationBrief, runCoordinationCli} from './check-operations.mjs';

const fixture = () => ({
  schemaVersion: '1.0.0', acceptanceEvidence: false, repository: 'AndreaMarro/ardesia-next', updatedAt: '2026-10-31T12:00:00Z',
  policy: {maxActiveIncrements: 1, maxRemoteWriters: 1, productionAuthorized: false, newSpendAuthorized: false,
    codexJobsAuthorized: false, mainFrozen: true, stagingFrozen: true},
  canonical: {entrypoint: 'docs/START_HERE.md', handbook: 'docs/operations.md', history: 'docs/history.md',
    lessons: 'docs/lessons.md', product: 'docs/product-map.md', acceptance: 'tools/status.mjs'},
  observations: [{id: 'observation-1', observedAt: '2026-10-31T11:00:00Z', kind: 'handoff', source: 'synthetic fixture', value: {description: 'Synthetic, not live evidence'}}],
  blockers: [{id: 'access', status: 'blocked', reason: 'Synthetic capability unavailable', lastCheckedAt: '2026-10-31T11:00:00Z',
    recheckWhen: 'Capability changes', sources: ['observation-1']}],
  tasks: [{id: 'increment', title: 'Synthetic increment', status: 'in_progress', priority: 1, owner: 'coordinator',
    scope: ['docs/', 'tools/'], dependsOn: [], blockers: [], exitCriteria: ['Review the concrete change'], evidence: [], nextAction: 'Complete one change'}],
  claims: [{taskId: 'increment', owner: 'coordinator', baseSha: 'a'.repeat(40), branch: 'pro/synthetic', paths: ['tools/check-operations.mjs'],
    claimedAt: '2026-10-31T12:00:00Z', expiresAt: '2026-10-31T18:00:00Z'}]
});
const invalid = (data, pattern) => assert.ok(validateCoordination(data).some(error => pattern.test(error)), `Expected ${pattern}`);
const withRoot = run => {
  const root = mkdtempSync(join(tmpdir(), 'ardesia-operations-test-'));
  try {
    const data = fixture();
    for (const path of Object.values(data.canonical)) { mkdirSync(dirname(join(root, path)), {recursive: true}); writeFileSync(join(root, path), 'synthetic fixture\n'); }
    mkdirSync(join(root, 'operations'));
    writeFileSync(join(root, 'operations/coordination.json'), JSON.stringify(data));
    return run(root, data);
  } finally { rmSync(root, {recursive: true, force: true}); }
};

test('valid coordination is accepted without mutating the caller data', () => {
  const data = fixture(), before = structuredClone(data);
  assert.deepEqual(validateCoordination(data), []);
  assert.deepEqual(data, before);
});

test('malformed roots, unknown fields and invented product acceptance are rejected', () => {
  for (const data of [null, [], 'PASS', 1]) assert.ok(validateCoordination(data).length);
  for (const [key, value] of [['status', 'PASS'], ['M3', 'ACCEPTED'], ['acceptanceEvidence', true], ['repository', 'AndreaMarro/ardesia'], ['schemaVersion', '2.0.0']]) {
    const data = fixture(); data[key] = value; assert.ok(validateCoordination(data).length, key);
  }
});

test('the current mandate cannot be weakened by changing policy flags or limits', () => {
  for (const key of Object.keys(fixture().policy)) {
    const data = fixture(); data.policy[key] = typeof data.policy[key] === 'boolean' ? !data.policy[key] : 2;
    invalid(data, new RegExp(`policy.${key}`));
  }
  const data = fixture(); data.policy.autoApprove = true; invalid(data, /unsupported|supported field/);
});

test('required fields and impossible dates fail validation', () => {
  for (const key of Object.keys(fixture())) { const data = fixture(); delete data[key]; assert.ok(validateCoordination(data).length, key); }
  for (const value of ['2026-10-31', '2026-02-30T12:00:00Z', '2026-10-31T24:00:00Z', 'yesterday']) {
    const data = fixture(); data.updatedAt = value; invalid(data, /updatedAt/);
  }
});

test('duplicate observation, blocker and task identities are rejected', () => {
  for (const key of ['observations', 'blockers', 'tasks']) {
    const data = fixture(); data[key].push(structuredClone(data[key][0])); invalid(data, /duplicate id/);
  }
});

test('review-ready and done need evidence references and cannot use a PASS status', () => {
  for (const status of ['ready_for_review', 'done']) {
    const data = fixture(); data.claims = []; data.tasks[0].status = status;
    invalid(data, /evidence/);
    data.tasks[0].evidence = ['https://github.com/AndreaMarro/ardesia-next/pull/18'];
    assert.deepEqual(validateCoordination(data), []);
  }
  const data = fixture(); data.tasks[0].status = 'PASS'; invalid(data, /status/);
});

test('traversal, absolute paths, backslashes and glob scopes are refused', () => {
  for (const path of ['../outside', '/tmp/file', 'docs/../file', 'docs/./file', 'docs//file', 'C:\\file', 'docs/**', 'docs/%2e%2e/file']) {
    for (const field of ['scope', 'evidence']) { const data = fixture(); data.tasks[0][field] = [path]; invalid(data, new RegExp(field)); }
    const data = fixture(); data.claims[0].paths = [path]; invalid(data, /paths/);
  }
});

test('unknown task dependencies and cycles including self-cycles fail', () => {
  let data = fixture(); data.tasks[0].dependsOn = ['missing']; invalid(data, /unknown task/);
  data = fixture(); data.tasks[0].dependsOn = ['increment']; invalid(data, /cycle/);
  data = fixture(); data.tasks.push({...structuredClone(data.tasks[0]), id: 'second', status: 'queued', dependsOn: ['increment']});
  data.tasks[0].dependsOn = ['second']; invalid(data, /cycle/);
});

test('unknown blockers and empty blocker explanations or sources fail', () => {
  const data = fixture(); data.tasks[0].blockers = ['unknown']; invalid(data, /unknown blocker/);
  for (const key of ['reason', 'recheckWhen', 'sources']) {
    const missing = fixture(); missing.blockers[0][key] = key === 'sources' ? [] : ''; invalid(missing, new RegExp(key));
  }
});

test('only in-progress increments count against the single-increment limit', () => {
  const data = fixture();
  data.tasks.push({...structuredClone(data.tasks[0]), id: 'review', status: 'ready_for_review', evidence: ['docs/history.md']});
  assert.deepEqual(validateCoordination(data), []);
  data.tasks[1].status = 'in_progress'; invalid(data, /only one increment/);
});

test('claims require an existing active task and matching owner', () => {
  for (const [key, value, pattern] of [['taskId', 'missing', /unknown task/], ['owner', 'other', /match the task owner/]]) {
    const data = fixture(); data.claims[0][key] = value; invalid(data, pattern);
  }
  const data = fixture(); data.tasks[0].status = 'queued'; invalid(data, /in-progress/);
});

test('claims require full SHA and a valid isolated branch', () => {
  const data = fixture(); data.claims[0].baseSha = 'aaaaaaa'; invalid(data, /baseSha/);
  for (const branch of ['main', 'preview/m3', 'refs/heads/main', 'HEAD', 'bad branch', 'a..b', 'x.lock', 'a//b', 'a@{b']) {
    const candidate = fixture(); candidate.claims[0].branch = branch; invalid(candidate, /branch/);
  }
});

test('claimed paths must fall within the task scope', () => {
  const data = fixture(); data.claims[0].paths = ['packages/core']; invalid(data, /within the task scope/);
  data.claims[0].paths = ['tools-other']; invalid(data, /within the task scope/);
});

test('overlapping ancestors and duplicate paths are refused while sibling prefixes are separate', () => {
  for (const paths of [['tools/', 'tools/check-operations.mjs'], ['docs', 'docs/'], ['tools/check-operations.mjs', 'tools/check-operations.mjs']]) {
    const data = fixture(); data.claims[0].paths = paths; invalid(data, /overlaps/);
  }
  const data = fixture(); data.claims[0].paths = ['tools/a', 'tools/ab']; assert.deepEqual(validateCoordination(data), []);
  data.claims.push({...data.claims[0], paths: ['tools/a/file.mjs']}); invalid(data, /overlaps/);
});

test('claim expiry is display-only and never grants takeover or time-dependent CI failure', () => {
  const data = fixture();
  assert.deepEqual(validateCoordination(data), []);
  const brief = coordinationBrief(data, {now: '2030-01-01T00:00:00Z'});
  assert.equal(brief.claims[0].expired, true); assert.equal(brief.claims[0].takeoverAuthorized, false);
  assert.deepEqual(validateCoordination(data), []);
  data.claims[0].expiresAt = data.claims[0].claimedAt; invalid(data, /must follow/);
});

test('canonical references must exist inside the supplied root and retain the acceptance engine', () => withRoot((root, data) => {
  assert.deepEqual(validateCoordination(data, {root}), []);
  data.canonical.entrypoint = 'docs/missing.md'; assert.ok(validateCoordination(data, {root}).some(error => /existing file/.test(error)));
  const outside = mkdtempSync(join(tmpdir(), 'ardesia-operations-outside-'));
  try {
    writeFileSync(join(outside, 'external.md'), 'synthetic fixture\n');
    data.canonical.entrypoint = 'docs/escape.md'; symlinkSync(join(outside, 'external.md'), join(root, data.canonical.entrypoint));
    assert.ok(validateCoordination(data, {root}).some(error => /inside the repository/.test(error)));
  } finally { rmSync(outside, {recursive: true, force: true}); }
  data.canonical.acceptance = 'docs/history.md'; invalid(data, /existing acceptance engine/);
}));

test('brief CLI prints operational context without manufacturing acceptance', () => withRoot((root) => {
  const result = runCoordinationCli(['--brief'], {root, now: '2026-11-01T12:00:00Z'});
  assert.equal(result.exitCode, 0, result.stderr);
  const brief = JSON.parse(result.stdout);
  assert.equal(brief.acceptanceEvidence, false); assert.equal(brief.kind, 'ardesia-coordination-brief');
  assert.equal(brief.tasks[0].id, 'increment'); assert.equal(brief.claims[0].takeoverAuthorized, false);
  assert.equal(Object.hasOwn(brief, 'M3'), false); assert.equal(Object.hasOwn(brief, 'status'), false);
  assert.equal(result.stdout.includes('PASS'), false); assert.equal(result.stdout.includes('ACCEPTED'), false);
}));

test('CLI rejects invalid coordination and unsupported flags before emitting a brief', () => withRoot((root, data) => {
  data.acceptanceEvidence = true; writeFileSync(join(root, 'operations/coordination.json'), JSON.stringify(data));
  let result = runCoordinationCli(['--brief'], {root});
  assert.equal(result.exitCode, 1); assert.equal(result.stdout, ''); assert.match(result.stderr, /acceptanceEvidence/);
  result = runCoordinationCli(['--ignore-errors'], {root});
  assert.equal(result.exitCode, 1); assert.match(result.stderr, /Usage:/);
}));

test('observation kinds and references cannot become acceptance records or credentialed URLs', () => {
  const data = fixture(); data.observations[0].kind = 'PASS'; invalid(data, /kind/);
  for (const url of ['http://example.test/evidence', 'https://user:password@example.test/evidence', 'https://example.test/\nevidence']) {
    const candidate = fixture(); candidate.observations[0].url = url; invalid(candidate, /url/);
    candidate.tasks[0].evidence = [url]; invalid(candidate, /evidence/);
  }
});

test('an in-progress increment requires a claim; malformed claims return errors without throwing', () => {
  const data = fixture(); data.claims = [];
  invalid(data, /requires at least one claim/);
  for (const claims of [null, [null], [{}], ['claim']]) {
    const malformed = fixture(); malformed.claims = claims;
    assert.doesNotThrow(() => validateCoordination(malformed));
    assert.ok(validateCoordination(malformed).length);
  }
  data.tasks[0].status = 'ready_for_review'; data.tasks[0].evidence = ['docs/history.md'];
  assert.deepEqual(validateCoordination(data), []);
});

test('in-progress work cannot start before every direct dependency is done', () => {
  const data = fixture();
  data.tasks.push({...structuredClone(data.tasks[0]), id: 'prerequisite', status: 'blocked', evidence: ['docs/history.md']});
  data.tasks[0].dependsOn = ['prerequisite'];
  for (const status of ['blocked', 'queued', 'deferred', 'ready_for_review']) {
    data.tasks[1].status = status; invalid(data, /requires completed direct dependencies/);
  }
  data.tasks[1].status = 'done'; assert.deepEqual(validateCoordination(data), []);
  data.tasks[1].status = 'blocked'; data.tasks[0].status = 'ready_for_review';
  data.tasks[0].evidence = ['docs/history.md']; data.claims = [];
  assert.deepEqual(validateCoordination(data), []);
});

test('in-progress work requires resolved associated blockers while review may wait on a freeze', () => {
  const data = fixture(); data.tasks[0].blockers = ['access'];
  invalid(data, /requires resolved blockers/);
  data.blockers[0].status = 'resolved'; assert.deepEqual(validateCoordination(data), []);
  data.blockers[0].status = 'blocked'; data.tasks[0].status = 'ready_for_review';
  data.tasks[0].evidence = ['docs/history.md']; data.claims = [];
  assert.deepEqual(validateCoordination(data), []);
});
