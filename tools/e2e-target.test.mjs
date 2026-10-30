import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveE2ETarget} from '../e2e/target.ts';

const staging = 'https://ardesia-next-staging.vercel.app';
const remote = {ARDESIA_E2E_MODE: 'remote', ARDESIA_E2E_BASE_URL: staging};

test('E2E target defaults to a single local origin and preserves local artifact paths', () => {
  assert.deepEqual(resolveE2ETarget({}), {
    mode: 'local', origin: 'http://127.0.0.1:4173',
    reportPath: 'artifacts/e2e.json', summaryPath: 'artifacts/browser-evidence.json', outputDir: 'test-results',
  });
  assert.equal(resolveE2ETarget({ARDESIA_E2E_BASE_URL: 'http://127.0.0.1:4173/'}).origin, 'http://127.0.0.1:4173');
  assert.equal(resolveE2ETarget({PORT: '4180'}).origin, 'http://127.0.0.1:4180');
  assert.equal(resolveE2ETarget({PORT: '4180', ARDESIA_E2E_BASE_URL: 'http://127.0.0.1:4180/'}).origin, 'http://127.0.0.1:4180');
  assert.throws(() => resolveE2ETarget({PORT: '4180', ARDESIA_E2E_BASE_URL: 'http://127.0.0.1:4173'}));
  for (const PORT of ['0', '65536', '-1', '4173.0', ' 4173', '4e3', 'abc']) {
    assert.throws(() => resolveE2ETarget({PORT}), /local browser-test port/);
  }
});

test('E2E remote target requires explicit opt-in and existing stable staging', () => {
  assert.throws(() => resolveE2ETarget({ARDESIA_E2E_BASE_URL: staging}), /explicit remote mode/);
  assert.throws(() => resolveE2ETarget({ARDESIA_E2E_MODE: 'remote'}), /explicit browser-test origin/);
  for (const mode of ['', 'REMOTE', 'staging']) {
    assert.throws(() => resolveE2ETarget({ARDESIA_E2E_MODE: mode}), /must be local or remote/);
  }
  assert.deepEqual(resolveE2ETarget({...remote, ARDESIA_E2E_BASE_URL: `${staging}/`}), {
    mode: 'remote', origin: staging,
    reportPath: 'artifacts/remote-continuity/playwright.json',
    summaryPath: 'artifacts/remote-continuity/result.json',
    outputDir: 'artifacts/remote-continuity/test-results',
  });
  for (const origin of ['https://ardesia-next.vercel.app', 'https://another.example', 'http://127.0.0.1:4173', staging.replace('https:', 'http:')]) {
    assert.throws(() => resolveE2ETarget({...remote, ARDESIA_E2E_BASE_URL: origin}), /stable staging origin/);
  }
  assert.throws(() => resolveE2ETarget({...remote, ARDESIA_E2E: '1'}), /provisioning/);
});

test('E2E target rejects credential-bearing, noncanonical and bypass URLs without echoing them', () => {
  const invalid = [
    `https://user:sensitive-password@${new URL(staging).host}`,
    `${staging}?x-vercel-protection-bypass=sensitive-token`, `${staging}?`, `${staging}#`,
    `${staging}/lesson`, `${staging}/../`, `${staging}/%2e/`, `${staging}:443/`,
    `${staging} `, ` ${staging}`, `${staging}\n`, `${staging.replace('staging', 'sta\tging')}`,
    `${staging}\\`, 'not-an-origin',
  ];
  for (const origin of invalid) {
    assert.throws(() => resolveE2ETarget({...remote, ARDESIA_E2E_BASE_URL: origin}), error => {
      assert.doesNotMatch(error.message, /sensitive-password|sensitive-token|x-vercel-protection-bypass/);
      return true;
    });
  }
});

function actualConfiguration(overrides) {
  const env = {...process.env};
  for (const key of Object.keys(env)) {
    if (key.startsWith('ARDESIA_E2E') || key.startsWith('PLAYWRIGHT_JSON_OUTPUT') || key === 'PORT') delete env[key];
  }
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const {default: config} = await import('./playwright.config.ts');
    const {resolveE2ETarget} = await import('./e2e/target.ts');
    console.log(JSON.stringify({config, target: resolveE2ETarget()}));
  `], {cwd: root, env: {...env, ...overrides}, encoding: 'utf8'});
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('E2E real local configuration uses the same API/page/server origin and original outputs', () => {
  const {config, target} = actualConfiguration({PORT: '4180'});
  assert.equal(config.use.baseURL, target.origin);
  assert.equal(config.webServer.url, target.origin);
  assert.equal(config.webServer.command, 'npm run preview');
  assert.equal(config.webServer.reuseExistingServer, false);
  assert.equal(config.outputDir, target.outputDir);
  assert.equal(config.reporter.find(([name]) => name === 'json')[1].outputFile, target.reportPath);
  assert.equal(config.testMatch, undefined);
  assert.deepEqual(config.projects.map(project => project.name), ['desktop-chromium', 'mobile-chromium']);
});

test('E2E real remote configuration starts no local server and cannot overwrite local evidence', () => {
  const {config, target} = actualConfiguration({...remote, ARDESIA_E2E_BASE_URL: `${staging}/`});
  assert.equal(config.use.baseURL, staging);
  assert.equal(config.use.baseURL, target.origin);
  assert.equal(config.webServer, undefined);
  assert.equal(config.testMatch, '**/remote-continuity.spec.ts');
  assert.equal(config.outputDir, 'artifacts/remote-continuity/test-results');
  assert.equal(config.reporter.find(([name]) => name === 'json')[1].outputFile, 'artifacts/remote-continuity/playwright.json');
  assert.deepEqual(config.projects.map(project => project.name), ['desktop-chromium', 'mobile-chromium']);
  assert.equal(config.retries, 0);
  assert.equal(config.workers, 1);
});
