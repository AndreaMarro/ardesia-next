import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createServer, type Server} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {chmod, mkdtemp, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {canonicalJson, type CoreCommand} from '@ardesia/contracts';
import {ConfigSchema, readConfig, validOrigin, type McpConfig} from './config';
import {createAdapter, PREVIEW_TTL_MS} from './adapter';
import {MAX_RESPONSE_BYTES, post} from './http';

const at = '2026-11-07T10:00:00.000Z', actor = {actorId: 'bound-legacy-teacher', role: 'teacher'};
const object = {id: 'note', title: 'Ampiezza', type: 'note', x: 1, y: 2, width: 300, height: 200,
  data: {text: 'La conservazione dell’energia.'}, revision: 2, status: 'draft', provenance: {origin: 'authored', sources: [], createdBy: actor.actorId, createdAt: at}};
const doc = {id: 'lesson', ownerId: actor.actorId, title: 'Onde', revision: 3, status: 'draft', createdAt: at, updatedAt: at,
  objects: [object], connections: []};
const initial = {workspaceId: 'workspace', title: 'Fisica', workspaceRevision: 3, actor, documents: [doc], assignedDocuments: [],
  learnerWork: [{notes: 'PRIVATE_STUDENT_SECRET'}], events: [{id: 'event', sequence: 1, documentId: 'lesson', documentRevision: 3,
    type: 'replace-object', actorId: actor.actorId, occurredAt: at, payload: {previous: {...object, revision: 1, data: {text: 'Prima versione'}}}}]};
const command: CoreCommand = {kind: 'rename-document', commandId: 'rename', documentId: 'lesson', expectedRevision: 3, title: 'Onde meccaniche'};
const sha = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');

let server: Server, config: McpConfig, projection: typeof initial, status: number, bodyOverride: unknown;
let requests: {body: any; headers: Record<string, unknown>}[], directory: string;
beforeEach(async () => {
  projection = structuredClone(initial); requests = []; status = 200; bodyOverride = undefined;
  server = createServer(async (request, response) => {
    let bytes = ''; for await (const part of request) bytes += part;
    const body = JSON.parse(bytes); requests.push({body, headers: request.headers});
    let result: unknown = body.action === 'session' ? {account: {id: config.accountId, role: config.role, displayName: 'Synthetic'}, expiresAt: at}
      : body.action === 'list-workspaces' ? [{workspaceId: 'workspace', title: 'Fisica', workspaceRevision: 3}, {workspaceId: 'other', title: 'Private', workspaceRevision: 1}]
      : projection;
    if (body.action === 'command') result = {receipt: {commandId: body.command.commandId, actorId: actor.actorId,
      fingerprint: sha({actor, command: body.command}), documentId: 'lesson', documentRevision: 4, eventId: 'event4'}, projection};
    response.writeHead(status, {'content-type': 'application/json'});
    response.end(JSON.stringify(bodyOverride ?? {ok: true, result}));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as {port: number}).port;
  config = {version: 1, origin: `http://127.0.0.1:${port}`, accountId: 'account', role: 'teacher', sessionToken: 'a'.repeat(64), workspaceIds: ['workspace'], access: 'read-write'};
  directory = await mkdtemp(join(tmpdir(), 'ardesia-mcp-unit-'));
});
afterEach(async () => {vi.restoreAllMocks(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, {recursive: true, force: true});});

describe('MCP private configuration and transport', () => {
  it('accepts canonical HTTPS and explicit loopback only, rejecting confusing origin spellings', () => {
    for (const value of ['https://ardesia.example', 'http://localhost:4180', 'http://[::1]:4180']) expect(validOrigin(value)).toBe(true);
    for (const value of ['http://example.com:80', 'http://127.0.0.1', 'http://127.0.0.1:0', 'http://0.0.0.0:4180', 'http://127.0.0.1:4180/',
      'http://user:secret@127.0.0.1:4180', 'http://2130706433:4180', 'http://127.0.0.1:4180?x=y', 'https://ardesia.example/#x']) expect(validOrigin(value)).toBe(false);
    expect(ConfigSchema.safeParse({...config, role: 'student'}).success).toBe(true);
  });
  it('requires a private regular owned configuration file and never follows a symlink', async () => {
    const path = join(directory, 'config.json'); await writeFile(path, JSON.stringify(config), {mode: 0o600});
    expect(await readConfig(path)).toEqual(config);
    const link = join(directory, 'linked'); await symlink(path, link);
    await expect(readConfig(link)).rejects.toMatchObject({code: 'CONFIGURATION_INVALID'});
    await chmod(path, 0o644); await expect(readConfig(path)).rejects.toMatchObject({code: 'CONFIGURATION_INVALID'});
    await chmod(path, 0o600); await writeFile(path, ' '.repeat(32769));
    await expect(readConfig(path)).rejects.toMatchObject({code: 'CONFIGURATION_INVALID'});
  });
  it('rejects a FIFO configuration without waiting for a writer', async () => {
    const path = join(directory, 'fifo'); execFileSync('mkfifo', ['-m', '600', path]);
    await expect(readConfig(path)).rejects.toMatchObject({code: 'CONFIGURATION_INVALID'});
  });
  it('pins the endpoint/account/session headers and does not send environment proxy traffic', async () => {
    vi.stubEnv('HTTP_PROXY', 'http://127.0.0.1:1'); vi.stubEnv('NODE_USE_ENV_PROXY', '1');
    try {await createAdapter(config).list();} finally {vi.unstubAllEnvs();}
    expect(requests[0]?.headers).toMatchObject({origin: config.origin, cookie: `ardesia_dev_session=${config.sessionToken}`, 'x-ardesia-account': 'account'});
    expect(requests.map(item => item.body.action)).toEqual(['session', 'list-workspaces']);
  });
  it('refuses redirects and oversize replies without following a destination', async () => {
    server.removeAllListeners('request'); let hits = 0;
    server.on('request', (_request, response) => {hits++; response.writeHead(302, {location: config.origin + '/secret'}); response.end();});
    await expect(post(config.origin, {action: 'session'}, config)).rejects.toMatchObject({code: 'REDIRECT_REJECTED'}); expect(hits).toBe(1);
    server.removeAllListeners('request');
    server.on('request', (_request, response) => {response.writeHead(200, {'content-type': 'application/json', 'content-length': MAX_RESPONSE_BYTES + 1}); response.end();});
    await expect(post(config.origin, {action: 'session'}, config)).rejects.toMatchObject({code: 'RESPONSE_TOO_LARGE'});
  });
  it('redacts upstream private messages, rejects bad JSON and honors cancellation', async () => {
    status = 403; bodyOverride = {ok: false, error: {code: 'FORBIDDEN', message: 'PRIVATE_DATABASE_SECRET'}};
    await expect(post(config.origin, {action: 'session'}, config)).rejects.toMatchObject({message: 'FORBIDDEN'});
    bodyOverride = 'not an API envelope'; status = 200;
    await expect(post(config.origin, {action: 'session'}, config)).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
    await expect(post(config.origin, {action: 'session'}, config, AbortSignal.abort())).rejects.toMatchObject({code: 'CANCELLED'});
  });
});

describe('MCP authorized projections and immutable editing envelopes', () => {
  it('scopes listing and refuses out-of-scope requests before any upstream access', async () => {
    const adapter = createAdapter(config);
    expect((await adapter.list()).workspaces.map(item => item.workspaceId)).toEqual(['workspace']);
    const before = requests.length;
    await expect(adapter.read({workspaceId: 'other', documentId: 'lesson'})).rejects.toMatchObject({code: 'SCOPE_REJECTED'});
    expect(requests).toHaveLength(before);
  });
  it('returns data/provenance but never learner-private records; pins search pagination', async () => {
    const adapter = createAdapter(config), read = await adapter.read({workspaceId: 'workspace', documentId: 'lesson', revision: 3});
    expect(JSON.stringify(read)).not.toContain('PRIVATE_STUDENT_SECRET'); expect(read.document.objects[0]?.provenance.createdBy).toBe(actor.actorId);
    const search = await adapter.search({workspaceId: 'workspace', query: 'ENERGIA', offset: 0, limit: 1});
    expect(search.matches[0]).toMatchObject({objectId: 'note', objectRevision: 2, documentRevision: 3});
    await expect(adapter.search({workspaceId: 'workspace', query: '', offset: 1, limit: 1})).rejects.toMatchObject({code: 'REVISION_REQUIRED'});
    await expect(adapter.search({workspaceId: 'workspace', query: '', offset: 1, limit: 1, workspaceRevision: 2})).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
    await expect(adapter.read({workspaceId: 'workspace', documentId: 'lesson', revision: 2})).rejects.toMatchObject({code: 'REVISION_CONFLICT'});
  });
  it('reads retained exact versions including removed objects; never substitutes latest', async () => {
    const adapter = createAdapter(config);
    projection.documents[0]!.objects = [];
    expect((await adapter.object({workspaceId: 'workspace', documentId: 'lesson', objectId: 'note', revision: 1}))).toMatchObject({historical: true, object: {revision: 1, data: {text: 'Prima versione'}}});
    await expect(adapter.object({workspaceId: 'workspace', documentId: 'lesson', objectId: 'note', revision: 19})).rejects.toMatchObject({code: 'NOT_FOUND'});
  });
  it('does not expose historical teacher revisions to a student', async () => {
    config = {...config, role: 'student', access: 'read-only'};
    Object.assign(projection, {actor: {actorId: 'account', role: 'student'}, documents: [], assignedDocuments: [doc], events: []});
    const adapter = createAdapter(config);
    expect((await adapter.object({workspaceId: 'workspace', documentId: 'lesson', objectId: 'note', revision: 2})).historical).toBe(false);
    await expect(adapter.object({workspaceId: 'workspace', documentId: 'lesson', objectId: 'note', revision: 1})).rejects.toMatchObject({code: 'NOT_FOUND'});
  });
  it('allows student-owned history and previews, but rejects authoring in an assigned workspace even with write configuration',async()=>{
    config={...config,role:'student'};
    Object.assign(projection,{access:'owner',actor:{actorId:actor.actorId,role:'student'}});
    const adapter=createAdapter(config);
    expect((await adapter.object({workspaceId:'workspace',documentId:'lesson',objectId:'note',revision:1})).historical).toBe(true);
    const preview=await adapter.preview({workspaceId:'workspace',command});
    Object.assign(projection,{access:'assigned',actor:{actorId:config.accountId,role:'student'},documents:[],assignedDocuments:[doc],events:[]});
    await expect(adapter.preview({workspaceId:'workspace',command:{kind:'create-document',documentId:'private-in-shared',commandId:'new',expectedRevision:0,title:'No'}})).rejects.toMatchObject({code:'OWNER_REQUIRED'});
    await expect(adapter.apply(preview)).rejects.toMatchObject({code:'OWNER_REQUIRED'});
    expect(requests.every(item=>item.body.action!=='command')).toBe(true);
  });
  it('rechecks authorization on every read and rejects mixed ownership', async () => {
    const adapter = createAdapter(config);
    await adapter.read({workspaceId: 'workspace', documentId: 'lesson'});
    status = 401; bodyOverride = {ok: false, error: {code: 'UNAUTHENTICATED'}};
    await expect(adapter.read({workspaceId: 'workspace', documentId: 'lesson'})).rejects.toMatchObject({code: 'UNAUTHENTICATED'});
    status = 200; bodyOverride = undefined; projection.documents[0]!.ownerId = 'different';
    await expect(adapter.read({workspaceId: 'workspace', documentId: 'lesson'})).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
  });
  it('does not let a readonly configuration prepare or apply mutations', async () => {
    const adapter = createAdapter({...config, access: 'read-only'});
    await expect(adapter.preview({workspaceId: 'workspace', command})).rejects.toMatchObject({code: 'WRITE_DISABLED'});
    await expect(adapter.apply({proposalId: 'anything', commandDigest: 'a'.repeat(64)})).rejects.toMatchObject({code: 'WRITE_DISABLED'});
    expect(requests).toHaveLength(0);
  });
  it('binds the complete immutable command, returns original receipts and does not trust a forged digest', async () => {
    const adapter = createAdapter(config), mutable = structuredClone(command);
    const preview = await adapter.preview({workspaceId: 'workspace', command: mutable}); mutable.title = 'Changed after preview';
    expect(preview).toMatchObject({committed: false, approval: 'not-attested', expectedRevisionMatches: true});
    expect(requests.every(item => item.body.action !== 'command')).toBe(true);
    await expect(adapter.apply({...preview, commandDigest: 'b'.repeat(64)})).rejects.toMatchObject({code: 'PREVIEW_MISMATCH'});
    const first = await adapter.apply(preview), second = await adapter.apply(preview);
    expect(first.receipt).toEqual(second.receipt);
    expect(requests.filter(item => item.body.action === 'command').map(item => item.body.command)).toEqual([command, command]);
  });
  it('keeps stale commands available for Core idempotent recovery; expires/discards envelopes without pretending to undo', async () => {
    const adapter = createAdapter(config); projection.documents[0]!.revision = 8;
    const preview = await adapter.preview({workspaceId: 'workspace', command}); expect(preview.expectedRevisionMatches).toBe(false);
    expect(adapter.discard(preview.proposalId)).toEqual({discarded: true});
    await expect(adapter.apply(preview)).rejects.toMatchObject({code: 'PREVIEW_UNAVAILABLE'});
    const next = await adapter.preview({workspaceId: 'workspace', command});
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + PREVIEW_TTL_MS + 1);
    await expect(adapter.apply(next)).rejects.toMatchObject({code: 'PREVIEW_UNAVAILABLE'});
  });
  it('rejects forged receipts even when their schema is valid', async () => {
    const adapter = createAdapter(config), preview = await adapter.preview({workspaceId: 'workspace', command});
    server.removeAllListeners('request');
    server.on('request', async (request, response) => {
      let bytes = ''; for await (const part of request) bytes += part;
      const action = JSON.parse(bytes).action;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ok: true, result: action === 'session' ? {account: {id: 'account', role: 'teacher', displayName: 'T'}, expiresAt: at}
        : action === 'open-workspace' ? projection : {projection, receipt: {commandId: 'rename', actorId: actor.actorId, documentId: 'lesson', documentRevision: 4, eventId: 'event4', fingerprint: 'f'.repeat(64)}}}));
    });
    await expect(adapter.apply(preview)).rejects.toMatchObject({code: 'INVALID_RESPONSE'});
  });
});
