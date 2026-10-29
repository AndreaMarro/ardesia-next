import {describe, it, expect, vi} from 'vitest';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {createPluginHost, manifestSigningBytes} from './index';
import type {PluginHostOptions, PluginMountRequest, PluginRuntime, PluginRuntimeFactory} from './index';
import type {Capability, PluginManifest, PluginRequest, PluginState, PluginView} from '@ardesia/plugin-sdk';
import {PluginStateSchema, isBoundedJson} from '@ardesia/plugin-sdk';

const state: PluginState = {schemaVersion: '1.0.0', value: {massKg: 1, timeS: 0}};
const view: PluginView = {
  title: 'Verified model', summary: 'A bounded scientific result',
  parameters: [{key: 'massKg', label: 'Massa', unit: 'kg', min: 0.1, max: 10, step: 0.1, value: 1}],
  metrics: [{label: 'Periodo', value: 1, unit: 's'}],
  plot: {xLabel: 'Tempo', xUnit: 's', yLabel: 'Posizione', yUnit: 'm', series: [{id: 'x', label: 'x(t)', points: [{x: 0, y: 1}, {x: 1, y: 0}]}]},
  explanation: ['Il modello viene eseguito dal runtime verificato.']
};
const baseManifest = (digest: string, requested: Capability[] = ['state:read', 'state:write']): PluginManifest => ({
  schemaVersion: '1.0.0', id: 'ardesia.fixture', name: 'Fixture', version: '1.0.0', sdkVersion: '1.0.0', kind: 'plugin',
  publisher: {id: 'ardesia', keyId: 'test-release'}, license: 'UNLICENSED',
  provenance: {repository: 'https://github.com/AndreaMarro/ardesia-next', commit: 'a'.repeat(40), path: 'plugins/fixture'},
  integrity: {algorithm: 'SHA-256', digest}, signature: {algorithm: 'Ed25519', value: 'pending'},
  capabilities: requested, stateSchemaVersion: '1.0.0', execution: 'first-party'
});
function fixture(bundleText = '/* signed fixture */', requested?: Capability[]) {
  // Private material is ephemeral process memory and is never persisted or logged.
  const keys = generateKeyPairSync('ed25519');
  const bundle = new TextEncoder().encode(bundleText);
  const manifest = baseManifest(createHash('sha256').update(bundle).digest('hex'), requested);
  manifest.signature.value = sign(null, manifestSigningBytes(manifest), keys.privateKey).toString('base64');
  const jwk = keys.publicKey.export({format: 'jwk'});
  const publicKeyBase64 = Buffer.from(jwk.x!, 'base64url').toString('base64');
  const options: PluginHostOptions = {
    trustStore: [{publisherId: 'ardesia', keyId: 'test-release', publicKeyBase64}],
    policy: {
      allowlist: [{id: manifest.id, version: manifest.version, digest: manifest.integrity.digest, publisherId: 'ardesia', keyId: 'test-release'}],
      capabilities: ['state:read', 'state:write', 'objects:read'], timeoutMs: 500
    }
  };
  const request: PluginMountRequest = {manifest, bundle, instanceId: 'instance-fixture', state, consent: ['state:read', 'state:write', 'objects:read']};
  return {manifest, bundle, options, request, keys};
}
function transport(handler?: (request: PluginRequest, reply: (value: unknown) => void) => void) {
  let reply = (_value: unknown) => {};
  const terminate = vi.fn();
  const postMessage = vi.fn((request: PluginRequest) => {
    if (handler) handler(request, reply);
    else queueMicrotask(() => reply({protocol: request.protocol, requestId: request.requestId, instanceId: request.instanceId, ok: true, state: request.state, view}));
  });
  const runtime: PluginRuntime = {postMessage, terminate, subscribe: onMessage => {reply = onMessage; return () => {reply = () => {};};}};
  const factory = vi.fn((_bytes: Uint8Array) => runtime);
  return {factory, postMessage, terminate, emit: (value: unknown) => reply(value)};
}

describe('M1 cryptographic execution gate', () => {
  it('signs a deterministic domain-separated canonical payload, independent of object insertion order', () => {
    const manifest = baseManifest('b'.repeat(64), ['state:read']);
    const expected = 'ardesia-plugin-manifest/v1\n' +
      '{"capabilities":["state:read"],"execution":"first-party","id":"ardesia.fixture","integrity":{"algorithm":"SHA-256","digest":"' + 'b'.repeat(64) + '"},"kind":"plugin","license":"UNLICENSED","name":"Fixture","provenance":{"commit":"' + 'a'.repeat(40) + '","path":"plugins/fixture","repository":"https://github.com/AndreaMarro/ardesia-next"},"publisher":{"id":"ardesia","keyId":"test-release"},"schemaVersion":"1.0.0","sdkVersion":"1.0.0","stateSchemaVersion":"1.0.0","version":"1.0.0"}';
    expect(new TextDecoder().decode(manifestSigningBytes(manifest))).toBe(expected);
    expect(manifestSigningBytes({...manifest, publisher: {keyId: 'test-release', id: 'ardesia'}, signature: {algorithm: 'Ed25519', value: 'different'}})).toEqual(manifestSigningBytes(manifest));
  });
  it('verifies SHA-256 and real Ed25519, then passes exactly the verified bytes to the runtime', async () => {
    const f = fixture(); const runtime = transport();
    const session = await createPluginHost({...f.options, runtimeFactory: runtime.factory}).mount(f.request);
    expect(runtime.factory).toHaveBeenCalledOnce();
    expect(runtime.factory.mock.calls[0]![0]).toEqual(f.bundle);
    expect(session.manifest).toEqual(f.manifest);
    expect(session.current.state).toEqual(state);
    expect(session.grants).toEqual(['state:read', 'state:write']);
    session.dispose(); expect(runtime.terminate).toHaveBeenCalledOnce();
  });
  it('rejects a modified bundle before any executable runtime is created', async () => {
    const f = fixture(); const runtime = transport(); const tampered = new Uint8Array(f.bundle); tampered[0] = tampered[0]! ^ 1;
    await expect(createPluginHost({...f.options, runtimeFactory: runtime.factory}).mount({...f.request, bundle: tampered})).rejects.toMatchObject({code: 'INTEGRITY_MISMATCH'});
    expect(runtime.factory).not.toHaveBeenCalled();
  });
  it('rejects a forged signature and a self-asserted publisher key', async () => {
    const f = fixture(); const runtime = transport(); const host = createPluginHost({...f.options, runtimeFactory: runtime.factory});
    await expect(host.mount({...f.request, manifest: {...f.manifest, signature: {algorithm: 'Ed25519', value: Buffer.alloc(64).toString('base64')}}})).rejects.toMatchObject({code: 'INVALID_SIGNATURE'});
    await expect(host.mount({...f.request, manifest: {...f.manifest, publisher: {...f.manifest.publisher, publicKey: f.options.trustStore[0]!.publicKeyBase64}}})).rejects.toMatchObject({code: 'INVALID_MANIFEST'});
    expect(runtime.factory).not.toHaveBeenCalled();
  });
  it.each(['name', 'license', 'provenance', 'capabilities', 'stateSchemaVersion'] as const)('binds the signed %s field', async field => {
    const f = fixture(); const runtime = transport(); const manifest = structuredClone(f.manifest);
    if (field === 'name') manifest.name = 'Forged name';
    if (field === 'license') manifest.license = 'Forged license';
    if (field === 'provenance') manifest.provenance.commit = 'c'.repeat(40);
    if (field === 'capabilities') manifest.capabilities.push('objects:read');
    if (field === 'stateSchemaVersion') manifest.stateSchemaVersion = '1.0.1';
    await expect(createPluginHost({...f.options, runtimeFactory: runtime.factory}).mount({...f.request, manifest, state: {...state, schemaVersion: manifest.stateSchemaVersion}})).rejects.toMatchObject({code: 'INVALID_SIGNATURE'});
    expect(runtime.factory).not.toHaveBeenCalled();
  });
  it('rejects unknown and revoked publisher identities and a different pinned public key', async () => {
    const f = fixture(); const runtime = transport();
    await expect(createPluginHost({...f.options, runtimeFactory: runtime.factory}).mount({...f.request, manifest: {...f.manifest, publisher: {id: 'attacker', keyId: 'test-release'}}})).rejects.toMatchObject({code: 'UNKNOWN_PUBLISHER'});
    await expect(createPluginHost({...f.options, trustStore: [{...f.options.trustStore[0]!, revoked: true}], runtimeFactory: runtime.factory}).mount(f.request)).rejects.toMatchObject({code: 'REVOKED_PUBLISHER'});
    const other = fixture();
    await expect(createPluginHost({...f.options, trustStore: other.options.trustStore, runtimeFactory: runtime.factory}).mount(f.request)).rejects.toMatchObject({code: 'INVALID_SIGNATURE'});
    expect(runtime.factory).not.toHaveBeenCalled();
  });
  it('requires SDK compatibility, explicit release allowlisting and all requested capabilities', async () => {
    const f = fixture(); const runtime = transport(); const host = createPluginHost({...f.options, runtimeFactory: runtime.factory});
    await expect(host.mount({...f.request, manifest: {...f.manifest, sdkVersion: '2.0.0'}})).rejects.toMatchObject({code: 'SDK_INCOMPATIBLE'});
    await expect(host.mount({...f.request, manifest: {...f.manifest, version: '1.0.1'}})).rejects.toMatchObject({code: 'RELEASE_NOT_ALLOWED'});
    await expect(host.mount({...f.request, consent: ['state:read']})).rejects.toMatchObject({code: 'CAPABILITY_DENIED'});
    await expect(createPluginHost({...f.options, policy: {...f.options.policy, capabilities: ['state:read']}, runtimeFactory: runtime.factory}).mount(f.request)).rejects.toMatchObject({code: 'CAPABILITY_DENIED'});
    await expect(host.mount({...f.request, manifest: {...f.manifest, capabilities: ['shell:execute']}})).rejects.toMatchObject({code: 'INVALID_MANIFEST'});
    expect(runtime.factory).not.toHaveBeenCalled();
  });
  it('rejects invalid and incompatible state before creating a runtime', async () => {
    const f = fixture(); const runtime = transport(); const host = createPluginHost({...f.options, runtimeFactory: runtime.factory});
    await expect(host.mount({...f.request, state: {schemaVersion: '2.0.0', value: {}}})).rejects.toMatchObject({code: 'INCOMPATIBLE_STATE'});
    await expect(host.mount({...f.request, state: {schemaVersion: '1.0.0', value: {x: Infinity}}})).rejects.toMatchObject({code: 'INVALID_STATE'});
    await expect(host.mount({...f.request, state: {schemaVersion: '1.0.0', value: 'x'.repeat(40_000)}})).rejects.toMatchObject({code: 'INVALID_STATE'});
    expect(runtime.factory).not.toHaveBeenCalled();
  });
  it('bounds bundle bytes and rejects duplicate requested capabilities', async () => {
    const f = fixture(); const runtime = transport();
    await expect(createPluginHost({...f.options, policy: {...f.options.policy, maxBundleBytes: 5}, runtimeFactory: runtime.factory}).mount(f.request)).rejects.toMatchObject({code: 'BUNDLE_TOO_LARGE'});
    await expect(createPluginHost({...f.options, runtimeFactory: runtime.factory}).mount({...f.request, manifest: {...f.manifest, capabilities: ['state:read', 'state:read']}})).rejects.toMatchObject({code: 'INVALID_MANIFEST'});
    expect(runtime.factory).not.toHaveBeenCalled();
  });
  it('distinguishes an unsupported browser crypto algorithm from an invalid signature', async () => {
    const f = fixture(); const runtime = transport();
    const unsupported = vi.spyOn(crypto.subtle, 'importKey').mockRejectedValueOnce(new DOMException('Not supported', 'NotSupportedError'));
    try {
      await expect(createPluginHost({...f.options, runtimeFactory: runtime.factory}).mount(f.request)).rejects.toMatchObject({code: 'RUNTIME_UNAVAILABLE'});
      expect(runtime.factory).not.toHaveBeenCalled();
    } finally {unsupported.mockRestore();}
  });
  it('copies source bytes, manifest, initial state, consent and policy before async verification', async () => {
    const f = fixture(); const runtime = transport();
    const expected = new Uint8Array(f.bundle); const expectedManifest = structuredClone(f.manifest);
    const mutableState = structuredClone(state); const consent: Capability[] = ['state:read', 'state:write'];
    const host = createPluginHost({...f.options, runtimeFactory: runtime.factory});
    const mounting = host.mount({...f.request, state: mutableState, consent});
    f.bundle.fill(0); f.manifest.name = 'Mutated'; (mutableState.value as {massKg: number}).massKg = 99; consent.length = 0;
    const session = await mounting;
    expect(runtime.factory.mock.calls[0]![0]).toEqual(expected);
    expect(session.manifest).toEqual(expectedManifest);
    expect(session.current.state).toEqual(state);
    session.dispose();
  });
});

describe('M1 runtime protocol and state authority', () => {
  it('executes verified code in a real Worker and reopens the same scientific state', async () => {
    const code = `import {parentPort} from 'node:worker_threads';\nparentPort.on('message', request => parentPort.postMessage({protocol:request.protocol,requestId:request.requestId,instanceId:request.instanceId,ok:true,state:request.state,view:${JSON.stringify(view)}}));\n`;
    const f = fixture(code);
    const factory: PluginRuntimeFactory = bytes => {
      const worker = new Worker(new URL(`data:text/javascript;base64,${Buffer.from(bytes).toString('base64')}`));
      return {
        postMessage: request => worker.postMessage(request),
        subscribe: (onMessage, onError) => {worker.on('message', onMessage); worker.on('error', onError); return () => {worker.off('message', onMessage); worker.off('error', onError);};},
        terminate: () => {void worker.terminate();}
      };
    };
    const host = createPluginHost({...f.options, policy: {...f.options.policy, timeoutMs: 3_000}, runtimeFactory: factory});
    const first = await host.mount(f.request);
    const changed = {schemaVersion: '1.0.0', value: {massKg: 2, timeS: 3}};
    const evaluation = await first.evaluate(changed);
    expect(evaluation.state).toEqual(changed);
    first.dispose();
    const reopened = await host.mount({...f.request, state: JSON.parse(JSON.stringify(evaluation.state))});
    expect(reopened.instanceId).toBe(first.instanceId);
    expect(reopened.current).toEqual(evaluation);
    reopened.dispose();
  });
  it('protects current state from caller mutation, rejected state and missing write grants', async () => {
    const f = fixture(undefined, ['state:read']); const runtime = transport();
    const session = await createPluginHost({...f.options, runtimeFactory: runtime.factory}).mount(f.request);
    const external = session.current; (external.state.value as {massKg: number}).massKg = 500;
    expect(session.current.state).toEqual(state);
    await expect(session.evaluate({schemaVersion: '1.0.0', value: {massKg: 2, timeS: 0}})).rejects.toMatchObject({code: 'CAPABILITY_DENIED'});
    await expect(session.evaluate({schemaVersion: '2.0.0', value: {}})).rejects.toMatchObject({code: 'INCOMPATIBLE_STATE'});
    expect(session.current.state).toEqual(state);
    expect(runtime.postMessage).toHaveBeenCalledOnce();
    session.dispose();
    await expect(session.evaluate(state)).rejects.toMatchObject({code: 'SESSION_DISPOSED'});
  });
  it('preserves the previous evaluation when scientific validation rejects an update', async () => {
    let calls = 0; const f = fixture();
    const runtime = transport((request, reply) => queueMicrotask(() => reply(++calls === 1
      ? {protocol: request.protocol, requestId: request.requestId, instanceId: request.instanceId, ok: true, state: request.state, view}
      : {protocol: request.protocol, requestId: request.requestId, instanceId: request.instanceId, ok: false, error: {code: 'INVALID_STATE', message: 'Massa fuori intervallo.'}})));
    const session = await createPluginHost({...f.options, runtimeFactory: runtime.factory}).mount(f.request);
    await expect(session.evaluate({schemaVersion: '1.0.0', value: {massKg: -1, timeS: 0}})).rejects.toMatchObject({code: 'INVALID_STATE'});
    expect(session.current.state).toEqual(state); session.dispose();
  });
  it.each(['wrong-instance', 'wrong-request', 'state-mutation', 'extra-field', 'non-finite-view', 'oversized'] as const)('fails closed for %s worker responses', async mode => {
    const f = fixture();
    const runtime = transport((request, reply) => {
      const response: Record<string, unknown> = {protocol: request.protocol, requestId: request.requestId, instanceId: request.instanceId, ok: true, state: request.state, view: structuredClone(view)};
      if (mode === 'wrong-instance') response.instanceId = 'other';
      if (mode === 'wrong-request') response.requestId = 'replayed';
      if (mode === 'state-mutation') response.state = {schemaVersion: '1.0.0', value: {massKg: 50}};
      if (mode === 'extra-field') response.command = {type: 'erase-all'};
      if (mode === 'non-finite-view') (response.view as PluginView).metrics[0]!.value = Infinity;
      if (mode === 'oversized') (response.view as PluginView).summary = 'x'.repeat(600_000);
      queueMicrotask(() => reply(response));
    });
    await expect(createPluginHost({...f.options, runtimeFactory: runtime.factory}).mount(f.request)).rejects.toMatchObject({code: mode.startsWith('wrong-') ? 'PROTOCOL_VIOLATION' : 'INVALID_RESPONSE'});
    expect(runtime.terminate).toHaveBeenCalledOnce();
  });
  it('terminates unresponsive workers and rejects pending work on dispose', async () => {
    const f = fixture(); const runtime = transport(() => {});
    await expect(createPluginHost({...f.options, policy: {...f.options.policy, timeoutMs: 20}, runtimeFactory: runtime.factory}).mount(f.request)).rejects.toMatchObject({code: 'RUNTIME_TIMEOUT'});
    expect(runtime.terminate).toHaveBeenCalledOnce();
    let hold = false;
    const responsive = transport((request, reply) => {if (!hold) queueMicrotask(() => reply({protocol: request.protocol, requestId: request.requestId, instanceId: request.instanceId, ok: true, state: request.state, view}));});
    const session = await createPluginHost({...f.options, runtimeFactory: responsive.factory}).mount(f.request);
    hold = true; const pending = session.evaluate(state);
    await expect(session.evaluate(state)).rejects.toMatchObject({code: 'BUSY'});
    session.dispose(); await expect(pending).rejects.toMatchObject({code: 'SESSION_DISPOSED'});
    expect(responsive.terminate).toHaveBeenCalledOnce();
  });
  it('rejects replayed successful replies without changing current state', async () => {
    const f = fixture(); const runtime = transport();
    const session = await createPluginHost({...f.options, runtimeFactory: runtime.factory}).mount(f.request);
    const request = runtime.postMessage.mock.calls[0]![0];
    runtime.emit({protocol: request.protocol, requestId: request.requestId, instanceId: request.instanceId, ok: true, state: request.state, view});
    expect(runtime.terminate).toHaveBeenCalledOnce();
    expect(session.current.state).toEqual(state);
    await expect(session.evaluate(state)).rejects.toMatchObject({code: 'SESSION_DISPOSED'});
  });
  it('checks JSON resource bounds without invoking accessors or accepting prototype keys', () => {
    const accessor = vi.fn(() => 'unsafe');
    const value = Object.defineProperty({}, 'secret', {enumerable: true, get: accessor});
    expect(isBoundedJson(value)).toBe(false); expect(accessor).not.toHaveBeenCalled();
    const envelope = Object.defineProperty({schemaVersion: '1.0.0'}, 'value', {enumerable: true, get: accessor});
    expect(PluginStateSchema.safeParse(envelope).success).toBe(false); expect(accessor).not.toHaveBeenCalled();
    expect(isBoundedJson(JSON.parse('{"__proto__":{"polluted":true}}'))).toBe(false);
    expect(isBoundedJson(new Date())).toBe(false);
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    expect(PluginStateSchema.safeParse({schemaVersion: '1.0.0', value: cyclic}).success).toBe(false);
    expect(isBoundedJson([undefined])).toBe(false);
    expect(isBoundedJson({x: -0, y: 0, z: null})).toBe(true);
  });
});
