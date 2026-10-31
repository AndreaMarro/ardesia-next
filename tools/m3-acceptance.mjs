import {readFileSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {identity} from './evidence.mjs';
import {m3LocalEvidenceMatches, m3RemoteEvidenceMatches, m3ReportDigest, M3_REMOTE_CHECKS} from './m3-evidence.mjs';
import {releaseEvidenceMatches} from './status.mjs';
import {runRemotePreflight, preflightConfiguration} from './remote-preflight.mjs';
import {assertRemoteInvocation, resolveE2ETarget} from '../e2e/target.ts';

const operatorNames = ['expired', 'outage', 'backupRestore', 'import'];
const sameSource = (value, current) => value?.commit === current?.commit && value?.sourceDigest === current?.sourceDigest;
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN;
const sameDeployment = (a, b) => ['commit', 'sourceDigest', 'deploymentId', 'projectId', 'url', 'status'].every(key => a?.[key] === b?.[key]);
const safe = value => {
  if (typeof value === 'string') return !/(?:Bearer\s|(?:__Host-ardesia_session|ardesia_dev_session)=|postgres(?:ql)?:\/\/|eyJ[A-Za-z0-9_-]+\.)/i.test(value);
  if (!value || typeof value !== 'object') return true;
  return Object.entries(value).every(([key, child]) => !/password|cookie|authorization|secret|token|credential|api[-_]?key/i.test(key) && safe(child));
};

/** Produces a candidate report; the unchanged existing gate makes the final decision. */
export function assembleM3Acceptance(input) {
  const rejected = reason => ({accepted: false, reason, remote: null, release: null});
  try {
    if (!safe(input)) return rejected('UNSAFE_EVIDENCE');
    const {current, evidence, platformBefore: before, platformAfter: after, preflight: pre, postflight: post, browser, operator} = input;
    if (!sameSource(before, current) || !sameDeployment(before, after) || !sameDeployment(before, evidence.release)
      || before.status !== 'READY') return rejected('DEPLOYMENT_CHANGED_OR_UNVERIFIED');
    if (!/^[a-f0-9]{64}$/.test(before.databaseResourceIdHash ?? '') || before.databaseResourceIdHash !== after.databaseResourceIdHash
      || before.databaseResourceIdHash !== operator?.database?.resourceIdHash) return rejected('DATABASE_RESOURCE_CHANGED_OR_UNVERIFIED');
    if (![pre, post].every(p => p?.passed === true && p.buildIdentityMatched === true && p.origin === before.url
      && sameSource(p.expected, current) && sameSource(p.observedBuild, current))) return rejected('PREFLIGHT_OR_POSTFLIGHT_FAILED');
    if (!sameSource(browser, current) || browser.url !== before.url || browser.deploymentId !== before.deploymentId
      || !(time(before.observedAt) <= time(pre.startedAt) && time(pre.completedAt) <= time(browser.startedAt)
        && time(browser.startedAt) <= time(browser.completedAt) && time(browser.completedAt) <= time(post.startedAt)
        && time(post.startedAt) <= time(post.completedAt) && time(post.completedAt) <= time(after.observedAt))) return rejected('BROWSER_IDENTITY_OR_TIME_MISMATCH');
    if (!sameDeployment(operator, before) || operator.isolation?.sourceReadOnly !== true
      || operator.isolation?.restoreTargetInitiallyEmpty !== true || operator.isolation?.sharedServiceInterrupted !== false
      || !(time(browser.completedAt) <= time(operator.startedAt) && time(operator.startedAt) <= time(operator.completedAt)
        && time(operator.completedAt) <= time(post.startedAt))) return rejected('ISOLATED_OPERATOR_EVIDENCE_REQUIRED');
    const checks = {};
    for (const name of M3_REMOTE_CHECKS) {
      const source = operatorNames.includes(name) ? operator : browser;
      const proof = source.checks?.[name];
      if (!proof || !(time(source.startedAt) <= time(proof.observedAt) && time(proof.observedAt) <= time(source.completedAt))) return rejected('MISSING_OR_OUT_OF_WINDOW_COUNTERPROOF');
      checks[name] = structuredClone(proof);
    }
    // No success is inferred from a fixture, regression summary, READY, or a count.
    const remote = {...current, schemaVersion: 1, kind: 'ardesia-m3-remote-browser', runner: 'playwright', passed: true,
      url: before.url, deploymentId: before.deploymentId, observedAt: after.observedAt, database: operator.database,
      accounts: browser.accounts, sessions: browser.sessions, continuity: browser.continuity, checks,
      stats: {passed: M3_REMOTE_CHECKS.length, failed: 0, skipped: 0, flaky: 0},
      provenance: {platformBeforeDigest: m3ReportDigest(before), platformAfterDigest: m3ReportDigest(after),
        preflightDigest: m3ReportDigest(pre), postflightDigest: m3ReportDigest(post), browserDigest: m3ReportDigest(browser), operatorDigest: m3ReportDigest(operator)}};
    const release = {...evidence.release, m3ReportDigest: m3ReportDigest(remote)};
    if (!m3RemoteEvidenceMatches({...evidence, remote, release}, current)) return rejected('EXISTING_M3_GATE_REJECTED');
    return {accepted: true, reason: null, remote, release};
  } catch {return rejected('INCOMPLETE_OR_INVALID_EVIDENCE');}
}

/** Never let driver diagnostics, arbitrary errors or supplied credentials enter reports. */
export function acceptanceConfiguration(env, current) {
  const target = resolveE2ETarget(env);
  assertRemoteInvocation(target, env, []);
  if (env.NODE_OPTIONS) throw Error('REMOTE_DIAGNOSTICS_REFUSED');
  preflightConfiguration(env, current);
  const names = ['TEACHER', 'STUDENT_A', 'STUDENT_B'];
  const users = names.map(name => env[`ARDESIA_E2E_${name}_USERNAME`]);
  if (new Set(users).size !== 3 || names.some((name, i) => !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(users[i] ?? '')
    || typeof env[`ARDESIA_E2E_${name}_PASSWORD`] !== 'string' || env[`ARDESIA_E2E_${name}_PASSWORD`].length < 16
    || env[`ARDESIA_E2E_${name}_PASSWORD`].length > 256)) throw Error('EXISTING_DISTINCT_QA_IDENTITIES_REQUIRED');
  return target;
}

async function main(assembleOnly = false) {
  const current = identity(), target = assembleOnly
    ? resolveE2ETarget({ARDESIA_E2E_MODE: 'remote', ARDESIA_E2E_BASE_URL: 'https://ardesia-next-staging.vercel.app'})
    : acceptanceConfiguration(process.env, current);
  const read = path => JSON.parse(readFileSync(path, 'utf8'));
  const dir = 'artifacts/m3-acceptance';
  mkdirSync(dir, {recursive: true});
  // Clear only our own old acceptance candidate, never regression or local/release input evidence.
  for (const name of ['result.json', 'candidate.json']) rmSync(`${dir}/${name}`, {force: true});
  const write = (name, data) => {if (!safe(data)) throw Error('UNSAFE_EVIDENCE'); writeFileSync(`${dir}/${name}.json`, JSON.stringify(data, null, 2) + '\n', {mode: 0o600});};
  const before = read(process.env.ARDESIA_QA_PLATFORM_BEFORE_FILE ?? `${dir}/platform-before.json`);
  const evidence = {verification: read('artifacts/verification.json'), unit: read('artifacts/unit.json'),
    browser: read('artifacts/browser-evidence.json'), playwright: read('artifacts/e2e.json'), release: read('artifacts/release-evidence.json')};
  if (!sameSource(before, current) || !sameDeployment(before, evidence.release) || before.url !== target.origin
    || !m3LocalEvidenceMatches(evidence, current) || !releaseEvidenceMatches(evidence.release, current)) throw Error('VERIFIED_RELEASE_REQUIRED');
  let preflight, postflight, browser, operator = null;
  if (assembleOnly) {
    preflight = read(`${dir}/preflight.json`); postflight = read(`${dir}/postflight.json`); browser = read(`${dir}/browser.json`);
    try {operator = read(`${dir}/operator.json`);} catch { /* Missing proof remains missing. */ }
  } else {
    // A prior run's operator result cannot satisfy a newly collected browser run.
    rmSync(`${dir}/operator.json`, {force: true});
    preflight = await runRemotePreflight({expected: current}); write('preflight', preflight);
    if (!preflight.passed) throw Error('PREFLIGHT_FAILED');
    // Imports are delayed until all authorization/configuration checks have passed.
    const {chromium} = await import('@playwright/test');
    const {collectBrowserAcceptance} = await import('./m3-browser.mjs');
    const browserProcess = await chromium.launch({env: Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'LANG', 'LD_LIBRARY_PATH']
      .filter(key => typeof process.env[key] === 'string').map(key => [key, process.env[key]]))});
    try {browser = await collectBrowserAcceptance({browser: browserProcess, current, deployment: before, origin: target.origin});}
    finally {await browserProcess.close();}
    write('browser', browser);
    if (process.env.ARDESIA_QA_OPERATOR_DATABASE_URL && process.env.ARDESIA_QA_RESTORE_DATABASE_URL) {
      const {collectOperatorAcceptance} = await import('./m3-operator.mjs');
      try {operator = await collectOperatorAcceptance({current, deployment: before, browser}); write('operator', operator);}
      catch {write('operator-blocked', {completed: false, reason: 'ISOLATED_OPERATOR_PROBES_NOT_COMPLETED'});}
    }
    postflight = await runRemotePreflight({expected: current}); write('postflight', postflight);
  }
  let after = null;
  try {after = read(process.env.ARDESIA_QA_PLATFORM_AFTER_FILE ?? `${dir}/platform-after.json`);} catch { /* Platform metadata is an independent authorized observation. */ }
  const result = assembleM3Acceptance({current, evidence, platformBefore: before, platformAfter: after, preflight, postflight, browser, operator});
  write('result', {accepted: result.accepted, reason: result.reason, missing: M3_REMOTE_CHECKS.filter(name => !browser.checks?.[name] && !operator?.checks?.[name]),
    candidateCommit: current.commit, sourceDigest: current.sourceDigest, m3Acceptance: result.accepted ? 'ACCEPTED' : 'AWAITING_COMPLETE_EVIDENCE'});
  if (result.accepted) write('candidate', {remote: result.remote, release: result.release});
  // Promotion of candidate evidence into release inputs remains explicit and atomic for the coordinator.
  console.log(JSON.stringify({accepted: result.accepted, reason: result.reason, report: `${dir}/result.json`}));
  process.exitCode = result.accepted ? 0 : 1;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2), assembleOnly = args.length === 1 && args[0] === '--assemble';
  if (args.length && !assembleOnly) {console.error('M3 acceptance accepts only the offline --assemble mode; diagnostic overrides are refused.'); process.exitCode = 1;}
  else main(assembleOnly).catch(() => {console.error('M3 acceptance incomplete; no release evidence was promoted.'); process.exitCode = 1;});
}
