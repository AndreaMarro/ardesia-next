import {readFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {identity} from './evidence.mjs';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));
const httpsUrl = value => {
  if(typeof value !== 'string' || value.trim() !== value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {return null;}
};

function anonymousAccessIsProtected(protection, deploymentUrl) {
  if(!isRecord(protection) || protection.deploymentType !== 'all') return false;
  if([401,403].includes(protection.anonymousStatus)) return true;
  if(![302,303,307].includes(protection.anonymousStatus)) return false;
  const location = httpsUrl(protection.anonymousLocation);
  if(!location || location.origin !== 'https://vercel.com' || location.pathname !== '/sso-api') return false;
  const targets = location.searchParams.getAll('url');
  if(targets.length !== 1) return false;
  const target = httpsUrl(targets[0]);
  return Boolean(target && target.origin === deploymentUrl.origin);
}

/** Pure fail-closed gate. JSON Schema alone cannot compare decoded URL origins. */
export function releaseEvidenceMatches(remote, current) {
  if(!isRecord(remote) || !isRecord(current)) return false;
  const deploymentUrl = httpsUrl(remote.url);
  return Boolean(
    sha(current.commit) && digest(current.sourceDigest)
    && remote.commit === current.commit && remote.sourceDigest === current.sourceDigest
    && remote.repository === 'AndreaMarro/ardesia-next' && remote.visibility === 'private'
    && remote.status === 'READY' && remote.target === 'preview'
    && Object.hasOwn(remote, 'providerTarget') && ['staging',null].includes(remote.providerTarget)
    && deploymentUrl && typeof remote.deploymentId === 'string' && /^dpl_[A-Za-z0-9]{1,128}$/.test(remote.deploymentId)
    && timestamp(remote.observedAt)
    && isRecord(remote.ci) && remote.ci.headSha === current.commit && remote.ci.conclusion === 'success' && httpsUrl(remote.ci.url)
    && isRecord(remote.buildInfo) && remote.buildInfo.commit === current.commit && remote.buildInfo.sourceDigest === current.sourceDigest
    && remote.projectId === 'prj_GGKjCPG4cdgaQDQQMJoFvsy2ffSd'
    && anonymousAccessIsProtected(remote.protection, deploymentUrl)
  );
}

function runStatus() {
  const current = identity();
  const read = file => {try {return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;} catch {return null;}};
  const checks = read('artifacts/verification.json');
  const e2e = read('artifacts/browser-evidence.json');
  const remote = read('artifacts/release-evidence.json');
  const verified = Boolean(checks?.passed && checks.sourceDigest === current.sourceDigest && checks.commit === current.commit);
  const browserPassed = verified && e2e?.passed && e2e.sourceDigest === current.sourceDigest && e2e.commit === current.commit;
  const remoteMatches = releaseEvidenceMatches(remote, current);
  const state = {
    ...current, milestone: 'M0',
    verification: verified ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_SOURCE',
    browser: browserPassed ? 'PASS' : 'NOT_VERIFIED_FOR_CURRENT_SOURCE',
    deployment: remoteMatches ? remote : {status: 'NOT_VERIFIED_FOR_CURRENT_COMMIT'},
    productAcceptance: 'NOT_COMPLETE',
    M0: verified && browserPassed && remoteMatches ? 'ACCEPTED' : 'AWAITING_COMPLETE_EVIDENCE',
    M1: 'NOT_STARTED', M2: 'NOT_STARTED', M3: 'NOT_STARTED', M4: 'NOT_STARTED', M5: 'NOT_STARTED',
    limits: ['Device-only persistence', 'No application authentication or remote student authorization', 'No plugin execution in M0', 'Physical pen/touch and human UX acceptance NOT_RUN', 'No public release'],
    acceptedProductCriteria: 0, preservedProductCriteria: 68
  };
  mkdirSync('artifacts', {recursive: true});
  writeFileSync('artifacts/status.json', JSON.stringify(state, null, 2) + '\n');
  console.log(JSON.stringify(state, null, 2));
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runStatus();
