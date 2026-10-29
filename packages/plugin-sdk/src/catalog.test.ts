import {describe, expect, it} from 'vitest';
import {PluginCatalogSchema, CatalogItemSchema} from './index';

const manifest = {
  schemaVersion: '1.0.0', id: 'ardesia.fixture', name: 'Fixture', version: '1.0.0', sdkVersion: '1.0.0', kind: 'plugin',
  publisher: {id: 'ardesia', keyId: 'test-key'}, license: 'UNLICENSED',
  provenance: {repository: 'https://github.com/AndreaMarro/ardesia-next', commit: 'a'.repeat(40), path: 'plugins/fixture'},
  integrity: {algorithm: 'SHA-256', digest: 'b'.repeat(64)}, signature: {algorithm: 'Ed25519', value: 'test-only-schema-fixture'},
  capabilities: ['state:read'], stateSchemaVersion: '1.0.0', execution: 'first-party',
};
const plugin = {
  kind: 'plugin', status: 'available', summary: 'A scientific module', manifest,
  manifestPath: '/plugins/fixture/1.0.0/manifest.json', bundlePath: '/plugins/fixture/1.0.0/plugin.js',
};
const content = {
  kind: 'content', contentKind: 'lesson', id: 'ardesia.lesson', version: '1.0.0', name: 'A draft lesson',
  publisherId: 'ardesia', license: 'UNLICENSED', provenance: manifest.provenance, integrity: manifest.integrity, status: 'draft',
};
const catalog = () => ({schemaVersion: '1.0.0', revision: 1, publishedAt: '2026-10-29T09:00:00Z', entries: [plugin, content]});

describe('M2 versioned catalog contract', () => {
  it('keeps executable releases and declarative drafts distinct without turning discovery into execution', () => {
    const result = PluginCatalogSchema.parse(catalog());
    expect(result.entries[0]?.kind).toBe('plugin');
    expect(result.entries[1]).toMatchObject({kind: 'content', status: 'draft', contentKind: 'lesson'});
    expect(result.entries[0]).not.toHaveProperty('grants');
    expect(result.entries[1]).not.toHaveProperty('manifest');
  });
  it.each(['discipline-pack', 'lesson', 'manual', 'resource', 'workflow', 'template'])('accepts %s only as declarative content', contentKind => {
    expect(CatalogItemSchema.safeParse({...content, contentKind}).success).toBe(true);
    for (const field of ['entrypoint', 'bundlePath', 'capabilities', 'execution', 'manifest']) {
      expect(CatalogItemSchema.safeParse({...content, contentKind, [field]: plugin[field as keyof typeof plugin] ?? 'code'}).success).toBe(false);
    }
  });
  it.each([
    'https://attacker.example/plugin.js', '//attacker.example/plugin.js', '/plugins/../plugin.js',
    '/plugins/a/./plugin.js', '/plugins/a/%2e%2e/plugin.js', '/plugins/a/plugin.js?redirect=1',
    '/plugins/a/plugin.js#code', '/plugins/a\\plugin.js', '/untrusted/plugin.js', '/plugins//plugin.js',
  ])('rejects an untrusted or ambiguous artifact path: %s', bundlePath => {
    expect(CatalogItemSchema.safeParse({...plugin, bundlePath}).success).toBe(false);
  });
  it('rejects duplicate releases, invalid revisions and unsupported catalog versions', () => {
    expect(PluginCatalogSchema.safeParse({...catalog(), entries: [plugin, {...plugin, status: 'revoked'}]}).success).toBe(false);
    expect(PluginCatalogSchema.safeParse({...catalog(), entries: [content, content]}).success).toBe(false);
    for (const revision of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) expect(PluginCatalogSchema.safeParse({...catalog(), revision}).success).toBe(false);
    expect(PluginCatalogSchema.safeParse({...catalog(), schemaVersion: '2.0.0'}).success).toBe(false);
    expect(PluginCatalogSchema.safeParse({...catalog(), publishedAt: 'yesterday'}).success).toBe(false);
  });
  it('requires signed manifest metadata and rejects publisher self-authorization fields', () => {
    for (const field of ['license', 'provenance', 'signature', 'integrity', 'sdkVersion']) {
      const candidate = {...manifest}; delete candidate[field as keyof typeof candidate];
      expect(CatalogItemSchema.safeParse({...plugin, manifest: candidate}).success).toBe(false);
    }
    expect(CatalogItemSchema.safeParse({...plugin, manifest: {...manifest, publisher: {...manifest.publisher, publicKey: 'self-asserted'}}}).success).toBe(false);
    expect(CatalogItemSchema.safeParse({...plugin, manifest: {...manifest, sdkVersion: '2.0.0'}}).success).toBe(false);
    expect(CatalogItemSchema.safeParse({...plugin, manifestPath: plugin.bundlePath}).success).toBe(false);
  });
});
