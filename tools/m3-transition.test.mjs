import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readM3Baseline, m3BaselineMatches, M3_BASELINE_REPORTS} from './status.mjs';
import {validateCoordination} from './check-operations.mjs';

const original = () => readM3Baseline(path => readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const modifyReport = (baseline, name, mutate) => {
  const report = JSON.parse(baseline.reports[name]); mutate(report);
  baseline.reports[name] = JSON.stringify(report);
  baseline.manifest.reports[name] = createHash('sha256').update(baseline.reports[name]).digest('hex');
};

test('historical M3 requires every original report and rejects changed bytes and identity', () => {
  assert.equal(m3BaselineMatches(original()), true);
  for (const name of M3_BASELINE_REPORTS) {
    const absent = original(); delete absent.reports[name];
    assert.equal(m3BaselineMatches(absent), false, 'missing ' + name);
    const changed = original(); changed.reports[name] += '\n';
    assert.equal(m3BaselineMatches(changed), false, 'changed ' + name);
  }
  for (const mutate of [
    b => {b.manifest.source.commit = 'f'.repeat(40);},
    b => {b.manifest.source.sourceDigest = 'f'.repeat(64);},
    b => {b.manifest.verify.url = 'https://github.com/AndreaMarro/ardesia-next/actions/runs/1';},
    b => {modifyReport(b, 'operator.json', r => {r.isolation.sourceReadOnly = false;});},
    b => {modifyReport(b, 'operator.json', r => {r.isolation.restoreTargetInitiallyEmpty = false;});},
    b => {modifyReport(b, 'm3-remote-evidence.json', r => {delete r.checks.idor;});},
    b => {modifyReport(b, 'browser-evidence.json', r => {r.stats.skipped = 1;});},
    b => {modifyReport(b, 'platform-after.json', r => {r.deploymentId = 'dpl_Another';});},
    b => {modifyReport(b, 'release-evidence.json', r => {r.protection.anonymousStatus = 200;});},
    b => {modifyReport(b, 'unit.json', r => {r.numFailedTests = 1;});},
  ]) {const b = original(); mutate(b); assert.equal(m3BaselineMatches(b), false);}
  assert.equal(m3BaselineMatches({manifest: {M3: 'ACCEPTED'}, reports: {}}), false);
  assert.equal(m3BaselineMatches(null), false);
});

test('freeze progression needs original evidence and cannot authorize production, spending or jobs', () => {
  const q = JSON.parse(readFileSync(new URL('../operations/coordination.json', import.meta.url), 'utf8'));
  q.policy.mainFrozen = false; q.policy.stagingFrozen = false;
  q.tasks.find(t => t.id === 'M3-REMOTE').status = 'done';
  q.blockers.find(b => b.id === 'B-FREEZE').status = 'resolved';
  const reader = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  assert.deepEqual(validateCoordination(q, {readBaseline: reader}), []);
  assert.ok(validateCoordination(q, {readBaseline: () => {throw new Error('Unavailable original');}}).some(e => /policy/.test(e)));
  for (const key of ['productionAuthorized', 'newSpendAuthorized', 'agentLaunchedCodexJobsAuthorized']) {
    const changed = structuredClone(q); changed.policy[key] = true;
    assert.ok(validateCoordination(changed, {readBaseline: reader}).some(e => e.startsWith('policy.' + key)));
  }
  const missing = structuredClone(q); missing.tasks.find(t => t.id === 'M3-REMOTE').status = 'blocked';
  assert.ok(validateCoordination(missing, {readBaseline: reader}).some(e => /policy/.test(e)));
  const split = structuredClone(q); split.policy.stagingFrozen = true;
  assert.ok(validateCoordination(split, {readBaseline: reader}).some(e => /policy/.test(e)));
});

test('status advances from the complete historical M3 without accepting a new candidate', () => {
  const root = mkdtempSync(join(tmpdir(), 'ardesia-m3-history-'));
  try {
    mkdirSync(join(root, 'operations/baselines'), {recursive: true});
    cpSync(new URL('../operations/baselines/m3', import.meta.url), join(root, 'operations/baselines/m3'), {recursive: true});
    const output = execFileSync(process.execPath, [fileURLToPath(new URL('./status.mjs', import.meta.url))], {
      cwd: root, encoding: 'utf8', env: {...process.env, ARDESIA_COMMIT_SHA: 'e'.repeat(40)}
    });
    const state = JSON.parse(output);
    assert.equal(state.milestone, 'M4');
    assert.equal(state.M3, 'AWAITING_COMPLETE_EVIDENCE');
    assert.equal(state.verification, 'NOT_VERIFIED_FOR_CURRENT_SOURCE');
    assert.equal(state.acceptedBaselines.find(b => b.milestones.includes('M3')).commit, 'd0aa2014b131335d5c278543cea35098dcefdfd3');
    assert.equal(state.productAcceptance, 'NOT_COMPLETE');
    assert.deepEqual(JSON.parse(readFileSync(join(root, 'artifacts/status.json'), 'utf8')), state);
  } finally {rmSync(root, {recursive: true, force: true});}
});
