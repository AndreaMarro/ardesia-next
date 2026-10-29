import {mkdirSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {identity} from './evidence.mjs';
import {checkPluginBuild} from './build-plugin.mjs';
import {buildServer} from './build-server.mjs';
import {verifyServerBundle} from './server-bundle.test.mjs';
await checkPluginBuild();
const build = {...identity(), application: 'ardesia-next', milestone: 'M3', persistence: 'remote-postgres-required', remoteAcceptance: 'INCOMPLETE', thirdPartyExecution: false};
if(process.env.VERCEL && build.commit === 'local-uncommitted') throw new Error('Remote build requires a source SHA');
mkdirSync('apps/web/public', {recursive: true});
writeFileSync('apps/web/public/build-info.json', JSON.stringify(build, null, 2) + '\n');
const run = spawnSync('node_modules/.bin/vite', ['build', '--config', 'apps/web/vite.config.ts'], {stdio: 'inherit'});
if (run.status !== 0) process.exit(run.status ?? 1);
await buildServer();


if (process.argv.includes('--verify-runtime')) await verifyServerBundle();
