import {spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync, rmSync, readFileSync, existsSync} from 'node:fs';
import {identity} from './evidence.mjs';
const runIdentity = identity();
mkdirSync('artifacts', {recursive:true});
const built = existsSync('apps/web/dist/build-info.json') ? JSON.parse(readFileSync('apps/web/dist/build-info.json', 'utf8')) : null;
if(!built || built.commit !== runIdentity.commit || built.sourceDigest !== runIdentity.sourceDigest) {
  console.error('Browser tests require a fresh build of this exact source. Run npm run verify first.');
  process.exit(1);
}
rmSync('artifacts/e2e.json', {force:true});
const result = spawnSync('node_modules/.bin/playwright', ['test', ...process.argv.slice(2)], {stdio:'inherit'});
const report = existsSync('artifacts/e2e.json') ? JSON.parse(readFileSync('artifacts/e2e.json', 'utf8')) : null;
const passed=result.status === 0 && report?.stats?.expected > 0 && report.stats.skipped === 0 && report.stats.unexpected === 0;
writeFileSync('artifacts/browser-evidence.json', JSON.stringify({...runIdentity, passed, stats:report?.stats ?? null, physicalDevices:'NOT_RUN'}, null, 2));
process.exit(passed ? 0 : 1);
