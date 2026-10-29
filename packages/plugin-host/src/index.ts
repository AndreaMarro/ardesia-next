import {
  CapabilitySchema, PluginManifestSchema, PluginStateSchema, PluginResponseSchema,
  SDK_VERSION, PLUGIN_PROTOCOL, MAX_PLUGIN_RESPONSE_BYTES, isBoundedJson, resolveCapabilities
} from '@ardesia/plugin-sdk';
import type {Capability, PluginManifest, PluginState, PluginRequest, PluginEvaluation} from '@ardesia/plugin-sdk';

export type {PluginEvaluation, PluginView} from '@ardesia/plugin-sdk';

export type PluginHostErrorCode =
  | 'INVALID_MANIFEST' | 'SDK_INCOMPATIBLE' | 'UNKNOWN_PUBLISHER' | 'REVOKED_PUBLISHER'
  | 'INVALID_SIGNATURE' | 'BUNDLE_TOO_LARGE' | 'INTEGRITY_MISMATCH' | 'RELEASE_NOT_ALLOWED'
  | 'CAPABILITY_DENIED' | 'INVALID_STATE' | 'INCOMPATIBLE_STATE' | 'EVALUATION_FAILED'
  | 'INVALID_RESPONSE' | 'PROTOCOL_VIOLATION' | 'RUNTIME_UNAVAILABLE' | 'RUNTIME_ERROR'
  | 'RUNTIME_TIMEOUT' | 'SESSION_DISPOSED' | 'BUSY'
  | 'PLUGIN_DISABLED' | 'HOST_DISPOSED' | 'POLICY_CHANGED';
export class PluginHostError extends Error {
  readonly code: PluginHostErrorCode;
  constructor(code: PluginHostErrorCode, message: string) {super(message); this.code = code; this.name = 'PluginHostError';}
}
const failure = (code: PluginHostErrorCode, message: string): never => {throw new PluginHostError(code, message);};

export interface TrustedPublisherKey {
  readonly publisherId: string;
  readonly keyId: string;
  /** Canonical base64 of the 32-byte raw Ed25519 public key. Never a private key. */
  readonly publicKeyBase64: string;
  readonly revoked?: boolean;
}
export interface FirstPartyRelease {
  readonly id: string;
  readonly version: string;
  readonly digest: string;
  readonly publisherId: string;
  readonly keyId: string;
}
export interface PluginHostPolicy {
  readonly allowlist: readonly FirstPartyRelease[];
  readonly capabilities: readonly Capability[];
  readonly maxBundleBytes?: number;
  readonly timeoutMs?: number;
}
/** Transport is supplied by trusted composition code, never by a manifest or plugin. */
export interface PluginRuntime {
  postMessage(request: PluginRequest): void;
  subscribe(onMessage: (message: unknown) => void, onError: () => void): () => void;
  terminate(): void;
}
export type PluginRuntimeFactory = (verifiedBundle: Uint8Array) => PluginRuntime;
export interface PluginHostOptions {
  readonly trustStore: readonly TrustedPublisherKey[];
  readonly policy: PluginHostPolicy;
  readonly runtimeFactory?: PluginRuntimeFactory;
}
export interface PluginArtifactRequest {
  readonly manifest: unknown;
  readonly bundle: Uint8Array;
}
export interface PluginMountRequest extends PluginArtifactRequest {
  readonly instanceId: string;
  readonly state: PluginState;
  readonly consent: readonly Capability[];
}
export interface PluginSession {
  readonly manifest: PluginManifest;
  readonly instanceId: string;
  readonly grants: readonly Capability[];
  readonly current: PluginEvaluation;
  evaluate(state: PluginState): Promise<PluginEvaluation>;
  dispose(): void;
}
export interface PluginHost {
  /** Verify discovery/install candidates without starting executable code or granting capabilities. */
  verify(request: PluginArtifactRequest): Promise<PluginManifest>;
  mount(request: PluginMountRequest): Promise<PluginSession>;
  /** Volatile projections of Core lifecycle; they never persist another installation registry. */
  suspendPlugin(pluginId: string): void;
  resumePlugin(pluginId: string): void;
  /** Runtime revocation cannot be undone by resumePlugin. Persist authority in the trusted source. */
  revokePublisher(publisherId: string): void;
  dispose(): void;
}

function sortedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${sortedJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Domain-separated, UTF-8 sorted-key JSON; all manifest fields except signature are signed. */
export function manifestSigningBytes(candidate: unknown): Uint8Array {
  const parsed = PluginManifestSchema.parse(candidate);
  const {signature: _signature, ...payload} = parsed;
  return new TextEncoder().encode(`ardesia-plugin-manifest/v1\n${sortedJson(payload)}`);
}
function decodeBase64(value: string, expectedBytes: number): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw Error('Invalid base64');
  const binary = atob(value);
  if (binary.length !== expectedBytes || btoa(binary) !== value) throw Error('Invalid base64 length');
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function asBuffer(bytes: Uint8Array): ArrayBuffer {return new Uint8Array(bytes).buffer;}
function clone<T>(value: T): T {return structuredClone(value);}
function stateForManifest(candidate: unknown, manifest: PluginManifest): PluginState {
  const parsed = PluginStateSchema.safeParse(candidate);
  if (!parsed.success) return failure('INVALID_STATE', 'Lo stato non è JSON valido o supera i limiti consentiti.');
  if (parsed.data.schemaVersion !== manifest.stateSchemaVersion) return failure('INCOMPATIBLE_STATE', 'La versione dello stato non è compatibile con questo plugin.');
  return clone(parsed.data);
}
/** Shape inspection never grants execution; mount must verify bytes and pinned trust. */
export function inspectPlugin(candidate: unknown): {allowed: false; reason: 'INVALID_MANIFEST' | 'VERIFICATION_REQUIRED'} {
  return {allowed: false, reason: PluginManifestSchema.safeParse(candidate).success ? 'VERIFICATION_REQUIRED' : 'INVALID_MANIFEST'};
}
export const hostAvailability = Object.freeze({install: false, execute: true, thirdParty: false, reason: 'Il runtime verifica ed esegue moduli first-party; installazioni e consensi appartengono al Core.'});

export function createBrowserWorkerRuntime(verifiedBundle: Uint8Array): PluginRuntime {
  if (typeof Worker === 'undefined' || typeof URL.createObjectURL !== 'function') return failure('RUNTIME_UNAVAILABLE', 'Questo browser non supporta il runtime del plugin.');
  const url = URL.createObjectURL(new Blob([asBuffer(verifiedBundle)], {type: 'text/javascript'}));
  let worker: Worker;
  try {worker = new Worker(url, {type: 'module', name: 'ardesia-first-party'});}
  catch {URL.revokeObjectURL(url); return failure('RUNTIME_UNAVAILABLE', 'Impossibile avviare il runtime del plugin.');}
  let terminated = false;
  return {
    postMessage: request => worker.postMessage(request),
    subscribe(onMessage, onError) {
      const message = (event: MessageEvent<unknown>) => onMessage(event.data);
      const error = (event: Event) => {event.preventDefault(); onError();};
      worker.addEventListener('message', message);
      worker.addEventListener('error', error);
      worker.addEventListener('messageerror', error);
      return () => {
        worker.removeEventListener('message', message);
        worker.removeEventListener('error', error);
        worker.removeEventListener('messageerror', error);
      };
    },
    terminate() {if (!terminated) {terminated = true; worker.terminate(); URL.revokeObjectURL(url);}}
  };
}

export function createPluginHost(options: PluginHostOptions): PluginHost {
  // Snapshot the trusted composition configuration: callers cannot mutate grants during verification.
  const trustStore = clone(options.trustStore);
  const policy = clone(options.policy);
  const maxBundleBytes = policy.maxBundleBytes ?? 256_000;
  const timeoutMs = policy.timeoutMs ?? 5_000;
  if (!Number.isInteger(maxBundleBytes) || maxBundleBytes < 1 || maxBundleBytes > 2_000_000 || !Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 30_000) throw Error('Invalid plugin host limits');
  if (new Set(trustStore.map(key => `${key.publisherId}\0${key.keyId}`)).size !== trustStore.length) throw Error('Duplicate publisher trust identity');
  if (policy.capabilities.some(capability => !CapabilitySchema.safeParse(capability).success)) throw Error('Invalid host capability policy');
  const runtimeFactory = options.runtimeFactory ?? createBrowserWorkerRuntime;
  const suspended = new Set<string>();
  const revokedPublishers = new Set<string>();
  const pluginEpochs = new Map<string, number>();
  type RunningSession = {pluginId: string; publisherId: string; stop(error: PluginHostError): void};
  const sessions = new Set<RunningSession>();
  let hostDisposed = false;

  function requireTrustCurrent(manifest: PluginManifest) {
    if (hostDisposed) return failure('HOST_DISPOSED', 'L’Host dei moduli è stato chiuso.');
    if (revokedPublishers.has(manifest.publisher.id)) return failure('REVOKED_PUBLISHER', 'Il publisher è stato revocato.');
  }
  function requireMountCurrent(manifest: PluginManifest, epoch: number) {
    requireTrustCurrent(manifest);
    if (suspended.has(manifest.id)) return failure('PLUGIN_DISABLED', 'Il modulo è disattivato. I dati salvati sono conservati.');
    if ((pluginEpochs.get(manifest.id) ?? 0) !== epoch) return failure('POLICY_CHANGED', 'Le autorizzazioni sono cambiate durante l’apertura. Riapri il modulo.');
  }
  function prepareArtifact(request: PluginArtifactRequest) {
    if (hostDisposed) return failure('HOST_DISPOSED', 'L’Host dei moduli è stato chiuso.');
    // These copies happen before the first await, including when mount also copies state/consent.
    const rawManifest = request.manifest;
    if (!isBoundedJson(rawManifest, 32_768)) return failure('INVALID_MANIFEST', 'Il manifest non è JSON valido o supera i limiti consentiti.');
    if (rawManifest && typeof rawManifest === 'object' && 'sdkVersion' in rawManifest && rawManifest.sdkVersion !== SDK_VERSION) return failure('SDK_INCOMPATIBLE', 'Versione SDK non supportata.');
    const parsed = PluginManifestSchema.safeParse(rawManifest);
    if (!parsed.success || new Set(parsed.data.capabilities).size !== parsed.data.capabilities.length) return failure('INVALID_MANIFEST', 'Il manifest non rispetta il contratto del plugin.');
    const manifest = parsed.data;
    if (!(request.bundle instanceof Uint8Array) || request.bundle.byteLength < 1 || request.bundle.byteLength > maxBundleBytes) return failure('BUNDLE_TOO_LARGE', 'Il bundle è vuoto o supera i limiti consentiti.');
    const bundle = new Uint8Array(request.bundle);
    requireTrustCurrent(manifest);
    const trustedKey = trustStore.find(key => key.publisherId === manifest.publisher.id && key.keyId === manifest.publisher.keyId);
    if (!trustedKey) return failure('UNKNOWN_PUBLISHER', 'Il publisher o la chiave non appartiene al registro di fiducia.');
    if (trustedKey.revoked) return failure('REVOKED_PUBLISHER', 'La chiave del publisher è stata revocata.');
    if (!policy.allowlist.some(release => release.id === manifest.id && release.version === manifest.version && release.digest === manifest.integrity.digest && release.publisherId === manifest.publisher.id && release.keyId === manifest.publisher.keyId)) return failure('RELEASE_NOT_ALLOWED', 'Questa versione del plugin non è stata autorizzata.');
    if (!manifest.capabilities.includes('state:read') || manifest.capabilities.some(capability => !policy.capabilities.includes(capability))) return failure('CAPABILITY_DENIED', 'Il plugin richiede capacità non ammesse dalla policy.');
    return {manifest, bundle, trustedKey};
  }
  async function verifyPrepared({manifest, bundle, trustedKey}: ReturnType<typeof prepareArtifact>) {
    requireTrustCurrent(manifest);
    if (!globalThis.crypto?.subtle) return failure('RUNTIME_UNAVAILABLE', 'La verifica crittografica richiede un contesto sicuro.');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', asBuffer(bundle)));
    const digestHex = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    if (digestHex !== manifest.integrity.digest) return failure('INTEGRITY_MISMATCH', 'L’integrità del bundle non corrisponde al manifest.');
    try {
      const key = await crypto.subtle.importKey('raw', asBuffer(decodeBase64(trustedKey.publicKeyBase64, 32)), {name: 'Ed25519'}, false, ['verify']);
      const signature = decodeBase64(manifest.signature.value, 64);
      const valid = await crypto.subtle.verify({name: 'Ed25519'}, key, asBuffer(signature), asBuffer(manifestSigningBytes(manifest)));
      if (!valid) return failure('INVALID_SIGNATURE', 'La firma Ed25519 del plugin non è valida.');
    } catch (error) {
      if (error instanceof PluginHostError) throw error;
      if (error instanceof DOMException && error.name === 'NotSupportedError') return failure('RUNTIME_UNAVAILABLE', 'Questo browser non supporta la verifica Ed25519 richiesta.');
      return failure('INVALID_SIGNATURE', 'La chiave o la firma Ed25519 non è valida.');
    }
    requireTrustCurrent(manifest);
  }

  return {
    async verify(request) {
      const artifact = prepareArtifact(request);
      await verifyPrepared(artifact);
      return clone(artifact.manifest);
    },
    suspendPlugin(pluginId) {
      suspended.add(pluginId);
      pluginEpochs.set(pluginId, (pluginEpochs.get(pluginId) ?? 0) + 1);
      for (const session of sessions) if (session.pluginId === pluginId) session.stop(new PluginHostError('PLUGIN_DISABLED', 'Il modulo è stato disattivato.'));
    },
    resumePlugin(pluginId) {
      if (hostDisposed) return failure('HOST_DISPOSED', 'L’Host dei moduli è stato chiuso.');
      // Keep the generation: work started before a suspend cannot resume with new consent.
      suspended.delete(pluginId);
    },
    revokePublisher(publisherId) {
      revokedPublishers.add(publisherId);
      for (const session of sessions) if (session.publisherId === publisherId) session.stop(new PluginHostError('REVOKED_PUBLISHER', 'Il publisher è stato revocato.'));
    },
    dispose() {
      hostDisposed = true;
      for (const session of sessions) session.stop(new PluginHostError('HOST_DISPOSED', 'L’Host dei moduli è stato chiuso.'));
    },
    async mount(request) {
      // Copy all untrusted inputs before the first await to avoid mutable-byte TOCTOU.
      const artifact = prepareArtifact(request);
      const {manifest, bundle} = artifact;
      const epoch = pluginEpochs.get(manifest.id) ?? 0;
      requireMountCurrent(manifest, epoch);
      if (typeof request.instanceId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(request.instanceId)) return failure('INVALID_STATE', 'Identità dell’istanza non valida.');
      const instanceId = request.instanceId;
      const initialState = stateForManifest(request.state, manifest);
      if (!Array.isArray(request.consent)) return failure('CAPABILITY_DENIED', 'Il consenso alle capacità deve essere esplicito.');
      const consent = [...request.consent];
      if (consent.some(capability => !CapabilitySchema.safeParse(capability).success)) return failure('CAPABILITY_DENIED', 'Consenso alle capacità non valido.');
      const grants = resolveCapabilities(manifest.capabilities, consent).filter(capability => policy.capabilities.includes(capability));
      if (manifest.capabilities.some(capability => !grants.includes(capability)) || !grants.includes('state:read')) return failure('CAPABILITY_DENIED', 'Il plugin richiede capacità non autorizzate.');
      await verifyPrepared(artifact);
      requireMountCurrent(manifest, epoch);

      let runtime: PluginRuntime;
      try {runtime = runtimeFactory(new Uint8Array(bundle));}
      catch (error) {if (error instanceof PluginHostError) throw error; return failure('RUNTIME_UNAVAILABLE', 'Impossibile avviare il plugin verificato.');}
      let disposed = false;
      let running: RunningSession | undefined;
      let current: PluginEvaluation | undefined;
      let requestCounter = 0;
      const nonce = crypto.randomUUID();
      let pending: {id: string; state: PluginState; resolve: (value: PluginEvaluation) => void; reject: (error: PluginHostError) => void; timer: ReturnType<typeof setTimeout>} | undefined;
      let unsubscribe: () => void = () => {};
      function stop(error: PluginHostError) {
        if (disposed) return;
        disposed = true;
        if (running) sessions.delete(running);
        try {unsubscribe();} catch { /* Teardown must still reject pending work. */ }
        try {runtime.terminate();} catch { /* The disposed boundary still rejects all future messages. */ }
        if (pending) {clearTimeout(pending.timer); const task = pending; pending = undefined; task.reject(error);}
      }
      unsubscribe = runtime.subscribe(message => {
        if (disposed) return;
        if (!isBoundedJson(message, MAX_PLUGIN_RESPONSE_BYTES)) {stop(new PluginHostError('INVALID_RESPONSE', 'La risposta del plugin supera i limiti consentiti.')); return;}
        const result = PluginResponseSchema.safeParse(message);
        if (!result.success) {stop(new PluginHostError('INVALID_RESPONSE', 'La risposta del plugin non rispetta il protocollo.')); return;}
        const response = result.data;
        if (!pending || response.requestId !== pending.id || response.instanceId !== instanceId) {stop(new PluginHostError('PROTOCOL_VIOLATION', 'Risposta inattesa o riferita a un’altra istanza.')); return;}
        const task = pending;
        clearTimeout(task.timer);
        pending = undefined;
        if (!response.ok) {task.reject(new PluginHostError(response.error.code, response.error.message)); return;}
        if (response.state.schemaVersion !== manifest.stateSchemaVersion || sortedJson(response.state) !== sortedJson(task.state)) {
          task.reject(new PluginHostError('INVALID_RESPONSE', 'Il plugin ha restituito uno stato diverso da quello richiesto.'));
          stop(new PluginHostError('INVALID_RESPONSE', 'Stato del plugin inatteso.'));
          return;
        }
        current = clone({state: response.state, view: response.view});
        task.resolve(clone(current));
      }, () => stop(new PluginHostError('RUNTIME_ERROR', 'Il runtime del plugin ha segnalato un errore.')));

      const session: PluginSession = {
        get manifest() {return clone(manifest);},
        instanceId,
        get grants() {return [...grants];},
        get current() {if (!current) return failure('INVALID_STATE', 'Il plugin non ha ancora uno stato valutato.'); return clone(current);},
        async evaluate(candidate) {
          if (disposed) return failure('SESSION_DISPOSED', 'L’istanza del plugin è stata chiusa.');
          requireMountCurrent(manifest, epoch);
          if (pending) return failure('BUSY', 'Una valutazione è già in corso.');
          const state = stateForManifest(candidate, manifest);
          if (current && sortedJson(current.state) !== sortedJson(state) && !grants.includes('state:write')) return failure('CAPABILITY_DENIED', 'Il plugin non può modificare lo stato.');
          return new Promise<PluginEvaluation>((resolve, reject) => {
            const id = `${nonce}:${++requestCounter}`;
            const timer = setTimeout(() => stop(new PluginHostError('RUNTIME_TIMEOUT', 'Il plugin non ha risposto entro il limite.')), timeoutMs);
            pending = {id, state, resolve, reject, timer};
            try {runtime.postMessage({protocol: PLUGIN_PROTOCOL, requestId: id, instanceId, action: 'evaluate', state: clone(state)});}
            catch {stop(new PluginHostError('RUNTIME_ERROR', 'Invio al runtime del plugin non riuscito.'));}
          });
        },
        dispose() {stop(new PluginHostError('SESSION_DISPOSED', 'L’istanza del plugin è stata chiusa.'));}
      };
      running = {pluginId: manifest.id, publisherId: manifest.publisher.id, stop};
      sessions.add(running);
      try {requireMountCurrent(manifest, epoch); await session.evaluate(initialState); if (disposed) return failure('SESSION_DISPOSED', 'Il plugin ha violato il protocollo durante l’avvio.'); requireMountCurrent(manifest, epoch); return session;}
      catch (error) {session.dispose(); throw error;}
    }
  };
}


/** Reviewed first-party pins shared by server and browser composition. */
export {default as firstPartyTrust} from './first-party-trust.json';
