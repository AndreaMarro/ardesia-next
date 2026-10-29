import {describe, it, expect} from 'vitest';
import {inspectPlugin} from './index';
import {resolveCapabilities, PluginManifestSchema} from '@ardesia/plugin-sdk';

const manifest = {
  schemaVersion: '1.0.0', id: 'ardesia.pendulum', name: 'Pendulum', version: '1.0.0', sdkVersion: '1.0.0', kind: 'plugin',
  publisher: {id: 'ardesia', keyId: 'fixture-key'}, license: 'UNLICENSED',
  provenance: {repository: 'https://github.com/AndreaMarro/ardesia-next', commit: 'a'.repeat(40), path: 'plugins/pendulum'},
  integrity: {algorithm: 'SHA-256', digest: 'b'.repeat(64)}, signature: {algorithm: 'Ed25519', value: 'fixture-not-a-valid-signature'},
  capabilities: ['state:read'], stateSchemaVersion: '1.0.0', execution: 'first-party'
};
describe('Manifest declarations remain fail-closed without cryptographic verification', () => {
  it('does not execute a well-shaped manifest or a forged candidate', () => {
    expect(inspectPlugin(manifest)).toEqual({allowed: false, reason: 'VERIFICATION_REQUIRED'});
    expect(inspectPlugin({entrypoint: 'https://attacker.test/code.js'}).allowed).toBe(false);
  });
  it('requires version, integrity and provenance and rejects ambient capabilities', () => {
    for (const field of ['sdkVersion', 'integrity', 'signature', 'license', 'provenance']) {
      const missing = {...manifest}; delete missing[field as keyof typeof missing];
      expect(PluginManifestSchema.safeParse(missing).success).toBe(false);
    }
    expect(PluginManifestSchema.safeParse({...manifest, capabilities: ['shell:execute']}).success).toBe(false);
    expect(PluginManifestSchema.safeParse({...manifest, sdkVersion: '2.0.0'}).success).toBe(false);
  });
  it('grants nothing without consent and cannot grant an unrequested capability', () => {
    expect(resolveCapabilities(['state:read'], [])).toEqual([]);
    expect(resolveCapabilities(['state:read'], ['state:read', 'state:write'])).toEqual(['state:read']);
  });
});

