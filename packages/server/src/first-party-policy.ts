import {readFile, realpath} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {Worker} from 'node:worker_threads';
import {createPluginHost, firstPartyTrust, type PluginRuntime, type TrustedPublisherKey, type FirstPartyRelease} from '@ardesia/plugin-host';
import {PluginCatalogSchema, PluginManifestSchema, type Capability} from '@ardesia/plugin-sdk';
import {PluginReleaseSchema} from '@ardesia/contracts';
import type {PluginPolicy} from '@ardesia/core';
import {canonical, ServerError} from './errors';

type Transition = {pluginId: string; fromVersion: string; toVersion: string; direction: 'update' | 'rollback'; stateSchemaVersion: string};
export interface FirstPartyPolicyOptions {
  /** Directory containing the reviewed /plugins artifacts, never a caller-supplied URL. */
  artifactRoot: string;
  trust?: {trustStore: readonly TrustedPublisherKey[]; allowlist: readonly FirstPartyRelease[]; transitions?: readonly Transition[]};
}

/** The existing Host supplies only bytes that already passed digest, signature and release policy. */
function nodeRuntime(verifiedBundle: Uint8Array): PluginRuntime {
  const source = new TextDecoder('utf-8', {fatal: true}).decode(verifiedBundle);
  const bridge = `const {parentPort} = require('node:worker_threads');
globalThis.postMessage = value => parentPort.postMessage(value);
parentPort.on('message', value => globalThis.onmessage?.({data:value}));\n`;
  const worker = new Worker(bridge + source, {eval: true, env: {},
    resourceLimits: {maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16, stackSizeMb: 4}});
  let stopped = false;
  return {
    postMessage(request) {worker.postMessage(request);},
    subscribe(onMessage, onError) {
      const exited = (code: number) => {if (!stopped && code !== 0) onError();};
      worker.on('message', onMessage); worker.on('error', onError); worker.on('exit', exited);
      return () => {worker.off('message', onMessage); worker.off('error', onError); worker.off('exit', exited);};
    },
    terminate() {stopped = true; void worker.terminate();},
  };
}

/** One Host implementation and the exact signed M1/M2 scientific bundle, on the server. */
export function createFirstPartyPolicy(options: FirstPartyPolicyOptions): PluginPolicy {
  const trusted = structuredClone(options.trust ?? firstPartyTrust);
  const root = resolve(options.artifactRoot);
  const host = createPluginHost({trustStore: trusted.trustStore, policy: {allowlist: trusted.allowlist,
    capabilities: ['state:read', 'state:write'], maxBundleBytes: 512_000, timeoutMs: 5_000}, runtimeFactory: nodeRuntime});
  const revokedPublishers = new Set<string>(), revokedReleases = new Set<string>();
  async function artifact(path: string, maximum: number): Promise<Uint8Array> {
    if (!/^\/plugins\/[A-Za-z0-9._/-]+$/.test(path) || path.split('/').includes('..')) throw new ServerError('ARTIFACT_REJECTED', 'The release artifact path is not authorized.', 422);
    const absolute = await realpath(resolve(root, '.' + path));
    if (!absolute.startsWith(root + sep)) throw new ServerError('ARTIFACT_REJECTED', 'The release artifact escaped the reviewed directory.', 422);
    const bytes = await readFile(absolute);
    if (bytes.byteLength === 0 || bytes.byteLength > maximum) throw new ServerError('ARTIFACT_REJECTED', 'The release artifact has an invalid size.', 422);
    return new Uint8Array(bytes);
  }
  const decode = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)) as unknown;
  return async request => {
    const revocations = decode(await artifact('/plugins/revocations.json', 16_384));
    if (!revocations || typeof revocations !== 'object' || Array.isArray(revocations)) throw new Error('Invalid revocations');
    const rev = revocations as Record<string, unknown>;
    if (Object.keys(rev).sort().join(',') !== 'revision,revokedPublishers,revokedReleases,schemaVersion'
      || rev.schemaVersion !== '1.0.0' || !Number.isSafeInteger(rev.revision) || Number(rev.revision) < 1
      || !Array.isArray(rev.revokedPublishers) || !Array.isArray(rev.revokedReleases)
      || rev.revokedPublishers.length > 500 || rev.revokedReleases.length > 500
      || rev.revokedPublishers.some(value => typeof value !== 'string') || rev.revokedReleases.some(value => typeof value !== 'string')) throw new Error('Invalid revocations');
    for (const id of rev.revokedPublishers as string[]) {revokedPublishers.add(id); host.revokePublisher(id);}
    for (const id of rev.revokedReleases as string[]) revokedReleases.add(id);
    const catalog = PluginCatalogSchema.parse(decode(await artifact('/plugins/catalog.json', 262_144)));
    const entry = catalog.entries.find(item => item.kind === 'plugin' && item.manifest.id === request.release.pluginId
      && item.manifest.version === request.release.version);
    if (!entry || entry.kind !== 'plugin' || entry.status !== 'available'
      || revokedPublishers.has(request.release.publisher.id) || revokedReleases.has(request.release.pluginId + '@' + request.release.version)) throw new Error('Release unavailable');
    if (request.operation === 'update' || request.operation === 'rollback') {
      if (!request.previousRelease || !(trusted.transitions ?? []).some((transition: Transition) => transition.pluginId === request.release.pluginId
        && transition.fromVersion === request.previousRelease!.version && transition.toVersion === request.release.version
        && transition.direction === request.operation && transition.stateSchemaVersion === request.release.stateSchemaVersion)) throw new Error('Release transition not authorized');
    }
    const [manifestBytes, bundle] = await Promise.all([artifact(entry.manifestPath, 16_384), artifact(entry.bundlePath, 512_000)]);
    const manifest = await host.verify({manifest: decode(manifestBytes), bundle});
    if (canonical(manifest) !== canonical(PluginManifestSchema.parse(entry.manifest))) throw new Error('Catalog mismatch');
    const release = PluginReleaseSchema.parse({pluginId: manifest.id, version: manifest.version, bundleDigest: manifest.integrity.digest,
      publisher: manifest.publisher, license: manifest.license, provenance: manifest.provenance, sdkVersion: manifest.sdkVersion,
      stateSchemaVersion: manifest.stateSchemaVersion, capabilities: manifest.capabilities});
    if (canonical(release) !== canonical(request.release)) throw new Error('Release identity mismatch');
    if (request.operation === 'install' || request.operation === 'consent') return;
    for (const state of request.states) {
      const session = await host.mount({manifest, bundle, instanceId: state.instanceId, state: state.state, consent: request.consent as Capability[]});
      session.dispose();
    }
  };
}
