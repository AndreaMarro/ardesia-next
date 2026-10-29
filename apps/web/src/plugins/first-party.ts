import {createPluginHost, type PluginSession, type TrustedPublisherKey, type FirstPartyRelease} from '@ardesia/plugin-host';
import {PluginManifestSchema} from '@ardesia/plugin-sdk';
import {idealSpring, idealSpringInitialState} from '@ardesia/ideal-spring';
import {LabDataSchema, type LabData} from '@ardesia/contracts';
import trustConfiguration from './release-trust.json';

const releaseTrust: {trustStore: TrustedPublisherKey[]; allowlist: FirstPartyRelease[]} = trustConfiguration;

// Reviewed application policy: these pins do not come from the fetched manifest.
const host = createPluginHost({trustStore: releaseTrust.trustStore, policy: {
  allowlist: releaseTrust.allowlist,
  capabilities: ['state:read', 'state:write'], maxBundleBytes: 512_000, timeoutMs: 5_000,
}});
const consent = ['state:read', 'state:write'] as const;

async function readArtifact(path: string, maximum: number): Promise<Uint8Array> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(path, {signal: controller.signal, credentials: 'same-origin', redirect: 'error', cache: 'no-cache'});
    if (!response.ok || !response.body) throw new Error('ARTIFACT_UNAVAILABLE');
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maximum) {await reader.cancel(); throw new Error('ARTIFACT_TOO_LARGE');}
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
    return bytes;
  } finally {window.clearTimeout(timeout);}
}

async function artifacts(): Promise<{manifest: unknown; bundle: Uint8Array}> {
  const [manifest, bundle] = await Promise.all([readArtifact(idealSpring.manifestPath, 16_384), readArtifact(idealSpring.bundlePath, 512_000)]);
  return {manifest: JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(manifest)) as unknown, bundle};
}

export async function createFirstPartyLab(): Promise<LabData> {
  const session = await host.mount({...await artifacts(), instanceId: crypto.randomUUID(), state: idealSpringInitialState, consent});
  try {
    return LabDataSchema.parse({pluginId: session.manifest.id, pluginVersion: session.manifest.version,
      instanceId: session.instanceId, stateSchemaVersion: session.manifest.stateSchemaVersion,
      bundleDigest: session.manifest.integrity.digest, publisher: session.manifest.publisher, state: session.current.state});
  } finally {session.dispose();}
}

export async function mountLab(input: LabData): Promise<PluginSession> {
  const data = LabDataSchema.parse(input);
  const pin = releaseTrust.allowlist.find(entry => entry.id === data.pluginId && entry.version === data.pluginVersion
    && entry.digest === data.bundleDigest && entry.publisherId === data.publisher.id && entry.keyId === data.publisher.keyId);
  if (!pin || data.pluginId !== idealSpring.id || data.stateSchemaVersion !== idealSpring.stateSchemaVersion) throw new Error('INCOMPATIBLE_STATE');
  const source = await artifacts();
  const manifest = PluginManifestSchema.parse(source.manifest);
  if (manifest.id !== data.pluginId || manifest.version !== data.pluginVersion
    || manifest.integrity.digest !== data.bundleDigest || manifest.stateSchemaVersion !== data.stateSchemaVersion
    || manifest.publisher.id !== data.publisher.id || manifest.publisher.keyId !== data.publisher.keyId) throw new Error('INSTANCE_IDENTITY_MISMATCH');
  return host.mount({...source, instanceId: data.instanceId, state: data.state, consent});
}

export function pluginErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code;
  return error instanceof Error ? error.message : 'PLUGIN_UNAVAILABLE';
}
