import {readFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {identity} from './evidence.mjs';
const current = identity();
const read = file => {try {return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;} catch {return null;}};
const checks = read('artifacts/verification.json');
const e2e = read('artifacts/browser-evidence.json');
const remote = read('artifacts/release-evidence.json');
const verified = Boolean(checks?.passed && checks.sourceDigest === current.sourceDigest && checks.commit === current.commit);
const browserPassed = verified && e2e?.passed && e2e.sourceDigest === current.sourceDigest && e2e.commit === current.commit;
const remoteMatches = remote?.commit === current.commit && remote?.sourceDigest === current.sourceDigest
  && remote?.repository === 'AndreaMarro/ardesia-next' && remote?.visibility === 'private'
  && remote?.ci?.headSha === current.commit && remote?.ci?.conclusion === 'success'
  && remote?.buildInfo?.commit === current.commit && remote?.buildInfo?.sourceDigest === current.sourceDigest
  && remote?.projectId === 'prj_GGKjCPG4cdgaQDQQMJoFvsy2ffSd'
  && remote?.protection?.deploymentType === 'all' && [401,403].includes(remote?.protection?.anonymousStatus);
const state = {
  ...current, milestone: 'M0',
  verification: verified ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_SOURCE',
  browser: browserPassed ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_SOURCE',
  deployment: remoteMatches ? remote : {status: 'NOT_VERIFIED_FOR_CURRENT_COMMIT'},
  productAcceptance: 'NOT_COMPLETE',
  M0: verified && browserPassed && remoteMatches && remote?.status === 'READY' && remote?.target === 'preview' ? 'ACCEPTED' : 'AWAITING_COMPLETE_EVIDENCE',
  M1: 'NOT_STARTED', M2: 'NOT_STARTED', M3: 'NOT_STARTED', M4: 'NOT_STARTED', M5: 'NOT_STARTED',
  limits: ['Device-only persistence', 'No application authentication or remote student authorization', 'No plugin execution in M0', 'Physical pen/touch and human UX acceptance NOT_RUN', 'No public release'],
  acceptedProductCriteria: 0, preservedProductCriteria: 68
};
mkdirSync('artifacts', {recursive: true});
writeFileSync('artifacts/status.json', JSON.stringify(state, null, 2) + '\n');
console.log(JSON.stringify(state, null, 2));
