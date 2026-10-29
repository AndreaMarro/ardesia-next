import {mkdirSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {identity} from './evidence.mjs';
import {checkPluginBuild} from './build-plugin.mjs';
await checkPluginBuild();
const build = {...identity(), application: 'ardesia-next', milestone: 'M2', persistence: 'device-only', thirdPartyExecution: false};
if(process.env.VERCEL && build.commit === 'local-uncommitted') throw new Error('Remote build requires a source SHA');
mkdirSync('apps/web/public', {recursive: true});
writeFileSync('apps/web/public/build-info.json', JSON.stringify(build, null, 2) + '\n');
const run = spawnSync('node_modules/.bin/vite', ['build', '--config', 'apps/web/vite.config.ts'], {stdio: 'inherit'});
process.exit(run.status ?? 1);

