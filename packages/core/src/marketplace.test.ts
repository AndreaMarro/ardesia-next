import {describe, expect, it} from 'vitest';
import {
  CoreSnapshotSchema, toObjectInput,
  type Actor, type CoreSnapshot, type LabObject, type NewEducationalObject, type PluginCommand, type PluginRelease,
} from '@ardesia/contracts';
import {createCore, MemoryStorage, type CoreService, type PluginPolicyRequest, type StorageAdapter} from './index';

const actor: Actor = {actorId: 'teacher-andrea', role: 'teacher'};
const other: Actor = {actorId: 'teacher-other', role: 'teacher'};
const initialRelease: PluginRelease = {
  pluginId: 'ardesia.ideal-spring', version: '1.0.0', bundleDigest: 'a'.repeat(64),
  publisher: {id: 'ardesia', keyId: 'release-1'}, license: 'UNLICENSED',
  provenance: {repository: 'https://github.com/AndreaMarro/ardesia-next', commit: '1'.repeat(40), path: 'plugins/ideal-spring/src/worker.ts'},
  sdkVersion: '1.0.0', stateSchemaVersion: '1.0.0', capabilities: ['state:read', 'state:write'],
};
const updatedRelease: PluginRelease = {...structuredClone(initialRelease), version: '1.0.1', bundleDigest: 'b'.repeat(64), publisher: {id: 'ardesia', keyId: 'release-2'}};

class ObservedStorage extends MemoryStorage {
  writes = 0;
  fail = false;
  override async write(snapshot: CoreSnapshot) {
    if (this.fail) throw new Error('Quota exceeded');
    await super.write(snapshot);
    this.writes++;
  }
}

function options(storage: StorageAdapter, prefix = 'event') {
  let counter = 0;
  return {storage, clock: () => '2026-10-29T10:00:00.000Z', id: () => `${prefix}-${++counter}`};
}

function policyFixture() {
  const calls: PluginPolicyRequest[] = [];
  const permitted = new Set<string>();
  const revoked = new Set<string>();
  let maximumMass = 100;
  return {
    calls, permitted, revoked,
    setMaximumMass: (value: number) => {maximumMass = value;},
    policy: async (request: PluginPolicyRequest) => {
      calls.push(structuredClone(request));
      if (revoked.has(request.release.publisher.id)) throw new Error('Revoked publisher');
      const expected = [initialRelease, updatedRelease].find(release => release.version === request.release.version);
      if (!expected || JSON.stringify(expected) !== JSON.stringify(request.release)) throw new Error('Unverified release');
      if ((request.operation === 'update' || request.operation === 'rollback')
        && !permitted.has(`${request.previousRelease?.version}:${request.release.version}:${request.operation}`)) throw new Error('Transition not authorized');
      for (const state of request.states) {
        if (request.consent.length !== 2) throw new Error('Cannot evaluate without consent');
        const values = state.state.value as {massKg?: unknown};
        if (typeof values.massKg !== 'number' || values.massKg <= 0 || values.massKg > maximumMass) throw new Error('Invalid scientific state');
      }
    },
  };
}

async function fixture() {
  const storage = new ObservedStorage();
  const policy = policyFixture();
  const core = await createCore({...options(storage), pluginPolicy: policy.policy});
  return {core, storage, policy};
}

const install = (release = initialRelease, commandId = 'install-1'): PluginCommand => ({
  kind: 'install-plugin', commandId, pluginId: release.pluginId, expectedRevision: 0, release,
});

async function authorize(core: CoreService, owner = actor, prefix = 'grant') {
  const installation = core.getInstallation(owner, initialRelease.pluginId)!;
  await core.executePlugin(owner, {kind: 'consent-plugin', commandId: `${prefix}-${owner.actorId}-${installation.revision}`, pluginId: installation.pluginId,
    expectedRevision: installation.revision, releaseDigest: installation.release.bundleDigest, capabilities: [...installation.release.capabilities]});
}

async function activate(core: CoreService, owner = actor, prefix = 'activate') {
  const installation = core.getInstallation(owner, initialRelease.pluginId)!;
  await core.executePlugin(owner, {kind: 'activate-plugin', commandId: `${prefix}-${owner.actorId}-${installation.revision}`, pluginId: installation.pluginId, expectedRevision: installation.revision});
}

async function ready(core: CoreService, owner = actor) {
  await core.executePlugin(owner, install(initialRelease, `install-${owner.actorId}`));
  await authorize(core, owner);
  await activate(core, owner);
}

function laboratory(id = 'lab-1', massKg = 4): Extract<NewEducationalObject, {type: 'lab'}> {
  return {id, type: 'lab', title: 'Molla ideale', x: 20, y: 20, width: 600, height: 500,
    data: {pluginId: initialRelease.pluginId, pluginVersion: initialRelease.version, instanceId: `instance-${id}`,
      stateSchemaVersion: initialRelease.stateSchemaVersion, bundleDigest: initialRelease.bundleDigest, publisher: initialRelease.publisher,
      state: {schemaVersion: '1.0.0', value: {massKg, stiffnessNPerM: 20, initialDisplacementM: 0.2, initialVelocityMPerS: 0, timeS: 0}}}};
}

async function addLab(core: CoreService, documentId = 'lesson-1', massKg = 4, owner = actor) {
  await core.execute(owner, {kind: 'create-document', commandId: `create-${documentId}`, documentId, expectedRevision: 0, title: 'Oscillazioni'});
  await core.execute(owner, {kind: 'add-object', commandId: `add-${documentId}`, documentId, expectedRevision: 1, object: laboratory(`lab-${documentId}`, massKg)});
  return core.getDocument(owner, documentId).objects[0] as LabObject;
}

function transition(core: CoreService, release = updatedRelease, direction: 'update' | 'rollback' = 'update'): PluginCommand {
  return {kind: 'change-plugin-release', commandId: `${direction}-${release.version}`, pluginId: release.pluginId,
    expectedRevision: core.getInstallation(actor, release.pluginId)!.revision, release, direction};
}

describe('Core marketplace lifecycle and consent authority', () => {
  it('installs inactive without granting or evaluating, explicitly authorizes, activates, saves and reopens', async () => {
    const {core, storage, policy} = await fixture();
    expect(core.getInstallation(actor, initialRelease.pluginId)).toBeNull();
    await core.executePlugin(actor, install());
    expect(core.getInstallation(actor, initialRelease.pluginId)).toMatchObject({status: 'installed', consent: null, revision: 1});
    expect(policy.calls).toEqual([{operation: 'install', actor, release: initialRelease, states: [], consent: []}]);
    const unconsented = core.snapshot();
    await expect(activate(core)).rejects.toMatchObject({code: 'PLUGIN_CONSENT_REQUIRED'});
    expect(core.snapshot()).toEqual(unconsented);
    await authorize(core);
    expect(core.getInstallation(actor, initialRelease.pluginId)).toMatchObject({status: 'installed', revision: 2, consent: {release: initialRelease, capabilities: initialRelease.capabilities}});
    await activate(core);
    const lab = await addLab(core);
    const reopened = await createCore({...options(storage, 'reopened'), pluginPolicy: policy.policy});
    expect(reopened.snapshot()).toEqual(core.snapshot());
    expect(reopened.getInstallation(actor, initialRelease.pluginId)).toMatchObject({status: 'active', revision: 3});
    expect(reopened.getDocument(actor, 'lesson-1').objects[0]).toEqual(lab);
    expect(core.events(actor, 'lesson-1').map(event => event.type)).toEqual(['create-document', 'add-object']);
    expect(CoreSnapshotSchema.safeParse(core.snapshot()).success).toBe(true);
  });

  it.each([[], ['state:read'], ['state:read', 'objects:read']].map(capabilities => ({capabilities})))('rejects denied or unrelated capabilities without losing earlier persistence: %j', async ({capabilities}) => {
    const {core, storage} = await fixture();
    await core.executePlugin(actor, install());
    const before = core.snapshot();
    await expect(core.executePlugin(actor, {kind: 'consent-plugin', commandId: 'denied', pluginId: initialRelease.pluginId,
      expectedRevision: 1, releaseDigest: initialRelease.bundleDigest, capabilities})).rejects.toMatchObject({code: 'PLUGIN_CONSENT_REQUIRED'});
    expect(core.snapshot()).toEqual(before);
    expect(await storage.read()).toEqual(before);
  });

  it('rejects an altered release or stale digest before an installation or consent is committed', async () => {
    const {core, storage} = await fixture();
    await expect(core.executePlugin(actor, install({...initialRelease, bundleDigest: 'c'.repeat(64)}))).rejects.toMatchObject({code: 'PLUGIN_POLICY_REJECTED'});
    expect(core.listInstallations(actor)).toEqual([]);
    expect(storage.writes).toBe(0);
    await core.executePlugin(actor, install());
    const before = core.snapshot();
    await expect(core.executePlugin(actor, {kind: 'consent-plugin', commandId: 'stale-grant', pluginId: initialRelease.pluginId,
      expectedRevision: 1, releaseDigest: 'c'.repeat(64), capabilities: initialRelease.capabilities})).rejects.toMatchObject({code: 'INVALID_REFERENCE'});
    expect(core.snapshot()).toEqual(before);
  });

  it('disables and reactivates without changing laboratories, then revokes and blocks new lab writes', async () => {
    const {core, storage} = await fixture();
    await ready(core);
    const lab = await addLab(core);
    await core.executePlugin(actor, {kind: 'disable-plugin', commandId: 'disable', pluginId: initialRelease.pluginId, expectedRevision: 3});
    expect(core.getDocument(actor, 'lesson-1').objects[0]).toEqual(lab);
    const disabled = core.snapshot();
    await expect(core.execute(actor, {kind: 'replace-object', commandId: 'edit-disabled', documentId: 'lesson-1', expectedRevision: 2, object: toObjectInput(lab)})).rejects.toMatchObject({code: 'PLUGIN_NOT_ACTIVE'});
    expect(await storage.read()).toEqual(disabled);
    await activate(core);
    expect(core.getDocument(actor, 'lesson-1').objects[0]).toEqual(lab);
    await core.executePlugin(actor, {kind: 'revoke-plugin', commandId: 'revoke', pluginId: initialRelease.pluginId, expectedRevision: 5});
    expect(core.getInstallation(actor, initialRelease.pluginId)).toMatchObject({status: 'revoked', consent: null});
    const revoked = core.snapshot();
    await expect(activate(core)).rejects.toMatchObject({code: 'PLUGIN_REVOKED'});
    await expect(core.execute(actor, {kind: 'replace-object', commandId: 'edit-revoked', documentId: 'lesson-1', expectedRevision: 2, object: toObjectInput(lab)})).rejects.toMatchObject({code: 'PLUGIN_REVOKED'});
    expect(core.snapshot()).toEqual(revoked);
    expect(core.getDocument(actor, 'lesson-1').objects[0]).toEqual(lab);
  });

  it('rechecks publisher trust at activation and state writes; a failure preserves the entire snapshot', async () => {
    const {core, storage, policy} = await fixture();
    await ready(core);
    const lab = await addLab(core);
    policy.revoked.add('ardesia');
    const before = core.snapshot();
    await expect(activate(core)).rejects.toMatchObject({code: 'PLUGIN_POLICY_REJECTED'});
    await expect(core.execute(actor, {kind: 'replace-object', commandId: 'revoked-publisher-write', documentId: 'lesson-1', expectedRevision: 2, object: toObjectInput(lab)})).rejects.toMatchObject({code: 'PLUGIN_POLICY_REJECTED'});
    expect(core.snapshot()).toEqual(before);
    expect(await storage.read()).toEqual(before);
    // Removing local authority remains possible even when the publisher no longer verifies.
    await core.executePlugin(actor, {kind: 'revoke-plugin', commandId: 'local-revoke', pluginId: initialRelease.pluginId, expectedRevision: 3});
    expect(core.getDocument(actor, 'lesson-1').objects[0]).toEqual(lab);
  });

  it('isolates owners and rejects a student role even with the same actor ID', async () => {
    const {core} = await fixture();
    await ready(core);
    expect(core.listInstallations(other)).toEqual([]);
    expect(core.getInstallation(other, initialRelease.pluginId)).toBeNull();
    await expect(core.executePlugin(other, {kind: 'disable-plugin', commandId: 'foreign-disable', pluginId: initialRelease.pluginId, expectedRevision: 3})).rejects.toMatchObject({code: 'NOT_FOUND'});
    await expect(core.executePlugin({...actor, role: 'student'}, {kind: 'disable-plugin', commandId: 'student-disable', pluginId: initialRelease.pluginId, expectedRevision: 3})).rejects.toMatchObject({code: 'FORBIDDEN'});
    await ready(core, other);
    expect(core.snapshot().installations).toHaveLength(2);
    expect(core.listInstallations(actor)).toHaveLength(1);
  });

  it('requires a policy for marketplace commands and for a reopened workspace with installed modules', async () => {
    const storage = new ObservedStorage();
    const core = await createCore(options(storage));
    await expect(core.executePlugin(actor, install())).rejects.toMatchObject({code: 'PLUGIN_POLICY_REQUIRED'});
    expect(storage.writes).toBe(0);
    const setup = await fixture();
    await ready(setup.core);
    const lab = await addLab(setup.core);
    const reopened = await createCore(options(setup.storage, 'no-policy'));
    await expect(reopened.execute(actor, {kind: 'replace-object', commandId: 'missing-policy', documentId: 'lesson-1', expectedRevision: 2, object: toObjectInput(lab)})).rejects.toMatchObject({code: 'PLUGIN_POLICY_REQUIRED'});
    expect(reopened.snapshot()).toEqual(setup.core.snapshot());
  });
});

describe('Core authorized release transitions', () => {
  it('updates several existing laboratories atomically and rolls back code while retaining latest scientific state and identities', async () => {
    const {core, storage, policy} = await fixture();
    await ready(core);
    const first = await addLab(core, 'lesson-1', 4);
    const second = await addLab(core, 'lesson-2', 2);
    policy.permitted.add('1.0.0:1.0.1:update');
    policy.permitted.add('1.0.1:1.0.0:rollback');
    const previousWrites = storage.writes;
    const receipt = await core.executePlugin(actor, transition(core));
    expect(storage.writes).toBe(previousWrites + 1);
    expect(receipt.relatedEventIds).toHaveLength(2);
    expect(core.getInstallation(actor, initialRelease.pluginId)).toMatchObject({status: 'disabled', consent: null, release: updatedRelease, history: [{release: initialRelease}]});
    for (const [documentId, original] of [['lesson-1', first], ['lesson-2', second]] as const) {
      const updated = core.getDocument(actor, documentId).objects[0] as LabObject;
      expect(updated.id).toBe(original.id);
      expect(updated.data.instanceId).toBe(original.data.instanceId);
      expect(updated.data.state).toEqual(original.data.state);
      expect(updated.data.pluginVersion).toBe('1.0.1');
      expect(updated.revision).toBe(2);
      expect(core.getObjectRevision(actor, documentId, updated.id, 1)).toEqual(original);
      expect(core.events(actor, documentId).map(event => event.documentRevision)).toEqual([1, 2, 3]);
    }
    const beforeConsent = core.snapshot();
    await expect(activate(core)).rejects.toMatchObject({code: 'PLUGIN_CONSENT_REQUIRED'});
    expect(core.snapshot()).toEqual(beforeConsent);
    await authorize(core);
    await activate(core);
    const edited = toObjectInput(core.getDocument(actor, 'lesson-1').objects[0]!) as Extract<NewEducationalObject, {type: 'lab'}>;
    (edited.data.state.value as Record<string, number>).massKg = 9;
    await core.execute(actor, {kind: 'replace-object', commandId: 'edit-on-new-release', documentId: 'lesson-1', expectedRevision: 3, object: edited});
    await core.executePlugin(actor, transition(core, initialRelease, 'rollback'));
    const rolledBack = core.getDocument(actor, 'lesson-1').objects[0] as LabObject;
    expect(rolledBack).toMatchObject({id: first.id, revision: 4, data: {instanceId: first.data.instanceId, pluginVersion: '1.0.0', state: {value: {massKg: 9}}}});
    expect(core.getObjectRevision(actor, 'lesson-1', first.id, 2)).toMatchObject({data: {pluginVersion: '1.0.1', state: {value: {massKg: 4}}}});
    expect(core.getObjectRevision(actor, 'lesson-1', first.id, 3)).toMatchObject({data: {state: {value: {massKg: 9}}}});
    const reopened = await createCore({...options(storage, 'after-rollback'), pluginPolicy: policy.policy});
    expect(reopened.snapshot()).toEqual(core.snapshot());
    expect(CoreSnapshotSchema.safeParse(core.snapshot()).success).toBe(true);
  });

  it('rejects unauthorized update, incompatible state schema, added capability and wrong direction without changing anything', async () => {
    const {core, storage} = await fixture();
    await ready(core);
    await addLab(core);
    const before = core.snapshot();
    const cases = [
      [transition(core), 'PLUGIN_POLICY_REJECTED'],
      [transition(core, {...updatedRelease, stateSchemaVersion: '2.0.0'}), 'INVALID_PLUGIN_TRANSITION'],
      [transition(core, {...updatedRelease, capabilities: [...updatedRelease.capabilities, 'objects:read']}), 'PLUGIN_CONSENT_REQUIRED'],
      [transition(core, updatedRelease, 'rollback'), 'INVALID_PLUGIN_TRANSITION'],
    ] as const;
    for (const [command, code] of cases) {
      await expect(core.executePlugin(actor, command)).rejects.toMatchObject({code});
      expect(core.snapshot()).toEqual(before);
      expect(await storage.read()).toEqual(before);
    }
  });

  it('checks every saved scientific state and preserves all documents when one state is rejected by the target', async () => {
    const {core, storage, policy} = await fixture();
    await ready(core);
    await addLab(core, 'lesson-1', 1);
    await addLab(core, 'lesson-2', 9);
    policy.permitted.add('1.0.0:1.0.1:update');
    policy.setMaximumMass(5);
    const before = core.snapshot();
    await expect(core.executePlugin(actor, transition(core))).rejects.toMatchObject({code: 'PLUGIN_POLICY_REJECTED'});
    const attempted = policy.calls.at(-1)!;
    expect(attempted.operation).toBe('update');
    expect(attempted.states).toHaveLength(2);
    expect(attempted.states.every(state => state.pluginVersion === '1.0.1')).toBe(true);
    expect(core.snapshot()).toEqual(before);
    expect(await storage.read()).toEqual(before);
  });

  it('preserves the exact prior installation, consent, events and labs when transition persistence fails', async () => {
    const {core, storage, policy} = await fixture();
    await ready(core);
    await addLab(core);
    policy.permitted.add('1.0.0:1.0.1:update');
    const before = core.snapshot();
    storage.fail = true;
    await expect(core.executePlugin(actor, transition(core))).rejects.toMatchObject({code: 'STORAGE_FAILURE'});
    expect(core.snapshot()).toEqual(before);
    expect(await storage.read()).toEqual(before);
    storage.fail = false;
    await core.executePlugin(actor, transition(core));
    expect(core.getInstallation(actor, initialRelease.pluginId)!.release.version).toBe('1.0.1');
  });
});

describe('One Core queue, receipt namespace and atomic persistence', () => {
  it('serializes document and plugin commands into the same snapshot and rejects stale concurrent module writers', async () => {
    const {core} = await fixture();
    await Promise.all([
      core.execute(actor, {kind: 'create-document', commandId: 'create-concurrent', documentId: 'lesson-1', expectedRevision: 0, title: 'Lezione'}),
      core.executePlugin(actor, install()),
    ]);
    expect(core.snapshot()).toMatchObject({documents: [{id: 'lesson-1'}], installations: [{revision: 1}]});
    expect(core.snapshot().events.map(event => event.sequence)).toEqual([1, 2]);
    const consent: PluginCommand = {kind: 'consent-plugin', commandId: 'grant-a', pluginId: initialRelease.pluginId, expectedRevision: 1,
      releaseDigest: initialRelease.bundleDigest, capabilities: initialRelease.capabilities};
    const outcomes = await Promise.allSettled([core.executePlugin(actor, consent), core.executePlugin(actor, {...consent, commandId: 'grant-b'})]);
    expect(outcomes.map(outcome => outcome.status)).toEqual(['fulfilled', 'rejected']);
    expect(core.getInstallation(actor, initialRelease.pluginId)!.revision).toBe(2);
  });

  it('keeps idempotency across reopen and shares command IDs with the document authority', async () => {
    const {core, storage, policy} = await fixture();
    const receipt = await core.executePlugin(actor, install());
    const reopened = await createCore({...options(storage, 'reopen'), pluginPolicy: policy.policy});
    policy.revoked.add('ardesia');
    expect(await reopened.executePlugin(actor, install())).toEqual(receipt);
    expect(storage.writes).toBe(1);
    await expect(reopened.execute(actor, {kind: 'create-document', commandId: 'install-1', documentId: 'lesson-1', expectedRevision: 0, title: 'Collisione'})).rejects.toMatchObject({code: 'IDEMPOTENCY_CONFLICT'});
    await expect(reopened.executePlugin(actor, install(updatedRelease))).rejects.toMatchObject({code: 'IDEMPOTENCY_CONFLICT'});
    expect(reopened.snapshot()).toEqual(core.snapshot());
  });

  it('detaches pending commands, policy inputs and returned installation projections', async () => {
    const storage = new ObservedStorage();
    const policy = policyFixture();
    const core = await createCore({...options(storage), pluginPolicy: async request => {
      await policy.policy(request);
      request.release.bundleDigest = 'c'.repeat(64);
      request.actor.actorId = 'mutated-policy-owner';
    }});
    const input = structuredClone(initialRelease);
    const pending = core.executePlugin(actor, install(input));
    input.bundleDigest = 'd'.repeat(64);
    await pending;
    const projection = core.getInstallation(actor, initialRelease.pluginId)!;
    projection.release.capabilities.push('objects:read');
    projection.status = 'revoked';
    expect(core.getInstallation(actor, initialRelease.pluginId)).toMatchObject({status: 'installed', release: initialRelease});
    expect(await storage.read()).toEqual(core.snapshot());
  });

  it('fails closed on partial installation events, missing receipts and missing auxiliary transition receipts', async () => {
    const {core, policy} = await fixture();
    await ready(core);
    await addLab(core);
    const missingEvent = core.snapshot();
    missingEvent.installations[0]!.revision += 1;
    expect(CoreSnapshotSchema.safeParse(missingEvent).success).toBe(false);
    const missingReceipt = core.snapshot();
    missingReceipt.receipts.pop();
    expect(CoreSnapshotSchema.safeParse(missingReceipt).success).toBe(false);
    policy.permitted.add('1.0.0:1.0.1:update');
    await core.executePlugin(actor, transition(core));
    const incomplete = core.snapshot();
    const receipt = incomplete.receipts.at(-1)!;
    if ('relatedEventIds' in receipt) receipt.relatedEventIds = [];
    expect(CoreSnapshotSchema.safeParse(incomplete).success).toBe(false);
    const duplicates = core.snapshot();
    const duplicateReceipt = duplicates.receipts.at(-1)!;
    if ('relatedEventIds' in duplicateReceipt) duplicateReceipt.relatedEventIds.push(duplicateReceipt.relatedEventIds[0]!);
    expect(CoreSnapshotSchema.safeParse(duplicates).success).toBe(false);
  });
});

describe('M1 to M2 migration preserves saved data without implied authority', () => {
  async function legacy() {
    const core = await createCore(options(new MemoryStorage()));
    await addLab(core);
    const {installations: _installations, assignments: _assignments, learnerWork: _learnerWork, ...snapshot} = core.snapshot();
    return {...snapshot, schemaVersion: 2};
  }

  it('opens v2 read-only, creates no installation or consent, and persists v4 only after an accepted command', async () => {
    const raw = await legacy();
    const storage = new ObservedStorage(raw);
    const policy = policyFixture();
    const core = await createCore({...options(storage, 'migration'), pluginPolicy: policy.policy});
    expect(core.snapshot()).toEqual({...raw, schemaVersion: 4, installations: [], assignments: [], learnerWork: []});
    expect(await storage.read()).toEqual(raw);
    expect(storage.writes).toBe(0);
    const savedLab = core.getDocument(actor, 'lesson-1').objects[0] as LabObject;
    await expect(core.execute(actor, {kind: 'replace-object', commandId: 'uninstalled-write', documentId: 'lesson-1', expectedRevision: 2, object: toObjectInput(savedLab)})).rejects.toMatchObject({code: 'PLUGIN_NOT_ACTIVE'});
    expect(await storage.read()).toEqual(raw);
    await ready(core);
    expect(core.getDocument(actor, 'lesson-1').objects[0]).toEqual(savedLab);
    expect((await storage.read() as CoreSnapshot).schemaVersion).toBe(4);
    expect(core.snapshot().events.slice(0, raw.events.length)).toEqual(raw.events);
  });

  it('does not overwrite invalid v2 or accept v2 with forged marketplace fields', async () => {
    const valid = await legacy();
    for (const raw of [{...valid, receipts: []}, {...valid, installations: []}, {...valid, schemaVersion: 99}]) {
      const storage = new ObservedStorage(raw);
      await expect(createCore(options(storage))).rejects.toMatchObject({code: 'INVALID_SNAPSHOT'});
      expect(await storage.read()).toEqual(raw);
      expect(storage.writes).toBe(0);
    }
  });

  it('preserves original v2 bytes when the first v4 installation write fails', async () => {
    const raw = await legacy();
    const storage = new ObservedStorage(raw);
    const core = await createCore({...options(storage, 'failure'), pluginPolicy: policyFixture().policy});
    const opened = core.snapshot();
    storage.fail = true;
    await expect(core.executePlugin(actor, install())).rejects.toMatchObject({code: 'STORAGE_FAILURE'});
    expect(core.snapshot()).toEqual(opened);
    expect(await storage.read()).toEqual(raw);
  });
});
