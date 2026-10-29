import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync, rmSync, readFileSync, existsSync} from 'node:fs';
import {identity} from './evidence.mjs';
import {M1_REQUIRED_FLOWS, M2_REQUIRED_FLOWS} from './status.mjs';
import {M3_REQUIRED_FLOWS, m3ReportDigest} from './m3-evidence.mjs';
const runIdentity = identity();
mkdirSync('artifacts', {recursive:true});
const built = existsSync('apps/web/dist/build-info.json') ? JSON.parse(readFileSync('apps/web/dist/build-info.json', 'utf8')) : null;
if(!built || built.commit !== runIdentity.commit || built.sourceDigest !== runIdentity.sourceDigest) {
  console.error('Browser tests require a fresh build of this exact source. Run npm run verify first.');
  process.exit(1);
}
rmSync('artifacts/e2e.json', {force:true});
const browserEnvironment = {...process.env, ARDESIA_E2E: '1'};
for (const [name, username] of [['TEACHER','teacher-m3'],['STUDENT_A','student-a-m3'],['STUDENT_B','student-b-m3']]) {
  browserEnvironment[`ARDESIA_E2E_${name}_USERNAME`] ||= username;
  browserEnvironment[`ARDESIA_E2E_${name}_PASSWORD`] ||= randomBytes(24).toString('base64url');
}
const result = spawnSync('node_modules/.bin/playwright', ['test', ...process.argv.slice(2)], {stdio:'inherit', env:browserEnvironment});
const report = existsSync('artifacts/e2e.json') ? JSON.parse(readFileSync('artifacts/e2e.json', 'utf8')) : null;
const passed=result.status === 0 && report?.stats?.expected > 0 && report.stats.skipped === 0 && report.stats.unexpected === 0 && report.stats.flaky === 0;
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
writeFileSync('artifacts/browser-evidence.json', JSON.stringify({...runIdentity, passed, m1Passed, m1Flows, m2Passed, m2Flows, m3Passed, m3Flows, reportDigest: m3ReportDigest(report), stats:report?.stats ?? null, physicalDevices:'NOT_RUN'}, null, 2));
process.exit(passed ? 0 : 1);
