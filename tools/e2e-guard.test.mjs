import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'node_modules/playwright/cli.js');
function cleanEnvironment() {
  const env = {...process.env};
  for (const key of Object.keys(env)) if (key.startsWith('ARDESIA_E2E') || key.startsWith('PLAYWRIGHT_JSON_OUTPUT')
    || ['PWDEBUG', 'DEBUG', 'DEBUG_FILE', 'NODE_DEBUG', 'NODE_OPTIONS', 'VERCEL_OIDC_TOKEN'].includes(key)) delete env[key];
  return {...env, ARDESIA_E2E_MODE:'remote', ARDESIA_E2E_BASE_URL:'https://ardesia-next-staging.vercel.app'};
}

test('direct Playwright output and trace overrides fail before output cleanup or network access', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ardesia-direct-e2e-'));
  const sentinel = join(directory, 'acceptance-evidence.json');
  const preload = join(directory, 'network-denied.mjs');
  writeFileSync(sentinel, 'preserve previous acceptance evidence\n');
  writeFileSync(preload, "globalThis.fetch = async () => {throw Error('No network permitted by this regression fixture');};\n");
  try {
    for (const argument of [`--output=${directory}`, '--trace=on']) {
      const result = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, cli, 'test', argument],
        {cwd:root, env:cleanEnvironment(), encoding:'utf8'});
      assert.equal(result.error, undefined, result.error?.message);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr + result.stdout, /cannot override configuration, reporter or output/);
      assert.equal(readFileSync(sentinel, 'utf8'), 'preserve previous acceptance evidence\n');
      assert.doesNotMatch(result.stderr + result.stdout, /No network permitted/);
    }
  } finally {rmSync(directory, {recursive:true, force:true});}
});

test('actual remote configuration rejects diagnostic and JSON output environments during import', () => {
  for (const [key, value] of Object.entries({DEBUG:'pw:api', PWDEBUG:'1', DEBUG_FILE:'trace.log', NODE_DEBUG:'http',
    PLAYWRIGHT_JSON_OUTPUT_FILE:'artifacts/e2e.json', PLAYWRIGHT_JSON_OUTPUT_DIR:'artifacts'})) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./playwright.config.ts');"],
      {cwd:root, env:{...cleanEnvironment(), [key]:value}, encoding:'utf8'});
    assert.equal(result.error, undefined, result.error?.message);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /cannot enable diagnostic or reporter environment overrides/);
  }
});
