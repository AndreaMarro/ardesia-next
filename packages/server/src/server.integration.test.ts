import {beforeAll, afterAll, describe, expect, it} from 'vitest';
import {randomUUID, createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {checkServerIdentity} from 'node:tls';
import {Client, type PoolConfig} from 'pg';
import {createDatabasePool, hash} from './database';
import {canonical} from './errors';
import {MaterialManifestSchema, materialPage, CoreSnapshotSchema, extensionDefinitionDigest, type NotebookCommand, type ExtensionDefinition, type CoreSnapshot, type PluginRelease, type JsonValue} from '@ardesia/contracts';
import {createCore, MemoryStorage} from '@ardesia/core';
import {idealSpringInitialState} from '@ardesia/ideal-spring';
import {localBrowserAccounts} from '../../../tools/e2e-accounts.mjs';
import {
  Pool, createApiHandler, createPostgresStore, createFirstPartyPolicy, migrate, provisionTestAccounts,
  exportBackup, restoreBackup, revokeAccountSessions, type WorkspaceProjection,
} from './index';

const connectionString = process.env.M3_TEST_DATABASE_URL;
const origin = 'https://ardesia-m3.test';
const ids = {teacher: 'teacher-m3', a: 'student-a-m3', b: 'student-b-m3', outsider: 'teacher-outside'};
const passwords = {teacher: randomUUID() + randomUUID(), a: randomUUID() + randomUUID(), b: randomUUID() + randomUUID(), outsider: randomUUID() + randomUUID()};
type Identity = {id: string; cookie: string;};
type Body = {ok: boolean; result?: any; error?: {code: string; message: string}};
const policy = createFirstPartyPolicy({artifactRoot: resolve('apps/web/public')});
let admin: Pool, runtime: Pool;
let handler: ReturnType<typeof createApiHandler>;
let teacher: Identity, studentA: Identity, studentB: Identity, outsider: Identity;
let runtimeRole: string;
let release: PluginRelease;
const data = (instanceId: string, massKg = 1) => ({pluginId: release.pluginId, pluginVersion: release.version, instanceId,
  stateSchemaVersion: release.stateSchemaVersion, bundleDigest: release.bundleDigest, publisher: release.publisher,
  state: {schemaVersion: '1.0.0', value: {...idealSpringInitialState.value as object, massKg}}});

async function request(body: unknown, identity?: Identity, extra: Record<string, string> = {}, selectedHandler = handler) {
  const headers = new Headers({'Origin': origin, 'Content-Type': 'application/json', ...extra});
  if (identity) {headers.set('Cookie', identity.cookie); headers.set('X-Ardesia-Account', identity.id);}
  const response = await selectedHandler(new Request(origin + '/api/m3', {method: 'POST', headers, body: JSON.stringify(body)}));
  return {status: response.status, body: await response.json() as Body, cookie: response.headers.get('set-cookie'), headers: response.headers};
}
async function signIn(key: keyof typeof ids): Promise<Identity> {
  const result = await request({action: 'login', username: ids[key], password: passwords[key]});
  expect(result.status).toBe(200); expect(result.body.result.account.id).toBe(ids[key]);
  expect(result.cookie).toContain('HttpOnly'); expect(result.cookie).toContain('Secure'); expect(result.cookie).toContain('SameSite=Strict');
  return {id: ids[key], cookie: result.cookie!.split(';')[0]!};
}
async function workspace(title = 'Synthetic M3') {
  const response = await request({action: 'create-workspace', commandId: randomUUID(), title}, teacher);
  expect(response.status).toBe(200); return response.body.result as WorkspaceProjection;
}
async function command(identity: Identity, workspaceId: string, command: unknown, action = 'command') {
  return request({action, workspaceId, command}, identity);
}
function notebook(expectedRevision = 0): Extract<NotebookCommand, {kind: 'create-notebook'}> {
  return {kind: 'create-notebook', commandId: randomUUID(), expectedRevision, notebookId: randomUUID(), title: 'Private notebook',
    sectionId: randomUUID(), sectionTitle: 'Private section', firstPage: {pageId: randomUUID(), documentId: randomUUID(), title: 'Shared page',
      layout: {format: 'a4', orientation: 'portrait', background: 'grid', paper: 'ivory'}}};
}
async function lesson(workspaceId: string) {
  const documentId = randomUUID();
  const response = await command(teacher, workspaceId, {kind: 'create-document', commandId: randomUUID(), documentId, expectedRevision: 0, title: 'Lesson'});
  expect(response.status).toBe(200); return documentId;
}
async function assign(workspaceId: string, documentId: string, studentId: string) {
  const response = await command(teacher, workspaceId, {kind: 'assign-lesson', commandId: randomUUID(), documentId, studentId, expectedRevision: 0}, 'learning-command');
  expect(response.status).toBe(200);
}
async function install(workspaceId: string, releaseToInstall = release) {
  const release = releaseToInstall;
  for (const spec of [
    {kind: 'install-plugin', expectedRevision: 0, release},
    {kind: 'consent-plugin', expectedRevision: 1, releaseDigest: release.bundleDigest, capabilities: release.capabilities},
    {kind: 'activate-plugin', expectedRevision: 2},
  ]) {
    const response = await command(teacher, workspaceId, {...spec, pluginId: release.pluginId, commandId: randomUUID()}, 'plugin-command');
    expect(response.status).toBe(200);
  }
}

describe('M4 distributed release policy', () => {
  it('accepts the exact signed Poiseuille pressure and flow states through the shipped Host', async () => {
    const manifest = JSON.parse(await readFile('plugins/poiseuille/release/1.0.0/manifest.json', 'utf8'));
    const candidateRelease: PluginRelease = {pluginId: manifest.id, version: manifest.version, bundleDigest: manifest.integrity.digest,
      publisher: manifest.publisher, license: manifest.license, provenance: manifest.provenance, sdkVersion: manifest.sdkVersion,
      stateSchemaVersion: manifest.stateSchemaVersion, capabilities: manifest.capabilities};
    for (const forcing of [{pressureDropPa: 800}, {flowRateM3PerS: Math.PI * 1e-7}] as Record<string, JsonValue>[]) {
      await expect(policy({actor: {actorId: 'm4-policy-teacher', role: 'teacher'}, operation: 'use', release: candidateRelease, consent: ['state:read', 'state:write'],
        states: [{pluginId: candidateRelease.pluginId, pluginVersion: candidateRelease.version, stateSchemaVersion: candidateRelease.stateSchemaVersion, bundleDigest: candidateRelease.bundleDigest, publisher: candidateRelease.publisher, instanceId: randomUUID(), state: {schemaVersion: '1.0.0', value: {
          radiusM: 0.001, lengthM: 1, viscosityPaS: 0.001, densityKgPerM3: 1000, ...forcing,
        }}}]})).resolves.toBeUndefined();
    }
  });
});

describe('PostgreSQL transport policy', () => {
  it('enables verified TLS for a remote URL and retains an explicitly trusted CA after pg parses it', async () => {
    const previous = process.env.PGSSLMODE;
    process.env.PGSSLMODE = 'no-verify';
    try {
      for (const query of ['', '?sslmode=verify-full', '?ssl=true&sslmode=verify-full&uselibpqcompat=true']) {
        const pool = createDatabasePool('postgres://synthetic@database.example.invalid/ardesia' + query, {ssl: {ca: 'Synthetic test CA'}});
        try {
          const client = new Client(pool.options);
          expect(client.host).toBe('database.example.invalid');
          expect(client.ssl).toMatchObject({rejectUnauthorized: true, ca: 'Synthetic test CA', host: client.host, checkServerIdentity});
          expect(new URL(pool.options.connectionString!).searchParams.has('sslmode')).toBe(false);
        } finally {await pool.end();}
      }
      const defaultPool = createDatabasePool('postgres://synthetic@database.example.invalid/ardesia');
      try {expect(new Client(defaultPool.options).ssl).toMatchObject({rejectUnauthorized: true, checkServerIdentity});}
      finally {await defaultPool.end();}
    } finally {if (previous === undefined) delete process.env.PGSSLMODE; else process.env.PGSSLMODE = previous;}
  });

  it('refuses remote URL and option downgrades instead of letting pg replace certificate verification', () => {
    for (const query of ['sslmode=disable', 'sslmode=no-verify', 'sslmode=prefer', 'sslmode=require', 'sslmode=verify-ca',
      'ssl=0', 'ssl=no-verify', 'sslmode=verify-full&sslmode=disable', 'sslmode=require&uselibpqcompat=true']) {
      expect(() => createDatabasePool('postgres://synthetic@database.example.invalid/ardesia?' + query)).toThrowError(expect.objectContaining({code: 'DATABASE_TLS_REQUIRED'}));
    }
    for (const ssl of [false, {rejectUnauthorized: false}, {checkServerIdentity: () => undefined},
      {servername: 'different.example.invalid'}, {host: 'different.example.invalid'}] satisfies PoolConfig['ssl'][]) {
      expect(() => createDatabasePool('postgres://synthetic@database.example.invalid/ardesia?sslmode=verify-full', {ssl}))
        .toThrowError(expect.objectContaining({code: 'DATABASE_TLS_REQUIRED'}));
    }
    expect(() => createDatabasePool('postgres:///ambiguous')).toThrowError(expect.objectContaining({code: 'DATABASE_CONFIGURATION_INVALID'}));
    expect(() => createDatabasePool('not-a-postgres-url')).toThrowError(expect.objectContaining({code: 'DATABASE_CONFIGURATION_INVALID'}));
  });

  it('checks the actual query-selected host and recognizes only explicit loopback endpoints', async () => {
    const remote = createDatabasePool('postgres://synthetic@localhost/ardesia?host=database.example.invalid');
    try {
      const parsed = new Client(remote.options);
      expect(parsed.host).toBe('database.example.invalid');
      expect(parsed.ssl).toMatchObject({rejectUnauthorized: true, host: parsed.host});
    } finally {await remote.end();}
    for (const host of ['localhost', '127.0.0.1', '127.0.0.2', '[::1]']) {
      const local = createDatabasePool(`postgres://synthetic@${host}/ardesia`, {ssl: false});
      try {expect(new Client(local.options).ssl).toBe(false);} finally {await local.end();}
    }
    expect(() => createDatabasePool('postgres://synthetic@127.0.0.1.example.invalid/ardesia', {ssl: false}))
      .toThrowError(expect.objectContaining({code: 'DATABASE_TLS_REQUIRED'}));
  });
});

describe('M3 real PostgreSQL authority (requires M3_TEST_DATABASE_URL)', () => {
  beforeAll(async () => {
    if (!connectionString) throw new Error('M3_TEST_DATABASE_URL is required. These tests do not substitute an in-memory database.');
    const url = new URL(connectionString);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw new Error('Only a dedicated local *_test database may be reset by this suite.');
    admin = new Pool({connectionString});
    await admin.query('DROP SCHEMA IF EXISTS ardesia_next CASCADE');
    const first = await migrate(admin); expect((await migrate(admin)).digest).toBe(first.digest);
    await provisionTestAccounts(admin, Object.entries(ids).map(([key, id]) => ({id, username: id, displayName: id,
      role: key === 'a' || key === 'b' ? 'student' : 'teacher', password: passwords[key as keyof typeof passwords]})));
    runtimeRole = 'm3_runtime_' + randomUUID().replaceAll('-', '');
    await admin.query(`CREATE ROLE ${runtimeRole} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
    await admin.query(`GRANT ardesia_next_runtime TO ${runtimeRole}`);
    url.username = runtimeRole;
    runtime = new Pool({connectionString: url.toString()});
    handler = createApiHandler({store: createPostgresStore({pool: runtime, pluginPolicy: policy}), allowedOrigins: [origin]});
    const manifest = JSON.parse(await readFile('apps/web/public/plugins/ideal-spring/1.0.0/manifest.json', 'utf8'));
    release = {pluginId: manifest.id, version: manifest.version, bundleDigest: manifest.integrity.digest,
      publisher: manifest.publisher, license: manifest.license, provenance: manifest.provenance, sdkVersion: manifest.sdkVersion,
      stateSchemaVersion: manifest.stateSchemaVersion, capabilities: manifest.capabilities};
    teacher = await signIn('teacher'); studentA = await signIn('a'); studentB = await signIn('b'); outsider = await signIn('outsider');
  }, 30_000);
  afterAll(async () => {
    await runtime?.end();
    if (admin && runtimeRole) await admin.query(`DROP ROLE IF EXISTS ${runtimeRole}`);
    await admin?.end();
  });

  it('uses a restricted runtime role and hashes credentials/tokens instead of persisting them', async () => {
    const permissions = await runtime.query("SELECT current_user,has_table_privilege(current_user,'ardesia_next.accounts','INSERT') as can_provision");
    expect(permissions.rows[0].current_user).toBe(runtimeRole); expect(permissions.rows[0].can_provision).toBe(false);
    await expect(runtime.query('CREATE TABLE ardesia_next.forbidden(id int)')).rejects.toThrow();
    const auth = await admin.query('SELECT password_hash FROM ardesia_next.accounts WHERE id=$1', [teacher.id]);
    expect(auth.rows[0].password_hash).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(auth.rows[0].password_hash).not.toContain(passwords.teacher);
    const tokens = await admin.query('SELECT token_hash FROM ardesia_next.sessions');
    expect(tokens.rows.every(row => !teacher.cookie.includes(row.token_hash))).toBe(true);
  });

  it('continues to connect to the real isolated loopback database without requiring TLS', async () => {
    const local = createDatabasePool(connectionString!, {ssl: false});
    try {expect((await local.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0]?.ssl).toBe(false);}
    finally {await local.end();}
  });

  it('rejects unauthenticated, CSRF, forged role/owner fields and account-switch requests', async () => {
    expect((await request({action: 'session'})).status).toBe(401);
    expect((await request({action: 'session', role: 'teacher'}, studentA)).status).toBe(400);
    expect((await request({action: 'session'}, teacher, {Origin: 'https://evil.example'})).status).toBe(403);
    const w = await workspace();
    const switched = {id: studentA.id, cookie: studentB.cookie};
    const result = await request({action: 'open-workspace', workspaceId: w.workspaceId}, switched);
    expect(result.status).toBe(409); expect(result.body.error?.code).toBe('SESSION_CHANGED');
    expect((await request({action: 'create-workspace', title: 'forbidden', commandId: randomUUID(), ownerId:teacher.id}, studentA)).status).toBe(400);
  });

  it('creates learner-owned spaces without role promotion and rejects authoring in assigned containers',async()=>{
    const input={action:'create-workspace',title:'Spazio privato dello studente',commandId:randomUUID()};
    const created=await request(input,studentA);expect(created.status).toBe(200);
    const w=created.body.result;
    expect(w).toMatchObject({access:'owner',actor:{actorId:studentA.id,role:'student'},documents:[],assignedDocuments:[]});
    expect((await request(input,studentA)).body.result.workspaceId).toBe(w.workspaceId);
    const documentId=randomUUID(),cmd={kind:'create-document',commandId:randomUUID(),documentId,expectedRevision:0,title:'La mia invenzione'};
    const written=await command(studentA,w.workspaceId,cmd);expect(written.status).toBe(200);
    const fresh=await signIn('a');
    expect((await command(fresh,w.workspaceId,cmd)).body.result.receipt).toEqual(written.body.result.receipt);
    expect((await request({action:'open-workspace',workspaceId:w.workspaceId},fresh)).body.result.documents[0]).toMatchObject({id:documentId,ownerId:studentA.id,status:'draft'});
    expect((await request({action:'list-workspaces'},fresh)).body.result).toContainEqual(expect.objectContaining({workspaceId:w.workspaceId,access:'owner'}));
    for(const outside of [teacher,studentB,outsider]){
      expect((await request({action:'open-workspace',workspaceId:w.workspaceId},outside)).status).toBe(404);
      expect((await request({action:'export-personal',workspaceId:w.workspaceId},outside)).status).toBe(404);
    }
    const shared=await workspace('Assigned container'),doc=await lesson(shared.workspaceId);
    await command(teacher,shared.workspaceId,{kind:'assign-lesson',commandId:randomUUID(),documentId:doc,studentId:studentA.id,expectedRevision:0},'learning-command');
    const before=(await request({action:'open-workspace',workspaceId:shared.workspaceId},teacher)).body.result.workspaceRevision;
    expect((await request({action:'open-workspace',workspaceId:shared.workspaceId},studentA)).body.result).toMatchObject({access:'assigned',documents:[],installations:[]});
    expect((await command(studentA,shared.workspaceId,{...cmd,commandId:randomUUID(),documentId:randomUUID()})).status).toBe(403);
    expect((await command(studentA,shared.workspaceId,{kind:'install-plugin',commandId:randomUUID(),pluginId:release.pluginId,expectedRevision:0,release},'plugin-command')).status).toBe(403);
    expect((await request({action:'open-workspace',workspaceId:shared.workspaceId},teacher)).body.result.workspaceRevision).toBe(before);
    expect((await command(studentA,w.workspaceId,{kind:'assign-lesson',commandId:randomUUID(),documentId,studentId:studentB.id,expectedRevision:0},'learning-command')).status).toBe(403);
    expect((await request({action:'session'},fresh)).body.result.account.role).toBe('student');
  });

  it('persists exact course editions, private work and revocation through restricted PostgreSQL without implicit lesson grants', async () => {
    const w = await workspace('Course transactions'), doc = await lesson(w.workspaceId);
    const courseId = randomUUID(), editionId = randomUUID(), deliveryId = randomUUID(), unitId = randomUUID();
    const input = {title: 'Course', description: 'Synthetic', license: 'Synthetic fixture', units: [{id: unitId, title: 'Unit', objective: 'Explain', prerequisites: 'Units',
      explanation: 'A model', prediction: 'Predict', activity: 'Try', referenceFeedback: 'Reference', recovery: 'Recover', transfer: 'Transfer', sources: [], lesson: {documentId: doc, revision: 1}}]};
    const save = {kind: 'save-course', courseId, commandId: randomUUID(), expectedRevision: 0, input};
    const created = await command(teacher, w.workspaceId, save, 'course-command'); expect(created.status).toBe(200);
    expect((await command(teacher, w.workspaceId, save, 'course-command')).body.result.receipt).toEqual(created.body.result.receipt);
    const freezing = {kind: 'create-course-edition', commandId: randomUUID(), expectedRevision: 0, courseId, courseRevision: 1, editionId, label: 'Frozen'};
    expect((await command(teacher, w.workspaceId, freezing, 'course-command')).status).toBe(200);
    expect((await command(teacher, w.workspaceId, {kind: 'assign-course', commandId: randomUUID(), expectedRevision: 0, editionId, deliveryId, learnerId: studentA.id}, 'course-command')).status).toBe(200);
    expect((await request({action: 'open-workspace', workspaceId: w.workspaceId}, studentB)).status).toBe(404);
    const initial = (await request({action: 'open-workspace', workspaceId: w.workspaceId}, studentA)).body.result;
    expect(initial.assignedDocuments).toEqual([]); expect(initial.assignments).toEqual([]);
    expect(initial.courseSpace.editions[0].course.revision).toBe(1);
    await command(teacher, w.workspaceId, {kind: 'rename-document', commandId: randomUUID(), documentId: doc, expectedRevision: 1, title: 'Changed'});
    expect((await request({action: 'read-course-lesson', workspaceId: w.workspaceId, editionId, unitId}, studentA)).body.result).toMatchObject({revision: 1, title: 'Lesson'});
    const attempt = {kind: 'record-course-attempt', commandId: randomUUID(), expectedRevision: 0, deliveryId, unitId, attemptId: randomUUID(), stage: 'prediction', answer: 'PRIVATE_COURSE_ANSWER'};
    const result = await command(studentA, w.workspaceId, attempt, 'course-command'); expect(result.status).toBe(200);
    const secondSession = await signIn('a');
    expect((await command(secondSession, w.workspaceId, attempt, 'course-command')).body.result.receipt).toEqual(result.body.result.receipt);
    expect(JSON.stringify((await request({action: 'export-personal', workspaceId: w.workspaceId}, teacher)).body)).not.toContain('PRIVATE_COURSE_ANSWER');
    await command(studentA, w.workspaceId, {kind: 'share-course-work', commandId: randomUUID(), expectedRevision: 1, deliveryId, shared: true}, 'course-command');
    expect((await request({action: 'open-workspace', workspaceId: w.workspaceId}, teacher)).body.result.courseSpace.work[0].attempts[0].answer).toBe('PRIVATE_COURSE_ANSWER');
    await command(teacher, w.workspaceId, {kind: 'revoke-course-delivery', commandId: randomUUID(), expectedRevision: 1, deliveryId}, 'course-command');
    expect((await command(secondSession, w.workspaceId, attempt, 'course-command')).status).toBe(404);
    expect((await request({action: 'read-course-lesson', workspaceId: w.workspaceId, editionId, unitId}, studentA)).status).toBe(404);
    const own = (await request({action: 'export-personal', workspaceId: w.workspaceId}, studentA)).body.result.projection;
    expect(own.courseSpace.editions).toEqual([]); expect(own.courseSpace.work[0].attempts).toHaveLength(1);
    expect((await request({action: 'open-workspace', workspaceId: w.workspaceId}, teacher)).body.result.courseSpace.work).toEqual([]);
    expect((await request({action: 'list-workspaces'}, studentA)).body.result.some((value: any) => value.workspaceId === w.workspaceId)).toBe(true);
    const state = (await admin.query('SELECT snapshot FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0].snapshot;
    expect(state.courseWork).toHaveLength(1); expect(state.courseDeliveries[0].revision).toBe(2);
    expect(state.events.filter((event: any) => event.type === 'record-course-attempt')).toHaveLength(1);
  });

  it('denies IDOR and filters private work from the teacher and second student', async () => {
    const w = await workspace(), doc = await lesson(w.workspaceId);
    await assign(w.workspaceId, doc, studentA.id); await assign(w.workspaceId, doc, studentB.id);
    const note = await command(studentA, w.workspaceId, {kind: 'save-learner-note', commandId: randomUUID(), documentId: doc, expectedRevision: 0, text: 'Private student A'}, 'learning-command');
    expect(note.status).toBe(200);
    for (const identity of [teacher, studentB]) {
      const read = await request({action: 'export-personal', workspaceId: w.workspaceId}, identity);
      expect(read.status).toBe(200); expect(JSON.stringify(read.body)).not.toContain('Private student A');
      expect(read.body.result.projection).not.toHaveProperty('snapshot');
    }
    const forbidden = await command(studentB, w.workspaceId, {kind: 'rename-document', commandId: randomUUID(), documentId: doc, expectedRevision: 1, title: 'hacked'});
    expect(forbidden.status).toBe(403);
    const hidden = await request({action: 'open-workspace', workspaceId: w.workspaceId}, outsider);
    expect(hidden.status).toBe(404);
    expect((await request({action: 'open-workspace', workspaceId: randomUUID()}, outsider)).body.error).toEqual(hidden.body.error);
    const spoof = await command(studentB, w.workspaceId, {kind: 'save-learner-note', commandId: randomUUID(), documentId: doc, expectedRevision: 0, text: 'spoof', studentId: studentA.id}, 'learning-command');
    expect(spoof.status).toBe(400);
  });

  it('serializes competing revisions and returns the original receipt after a lost response', async () => {
    const w = await workspace(), doc = await lesson(w.workspaceId);
    const left = {kind: 'rename-document', commandId: randomUUID(), documentId: doc, expectedRevision: 1, title: 'A'};
    const right = {...left, commandId: randomUUID(), title: 'B'};
    const results = await Promise.all([command(teacher, w.workspaceId, left), command(teacher, w.workspaceId, right)]);
    expect(results.map(value => value.status).sort()).toEqual([200, 409]);
    const winner = results.findIndex(value => value.status === 200), receipt = results[winner]!.body.result.receipt;
    const retry = await command(teacher, w.workspaceId, winner === 0 ? left : right);
    expect(retry.body.result.receipt).toEqual(receipt);
    expect(retry.body.result.projection.workspaceRevision).toBe(results[winner]!.body.result.projection.workspaceRevision);
    const conflict = await command(teacher, w.workspaceId, {...(winner === 0 ? left : right), title: 'different'});
    expect(conflict.body.error?.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('commits notebook creation once, serializes concurrent organization and keeps catalog identity private', async () => {
    const w = await workspace(), first = notebook(), second = notebook(1);
    const created = await command(teacher, w.workspaceId, first, 'notebook-command');
    expect(created.status).toBe(200); expect(created.body.result.receipt.relatedEventIds).toHaveLength(1);
    const row = async () => (await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0];
    const original = await row(); expect(original.snapshot.events).toHaveLength(2); expect(original.snapshot.receipts).toHaveLength(1);
    expect(original.snapshot.documents).toHaveLength(1); expect(original.snapshot.notebookLibraries).toHaveLength(1);
    expect((await command(teacher, w.workspaceId, first, 'notebook-command')).body.result.receipt).toEqual(created.body.result.receipt);
    expect(await row()).toEqual(original);
    expect((await command(teacher, w.workspaceId, second, 'notebook-command')).status).toBe(200);
    const updates = await Promise.all([
      command(teacher, w.workspaceId, {kind: 'move-notebook', commandId: randomUUID(), expectedRevision: 2, notebookId: second.notebookId, beforeId: first.notebookId}, 'notebook-command'),
      command(teacher, w.workspaceId, {kind: 'move-notebook', commandId: randomUUID(), expectedRevision: 2, notebookId: first.notebookId, beforeId: null}, 'notebook-command'),
    ]);
    expect(updates.map(result => result.status).sort()).toEqual([200, 409]);
    expect(updates.find(result => result.status === 409)!.body.error!.code).toBe('REVISION_CONFLICT');
    expect((await row()).snapshot.documents).toEqual([...original.snapshot.documents, (await row()).snapshot.documents[1]]);
    await assign(w.workspaceId, first.firstPage.documentId, studentA.id);
    const assigned = await request({action: 'open-workspace', workspaceId: w.workspaceId}, studentA);
    expect(assigned.status).toBe(200); expect(assigned.body.result.notebookSpace).toEqual({revision: 0, notebooks: []});
    expect(JSON.stringify(assigned.body)).not.toContain(first.title); expect(JSON.stringify(assigned.body)).not.toContain(first.sectionTitle);
    expect(JSON.stringify(assigned.body)).not.toContain(first.notebookId); expect(JSON.stringify(assigned.body)).not.toContain(second.firstPage.documentId);
    const before = await row();
    expect((await command(studentA, w.workspaceId, notebook(), 'notebook-command')).status).toBe(403);
    expect((await command(outsider, w.workspaceId, notebook(), 'notebook-command')).status).toBe(404);
    expect(await row()).toEqual(before);
    // The owner role is independent of teaching: a student can author a private notebook.
    const personal = await request({action: 'create-workspace', commandId: randomUUID(), title: 'Student notebook'}, studentA);
    expect(personal.status).toBe(200);
    const own = await command(studentA, personal.body.result.workspaceId, notebook(), 'notebook-command');
    expect(own.status).toBe(200); expect(own.body.result.receipt.notebookOwnerId).toBe(studentA.id);
    expect(own.body.result.projection.notebookSpace.notebooks).toHaveLength(1);
  });

  it('rolls back the entire snapshot, receipt and event when storage rejects the update', async () => {
    const w = await workspace(), doc = await lesson(w.workspaceId);
    const before = (await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0];
    await admin.query("CREATE FUNCTION ardesia_next.test_fail_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic write failure'; END $$");
    await admin.query('CREATE TRIGGER synthetic_failure BEFORE UPDATE ON ardesia_next.workspaces FOR EACH ROW EXECUTE FUNCTION ardesia_next.test_fail_write()');
    try {
      const result = await command(teacher, w.workspaceId, {kind: 'rename-document', commandId: randomUUID(), documentId: doc, expectedRevision: 1, title: 'never committed'});
      expect(result.status).toBe(503); expect(JSON.stringify(result.body)).not.toContain('synthetic write failure');
      expect((await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0]).toEqual(before);
      const composite = await command(teacher, w.workspaceId, notebook(), 'notebook-command');
      expect(composite.status).toBe(503);
      expect((await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0]).toEqual(before);
    } finally {
      await admin.query('DROP TRIGGER synthetic_failure ON ardesia_next.workspaces');
      await admin.query('DROP FUNCTION ardesia_next.test_fail_write()');
    }
  });

  it('checks revoked assignments before duplicate receipts or reads and honors evidence revocation', async () => {
    const w = await workspace(), doc = await lesson(w.workspaceId);
    await assign(w.workspaceId, doc, studentA.id);
    const saved = {kind: 'save-learner-note', commandId: randomUUID(), documentId: doc, expectedRevision: 0, text: 'Shared only deliberately'};
    expect((await command(studentA, w.workspaceId, saved, 'learning-command')).status).toBe(200);
    await command(studentA, w.workspaceId, {kind: 'share-learner-evidence', commandId: randomUUID(), documentId: doc, expectedRevision: 1, shared: true}, 'learning-command');
    const shared = await request({action: 'open-workspace', workspaceId: w.workspaceId}, teacher);
    expect(JSON.stringify(shared.body.result.learnerWork)).toContain(saved.text);
    await command(studentA, w.workspaceId, {kind: 'share-learner-evidence', commandId: randomUUID(), documentId: doc, expectedRevision: 2, shared: false}, 'learning-command');
    expect(JSON.stringify((await request({action: 'open-workspace', workspaceId: w.workspaceId}, teacher)).body)).not.toContain(saved.text);
    await command(teacher, w.workspaceId, {kind: 'revoke-assignment', commandId: randomUUID(), documentId: doc, studentId: studentA.id, expectedRevision: 1}, 'learning-command');
    expect((await command(studentA, w.workspaceId, saved, 'learning-command')).status).toBe(404);
    expect((await request({action: 'open-workspace', workspaceId: w.workspaceId}, studentA)).status).toBe(404);
  });

  it('preserves exact laboratory IDs/state across independent sessions and rejects stale plugin or consent use', async () => {
    const w = await workspace(), doc = await lesson(w.workspaceId); await install(w.workspaceId);
    const objectId = randomUUID(), instanceId = randomUUID();
    const add = await command(teacher, w.workspaceId, {kind: 'add-object', commandId: randomUUID(), documentId: doc, expectedRevision: 1,
      object: {id: objectId, type: 'lab', title: 'Molla', x: 0, y: 0, width: 300, height: 200, data: data(instanceId)}});
    expect(add.status).toBe(200); await assign(w.workspaceId, doc, studentA.id);
    expect((await command(studentA, w.workspaceId, {kind: 'consent-lab', commandId: randomUUID(), documentId: doc, expectedRevision: 0,
      objectId, releaseDigest: release.bundleDigest, capabilities: release.capabilities}, 'learning-command')).status).toBe(200);
    const save = {kind: 'save-learner-lab', commandId: randomUUID(), documentId: doc, expectedRevision: 1, expectedDocumentRevision: 2,
      objectId, instanceId, state: data(instanceId, 4).state};
    const saved = await command(studentA, w.workspaceId, save, 'learning-command'); expect(saved.status).toBe(200);
    const second = await signIn('a'); expect(second.cookie).not.toEqual(studentA.cookie);
    const recovered = await request({action: 'open-workspace', workspaceId: w.workspaceId}, second);
    expect(recovered.body.result.learnerWork[0].labs[0]).toMatchObject({objectId, revision: 1, data: {instanceId, state: data(instanceId, 4).state}});
    expect(recovered.body.result.learnerWork[0].revision).toBe(2);
    await command(studentA, w.workspaceId, {kind: 'revoke-lab-consent', commandId: randomUUID(), documentId: doc, expectedRevision: 2, objectId}, 'learning-command');
    const refused = await command(second, w.workspaceId, {...save, commandId: randomUUID(), expectedRevision: 3}, 'learning-command');
    expect(refused.body.error?.code).toBe('PLUGIN_CONSENT_REQUIRED');
    await command(teacher, w.workspaceId, {kind: 'disable-plugin', commandId: randomUUID(), pluginId: release.pluginId, expectedRevision: 3}, 'plugin-command');
    const stale = await command(teacher, w.workspaceId, {kind: 'activate-plugin', commandId: randomUUID(), pluginId: release.pluginId, expectedRevision: 3}, 'plugin-command');
    expect(stale.body.error?.code).toBe('REVISION_CONFLICT');
  });

  it('M4 Poiseuille PostgreSQL preserves exact revisions and private student state; rejects invalid writes and revocation', async () => {
    const manifest = JSON.parse(await readFile('apps/web/public/plugins/poiseuille/1.0.0/manifest.json', 'utf8'));
    const fluidRelease: PluginRelease = {pluginId: manifest.id, version: manifest.version, bundleDigest: manifest.integrity.digest,
      publisher: manifest.publisher, license: manifest.license, provenance: manifest.provenance, sdkVersion: manifest.sdkVersion,
      stateSchemaVersion: manifest.stateSchemaVersion, capabilities: manifest.capabilities};
    const fluidState = (forcing: Record<string, JsonValue>) => ({schemaVersion: '1.0.0', value: {
      radiusM: 0.001, lengthM: 1, viscosityPaS: 0.001, densityKgPerM3: 1000, ...forcing,
    }});
    for (const forcing of [{pressureDropPa: 800}, {flowRateM3PerS: Math.PI * 1e-7}] as Record<string, JsonValue>[]) {
      const w = await workspace('M4 two domains'), doc = await lesson(w.workspaceId);
      await install(w.workspaceId); await install(w.workspaceId, fluidRelease);
      const spring = {id: randomUUID(), type: 'lab', title: 'Molla', x: 0, y: 0, width: 300, height: 200, data: data(randomUUID())};
      expect((await command(teacher, w.workspaceId, {kind: 'add-object', commandId: randomUUID(), documentId: doc, expectedRevision: 1, object: spring})).status).toBe(200);
      const objectId = randomUUID(), instanceId = randomUUID();
      const fluid = {id: objectId, type: 'lab', title: 'Poiseuille', x: 0, y: 0, width: 300, height: 200,
        data: {pluginId: fluidRelease.pluginId, pluginVersion: fluidRelease.version, instanceId, stateSchemaVersion: '1.0.0',
          bundleDigest: fluidRelease.bundleDigest, publisher: fluidRelease.publisher, state: fluidState(forcing)}};
      expect((await command(teacher, w.workspaceId, {kind: 'add-object', commandId: randomUUID(), documentId: doc, expectedRevision: 2, object: fluid})).status).toBe(200);
      const before = (await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0];
      for (const state of [fluidState({...forcing, radiusM: -1}), {...fluid.data.state, schemaVersion: '2.0.0'}]) {
        const invalid = await command(teacher, w.workspaceId, {kind: 'replace-object', commandId: randomUUID(), documentId: doc, expectedRevision: 3,
          object: {...fluid, data: {...fluid.data, state}}});
        expect(invalid.status).toBeGreaterThanOrEqual(400);
        expect((await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0]).toEqual(before);
      }
      const changedState = fluidState('pressureDropPa' in forcing ? {pressureDropPa: 400} : {flowRateM3PerS: 2e-7});
      expect((await command(teacher, w.workspaceId, {kind: 'replace-object', commandId: randomUUID(), documentId: doc, expectedRevision: 3,
        object: {...fluid, data: {...fluid.data, state: changedState}}})).status).toBe(200);
      const stored = (await admin.query('SELECT snapshot FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0].snapshot;
      const recoveredCore = await createCore({storage: new MemoryStorage(CoreSnapshotSchema.parse(stored)), pluginPolicy: policy});
      const actor = (await request({action: 'open-workspace', workspaceId: w.workspaceId}, teacher)).body.result.actor;
      expect(recoveredCore.getObjectRevision(actor, doc, objectId, 1).data).toEqual(fluid.data);
      expect(recoveredCore.getObjectRevision(actor, doc, objectId, 2).data).toEqual({...fluid.data, state: changedState});
      const springBefore = recoveredCore.getObjectRevision(actor, doc, spring.id, 1);
      await assign(w.workspaceId, doc, studentA.id); await assign(w.workspaceId, doc, studentB.id);
      expect((await command(studentA, w.workspaceId, {kind: 'consent-lab', commandId: randomUUID(), documentId: doc, expectedRevision: 0,
        objectId, releaseDigest: fluidRelease.bundleDigest, capabilities: fluidRelease.capabilities}, 'learning-command')).status).toBe(200);
      const personalState = fluidState('pressureDropPa' in forcing ? {pressureDropPa: 200} : {flowRateM3PerS: 1e-7});
      const save = {kind: 'save-learner-lab', commandId: randomUUID(), documentId: doc, expectedRevision: 1, expectedDocumentRevision: 4,
        objectId, instanceId, state: personalState};
      expect((await command(studentA, w.workspaceId, save, 'learning-command')).status).toBe(200);
      const peerSession = await signIn('a');
      const reopened = (await request({action: 'open-workspace', workspaceId: w.workspaceId}, peerSession)).body.result;
      expect(reopened.learnerWork[0].labs[0]).toMatchObject({objectId, revision: 1, data: {...fluid.data, state: personalState}});
      for (const reader of [teacher, studentB]) {
        const view = (await request({action: 'open-workspace', workspaceId: w.workspaceId}, reader)).body.result;
        expect(view.learnerWork.flatMap((work: any) => work.labs)).toHaveLength(0);
      }
      expect((await command(studentA, w.workspaceId, {kind: 'revoke-lab-consent', commandId: randomUUID(), documentId: doc, expectedRevision: 2, objectId}, 'learning-command')).status).toBe(200);
      const revokedBefore = (await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0];
      expect((await command(peerSession, w.workspaceId, {...save, commandId: randomUUID(), expectedRevision: 3}, 'learning-command')).body.error?.code).toBe('PLUGIN_CONSENT_REQUIRED');
      expect((await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0]).toEqual(revokedBefore);
      expect((await command(teacher, w.workspaceId, {kind: 'revoke-plugin', commandId: randomUUID(), pluginId: fluidRelease.pluginId, expectedRevision: 3}, 'plugin-command')).status).toBe(200);
      const finalProjection = (await request({action: 'open-workspace', workspaceId: w.workspaceId}, teacher)).body.result;
      expect(finalProjection.documents[0].objects.find((object: any) => object.id === spring.id)).toEqual(springBefore);
      const unavailable = await command(teacher, w.workspaceId, {kind: 'replace-object', commandId: randomUUID(), documentId: doc, expectedRevision: 4, object: fluid});
      expect(unavailable.status).toBeGreaterThanOrEqual(400);
    }
  }, 30_000);

  it('rejects tampered releases and scientific states using the signed Host runtime', async () => {
    const w = await workspace(), doc = await lesson(w.workspaceId);
    const tampered = await command(teacher, w.workspaceId, {kind: 'install-plugin', commandId: randomUUID(), pluginId: release.pluginId, expectedRevision: 0,
      release: {...release, bundleDigest: 'f'.repeat(64)}}, 'plugin-command');
    expect(tampered.body.error?.code).toBe('PLUGIN_POLICY_REJECTED');
    await install(w.workspaceId);
    const invalid = await command(teacher, w.workspaceId, {kind: 'add-object', commandId: randomUUID(), documentId: doc, expectedRevision: 1,
      object: {id: randomUUID(), type: 'lab', title: 'Invalid mass', x: 0, y: 0, width: 300, height: 200, data: data(randomUUID(), -4)}});
    expect(invalid.body.error?.code).toBe('PLUGIN_POLICY_REJECTED');
  });

  it('serializes competing tutor bookings and payments, retains v7 bytes on reads and excludes students', async () => {
    const w = await workspace('Tutor private'), doc = await lesson(w.workspaceId);
    const row = (await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1',[w.workspaceId])).rows[0];
    const {notebookLibraries: _notebooks, tutorRecords: _tutor, ...old} = row.snapshot;
    const legacy = {...old,schemaVersion:7};
    await admin.query('UPDATE ardesia_next.workspaces SET snapshot=$1::jsonb WHERE id=$2',[JSON.stringify(legacy),w.workspaceId]);
    expect((await request({action:'open-workspace',workspaceId:w.workspaceId},teacher)).status).toBe(200);
    expect((await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1',[w.workspaceId])).rows[0]).toEqual({snapshot:legacy,revision:row.revision});
    const common={title:'Synthetic',notes:'PRIVATE_TUTOR_NOTE',custom:[]};
    const save=(recordId:string,input:unknown,expectedRevision=0)=>command(teacher,w.workspaceId,{kind:'save-tutor-record',commandId:randomUUID(),recordId,expectedRevision,input,reason:''},'tutor-command');
    expect((await save('person',{...common,kind:'contact',email:'',phone:'',archived:false})).status).toBe(200);
    const input={...common,kind:'appointment',startAt:'2026-01-01T09:00:00.000Z',endAt:'2026-01-01T10:00:00.000Z',timeZone:'Europe/Rome',status:'completed',currency:'EUR',participants:[{contactId:'person',attended:true,packageId:null,chargeMinor:3000}],groupId:null,requestId:null,lesson:{documentId:doc,revision:1}};
    const race=await Promise.all([save('slot-a',input),save('slot-b',input)]);
    expect(race.filter(r=>r.status===200)).toHaveLength(1);
    const targetId=race.find(r=>r.status===200)!.body.result.receipt.entityId;
    const cash={kind:'record-tutor-payment',recordId:'payment-a',expectedRevision:0,commandId:randomUUID(),targetId,targetRevision:1,contactId:'person',amountMinor:2000,paidAt:'2026-01-01T11:00:00.000Z',method:'Manual',reference:'',notes:''};
    const payments=await Promise.all([command(teacher,w.workspaceId,cash,'tutor-command'),command(teacher,w.workspaceId,{...cash,recordId:'payment-b',commandId:randomUUID()},'tutor-command')]);
    expect(payments.filter(r=>r.status===200)).toHaveLength(1);
    await assign(w.workspaceId,doc,studentA.id);
    const student=(await request({action:'open-workspace',workspaceId:w.workspaceId},studentA)).body.result;
    expect(student.tutorSpace).toEqual({records:[],history:[]});expect(JSON.stringify(student)).not.toContain('PRIVATE_TUTOR_NOTE');
    expect((await command(studentA,w.workspaceId,cash,'tutor-command')).status).toBe(403);
    expect((await command(outsider,w.workspaceId,cash,'tutor-command')).status).toBe(404);
    const stored=(await admin.query('SELECT snapshot FROM ardesia_next.workspaces WHERE id=$1',[w.workspaceId])).rows[0].snapshot;
    expect(stored.schemaVersion).toBe(11);expect(stored.events.slice(0,old.events.length)).toEqual(old.events);
    const reopened=(await request({action:'open-workspace',workspaceId:w.workspaceId},teacher)).body.result;
    expect(reopened.tutorSpace.records.filter((r:any)=>r.kind==='payment')).toHaveLength(1);
  });

  it('migrates stored v4 on read without writes and keeps feedback, source access and retries authorized', async () => {
    const w = await workspace('Feedback continuity'), doc = await lesson(w.workspaceId), objectId = randomUUID(), attemptId = randomUUID();
    expect((await command(teacher, w.workspaceId, {kind: 'add-object', commandId: randomUUID(), documentId: doc, expectedRevision: 1,
      object: {id: objectId, type: 'note', title: 'Energia elastica', x: 0, y: 0, width: 200, height: 100, data: {text: 'Raddoppia x: E = kx²/2'}}})).status).toBe(200);
    await assign(w.workspaceId, doc, studentA.id); await assign(w.workspaceId, doc, studentB.id);
    const attempt = {kind: 'record-learner-attempt', commandId: randomUUID(), documentId: doc, expectedRevision: 0, expectedDocumentRevision: 2, objectId, attemptId, answer: 'Raddoppia'};
    const saved = await command(studentA, w.workspaceId, attempt, 'learning-command'); expect(saved.status).toBe(200);
    await command(studentA, w.workspaceId, {kind: 'share-learner-evidence', commandId: randomUUID(), documentId: doc, expectedRevision: 1, shared: true}, 'learning-command');
    const previous = (await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0];
    const old = {...preCourse(previous.snapshot as CoreSnapshot), schemaVersion: 4};
    await admin.query('UPDATE ardesia_next.workspaces SET snapshot=$1::jsonb WHERE id=$2', [JSON.stringify(old), w.workspaceId]);
    expect((await request({action: 'open-workspace', workspaceId: w.workspaceId}, studentA)).status).toBe(200);
    expect((await command(studentA, w.workspaceId, attempt, 'learning-command')).body.result.receipt).toEqual(saved.body.result.receipt);
    expect((await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0]).toEqual({snapshot: old, revision: previous.revision});
    const source = {action: 'read-attempt-source', workspaceId: w.workspaceId, documentId: doc, attemptId, studentId: studentA.id};
    expect((await request(source, studentB)).status).toBe(404); expect((await request(source, outsider)).status).toBe(404);
    const review = {kind: 'review-learner-attempt', commandId: randomUUID(), documentId: doc, expectedRevision: 2, studentId: studentA.id,
      attemptId, feedbackId: randomUUID(), outcome: 'revise', comment: 'Controlla la potenza.', nextStep: 'Sostituisci 2x.'};
    const result = await command(teacher, w.workspaceId, review, 'learning-command'); expect(result.status).toBe(200);
    expect(result.body.result.projection.learnerWork[0].feedback[0]).toMatchObject({authorId: teacher.id, attemptId});
    const secondSession = await signIn('teacher');
    expect((await command(secondSession, w.workspaceId, review, 'learning-command')).body.result.receipt).toEqual(result.body.result.receipt);
    expect((await command(studentA, w.workspaceId, {...review, commandId: randomUUID()}, 'learning-command')).status).toBe(403);
    await command(teacher, w.workspaceId, {kind: 'remove-object', commandId: randomUUID(), documentId: doc, expectedRevision: 2, objectId});
    expect((await request(source, teacher)).body.result).toMatchObject({id: objectId, revision: 1, title: 'Energia elastica'});
    expect((await request(source, studentA)).body.result.data.text).toBe('Raddoppia x: E = kx²/2');
    await command(studentA, w.workspaceId, {kind: 'share-learner-evidence', commandId: randomUUID(), documentId: doc, expectedRevision: 3, shared: false}, 'learning-command');
    expect((await request(source, secondSession)).status).toBe(404);
    expect((await command(secondSession, w.workspaceId, review, 'learning-command')).status).toBe(404);
    expect((await request({action: 'open-workspace', workspaceId: w.workspaceId}, studentA)).body.result.learnerWork[0].feedback).toHaveLength(1);
    const stored = (await admin.query('SELECT snapshot FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0].snapshot;
    expect(stored.schemaVersion).toBe(11); expect(stored.events.slice(0, old.events.length)).toEqual(old.events);
    expect(stored.receipts.slice(0, old.receipts.length)).toEqual(old.receipts);
  });

  it('imports v1/v2/v3 explicitly into fresh containers and preserves original bytes, IDs and receipts', async () => {
    const localActor = {actorId: 'device-owner', role: 'teacher'} as const;
    const local = await createCore({storage: new MemoryStorage(), pluginPolicy: policy});
    await local.execute(localActor, {kind: 'create-document', commandId: 'local-create', documentId: 'local-doc', expectedRevision: 0, title: 'Imported'});
    const source = local.snapshot();
    for (const version of [1, 2, 3]) {
      const {assignments: _assignments, learnerWork: _learnerWork, installations, ...old} = preCourse(source);
      const raw = {...old, workspaceId: 'device-v' + version, schemaVersion: version, ...(version === 3 ? {installations} : {})};
      const snapshotText = JSON.stringify(raw, null, 2), commandId = randomUUID();
      const requestBody = {action: 'import-local', expectedAccountId: teacher.id, commandId, title: 'Import ' + version, snapshotText};
      const imported = await request(requestBody, teacher); expect(imported.status).toBe(200);
      expect(imported.body.result.actor.actorId).toBe('device-owner');
      expect(imported.body.result.documents[0].id).toBe('local-doc');
      const stored = (await admin.query('SELECT snapshot FROM ardesia_next.workspaces WHERE id=$1', [imported.body.result.workspaceId])).rows[0].snapshot;
      expect(stored.workspaceId).toBe(raw.workspaceId); expect(stored.receipts).toEqual(source.receipts);
      const archive = (await admin.query('SELECT original_text,semantic_digest FROM ardesia_next.import_archives WHERE workspace_id=$1', [imported.body.result.workspaceId])).rows[0];
      expect(archive.original_text).toBe(snapshotText);
      expect(archive.semantic_digest).toBe(hash(canonical({...preCourse(stored), schemaVersion: 4}))); // frozen pre-feedback import identity
      expect((await request(requestBody, teacher)).body.result.workspaceId).toBe(imported.body.result.workspaceId);
      expect((await request({...requestBody, commandId: randomUUID()}, teacher)).body.error?.code).toBe('IMPORT_ALREADY_EXISTS');
      expect((await request({...requestBody, snapshotText: JSON.stringify(raw), commandId: randomUUID()}, teacher)).body.error?.code).toBe('IMPORT_ALREADY_EXISTS');
      expect((await request({...requestBody, expectedAccountId: studentA.id, commandId: randomUUID()}, teacher)).body.error?.code).toBe('SESSION_CHANGED');
    }
  });

  it('reserves imported actor identities against later account provisioning',async()=>{
    const actorId='future-'+randomUUID(),local=await createCore({storage:new MemoryStorage()});
    await local.execute({actorId,role:'teacher'},{kind:'create-document',commandId:randomUUID(),documentId:randomUUID(),expectedRevision:0,title:'Private imported document'});
    const {assignments:_a,learnerWork:_w,...legacy}=preCourse(local.snapshot());
    const imported=await request({action:'import-local',expectedAccountId:teacher.id,commandId:randomUUID(),title:'Reserved identity',snapshotText:JSON.stringify({...legacy,schemaVersion:3})},teacher);
    expect(imported.status).toBe(200);
    await expect(provisionTestAccounts(admin,[{id:actorId,username:actorId,displayName:'Collision fixture',role:'student',password:passwords.a}])).rejects.toMatchObject({code:'IDENTITY_COLLISION'});
    expect((await admin.query('SELECT id FROM ardesia_next.accounts WHERE id=$1',[actorId])).rows).toEqual([]);
  });

  it('rejects an existing alias collision before listing or returning any private workspace data',async()=>{
    const actorId='collision-'+randomUUID(),local=await createCore({storage:new MemoryStorage()});
    const actor={actorId,role:'teacher'} as const,documentId=randomUUID();
    await local.execute(actor,{kind:'create-document',commandId:randomUUID(),documentId,expectedRevision:0,title:'PRIVATE_ALIAS_DOCUMENT'});
    const {assignments:_a,learnerWork:_w,...legacy}=preCourse(local.snapshot());
    const imported=await request({action:'import-local',expectedAccountId:teacher.id,commandId:randomUUID(),title:'PRIVATE_ALIAS_WORKSPACE',snapshotText:JSON.stringify({...legacy,schemaVersion:3})},teacher);
    expect(imported.status).toBe(200);const workspaceId=imported.body.result.workspaceId,courseId=randomUUID(),editionId=randomUUID();
    const input={title:'PRIVATE_ALIAS_COURSE',description:'Fixture',license:'Private',units:[{id:'unit',title:'Unit',objective:'Explain',prerequisites:'Units',explanation:'Model',prediction:'Predict',activity:'Try',referenceFeedback:'Compare',recovery:'Recover',transfer:'Apply',sources:[],lesson:{documentId,revision:1}}]};
    expect((await command(teacher,workspaceId,{kind:'save-course',commandId:randomUUID(),courseId,expectedRevision:0,input},'course-command')).status).toBe(200);
    expect((await command(teacher,workspaceId,{kind:'create-course-edition',commandId:randomUUID(),courseId,courseRevision:1,editionId,expectedRevision:0,label:'Private'},'course-command')).status).toBe(200);
    expect((await command(teacher,workspaceId,{kind:'assign-course',commandId:randomUUID(),editionId,deliveryId:randomUUID(),learnerId:actorId,expectedRevision:0},'course-command')).status).toBe(200);
    // Simulate a previously admitted collision using the isolated operator fixture.
    await admin.query("INSERT INTO ardesia_next.accounts(id,username,display_name,role,password_hash) SELECT $1,$1,'Old collision','student',password_hash FROM ardesia_next.accounts WHERE id=$2",[actorId,studentA.id]);
    try{
      const login=await request({action:'login',username:actorId,password:passwords.a});expect(login.status).toBe(200);
      const collision={id:actorId,cookie:login.cookie!.split(';')[0]!};
      const list=await request({action:'list-workspaces'},collision);expect(list.status).toBe(200);expect(JSON.stringify(list.body)).not.toContain('PRIVATE_ALIAS');
      for(const action of ['open-workspace','export-personal']){
        const result=await request({action,workspaceId},collision);expect(result.status).toBe(404);expect(JSON.stringify(result.body)).not.toContain('PRIVATE_ALIAS');
      }
      expect((await request({action:'read-course-lesson',workspaceId,editionId,unitId:'unit'},collision)).status).toBe(404);
      expect((await request({action:'open-workspace',workspaceId},teacher)).status).toBe(503);
    }finally{
      await admin.query('DELETE FROM ardesia_next.sessions WHERE account_id=$1',[actorId]);
      await admin.query('DELETE FROM ardesia_next.accounts WHERE id=$1',[actorId]);
    }
    expect((await request({action:'open-workspace',workspaceId},teacher)).body.result.documents[0].title).toBe('PRIVATE_ALIAS_DOCUMENT');
  });

  it('serializes racing account provisioning and legacy import without admitting an identity collision',async()=>{
    const actorId='race-'+randomUUID(),local=await createCore({storage:new MemoryStorage()});
    await local.execute({actorId,role:'teacher'},{kind:'create-document',commandId:randomUUID(),documentId:randomUUID(),expectedRevision:0,title:'Private concurrent import'});
    const {assignments:_a,learnerWork:_w,...legacy}=preCourse(local.snapshot());
    const [imported,provisioned]=await Promise.allSettled([
      request({action:'import-local',expectedAccountId:teacher.id,commandId:randomUUID(),title:'Concurrent identity',snapshotText:JSON.stringify({...legacy,schemaVersion:3})},teacher),
      provisionTestAccounts(admin,[{id:actorId,username:actorId,displayName:'Concurrent fixture',role:'student',password:passwords.a}]),
    ]);
    expect(imported.status).toBe('fulfilled');if(imported.status!=='fulfilled')throw imported.reason;
    try{
      if(imported.value.status===200){expect(provisioned).toMatchObject({status:'rejected',reason:{code:'IDENTITY_COLLISION'}});}
      else{expect(imported.value.body.error?.code).toBe('IMPORT_OWNER_COLLISION');expect(provisioned.status).toBe('fulfilled');}
      const overlap=await admin.query('SELECT a.id FROM ardesia_next.accounts a JOIN ardesia_next.owner_bindings b ON a.id=b.actor_id WHERE a.id=$1 AND b.account_id<>a.id',[actorId]);
      expect(overlap.rows).toEqual([]);
    }finally{if(provisioned.status==='fulfilled')await admin.query('DELETE FROM ardesia_next.accounts WHERE id=$1',[actorId]);}
  });

  it('preserves imported learner owner aliases and permits personal audio without a teaching role',async()=>{
    const actorId='learner-device-'+randomUUID(),local=await createCore({storage:new MemoryStorage()}),documentId=randomUUID();
    await local.execute({actorId,role:'teacher'},{kind:'create-document',commandId:randomUUID(),documentId,expectedRevision:0,title:'Il mio originale'});
    const {assignments:_a,learnerWork:_w,...legacy}=preCourse(local.snapshot()),snapshotText=JSON.stringify({...legacy,schemaVersion:3});
    const result=await request({action:'import-local',expectedAccountId:studentA.id,commandId:randomUUID(),title:'Import personale',snapshotText},studentA);
    expect(result.status).toBe(200);const w=result.body.result;
    expect(w).toMatchObject({access:'owner',actor:{actorId,role:'student'}});expect(w.documents[0]).toMatchObject({id:documentId,ownerId:actorId,revision:1});
    const recordingId=randomUUID(),bytes=Buffer.from('Synthetic learner media'),part={index:0,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
    const capture={format:'ardesia-recording-v1',recordingId,documentId,title:'Spiegazione personale',capturedAt:new Date().toISOString(),baseRevision:1,endRevision:1,durationMs:1000,mimeType:'audio/webm',parts:[part],timeline:[]};
    expect((await request({action:'recording-command',workspaceId:w.workspaceId,command:{kind:'prepare-recording',commandId:randomUUID(),recordingId,expectedRevision:0,capture}},studentA)).status).toBe(200);
    expect((await request({action:'put-recording-part',workspaceId:w.workspaceId,recordingId,index:0,base64:bytes.toString('base64')},studentA)).status).toBe(200);
    expect((await request({action:'recording-command',workspaceId:w.workspaceId,command:{kind:'finish-recording',commandId:randomUUID(),recordingId,expectedRevision:1}},studentA)).status).toBe(200);
    expect((await request({action:'read-recording',workspaceId:w.workspaceId,recordingId},studentA)).body.result.summary).toMatchObject({ownerId:actorId,status:'ready'});
    expect((await request({action:'read-recording',workspaceId:w.workspaceId,recordingId},teacher)).status).toBe(404);
    expect((await admin.query('SELECT original_text FROM ardesia_next.import_archives WHERE workspace_id=$1',[w.workspaceId])).rows[0].original_text).toBe(snapshotText);
  });

  it('withdraws device plugin consent through Core during import, requiring explicit remote reconsent', async () => {
    const actor = {actorId: 'device-modules', role: 'teacher'} as const;
    const local = await createCore({storage: new MemoryStorage(), pluginPolicy: policy});
    await local.executePlugin(actor, {kind: 'install-plugin', commandId: randomUUID(), pluginId: release.pluginId, expectedRevision: 0, release});
    await local.executePlugin(actor, {kind: 'consent-plugin', commandId: randomUUID(), pluginId: release.pluginId, expectedRevision: 1, releaseDigest: release.bundleDigest, capabilities: release.capabilities});
    await local.executePlugin(actor, {kind: 'activate-plugin', commandId: randomUUID(), pluginId: release.pluginId, expectedRevision: 2});
    const {assignments: _a, learnerWork: _w, ...legacy} = preCourse(local.snapshot());
    const response = await request({action: 'import-local', expectedAccountId: teacher.id, commandId: randomUUID(), title: 'Imported modules', snapshotText: JSON.stringify({...legacy, schemaVersion: 3})}, teacher);
    expect(response.status).toBe(200);
    expect(response.body.result.installations[0]).toMatchObject({status: 'disabled', consent: null, revision: 4});
    const snapshot = (await admin.query('SELECT snapshot FROM ardesia_next.workspaces WHERE id=$1', [response.body.result.workspaceId])).rows[0].snapshot as CoreSnapshot;
    expect(snapshot.receipts.slice(0, 3)).toEqual(legacy.receipts); expect(snapshot.events[3]?.type).toBe('withdraw-plugin-consent');
    expect(CoreSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it('rejects corrupt imports atomically without deleting any local source', async () => {
    const count = (await admin.query('SELECT count(*) FROM ardesia_next.workspaces')).rows[0].count;
    const response = await request({action: 'import-local', expectedAccountId: teacher.id, commandId: randomUUID(), title: 'Corrupt',
      snapshotText: JSON.stringify({schemaVersion: 3, workspaceId: 'bad', documents: [], events: [], receipts: [{commandId: 'orphan'}], installations: []})}, teacher);
    expect(response.body.error?.code).toBe('INVALID_SNAPSHOT');
    expect((await admin.query('SELECT count(*) FROM ardesia_next.workspaces')).rows[0].count).toBe(count);
  });

  it('stores exact recording bytes and transcripts through restricted HTTP transactions, with recovery, isolation and erasure', async () => {
    const space = await workspace('Audio fixture'), documentId = await lesson(space.workspaceId), recordingId = randomUUID();
    const bytes = Buffer.from('Synthetic media bytes for persistence tests only');
    const part = {index: 0, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
    const capture = {format: 'ardesia-recording-v1', recordingId, documentId, title: 'Audio sintetico', capturedAt: new Date().toISOString(),
      baseRevision: 1, endRevision: 1, durationMs: 2000, mimeType: 'audio/webm', parts: [part], timeline: []};
    const act = (command: unknown, identity = teacher) => request({action: 'recording-command', workspaceId: space.workspaceId, command}, identity);
    const prepare = {kind: 'prepare-recording', commandId: randomUUID(), recordingId, expectedRevision: 0, capture};
    expect((await act(prepare)).status).toBe(200);
    const finish = {kind: 'finish-recording', commandId: randomUUID(), recordingId, expectedRevision: 1};
    expect((await act(finish)).body.error?.code).toBe('INVALID_REFERENCE');
    const put = {action: 'put-recording-part', workspaceId: space.workspaceId, recordingId, index: 0, base64: bytes.toString('base64')};
    expect((await request({...put, base64: Buffer.from('tampered').toString('base64')}, teacher)).body.error?.code).toBe('INVALID_REFERENCE');
    expect((await request(put, teacher)).status).toBe(200); expect((await request(put, teacher)).status).toBe(200);
    expect((await act(finish)).body.result.state.summary.status).toBe('ready');
    const edit = {kind: 'edit-recording-transcript', commandId: randomUUID(), recordingId, expectedRevision: 2, origin: 'manual', cues: [{id: 'cue', fromMs: 0, toMs: 1500, text: 'Energia elastica'}]};
    const saved = await act(edit); expect(saved.status).toBe(200);
    const search = {action: 'search-recordings', workspaceId: space.workspaceId, documentId, query: 'ELASTICA'};
    const found = await request(search, teacher); expect(found.body.result.matches).toEqual([{recordingId, documentId, recordingRevision: 3, title: 'Audio sintetico', atMs: 0, transcriptRevision: 1, excerpt: 'Energia elastica'}]);
    // Discarded response, then a fresh request through the authority yields the original receipt.
    expect((await act(edit)).body.result.receipt).toEqual(saved.body.result.receipt);
    expect((await act({...edit, cues: []})).body.error?.code).toBe('IDEMPOTENCY_CONFLICT');
    await assign(space.workspaceId, documentId, studentA.id);
    for (const identity of [studentA, outsider]) {
      expect((await request(search, identity)).status).toBe(404);
      expect((await request({action: 'read-recording', workspaceId: space.workspaceId, recordingId}, identity)).status).toBe(404);
      expect((await request({action: 'read-recording-part', workspaceId: space.workspaceId, recordingId, index: 0}, identity)).status).toBe(404);
    }
    const media = await request({action: 'read-recording-part', workspaceId: space.workspaceId, recordingId, index: 0}, teacher);
    expect(media.body.result.base64).toBe(bytes.toString('base64'));
    const backup = await exportBackup(admin);
    expect(backup.data.recordings.some(row => row.id === recordingId)).toBe(true);
    expect(backup.data.recordingParts.find(row => row.recording_id === recordingId)?.base64).toBe(bytes.toString('base64'));
    const corrupt = structuredClone(backup); corrupt.data.recordingParts.find(row => row.recording_id === recordingId)!.base64 = Buffer.from('corrupt').toString('base64'); corrupt.sha256 = hash(canonical(corrupt.data));
    await expect(restoreBackup(admin, corrupt)).rejects.toMatchObject({code: 'INVALID_BACKUP'});
    const wrongDigest = structuredClone(backup); wrongDigest.data.recordings.find(row => row.id === recordingId)!.state.summary.mediaDigest = '0'.repeat(64); wrongDigest.sha256 = hash(canonical(wrongDigest.data));
    await expect(restoreBackup(admin, wrongDigest)).rejects.toMatchObject({code: 'INVALID_BACKUP'});
    const wrongCue = structuredClone(backup); wrongCue.data.recordings.find(row => row.id === recordingId)!.state.transcripts[0]!.cues[0]!.toMs = 5000; wrongCue.sha256 = hash(canonical(wrongCue.data));
    await expect(restoreBackup(admin, wrongCue)).rejects.toMatchObject({code: 'INVALID_BACKUP'});
    const erase = {kind: 'erase-recording', commandId: randomUUID(), recordingId, expectedRevision: 3};
    await admin.query("CREATE FUNCTION ardesia_next.fail_audio_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic delete failure'; END $$");
    await admin.query('CREATE TRIGGER fail_audio_delete BEFORE DELETE ON ardesia_next.recording_parts FOR EACH ROW EXECUTE FUNCTION ardesia_next.fail_audio_delete()');
    try {
      expect((await act(erase)).status).toBe(503);
      expect((await request({action: 'read-recording', workspaceId: space.workspaceId, recordingId}, teacher)).body.result.summary.status).toBe('ready');
    } finally {await admin.query('DROP TRIGGER fail_audio_delete ON ardesia_next.recording_parts'); await admin.query('DROP FUNCTION ardesia_next.fail_audio_delete()');}
    expect((await act(erase)).status).toBe(200); expect((await act(prepare)).body.result.state.summary.status).toBe('erased');
    expect((await request(put, teacher)).status).toBe(404);
    expect((await admin.query('SELECT count(*) FROM ardesia_next.recording_parts WHERE recording_id=$1', [recordingId])).rows[0].count).toBe('0');
    expect((await request({action: 'read-recording', workspaceId: space.workspaceId, recordingId}, teacher)).status).toBe(404);
    // Keep a ready recording for the following real restore round trip.
    const retainedId = randomUUID();
    await act({...prepare, commandId: randomUUID(), recordingId: retainedId, capture: {...capture, recordingId: retainedId}});
    await request({...put, recordingId: retainedId}, teacher); await act({...finish, commandId: randomUUID(), recordingId: retainedId});
  });

  it('stores immutable originals, enforces lesson authorization and revocation, validates backups and denies forged pages',async()=>{
    const space=await workspace('Material original'),documentId=await lesson(space.workspaceId),assetId=randomUUID();
    const bytes=Buffer.from('%PDF-1.7\nSynthetic integrity fixture only; rendering is covered by browser tests.');
    const digest=createHash('sha256').update(bytes).digest('hex');
    const manifest=MaterialManifestSchema.parse({format:'ardesia-material-v1',assetId,documentId,name:'Original.pdf',mimeType:'application/pdf',sha256:digest,bytes:bytes.length,license:'CC0',pages:[{width:600,height:800}],parts:[{index:0,bytes:bytes.length,sha256:digest}]});
    const base={workspaceId:space.workspaceId,assetId};
    expect((await request({action:'prepare-material',workspaceId:space.workspaceId,manifest},teacher)).status).toBe(200);
    expect((await request({action:'finish-material',...base},teacher)).status).toBe(422);
    expect((await request({action:'put-material-part',...base,index:0,base64:Buffer.from('bad').toString('base64')},teacher)).status).toBe(422);
    expect((await request({action:'put-material-part',...base,index:0,base64:bytes.toString('base64')},teacher)).status).toBe(200);
    expect((await request({action:'finish-material',...base},teacher)).body.result.status).toBe('ready');
    expect((await request({action:'finish-material',...base},teacher)).status).toBe(200);
    expect((await request({action:'prepare-material',workspaceId:space.workspaceId,manifest:{...manifest,name:'Changed.pdf'}},teacher)).status).toBe(409);
    const object={id:randomUUID(),type:'material',title:'Original',x:10,y:20,width:300,height:400,data:materialPage(manifest,1)};
    const add={kind:'add-object',commandId:randomUUID(),documentId,expectedRevision:1,object};
    expect((await command(teacher,space.workspaceId,{...add,object:{...object,data:{...object.data,sha256:'0'.repeat(64)}}})).status).toBe(422);
    expect((await command(teacher,space.workspaceId,add)).status).toBe(200);
    expect((await request({action:'read-material-part',...base,index:0},outsider)).status).toBe(404);
    await assign(space.workspaceId,documentId,studentA.id);
    expect((await request({action:'read-material-part',...base,index:0},studentA)).body.result.base64).toBe(bytes.toString('base64'));
    expect((await request({action:'put-material-part',...base,index:0,base64:bytes.toString('base64')},studentA)).status).toBe(404);
    await command(teacher,space.workspaceId,{kind:'revoke-assignment',commandId:randomUUID(),documentId,studentId:studentA.id,expectedRevision:1},'learning-command');
    expect((await request({action:'read-material-part',...base,index:0},studentA)).status).toBe(404);
    const courseId=randomUUID(),editionId=randomUUID(),unitId=randomUUID(),deliveryId=randomUUID();
    const unit={id:unitId,title:'Leggi la fonte',objective:'Osservare la fonte',prerequisites:'Saper leggere una pagina',explanation:'Il file conserva il contenuto originale',prediction:'Prevedi quali pagine saranno visibili',activity:'Apri la pagina autorizzata',referenceFeedback:'Confronta con il file originale',recovery:'Rileggi la prima pagina',transfer:'Ripeti con un altro documento',sources:[],lesson:{documentId,revision:2}};
    expect((await command(teacher,space.workspaceId,{kind:'save-course',commandId:randomUUID(),courseId,expectedRevision:0,input:{title:'Materiali nel corso',description:'',license:'CC0',units:[unit]}},'course-command')).status).toBe(200);
    expect((await command(teacher,space.workspaceId,{kind:'create-course-edition',commandId:randomUUID(),editionId,expectedRevision:0,courseId,courseRevision:1,label:'Fonte esatta'},'course-command')).status).toBe(200);
    expect((await command(teacher,space.workspaceId,{kind:'assign-course',commandId:randomUUID(),deliveryId,expectedRevision:0,editionId,learnerId:studentA.id},'course-command')).status).toBe(200);
    expect((await request({action:'read-material-part',...base,index:0,course:{editionId,unitId}},studentA)).body.result.base64).toBe(bytes.toString('base64'));
    expect((await request({action:'read-material-part',...base,index:0},studentA)).status).toBe(404);
    await command(teacher,space.workspaceId,{kind:'revoke-course-delivery',commandId:randomUUID(),deliveryId,expectedRevision:1},'course-command');
    expect((await request({action:'read-material-part',...base,index:0,course:{editionId,unitId}},studentA)).status).toBe(404);
    const backup=await exportBackup(admin);expect(backup.data.materialParts.find(p=>p.asset_id===assetId)?.base64).toBe(bytes.toString('base64'));
    const corrupt=structuredClone(backup);corrupt.data.materialParts.find(p=>p.asset_id===assetId)!.base64=Buffer.from('changed').toString('base64');corrupt.sha256=hash(canonical(corrupt.data));
    await expect(restoreBackup(admin,corrupt)).rejects.toMatchObject({code:'INVALID_BACKUP'});
    const missing=structuredClone(backup);missing.data.materials=missing.data.materials.filter(m=>m.id!==assetId);missing.data.materialParts=missing.data.materialParts.filter(p=>p.asset_id!==assetId);missing.sha256=hash(canonical(missing.data));
    await expect(restoreBackup(admin,missing)).rejects.toMatchObject({code:'INVALID_BACKUP'});
  });

  it('validates extension integrity before restoring even when the backup has no audio', async()=>{
    const fixture=await workspace('Extension backup fixture'),documentId=await lesson(fixture.workspaceId);
    const definition:ExtensionDefinition={format:'ardesia-extension/1',typeId:'backup.private-counter',version:1,name:'Contatore',description:'Prova di integrità',license:'CC0-1.0',renderer:'ardesia.composition/1',fallback:'Contatore',body:{fields:[{key:'count',label:'Conteggio',kind:'number',initial:1}],nodes:[{id:'result',kind:'value',props:{label:'Totale',expression:'count'}}]}};
    expect((await command(teacher,fixture.workspaceId,{kind:'add-object',commandId:randomUUID(),documentId,expectedRevision:1,object:{id:'counter',type:'extension',title:'Contatore',x:0,y:0,width:300,height:200,data:{definition,definitionDigest:await extensionDefinitionDigest(definition),state:{count:1}}}})).status).toBe(200);
    const backup=await exportBackup(admin);
    backup.data.recordings=[];backup.data.recordingParts=[];
    const saved=backup.data.workspaces.find(w=>w.id===fixture.workspaceId)!.snapshot.documents[0]!.objects[0]!;
    if(saved.type!=='extension')throw Error('Missing fixture');saved.data.definition.name='Altered after export';
    backup.sha256=hash(canonical(backup.data));
    await expect(restoreBackup(admin,backup)).rejects.toMatchObject({code:'INVALID_BACKUP'});
    const reopened=await request({action:'open-workspace',workspaceId:fixture.workspaceId},teacher);
    expect(reopened.body.result.documents[0].objects[0].data.definition.name).toBe('Contatore');
  });

  it('backs up and restores synthetic data into an empty database without passwords, sessions or overwrites', async () => {
    const fixture = await workspace('Backup restore fixture'), documentId = await lesson(fixture.workspaceId);
    const notebookFixture = await workspace('Notebook backup fixture'), book = notebook();
    expect((await command(teacher, notebookFixture.workspaceId, book, 'notebook-command')).status).toBe(200);
    await assign(fixture.workspaceId, documentId, studentA.id);
    expect((await command(studentA, fixture.workspaceId, {kind: 'save-learner-note', commandId: randomUUID(), documentId,
      expectedRevision: 0, text: 'Synthetic restore evidence'}, 'learning-command')).status).toBe(200);
    const backup = await exportBackup(admin);
    expect(backup.data.format).toBe('ardesia-server-backup-v4');
    expect(backup.data.accounts.every(account => account.disabled_at === null)).toBe(true);
    expect(JSON.stringify(backup)).not.toContain('password_hash'); expect(JSON.stringify(backup)).not.toContain('token_hash');
    const legacy = {data: {...backup.data, format: 'ardesia-server-backup-v1', accounts: backup.data.accounts.map(({disabled_at: _disabled, ...account}) => account)}, sha256: ''};
    legacy.sha256 = hash(canonical(legacy.data));
    await expect(restoreBackup(admin, legacy)).rejects.toMatchObject({code: 'BACKUP_ACCOUNT_STATE_REQUIRED'});
    const incomplete = {data: {...legacy.data, format: 'ardesia-server-backup-v2'}, sha256: ''};
    incomplete.sha256 = hash(canonical(incomplete.data));
    await expect(restoreBackup(admin, incomplete)).rejects.toMatchObject({code: 'INVALID_BACKUP'});
    await expect(exportBackup(runtime)).rejects.toMatchObject({code: 'OPERATOR_REQUIRED'});
    await expect(restoreBackup(admin, backup)).rejects.toMatchObject({code: 'RESTORE_TARGET_NOT_EMPTY'});
    const missingIdentity = structuredClone(backup);
    missingIdentity.data.accounts = missingIdentity.data.accounts.filter(account => account.id !== studentA.id);
    missingIdentity.sha256 = hash(canonical(missingIdentity.data));
    await expect(restoreBackup(admin, missingIdentity)).rejects.toMatchObject({code: 'INVALID_BACKUP'});
    const database = 'm3_restore_' + randomUUID().replaceAll('-', '');
    await admin.query(`CREATE DATABASE ${database}`);
    const url = new URL(connectionString!); url.pathname = '/' + database;
    const restorePool = new Pool({connectionString: url.toString()});
    try {
      await migrate(restorePool);
      await provisionTestAccounts(restorePool, Object.entries(ids).map(([key, id]) => ({id, username: id, displayName: id,
        role: key === 'a' || key === 'b' ? 'student' : 'teacher', password: passwords[key as keyof typeof passwords]})));
      const alias=backup.data.bindings.find(binding=>binding.actor_id!==binding.account_id)!;
      expect(alias).toBeDefined();
      const sourceCollision=structuredClone(backup);
      sourceCollision.data.accounts.push({id:alias.actor_id,role:'student',disabled_at:null});
      sourceCollision.sha256=hash(canonical(sourceCollision.data));
      await expect(restoreBackup(restorePool,sourceCollision)).rejects.toMatchObject({code:'INVALID_BACKUP'});
      await provisionTestAccounts(restorePool,[{id:alias.actor_id,username:'target-collision',displayName:'Target collision',role:'student',password:passwords.a}]);
      await expect(restoreBackup(restorePool,backup)).rejects.toMatchObject({code:'IDENTITY_COLLISION'});
      expect((await restorePool.query('SELECT count(*) FROM ardesia_next.workspaces')).rows[0].count).toBe('0');
      await restorePool.query('DELETE FROM ardesia_next.accounts WHERE id=$1',[alias.actor_id]);
      const historical = JSON.parse(JSON.stringify(backup));
      const oldRow = historical.data.workspaces.find((row: any) => row.id === fixture.workspaceId);
      oldRow.snapshot = {...preCourse(oldRow.snapshot), schemaVersion: 4};
      // A checksum computed after migration is not a checksum of the original backup.
      await expect(restoreBackup(restorePool, historical)).rejects.toMatchObject({code: 'INVALID_BACKUP'});
      historical.sha256 = hash(canonical(historical.data));
      const result = await restoreBackup(restorePool, historical); expect(result.workspaces).toBe(backup.data.workspaces.length);
      const restored = await exportBackup(restorePool);
      expect(restored.data.workspaces).toEqual(backup.data.workspaces); expect(restored.data.imports).toEqual(backup.data.imports);
      const notebookRow = restored.data.workspaces.find(row => row.id === notebookFixture.workspaceId)!;
      const notebookCore = await createCore({storage: new MemoryStorage(notebookRow.snapshot)});
      expect(notebookCore.getNotebookSpace({actorId: teacher.id, role: 'teacher'}).notebooks[0]!.id).toBe(book.notebookId);
      const retry = await notebookCore.executeNotebook({actorId: teacher.id, role: 'teacher'}, book);
      expect(retry).toEqual(notebookRow.snapshot.receipts[0]); expect(notebookCore.snapshot()).toEqual(notebookRow.snapshot);
      expect(restored.data.creationReceipts).toEqual(backup.data.creationReceipts);
      expect(restored.data.accounts).toEqual(backup.data.accounts);
      expect(restored.data.materials).toEqual(backup.data.materials); expect(restored.data.materialParts).toEqual(backup.data.materialParts);
      expect(restored.data.recordings).toEqual(backup.data.recordings); expect(restored.data.recordingParts).toEqual(backup.data.recordingParts);
      const changed = structuredClone(backup); changed.data.workspaces[0]!.title = 'altered';
      await expect(restoreBackup(restorePool, changed)).rejects.toMatchObject({code: 'INVALID_BACKUP'});
    } finally {await restorePool.end(); await admin.query(`DROP DATABASE ${database}`);}
  }, 30_000);

  it('restores disabled source accounts and never re-enables disabled targets, with session revocation in the same transaction', async () => {
    const suffix = randomUUID().slice(0, 8);
    const suspendedSource = 'suspended-source-' + suffix, suspendedTarget = 'suspended-target-' + suffix;
    const sourcePassword = randomUUID() + randomUUID(), targetPassword = randomUUID() + randomUUID();
    await provisionTestAccounts(admin, [
      {id: suspendedSource, username: suspendedSource, displayName: 'Disabled source', role: 'student', password: sourcePassword},
      {id: suspendedTarget, username: suspendedTarget, displayName: 'Disabled target', role: 'student', password: targetPassword},
    ]);
    const sourceDisabledAt = '2026-10-01T08:00:00.000Z', targetDisabledAt = '2026-10-02T09:00:00.000Z';
    await admin.query('UPDATE ardesia_next.accounts SET disabled_at=$2 WHERE id=$1', [suspendedSource, sourceDisabledAt]);
    const backup = await exportBackup(admin);
    expect(backup.data.accounts.find(account => account.id === suspendedSource)?.disabled_at).toBe(sourceDisabledAt);
    expect(backup.data.accounts.find(account => account.id === suspendedTarget)?.disabled_at).toBeNull();
    const altered = structuredClone(backup);
    altered.data.accounts.find(account => account.id === suspendedSource)!.disabled_at = null;
    await expect(restoreBackup(admin, altered)).rejects.toMatchObject({code: 'INVALID_BACKUP'});

    const database = 'm3_restore_' + randomUUID().replaceAll('-', '');
    await admin.query(`CREATE DATABASE ${database}`);
    const url = new URL(connectionString!); url.pathname = '/' + database;
    const restorePool = createDatabasePool(url.toString());
    let restoredRuntime: Pool | undefined;
    try {
      await migrate(restorePool);
      const credentials = new Map<string, string>(Object.entries(ids).map(([key, id]) => [id, passwords[key as keyof typeof passwords]]));
      credentials.set(suspendedSource, sourcePassword); credentials.set(suspendedTarget, targetPassword);
      await provisionTestAccounts(restorePool, backup.data.accounts.map(account => ({id: account.id, username: account.id,
        displayName: account.id, role: account.role, password: credentials.get(account.id)!})));
      url.username = runtimeRole; restoredRuntime = createDatabasePool(url.toString());
      const restoredHandler = createApiHandler({store: createPostgresStore({pool: restoredRuntime, pluginPolicy: policy}), allowedOrigins: [origin]});
      const sessions: Identity[] = [];
      for (const [id, password] of [[suspendedSource, sourcePassword], [suspendedTarget, targetPassword]] as const) {
        const signedIn = await request({action: 'login', username: id, password}, undefined, {}, restoredHandler);
        expect(signedIn.status).toBe(200); sessions.push({id, cookie: signedIn.cookie!.split(';')[0]!});
      }
      await restorePool.query('UPDATE ardesia_next.accounts SET disabled_at=$2 WHERE id=$1', [suspendedTarget, targetDisabledAt]);
      await restorePool.query("CREATE FUNCTION ardesia_next.reject_restore() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic restore failure'; END $$");
      await restorePool.query('CREATE TRIGGER synthetic_restore_failure BEFORE INSERT ON ardesia_next.workspaces FOR EACH ROW EXECUTE FUNCTION ardesia_next.reject_restore()');
      await expect(restoreBackup(restorePool, backup)).rejects.toThrow('synthetic restore failure');
      expect((await restorePool.query('SELECT disabled_at FROM ardesia_next.accounts WHERE id=$1', [suspendedSource])).rows[0].disabled_at).toBeNull();
      expect((await restorePool.query('SELECT count(*) FROM ardesia_next.workspaces')).rows[0].count).toBe('0');
      expect((await restorePool.query('SELECT revoked_at FROM ardesia_next.sessions')).rows.every(row => row.revoked_at === null)).toBe(true);
      await restorePool.query('DROP TRIGGER synthetic_restore_failure ON ardesia_next.workspaces');
      await restorePool.query('DROP FUNCTION ardesia_next.reject_restore()');

      await restoreBackup(restorePool, backup);
      for (const [id, expected] of [[suspendedSource, sourceDisabledAt], [suspendedTarget, targetDisabledAt]]) {
        expect((await restorePool.query('SELECT disabled_at FROM ardesia_next.accounts WHERE id=$1', [id])).rows[0].disabled_at.toISOString()).toBe(expected);
      }
      expect((await restorePool.query('SELECT revoked_at FROM ardesia_next.sessions')).rows.every(row => row.revoked_at !== null)).toBe(true);
      for (const session of sessions) expect((await request({action: 'session'}, session, {}, restoredHandler)).status).toBe(401);
      for (const [id, password] of [[suspendedSource, sourcePassword], [suspendedTarget, targetPassword]]) {
        expect((await request({action: 'login', username: id, password}, undefined, {}, restoredHandler)).status).toBe(401);
      }
      const restored = await exportBackup(restorePool);
      expect(restored.data.workspaces).toEqual(backup.data.workspaces);
      expect(restored.data.accounts.find(account => account.id === suspendedSource)?.disabled_at).toBe(sourceDisabledAt);
      expect(restored.data.accounts.find(account => account.id === suspendedTarget)?.disabled_at).toBe(targetDisabledAt);
    } finally {await restoredRuntime?.end(); await restorePool.end(); await admin.query(`DROP DATABASE ${database}`);}
  }, 30_000);

  it('rejects expired, revoked and logged-out sessions before reads or retries', async () => {
    const extra = await signIn('b');
    const out = await request({action: 'logout'}, extra); expect(out.status).toBe(200); expect(out.cookie).toContain('Max-Age=0');
    expect((await request({action: 'session'}, extra)).status).toBe(401);
    await revokeAccountSessions(admin, outsider.id);
    expect((await request({action: 'session'}, outsider)).status).toBe(401);
    await admin.query("UPDATE ardesia_next.sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE account_id=$1", [studentB.id]);
    expect((await request({action: 'list-workspaces'}, studentB)).status).toBe(401);
  });

  it('isolates project login budgets while fresh sessions keep identity and the thirteenth valid login stays forbidden', async () => {
    const suffix = randomUUID().slice(0, 8), password = randomUUID() + randomUUID();
    const env = Object.fromEntries(['TEACHER', 'STUDENT_A', 'STUDENT_B'].flatMap(kind => [
      [`ARDESIA_E2E_${kind}_USERNAME`, `${kind.toLowerCase().replaceAll('_', '-')}-${suffix}`],
      [`ARDESIA_E2E_${kind}_PASSWORD`, password],
    ]));
    const accounts = localBrowserAccounts(env).filter(account => account.id.startsWith('student-a-m3-'))
      .map(account => ({...account, id: `${account.id}-${suffix}`}));
    await provisionTestAccounts(admin, accounts);
    expect(new Set(accounts.map(account => account.id)).size).toBe(2);
    for (const account of accounts) {
      const cookies = new Set<string>();
      for (let attempt = 1; attempt <= 12; attempt++) {
        // Each login has no Cookie header. Identity survives logout/new session, not cookie reuse.
        const login = await request({action: 'login', username: account.username, password});
        expect(login.status).toBe(200); expect(login.body.result.account.id).toBe(account.id);
        expect(cookies.has(login.cookie!)).toBe(false); cookies.add(login.cookie!);
        const identity = {id: account.id, cookie: login.cookie!.split(';')[0]!};
        expect((await request({action: 'session'}, identity)).body.result.account.id).toBe(account.id);
        await request({action: 'logout'}, identity);
        expect((await request({action: 'session'}, identity)).status).toBe(401);
      }
      const denied = await request({action: 'login', username: account.username, password});
      expect(denied.status).toBe(429); expect(denied.body.error?.code).toBe('RATE_LIMITED');
      expect((await admin.query('SELECT attempts FROM ardesia_next.login_limits WHERE bucket=$1', ['user:' + hash(account.username)])).rows[0].attempts).toBe(13);
    }
  }, 15_000);

  it('applies durable rate limits and fails closed when the service is not configured', async () => {
    const bucket = 'nonexistent-' + randomUUID().slice(0, 8);
    for (let index = 0; index < 12; index++) expect((await request({action: 'login', username: bucket, password: 'wrong'})).status).toBe(401);
    expect((await request({action: 'login', username: bucket, password: 'wrong'})).status).toBe(429);
    const closed = createApiHandler({store: null, allowedOrigins: [origin]});
    const response = await closed(new Request(origin + '/api/m3', {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json'}, body: JSON.stringify({action: 'session'})}));
    expect(response.status).toBe(503); expect((await response.json()).error.code).toBe('SERVICE_UNAVAILABLE');
  }, 15_000);
});

// Model historical envelopes with exactly their old fields, not a relabelled v7 snapshot.
function preCourse<T extends object>(snapshot: T) {
  const {notebookLibraries: _notebooks, tutorRecords: _t, courses: _c, courseEditions: _e, courseDeliveries: _d, courseWork: _w, ...legacy} = snapshot as T & {notebookLibraries?: unknown; tutorRecords?: unknown; courses?: unknown; courseEditions?: unknown; courseDeliveries?: unknown; courseWork?: unknown};
  return legacy;
}
