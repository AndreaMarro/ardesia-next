import test from 'node:test';
import assert from 'node:assert/strict';
import {m4PreparationMatches, m4PreparationDigest, unitReportDigest, M4_PREPARATION_CHECKS,
  m4LocalConsumerMatches, m4ConsumerEvidenceMatches, M4_REQUIRED_FLOWS, M4_REMOTE_CHECKS, M1_REQUIRED_FLOWS, M2_REQUIRED_FLOWS} from './status.mjs';
import {M3_REQUIRED_UNIT_FILES, M3_REQUIRED_FLOWS, m3ReportDigest} from './m3-evidence.mjs';
import {ensureM4Commit} from './m4-source.mjs';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, readFileSync} from 'node:fs';
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

// Synthetic contract fixtures, never real release or human acceptance evidence.
function consumerFixture() {
  const e = fixture();
  const pgTitle = 'M4 Poiseuille PostgreSQL preserves exact revisions and private student state; rejects invalid writes and revocation';
  for (const name of M3_REQUIRED_UNIT_FILES) e.unit.testResults.push({name, status: 'passed', assertionResults: [{
    title: name.includes('server.integration') ? pgTitle : 'executed assertion', status: 'passed', failureMessages: [],
    fullName: 'M3 real PostgreSQL authority (requires M3_TEST_DATABASE_URL) ' + pgTitle}]});
  for (const key of ['numTotalTests', 'numPassedTests', 'numTotalTestSuites', 'numPassedTestSuites']) e.unit[key] = e.unit.testResults.length;
  e.preparation.plugin.bundleDigest = 'bd7eced69753424c7da3076783917d4fb235bd90d975dbbce2fe71371b06e00b';
  const paths = ['apps/web/src/plugins/first-party.ts', 'packages/plugin-host/src/first-party-trust.json',
    'packages/server/src/server.integration.test.ts', 'docs/original.zip'];
  Object.assign(e.preparation.reuse, {hostUnchanged: false, persistenceUnchanged: false, changedPaths: paths,
    measuredDelta: paths.map(path => ({path, addedLines: path.endsWith('.zip') ? null : 1, removedLines: path.endsWith('.zip') ? null : 0}))});
  e.verification.unitReportDigest = unitReportDigest(e.unit); e.verification.m4PreparationDigest = m4PreparationDigest(e.preparation);
  const all = [...M1_REQUIRED_FLOWS, ...M2_REQUIRED_FLOWS, ...M3_REQUIRED_FLOWS, ...M4_REQUIRED_FLOWS];
  const stats = {expected: all.length, skipped: 0, unexpected: 0, flaky: 0};
  e.playwright = {stats, errors: [], suites: [{specs: all.map(flow => {
    const [projectName, title] = flow.split('::');return {title, file: title.startsWith('[M4]') ? 'e2e/poiseuille.spec.ts'
      : title.startsWith('[M3]') ? 'e2e/remote-continuity.spec.ts' : 'e2e/baseline.spec.ts', ok: true,
      tests: [{projectName, status: 'expected', results: [{status: 'passed', retry: 0}]}]};
  })}]};
  e.browser = {...current, passed: true, m1Passed: true, m2Passed: true, m3Passed: true,
    m1Flows: [...M1_REQUIRED_FLOWS], m2Flows: [...M2_REQUIRED_FLOWS], m3Flows: [...M3_REQUIRED_FLOWS], stats, reportDigest: m3ReportDigest(e.playwright)};
  e.budget = {...current, metric: 'all-javascript-gzip-bytes', limit: 245760, bytes: 229901, passed: true,
    files: [{file: 'assets/application.js', gzipBytes: 100000, initial: true},
      {file: 'plugins/ideal-spring/1.0.0/plugin.js', gzipBytes: 42000, initial: false},
      {file: 'plugins/poiseuille/1.0.0/plugin.js', gzipBytes: 43000, initial: false},
      {file: 'plugins/shared/' + 'c'.repeat(64) + '.js', gzipBytes: 44901, initial: false}]};
  e.transport={kind:'lossless-worker-byte-transport',prefixBytes:176331,afterGzipBytes:129901,container:{path:'/plugins/shared/'+'c'.repeat(64)+'.js',sha256:'c'.repeat(64),bytes:191934},workers:[{path:'/plugins/ideal-spring/1.0.0/plugin.js',originalSha256:'713b10ce53337e5bb03f0da86afec8a1266a8229115e9d1f571cf49766814148',originalBytes:184120},{path:'/plugins/poiseuille/1.0.0/plugin.js',originalSha256:e.preparation.plugin.bundleDigest,originalBytes:184145}]};
  const url = 'https://ardesia-next-staging.vercel.app', id = 'dpl_M4Contract';
  e.release = {...current, repository: 'AndreaMarro/ardesia-next', visibility: 'private', projectId: 'prj_GGKjCPG4cdgaQDQQMJoFvsy2ffSd',
    status: 'READY', target: 'preview', providerTarget: null, deploymentId: id, url, observedAt: '2026-11-03T16:54:11Z',
    ci: {headSha: current.commit, conclusion: 'success', url: 'https://github.com/AndreaMarro/ardesia-next/actions/runs/123'},
    buildInfo: {...current}, protection: {deploymentType: 'all', anonymousStatus: 401}};
  const objects = ['spring', 'pressure', 'flow'].map((name, index) => ({objectId: name, instanceId: name + '-instance',
    pluginId: index ? 'ardesia.poiseuille' : 'ardesia.ideal-spring', bundleDigest: index ? e.preparation.plugin.bundleDigest : '713b10ce53337e5bb03f0da86afec8a1266a8229115e9d1f571cf49766814148',
    revision: 2, status: 'draft', state: {schemaVersion: '1.0.0', value: index ? {radiusM: .001, lengthM: 1, viscosityPaS: .0015, densityKgPerM3: 1000,
      ...(index === 1 ? {pressureDropPa: 800} : {flowRateM3PerS: Math.PI * 1e-7})} : {massKg: 2}}}));
  const m1Browser = {...current, url, passed: true, objectId: 'spring', instanceId: 'spring-instance', savedRevision: 2,
    reopenedRevision: 2, statePreserved: true, observedAt: '2026-11-03T16:53:35Z'};
  e.remoteConsumer = {...current, kind: 'ardesia-m4-protected-preview-smoke', passed: true, url, startedAt: '2026-11-03T16:52:00Z',
    completedAt: '2026-11-03T16:53:35Z', pageErrors: 0, buildInfoBefore: {...current}, buildInfoAfter: {...current},
    checks: M4_REMOTE_CHECKS.map(name => ({name, passed: true})), savedObjects: objects, m1Browser,
    accounts: {teacher: '1'.repeat(64), studentA: '2'.repeat(64), studentB: '3'.repeat(64), freshStudentSession: true},
    logout: {ackStatus: 200, sessionAfter: 401, codeAfter: 'UNAUTHENTICATED'}};
  e.platform = {observedAt: '2026-11-03T16:54:08Z', alias: {alias: new URL(url).hostname, projectId: e.release.projectId, deploymentId: id},
    project: {id: e.release.projectId, ssoProtection: {enabled: true, deploymentType: 'all'}},
    deployment: {id, project: {id: e.release.projectId}, readyState: 'READY', target: null,
      meta: {githubCommitSha: current.commit, githubRepo: 'ardesia-next', githubOrg: 'AndreaMarro'}}};
  return e;
}
test('M4 recognizes the real consumer separately from isolated preparation and changed source', () => {
  const e = consumerFixture();
  assert.equal(m4PreparationMatches(e, current), false);
  assert.equal(m4LocalConsumerMatches(e, current), true);
  assert.equal(m4ConsumerEvidenceMatches(e, current), true);
  assert.equal(m4ConsumerEvidenceMatches(e, {...current, sourceDigest: 'e'.repeat(64)}), false);
  assert.equal(m4ConsumerEvidenceMatches(fixture(), current), false);
});
test('M4 requires both browser controls, executed PostgreSQL, bound reports, runtime reuse and integral budget', () => {
  for (const mutate of [e => {e.preparation.plugin.bundleDigest = 'e'.repeat(64);}, e => {e.budget.limit++;},
    e => {e.budget.files.pop();}, e => {e.budget.files.pop();e.budget.bytes=e.budget.files.reduce((sum,f)=>sum+f.gzipBytes,0);}, e => {e.budget.commit = 'e'.repeat(40);}, e => {e.unit.numPendingTests++;},
    e => {e.unit.testResults.at(-1).assertionResults[0].fullName = 'memory fixture';},
    e => {e.preparation.reuse.changedPaths[0] = 'packages/core/src/index.ts';},
    e => {e.preparation.reuse.changedPaths[0] = 'packages/plugin-host/src/host.ts';},
    e => {e.preparation.reuse.changedPaths[0] = 'packages/server/src/store.ts';},
    e => {e.preparation.reuse.measuredDelta[0].addedLines = -1;},
    e => {e.playwright.suites[0].specs.at(-1).tests[0].results[0].retry = 1;},
    e => {e.playwright.suites[0].specs.at(-1).file = 'e2e/fixture.spec.ts';},
    e => {e.playwright.suites[0].specs.at(-1).title = '[M4] unrelated';}]) {
    const e = consumerFixture();mutate(e);e.verification.unitReportDigest = unitReportDigest(e.unit);
    e.verification.m4PreparationDigest = m4PreparationDigest(e.preparation);e.browser.reportDigest = m3ReportDigest(e.playwright);
    assert.equal(m4LocalConsumerMatches(e, current), false);
  }
});
test('M4 remote refuses different builds/deployments, open SSO, missing observations and non-DRAFT state', () => {
  for (const mutate of [e => {e.remoteConsumer.sourceDigest = 'e'.repeat(64);}, e => {e.release.ci.headSha = 'e'.repeat(40);},
    e => {e.remoteConsumer.buildInfoAfter.commit = 'e'.repeat(40);}, e => {e.remoteConsumer.checks.pop();},
    e => {e.remoteConsumer.checks[1] = e.remoteConsumer.checks[0];}, e => {e.remoteConsumer.checks[2].passed = false;},
    e => {e.remoteConsumer.accounts.studentB = e.remoteConsumer.accounts.studentA;}, e => {e.remoteConsumer.logout.sessionAfter = 200;},
    e => {e.remoteConsumer.savedObjects[0].bundleDigest='a'.repeat(64);},e => {e.remoteConsumer.savedObjects[2].state.value={flowRateM3PerS:0};}, e => {e.remoteConsumer.savedObjects[2].status = 'approved';}, e => {e.remoteConsumer.savedObjects[2].objectId = 'pressure';},
    e => {e.remoteConsumer.savedObjects[2].state.value.pressureDropPa = 800;}, e => {e.remoteConsumer.m1Browser.reopenedRevision = 3;},
    e => {e.platform.alias.deploymentId = 'dpl_Different';}, e => {e.platform.deployment.target = 'production';},
    e => {e.platform.project.ssoProtection.deploymentType = 'preview';}, e => {e.release.protection.anonymousStatus = 200;},
    e => {e.platform.observedAt = '2026-11-03T16:50:00Z';}, e => {delete e.platform;}, e => {delete e.remoteConsumer;}]) {
    const e = consumerFixture();mutate(e);assert.equal(m4ConsumerEvidenceMatches(e, current), false);
  }
});
test('status reports an observed older consumer without certifying current source or human acceptance', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ardesia-m4-status-'));const e = consumerFixture();
  try {
    mkdirSync(join(dir, 'artifacts'));cpSync('operations/baselines/m3', join(dir, 'operations/baselines/m3'), {recursive: true});
    for (const [name, report] of Object.entries({verification: e.verification, unit: e.unit, 'm4-preparation': e.preparation,
      'browser-evidence': e.browser, e2e: e.playwright, budget: e.budget, 'bundle-transport':e.transport, 'release-evidence': e.release,
      'm4-protected-preview-smoke': e.remoteConsumer, 'platform-postflight': e.platform})) writeFileSync(join(dir, 'artifacts', name + '.json'), JSON.stringify(report));
    execFileSync(process.execPath, [join(process.cwd(), 'tools/status.mjs')], {cwd: dir, env: {...process.env, ARDESIA_COMMIT_SHA: 'e'.repeat(40)}});
    const s = JSON.parse(readFileSync(join(dir, 'artifacts/status.json')));
    assert.equal(s.m4Evidence.observedConsumer.technical, 'PASS');assert.equal(s.m4Evidence.observedConsumer.commit, current.commit);
    assert.equal(s.m4Evidence.observedConsumer.matchesCurrentSource, false);assert.equal(s.m4Evidence.webAndPostgresConsumer, 'NOT_VERIFIED_FOR_CURRENT_SOURCE');
    assert.equal(s.m4Evidence.humanScientificEditorialReview, 'PENDING');assert.equal(s.productAcceptance, 'NOT_COMPLETE');assert.notEqual(s.M4, 'ACCEPTED');
  } finally {rmSync(dir, {recursive: true, force: true});}
});
