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

export const PLUGIN_PROTOCOL = 'ardesia-plugin/1' as const;
export const MAX_PLUGIN_STATE_BYTES = 32_768;
export const MAX_PLUGIN_RESPONSE_BYTES = 512_000;

/** JSON only: no cycles, accessors, prototypes, non-finite numbers or hidden values. */
export function isBoundedJson(value: unknown, maxBytes = MAX_PLUGIN_STATE_BYTES): boolean {
  try {
    const seen = new WeakSet<object>();
    const pending: {value: unknown; depth: number}[] = [{value, depth: 0}];
    let nodes = 0;
    while (pending.length) {
      const item = pending.pop()!;
      if (++nodes > 20_000 || item.depth > 16) return false;
      const current = item.value;
      if (current === null || typeof current === 'boolean') continue;
      if (typeof current === 'number') {if (!Number.isFinite(current)) return false; continue;}
      if (typeof current === 'string') {if (current.length > maxBytes) return false; continue;}
      if (typeof current !== 'object' || seen.has(current)) return false;
      seen.add(current);
      const descriptors = Object.getOwnPropertyDescriptors(current);
      if (Object.getOwnPropertySymbols(current).length) return false;
      if (Array.isArray(current)) {
        if (current.length > 10_000 || Object.keys(descriptors).length !== current.length + 1) return false;
        for (let index = 0; index < current.length; index++) {
          const descriptor = descriptors[String(index)];
          if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return false;
          pending.push({value: descriptor.value, depth: item.depth + 1});
        }
      } else {
        const prototype = Object.getPrototypeOf(current);
        if (prototype !== Object.prototype && prototype !== null) return false;
        for (const [key, descriptor] of Object.entries(descriptors)) {
          if (key.length > 200 || ['__proto__', 'prototype', 'constructor'].includes(key) || !descriptor.enumerable || !('value' in descriptor)) return false;
          pending.push({value: descriptor.value, depth: item.depth + 1});
        }
      }
    }
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxBytes;
  } catch {return false;}
}

export const PluginStateSchema = z.unknown()
  .refine(value => isBoundedJson(value), 'State must be bounded JSON')
  .pipe(z.strictObject({schemaVersion: Semver, value: z.unknown()}));
const ShortText = z.string().min(1).max(100);
export const PluginParameterSchema = z.strictObject({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,63}$/), label: ShortText, unit: z.string().max(40),
  min: z.number(), max: z.number(), step: z.number().positive(), value: z.number()
}).refine(parameter => parameter.min <= parameter.max && parameter.value >= parameter.min && parameter.value <= parameter.max, 'Invalid parameter range');
export const PluginViewSchema = z.strictObject({
  title: ShortText, summary: z.string().max(1_000),
  parameters: z.array(PluginParameterSchema).max(16),
  metrics: z.array(z.strictObject({label: ShortText, value: z.number(), unit: z.string().max(40)})).max(16),
  plot: z.strictObject({
    xLabel: ShortText, xUnit: z.string().max(40), yLabel: ShortText, yUnit: z.string().max(40),
    series: z.array(z.strictObject({id: ShortText, label: ShortText, points: z.array(z.strictObject({x: z.number(), y: z.number()})).min(2).max(1_000)})).min(1).max(4)
  }),
  explanation: z.array(z.string().min(1).max(2_000)).min(1).max(16),
  diagram: z.strictObject({kind: z.literal('spring'), displacement: z.number(), amplitude: z.number().nonnegative()}).optional()
});
export type PluginView = z.infer<typeof PluginViewSchema>;
const Envelope = {protocol: z.literal(PLUGIN_PROTOCOL), requestId: z.string().min(1).max(100), instanceId: z.string().min(1).max(100)};
export const PluginRequestSchema = z.strictObject({...Envelope, action: z.literal('evaluate'), state: PluginStateSchema});
export type PluginRequest = z.infer<typeof PluginRequestSchema>;
export const PluginResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({...Envelope, ok: z.literal(true), state: PluginStateSchema, view: PluginViewSchema}),
  z.strictObject({...Envelope, ok: z.literal(false), error: z.strictObject({code: z.enum(['INVALID_STATE', 'INCOMPATIBLE_STATE', 'EVALUATION_FAILED']), message: z.string().min(1).max(500)})})
]);
export type PluginResponse = z.infer<typeof PluginResponseSchema>;
export interface PluginEvaluation {readonly state: PluginState; readonly view: PluginView;}

