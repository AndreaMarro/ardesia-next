import './m3-evidence.test.mjs';
import './e2e-target.test.mjs';
import './e2e-runner.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseEvidenceMatches, m1EvidenceMatches, M1_REQUIRED_FLOWS, unitReportDigest, m2EvidenceMatches, M2_REQUIRED_FLOWS, M2_LIFECYCLE_STEPS} from './status.mjs';

const current = {commit: 'a'.repeat(40), sourceDigest: 'b'.repeat(64)};
const deployment = 'https://ardesia-next-test-andreas-projects-6d4e9791.vercel.app';
const redirect = url => `https://vercel.com/sso-api?url=${encodeURIComponent(url)}&nonce=observed-test-nonce`;
const releaseFixture = (visibility = 'private') => ({
  repository: 'AndreaMarro/ardesia-next', visibility, ...current,
  ...(visibility === 'public' ? {sourcePublication: {kind: 'explicit-owner-instruction', owner: 'AndreaMarro',
    repository: 'AndreaMarro/ardesia-next', visibility: 'public', scope: 'source-only', recordedAt: '2026-10-29T00:00:00.000Z'}} : {}),
  projectId: 'prj_GGKjCPG4cdgaQDQQMJoFvsy2ffSd', status: 'READY', target: 'preview', providerTarget: 'staging',
  url: deployment, deploymentId: 'dpl_TestObservedDeployment123',
  ci: {headSha: current.commit, conclusion: 'success', url: 'https://github.com/AndreaMarro/ardesia-next/actions/runs/123'},
  buildInfo: {...current}, observedAt: '2026-10-29T01:00:00.000Z',
  protection: {deploymentType: 'all', anonymousStatus: 302, anonymousLocation: redirect(deployment)}
});

const evidence = () => releaseFixture();

test('public source requires a closed, explicit owner instruction limited to this repository source', () => {
  assert.equal(releaseEvidenceMatches(evidence(), current), true, 'historical private evidence remains valid');
  assert.equal(releaseEvidenceMatches(releaseFixture('public'), current), true);
  const absent = releaseFixture('public'); delete absent.sourcePublication;
  assert.equal(releaseEvidenceMatches(absent, current), false);
  for (const field of Object.keys(releaseFixture('public').sourcePublication)) {
    const remote = releaseFixture('public'); delete remote.sourcePublication[field];
    assert.equal(releaseEvidenceMatches(remote, current), false, `missing ${field}`);
  }
  for (const value of [null, true, 'approved', [], {}]) {
    const remote = releaseFixture('public'); remote.sourcePublication = value;
    assert.equal(releaseEvidenceMatches(remote, current), false);
  }
  for (const [field, value] of [
    ['kind', 'implicit'], ['owner', 'another-owner'], ['repository', 'AndreaMarro/ardesia'],
    ['visibility', 'private'], ['scope', 'application'], ['extra', true],
    ['recordedAt', '2026-10-29'], ['recordedAt', '2026-10-29T00:00:00+00:00'],
    ['recordedAt', '2026-02-30T00:00:00Z'], ['recordedAt', '2026-10-29T02:00:00Z'],
  ]) {
    const remote = releaseFixture('public'); remote.sourcePublication[field] = value;
    assert.equal(releaseEvidenceMatches(remote, current), false, `invalid ${field}`);
  }
  for (const visibility of ['internal', 'PUBLIC', true, null]) {
    const remote = releaseFixture('public'); remote.visibility = visibility;
    assert.equal(releaseEvidenceMatches(remote, current), false);
  }
  const pending = releaseFixture('public'); pending.visibility = 'private';
  assert.equal(releaseEvidenceMatches(pending, current), true, 'an instruction does not claim a completed visibility change');
  pending.sourcePublication.scope = 'application';
  assert.equal(releaseEvidenceMatches(pending, current), false, 'present records must satisfy the schema even for private source');
});

for (const visibility of ['private', 'public']) {
  const evidence = () => releaseFixture(visibility);
  const testVisibility = (name, run) => test(`${visibility} source: ${name}`, run);

testVisibility('observed Vercel SSO redirects are accepted only for the deployment origin', () => {
  for(const status of [302,303,307]) {
    const remote = evidence();
    remote.protection.anonymousStatus = status;
    assert.equal(releaseEvidenceMatches(remote, current), true, `HTTP ${status}`);
  }
  const remote = evidence();
  remote.protection.anonymousLocation = redirect(`${deployment}/lesson?view=board`);
  assert.equal(releaseEvidenceMatches(remote, current), true);
});

testVisibility('401/403 remain valid and an explicit null provider target is preview', () => {
  for(const status of [401,403]) {
    const remote = evidence();
    remote.providerTarget = null;
    remote.protection.anonymousStatus = status;
    delete remote.protection.anonymousLocation;
    assert.equal(releaseEvidenceMatches(remote, current), true);
  }
});

testVisibility('anonymous 200, unrecognized status and incomplete redirects fail closed', () => {
  for(const status of [200,301,308,500,'302']) {
    const remote = evidence();
    remote.protection.anonymousStatus = status;
    assert.equal(releaseEvidenceMatches(remote, current), false, `HTTP ${status}`);
  }
  const remote = evidence();
  delete remote.protection.anonymousLocation;
  assert.equal(releaseEvidenceMatches(remote, current), false);
  const partial = evidence(); partial.protection.deploymentType = 'preview';
  assert.equal(releaseEvidenceMatches(partial, current), false, 'all deployment protection is still required');
});

testVisibility('spoofed host, protocol, path and different decoded target origin are rejected', () => {
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

testVisibility('a production provider target never becomes a preview by relabeling evidence', () => {
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

testVisibility('source, build-info and CI must all correspond to the current immutable revision', () => {
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

testVisibility('essential state, URL, deployment identity and observation time cannot be omitted', () => {
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

}

const m1Evidence = () => {
  const data = {
  verification: {
    ...current, passed: true,
    checks: ['config-source', 'types', 'boundaries', 'release-evidence', 'unit', 'signed-plugin', 'build', 'bundle-budget']
      .map(name => ({name, passed: true, exitCode: 0}))
  },
  unit: {
    success: true, numTotalTests: 4, numPassedTests: 4, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0,
    numTotalTestSuites: 4, numPassedTestSuites: 4, numFailedTestSuites: 0, numPendingTestSuites: 0,
    testResults: [
      'packages/plugin-host/src/runtime.test.ts', 'plugins/ideal-spring/src/model.test.ts',
      'plugins/ideal-spring/src/handler.test.ts', 'packages/core/src/lab.test.ts'
    ].map(name => ({name: `/ci/ardesia-next/${name}`, status: 'passed', assertionResults: [{title: 'observed passing assertion', status: 'passed', failureMessages: []}]}))
  },
  browser: {
    ...current, passed: true, m1Passed: true, m1Flows: [...M1_REQUIRED_FLOWS],
    stats: {expected: M1_REQUIRED_FLOWS.length, skipped: 0, unexpected: 0, flaky: 0}
  },
  release: {
    ...evidence(),
    m1Browser: {
      ...current, url: deployment, passed: true,
      objectId: 'lab-fixture-1', instanceId: 'spring-instance-1',
      savedRevision: 2, reopenedRevision: 2, statePreserved: true,
      observedAt: '2026-10-29T01:05:00.000Z'
    }
  }
  };
  data.verification.unitReportDigest = unitReportDigest(data.unit);
  return data;
};

test('M1 accepts only a complete current-source local and protected remote experiment', () => {
  assert.equal(M1_REQUIRED_FLOWS.length, 14);
  assert.equal(m1EvidenceMatches(m1Evidence(), current), true);
  assert.equal(releaseEvidenceMatches(m1Evidence().release, current), true);
  assert.equal(m1EvidenceMatches(null, current), false);
  assert.equal(m1EvidenceMatches(m1Evidence(), {}), false);
  const empty = m1Evidence(); delete empty.release.m1Browser;
  assert.equal(releaseEvidenceMatches(empty.release, current), true, 'M0 remains independent of M1 browser evidence');
  assert.equal(m1EvidenceMatches(empty, current), false);
});

test('M1 rejects every missing evidence group and non-boolean success claims', () => {
  for(const key of ['verification', 'unit', 'browser', 'release']) {
    const data = m1Evidence(); delete data[key];
    assert.equal(m1EvidenceMatches(data, current), false, key);
  }
  for(const change of [
    data => {data.verification.passed = 'true';},
    data => {data.unit.success = 'true';},
    data => {data.browser.passed = 'true';},
    data => {data.browser.m1Passed = 'true';},
    data => {data.release.m1Browser.passed = 'true';},
    data => {data.release.m1Browser.statePreserved = 'true';}
  ]) {
    const data = m1Evidence(); change(data);
    assert.equal(m1EvidenceMatches(data, current), false);
  }
});

test('M1 requires all named verification checks, especially signed-plugin, on the same SHA and source digest', () => {
  for(const checkName of m1Evidence().verification.checks.map(check => check.name)) {
    const data = m1Evidence(); data.verification.checks = data.verification.checks.filter(check => check.name !== checkName);
    assert.equal(m1EvidenceMatches(data, current), false, checkName);
  }
  for(const change of [
    data => {data.verification.commit = 'c'.repeat(40);},
    data => {data.verification.sourceDigest = 'c'.repeat(64);},
    data => {data.verification.checks[0].passed = false;},
    data => {data.verification.checks[0].exitCode = 1;},
    data => {data.verification.checks[0].exitCode = '0';},
    data => {data.verification.checks[0] = data.verification.checks[1];}
  ]) {
    const data = m1Evidence(); change(data);
    assert.equal(m1EvidenceMatches(data, current), false);
  }
});

test('M1 does not accept test totals without executed Host, model, protocol and Core assertions', () => {
  const changes = [
    data => {data.unit.testResults = [];},
    data => {data.unit.numTotalTests = 0; data.unit.numPassedTests = 0;},
    data => {data.unit.numPassedTests = 3;},
    data => {data.unit.numFailedTests = 1;},
    data => {data.unit.numPendingTests = 1;},
    data => {data.unit.numTodoTests = 1;},
    data => {data.unit.numFailedTestSuites = 1;},
    data => {data.unit.numPendingTestSuites = 1;},
    data => {data.unit.testResults[0].assertionResults = [];},
    data => {data.unit.testResults[0].status = 'failed';},
    data => {data.unit.testResults[0].assertionResults[0].status = 'pending';},
    data => {data.unit.testResults[0].assertionResults[0].failureMessages = ['failure'];},
    data => {data.unit.testResults[0] = data.unit.testResults[1];},
    data => {data.unit.testResults[0].name = '/ci/unrelated/runtime.test.ts';},
    data => {data.unit.numTotalTests = 5; data.unit.numPassedTests = 5;}
  ];
  for(const change of changes) {const data = m1Evidence(); change(data); assert.equal(m1EvidenceMatches(data, current), false);}
  for(let index = 0; index < 4; index++) {
    const data = m1Evidence(); data.unit.testResults[index].name = `/ci/unrelated/test-${index}.ts`;
    assert.equal(m1EvidenceMatches(data, current), false, `required suite ${index}`);
  }
});

test('M1 binds the parsed unit report content to current verification instead of accepting a stale success report', () => {
  const data = m1Evidence();
  const differentlyFormatted = JSON.parse(JSON.stringify(data.unit, null, 4));
  assert.equal(unitReportDigest(differentlyFormatted), data.verification.unitReportDigest);
  assert.equal(unitReportDigest({a: 1}), '015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862');
  assert.equal(unitReportDigest(null), null);
  const cyclic = {}; cyclic.self = cyclic;
  assert.equal(unitReportDigest(cyclic), null);
  for(const value of [undefined, '', 'not-a-digest', 'c'.repeat(64)]) {
    const candidate = m1Evidence(); candidate.verification.unitReportDigest = value;
    assert.equal(m1EvidenceMatches(candidate, current), false);
  }
  data.unit.testResults[0].assertionResults[0].title = 'Different previously passing assertion';
  assert.notEqual(unitReportDigest(data.unit), data.verification.unitReportDigest);
  assert.equal(m1EvidenceMatches(data, current), false);
});

test('M1 browser evidence needs every actual desktop and mobile scenario, with no skipped, failed or flaky tests', () => {
  for(const flow of M1_REQUIRED_FLOWS) {
    const data = m1Evidence(); data.browser.m1Flows = data.browser.m1Flows.filter(item => item !== flow);
    assert.equal(m1EvidenceMatches(data, current), false, flow);
  }
  for(const change of [
    data => {data.browser.commit = 'c'.repeat(40);},
    data => {data.browser.sourceDigest = 'c'.repeat(64);},
    data => {data.browser.m1Passed = false;},
    data => {data.browser.m1Flows[0] = data.browser.m1Flows[1];},
    data => {data.browser.m1Flows = [];},
    data => {data.browser.stats.expected = 0;},
    data => {data.browser.stats.expected = 13;},
    data => {data.browser.stats.skipped = 1;},
    data => {data.browser.stats.unexpected = 1;},
    data => {data.browser.stats.flaky = 1;}
  ]) {const data = m1Evidence(); change(data); assert.equal(m1EvidenceMatches(data, current), false);}
});

test('M1 requires an actual protected remote reopen on the exact current release', () => {
  const changes = [
    data => {data.release.ci.headSha = 'c'.repeat(40);},
    data => {data.release.buildInfo.sourceDigest = 'c'.repeat(64);},
    data => {data.release.protection.anonymousStatus = 200;},
    data => {data.release.providerTarget = 'production';},
    data => {data.release.m1Browser.commit = 'c'.repeat(40);},
    data => {data.release.m1Browser.sourceDigest = 'c'.repeat(64);},
    data => {data.release.m1Browser.url = 'https://other-preview.vercel.app';},
    data => {data.release.m1Browser.url = `${deployment}/`;},
    data => {data.release.m1Browser.savedRevision = 1; data.release.m1Browser.reopenedRevision = 1;},
    data => {data.release.m1Browser.savedRevision = 2.5; data.release.m1Browser.reopenedRevision = 2.5;},
    data => {data.release.m1Browser.savedRevision = Number.MAX_SAFE_INTEGER + 1; data.release.m1Browser.reopenedRevision = Number.MAX_SAFE_INTEGER + 1;},
    data => {data.release.m1Browser.reopenedRevision = 3;},
    data => {data.release.m1Browser.statePreserved = false;},
    data => {data.release.m1Browser.objectId = '';},
    data => {data.release.m1Browser.instanceId = 'other instance with spaces';},
    data => {data.release.m1Browser.observedAt = 'yesterday';},
    data => {data.release.m1Browser.unverifiedExtra = true;}
  ];
  for(const change of changes) {const data = m1Evidence(); change(data); assert.equal(m1EvidenceMatches(data, current), false);}
  for(const key of Object.keys(m1Evidence().release.m1Browser)) {
    const data = m1Evidence(); delete data.release.m1Browser[key];
    assert.equal(m1EvidenceMatches(data, current), false, key);
  }
});


const m2Evidence = () => {
  const data = m1Evidence();
  for (const name of ['packages/core/src/marketplace.test.ts','packages/plugin-host/src/marketplace.test.ts','packages/plugin-sdk/src/catalog.test.ts']) {
    data.unit.testResults.push({name:'/ci/ardesia-next/' + name,status:'passed',assertionResults:[{title:'observed marketplace assertions',status:'passed',failureMessages:[]}]});
  }
  for (const count of ['numTotalTests','numPassedTests','numTotalTestSuites','numPassedTestSuites']) data.unit[count] = 7;
  data.verification.unitReportDigest = unitReportDigest(data.unit);
  data.browser.m2Passed = true;
  data.browser.m2Flows = [...M2_REQUIRED_FLOWS];
  data.browser.stats.expected += M2_REQUIRED_FLOWS.length;
  data.release.m2Browser = {...current,url:deployment,passed:true,pluginId:'ardesia.ideal-spring',pluginVersion:'1.0.0',
    objectId:data.release.m1Browser.objectId,instanceId:data.release.m1Browser.instanceId,
    installedRevision:1,activeRevision:3,reopenedInstallationRevision:3,disabledRevision:4,
    savedRevision:2,reopenedRevision:2,statePreserved:true,consentPreserved:true,capabilities:['state:read','state:write'],
    disabled:true,steps:[...M2_LIFECYCLE_STEPS],observedAt:'2026-10-29T10:00:00.000Z'};
  return data;
};
test('M2 requires M1 plus actual Core, Host, catalog, browser counterproofs and protected remote lifecycle', () => {
  assert.equal(M2_REQUIRED_FLOWS.length,24);
  assert.equal(m2EvidenceMatches(m2Evidence(),current),true);
  assert.equal(m2EvidenceMatches(m1Evidence(),current),false);
  assert.equal(m2EvidenceMatches(null,current),false);
  for (const group of ['verification','unit','browser','release']) {
    const data=m2Evidence();delete data[group];
    assert.equal(m2EvidenceMatches(data,current),false,group);
  }
});
test('M2 rejects a missing security counterproof, stale build, missing test suite or forged success flag', () => {
  for (const flow of M2_REQUIRED_FLOWS) {
    const data=m2Evidence();data.browser.m2Flows=data.browser.m2Flows.filter(item=>item!==flow);
    assert.equal(m2EvidenceMatches(data,current),false,flow);
  }
  for (const mutate of [
    data=>{data.browser.m2Passed=false;},data=>{data.browser.m2Passed='true';},
    data=>{data.browser.m2Flows.push(data.browser.m2Flows[0]);},
    data=>{data.browser.stats.expected=22;},data=>{data.browser.stats.flaky=1;},
    data=>{data.browser.sourceDigest='c'.repeat(64);},
    data=>{data.release.m1Browser.statePreserved=false;},
    data=>{data.unit.testResults.pop();data.unit.numTotalTests=6;data.unit.numPassedTests=6;data.verification.unitReportDigest=unitReportDigest(data.unit);},
    data=>{data.unit.testResults.at(-1).name='/ci/unrelated/catalog.test.ts';data.verification.unitReportDigest=unitReportDigest(data.unit);},
  ]) {const data=m2Evidence();mutate(data);assert.equal(m2EvidenceMatches(data,current),false);}
});
test('M2 remote record must demonstrate current installation, consent, same state, reload and disable in order', () => {
  for (const key of Object.keys(m2Evidence().release.m2Browser)) {
    const data=m2Evidence();delete data.release.m2Browser[key];
    assert.equal(m2EvidenceMatches(data,current),false,key);
  }
  for (const mutate of [
    data=>{data.release.m2Browser.commit='c'.repeat(40);},
    data=>{data.release.m2Browser.sourceDigest='c'.repeat(64);},
    data=>{data.release.m2Browser.url=deployment+'/';},
    data=>{data.release.m2Browser.objectId='another-object';},
    data=>{data.release.m2Browser.instanceId='another-instance';},
    data=>{data.release.m2Browser.pluginId='another-plugin';},
    data=>{data.release.m2Browser.passed='true';},
    data=>{data.release.m2Browser.capabilities=['state:read'];},
    data=>{data.release.m2Browser.consentPreserved=false;},
    data=>{data.release.m2Browser.statePreserved=false;},
    data=>{data.release.m2Browser.installedRevision=0;},
    data=>{data.release.m2Browser.activeRevision=1;},
    data=>{data.release.m2Browser.reopenedInstallationRevision=4;},
    data=>{data.release.m2Browser.reopenedRevision=3;},
    data=>{data.release.m2Browser.disabledRevision=3;},
    data=>{data.release.m2Browser.disabled=false;},
    data=>{data.release.m2Browser.steps.reverse();},
    data=>{data.release.m2Browser.observedAt='yesterday';},
    data=>{data.release.m2Browser.extraUnverifiedClaim=true;},
  ]) {const data=m2Evidence();mutate(data);assert.equal(m2EvidenceMatches(data,current),false);}
});

