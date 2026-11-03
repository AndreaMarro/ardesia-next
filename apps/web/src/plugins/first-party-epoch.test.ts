import {afterEach, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import type {CoreService} from '@ardesia/core';
import {LabDataSchema} from '@ardesia/contracts';
import {poiseuillePressureState} from '@ardesia/poiseuille';
const runtime = vi.hoisted(() => ({mount: vi.fn(), evaluate: vi.fn()}));
// Isolate wrapper/epoch behavior; cryptographic execution remains covered by the real Host tests/browser.
vi.mock('@ardesia/plugin-host', async original => ({...await original<typeof import('@ardesia/plugin-host')>(),
  createPluginHost: () => ({resumePlugin: vi.fn(), suspendPlugin: vi.fn(),
    verify: async (input: {manifest: unknown}) => (await import('@ardesia/plugin-sdk')).PluginManifestSchema.parse(input.manifest), mount: runtime.mount})}));
import {connectMarketplace, disconnectMarketplace, mountLab, releaseFromManifest} from './first-party';

afterEach(() => {disconnectMarketplace(); vi.unstubAllGlobals();});
it('rejects a retained old session before it can poison the new context read', async () => {
  vi.stubGlobal('window', {setTimeout, clearTimeout});
  vi.stubGlobal('fetch', async (path: string) => new Response(new Uint8Array(readFileSync(new URL('../../public'+path, import.meta.url)))));
  const manifest = JSON.parse(readFileSync(new URL('../../public/plugins/poiseuille/1.0.0/manifest.json',import.meta.url),'utf8'));
  const release = releaseFromManifest(manifest);
  const core = {getInstallation: () => ({status: 'active', release, consent: {capabilities: ['state:read', 'state:write']}})} as unknown as CoreService;
  const actor = {actorId: 'epoch-teacher', role: 'teacher' as const};
  const data = LabDataSchema.parse({pluginId: manifest.id, pluginVersion: manifest.version, instanceId: 'old-instance',
    stateSchemaVersion: manifest.stateSchemaVersion, bundleDigest: manifest.integrity.digest, publisher: manifest.publisher, state: poiseuillePressureState});
  runtime.mount.mockImplementation(async request => ({manifest: request.manifest, instanceId: request.instanceId,
    grants: request.consent, current: {state: request.state, view: {}}, evaluate: runtime.evaluate, dispose: vi.fn()}));
  connectMarketplace(core, actor, {refresh: async () => {}});
  const old = await mountLab(data);
  const refresh = vi.fn(async () => {});
  connectMarketplace(core, actor, {refresh});
  const stale = old.evaluate(data.state).then(() => null, error => error);
  const fresh = mountLab({...data, instanceId: 'new-instance'});
  expect(await stale).toMatchObject({code: 'SESSION_CHANGED'});
  const current = await fresh;
  expect(current.instanceId).toBe('new-instance'); expect(refresh).toHaveBeenCalledTimes(1);
  expect(runtime.evaluate).not.toHaveBeenCalled(); old.dispose(); current.dispose();
});
