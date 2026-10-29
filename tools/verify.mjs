import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {identity} from './evidence.mjs';
mkdirSync('artifacts', {recursive: true});
const checks = [
  ['config-source', 'node', ['tools/check-config.mjs']],
  ['types', 'node_modules/.bin/tsc', ['--noEmit']],
  ['boundaries', 'node', ['tools/check-boundaries.mjs']],
  ['release-evidence', 'node', ['tools/status.test.mjs']],
  ['unit', 'node_modules/.bin/vitest', ['run', '--reporter=default', '--reporter=json', '--outputFile=artifacts/unit.json']],
  ['build', 'node', ['tools/build.mjs']],
  ['bundle-budget', 'node', ['tools/check-budget.mjs']]
];
const report = {...identity(), checks: [], passed: false};
for(const [name, cmd, args] of checks) {
  const result = spawnSync(cmd, args, {stdio: 'inherit'});
  report.checks.push({name, exitCode: result.status ?? 1, passed: result.status === 0});
  if(result.status !== 0) break;
}
report.passed = report.checks.length === checks.length && report.checks.every(check => check.passed);
writeFileSync('artifacts/verification.json', JSON.stringify(report, null, 2) + '\n');
process.exit(report.passed ? 0 : 1);
