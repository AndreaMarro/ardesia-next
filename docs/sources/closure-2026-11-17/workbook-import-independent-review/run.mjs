import {readFileSync,writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {dirname,resolve} from 'node:path';import {randomBytes} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {identity} from '../ardesia-next/tools/evidence.mjs';
import {localBrowserAccounts} from '../ardesia-next/tools/e2e-accounts.mjs';
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../ardesia-next');process.chdir(repo);
const source=identity(),built=JSON.parse(readFileSync('apps/web/dist/build-info.json','utf8'));
if(source.commit!==built.commit||source.sourceDigest!==built.sourceDigest)throw Error('Source/build identity mismatch');
const environment={...process.env,ARDESIA_E2E_MODE:'local',ARDESIA_E2E:'1',PORT:'4177',ARDESIA_E2E_BASE_URL:'http://127.0.0.1:4177'};
for(const[kind,user]of[['TEACHER','teacher-m3'],['STUDENT_A','student-a-m3'],['STUDENT_B','student-b-m3']]){environment[`ARDESIA_E2E_${kind}_USERNAME`]=user;environment[`ARDESIA_E2E_${kind}_PASSWORD`]=randomBytes(24).toString('base64url')}
localBrowserAccounts(environment);
writeFileSync(resolve(here,'run-identity.json'),JSON.stringify({source,built,mode:'local',origin:environment.ARDESIA_E2E_BASE_URL},null,2));
const r=spawnSync('node_modules/.bin/playwright',['test','--config',resolve(here,'playwright.config.ts')],{cwd:repo,env:environment,encoding:'utf8',timeout:180000});
writeFileSync(resolve(here,'browser.log'),(r.stdout||'')+(r.stderr||''));console.log((r.stdout||'')+(r.stderr||''));if(r.error)throw r.error;process.exitCode=r.status;
