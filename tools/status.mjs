import {readFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {identity} from './evidence.mjs';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));
const httpsUrl = value => {
  if(typeof value !== 'string' || value.trim() !== value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {return null;}
};

function anonymousAccessIsProtected(protection, deploymentUrl) {
  if(!isRecord(protection) || protection.deploymentType !== 'all') return false;
  if([401,403].includes(protection.anonymousStatus)) return true;
  if(![302,303,307].includes(protection.anonymousStatus)) return false;
  const location = httpsUrl(protection.anonymousLocation);
  if(!location || location.origin !== 'https://vercel.com' || location.pathname !== '/sso-api') return false;
  const targets = location.searchParams.getAll('url');
  if(targets.length !== 1) return false;
  const target = httpsUrl(targets[0]);
  return Boolean(target && target.origin === deploymentUrl.origin);
}

/** Pure fail-closed gate. JSON Schema alone cannot compare decoded URL origins. */
export function releaseEvidenceMatches(remote, current) {
  if(!isRecord(remote) || !isRecord(current)) return false;
  const deploymentUrl = httpsUrl(remote.url);
  return Boolean(
    sha(current.commit) && digest(current.sourceDigest)
    && remote.commit === current.commit && remote.sourceDigest === current.sourceDigest
    && remote.repository === 'AndreaMarro/ardesia-next' && remote.visibility === 'private'
    && remote.status === 'READY' && remote.target === 'preview'
    && Object.hasOwn(remote, 'providerTarget') && ['staging',null].includes(remote.providerTarget)
    && deploymentUrl && typeof remote.deploymentId === 'string' && /^dpl_[A-Za-z0-9]{1,128}$/.test(remote.deploymentId)
    && timestamp(remote.observedAt)
    && isRecord(remote.ci) && remote.ci.headSha === current.commit && remote.ci.conclusion === 'success' && httpsUrl(remote.ci.url)
    && isRecord(remote.buildInfo) && remote.buildInfo.commit === current.commit && remote.buildInfo.sourceDigest === current.sourceDigest
    && remote.projectId === 'prj_GGKjCPG4cdgaQDQQMJoFvsy2ffSd'
    && anonymousAccessIsProtected(remote.protection, deploymentUrl)
  );
}

const M1_SCENARIOS = [
  '[M1] verified spring edits and reopens through Core',
  '[M1] tampered bundle never starts a worker',
  '[M1] tampered signature never starts a worker',
  '[M1] disallowed capability never starts a worker',
  '[M1] incompatible saved state is preserved and refused',
  '[M1] invalid scientific state is preserved and refused',
  '[M1] rejected parameters preserve the saved experiment'
];
export const M1_REQUIRED_FLOWS = Object.freeze(['desktop-chromium', 'mobile-chromium'].flatMap(project => M1_SCENARIOS.map(title => `${project}::${title}`)));
const M1_REQUIRED_CHECKS = ['config-source', 'types', 'boundaries', 'release-evidence', 'unit', 'signed-plugin', 'build', 'bundle-budget'];
const M1_REQUIRED_UNIT_FILES = [
  'packages/plugin-host/src/runtime.test.ts',
  'plugins/ideal-spring/src/model.test.ts',
  'plugins/ideal-spring/src/handler.test.ts',
  'packages/core/src/lab.test.ts'
];
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const instanceIdentity = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value);
const matchesCurrent = (report, current) => isRecord(report) && isRecord(current)
  && sha(current.commit) && digest(current.sourceDigest)
  && report.commit === current.commit && report.sourceDigest === current.sourceDigest;

/** Bind the parsed Vitest report content to verification; formatting whitespace is immaterial. */
export function unitReportDigest(unit) {
  if(!isRecord(unit)) return null;
  try {return createHash('sha256').update(JSON.stringify(unit)).digest('hex');}
  catch {return null;}
}
const unitReportMatches = (unit, verification) => isRecord(verification) && digest(verification.unitReportDigest)
  && verification.unitReportDigest === unitReportDigest(unit);

function m1VerificationMatches(verification, current) {
  if(!matchesCurrent(verification, current) || verification.passed !== true || !Array.isArray(verification.checks)) return false;
  if(verification.checks.length !== M1_REQUIRED_CHECKS.length) return false;
  const names = verification.checks.map(check => check?.name);
  return new Set(names).size === names.length && M1_REQUIRED_CHECKS.every(name => names.includes(name))
    && verification.checks.every(check => isRecord(check) && check.passed === true && check.exitCode === 0);
}

function m1UnitMatches(unit) {
  if(!isRecord(unit) || unit.success !== true || !positiveInteger(unit.numTotalTests) || unit.numPassedTests !== unit.numTotalTests) return false;
  if(!positiveInteger(unit.numTotalTestSuites) || unit.numPassedTestSuites !== unit.numTotalTestSuites) return false;
  if(['numFailedTests', 'numPendingTests', 'numTodoTests', 'numFailedTestSuites', 'numPendingTestSuites'].some(key => unit[key] !== 0)) return false;
  if(!Array.isArray(unit.testResults) || unit.testResults.length === 0) return false;
  let assertions = 0;
  const files = [];
  for(const suite of unit.testResults) {
    if(!isRecord(suite) || suite.status !== 'passed' || typeof suite.name !== 'string' || !Array.isArray(suite.assertionResults)) return false;
    const name = suite.name.replaceAll('\\', '/');
    if(files.includes(name)) return false;
    files.push(name);
    if(suite.assertionResults.length === 0 || !suite.assertionResults.every(result => isRecord(result) && result.status === 'passed'
      && typeof result.title === 'string' && result.title.length > 0 && Array.isArray(result.failureMessages) && result.failureMessages.length === 0)) return false;
    assertions += suite.assertionResults.length;
  }
  return assertions === unit.numTotalTests && M1_REQUIRED_UNIT_FILES.every(required => files.some(file => file === required || file.endsWith(`/${required}`)));
}

function m1BrowserMatches(browser, current) {
  if(!matchesCurrent(browser, current) || browser.passed !== true || browser.m1Passed !== true || !isRecord(browser.stats)) return false;
  if(!positiveInteger(browser.stats.expected) || browser.stats.expected < M1_REQUIRED_FLOWS.length
    || ['skipped', 'unexpected', 'flaky'].some(key => browser.stats[key] !== 0)) return false;
  const flows = browser.m1Flows;
  return Array.isArray(flows) && flows.every(flow => typeof flow === 'string') && new Set(flows).size === flows.length
    && M1_REQUIRED_FLOWS.every(required => flows.includes(required));
}

function m1RemoteBrowserMatches(remote, current) {
  if(!releaseEvidenceMatches(remote, current) || !isRecord(remote.m1Browser)) return false;
  const browser = remote.m1Browser;
  const keys = ['commit', 'sourceDigest', 'url', 'passed', 'objectId', 'instanceId', 'savedRevision', 'reopenedRevision', 'statePreserved', 'observedAt'];
  return Object.keys(browser).length === keys.length && keys.every(key => Object.hasOwn(browser, key))
    && matchesCurrent(browser, current) && browser.url === remote.url && Boolean(httpsUrl(browser.url))
    && browser.passed === true && browser.statePreserved === true
    && instanceIdentity(browser.objectId) && instanceIdentity(browser.instanceId)
    && Number.isSafeInteger(browser.savedRevision) && browser.savedRevision >= 2
    && browser.reopenedRevision === browser.savedRevision && timestamp(browser.observedAt);
}

/** Structural and cross-artifact gate, not a cryptographic attestation of who produced evidence. */
export function m1EvidenceMatches(evidence, current) {
  return isRecord(evidence)
    && m1VerificationMatches(evidence.verification, current)
    && m1UnitMatches(evidence.unit)
    && unitReportMatches(evidence.unit, evidence.verification)
    && m1BrowserMatches(evidence.browser, current)
    && m1RemoteBrowserMatches(evidence.release, current);
}

function runStatus() {
  const current = identity();
  const read = file => {try {return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;} catch {return null;}};
  const checks = read('artifacts/verification.json');
  const e2e = read('artifacts/browser-evidence.json');
  const unit = read('artifacts/unit.json');
  const remote = read('artifacts/release-evidence.json');
  const verified = Boolean(checks?.passed === true && checks.sourceDigest === current.sourceDigest && checks.commit === current.commit);
  const browserPassed = verified && e2e?.passed === true && e2e.sourceDigest === current.sourceDigest && e2e.commit === current.commit;
  const remoteMatches = releaseEvidenceMatches(remote, current);
  const m1Accepted = m1EvidenceMatches({verification: checks, unit, browser: e2e, release: remote}, current);
  const state = {
    ...current, milestone: 'M1', foundationMilestone: 'M0',
    verification: verified ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_SOURCE',
    browser: browserPassed ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_SOURCE',
    deployment: remoteMatches ? remote : {status: 'NOT_VERIFIED_FOR_CURRENT_COMMIT'},
    productAcceptance: 'NOT_COMPLETE',
    M0: verified && browserPassed && remoteMatches ? 'ACCEPTED' : 'AWAITING_COMPLETE_EVIDENCE',
    M1: m1Accepted ? 'ACCEPTED' : 'AWAITING_COMPLETE_EVIDENCE',
    m1Evidence: {
      verifiedSourceAndSignedBundle: m1VerificationMatches(checks, current) ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_SOURCE',
      hostModelAndCoreTests: verified && m1UnitMatches(unit) && unitReportMatches(unit, checks) ? 'PASS' : 'MISSING_OR_FAILED_TEST_EVIDENCE',
      localBrowserFlows: m1BrowserMatches(e2e, current) ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_SOURCE',
      protectedRemoteReopen: m1RemoteBrowserMatches(remote, current) ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_COMMIT'
    },
    M2: 'NOT_STARTED', M3: 'NOT_STARTED', M4: 'NOT_STARTED', M5: 'NOT_STARTED',
    limits: ['Device-only persistence', 'No application authentication or remote student authorization', 'Only pinned first-party plugin execution; no third-party sandbox or M2 catalog acceptance', 'Physical pen/touch and human UX acceptance NOT_RUN', 'No public release'],
    acceptedProductCriteria: 0, preservedProductCriteria: 68
  };
  mkdirSync('artifacts', {recursive: true});
  writeFileSync('artifacts/status.json', JSON.stringify(state, null, 2) + '\n');
  console.log(JSON.stringify(state, null, 2));
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runStatus();

