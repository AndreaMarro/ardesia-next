import {
  CoreError, PluginInstallationSchema,
  type Actor, type CoreEvent, type CoreSnapshot, type LabData, type LabObject,
  type PluginCommand, type PluginInstallation, type PluginRelease,
} from '@ardesia/contracts';

/** Composition verifies the pinned release and validates every supplied scientific state. */
export interface PluginPolicyRequest {
  operation: 'install' | 'consent' | 'activate' | 'use' | 'update' | 'rollback';
  actor: Actor;
  release: PluginRelease;
  previousRelease?: PluginRelease;
  states: readonly LabData[];
  consent: readonly string[];
}
export type PluginPolicy = (request: PluginPolicyRequest) => Promise<void>;

export function findInstallation(state: CoreSnapshot, actor: Actor, pluginId: string): PluginInstallation | undefined {
  return state.installations.find(installation => installation.ownerId === actor.actorId && installation.pluginId === pluginId);
}

function matchesRelease(data: LabData, release: PluginRelease): boolean {
  return data.pluginId === release.pluginId && data.pluginVersion === release.version && data.bundleDigest === release.bundleDigest
    && data.publisher.id === release.publisher.id && data.publisher.keyId === release.publisher.keyId
    && data.stateSchemaVersion === release.stateSchemaVersion && data.state.schemaVersion === release.stateSchemaVersion;
}

function fullConsent(installation: PluginInstallation): boolean {
  return installation.consent !== null && JSON.stringify(installation.consent.release) === JSON.stringify(installation.release)
    && installation.release.capabilities.length === installation.consent.capabilities.length
    && installation.release.capabilities.every(capability => installation.consent!.capabilities.includes(capability));
}

async function verify(policy: PluginPolicy, request: PluginPolicyRequest): Promise<void> {
  // Policy cannot mutate the authoritative release, pending command or scientific state.
  try { await policy(structuredClone(request)); }
  catch (error) {
    if (error instanceof CoreError) throw error;
    throw new CoreError('PLUGIN_POLICY_REJECTED', 'The release or scientific state was not authorized. Saved data was preserved.');
  }
}

function ownedLabs(state: CoreSnapshot, actor: Actor, pluginId: string): LabObject[] {
  return state.documents.filter(document => document.ownerId === actor.actorId)
    .flatMap(document => document.objects.filter((object): object is LabObject => object.type === 'lab' && object.data.pluginId === pluginId));
}

/** The real marketplace composition supplies policy; M1 Core-only consumers retain their document API. */
export async function validateLabUse(state: CoreSnapshot, actor: Actor, data: LabData, policy?: PluginPolicy): Promise<void> {
  if (!policy) {
    if (state.installations.length) throw new CoreError('PLUGIN_POLICY_REQUIRED', 'The marketplace workspace requires its release verifier.');
    return;
  }
  const installation = findInstallation(state, actor, data.pluginId);
  if (installation?.status === 'revoked') throw new CoreError('PLUGIN_REVOKED', 'This module has been revoked. The saved laboratory is preserved.');
  if (!installation || installation.status !== 'active') throw new CoreError('PLUGIN_NOT_ACTIVE', 'Install, authorize and activate this module before using it.');
  if (!fullConsent(installation)) throw new CoreError('PLUGIN_CONSENT_REQUIRED', 'Explicit consent for this release is required.');
  if (!matchesRelease(data, installation.release)) throw new CoreError('INVALID_REFERENCE', 'The laboratory must use the installed, authorized release.');
  await verify(policy, {operation: 'use', actor, release: installation.release, states: [data], consent: installation.consent!.capabilities});
}

type DocumentTransition = {documentId: string; documentRevision: number; payload: CoreEvent['payload']};
export type PluginCommandResult = {installation: PluginInstallation; payload: CoreEvent['payload']; documents: DocumentTransition[]};
const payload = (value: unknown): CoreEvent['payload'] => JSON.parse(JSON.stringify(value)) as CoreEvent['payload'];

function compareVersion(left: string, right: string): number {
  const a = left.split('.').map(BigInt), b = right.split('.').map(BigInt);
  for (let index = 0; index < 3; index++) {
    if (a[index]! > b[index]!) return 1;
    if (a[index]! < b[index]!) return -1;
  }
  return 0;
}

/** Mutates only the transaction clone; the caller validates and atomically commits the full snapshot. */
export async function applyPluginCommand(state: CoreSnapshot, actor: Actor, command: PluginCommand, at: string, policy?: PluginPolicy): Promise<PluginCommandResult> {
  if (!policy) throw new CoreError('PLUGIN_POLICY_REQUIRED', 'A release verifier is required for marketplace commands.');
  const current = findInstallation(state, actor, command.pluginId);
  if (command.kind === 'install-plugin') {
    if (current) throw new CoreError('ALREADY_EXISTS', 'This module already has an installation for this owner.');
    if (command.release.pluginId !== command.pluginId) throw new CoreError('INVALID_REFERENCE', 'Requested plugin and release identities differ.');
    // Installation verifies code but never executes it, grants capabilities or alters existing labs.
    await verify(policy, {operation: 'install', actor, release: command.release, states: [], consent: []});
    const installation = PluginInstallationSchema.parse({
      ownerId: actor.actorId, pluginId: command.pluginId, revision: 1, status: 'installed',
      release: command.release, consent: null, history: [], createdAt: at, updatedAt: at,
    });
    state.installations.push(installation);
    return {installation, payload: payload({installation}), documents: []};
  }
  if (!current) throw new CoreError('NOT_FOUND', 'Module installation is unavailable for this owner.');
  if (current.revision !== command.expectedRevision) throw new CoreError('REVISION_CONFLICT', 'The module installation changed. Reload before retrying.');
  if (current.status === 'revoked') throw new CoreError('PLUGIN_REVOKED', 'This module has been revoked. Saved laboratories are preserved.');
  const previous = structuredClone(current);
  const documents: DocumentTransition[] = [];
  switch (command.kind) {
    case 'consent-plugin': {
      if (command.releaseDigest !== current.release.bundleDigest) throw new CoreError('INVALID_REFERENCE', 'Consent must name the current release digest.');
      if (command.capabilities.length !== current.release.capabilities.length
        || !current.release.capabilities.every(capability => command.capabilities.includes(capability))) {
        throw new CoreError('PLUGIN_CONSENT_REQUIRED', 'All requested capabilities must be explicitly granted; no ambient grants are added.');
      }
      await verify(policy, {operation: 'consent', actor, release: current.release, states: [], consent: command.capabilities});
      current.consent = {actorId: actor.actorId, release: structuredClone(current.release), capabilities: [...command.capabilities].sort(), grantedAt: at};
      break;
    }
    case 'activate-plugin': {
      if (!fullConsent(current)) throw new CoreError('PLUGIN_CONSENT_REQUIRED', 'Authorize the capabilities of this exact release before activating it.');
      const states = ownedLabs(state, actor, command.pluginId).map(object => object.data);
      if (states.some(data => !matchesRelease(data, current.release))) throw new CoreError('INVALID_REFERENCE', 'Existing laboratories require a different release. Their saved state was preserved.');
      await verify(policy, {operation: 'activate', actor, release: current.release, states, consent: current.consent!.capabilities});
      current.status = 'active';
      break;
    }
    case 'disable-plugin':
      current.status = 'disabled';
      break;
    case 'revoke-plugin':
      current.status = 'revoked';
      current.consent = null;
      break;
    case 'change-plugin-release': {
      const target = command.release;
      const ordering = compareVersion(target.version, current.release.version);
      if (target.pluginId !== current.pluginId || target.stateSchemaVersion !== current.release.stateSchemaVersion
        || (command.direction === 'update' ? ordering <= 0 : ordering >= 0)) {
        throw new CoreError('INVALID_PLUGIN_TRANSITION', 'Only declared transitions with the same state schema and the stated version direction are supported.');
      }
      if (!fullConsent(current) || target.capabilities.some(capability => !current.consent!.capabilities.includes(capability))) {
        throw new CoreError('PLUGIN_CONSENT_REQUIRED', 'A transition cannot introduce capabilities without prior explicit consent.');
      }
      const labs = ownedLabs(state, actor, command.pluginId);
      if (labs.some(object => !matchesRelease(object.data, current.release))) throw new CoreError('INVALID_REFERENCE', 'A laboratory does not match the previous installed release.');
      const targets = new Map(labs.map(object => [object, {
        ...object.data, pluginVersion: target.version, bundleDigest: target.bundleDigest,
        publisher: structuredClone(target.publisher), stateSchemaVersion: target.stateSchemaVersion,
      }]));
      await verify(policy, {operation: command.direction, actor, release: target, previousRelease: current.release,
        states: [...targets.values()], consent: current.consent!.capabilities});
      for (const document of state.documents) {
        if (document.ownerId !== actor.actorId) continue;
        const changes: {previous: LabObject; object: LabObject}[] = [];
        document.objects = document.objects.map(object => {
          if (object.type !== 'lab' || object.data.pluginId !== command.pluginId) return object;
          if (document.status !== 'draft') throw new CoreError('READ_ONLY', 'A release transition cannot change an approved document.');
          const updated: LabObject = {...object, revision: object.revision + 1, status: 'draft', data: structuredClone(targets.get(object)!)};
          changes.push({previous: object, object: updated});
          return updated;
        });
        if (changes.length) {
          document.revision += 1;
          document.updatedAt = at;
          documents.push({documentId: document.id, documentRevision: document.revision,
            payload: payload({pluginId: command.pluginId, direction: command.direction, previousRelease: previous.release, release: target, objects: changes})});
        }
      }
      current.history.push({release: previous.release, consent: previous.consent, changedAt: at, direction: command.direction});
      current.release = structuredClone(target);
      current.status = 'disabled';
      current.consent = null;
      break;
    }
  }
  current.revision += 1;
  current.updatedAt = at;
  return {installation: current, payload: payload({previous, installation: current}), documents};
}
