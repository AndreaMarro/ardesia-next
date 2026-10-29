import {build} from 'vite';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const pluginArtifactDirectory = 'apps/web/public/plugins/ideal-spring/1.0.0';

export async function buildPluginBytes() {
  const outDir = mkdtempSync(join(tmpdir(), 'ardesia-plugin-'));
  try {
    await build({configFile: false, publicDir: false, logLevel: 'warn', build: {
      target: 'es2023', minify: false, sourcemap: false, emptyOutDir: true, outDir,
      lib: {entry: 'plugins/ideal-spring/src/worker.ts', formats: ['es'], fileName: () => 'plugin.js'},
      rolldownOptions: {output: {codeSplitting: false}},
    }});
    const files = readdirSync(outDir);
    if (files.length !== 1 || files[0] !== 'plugin.js') throw Error('Plugin must be one self-contained executable bundle');
    return readFileSync(join(outDir, 'plugin.js'));
  } finally {rmSync(outDir, {recursive: true, force: true});}
}

export async function checkPluginBuild() {
  const rebuilt = await buildPluginBytes();
  const delivered = readFileSync(join(pluginArtifactDirectory, 'plugin.js'));
  if (!rebuilt.equals(delivered)) throw Error('Signed plugin bytes differ from source rebuild. Review and sign a new release.');
  const manifest = JSON.parse(readFileSync(join(pluginArtifactDirectory, 'manifest.json'), 'utf8'));
  const trust = JSON.parse(readFileSync('apps/web/src/plugins/release-trust.json', 'utf8'));
  const digest = createHash('sha256').update(delivered).digest('hex');
  const pin = trust.allowlist.find(entry => entry.id === manifest.id && entry.version === manifest.version && entry.digest === digest && entry.publisherId === manifest.publisher.id && entry.keyId === manifest.publisher.keyId);
  const publisher = trust.trustStore.find(entry => entry.publisherId === manifest.publisher.id && entry.keyId === manifest.publisher.keyId && entry.revoked !== true);
  if (!pin || !publisher || manifest.integrity.digest !== digest) throw Error('Plugin release is not independently pinned');
  const {signature, ...payload} = manifest;
  const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value !== null && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
  const key = await crypto.subtle.importKey('raw', Buffer.from(publisher.publicKeyBase64, 'base64'), {name: 'Ed25519'}, false, ['verify']);
  if (!await crypto.subtle.verify({name: 'Ed25519'}, key, Buffer.from(signature.value, 'base64'), new TextEncoder().encode(`ardesia-plugin-manifest/v1\n${canonical(payload)}`))) throw Error('Plugin signature verification failed');
  console.log(`Signed plugin rebuild: PASS (${delivered.length} bytes, SHA-256 ${digest})`);
  return {digest, bytes: delivered.length, provenance: manifest.provenance};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--write')) {
    const bytes = await buildPluginBytes();
    mkdirSync(pluginArtifactDirectory, {recursive: true}); writeFileSync(join(pluginArtifactDirectory, 'plugin.js'), bytes);
    console.log(`Unsigned plugin bundle prepared (${bytes.length} bytes); release requires signing and separate trust pins.`);
  } else await checkPluginBuild();
}
