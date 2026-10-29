import {writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildPluginBytes, pluginArtifactDirectory} from './build-plugin.mjs';
import {manifestSigningBytes} from '@ardesia/plugin-host';

// One reviewed first-party release. Never called by build, CI or application code.
// The non-extractable private key exists only in this process and is never serialized.
const sourceCommit = process.argv[2];
if (!sourceCommit || !/^[a-f0-9]{40}$/.test(sourceCommit)) throw Error('Pass the exact Git commit containing the reviewed plugin sources');
const bytes = await buildPluginBytes();
const pair = await crypto.subtle.generateKey({name: 'Ed25519'}, false, ['sign', 'verify']);
const publicKeyBase64 = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64');
const keyId = `m1-${createHash('sha256').update(publicKeyBase64).digest('hex').slice(0,16)}`;
const digest = createHash('sha256').update(bytes).digest('hex');
const manifest = {
  schemaVersion: '1.0.0', id: 'ardesia.ideal-spring', name: 'Molla ideale', version: '1.0.0', sdkVersion: '1.0.0', kind: 'plugin',
  publisher: {id: 'ardesia', keyId}, license: 'UNLICENSED; bundled Zod MIT notice included',
  provenance: {repository: 'https://github.com/AndreaMarro/ardesia-next', commit: sourceCommit, path: 'plugins/ideal-spring/src/worker.ts'},
  integrity: {algorithm: 'SHA-256', digest}, capabilities: ['state:read', 'state:write'], stateSchemaVersion: '1.0.0', execution: 'first-party',
};
const signature = Buffer.from(await crypto.subtle.sign({name: 'Ed25519'}, pair.privateKey, manifestSigningBytes({...manifest, signature: {algorithm:'Ed25519', value:'pending'}}))).toString('base64');
mkdirSync(pluginArtifactDirectory, {recursive: true});
writeFileSync(join(pluginArtifactDirectory, 'plugin.js'), bytes);
writeFileSync(join(pluginArtifactDirectory, 'manifest.json'), JSON.stringify({...manifest, signature: {algorithm: 'Ed25519', value: signature}}, null, 2)+'\n');
writeFileSync('apps/web/src/plugins/release-trust.json', JSON.stringify({
  trustStore: [{publisherId: manifest.publisher.id, keyId, publicKeyBase64}],
  allowlist: [{id: manifest.id, version: manifest.version, digest, publisherId: manifest.publisher.id, keyId}],
}, null, 2)+'\n');
console.log(`Release signed for source ${sourceCommit}; public trust pin ${keyId}; private key not exported.`);
