import {afterEach, describe, expect, it, vi} from 'vitest';
import {createRemoteClient, type WorkspaceProjection} from '@ardesia/remote-client';
import {connectMarketplace, createFirstPartyLab, disconnectMarketplace} from './first-party';

const actor = {actorId: 'teacher-authorization', role: 'teacher' as const};
const account = {id: actor.actorId, role: actor.role, displayName: 'Docente sintetico'};
const at = '2026-11-03T00:00:00.000Z';
const projection = (): WorkspaceProjection => ({workspaceId: 'authorization-workspace', title: 'Sintetico', workspaceRevision: 1,
  actor, documents: [], assignedDocuments: [], installations: [], events: [], assignments: [], learnerWork: [], learningEvents: [], labAccess: []});
const json = (result: unknown) => new Response(JSON.stringify({ok: true, result}), {headers: {'Content-Type': 'application/json'}});
function deferred() {let resolve!: (r: Response) => void; const promise = new Promise<Response>(yes => {resolve = yes;}); return {promise, resolve};}
const tick = async () => {await Promise.resolve(); await Promise.resolve();};
async function setup(read: () => Response | Promise<Response>) {
  let initial = true;
  const client = createRemoteClient({clock: () => at, fetch: async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.action === 'login') return json({account, expiresAt: '2026-11-04T00:00:00.000Z'});
    if (initial) {initial = false; return json(projection());}
    return read();
  }});
  await client.login('synthetic-teacher', 'synthetic-only'); await client.openWorkspace('authorization-workspace');
  const connect = () => connectMarketplace(client.core, actor, {refresh: client.refresh}); connect();
  // No installation: real public consumers stop at the installation guard, before artifacts/Host.
  const mount = () => createFirstPartyLab('ardesia.poiseuille').then(() => null, (error: unknown) => error);
  return {client, connect, mount};
}
afterEach(disconnectMarketplace);

describe('authorization reads before first-party mounts', () => {
  it('collects same-turn callers before sending one fresh read', async () => {
    const gate = deferred(), read = vi.fn(() => gate.promise); const {mount} = await setup(read);
    const calls = Array.from({length: 6}, mount); await tick(); const sent = read.mock.calls.length;
    gate.resolve(json(projection())); const results = await Promise.all(calls);
    expect(sent).toBe(1); expect(results).toHaveLength(6);
    for (const result of results) expect(result).toMatchObject({code: 'PLUGIN_NOT_INSTALLED'});
  });

  it('sends a new read after dispatch and preserves workspace access revocation over the old response', async () => {
    const old = deferred(), recent = deferred(); const read = vi.fn().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => recent.promise);
    const {client, mount} = await setup(read); const first = mount(); await tick(); const second = mount(); await tick();
    if (read.mock.calls.length !== 2) {old.resolve(json(projection())); recent.resolve(json(projection())); await Promise.all([first, second]); expect(read).toHaveBeenCalledTimes(2); return;}
    recent.resolve(new Response(JSON.stringify({ok: false, error: {code: 'FORBIDDEN', message: 'Revocato.'}}), {status: 403, headers: {'Content-Type': 'application/json'}}));
    expect(await second).toMatchObject({code: 'FORBIDDEN'}); expect(client.projection).toBeNull();
    old.resolve(json(projection())); expect(await first).toBeInstanceOf(Error); expect(client.projection).toBeNull();
  });

  it('does not dispatch a collected read after the marketplace context changes', async () => {
    const read = vi.fn(() => json(projection())); const {connect, mount} = await setup(read);
    const pending = mount(); connect(); const result = await pending;
    expect(result).toMatchObject({code: 'SESSION_CHANGED'}); expect(read).not.toHaveBeenCalled();
  });

  it('does not keep a failed read for subsequent callers', async () => {
    const read = vi.fn().mockRejectedValueOnce(new TypeError('Synthetic transport failure.')).mockImplementation(() => json(projection()));
    const {mount} = await setup(read); expect(await mount()).toBeInstanceOf(Error);
    expect(await mount()).toMatchObject({code: 'PLUGIN_NOT_INSTALLED'}); expect(read).toHaveBeenCalledTimes(2);
  });
});
