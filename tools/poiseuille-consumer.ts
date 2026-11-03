import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createPluginHost, type PluginRuntimeFactory, type TrustedPublisherKey, type FirstPartyRelease} from '@ardesia/plugin-host';
import {createCore, MemoryStorage, type PluginPolicy} from '@ardesia/core';
import {canonicalJson, toObjectInput, type Actor, type LabObject, type PluginRelease, type NewEducationalObject} from '@ardesia/contracts';
import type {PluginManifest, PluginState} from '@ardesia/plugin-sdk';
import {poiseuillePressureState} from '../plugins/poiseuille/src/index';

/** Integration fixture only. Uses real public Host/Core APIs, never the scientific solver. */
export async function runPoiseuilleConsumer({manifest, trust, bundle}: {manifest: PluginManifest; trust: {trustStore: TrustedPublisherKey[]; allowlist: FirstPartyRelease[]}; bundle: Uint8Array}) {
  let starts = 0, live = 0;
  const terminations: Promise<number>[] = [];
  const factory: PluginRuntimeFactory = bytes => {
    starts++; live++;
    const script = `import {parentPort} from 'node:worker_threads';
      globalThis.postMessage = value => parentPort.postMessage(value);
      await import(${JSON.stringify('data:text/javascript;base64,' + Buffer.from(bytes).toString('base64'))});
      parentPort.on('message', data => globalThis.onmessage({data}));`;
    const worker = new Worker(new URL('data:text/javascript;base64,' + Buffer.from(script).toString('base64')));
    let disposed = false;
    return {postMessage: value => worker.postMessage(value), subscribe: listener => {worker.on('message', listener); return () => worker.off('message', listener);},
      terminate: () => {if (!disposed) {disposed = true; terminations.push(worker.terminate().then(code => {live--; return code;}));}}};
  };
  const hostOptions = {trustStore: trust.trustStore, policy: {allowlist: trust.allowlist, capabilities: ['state:read', 'state:write'] as const, timeoutMs: 5000}, runtimeFactory: factory};
  const host = createPluginHost(hostOptions);
  const release: PluginRelease = {pluginId: manifest.id, version: manifest.version, sdkVersion: manifest.sdkVersion,
    stateSchemaVersion: manifest.stateSchemaVersion, bundleDigest: manifest.integrity.digest,
    publisher: manifest.publisher, provenance: manifest.provenance, license: manifest.license, capabilities: manifest.capabilities};
  const mount = (state: PluginState) => host.mount({manifest, bundle, instanceId: 'm4-poiseuille-instance', state, consent: ['state:read', 'state:write']});
  const policy: PluginPolicy = async request => {
    assert.equal(canonicalJson(request.release), canonicalJson(release));
    await host.verify({manifest, bundle});
    for (const data of request.states) {const session = await mount(data.state); session.dispose();}
  };
  const storage = new MemoryStorage();
  const teacher: Actor = {actorId: 'm4-teacher', role: 'teacher'};
  const core = await createCore({storage, pluginPolicy: policy});
  let command = 0;
  const nextId = () => `m4-command-${++command}`;
  await core.executePlugin(teacher, {kind: 'install-plugin', commandId: nextId(), pluginId: manifest.id, expectedRevision: 0, release});
  await assert.rejects(core.executePlugin(teacher, {kind: 'activate-plugin', commandId: nextId(), pluginId: manifest.id, expectedRevision: 1}), {code: 'PLUGIN_CONSENT_REQUIRED'});
  await core.executePlugin(teacher, {kind: 'consent-plugin', commandId: nextId(), pluginId: manifest.id, expectedRevision: 1, releaseDigest: release.bundleDigest, capabilities: manifest.capabilities});
  await core.executePlugin(teacher, {kind: 'activate-plugin', commandId: nextId(), pluginId: manifest.id, expectedRevision: 2});
  await core.execute(teacher, {kind: 'create-document', commandId: nextId(), documentId: 'm4-lesson', expectedRevision: 0, title: 'Condizioni al contorno · bozza'});
  const firstSession = await mount(poiseuillePressureState);
  try {
    assert.equal(firstSession.current.view.title, 'Flusso di Poiseuille · bozza');
    const object: NewEducationalObject = {id: 'm4-lab', type: 'lab', title: 'Poiseuille · pressione fissata', x: 10, y: 20, width: 600, height: 500,
      data: {pluginId: manifest.id, pluginVersion: manifest.version, instanceId: firstSession.instanceId,
        bundleDigest: release.bundleDigest, publisher: manifest.publisher, stateSchemaVersion: manifest.stateSchemaVersion, state: firstSession.current.state as never}};
    await core.execute(teacher, {kind: 'add-object', commandId: nextId(), documentId: 'm4-lesson', expectedRevision: 1, object});
    const evaluated = await firstSession.evaluate({schemaVersion: '1.0.0', value: {...poiseuillePressureState.value as object, radiusM: 0.002}});
    const original = core.getDocument(teacher, 'm4-lesson').objects[0] as LabObject;
    const edited = toObjectInput(original) as Extract<NewEducationalObject, {type: 'lab'}>;
    edited.data.state = evaluated.state as never;
    await core.execute(teacher, {kind: 'replace-object', commandId: nextId(), documentId: 'm4-lesson', expectedRevision: 2, object: edited});
    const before = core.snapshot();
    const invalid = structuredClone(edited); invalid.data.state.value = {...invalid.data.state.value as object, radiusM: 0};
    await assert.rejects(core.execute(teacher, {kind: 'replace-object', commandId: nextId(), documentId: 'm4-lesson', expectedRevision: 3, object: invalid}));
    assert.deepEqual(core.snapshot(), before); assert.deepEqual(await storage.read(), before);
    const reopened = await createCore({storage, pluginPolicy: policy});
    const saved = reopened.getDocument(teacher, 'm4-lesson').objects[0] as LabObject;
    assert.equal(saved.status, 'draft'); assert.equal(saved.revision, 2);
    assert.deepEqual(saved.data.state, evaluated.state);
    assert.deepEqual((reopened.getObjectRevision(teacher, 'm4-lesson', saved.id, 1) as LabObject).data.state, poiseuillePressureState);
    const reopenedSession = await mount(saved.data.state);
    try {assert.deepEqual(reopenedSession.current, evaluated);} finally {reopenedSession.dispose();}
    const other: Actor = {actorId: 'other-teacher', role: 'teacher'};
    assert.throws(() => reopened.getDocument(other, 'm4-lesson'));
    await reopened.executePlugin(teacher, {kind: 'withdraw-plugin-consent', commandId: nextId(), pluginId: manifest.id, expectedRevision: 3});
    host.suspendPlugin(manifest.id);
    await assert.rejects(firstSession.evaluate(poiseuillePressureState));
    await assert.rejects(reopened.execute(teacher, {kind: 'replace-object', commandId: nextId(), documentId: 'm4-lesson', expectedRevision: 3, object: edited}), {code: 'PLUGIN_NOT_ACTIVE'});
    assert.deepEqual(reopened.getDocument(teacher, 'm4-lesson').objects[0], saved);
  } finally {firstSession.dispose();}
  const beforeStarts = starts;
  // A fresh Host has no suspension to mask the integrity/signature counterproofs.
  const verifier = createPluginHost(hostOptions);
  const badBytes = new Uint8Array(bundle); badBytes[0] = badBytes[0]! ^ 1;
  await assert.rejects(verifier.mount({manifest, bundle: badBytes, instanceId: 'tampered', state: poiseuillePressureState, consent: manifest.capabilities}), {code: 'INTEGRITY_MISMATCH'});
  await assert.rejects(verifier.mount({manifest: {...manifest, signature: {algorithm: 'Ed25519', value: Buffer.alloc(64).toString('base64')}}, bundle,
    instanceId: 'forged', state: poiseuillePressureState, consent: manifest.capabilities}), {code: 'INVALID_SIGNATURE'});
  assert.equal(starts, beforeStarts);
  await Promise.all(terminations);
  assert.equal(live, 0);
  return {consumer: 'public-Host-Core-integration-fixture', storage: 'existing-Core-MemoryStorage-test-adapter',
    checks: ['signature-before-execution', 'explicit-consent', 'save-edit-reopen', 'exact-old-revision', 'invalid-state-no-write', 'owner-isolation', 'withdraw-consent', 'tampered-bundle-no-worker', 'forged-signature-no-worker'],
    workersStarted: starts, liveWorkers: live, browser: 'NOT_RUN', postgres: 'NOT_RUN', humanReview: 'PENDING'};
}
