import test from 'node:test';
import assert from 'node:assert/strict';
import {m4PreparationMatches, m4PreparationDigest, unitReportDigest, M4_PREPARATION_CHECKS} from './status.mjs';
import {ensureM4Commit} from './m4-source.mjs';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const current = {commit: 'a'.repeat(40), sourceDigest: 'b'.repeat(64)};
function fixture() {
  const paths = ['packages/plugin-host/src/runtime.test.ts', 'plugins/ideal-spring/src/model.test.ts', 'plugins/ideal-spring/src/handler.test.ts', 'packages/core/src/lab.test.ts', 'plugins/poiseuille/src/model.test.ts'];
  const unit = {success: true, numTotalTests: 5, numPassedTests: 5, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0,
    numTotalTestSuites: 5, numPassedTestSuites: 5, numFailedTestSuites: 0, numPendingTestSuites: 0,
    testResults: paths.map(name => ({name, status: 'passed', assertionResults: [{title: 'fixture assertion', status: 'passed', failureMessages: []}]}))};
  const preparation = {...current, schemaVersion: '1.0.0', kind: 'ardesia-m4-preparation', acceptanceEvidence: false, passed: true,
    plugin: {id: 'ardesia.poiseuille', version: '1.0.0', bundleDigest: 'c'.repeat(64), sourceRevision: 'd'.repeat(40)},
    consumer: {consumer: 'public-Host-Core-integration-fixture', storage: 'existing-Core-MemoryStorage-test-adapter', checks: [...M4_PREPARATION_CHECKS],
      workersStarted: 4, liveWorkers: 0, browser: 'NOT_RUN', postgres: 'NOT_RUN', humanReview: 'PENDING'},
    reuse: {baseSha: 'c4d38a612a73bc28df434c2d36d36025cf1b1adc', sdkVersion: '1.0.0', coreUnchanged: true, hostUnchanged: true,
      sdkUnchanged: true, persistenceUnchanged: true, generatedWorkerBytes: 200000,
      changedPaths: ['plugins/poiseuille/src/model.ts'], measuredDelta: [{path: 'plugins/poiseuille/src/model.ts', addedLines: 20, removedLines: 0}]}};
  const verification = {...current, passed: true, unitReportDigest: unitReportDigest(unit), m4PreparationDigest: m4PreparationDigest(preparation),
    checks: ['config-source','types','boundaries','release-evidence','unit','signed-plugin','build','bundle-budget'].map(name => ({name, passed: true, exitCode: 0}))};
  return {preparation, unit, verification};
}
test('M4 preparation requires final-source Verify, bound unit and consumer bytes', () => {
  assert.equal(m4PreparationMatches(fixture(), current), true);
  for (const mutate of [e => {e.preparation.commit = 'e'.repeat(40);}, e => {e.preparation.sourceDigest = 'f'.repeat(64);},
    e => {e.verification.passed = false;}, e => {delete e.verification.m4PreparationDigest;}, e => {e.unit.success = false;},
    e => {e.preparation.consumer.checks.pop();}]) {const e = fixture(); mutate(e); assert.equal(m4PreparationMatches(e, current), false);}
});
test('M4 rejects missing checks, second domains/stores, skipped tests and asserted acceptance even with recomputed digest', () => {
  for (const mutate of [e => {e.preparation.acceptanceEvidence = true;}, e => {e.preparation.plugin.id = 'ardesia.ideal-spring';},
    e => {e.preparation.consumer.storage = 'second-store';}, e => {e.preparation.consumer.liveWorkers = 1;},
    e => {e.preparation.consumer.checks[0] = e.preparation.consumer.checks[1];}, e => {e.preparation.consumer.browser = 'PASS';},
    e => {e.preparation.reuse.coreUnchanged = false;}, e => {e.preparation.reuse.changedPaths[0] = 'packages/core/src/index.ts';},
    e => {e.preparation.reuse.measuredDelta[0].addedLines = -1;}, e => {e.preparation.reuse.baseSha = 'e'.repeat(40);},
    e => {e.unit.numPendingTests = 1;}, e => {e.unit.testResults[4].name = 'plugins/other/src/model.test.ts';}]) {
    const e = fixture(); mutate(e); e.verification.m4PreparationDigest = m4PreparationDigest(e.preparation); e.verification.unitReportDigest = unitReportDigest(e.unit);
    assert.equal(m4PreparationMatches(e, current), false);
  }
  for (const value of [null, {}, {preparation: null}]) assert.equal(m4PreparationMatches(value ?? {}, current), false);
});

test('M4 shallow head plus scientific parent still needs the exact assigned base for a reuse diff', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ardesia-m4-shallow-'));
  const origin = join(dir, 'origin'), checkout = join(dir, 'checkout');
  const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: 'pipe'}).trim();
  try {
    mkdirSync(origin); git(origin, 'init', '-b', 'main');
    const commit = value => {writeFileSync(join(origin, 'fixture.txt'), value); git(origin, 'add', 'fixture.txt'); git(origin, '-c', 'user.name=M4 Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', value); return git(origin, 'rev-parse', 'HEAD');};
    const base = commit('assigned base'), science = commit('scientific source'), head = commit('candidate head');
    git(dir, 'clone', '--depth=1', pathToFileURL(origin).href, checkout);
    ensureM4Commit(science, checkout);
    assert.equal(git(checkout, 'rev-parse', 'HEAD'), head);
    assert.notEqual(spawnSync('git', ['diff', '--name-only', base, head], {cwd: checkout, stdio: 'pipe'}).status, 0);
    ensureM4Commit(base, checkout);
    assert.equal(git(checkout, 'diff', '--name-only', base, head), 'fixture.txt');
    assert.throws(() => ensureM4Commit('main', checkout), /immutable/);
  } finally {rmSync(dir, {recursive: true, force: true});}
});
