import {build} from 'vite';
import {readFileSync, readdirSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash, createPublicKey, verify} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ensureM4Commit} from './m4-source.mjs';

export const poiseuilleReleaseDirectory = 'plugins/poiseuille/release/1.0.0';
export async function buildPoiseuilleBytes() {
  const outDir = mkdtempSync(join(tmpdir(), 'ardesia-poiseuille-'));
  try {
    await build({configFile: false, publicDir: false, logLevel: 'warn', build: {
      target: 'es2023', minify: false, sourcemap: false, emptyOutDir: true, outDir,
      lib: {entry: 'plugins/poiseuille/src/worker.ts', formats: ['es'], fileName: () => 'plugin.js'},
      rolldownOptions: {output: {codeSplitting: false}},
    }});
    if (readdirSync(outDir).join(',') !== 'plugin.js') throw Error('Poiseuille must be one self-contained worker');
    return readFileSync(join(outDir, 'plugin.js'));
  } finally {rmSync(outDir, {recursive: true, force: true});}
}
export function canonicalManifestBytes(manifest) {
  const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value !== null && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}` : JSON.stringify(value);
  const {signature, ...payload} = manifest;
  return Buffer.from(`ardesia-plugin-manifest/v1\n${canonical(payload)}`);
}
export async function checkPoiseuilleBuild() {
  const rebuilt = await buildPoiseuilleBytes(), delivered = readFileSync(join(poiseuilleReleaseDirectory, 'plugin.js'));
  if (!rebuilt.equals(delivered)) throw Error('Poiseuille signed bytes differ from the candidate source');
  const manifest = JSON.parse(readFileSync(join(poiseuilleReleaseDirectory, 'manifest.json'), 'utf8'));
  const trust = JSON.parse(readFileSync(join(poiseuilleReleaseDirectory, 'candidate-trust.json'), 'utf8'));
  const digest = createHash('sha256').update(delivered).digest('hex');
  if (manifest.id !== 'ardesia.poiseuille' || manifest.version !== '1.0.0' || manifest.integrity.digest !== digest
    || manifest.provenance.repository !== 'https://github.com/AndreaMarro/ardesia-next'
    || manifest.provenance.path !== 'plugins/poiseuille/src/worker.ts'
    || !/^[a-f0-9]{40}$/.test(manifest.provenance.commit)
    || trust.trustStore.length !== 1 || trust.allowlist.length !== 1) throw Error('Invalid Poiseuille candidate identity');
  // The source revision is historical and immutable; a newer release commit must not silently substitute it.
  ensureM4Commit(manifest.provenance.commit);
  for (const path of ['model.ts', 'handler.ts', 'worker.ts', 'index.ts']) {
    const sourcePath = `plugins/poiseuille/src/${path}`;
    const original = execFileSync('git', ['show', `${manifest.provenance.commit}:${sourcePath}`]);
    if (!original.equals(readFileSync(sourcePath))) throw Error(`Poiseuille provenance mismatch: ${sourcePath}`);
  }
  const publisher = trust.trustStore[0], pin = trust.allowlist[0];
  if (publisher.publisherId !== manifest.publisher.id || publisher.keyId !== manifest.publisher.keyId || publisher.revoked === true
    || pin.id !== manifest.id || pin.version !== manifest.version || pin.digest !== digest
    || pin.publisherId !== publisher.publisherId || pin.keyId !== publisher.keyId) throw Error('Candidate pin mismatch');
  const publicKey = createPublicKey({key: {kty: 'OKP', crv: 'Ed25519', x: Buffer.from(publisher.publicKeyBase64, 'base64').toString('base64url')}, format: 'jwk'});
  if (!verify(null, canonicalManifestBytes(manifest), publicKey, Buffer.from(manifest.signature.value, 'base64'))) throw Error('Poiseuille signature mismatch');
  console.log(`Poiseuille candidate rebuild/signature: PASS (${delivered.length} bytes, ${digest})`);
  return {manifest, trust, bundle: delivered};
}
