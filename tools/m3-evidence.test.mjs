import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assembleM3Acceptance, acceptanceConfiguration, publicBrowserObservation} from './m3-acceptance.mjs';
import {m3LocalEvidenceMatches, m3RemoteEvidenceMatches, m3ReportDigest, M3_REQUIRED_FLOWS, M3_REQUIRED_UNIT_FILES, M3_REMOTE_CHECKS} from './m3-evidence.mjs';

// Contract fixtures only. These are never written to operations/ or accepted release artifacts.
const current = {commit: 'a'.repeat(40), sourceDigest: 'b'.repeat(64)};
const url = 'https://ardesia-next-contract-test.vercel.app';
const hash = char => char.repeat(64);
const at = minute => `2026-10-29T12:${String(minute).padStart(2, '0')}:00.000Z`;
function localFixture() {
  const unit = {success: true, numTotalTests: 3, numPassedTests: 3, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0,
    numTotalTestSuites: 3, numPassedTestSuites: 3, numFailedTestSuites: 0, numPendingTestSuites: 0,
    testResults: M3_REQUIRED_UNIT_FILES.map(name => ({name: '/ci/' + name, status: 'passed',
      assertionResults: [{title: 'executed contract assertion', status: 'passed', failureMessages: []}]}))};
  const m1Flows = Array.from({length: 14}, (_, index) => `desktop-chromium::[M1] baseline ${index}`);
  const m2Flows = Array.from({length: 24}, (_, index) => `desktop-chromium::[M2] baseline ${index}`);
  const allFlows = [...m1Flows, ...m2Flows, ...M3_REQUIRED_FLOWS];
  const stats = {expected: allFlows.length, skipped: 0, unexpected: 0, flaky: 0};
  const playwright = {stats: {...stats}, errors: [], suites: [{specs: allFlows.map(flow => {
    const [projectName, title] = flow.split('::');
    return {title, file: title.startsWith('[M3]') ? 'e2e/remote-continuity.spec.ts' : 'e2e/baseline.spec.ts', ok: true,
      tests: [{projectName, status: 'expected', results: [{status: 'passed'}]}]};
  })}]};
  return {
    verification: {...current, passed: true, unitReportDigest: m3ReportDigest(unit),
      checks: ['config-source', 'types', 'boundaries', 'release-evidence', 'unit', 'signed-plugin', 'build', 'bundle-budget'].map(name => ({name, passed: true, exitCode: 0}))},
    unit, playwright,
    browser: {...current, passed: true, m1Passed: true, m2Passed: true, m3Passed: true, m1Flows, m2Flows,
      m3Flows: [...M3_REQUIRED_FLOWS], stats, reportDigest: m3ReportDigest(playwright)},
  };
}
function remoteReleaseFixture(visibility = 'private') {
  const evidence = localFixture();
  const accounts = {teacher: {idHash: hash('1'), role: 'teacher'}, studentA: {idHash: hash('2'), role: 'student'}, studentB: {idHash: hash('3'), role: 'student'}};
  const session = (account, digit, minute) => ({accountIdHash: accounts[account].idHash, sessionIdHash: hash(digit), contextId: 'context-' + digit, authenticatedAt: at(minute)});
  const state = {workspaceId: 'workspace', documentId: 'lesson', objectId: 'lab-object', instanceId: 'spring-instance', objectRevision: 1, workRevision: 2, labRevision: 1, stateDigest: hash('9')};
  const common = () => ({passed: true, artifactDigest: hash('a'), observedAt: at(20)});
  const remote = {...current, schemaVersion: 1, kind: 'ardesia-m3-remote-browser', runner: 'playwright', passed: true,
    url, deploymentId: 'dpl_ContractFixture', observedAt: at(30),
    database: {authority: 'postgres', configured: true, remote: true, hostname: 'db.dedicated.supabase.co', resourceIdHash: hash('b')},
    stats: {passed: M3_REMOTE_CHECKS.length, failed: 0, skipped: 0, flaky: 0}, accounts,
    sessions: {teacher: session('teacher', '4', 1), studentA1: {...session('studentA', '5', 2), endedAt: at(5)},
      studentA2: session('studentA', '6', 6), studentB: session('studentB', '7', 3)},
    continuity: {createdByAccountHash: accounts.teacher.idHash, assignedToAccountHash: accounts.studentA.idHash,
      saved: {...state, session: 'studentA1', observedAt: at(4)}, reopened: {...state, session: 'studentA2', observedAt: at(7)}},
    checks: {
      idor: {...common(), session: 'studentB', resourceOwnerHash: accounts.studentA.idHash, responseStatus: 404, code: 'NOT_FOUND'},
      revocation: {...common(), session: 'studentA2', responseStatus: 404, code: 'NOT_FOUND', retryStatus: 404, beforeRevision: 1, afterRevision: 2},
      consentRevocation: {...common(), responseStatus: 422, code: 'PLUGIN_CONSENT_REQUIRED'},
      conflict: {...common(), responseStatus: 409, code: 'REVISION_CONFLICT', attemptedRevision: 1, winnerRevision: 2, persistedRevision: 2},
      lostResponse: {...common(), firstResponseDelivered: false, receiptDigest: hash('c'), retriedReceiptDigest: hash('c'), beforeRevision: 1, afterFirstRevision: 2, afterRetryRevision: 2},
      logout: {...common(), session: 'studentA1', responseStatus: 200, afterStatus: 401, code: 'UNAUTHENTICATED'},
      expired: {...common(), responseStatus: 401, code: 'UNAUTHENTICATED'},
      outage: {...common(), failedStatus: 503, recoveredStatus: 200, localFallbackUsed: false, beforeStateDigest: hash('d'), afterStateDigest: hash('d')},
      backupRestore: {...common(), sourceDatabaseHash: hash('b'), restoreDatabaseHash: hash('e'), syntheticOnly: true, recordCount: 8, beforeDigest: hash('f'), restoredDigest: hash('f')},
      import: {...common(), versions: [1, 2, 3].map(version => ({version, sourceBytesDigest: hash('a'), archivedBytesDigest: hash('a'),
        beforeReceiptsDigest: hash('b'), afterReceiptsDigest: hash('b'), beforeRevision: 2, afterRevision: 2, consentReset: true, duplicateStatus: 409, ownershipMismatchStatus: 409}))},
      accountSwitch: {...common(), responseStatus: 409, code: 'SESSION_CHANGED', fromAccountHash: accounts.studentA.idHash, currentAccountHash: accounts.studentB.idHash, beforeRevision: 2, afterRevision: 2},
      teacherEvidence: {...common(), accountIdHash: accounts.teacher.idHash, privateCount: 0, sharedCount: 1, afterRevokeCount: 0},
    },
  };
  const release = {...current, repository: 'AndreaMarro/ardesia-next', visibility,
    ...(visibility === 'public' ? {sourcePublication: {kind: 'explicit-owner-instruction', owner: 'AndreaMarro',
      repository: 'AndreaMarro/ardesia-next', visibility: 'public', scope: 'source-only', recordedAt: at(0)}} : {}),
    status: 'READY', target: 'preview', providerTarget: 'staging',
    projectId: 'prj_GGKjCPG4cdgaQDQQMJoFvsy2ffSd', deploymentId: remote.deploymentId, url, observedAt: at(30),
    ci: {headSha: current.commit, conclusion: 'success', url: 'https://github.com/AndreaMarro/ardesia-next/actions/runs/123'},
    buildInfo: {...current}, protection: {deploymentType: 'all', anonymousStatus: 401}, m3ReportDigest: m3ReportDigest(remote)};
  return {...evidence, remote, release};
}
const remoteFixture = () => remoteReleaseFixture();
const bindRemote = evidence => {evidence.release.m3ReportDigest = m3ReportDigest(evidence.remote); return evidence;};

// Contract fixtures only; no report from these tests is saved as remote evidence.
function producerFixture() {
  const evidence = remoteReleaseFixture('public');
  const remote = evidence.remote;
  const platform = {commit: current.commit, sourceDigest: current.sourceDigest, deploymentId: remote.deploymentId,
    projectId: evidence.release.projectId, url: remote.url, status: 'READY', observedAt: at(30), databaseResourceIdHash: remote.database.resourceIdHash};
  const preflight = {passed: true, origin: remote.url, expected: current, observedBuild: current,
    startedAt: at(0), completedAt: at(0), buildIdentityMatched: true};
  const postflight = {...preflight, startedAt: at(29), completedAt: at(30)};
  const browser = {commit: current.commit, sourceDigest: current.sourceDigest, url: remote.url,
    deploymentId: remote.deploymentId, startedAt: at(1), completedAt: at(25),
    accounts: remote.accounts, sessions: remote.sessions, continuity: remote.continuity, checks: {...remote.checks}};
  const operatorChecks = {};
  for (const name of ['expired', 'outage', 'backupRestore', 'import']) {
    operatorChecks[name] = {...browser.checks[name], observedAt: at(27)}; delete browser.checks[name];
  }
  const operator = {...platform, database: remote.database, startedAt: at(25), completedAt: at(28),
    isolation: {sourceReadOnly: true, restoreTargetInitiallyEmpty: true, sharedServiceInterrupted: false}, checks: operatorChecks};
  return structuredClone({current, evidence, platformBefore: {...platform, observedAt: at(0)}, platformAfter: platform, preflight, postflight, browser, operator});
}

test('acceptance producer binds twelve observed counterproofs to local evidence and unchanged deployment', () => {
  const result = assembleM3Acceptance(producerFixture());
  assert.equal(result.accepted, true);
  assert.equal(m3RemoteEvidenceMatches({...producerFixture().evidence, remote: result.remote, release: result.release}, current), true);
});

test('acceptance producer refuses partial, stale, secret-bearing or unsafe operator evidence', () => {
  for (const mutate of [
    p => {delete p.operator;}, p => {delete p.operator.checks.expired;},
    p => {p.platformAfter.deploymentId = 'dpl_Different';},
    p => {p.platformAfter.sourceDigest = hash('c');},
    p => {p.platformAfter.databaseResourceIdHash = hash('c');},
    p => {p.postflight.observedBuild.commit = 'c'.repeat(40);},
    p => {p.postflight.passed = false;}, p => {p.browser.startedAt = at(31);},
    p => {p.operator.isolation.restoreTargetInitiallyEmpty = false;},
    p => {p.operator.isolation.sourceReadOnly = false;},
    p => {p.operator.checks.backupRestore.restoreDatabaseHash = p.operator.database.resourceIdHash;},
    p => {p.browser.checks.idor.token = 'sensitive';},
    p => {p.browser.accounts.studentB.idHash = p.browser.accounts.studentA.idHash;},
    p => {p.evidence.verification.passed = false;},
  ]) {const input = producerFixture(); mutate(input); assert.equal(assembleM3Acceptance(input).accepted, false);}
});

test('acceptance credentials and diagnostic guards run before browser or database access', () => {
  const env = {ARDESIA_E2E_MODE: 'remote', ARDESIA_E2E_BASE_URL: 'https://ardesia-next-staging.vercel.app',
    VERCEL_OIDC_TOKEN: 'contract-only-oidc-placeholder'};
  for (const name of ['TEACHER', 'STUDENT_A', 'STUDENT_B']) {
    env[`ARDESIA_E2E_${name}_USERNAME`] = 'qa-' + name.toLowerCase();
    env[`ARDESIA_E2E_${name}_PASSWORD`] = 'contract-only-password-placeholder';
  }
  assert.equal(acceptanceConfiguration(env, current).mode, 'remote');
  for (const mutate of [
    e => {delete e.VERCEL_OIDC_TOKEN;}, e => {delete e.ARDESIA_E2E_STUDENT_A_PASSWORD;},
    e => {e.ARDESIA_E2E_STUDENT_B_USERNAME = e.ARDESIA_E2E_STUDENT_A_USERNAME;},
    e => {e.ARDESIA_E2E_BASE_URL = 'https://unrelated.example';},
    e => {e.NODE_OPTIONS = '--inspect';}, e => {e.DEBUG = 'pw:api';}, e => {e.PWDEBUG = '1';},
  ]) {
    const candidate = {...env}; mutate(candidate);
    assert.throws(() => acceptanceConfiguration(candidate, current), error => !error.message.includes('contract-only-password-placeholder'));
  }
});

test('persisted browser evidence contains pseudonyms and excludes operator account selectors and salt', () => {
  const input = {...producerFixture().browser, operatorScope: {accountIds: ['raw-synthetic-id'], nonce: 'private-run-salt'}};
  const report = publicBrowserObservation(input);
  assert.equal(JSON.stringify(report).includes('raw-synthetic-id'), false);
  assert.equal(JSON.stringify(report).includes('private-run-salt'), false);
  assert.equal(report.accounts.studentA.idHash, hash('2'));
  assert.equal(input.operatorScope.accountIds[0], 'raw-synthetic-id');
});

test('offline assembly consumes collected evidence without browser credentials or new remote writes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ardesia-acceptance-contract-'));
  try {
    const fixture = producerFixture(), digest = createHash('sha256').digest('hex');
    const replace = value => {
      if (Array.isArray(value)) return value.map(replace);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, value]) =>
        [key, key === 'sourceDigest' ? digest : replace(value)]));
      return value === url ? 'https://ardesia-next-staging.vercel.app' : value;
    };
    const input = replace(fixture), artifacts = join(dir, 'artifacts'), collection = join(artifacts, 'm3-acceptance');
    mkdirSync(collection, {recursive: true});
    const write = (path, value) => writeFileSync(path, JSON.stringify(value));
    for (const [name, value] of Object.entries({verification: input.evidence.verification, unit: input.evidence.unit,
      'browser-evidence': input.evidence.browser, e2e: input.evidence.playwright, 'release-evidence': input.evidence.release})) write(join(artifacts, name + '.json'), value);
    for (const [name, value] of Object.entries({'platform-before': input.platformBefore, 'platform-after': input.platformAfter,
      preflight: input.preflight, postflight: input.postflight, browser: input.browser, operator: input.operator})) write(join(collection, name + '.json'), value);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./m3-acceptance.mjs', import.meta.url)), '--assemble'],
      {cwd: dir, encoding: 'utf8', env: {PATH: process.env.PATH, ARDESIA_COMMIT_SHA: current.commit}});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(readFileSync(join(collection, 'result.json'), 'utf8')).accepted, true);
    assert.equal(JSON.parse(readFileSync(join(collection, 'candidate.json'), 'utf8')).remote.commit, current.commit);
    // All files here are ephemeral contract fixtures, never operations/ or release inputs of this checkout.
  } finally {rmSync(dir, {recursive: true, force: true});}
});

test('M3 public source needs an observed owner instruction and cannot substitute it for remote evidence', () => {
  const absent = remoteReleaseFixture('public'); delete absent.release.sourcePublication;
  assert.equal(m3RemoteEvidenceMatches(absent, current), false);
  for (const mutate of [
    e => {e.release.sourcePublication = null;},
    e => {e.release.sourcePublication.repository = 'AndreaMarro/ardesia';},
    e => {e.release.sourcePublication.scope = 'application';},
    e => {e.release.sourcePublication.recordedAt = at(31);},
    e => {e.release.sourcePublication.extra = true;},
    e => {delete e.remote;}, e => {delete e.release.m3ReportDigest;},
  ]) {
    const evidence = remoteReleaseFixture('public'); mutate(evidence);
    assert.equal(m3RemoteEvidenceMatches(evidence, current), false);
  }
});

test('M3 local evidence passes independently; missing remote proof cannot become ACCEPTED', () => {
  assert.equal(M3_REQUIRED_FLOWS.length, 6);
  assert.equal(m3LocalEvidenceMatches(localFixture(), current), true);
  assert.equal(m3RemoteEvidenceMatches(localFixture(), current), false);
  assert.equal(m3RemoteEvidenceMatches(remoteFixture(), current), true);
  assert.equal(m3RemoteEvidenceMatches(remoteReleaseFixture('public'), current), true);
  for (const value of [null, true, 'PASS', {}, []]) assert.equal(m3LocalEvidenceMatches(value, current), false);
});

test('M3 verification, named test suites and report bytes must match the current source', () => {
  for (const mutate of [
    e => {e.verification.commit = 'c'.repeat(40);}, e => {e.verification.sourceDigest = hash('c');},
    e => {e.verification.passed = 'true';}, e => {e.verification.checks[0].exitCode = '0';},
    e => {e.verification.checks.pop();}, e => {e.verification.checks[0] = e.verification.checks[1];},
    e => {e.unit.success = 'true';}, e => {e.unit.numFailedTests = 1;}, e => {e.unit.numPendingTests = 1;},
    e => {e.unit.numTotalTests = 0; e.unit.numPassedTests = 0;}, e => {e.unit.testResults[0].assertionResults = [];},
    e => {e.unit.testResults[0].assertionResults[0].status = 'skipped';}, e => {e.unit.testResults[0].name = 'unrelated.test.ts';},
    e => {e.unit.testResults[0].assertionResults[0].title = 'different report';},
  ]) {const evidence = localFixture(); mutate(evidence); assert.equal(m3LocalEvidenceMatches(evidence, current), false);}
  for (const index of [0, 1, 2]) {
    const evidence = localFixture(); evidence.unit.testResults[index].name = 'other-' + index;
    evidence.verification.unitReportDigest = m3ReportDigest(evidence.unit);
    assert.equal(m3LocalEvidenceMatches(evidence, current), false);
  }
  assert.equal(m3ReportDigest({a: 1}), '015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862');
});

test('M3 browser summary cannot invent flows, ignore skips/flakes or substitute a different machine report', () => {
  for (const mutate of [
    e => {e.browser.m3Passed = 'true';}, e => {e.browser.m2Passed = false;}, e => {e.browser.m1Passed = false;},
    e => {e.browser.m3Flows.pop();}, e => {e.browser.stats.skipped = 1;}, e => {e.browser.stats.flaky = 1;},
    e => {e.playwright.suites[0].specs.at(-1).tests[0].results[0].status = 'failed';},
    e => {e.playwright.suites[0].specs.at(-1).file = 'another.spec.ts';},
    e => {e.playwright.suites[0].specs.at(-1).tests[0].results.push({status: 'passed'});},
    e => {e.playwright.suites[0].specs.at(-1).tests[0].status = 'skipped';},
    e => {e.playwright.errors.push({message: 'global browser failure'});},
  ]) {const evidence = localFixture(); mutate(evidence); evidence.browser.reportDigest = m3ReportDigest(evidence.playwright);
    assert.equal(m3LocalEvidenceMatches(evidence, current), false);}
  const stale = localFixture(); stale.playwright.stats.duration = 100;
  assert.equal(m3LocalEvidenceMatches(stale, current), false);
});

for (const visibility of ['private', 'public']) {
  const remoteFixture = () => remoteReleaseFixture(visibility);
  const testVisibility = (name, run) => test(`${visibility} source: ${name}`, run);

testVisibility('M3 remote requires protected non-loopback Vercel, exact deployment, CI SHA and report digest', () => {
  for (const mutate of [
    e => {e.remote.commit = 'c'.repeat(40);}, e => {e.release.ci.headSha = 'c'.repeat(40);},
    e => {e.release.buildInfo.sourceDigest = hash('c');}, e => {e.release.status = 'BUILDING';},
    e => {e.remote.url = 'http://localhost:4173'; e.release.url = e.remote.url;},
    e => {e.remote.url = 'https://127.0.0.1'; e.release.url = e.remote.url;},
    e => {e.remote.url = url + '.evil.example'; e.release.url = e.remote.url;},
    e => {e.remote.deploymentId = 'dpl_Another';}, e => {e.release.protection.anonymousStatus = 200;},
    e => {e.release.protection.deploymentType = 'preview';}, e => {delete e.release.protection;},
    e => {e.release.protection = {deploymentType: 'all', anonymousStatus: 302, anonymousLocation: 'https://vercel.com/sso-api?url=https%3A%2F%2Fanother.vercel.app'};},
    e => {e.release.providerTarget = 'production';}, e => {e.release.ci.url = 'https://github.com.evil.example/AndreaMarro/ardesia-next/actions/runs/123';},
    e => {e.remote.database.hostname = 'localhost';}, e => {e.remote.database.remote = 'true';},
    e => {e.remote.database.authority = 'memory';}, e => {e.remote.passed = 'true';}, e => {e.remote.stats.skipped = 1;},
  ]) {const evidence = remoteFixture(); mutate(evidence); bindRemote(evidence); assert.equal(m3RemoteEvidenceMatches(evidence, current), false);}
  const stale = remoteFixture(); stale.remote.observedAt = at(31);
  assert.equal(m3RemoteEvidenceMatches(stale, current), false);
  const redirect = remoteFixture(); redirect.release.protection = {deploymentType: 'all', anonymousStatus: 302, anonymousLocation: 'https://vercel.com/sso-api?url=' + encodeURIComponent(url)};
  assert.equal(m3RemoteEvidenceMatches(redirect, current), true);
});

testVisibility('M3 continuity needs three identities, distinct cookie jars/sessions and exact persisted IDs, revisions and state', () => {
  for (const mutate of [
    e => {e.remote.accounts.studentB.idHash = e.remote.accounts.studentA.idHash;},
    e => {e.remote.accounts.studentA.role = 'teacher';},
    e => {e.remote.sessions.studentA2.sessionIdHash = e.remote.sessions.studentA1.sessionIdHash;},
    e => {e.remote.sessions.studentA2.contextId = e.remote.sessions.studentA1.contextId;},
    e => {e.remote.sessions.studentA2.accountIdHash = e.remote.accounts.studentB.idHash;},
    e => {e.remote.sessions.studentA2.authenticatedAt = at(3);},
    e => {e.remote.continuity.reopened.objectId = 'another';}, e => {e.remote.continuity.reopened.instanceId = 'another';},
    e => {e.remote.continuity.reopened.workRevision += 1;}, e => {e.remote.continuity.reopened.stateDigest = hash('e');},
    e => {e.remote.continuity.saved.objectRevision = '1';},
  ]) {const evidence = remoteFixture(); mutate(evidence); assert.equal(m3RemoteEvidenceMatches(bindRemote(evidence), current), false);}
});

testVisibility('M3 remote counterproofs cannot be missing, relabeled booleans, unsupported assertions or secret-bearing records', () => {
  for (const name of M3_REMOTE_CHECKS) {
    const evidence = remoteFixture(); delete evidence.remote.checks[name];
    assert.equal(m3RemoteEvidenceMatches(bindRemote(evidence), current), false, name);
    const forged = remoteFixture(); forged.remote.checks[name].passed = 'true';
    assert.equal(m3RemoteEvidenceMatches(bindRemote(forged), current), false, name);
  }
  for (const mutate of [
    e => {e.remote.checks.idor.responseStatus = 200;}, e => {e.remote.checks.revocation.retryStatus = 200;},
    e => {e.remote.checks.consentRevocation.responseStatus = 200;}, e => {e.remote.checks.conflict.persistedRevision += 1;},
    e => {e.remote.checks.lostResponse.afterRetryRevision += 1;}, e => {e.remote.checks.lostResponse.firstResponseDelivered = true;},
    e => {e.remote.checks.logout.afterStatus = 200;}, e => {e.remote.checks.expired.responseStatus = 200;},
    e => {e.remote.checks.outage.localFallbackUsed = true;}, e => {e.remote.checks.outage.afterStateDigest = hash('1');},
    e => {e.remote.checks.backupRestore.restoreDatabaseHash = e.remote.database.resourceIdHash;},
    e => {e.remote.checks.backupRestore.restoredDigest = hash('1');},
    e => {e.remote.checks.import.versions.pop();}, e => {e.remote.checks.import.versions[0].afterReceiptsDigest = hash('1');},
    e => {e.remote.checks.accountSwitch.afterRevision += 1;}, e => {e.remote.checks.teacherEvidence.privateCount = 1;},
    e => {e.remote.sessions.studentA1.cookie = 'forbidden';},
    e => {e.remote.token = 'forbidden';},
  ]) {const evidence = remoteFixture(); mutate(evidence); assert.equal(m3RemoteEvidenceMatches(bindRemote(evidence), current), false);}
});
}
