import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const runner = fileURLToPath(new URL('./e2e.mjs', import.meta.url));
const protectedPaths = ['e2e.json', 'browser-evidence.json', 'release-evidence.json', 'm3-remote-evidence.json'];
const credentials = Object.fromEntries(['TEACHER', 'STUDENT_A', 'STUDENT_B'].flatMap((name, index) => [
  [`ARDESIA_E2E_${name}_USERNAME`, `runner-fixture-${index}`],
  [`ARDESIA_E2E_${name}_PASSWORD`, 'synthetic-runner-test-password'],
]));

function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'ardesia-e2e-runner-'));
  mkdirSync(join(directory, 'artifacts'));
  for (const path of protectedPaths) writeFileSync(join(directory, 'artifacts', path), `preserved fixture ${path}\n`);
  const env = {...process.env};
  for (const key of Object.keys(env)) if (key.startsWith('ARDESIA_E2E') || key.startsWith('PLAYWRIGHT_JSON_OUTPUT') || key === 'PORT') delete env[key];
  Object.assign(env, {ARDESIA_COMMIT_SHA:'a'.repeat(40), ARDESIA_E2E_MODE:'remote',
    ARDESIA_E2E_BASE_URL:'https://ardesia-next-staging.vercel.app/'});
  try {run(directory, env);} finally {rmSync(directory, {recursive:true, force:true});}
}

function execute(directory, env, args = []) {
  const result = spawnSync(process.execPath, [runner, ...args], {cwd:directory, env, encoding:'utf8'});
  assert.equal(result.error, undefined, result.error?.message);
  assert.notEqual(result.status, 0, 'a rejected or failed run must not report success');
  for (const path of protectedPaths) {
    assert.equal(readFileSync(join(directory, 'artifacts', path), 'utf8'), `preserved fixture ${path}\n`);
  }
  return result;
}

test('remote E2E missing or duplicate credentials fails before launch and preserves gate evidence', () => {
  fixture((directory, env) => {
    const missing = execute(directory, env);
    assert.match(missing.stderr, /existing synthetic TEACHER credentials/);
    assert.equal(existsSync(join(directory, 'artifacts/remote-continuity')), false);
    const duplicate = execute(directory, {...env, ...credentials, ARDESIA_E2E_STUDENT_B_USERNAME:credentials.ARDESIA_E2E_STUDENT_A_USERNAME});
    assert.match(duplicate.stderr, /three distinct synthetic accounts/);
    assert.equal(existsSync(join(directory, 'artifacts/remote-continuity')), false);
  });
});

test('remote E2E rejects overrides that could replace the configuration or gate artifacts', () => {
  fixture((directory, env) => {
    for (const argument of ['--config=other.ts', '-cother.ts', '--reporter=list', '--output=artifacts', '--trace=on', '--trace', '--ui', '--ui-port=8080', '--debug']) {
      const result = execute(directory, {...env, ...credentials}, [argument]);
      assert.match(result.stderr, /cannot override configuration, reporter or output/);
    }
    assert.equal(existsSync(join(directory, 'artifacts/remote-continuity')), false);
  });
});

test('a failed remote child has no DB credentials or seeding flag and writes only a negative regression summary', () => {
  fixture((directory, env) => {
    const bin = join(directory, 'node_modules/.bin'); mkdirSync(bin, {recursive:true});
    // Only a process-boundary probe. It performs no HTTP/DB work and produces no browser evidence.
    writeFileSync(join(bin, 'playwright'), `#!${process.execPath}\n` + `
      const fs = require('node:fs');
      const names = ['ARDESIA_E2E','ARDESIA_DATABASE_URL','ARDESIA_OPERATOR_DATABASE_URL',
        'M3_BROWSER_DATABASE_URL','M3_TEST_DATABASE_URL','M3_TEST_ADMIN_DATABASE_URL',
        'PLAYWRIGHT_JSON_OUTPUT_FILE','PLAYWRIGHT_JSON_OUTPUT_NAME','PLAYWRIGHT_JSON_OUTPUT_DIR',
        'PWDEBUG','DEBUG','DEBUG_FILE'];
      fs.writeFileSync('child-observation.json', JSON.stringify({
        mode:process.env.ARDESIA_E2E_MODE, origin:process.env.ARDESIA_E2E_BASE_URL,
        retained:names.filter(name => process.env[name] !== undefined)
      }));
      process.exit(1);
    `, {mode:0o700});
    const result = execute(directory, {...env, ...credentials, ARDESIA_E2E:'0',
      ARDESIA_DATABASE_URL:'synthetic-runtime-dsn', ARDESIA_OPERATOR_DATABASE_URL:'synthetic-operator-dsn',
      M3_BROWSER_DATABASE_URL:'synthetic-browser-dsn', M3_TEST_DATABASE_URL:'synthetic-test-dsn',
      M3_TEST_ADMIN_DATABASE_URL:'synthetic-admin-dsn', PLAYWRIGHT_JSON_OUTPUT_FILE:'artifacts/e2e.json',
      PLAYWRIGHT_JSON_OUTPUT_NAME:'e2e.json', PLAYWRIGHT_JSON_OUTPUT_DIR:'artifacts',
      PWDEBUG:'1', DEBUG:'pw:api', DEBUG_FILE:'synthetic-debug.log'});
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'child-observation.json'), 'utf8')),
      {mode:'remote', origin:'https://ardesia-next-staging.vercel.app', retained:[]});
    const summaryText = readFileSync(join(directory, 'artifacts/remote-continuity/result.json'), 'utf8');
    const summary = JSON.parse(summaryText);
    assert.equal(summary.kind, 'ardesia-remote-continuity-regression');
    assert.equal(summary.suitePassed, false);
    assert.equal(summary.deploymentIdentityVerified, false);
    assert.equal(summary.m3Acceptance, 'NOT_EVALUATED');
    assert.equal(summary.reportDigest, null);
    assert.equal(summary.stats, null);
    assert.equal(summary.passed, undefined);
    assert.equal(summary.commit, undefined, 'test source is not silently attributed to a deployment');
    assert.doesNotMatch(summaryText + result.stdout + result.stderr, /synthetic-(runtime|operator|browser|test|admin)-dsn|synthetic-runner-test-password/);
  });
});
