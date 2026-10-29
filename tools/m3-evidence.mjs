import {createHash} from 'node:crypto';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value);
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));
const sameSource = (value, current) => record(value) && record(current) && sha(current.commit) && digest(current.sourceDigest)
  && value.commit === current.commit && value.sourceDigest === current.sourceDigest;
const sameDigest = (left, right) => digest(left) && left === right;
const uniqueStrings = values => Array.isArray(values) && values.every(value => typeof value === 'string') && new Set(values).size === values.length;

/** Deliberately the same parsed-JSON algorithm as the existing unitReportDigest. */
export function m3ReportDigest(report) {
  if (!record(report)) return null;
  try {return createHash('sha256').update(JSON.stringify(report)).digest('hex');} catch {return null;}
}

export const M3_REQUIRED_UNIT_FILES = Object.freeze([
  'packages/core/src/learning.test.ts',
  'packages/remote-client/src/client.test.ts',
  'packages/server/src/server.integration.test.ts',
]);
const scenarios = [
  '[M3] teacher and two students preserve private laboratory work across independent sessions',
  '[M3] a lost response is recovered by the same command without duplicate revisions or events',
  '[M3] concurrent authenticated writes reject an old revision and preserve the winner',
];
export const M3_REQUIRED_FLOWS = Object.freeze(['desktop-chromium', 'mobile-chromium'].flatMap(project => scenarios.map(title => `${project}::${title}`)));
const checks = ['config-source', 'types', 'boundaries', 'release-evidence', 'unit', 'signed-plugin', 'build', 'bundle-budget'];

function unitMatches(unit, verification) {
  if (!record(unit) || unit.success !== true || !positive(unit.numTotalTests) || unit.numPassedTests !== unit.numTotalTests
    || !positive(unit.numTotalTestSuites) || unit.numPassedTestSuites !== unit.numTotalTestSuites
    || ['numFailedTests', 'numPendingTests', 'numTodoTests', 'numFailedTestSuites', 'numPendingTestSuites'].some(key => unit[key] !== 0)
    || !Array.isArray(unit.testResults) || !sameDigest(verification.unitReportDigest, m3ReportDigest(unit))) return false;
  let count = 0;
  const files = [];
  for (const suite of unit.testResults) {
    if (!record(suite) || suite.status !== 'passed' || typeof suite.name !== 'string' || !Array.isArray(suite.assertionResults)
      || suite.assertionResults.length === 0 || suite.assertionResults.some(result => !record(result) || result.status !== 'passed'
        || typeof result.title !== 'string' || !result.title || !Array.isArray(result.failureMessages) || result.failureMessages.length !== 0)) return false;
    files.push(suite.name.replaceAll('\\', '/')); count += suite.assertionResults.length;
  }
  return new Set(files).size === files.length && count === unit.numTotalTests
    && M3_REQUIRED_UNIT_FILES.every(required => files.some(file => file === required || file.endsWith('/' + required)));
}

function browserMatches(browser, report, current) {
  if (!sameSource(browser, current) || browser.passed !== true || browser.m1Passed !== true || browser.m2Passed !== true || browser.m3Passed !== true
    || !record(browser.stats) || !record(report) || !record(report.stats) || !Array.isArray(report.suites)
    || (report.errors !== undefined && (!Array.isArray(report.errors) || report.errors.length !== 0))
    || !sameDigest(browser.reportDigest, m3ReportDigest(report)) || !positive(browser.stats.expected)
    || browser.stats.expected !== report.stats.expected
    || ['skipped', 'unexpected', 'flaky'].some(key => browser.stats[key] !== 0 || report.stats[key] !== 0)) return false;
  const executed = new Set(); let testCount = 0; let valid = true;
  function visit(suites) {
    if (!Array.isArray(suites)) {valid = false; return;}
    for (const suite of suites) {
      if (!record(suite)) {valid = false; continue;}
      for (const spec of suite.specs ?? []) {
        if (!record(spec) || spec.ok !== true || typeof spec.title !== 'string' || typeof spec.file !== 'string' || !Array.isArray(spec.tests) || !spec.tests.length) {valid = false; continue;}
        for (const test of spec.tests) {
          testCount += 1;
          if (!record(test) || test.status !== 'expected' || typeof test.projectName !== 'string' || !Array.isArray(test.results)
            || test.results.length !== 1 || test.results[0]?.status !== 'passed') {valid = false; continue;}
          const flow = test.projectName + '::' + spec.title;
          const file = spec.file.replaceAll('\\', '/');
          if (spec.title.startsWith('[M3] ') && file !== 'e2e/remote-continuity.spec.ts' && !file.endsWith('/e2e/remote-continuity.spec.ts')
            && file !== 'remote-continuity.spec.ts') {valid = false; continue;}
          if (executed.has(flow)) {valid = false; continue;}
          executed.add(flow);
        }
      }
      if (suite.suites !== undefined) visit(suite.suites);
    }
  }
  visit(report.suites);
  const summaries = [['m1Flows', 14], ['m2Flows', 24], ['m3Flows', M3_REQUIRED_FLOWS.length]];
  return valid && testCount === browser.stats.expected && summaries.every(([field, minimum]) => uniqueStrings(browser[field])
    && browser[field].length >= minimum && browser[field].every(flow => executed.has(flow)))
    && M3_REQUIRED_FLOWS.every(flow => browser.m3Flows.includes(flow));
}

/** Local PostgreSQL and browser evidence is useful independently of remote acceptance. */
export function m3LocalEvidenceMatches(evidence, current) {
  try {
    const verification = evidence?.verification;
    return record(evidence) && sameSource(verification, current) && verification.passed === true
      && Array.isArray(verification.checks) && verification.checks.length === checks.length
      && new Set(verification.checks.map(check => check?.name)).size === checks.length
      && checks.every(name => verification.checks.some(check => record(check) && check.name === name && check.passed === true && check.exitCode === 0))
      && unitMatches(evidence.unit, verification) && browserMatches(evidence.browser, evidence.playwright, current);
  } catch {return false;}
}

export const M3_REMOTE_CHECKS = Object.freeze(['idor', 'revocation', 'consentRevocation', 'conflict', 'lostResponse',
  'logout', 'expired', 'outage', 'backupRestore', 'import', 'accountSwitch', 'teacherEvidence']);

function https(value) {
  if (typeof value !== 'string' || value.trim() !== value) return null;
  try {const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url : null;} catch {return null;}
}
function protectedRelease(release, current) {
  if (!sameSource(release, current)) return false;
  const url = https(release.url), ci = https(release.ci?.url), protection = release.protection;
  if (!url || !/^[a-z0-9-]+\.vercel\.app$/.test(url.hostname) || url.port || url.pathname !== '/' || url.search || url.hash
    || release.repository !== 'AndreaMarro/ardesia-next' || release.visibility !== 'private' || release.target !== 'preview'
    || !Object.hasOwn(release, 'providerTarget') || ![null, 'staging'].includes(release.providerTarget) || release.status !== 'READY'
    || release.projectId !== 'prj_GGKjCPG4cdgaQDQQMJoFvsy2ffSd' || !/^dpl_[A-Za-z0-9]{1,128}$/.test(release.deploymentId ?? '')
    || !sameSource(release.buildInfo, current) || release.ci?.headSha !== current.commit || release.ci.conclusion !== 'success'
    || !ci || ci.origin !== 'https://github.com' || !/^\/AndreaMarro\/ardesia-next\/actions\/runs\/\d+$/.test(ci.pathname)
    || ci.search || ci.hash || !timestamp(release.observedAt) || !record(protection) || protection.deploymentType !== 'all') return false;
  if ([401, 403].includes(protection.anonymousStatus)) return true;
  const redirect = https(protection.anonymousLocation);
  if (![302, 303, 307].includes(protection.anonymousStatus) || !redirect || redirect.origin !== 'https://vercel.com' || redirect.pathname !== '/sso-api') return false;
  const targets = redirect.searchParams.getAll('url');
  return targets.length === 1 && https(targets[0])?.origin === url.origin;
}

function noSecrets(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return typeof value !== 'string' || !/(?:Bearer\s|__Host-ardesia_session=|ardesia_dev_session=)/i.test(value);
  if (seen.has(value)) return false; seen.add(value);
  return Object.entries(value).every(([key, child]) => !/password|cookie|authorization|secret|^token$/i.test(key) && noSecrets(child, seen));
}
const denied = result => record(result) && [403, 404].includes(result.responseStatus) && ['FORBIDDEN', 'NOT_FOUND'].includes(result.code);
const increment = (before, after) => positive(before) && after === before + 1;

function observationsMatch(remote) {
  const {accounts, sessions, continuity: continuity, checks: proof} = remote;
  if (!record(accounts) || !record(sessions) || !record(continuity) || !record(proof)) return false;
  const accountNames = ['teacher', 'studentA', 'studentB'], sessionNames = ['teacher', 'studentA1', 'studentA2', 'studentB'];
  if (Object.keys(accounts).length !== 3 || !accountNames.every(name => record(accounts[name]) && digest(accounts[name].idHash)
    && accounts[name].role === (name === 'teacher' ? 'teacher' : 'student')) || new Set(accountNames.map(name => accounts[name].idHash)).size !== 3) return false;
  if (Object.keys(sessions).length !== 4 || !sessionNames.every(name => record(sessions[name]) && digest(sessions[name].sessionIdHash)
    && id(sessions[name].contextId) && timestamp(sessions[name].authenticatedAt)
    && sessions[name].accountIdHash === accounts[name.startsWith('studentA') ? 'studentA' : name].idHash)
    || new Set(sessionNames.map(name => sessions[name].contextId)).size !== 4
    || new Set(sessionNames.map(name => sessions[name].sessionIdHash)).size !== 4
    || !timestamp(sessions.studentA1.endedAt) || Date.parse(sessions.studentA2.authenticatedAt) < Date.parse(sessions.studentA1.endedAt)) return false;
  const saved = continuity.saved, reopened = continuity.reopened;
  if (!record(saved) || !record(reopened) || continuity.createdByAccountHash !== accounts.teacher.idHash || continuity.assignedToAccountHash !== accounts.studentA.idHash
    || saved.session !== 'studentA1' || reopened.session !== 'studentA2' || !timestamp(saved.observedAt) || !timestamp(reopened.observedAt)
    || Date.parse(saved.observedAt) > Date.parse(sessions.studentA1.endedAt) || Date.parse(reopened.observedAt) < Date.parse(sessions.studentA2.authenticatedAt)
    || !['workspaceId', 'documentId', 'objectId', 'instanceId'].every(key => id(saved[key]) && saved[key] === reopened[key])
    || !['objectRevision', 'workRevision', 'labRevision'].every(key => positive(saved[key]) && saved[key] === reopened[key])
    || !sameDigest(saved.stateDigest, reopened.stateDigest)) return false;
  if (Object.keys(proof).length !== M3_REMOTE_CHECKS.length || !M3_REMOTE_CHECKS.every(name => record(proof[name]) && proof[name].passed === true
    && digest(proof[name].artifactDigest) && timestamp(proof[name].observedAt) && Date.parse(proof[name].observedAt) <= Date.parse(remote.observedAt))) return false;
  return denied(proof.idor) && proof.idor.session === 'studentB' && proof.idor.resourceOwnerHash === accounts.studentA.idHash
    && denied(proof.revocation) && proof.revocation.session === 'studentA2' && [403, 404].includes(proof.revocation.retryStatus)
    && increment(proof.revocation.beforeRevision, proof.revocation.afterRevision)
    && proof.consentRevocation.responseStatus === 422 && ['PLUGIN_CONSENT_REQUIRED', 'PLUGIN_REVOKED', 'PLUGIN_NOT_ACTIVE'].includes(proof.consentRevocation.code)
    && proof.conflict.responseStatus === 409 && proof.conflict.code === 'REVISION_CONFLICT'
    && positive(proof.conflict.attemptedRevision) && proof.conflict.winnerRevision > proof.conflict.attemptedRevision && proof.conflict.persistedRevision === proof.conflict.winnerRevision
    && proof.lostResponse.firstResponseDelivered === false && sameDigest(proof.lostResponse.receiptDigest, proof.lostResponse.retriedReceiptDigest)
    && increment(proof.lostResponse.beforeRevision, proof.lostResponse.afterFirstRevision) && proof.lostResponse.afterRetryRevision === proof.lostResponse.afterFirstRevision
    && proof.logout.session === 'studentA1' && proof.logout.responseStatus === 200 && proof.logout.afterStatus === 401 && proof.logout.code === 'UNAUTHENTICATED'
    && proof.expired.responseStatus === 401 && proof.expired.code === 'UNAUTHENTICATED'
    && proof.outage.failedStatus === 503 && proof.outage.recoveredStatus === 200 && proof.outage.localFallbackUsed === false
    && sameDigest(proof.outage.beforeStateDigest, proof.outage.afterStateDigest)
    && proof.backupRestore.sourceDatabaseHash === remote.database.resourceIdHash && digest(proof.backupRestore.restoreDatabaseHash)
    && proof.backupRestore.restoreDatabaseHash !== proof.backupRestore.sourceDatabaseHash && proof.backupRestore.syntheticOnly === true
    && positive(proof.backupRestore.recordCount) && sameDigest(proof.backupRestore.beforeDigest, proof.backupRestore.restoredDigest)
    && Array.isArray(proof.import.versions) && proof.import.versions.length === 3
    && [1, 2, 3].every(version => proof.import.versions.filter(entry => record(entry) && entry.version === version
      && sameDigest(entry.sourceBytesDigest, entry.archivedBytesDigest) && sameDigest(entry.beforeReceiptsDigest, entry.afterReceiptsDigest)
      && positive(entry.beforeRevision) && entry.afterRevision === entry.beforeRevision && entry.consentReset === true
      && entry.duplicateStatus === 409 && entry.ownershipMismatchStatus === 409).length === 1)
    && proof.accountSwitch.responseStatus === 409 && proof.accountSwitch.code === 'SESSION_CHANGED'
    && proof.accountSwitch.fromAccountHash === accounts.studentA.idHash && proof.accountSwitch.currentAccountHash === accounts.studentB.idHash
    && positive(proof.accountSwitch.beforeRevision) && proof.accountSwitch.afterRevision === proof.accountSwitch.beforeRevision
    && proof.teacherEvidence.accountIdHash === accounts.teacher.idHash && proof.teacherEvidence.privateCount === 0
    && positive(proof.teacherEvidence.sharedCount) && proof.teacherEvidence.afterRevokeCount === 0;
}

/** Fail-closed cross-artifact gate; a report digest is not an attestation of its author's honesty. */
export function m3RemoteEvidenceMatches(evidence, current) {
  try {
    const remote = evidence?.remote, release = evidence?.release;
    return m3LocalEvidenceMatches(evidence, current) && protectedRelease(release, current) && sameSource(remote, current)
      && remote.schemaVersion === 1 && remote.kind === 'ardesia-m3-remote-browser' && remote.runner === 'playwright' && remote.passed === true
      && remote.url === release.url && remote.deploymentId === release.deploymentId && timestamp(remote.observedAt)
      && sameDigest(release.m3ReportDigest, m3ReportDigest(remote)) && noSecrets(remote)
      && record(remote.database) && remote.database.authority === 'postgres' && remote.database.configured === true && remote.database.remote === true
      && digest(remote.database.resourceIdHash) && typeof remote.database.hostname === 'string'
      && /^(?=.{1,253}$)(?:[a-z0-9-]+\.)+[a-z]{2,63}$/.test(remote.database.hostname)
      && !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(remote.database.hostname)
      && record(remote.stats) && remote.stats.passed === M3_REMOTE_CHECKS.length && ['failed', 'skipped', 'flaky'].every(key => remote.stats[key] === 0)
      && observationsMatch(remote);
  } catch {return false;}
}
