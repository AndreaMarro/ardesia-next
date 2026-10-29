import {describe, expect, it, vi} from 'vitest';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {createPluginHost, manifestSigningBytes} from './index';
import type {PluginHostOptions, PluginMountRequest, PluginRuntime} from './index';
import type {PluginManifest, PluginRequest, PluginState, PluginView} from '@ardesia/plugin-sdk';

const state: PluginState = {schemaVersion: '1.0.0', value: {massKg: 4}};
const view: PluginView = {
  title: 'Verified fixture', summary: 'Deterministic lifecycle test', parameters: [], metrics: [],
  plot: {xLabel: 'Time', xUnit: 's', yLabel: 'Position', yUnit: 'm', series: [{id: 'x', label: 'x', points: [{x: 0, y: 0}, {x: 1, y: 1}]}]},
  explanation: ['A scientific state owned by Core.'],
};
function fixture() {
  const keys = generateKeyPairSync('ed25519');
  const bundle = new TextEncoder().encode('/* reviewed fixture bytes */');
  const manifest: PluginManifest = {
    schemaVersion: '1.0.0', id: 'ardesia.fixture', name: 'Fixture', version: '1.0.0', sdkVersion: '1.0.0', kind: 'plugin',
    publisher: {id: 'ardesia', keyId: 'fixture-key'}, license: 'UNLICENSED',
    provenance: {repository: 'https://github.com/AndreaMarro/ardesia-next', commit: 'a'.repeat(40), path: 'plugins/fixture'},
    integrity: {algorithm: 'SHA-256', digest: createHash('sha256').update(bundle).digest('hex')},
    signature: {algorithm: 'Ed25519', value: 'pending'}, capabilities: ['state:read', 'state:write'], stateSchemaVersion: '1.0.0', execution: 'first-party',
  };
  manifest.signature.value = sign(null, manifestSigningBytes(manifest), keys.privateKey).toString('base64');
  const publicKeyBase64 = Buffer.from(keys.publicKey.export({format: 'jwk'}).x!, 'base64url').toString('base64');
  const options: PluginHostOptions = {
    trustStore: [{publisherId: 'ardesia', keyId: 'fixture-key', publicKeyBase64}],
    policy: {allowlist: [{id: manifest.id, version: manifest.version, digest: manifest.integrity.digest, publisherId: 'ardesia', keyId: 'fixture-key'}], capabilities: ['state:read', 'state:write'], timeoutMs: 500},
  };
  const request: PluginMountRequest = {manifest, bundle, instanceId: 'instance-one', state, consent: ['state:read', 'state:write']};
  const runtimes: {terminate: ReturnType<typeof vi.fn>; hold: boolean; posts: PluginRequest[]}[] = [];
  const runtimeFactory = vi.fn((_bytes: Uint8Array): PluginRuntime => {
    let emit = (_response: unknown) => {};
    const control = {terminate: vi.fn(), hold: false, posts: [] as PluginRequest[]};
    runtimes.push(control);
    return {
      subscribe(onMessage) {emit = onMessage; return () => {emit = () => {};};},
      terminate: control.terminate,
      postMessage(request) {
        control.posts.push(request);
        if (!control.hold) queueMicrotask(() => emit({protocol: request.protocol, requestId: request.requestId, instanceId: request.instanceId, ok: true, state: request.state, view}));
      },
    };
  });
  return {manifest, bundle, options, request, runtimes, runtimeFactory};
}

describe('M2 verification before installation', () => {
  it('verifies actual signature and digest without running code or accepting implicit consent', async () => {
    const f = fixture(), host = createPluginHost({...f.options, runtimeFactory: f.runtimeFactory});
    const verified = await host.verify(f.request);
    expect(verified).toEqual(f.manifest);
    verified.name = 'Caller mutation';
    expect(await host.verify(f.request)).toEqual(f.manifest);
    expect(f.runtimeFactory).not.toHaveBeenCalled();
    await expect(host.mount({...f.request, consent: []})).rejects.toMatchObject({code: 'CAPABILITY_DENIED'});
    expect(f.runtimeFactory).not.toHaveBeenCalled();
  });
  it.each(['bundle', 'signature', 'sdk', 'release', 'capability', 'revoked'] as const)('rejects %s before an installation can be authorized', async mode => {
    const f = fixture(); let manifest: unknown = structuredClone(f.manifest), bundle = new Uint8Array(f.bundle), options = f.options;
    if (mode === 'bundle') bundle[0] = bundle[0]! ^ 1;
    if (mode === 'signature') manifest = {...f.manifest, signature: {algorithm: 'Ed25519', value: Buffer.alloc(64).toString('base64')}};
    if (mode === 'sdk') manifest = {...f.manifest, sdkVersion: '2.0.0'};
    if (mode === 'release') manifest = {...f.manifest, version: '1.0.1'};
    if (mode === 'capability') options = {...options, policy: {...options.policy, capabilities: ['state:read']}};
    if (mode === 'revoked') options = {...options, trustStore: [{...options.trustStore[0]!, revoked: true}]};
    const codes = {bundle: 'INTEGRITY_MISMATCH', signature: 'INVALID_SIGNATURE', sdk: 'SDK_INCOMPATIBLE', release: 'RELEASE_NOT_ALLOWED', capability: 'CAPABILITY_DENIED', revoked: 'REVOKED_PUBLISHER'};
    const host = createPluginHost({...options, runtimeFactory: f.runtimeFactory});
    await expect(host.verify({manifest, bundle})).rejects.toMatchObject({code: codes[mode]});
    expect(f.runtimeFactory).not.toHaveBeenCalled();
    expect(f.request.state).toEqual(state);
  });
  it('always checks mount bytes again after a successful discovery verification', async () => {
    const f = fixture(), host = createPluginHost({...f.options, runtimeFactory: f.runtimeFactory});
    await host.verify(f.request);
    f.bundle[0] = f.bundle[0]! ^ 1;
    await expect(host.mount(f.request)).rejects.toMatchObject({code: 'INTEGRITY_MISMATCH'});
    expect(f.runtimeFactory).not.toHaveBeenCalled();
  });
});

describe('M2 lifecycle projection and revocation', () => {
  it('stops every instance, keeps scientific state, and reopens only after explicit resume', async () => {
    const f = fixture(), host = createPluginHost({...f.options, runtimeFactory: f.runtimeFactory});
    const first = await host.mount(f.request);
    const second = await host.mount({...f.request, instanceId: 'instance-two'});
    host.suspendPlugin(f.manifest.id);
    expect(f.runtimes.every(runtime => runtime.terminate.mock.calls.length === 1)).toBe(true);
    expect(first.current.state).toEqual(state);
    expect(second.current.state).toEqual(state);
    await expect(first.evaluate(state)).rejects.toMatchObject({code: 'SESSION_DISPOSED'});
    await expect(host.mount(f.request)).rejects.toMatchObject({code: 'PLUGIN_DISABLED'});
    expect(await host.verify(f.request)).toEqual(f.manifest); // Verification itself never runs a disabled module.
    host.resumePlugin(f.manifest.id);
    const reopened = await host.mount(f.request);
    expect(reopened.instanceId).toBe(first.instanceId);
    expect(reopened.current.state).toEqual(state);
    reopened.dispose();
  });
  it('rejects pending evaluation on disable and leaves the last valid state intact', async () => {
    const f = fixture(), host = createPluginHost({...f.options, runtimeFactory: f.runtimeFactory});
    const session = await host.mount(f.request);
    f.runtimes[0]!.hold = true;
    const pending = session.evaluate({schemaVersion: '1.0.0', value: {massKg: 9}});
    const rejected = expect(pending).rejects.toMatchObject({code: 'PLUGIN_DISABLED'});
    host.suspendPlugin(f.manifest.id);
    await rejected;
    expect(session.current.state).toEqual(state);
    expect(f.runtimes[0]!.terminate).toHaveBeenCalledOnce();
  });
  it('invalidates a mount in flight even if the module is immediately reactivated', async () => {
    const f = fixture(), host = createPluginHost({...f.options, runtimeFactory: f.runtimeFactory});
    const original = crypto.subtle.digest.bind(crypto.subtle);
    let finish = () => {};
    const waiting = new Promise<void>(resolve => {finish = resolve;});
    const digest = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(async (algorithm, data) => {await waiting; return original(algorithm, data);});
    try {
      const pending = host.mount(f.request);
      const rejected = expect(pending).rejects.toMatchObject({code: 'POLICY_CHANGED'});
      host.suspendPlugin(f.manifest.id);
      host.resumePlugin(f.manifest.id);
      finish(); await rejected;
      expect(f.runtimeFactory).not.toHaveBeenCalled();
      const reopened = await host.mount(f.request); reopened.dispose();
    } finally {finish(); digest.mockRestore();}
  });
  it('revokes publisher sessions and never restores revoked trust through a resume', async () => {
    const f = fixture(), host = createPluginHost({...f.options, runtimeFactory: f.runtimeFactory});
    const session = await host.mount(f.request);
    host.revokePublisher('ardesia'); host.resumePlugin(f.manifest.id);
    expect(f.runtimes[0]!.terminate).toHaveBeenCalledOnce();
    await expect(host.verify(f.request)).rejects.toMatchObject({code: 'REVOKED_PUBLISHER'});
    await expect(host.mount(f.request)).rejects.toMatchObject({code: 'REVOKED_PUBLISHER'});
    expect(session.current.state).toEqual(state);
  });
  it.each(['revocation', 'disposal'] as const)('rejects verification in flight after %s without executing a Worker', async mode => {
    const f = fixture(), host = createPluginHost({...f.options, runtimeFactory: f.runtimeFactory});
    const original = crypto.subtle.verify.bind(crypto.subtle);
    let finish = () => {}, entered = () => {};
    const waiting = new Promise<void>(resolve => {finish = resolve;});
    const started = new Promise<void>(resolve => {entered = resolve;});
    const verify = vi.spyOn(crypto.subtle, 'verify').mockImplementationOnce(async (algorithm, key, signature, data) => {entered(); await waiting; return original(algorithm, key, signature, data);});
    try {
      const pending = host.verify(f.request);
      const rejected = expect(pending).rejects.toMatchObject({code: mode === 'revocation' ? 'REVOKED_PUBLISHER' : 'HOST_DISPOSED'});
      await started;
      if (mode === 'revocation') host.revokePublisher('ardesia'); else host.dispose();
      finish(); await rejected;
      expect(f.runtimeFactory).not.toHaveBeenCalled();
    } finally {finish(); verify.mockRestore();}
  });
  it('disposes every session and prevents reopening a disposed Host', async () => {
    const f = fixture(), host = createPluginHost({...f.options, runtimeFactory: f.runtimeFactory});
    await host.mount(f.request); await host.mount({...f.request, instanceId: 'second'});
    host.dispose(); host.dispose();
    expect(f.runtimes.every(runtime => runtime.terminate.mock.calls.length === 1)).toBe(true);
    await expect(host.verify(f.request)).rejects.toMatchObject({code: 'HOST_DISPOSED'});
    await expect(host.mount(f.request)).rejects.toMatchObject({code: 'HOST_DISPOSED'});
    expect(() => host.resumePlugin(f.manifest.id)).toThrowError(/Host/);
  });
});
