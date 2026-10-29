import {createPluginHost, type PluginSession, type TrustedPublisherKey, type FirstPartyRelease} from '@ardesia/plugin-host';
import {PluginCatalogSchema, PluginManifestSchema, type CatalogPlugin, type PluginManifest, type Capability} from '@ardesia/plugin-sdk';
import {idealSpringId, idealSpringInitialState} from '@ardesia/ideal-spring';
import {LabDataSchema, PluginReleaseSchema, type LabData, type Actor, type PluginRelease, type PluginCommand} from '@ardesia/contracts';
import type {CoreService} from '@ardesia/core';
import {firstPartyTrust as trustConfiguration} from '@ardesia/plugin-host';

type Transition = {pluginId: string; fromVersion: string; toVersion: string; direction: 'update'|'rollback'; stateSchemaVersion: string};
const releaseTrust: {trustStore: TrustedPublisherKey[]; allowlist: FirstPartyRelease[]; transitions?: Transition[]} = trustConfiguration;
// One Host, with independently reviewed keys and release pins. The catalog grants nothing.
const host = createPluginHost({trustStore: releaseTrust.trustStore, policy: {
  allowlist: releaseTrust.allowlist, capabilities: ['state:read', 'state:write'], maxBundleBytes: 512_000, timeoutMs: 5_000,
}});
type RemotePolicyContext = {documentId?: string; refresh: () => Promise<unknown>};
let context: {core: CoreService; actor: Actor; remote: RemotePolicyContext} | null = null;
let contextEpoch = 0;
let policyFingerprint = '';
let staleWorkspace = false;
const listeners = new Set<() => void>();
let version = 0;
const revokedPublishers = new Set<string>(), revokedReleases = new Set<string>();
export const subscribeMarketplace = (listener: () => void) => {listeners.add(listener); return () => {listeners.delete(listener);};};
export const marketplaceVersion = () => version;
function changed() {version += 1; for (const listener of listeners) listener();}
const fail = (code: string): never => {throw Object.assign(new Error(code), {code});};
function current() {if (!context) return fail('WORKSPACE_UNAVAILABLE'); return context;}
export function getInstallation(pluginId: string = idealSpringId) {const {core, actor} = current(); return core.getInstallation(actor, pluginId);}
function runtimeGrants(pluginId: string) {
  const {core, actor, remote} = current();
  if (actor.role === 'teacher') {const installation = core.getInstallation(actor, pluginId); return installation ? [installation] : [];}
  if (!remote.documentId) return [];
  try {return core.getAssignedDocument(actor, remote.documentId).objects.filter(object => object.type === 'lab' && object.data.pluginId === pluginId)
    .map(object => core.getAssignedLabAccess(actor, remote.documentId!, object.id));} catch {return [];}
}
function syncRuntimePolicy() {
  for (const id of new Set(releaseTrust.allowlist.map(entry => entry.id))) {
    const allowed = context && !staleWorkspace && runtimeGrants(id).some(grant => grant.status === 'active'
      && ('consented' in grant ? grant.consented : !!grant.consent) && grant.release
      && !revokedPublishers.has(grant.release.publisher.id) && !revokedReleases.has(id + '@' + grant.release.version));
    if (allowed) host.resumePlugin(id); else host.suspendPlugin(id);
  }
}
export function syncMarketplace() {
  if (!context) return;
  const next = JSON.stringify(releaseTrust.allowlist.map(release => runtimeGrants(release.id).map(grant => ({
    status: grant.status, revision: 'installationRevision' in grant ? grant.installationRevision : grant.revision,
    consented: 'consented' in grant ? grant.consented : !!grant.consent, release: grant.release,
  }))));
  syncRuntimePolicy();
  if (next !== policyFingerprint) {policyFingerprint = next; changed();}
}
export function disconnectMarketplace() {
  contextEpoch++; context = null; staleWorkspace = true; policyFingerprint = '';
  for (const release of releaseTrust.allowlist) host.suspendPlugin(release.id);
  changed();
}
export function connectMarketplace(core: CoreService, actor: Actor, remote: RemotePolicyContext) {
  disconnectMarketplace(); context = {core, actor: structuredClone(actor), remote}; staleWorkspace = false; syncMarketplace();
}
async function refreshAuthorization(epoch: number) {
  const original = current(); await original.remote.refresh();
  if (epoch !== contextEpoch || context !== original) return fail('SESSION_CHANGED');
  syncMarketplace();
}
async function readArtifact(path: string, maximum: number): Promise<Uint8Array> {
  const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(path, {signal: controller.signal, credentials: 'same-origin', redirect: 'error', cache: 'no-cache'});
    if (!response.ok || !response.body) return fail('ARTIFACT_UNAVAILABLE');
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.length; if (size > maximum) {await reader.cancel(); return fail('ARTIFACT_TOO_LARGE');}
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
    return bytes;
  } finally {window.clearTimeout(timeout);}
}
const decode = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)) as unknown;
/** Deny-only, same-origin release policy. It cannot add publishers, keys, releases or grants. */
async function refreshRevocations() {
  const raw = decode(await readArtifact('/plugins/revocations.json', 16_384));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('INVALID_REVOCATIONS');
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).sort().join(',') !== 'revision,revokedPublishers,revokedReleases,schemaVersion'
    || value.schemaVersion !== '1.0.0' || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1
    || !Array.isArray(value.revokedPublishers) || !Array.isArray(value.revokedReleases)
    || value.revokedPublishers.length > 500 || value.revokedReleases.length > 500
    || value.revokedPublishers.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(id))
    || value.revokedReleases.some(id => typeof id !== 'string' || !/^[a-z][a-z0-9.-]{2,80}@\d+\.\d+\.\d+$/.test(id))) return fail('INVALID_REVOCATIONS');
  let updated = false;
  for (const id of value.revokedPublishers as string[]) if (!revokedPublishers.has(id)) {
    revokedPublishers.add(id); host.revokePublisher(id); updated = true;
  }
  for (const id of value.revokedReleases as string[]) if (!revokedReleases.has(id)) {
    revokedReleases.add(id); host.suspendPlugin(id.split('@')[0]!); updated = true;
  }
  if (updated) changed();
}
function requireAvailable(manifest: PluginManifest) {
  if (revokedPublishers.has(manifest.publisher.id)) return fail('REVOKED_PUBLISHER');
  if (revokedReleases.has(manifest.id + '@' + manifest.version)) return fail('REVOKED_RELEASE');
}
export async function loadCatalog() {
  await refreshRevocations();
  const parsed = PluginCatalogSchema.safeParse(decode(await readArtifact('/plugins/catalog.json', 262_144)));
  if (!parsed.success) return fail('INVALID_CATALOG');
  return parsed.data;
}
export function releaseFromManifest(manifest: PluginManifest): PluginRelease {
  return PluginReleaseSchema.parse({pluginId: manifest.id, version: manifest.version, bundleDigest: manifest.integrity.digest,
    publisher: manifest.publisher, license: manifest.license, provenance: manifest.provenance, sdkVersion: manifest.sdkVersion,
    stateSchemaVersion: manifest.stateSchemaVersion, capabilities: manifest.capabilities});
}
async function artifacts(entry: CatalogPlugin) {
  if (entry.status !== 'available') {host.suspendPlugin(entry.manifest.id); return fail('REVOKED_RELEASE');}
  requireAvailable(entry.manifest);
  const [manifestBytes, bundle] = await Promise.all([readArtifact(entry.manifestPath, 16_384), readArtifact(entry.bundlePath, 512_000)]);
  const manifest = await host.verify({manifest: decode(manifestBytes), bundle});
  requireAvailable(manifest);
  if (JSON.stringify(manifest) !== JSON.stringify(PluginManifestSchema.parse(entry.manifest))) return fail('CATALOG_MISMATCH');
  return {manifest, bundle};
}
async function sourceFor(release: PluginRelease) {
  if (staleWorkspace) return fail('STALE_WORKSPACE');
  const catalog = await loadCatalog();
  const entry = catalog.entries.find((item): item is CatalogPlugin => item.kind === 'plugin'
    && item.manifest.id === release.pluginId && item.manifest.version === release.version);
  if (!entry) return fail('RELEASE_NOT_ALLOWED');
  const source = await artifacts(entry);
  if (staleWorkspace) return fail('STALE_WORKSPACE');
  if (JSON.stringify(releaseFromManifest(source.manifest)) !== JSON.stringify(PluginReleaseSchema.parse(release))) return fail('INSTANCE_IDENTITY_MISMATCH');
  return source;
}
export async function verifyModule(entry: CatalogPlugin): Promise<PluginRelease> {
  // Reload discovery too: a verification result is not a reusable authorization token.
  const release = releaseFromManifest(entry.manifest);
  await sourceFor(release);
  return release;
}
type PluginAction = PluginCommand extends infer C ? C extends PluginCommand ? Omit<C, 'commandId'|'expectedRevision'> : never : never;
export async function changeInstallation(action: PluginAction) {
  if (staleWorkspace) return fail('STALE_WORKSPACE');
  const {core, actor} = current();
  const installed = getInstallation(action.pluginId);
  try {
    await core.executePlugin(actor, {...action, commandId: crypto.randomUUID(), expectedRevision: installed?.revision ?? 0} as PluginCommand);
    syncRuntimePolicy(); changed();
  } catch (error) {syncRuntimePolicy(); throw error;}
}
export async function checkUpdates(pluginId: string): Promise<string> {
  const installed = getInstallation(pluginId); if (!installed) return fail('PLUGIN_NOT_INSTALLED');
  const catalog = await loadCatalog();
  const candidates = catalog.entries.filter((item): item is CatalogPlugin => item.kind === 'plugin' && item.manifest.id === pluginId);
  for (const candidate of candidates) await verifyModule(candidate);
  if (candidates.some(item => item.manifest.version !== installed.release.version)) return fail('UPDATE_NOT_AUTHORIZED');
  await sourceFor(installed.release);
  return 'La versione installata è verificata. Nessun aggiornamento o rollback autorizzato è disponibile.';
}
function activeInstallation(data?: LabData) {
  if (staleWorkspace) return fail('STALE_WORKSPACE');
  const {core, actor, remote} = current();
  let installed: {release: PluginRelease; consent: {capabilities: string[]} | null; status: string} | null;
  if (actor.role === 'student') {
    if (!data || !remote.documentId) return fail('CAPABILITY_DENIED');
    const object = core.getAssignedDocument(actor, remote.documentId).objects.find(object => object.type === 'lab' && object.data.instanceId === data.instanceId);
    if (!object) return fail('CAPABILITY_DENIED');
    const access = core.getAssignedLabAccess(actor, remote.documentId, object.id);
    if (!access.release || !access.consented) return fail('CAPABILITY_DENIED');
    installed = {release: access.release, status: access.status, consent: {capabilities: access.release.capabilities}};
  } else installed = getInstallation(data?.pluginId);
  if (!installed) return fail('PLUGIN_NOT_INSTALLED');
  if (installed.status === 'revoked') return fail('PLUGIN_REVOKED');
  if (installed.status !== 'active' || !installed.consent) return fail('PLUGIN_DISABLED');
  if (data && (installed.release.version !== data.pluginVersion || installed.release.bundleDigest !== data.bundleDigest
    || installed.release.publisher.id !== data.publisher.id || installed.release.publisher.keyId !== data.publisher.keyId
    || installed.release.stateSchemaVersion !== data.stateSchemaVersion)) return fail('INCOMPATIBLE_STATE');
  return installed;
}
export async function createFirstPartyLab(): Promise<LabData> {
  const epoch = contextEpoch; await refreshAuthorization(epoch);
  const installed = activeInstallation(), source = await sourceFor(installed.release);
  if (epoch !== contextEpoch) return fail('SESSION_CHANGED');
  activeInstallation(); requireAvailable(source.manifest);
  const session = await host.mount({...source, instanceId: crypto.randomUUID(), state: idealSpringInitialState, consent: installed.consent!.capabilities as Capability[]});
  try {
    if (epoch !== contextEpoch) return fail('SESSION_CHANGED');
    activeInstallation();
    return LabDataSchema.parse({pluginId: session.manifest.id, pluginVersion: session.manifest.version, instanceId: session.instanceId,
      stateSchemaVersion: session.manifest.stateSchemaVersion, bundleDigest: session.manifest.integrity.digest,
      publisher: session.manifest.publisher, state: session.current.state});
  } finally {session.dispose();}
}
export async function mountLab(input: LabData): Promise<PluginSession> {
  const epoch = contextEpoch; await refreshAuthorization(epoch);
  const data = LabDataSchema.parse(input), installed = activeInstallation(data), source = await sourceFor(installed.release);
  if (epoch !== contextEpoch) return fail('SESSION_CHANGED');
  activeInstallation(data); requireAvailable(source.manifest);
  const session = await host.mount({...source, instanceId: data.instanceId, state: data.state, consent: installed.consent!.capabilities as Capability[]});
  try {
    if (epoch !== contextEpoch) return fail('SESSION_CHANGED');
    activeInstallation(data); requireAvailable(session.manifest);
    return {
      manifest: session.manifest, instanceId: session.instanceId, grants: session.grants,
      get current() {return session.current;},
      async evaluate(state) {
        await refreshAuthorization(epoch); activeInstallation(data);
        const next = await session.evaluate(state);
        if (epoch !== contextEpoch) return fail('SESSION_CHANGED');
        activeInstallation(data); return next;
      },
      dispose: () => session.dispose(),
    };
  } catch (error) {session.dispose(); throw error;}
}
export function pluginErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code;
  return error instanceof Error ? error.message : 'PLUGIN_UNAVAILABLE';
}
export function moduleStatus(pluginId: string = idealSpringId): string {
  if (staleWorkspace) return 'Spazio aggiornato · ricarica';
  const installed = getInstallation(pluginId);
  if (installed && (revokedPublishers.has(installed.release.publisher.id) || revokedReleases.has(pluginId + '@' + installed.release.version))) return 'Revocato';
  return installed ? {installed:'Installato · da autorizzare',active:'Attivo',disabled:'Disattivato',revoked:'Revocato'}[installed.status] : 'Disponibile';
}
