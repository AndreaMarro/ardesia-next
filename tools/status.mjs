import {readFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {identity} from './evidence.mjs';
import {m3LocalEvidenceMatches, m3RemoteEvidenceMatches, m3ReportDigest} from './m3-evidence.mjs';
import {assembleM3Acceptance} from './m3-acceptance.mjs';
import {sourceVisibilityMatches} from './source-visibility.mjs';

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
    && remote.repository === 'AndreaMarro/ardesia-next' && sourceVisibilityMatches(remote)
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

export const M4_PREPARATION_CHECKS = Object.freeze(['signature-before-execution', 'explicit-consent', 'save-edit-reopen', 'exact-old-revision',
  'invalid-state-no-write', 'owner-isolation', 'withdraw-consent', 'tampered-bundle-no-worker', 'forged-signature-no-worker']);
export const m4PreparationDigest = unitReportDigest;

/** Only scoped preparation. No fixture result can accept M4 or substitute for the web/PostgreSQL consumer. */
function m4SignedBoundaryMatches({verification, unit, preparation} = {}, current) {
  if (!m1VerificationMatches(verification, current) || !m1UnitMatches(unit) || !unitReportMatches(unit, verification)
    || !matchesCurrent(preparation, current) || preparation.schemaVersion !== '1.0.0' || preparation.kind !== 'ardesia-m4-preparation'
    || preparation.acceptanceEvidence !== false || preparation.passed !== true
    || !digest(verification.m4PreparationDigest) || verification.m4PreparationDigest !== m4PreparationDigest(preparation)) return false;
  if (!unit.testResults.some(suite => suite.name.replaceAll('\\', '/').endsWith('/plugins/poiseuille/src/model.test.ts') || suite.name === 'plugins/poiseuille/src/model.test.ts')) return false;
  const {plugin, consumer, reuse} = preparation;
  if (!isRecord(plugin) || plugin.id !== 'ardesia.poiseuille' || plugin.version !== '1.0.0' || !digest(plugin.bundleDigest) || !sha(plugin.sourceRevision)
    || !isRecord(consumer) || consumer.consumer !== 'public-Host-Core-integration-fixture'
    || consumer.storage !== 'existing-Core-MemoryStorage-test-adapter' || !positiveInteger(consumer.workersStarted) || consumer.liveWorkers !== 0
    || consumer.browser !== 'NOT_RUN' || consumer.postgres !== 'NOT_RUN' || consumer.humanReview !== 'PENDING'
    || !Array.isArray(consumer.checks) || consumer.checks.length !== M4_PREPARATION_CHECKS.length || new Set(consumer.checks).size !== consumer.checks.length
    || !M4_PREPARATION_CHECKS.every(name => consumer.checks.includes(name))) return false;
  return true;
}

export function m4PreparationMatches(evidence = {}, current) {
  if (!m4SignedBoundaryMatches(evidence, current)) return false;
  const reuse = evidence.preparation.reuse;
  return isRecord(reuse) && reuse.baseSha === 'c4d38a612a73bc28df434c2d36d36025cf1b1adc' && reuse.sdkVersion === '1.0.0'
    && ['coreUnchanged','hostUnchanged','sdkUnchanged','persistenceUnchanged'].every(key => reuse[key] === true)
    && positiveInteger(reuse.generatedWorkerBytes) && Array.isArray(reuse.changedPaths) && reuse.changedPaths.length > 0
    && new Set(reuse.changedPaths).size === reuse.changedPaths.length && reuse.changedPaths.every(path => typeof path === 'string' && /^(plugins\/poiseuille\/|tools\/|docs\/)/.test(path))
    && Array.isArray(reuse.measuredDelta) && reuse.measuredDelta.length === reuse.changedPaths.length
    && reuse.measuredDelta.every((entry, index) => isRecord(entry) && entry.path === reuse.changedPaths[index]
      && Number.isSafeInteger(entry.addedLines) && entry.addedLines >= 0 && Number.isSafeInteger(entry.removedLines) && entry.removedLines >= 0);
}

export const M4_REQUIRED_FLOWS = Object.freeze(['desktop-chromium', 'mobile-chromium'].flatMap(project => ['pressure', 'flow'].flatMap(control => [
  `${project}::[M4] ${control} control saves reopens rejects and revokes without changing spring`,
  `${project}::[M4] ${control} learner consent private save independent reopen and revocation`,
])));
export const M4_REMOTE_CHECKS = Object.freeze(['stable-build-identity-before', 'verified-spring-and-two-poiseuille-controls-same-lesson',
  'teacher-core-save-reload-exact-ids-instances-revisions-draft', 'student-a-private-save-peer-and-teacher-isolated',
  'same-student-logout-fresh-empty-context-new-session-exact-state-reopened',
  'revoked-consent-refuses-write-stops-worker-preserves-saved-work', 'stable-build-identity-after-no-page-errors']);

/** Real consumer evidence is distinct from the preserved MemoryStorage preparation and human acceptance. */
export function m4LocalConsumerMatches(evidence, current) {
  try {
    if (!m4SignedBoundaryMatches(evidence, current) || !m3LocalEvidenceMatches(evidence, current)
      || !m1BrowserMatches(evidence.browser, current) || !m2BrowserMatches(evidence.browser, current)) return false;
    const b = evidence.budget;
    if (!matchesCurrent(b, current) || b.metric !== 'all-javascript-gzip-bytes' || b.passed !== true || b.limit !== 245760
      || !positiveInteger(b.bytes) || b.bytes > b.limit || !Array.isArray(b.files) || !b.files.length
      || new Set(b.files.map(f => f.file)).size !== b.files.length
      || b.files.some(f => typeof f.file !== 'string' || !f.file.endsWith('.js') || !positiveInteger(f.gzipBytes) || typeof f.initial !== 'boolean')
      || b.files.reduce((sum, f) => sum + f.gzipBytes, 0) !== b.bytes
      || !['ideal-spring', 'poiseuille'].every(id => b.files.some(f => f.file === `plugins/${id}/1.0.0/plugin.js`))) return false;
    const t = evidence.transport;
    if (!isRecord(t) || t.kind !== 'lossless-worker-byte-transport' || !digest(t.container?.sha256)
      || t.container.path !== `/plugins/shared/${t.container.sha256}.js` || !positiveInteger(t.container.bytes)
      || !positiveInteger(t.prefixBytes) || !Array.isArray(t.workers) || t.workers.length !== 2
      || !['ideal-spring', 'poiseuille'].every((id, index) => t.workers[index]?.path === `/plugins/${id}/1.0.0/plugin.js`
        && t.workers[index].originalSha256 === ['713b10ce53337e5bb03f0da86afec8a1266a8229115e9d1f571cf49766814148',
          'bd7eced69753424c7da3076783917d4fb235bd90d975dbbce2fe71371b06e00b'][index]
        && positiveInteger(t.workers[index].originalBytes) && t.prefixBytes < t.workers[index].originalBytes)
      || !b.files.some(f => '/' + f.file === t.container.path)
      || b.files.filter(f => [t.container.path, ...t.workers.map(w => w.path)].includes('/' + f.file))
        .reduce((sum, f) => sum + f.gzipBytes, 0) !== t.afterGzipBytes) return false;
    const {preparation, unit, playwright} = evidence, r = preparation.reuse;
    if (preparation.plugin.bundleDigest !== 'bd7eced69753424c7da3076783917d4fb235bd90d975dbbce2fe71371b06e00b'
      || !isRecord(r) || r.baseSha !== 'c4d38a612a73bc28df434c2d36d36025cf1b1adc' || r.sdkVersion !== '1.0.0'
      || r.coreUnchanged !== true || r.sdkUnchanged !== true || !positiveInteger(r.generatedWorkerBytes)
      || !Array.isArray(r.changedPaths) || !r.changedPaths.length || new Set(r.changedPaths).size !== r.changedPaths.length
      || r.changedPaths.some(path => typeof path !== 'string' || !path || path.split('/').some(part => !part || part === '.' || part === '..')
        || /^(packages\/(core|contracts|remote-client)\/)/.test(path)
        || path.startsWith('packages/plugin-host/') && path !== 'packages/plugin-host/src/first-party-trust.json'
        || path.startsWith('packages/plugin-sdk/')
        || path.startsWith('packages/server/') && !['packages/server/package.json', 'packages/server/src/server.integration.test.ts'].includes(path))
      || !Array.isArray(r.measuredDelta) || r.measuredDelta.length !== r.changedPaths.length
      || !r.measuredDelta.every((entry, index) => isRecord(entry) && entry.path === r.changedPaths[index]
        && (entry.addedLines === null && entry.removedLines === null || Number.isSafeInteger(entry.addedLines) && entry.addedLines >= 0
          && Number.isSafeInteger(entry.removedLines) && entry.removedLines >= 0))) return false;
    const pg = unit.testResults.find(s => s.name.replaceAll('\\', '/').endsWith('/packages/server/src/server.integration.test.ts')
      || s.name === 'packages/server/src/server.integration.test.ts');
    if (!pg?.assertionResults.some(a => a.title === 'M4 Poiseuille PostgreSQL preserves exact revisions and private student state; rejects invalid writes and revocation'
      && a.fullName?.includes('M3 real PostgreSQL authority') && a.status === 'passed')) return false;
    const flows = [];
    const visit = suites => {for (const suite of suites) {
      for (const spec of suite.specs ?? []) if (spec.title.startsWith('[M4] ')) {
        if (!/(^|\/)poiseuille\.spec\.ts$/.test(spec.file.replaceAll('\\', '/'))) throw Error('M4 consumer source required');
        for (const test of spec.tests) {
          if (test.results[0].retry !== undefined && test.results[0].retry !== 0) throw Error('M4 retry refused');
          flows.push(test.projectName + '::' + spec.title);
        }
      }
      visit(suite.suites ?? []);
    }};
    visit(playwright.suites);
    return new Set(flows).size === flows.length && M4_REQUIRED_FLOWS.every(flow => flows.includes(flow));
  } catch {return false;}
}

/** These are observed operational reports, not an attestation of authorship or a new M3 restore gate. */
export function m4ConsumerEvidenceMatches(evidence, current) {
  try {
    if (!m4LocalConsumerMatches(evidence, current) || !releaseEvidenceMatches(evidence.release, current)) return false;
    const {remoteConsumer: r, platform, release} = evidence;
    if (!matchesCurrent(r, current) || r.kind !== 'ardesia-m4-protected-preview-smoke' || r.passed !== true || r.failure !== undefined
      || r.url !== release.url || r.url !== 'https://ardesia-next-staging.vercel.app' || r.pageErrors !== 0
      || !timestamp(r.startedAt) || !timestamp(r.completedAt) || Date.parse(r.startedAt) > Date.parse(r.completedAt)
      || !matchesCurrent(r.buildInfoBefore, current) || !matchesCurrent(r.buildInfoAfter, current)
      || !Array.isArray(r.checks) || r.checks.length !== M4_REMOTE_CHECKS.length
      || new Set(r.checks.map(c => c.name)).size !== r.checks.length
      || !M4_REMOTE_CHECKS.every(name => r.checks.some(c => c.name === name && c.passed === true))
      || !isRecord(r.accounts) || r.accounts.freshStudentSession !== true
      || !['teacher', 'studentA', 'studentB'].every(k => digest(r.accounts[k]))
      || new Set(['teacher', 'studentA', 'studentB'].map(k => r.accounts[k])).size !== 3
      || r.logout?.ackStatus !== 200 || r.logout.sessionAfter !== 401 || r.logout.codeAfter !== 'UNAUTHENTICATED') return false;
    if (!isRecord(platform) || !timestamp(platform.observedAt) || Date.parse(platform.observedAt) < Date.parse(r.completedAt)
      || Date.parse(release.observedAt) < Date.parse(platform.observedAt)
      || platform.alias?.alias !== new URL(release.url).hostname || platform.alias.projectId !== release.projectId
      || platform.alias.deploymentId !== release.deploymentId || platform.project?.id !== release.projectId
      || platform.project.ssoProtection?.enabled !== true || platform.project.ssoProtection.deploymentType !== 'all'
      || platform.deployment?.id !== release.deploymentId || platform.deployment.project?.id !== release.projectId
      || platform.deployment.readyState !== 'READY' || platform.deployment.target !== release.providerTarget
      || platform.deployment.meta?.githubCommitSha !== current.commit || platform.deployment.meta.githubOrg !== 'AndreaMarro'
      || platform.deployment.meta.githubRepo !== 'ardesia-next') return false;
    const objects = r.savedObjects;
    if (!Array.isArray(objects) || objects.length !== 3 || new Set(objects.map(o => o.objectId)).size !== 3
      || new Set(objects.map(o => o.instanceId)).size !== 3 || objects.some(o => !instanceIdentity(o.objectId)
        || !instanceIdentity(o.instanceId) || o.status !== 'draft' || o.revision !== 2 || !digest(o.bundleDigest)
        || o.state?.schemaVersion !== '1.0.0' || !isRecord(o.state.value) || !Object.values(o.state.value).every(Number.isFinite))) return false;
    const fluids = objects.filter(o => o.pluginId === 'ardesia.poiseuille'), spring = objects.filter(o => o.pluginId === 'ardesia.ideal-spring');
    return spring.length === 1 && spring[0].bundleDigest === '713b10ce53337e5bb03f0da86afec8a1266a8229115e9d1f571cf49766814148'
      && fluids.length === 2 && fluids.every(o => o.bundleDigest === evidence.preparation.plugin.bundleDigest
        && ['radiusM', 'lengthM', 'viscosityPaS', 'densityKgPerM3'].every(key => o.state.value[key] > 0)
        && Object.keys(o.state.value).length === 5)
      && fluids.filter(o => Object.hasOwn(o.state.value, 'pressureDropPa') && !Object.hasOwn(o.state.value, 'flowRateM3PerS')).length === 1
      && fluids.filter(o => Object.hasOwn(o.state.value, 'flowRateM3PerS') && !Object.hasOwn(o.state.value, 'pressureDropPa')).length === 1
      && r.m1Browser?.objectId === spring[0].objectId && r.m1Browser.instanceId === spring[0].instanceId
      && m1RemoteBrowserMatches({...release, m1Browser: r.m1Browser}, current);
  } catch {return false;}
}

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

const M2_SCENARIOS = [
  '[M2] marketplace installs consents activates saves reopens and disables',
  '[M2] verification and installation execute no plugin code',
  '[M2] denied capabilities prevent activation and preserve data',
  '[M2] tampered signature is refused without modifying saved data',
  '[M2] altered bundle is refused without modifying saved data',
  '[M2] revoked publisher stops reopening and preserves data',
  '[M2] incompatible SDK is refused without modifying saved data',
  '[M2] invalid state is refused without destroying the saved experiment',
  '[M2] unauthorized update preserves the installed release and experiment',
  '[M2] failed persistence preserves installation consent and experiment',
  '[M2] revoked module stays revoked after reload without deleting its state',
  '[M2] stale tab stops runtime after another tab disables module'
];
export const M2_REQUIRED_FLOWS = Object.freeze(['desktop-chromium','mobile-chromium'].flatMap(project => M2_SCENARIOS.map(title => project + '::' + title)));
export const M2_LIFECYCLE_STEPS = Object.freeze(['find','verify','install','consent','activate','use','save','reload','disable']);
const M2_UNIT_FILES = ['packages/core/src/marketplace.test.ts','packages/plugin-host/src/marketplace.test.ts','packages/plugin-sdk/src/catalog.test.ts'];
function m2UnitMatches(unit, checks) {
  return m1UnitMatches(unit) && unitReportMatches(unit, checks)
    && M2_UNIT_FILES.every(required => unit.testResults.some(suite => suite.name.replaceAll('\\','/').endsWith('/' + required) || suite.name === required));
}
function m2BrowserMatches(browser, current) {
  return m1BrowserMatches(browser, current) && browser.m2Passed === true
    && Array.isArray(browser.m2Flows) && new Set(browser.m2Flows).size === browser.m2Flows.length
    && browser.m2Flows.every(flow => typeof flow === 'string') && M2_REQUIRED_FLOWS.every(flow => browser.m2Flows.includes(flow))
    && browser.stats.expected >= M1_REQUIRED_FLOWS.length + M2_REQUIRED_FLOWS.length;
}
function m2RemoteBrowserMatches(remote, current) {
  if (!m1RemoteBrowserMatches(remote, current) || !isRecord(remote.m2Browser)) return false;
  const browser = remote.m2Browser;
  const keys = ['commit','sourceDigest','url','passed','pluginId','pluginVersion','objectId','instanceId','installedRevision','activeRevision',
    'reopenedInstallationRevision','disabledRevision','savedRevision','reopenedRevision','statePreserved','consentPreserved','capabilities','disabled','steps','observedAt'];
  return Object.keys(browser).length === keys.length && keys.every(key => Object.hasOwn(browser,key))
    && matchesCurrent(browser,current) && browser.url === remote.url && browser.passed === true
    && browser.pluginId === 'ardesia.ideal-spring' && browser.pluginVersion === '1.0.0'
    && browser.objectId === remote.m1Browser.objectId && browser.instanceId === remote.m1Browser.instanceId
    && browser.savedRevision === remote.m1Browser.savedRevision && browser.reopenedRevision === browser.savedRevision
    && positiveInteger(browser.installedRevision) && Number.isSafeInteger(browser.activeRevision) && browser.activeRevision > browser.installedRevision
    && browser.reopenedInstallationRevision === browser.activeRevision
    && Number.isSafeInteger(browser.disabledRevision) && browser.disabledRevision > browser.activeRevision
    && browser.statePreserved === true && browser.consentPreserved === true && browser.disabled === true
    && JSON.stringify(browser.capabilities) === JSON.stringify(['state:read','state:write'])
    && JSON.stringify(browser.steps) === JSON.stringify(M2_LIFECYCLE_STEPS) && timestamp(browser.observedAt);
}
/** M2 cannot pass through a catalog mock, unit tests alone, or a remote record for another build. */
export function m2EvidenceMatches(evidence,current) {
  return m1EvidenceMatches(evidence,current) && m2UnitMatches(evidence.unit,evidence.verification)
    && m2BrowserMatches(evidence.browser,current) && m2RemoteBrowserMatches(evidence.release,current);
}

export const M3_BASELINE_ROOT = 'operations/baselines/m3/';
export const M3_BASELINE_REPORTS = Object.freeze(['verification.json', 'unit.json', 'browser-evidence.json', 'e2e.json',
  'release-evidence.json', 'm3-remote-evidence.json', 'status.json', 'platform-before.json', 'preflight.json',
  'browser.json', 'operator.json', 'postflight.json', 'platform-after.json', 'candidate.json', 'result.json']);

/** Preserve original bytes; the caller may read a worktree or an immutable Git revision. */
export function readM3Baseline(readText = file => readFileSync(file, 'utf8')) {
  try {
    return {manifest: JSON.parse(readText(M3_BASELINE_ROOT + 'manifest.json')),
      reports: Object.fromEntries(M3_BASELINE_REPORTS.map(name => [name, readText(M3_BASELINE_ROOT + name)]))};
  } catch {return null;}
}

/** Reuse the original gates and offline assembler, never the archived ACCEPTED flag alone. */
export function m3BaselineMatches(baseline) {
  try {
    const {manifest: m, reports} = baseline;
    if (!isRecord(m) || m.schemaVersion !== 1 || m.kind !== 'ardesia-m3-accepted-baseline'
      || m.repository !== 'AndreaMarro/ardesia-next' || !sha(m.source?.commit) || !digest(m.source?.sourceDigest)
      || !sha(m.source?.tree) || !sha(m.completionRef) || !timestamp(m.acceptedAt) || !httpsUrl(m.publication)
      || !isRecord(m.reports) || !isRecord(reports) || Object.keys(m.reports).length !== M3_BASELINE_REPORTS.length
      || Object.keys(reports).length !== M3_BASELINE_REPORTS.length || m.verify?.attempt !== 1 || !digest(m.verify?.artifactSha256)) return false;
    const parsed = {};
    for (const name of M3_BASELINE_REPORTS) {
      if (typeof reports[name] !== 'string' || !digest(m.reports[name])
        || createHash('sha256').update(reports[name]).digest('hex') !== m.reports[name]) return false;
      parsed[name] = JSON.parse(reports[name]);
    }
    const status = parsed['status.json'], remote = parsed['m3-remote-evidence.json'], release = parsed['release-evidence.json'];
    if (!matchesCurrent(status, m.source) || status.M3 !== 'ACCEPTED' || m.verify.url !== release.ci?.url
      || Date.parse(m.acceptedAt) < Date.parse(remote.observedAt) || parsed['result.json'].accepted !== true) return false;
    const current = {...m.source, generatedAt: remote.generatedAt};
    // Tree is source provenance, not a field of the original runtime report.
    delete current.tree;
    const evidence = {verification: parsed['verification.json'], unit: parsed['unit.json'],
      browser: parsed['browser-evidence.json'], playwright: parsed['e2e.json'], release, remote};
    if (!m1BrowserMatches(evidence.browser, current) || !m2BrowserMatches(evidence.browser, current)
      || !releaseEvidenceMatches(release, current) || !m3RemoteEvidenceMatches(evidence, current)) return false;
    const replay = assembleM3Acceptance({current, evidence, platformBefore: parsed['platform-before.json'],
      platformAfter: parsed['platform-after.json'], preflight: parsed['preflight.json'], postflight: parsed['postflight.json'],
      browser: parsed['browser.json'], operator: parsed['operator.json']});
    return replay.accepted === true && m3ReportDigest(replay.remote) === m3ReportDigest(remote)
      && m3ReportDigest(replay.release) === m3ReportDigest(release)
      && m3ReportDigest(parsed['candidate.json'].remote) === m3ReportDigest(remote)
      && m3ReportDigest(parsed['candidate.json'].release) === m3ReportDigest(release);
  } catch {return false;}
}

function runStatus() {
  const current = identity();
  const read = file => {try {return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;} catch {return null;}};
  const checks = read('artifacts/verification.json');
  const e2e = read('artifacts/browser-evidence.json');
  const unit = read('artifacts/unit.json');
  const remote = read('artifacts/release-evidence.json');
  const remoteM3 = read('artifacts/m3-remote-evidence.json');
  const environment = read('operations/m3-environment.json');
  const m3Evidence = {verification: checks, unit, browser: e2e, playwright: read('artifacts/e2e.json'), release: remote, remote: remoteM3};
  const localM3 = m3LocalEvidenceMatches(m3Evidence, current) && m1BrowserMatches(e2e, current) && m2BrowserMatches(e2e, current);
  const acceptedM3 = localM3 && m3RemoteEvidenceMatches(m3Evidence, current);
  const m3Baseline = readM3Baseline();
  const historicalM3 = m3BaselineMatches(m3Baseline);
  const baselineRoot = 'operations/baselines/m2/';
  const baseline = read(baselineRoot + 'status.json');
  const baselineAccepted = m2EvidenceMatches({verification: read(baselineRoot + 'verification.json'), unit: read(baselineRoot + 'unit.json'), browser: read(baselineRoot + 'browser-evidence.json'), release: read(baselineRoot + 'release-evidence.json')}, baseline); 
  const verified = Boolean(checks?.passed === true && checks.sourceDigest === current.sourceDigest && checks.commit === current.commit);
  const browserPassed = verified && e2e?.passed === true && e2e.sourceDigest === current.sourceDigest && e2e.commit === current.commit;
  const remoteMatches = releaseEvidenceMatches(remote, current);
  const m1Accepted = m1EvidenceMatches({verification: checks, unit, browser: e2e, release: remote}, current);
  const m2Accepted = m2EvidenceMatches({verification: checks, unit, browser: e2e, release: remote}, current);
  const m4Preparation = read('artifacts/m4-preparation.json');
  const m4Prepared = historicalM3 && m4PreparationMatches({verification: checks, unit, preparation: m4Preparation}, current);
  const m4Consumer = {...m3Evidence, preparation: m4Preparation, budget: read('artifacts/budget.json'), transport: read('artifacts/bundle-transport.json'),
    remoteConsumer: read('artifacts/m4-protected-preview-smoke.json'), platform: read('artifacts/platform-postflight.json')};
  const m4Local = historicalM3 && m4LocalConsumerMatches(m4Consumer, current);
  const m4Technical = historicalM3 && m4ConsumerEvidenceMatches(m4Consumer, current);
  const observedSource = {commit: remote?.commit, sourceDigest: remote?.sourceDigest};
  const observedM4 = historicalM3 && m4ConsumerEvidenceMatches(m4Consumer, observedSource);
  const state = {
    ...current, milestone: historicalM3 ? 'M4' : 'M3', foundationMilestone: 'M0',
    acceptedBaselines: [
      ...(baselineAccepted ? [{commit: baseline.commit, sourceDigest: baseline.sourceDigest, milestones: ['M0','M1','M2'], status: 'ACCEPTED', evidence: 'operations/baselines/m2', url: baseline.deployment.url}] : []),
      ...(historicalM3 ? [{...m3Baseline.manifest.source, milestones: ['M3'], status: 'ACCEPTED',
        evidence: 'operations/baselines/m3', url: JSON.parse(m3Baseline.reports['release-evidence.json']).url,
        completionRef: m3Baseline.manifest.completionRef}] : [])
    ],
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
    M2: m2Accepted ? 'ACCEPTED' : 'AWAITING_COMPLETE_EVIDENCE',
    m2Evidence: {
      coreCatalogAndHostTests: verified && m2UnitMatches(unit, checks) ? 'PASS' : 'MISSING_OR_FAILED_TEST_EVIDENCE',
      browserLifecycleAndCounterproofs: m2BrowserMatches(e2e, current) ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_SOURCE',
      protectedRemoteLifecycle: m2RemoteBrowserMatches(remote, current) ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_COMMIT'
    },
    M3: acceptedM3 ? 'ACCEPTED' : 'AWAITING_COMPLETE_EVIDENCE',
    M4: m4Technical ? 'TECHNICALLY_VERIFIED_DRAFT' : m4Local ? 'AWAITING_PROTECTED_CONSUMER' : m4Prepared ? 'AWAITING_WEB_CONSUMER' : m4Preparation ? 'PREPARATION_UNVERIFIED' : 'NOT_STARTED', M5: 'NOT_STARTED',
    m4Evidence: {signedHostCorePreparation: m4Prepared ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_SOURCE',
      webAndPostgresConsumer: m4Local ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_SOURCE',
      protectedRemoteConsumer: m4Technical ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_COMMIT', humanScientificEditorialReview: 'PENDING',
      observedConsumer: observedM4 ? {...observedSource, deploymentId: remote.deploymentId, url: remote.url, technical: 'PASS',
        matchesCurrentSource: matchesCurrent(remote, current), reportDigest: m3ReportDigest(m4Consumer.remoteConsumer)} : null,
      acceptanceRequires: 'Technical consumer evidence, scientific/editorial human acceptance and DRAFT remain distinct. Original reports stay bound to their own SHA/digest; a historical consumer never verifies changed source.'},
    m3Evidence: {
      historicalBaseline: historicalM3 ? 'ACCEPTED' : 'MISSING_OR_INVALID',
      localPostgresAndBrowser: localM3 ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_SOURCE',
      protectedRemoteContinuity: acceptedM3 ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_COMMIT',
      infrastructure: environment,
      acceptanceRequires: 'Distinct application identities, independent sessions, authorization, recovery and remote database observations on the same protected deployment SHA/digest'
    },
    limits: [...(acceptedM3 ? [] : ['Remote M3 acceptance incomplete; local PostgreSQL and browser tests do not establish remote continuity']), 'Only pinned first-party plugin execution; no third-party sandbox', 'No update or rollback release currently authorized in the shipped catalog', 'Physical pen/touch and human UX acceptance NOT_RUN', 'No public application deployment'],
    acceptedProductCriteria: 0, preservedProductCriteria: 68
  };
  mkdirSync('artifacts', {recursive: true});
  writeFileSync('artifacts/status.json', JSON.stringify(state, null, 2) + '\n');
  console.log(JSON.stringify(state, null, 2));
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runStatus();

