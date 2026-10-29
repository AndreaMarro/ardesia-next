import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseEvidenceMatches} from './status.mjs';

const current = {commit: 'a'.repeat(40), sourceDigest: 'b'.repeat(64)};
const deployment = 'https://ardesia-next-test-andreas-projects-6d4e9791.vercel.app';
const redirect = url => `https://vercel.com/sso-api?url=${encodeURIComponent(url)}&nonce=observed-test-nonce`;
const evidence = () => ({
  repository: 'AndreaMarro/ardesia-next', visibility: 'private', ...current,
  projectId: 'prj_GGKjCPG4cdgaQDQQMJoFvsy2ffSd', status: 'READY', target: 'preview', providerTarget: 'staging',
  url: deployment, deploymentId: 'dpl_TestObservedDeployment123',
  ci: {headSha: current.commit, conclusion: 'success', url: 'https://github.com/AndreaMarro/ardesia-next/actions/runs/123'},
  buildInfo: {...current}, observedAt: '2026-10-29T01:00:00.000Z',
  protection: {deploymentType: 'all', anonymousStatus: 302, anonymousLocation: redirect(deployment)}
});

test('observed Vercel SSO redirects are accepted only for the deployment origin', () => {
  for(const status of [302,303,307]) {
    const remote = evidence();
    remote.protection.anonymousStatus = status;
    assert.equal(releaseEvidenceMatches(remote, current), true, `HTTP ${status}`);
  }
  const remote = evidence();
  remote.protection.anonymousLocation = redirect(`${deployment}/lesson?view=board`);
  assert.equal(releaseEvidenceMatches(remote, current), true);
});

test('401/403 remain valid and an explicit null provider target is preview', () => {
  for(const status of [401,403]) {
    const remote = evidence();
    remote.providerTarget = null;
    remote.protection.anonymousStatus = status;
    delete remote.protection.anonymousLocation;
    assert.equal(releaseEvidenceMatches(remote, current), true);
  }
});

test('anonymous 200, unrecognized status and incomplete redirects fail closed', () => {
  for(const status of [200,301,308,500,'302']) {
    const remote = evidence();
    remote.protection.anonymousStatus = status;
    assert.equal(releaseEvidenceMatches(remote, current), false, `HTTP ${status}`);
  }
  const remote = evidence();
  delete remote.protection.anonymousLocation;
  assert.equal(releaseEvidenceMatches(remote, current), false);
});

test('spoofed host, protocol, path and different decoded target origin are rejected', () => {
  const invalid = [
    redirect(deployment).replace('vercel.com/', 'vercel.com.evil.example/'),
    redirect(deployment).replace('vercel.com/', 'evil.example/'),
    redirect(deployment).replace('https://vercel.com/', 'http://vercel.com/'),
    redirect(deployment).replace('/sso-api?', '/login?'),
    redirect(deployment).replace('vercel.com/', 'vercel.com:444/'),
    redirect('https://another-deployment.vercel.app'),
    redirect(deployment.replace('https:', 'http:')),
    `${redirect(deployment)}&url=${encodeURIComponent('https://evil.example')}`,
    'https://vercel.com/sso-api?nonce=missing-url',
    'https://vercel.com/sso-api?url=%2Frelative',
  ];
  for(const location of invalid) {
    const remote = evidence();
    remote.protection.anonymousLocation = location;
    assert.equal(releaseEvidenceMatches(remote, current), false, location);
  }
});

test('a production provider target never becomes a preview by relabeling evidence', () => {
  for(const providerTarget of ['production','preview',undefined,{}]) {
    const remote = evidence();
    remote.providerTarget = providerTarget;
    assert.equal(releaseEvidenceMatches(remote, current), false);
  }
  const remote = evidence();
  delete remote.providerTarget;
  assert.equal(releaseEvidenceMatches(remote, current), false);
  remote.providerTarget = 'staging';
  remote.target = 'production';
  assert.equal(releaseEvidenceMatches(remote, current), false);
});

test('source, build-info and CI must all correspond to the current immutable revision', () => {
  const changes = [
    remote => {remote.sourceDigest = 'c'.repeat(64);},
    remote => {remote.commit = 'c'.repeat(40);},
    remote => {remote.buildInfo.sourceDigest = 'c'.repeat(64);},
    remote => {remote.buildInfo.commit = 'c'.repeat(40);},
    remote => {remote.ci.headSha = 'c'.repeat(40);},
    remote => {remote.ci.conclusion = 'failure';},
  ];
  for(const change of changes) {
    const remote = evidence();
    change(remote);
    assert.equal(releaseEvidenceMatches(remote, current), false);
  }
});

test('essential state, URL, deployment identity and observation time cannot be omitted', () => {
  for(const key of ['status','target','providerTarget','url','deploymentId','observedAt','ci','buildInfo','protection','projectId','repository','visibility']) {
    const remote = evidence();
    delete remote[key];
    assert.equal(releaseEvidenceMatches(remote, current), false, key);
  }
  for(const [key,value] of [['status','BUILDING'],['url','http://example.com'],['url','https://username:password@example.com'],['deploymentId',''],['observedAt','yesterday'],['observedAt','2026-99-99T00:00:00Z']]) {
    const remote = evidence();
    remote[key] = value;
    assert.equal(releaseEvidenceMatches(remote, current), false, `${key}: ${value}`);
  }
  const remote = evidence();
  delete remote.ci.url;
  assert.equal(releaseEvidenceMatches(remote, current), false);
  assert.equal(releaseEvidenceMatches(null, current), false);
  assert.equal(releaseEvidenceMatches(evidence(), {}), false);
});
