import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync, rmSync, readFileSync, existsSync} from 'node:fs';
import {dirname} from 'node:path';
import {assertRemoteInvocation, resolveE2ETarget} from '../e2e/target.ts';
import {identity} from './evidence.mjs';
import {M1_REQUIRED_FLOWS, M2_REQUIRED_FLOWS} from './status.mjs';
import {M3_REQUIRED_FLOWS, m3ReportDigest} from './m3-evidence.mjs';
import {preflightConfiguration, preflightPath, runRemotePreflight} from './remote-preflight.mjs';
// Validate the target before touching evidence or launching a process. In particular,
// an external URL alone must never combine remote API writes with local navigation.
const target = resolveE2ETarget(), args = process.argv.slice(2);
assertRemoteInvocation(target, process.env, args);
const accounts = [['TEACHER','teacher-m3'],['STUDENT_A','student-a-m3'],['STUDENT_B','student-b-m3']];
const browserEnvironment = {...process.env, ARDESIA_E2E_MODE: target.mode, ARDESIA_E2E_BASE_URL: target.origin};
if (target.mode === 'remote') {
  browserEnvironment.PLAYWRIGHT_NO_COPY_PROMPT = '1';
  const usernames = new Set();
  for (const [name] of accounts) {
    const username = browserEnvironment[`ARDESIA_E2E_${name}_USERNAME`];
    const password = browserEnvironment[`ARDESIA_E2E_${name}_PASSWORD`];
    if (!username || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username) || !password || password.length < 16 || password.length > 256) {
      throw Error(`Remote regression requires existing synthetic ${name} credentials; no accounts are provisioned.`);
    }
    usernames.add(username);
  }
  if (usernames.size !== 3) throw Error('Remote regression requires three distinct synthetic accounts.');
  for (const key of ['ARDESIA_E2E', 'ARDESIA_DATABASE_URL', 'ARDESIA_OPERATOR_DATABASE_URL',
    'M3_BROWSER_DATABASE_URL', 'M3_TEST_DATABASE_URL', 'M3_TEST_ADMIN_DATABASE_URL',
    'PLAYWRIGHT_JSON_OUTPUT_FILE', 'PLAYWRIGHT_JSON_OUTPUT_NAME', 'PLAYWRIGHT_JSON_OUTPUT_DIR',
    'PWDEBUG', 'DEBUG', 'DEBUG_FILE', 'NODE_DEBUG', 'NODE_OPTIONS', 'VERCEL_TOKEN']) delete browserEnvironment[key];
} else {
  browserEnvironment.ARDESIA_E2E = '1';
  for (const [name, username] of accounts) {
    browserEnvironment[`ARDESIA_E2E_${name}_USERNAME`] ||= username;
    browserEnvironment[`ARDESIA_E2E_${name}_PASSWORD`] ||= randomBytes(24).toString('base64url');
  }
}
const runIdentity = identity();
if (target.mode === 'remote') preflightConfiguration(process.env, runIdentity);
if (target.mode === 'local') {
  const built = existsSync('apps/web/dist/build-info.json') ? JSON.parse(readFileSync('apps/web/dist/build-info.json', 'utf8')) : null;
  if (!built || built.commit !== runIdentity.commit || built.sourceDigest !== runIdentity.sourceDigest) {
    console.error('Browser tests require a fresh build of this exact source. Run npm run verify first.');
    process.exit(1);
  }
}
mkdirSync(dirname(target.reportPath), {recursive:true});
rmSync(target.reportPath, {force:true});
if (target.mode === 'remote') {
  rmSync(target.summaryPath, {force:true});
  rmSync('artifacts/remote-continuity/postflight.json', {force:true});
}
let preflight = null;
if (target.mode === 'remote') {
  preflight = await runRemotePreflight({expected: runIdentity});
  writeFileSync(preflightPath, JSON.stringify(preflight, null, 2) + '\n');
  if (!preflight.passed) {
    writeFileSync(target.summaryPath, JSON.stringify({kind:'ardesia-remote-continuity-regression',
      testSource:runIdentity, origin:target.origin, suitePassed:false, flows:[], reportDigest:null, stats:null,
      preflightPassed:false, preflightDigest:m3ReportDigest(preflight), buildIdentityMatched:preflight.buildIdentityMatched,
      deploymentIdentityVerified:false, m3Acceptance:'NOT_EVALUATED'}, null, 2) + '\n');
    console.error(`Remote preflight failed: ${preflight.failureCode}. No browser login or test workspace was started.`);
    process.exit(1);
  }
}
const result = spawnSync('node_modules/.bin/playwright', ['test', ...args], {stdio:'inherit', env:browserEnvironment});
let report = null;
try {if (existsSync(target.reportPath)) report = JSON.parse(readFileSync(target.reportPath, 'utf8'));}
catch {console.error('The browser report is not valid JSON; this run cannot pass.');}
const passed=!result.error && result.status === 0 && report?.stats?.expected > 0 && report.stats.skipped === 0 && report.stats.unexpected === 0 && report.stats.flaky === 0;
const m1Flows = [], m2Flows = [], m3Flows = [];
function collect(suites) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      const target = spec.title?.startsWith('[M1] ') && spec.file?.endsWith('plugin-lab.spec.ts') ? m1Flows : spec.title?.startsWith('[M2] ') && spec.file?.endsWith('marketplace.spec.ts') ? m2Flows : spec.title?.startsWith('[M3] ') && spec.file?.endsWith('remote-continuity.spec.ts') ? m3Flows : null;
      if (!target) continue;
      for (const test of spec.tests ?? []) {
        if (spec.ok && test.status === 'expected' && test.results?.length > 0 && test.results.every(result => result.status === 'passed')) target.push(`${test.projectName}::${spec.title}`);
      }
    }
    collect(suite.suites);
  }
}
collect(report?.suites);
const m1Passed = passed && M1_REQUIRED_FLOWS.every(flow => m1Flows.includes(flow)) && new Set(m1Flows).size === m1Flows.length;
const m2Passed = passed && M2_REQUIRED_FLOWS.every(flow => m2Flows.includes(flow)) && new Set(m2Flows).size === m2Flows.length;
const m3Passed = passed && M3_REQUIRED_FLOWS.every(flow => m3Flows.includes(flow)) && new Set(m3Flows).size === m3Flows.length;
if (target.mode === 'remote') {
  // This is deliberately not the acceptance report consumed by status.mjs. The
  // three regression scenarios do not supply all twelve remote M3 counterproofs.
  let postflight = null;
  if (m3Passed) {
    postflight = await runRemotePreflight({expected: runIdentity});
    writeFileSync('artifacts/remote-continuity/postflight.json', JSON.stringify(postflight, null, 2) + '\n');
  }
  const remotePassed = m3Passed && postflight?.passed === true;
  writeFileSync(target.summaryPath, JSON.stringify({kind:'ardesia-remote-continuity-regression',
    testSource:runIdentity, origin:target.origin, suitePassed:remotePassed, flows:m3Flows,
    reportDigest:m3ReportDigest(report), stats:report?.stats ?? null,
    preflightPassed:preflight.passed, preflightDigest:m3ReportDigest(preflight), buildIdentityMatched:preflight.buildIdentityMatched,
    postflightPassed:postflight?.passed ?? false, postflightDigest:m3ReportDigest(postflight),
    deploymentIdentityVerified:false, m3Acceptance:'NOT_EVALUATED'}, null, 2) + '\n');
  process.exit(remotePassed ? 0 : 1);
}
writeFileSync(target.summaryPath, JSON.stringify({...runIdentity, passed, m1Passed, m1Flows, m2Passed, m2Flows, m3Passed, m3Flows, reportDigest: m3ReportDigest(report), stats:report?.stats ?? null, physicalDevices:'NOT_RUN'}, null, 2));
process.exit(passed ? 0 : 1);
