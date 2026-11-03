import {build} from 'vite';
import {mkdtempSync, rmSync, writeFileSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {checkPluginBuild} from './build-plugin.mjs';
import {checkPoiseuilleBuild} from './build-poiseuille.mjs';
import {identity} from './evidence.mjs';
import {ensureM4Commit} from './m4-source.mjs';

await checkPluginBuild();
const candidate = await checkPoiseuilleBuild();
const outDir = mkdtempSync(join(tmpdir(), 'ardesia-m4-consumer-'));
try {
  await build({configFile: false, publicDir: false, logLevel: 'warn', ssr: {noExternal: true}, build: {
    ssr: 'tools/poiseuille-consumer.ts', outDir, emptyOutDir: true, target: 'node24', minify: false,
    rolldownOptions: {external: [/^node:/], output: {entryFileNames: 'consumer.mjs'}},
  }});
  const {runPoiseuilleConsumer} = await import(pathToFileURL(join(outDir, 'consumer.mjs')).href);
  const consumer = await runPoiseuilleConsumer(candidate);
  const baseSha = 'c4d38a612a73bc28df434c2d36d36025cf1b1adc';
  ensureM4Commit(baseSha);
  const changedPaths = execFileSync('git', ['diff', '--name-only', baseSha, 'HEAD'], {encoding: 'utf8'}).trim().split('\n').filter(Boolean);
  const unchanged = paths => execFileSync('git', ['diff', '--name-only', baseSha, '--', ...paths], {encoding: 'utf8'}).trim() === '';
  const measuredDelta = execFileSync('git', ['diff', '--numstat', baseSha, 'HEAD'], {encoding: 'utf8'}).trim().split('\n').filter(Boolean).map(line => {
    const [added, removed, path] = line.split('\t'); return {path, addedLines: Number(added), removedLines: Number(removed)};
  });
  const report = {...identity(), schemaVersion: '1.0.0', kind: 'ardesia-m4-preparation', acceptanceEvidence: false,
    plugin: {id: candidate.manifest.id, version: candidate.manifest.version, bundleDigest: candidate.manifest.integrity.digest, sourceRevision: candidate.manifest.provenance.commit},
    passed: true, consumer, limits: ['This check uses the existing MemoryStorage fixture', 'Web/PostgreSQL/browser and human acceptance require their own exact-source evidence'],
    reuse: {baseSha, sdkVersion: '1.0.0', coreUnchanged: unchanged(['packages/core', 'packages/contracts']),
      hostUnchanged: unchanged(['packages/plugin-host']), sdkUnchanged: unchanged(['packages/plugin-sdk']),
      persistenceUnchanged: unchanged(['packages/server', 'packages/remote-client']), changedPaths, measuredDelta,
      generatedWorkerBytes: candidate.bundle.length, measure: 'git diff assigned base to exact candidate HEAD; generated worker measured separately'}};
  mkdirSync('artifacts', {recursive: true});
  writeFileSync('artifacts/m4-preparation.json', JSON.stringify(report, null, 2) + '\n');
  console.log('Poiseuille signed Host/Core integration: PASS; M4 acceptance remains pending.');
} finally {rmSync(outDir, {recursive: true, force: true});}
