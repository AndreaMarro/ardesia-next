import {cpSync, mkdirSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {identity} from './evidence.mjs';
import {checkPluginBuild} from './build-plugin.mjs';
import {buildServer} from './build-server.mjs';
import {verifyServerBundle} from './server-bundle.test.mjs';
import {packWorkerTransport} from './pack-worker-transport.mjs';
import {buildOfflineShell} from './build-offline-shell.mjs';
import {buildProgramRuntime} from './build-program-runtime.mjs';
import {buildMcp} from './build-mcp.mjs';
import {verifyMcpRuntime} from './mcp-runtime.test.mjs';
await checkPluginBuild();
const build = {...identity(), application: 'ardesia-next', milestone: 'M3', persistence: 'remote-postgres-required', remoteAcceptance: 'INCOMPLETE', thirdPartyExecution: true, programRuntime: {abi: 'ardesia.program/1', policy: 'ephemeral-explicit-consent-no-io', engine: 'quickjs-emscripten@0.32.0'}};
if(process.env.VERCEL && build.commit === 'local-uncommitted') throw new Error('Remote build requires a source SHA');
mkdirSync('apps/web/public', {recursive: true});
writeFileSync('apps/web/public/build-info.json', JSON.stringify(build, null, 2) + '\n');
const run = spawnSync('node_modules/.bin/vite', ['build', '--config', 'apps/web/vite.config.ts'], {stdio: 'inherit'});
if (run.status !== 0) process.exit(run.status ?? 1);
for (const name of ['cmaps','standard_fonts','wasm']) cpSync('node_modules/pdfjs-dist/'+name,'apps/web/dist/pdf-runtime/'+name,{recursive:true});
packWorkerTransport();
await buildProgramRuntime();
buildOfflineShell(build);
await buildServer();
await buildMcp();


if (process.argv.includes('--verify-runtime')) {await verifyServerBundle(); await verifyMcpRuntime();}
