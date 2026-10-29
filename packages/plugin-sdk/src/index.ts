import {z} from 'zod';

/** Public, renderer-independent wire contract. It does not authorize execution. */
export const SDK_VERSION = '1.0.0' as const;
export const capabilities = ['state:read', 'state:write', 'objects:read', 'evidence:propose'] as const;
export const CapabilitySchema = z.enum(capabilities);
export type Capability = z.infer<typeof CapabilitySchema>;
const Semver = z.string().regex(/^\d+\.\d+\.\d+$/);
export const PluginManifestSchema = z.strictObject({
  schemaVersion: z.literal('1.0.0'),
  id: z.string().regex(/^[a-z][a-z0-9.-]{2,80}$/),
  name: z.string().min(1).max(100),
  version: Semver,
  sdkVersion: z.literal(SDK_VERSION),
  kind: z.literal('plugin'),
  publisher: z.strictObject({id: z.string().min(1).max(100), keyId: z.string().min(1).max(100)}),
  license: z.string().min(1).max(200),
  provenance: z.strictObject({repository: z.url(), commit: z.string().regex(/^[a-f0-9]{40}$/), path: z.string().min(1)}),
  integrity: z.strictObject({algorithm: z.literal('SHA-256'), digest: z.string().regex(/^[a-f0-9]{64}$/)}),
  signature: z.strictObject({algorithm: z.literal('Ed25519'), value: z.string().min(1).max(1024)}),
  capabilities: z.array(CapabilitySchema).max(capabilities.length),
  stateSchemaVersion: Semver,
  execution: z.literal('first-party')
});
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export interface PluginState {readonly schemaVersion: string; readonly value: unknown;}
export interface PluginInstance {readonly instanceId: string; readonly pluginId: string; readonly version: string; readonly state: PluginState;}
export type LifecycleState = 'available' | 'installed' | 'active' | 'disabled' | 'revoked';
export interface CatalogContent {
  readonly kind: 'content'; readonly id: string; readonly version: string;
  readonly contentKind: 'discipline-pack' | 'lesson' | 'manual' | 'resource' | 'workflow' | 'template';
  readonly publisherId: string; readonly license: string;
  readonly status: 'draft' | 'approved' | 'revoked';
  readonly sourceRevision: string; readonly integrity: string;
}
export type CatalogItem = {readonly kind: 'plugin'; readonly manifest: PluginManifest} | CatalogContent;

/** Grants must be a subset of explicitly requested capabilities; no ambient grants. */
export function resolveCapabilities(requested: readonly Capability[], consent: readonly Capability[]): readonly Capability[] {
  return capabilities.filter(capability => requested.includes(capability) && consent.includes(capability));
}
