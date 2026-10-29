import {beforeAll, afterAll, describe, expect, it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {checkServerIdentity} from 'node:tls';
import {Client, type PoolConfig} from 'pg';
import {createDatabasePool, hash} from './database';
import {canonical} from './errors';
import {CoreSnapshotSchema, type CoreSnapshot, type PluginRelease} from '@ardesia/contracts';
import {createCore, MemoryStorage} from '@ardesia/core';
import {idealSpringInitialState} from '@ardesia/ideal-spring';
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
async function lesson(workspaceId: string) {
  const documentId = randomUUID();
  const response = await command(teacher, workspaceId, {kind: 'create-document', commandId: randomUUID(), documentId, expectedRevision: 0, title: 'Lesson'});
  expect(response.status).toBe(200); return documentId;
}
async function assign(workspaceId: string, documentId: string, studentId: string) {
  const response = await command(teacher, workspaceId, {kind: 'assign-lesson', commandId: randomUUID(), documentId, studentId, expectedRevision: 0}, 'learning-command');
  expect(response.status).toBe(200);
}
async function install(workspaceId: string) {
  for (const spec of [
    {kind: 'install-plugin', expectedRevision: 0, release},
    {kind: 'consent-plugin', expectedRevision: 1, releaseDigest: release.bundleDigest, capabilities: release.capabilities},
    {kind: 'activate-plugin', expectedRevision: 2},
  ]) {
    const response = await command(teacher, workspaceId, {...spec, pluginId: release.pluginId, commandId: randomUUID()}, 'plugin-command');
    expect(response.status).toBe(200);
  }
}

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
    expect((await request({action: 'create-workspace', title: 'forbidden', commandId: randomUUID()}, studentA)).status).toBe(403);
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

  it('rolls back the entire snapshot, receipt and event when storage rejects the update', async () => {
    const w = await workspace(), doc = await lesson(w.workspaceId);
    const before = (await admin.query('SELECT snapshot,revision FROM ardesia_next.workspaces WHERE id=$1', [w.workspaceId])).rows[0];
    await admin.query("CREATE FUNCTION ardesia_next.test_fail_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic write failure'; END $$");
    await admin.query('CREATE TRIGGER synthetic_failure BEFORE UPDATE ON ardesia_next.workspaces FOR EACH ROW EXECUTE FUNCTION ardesia_next.test_fail_write()');
    try {
      const result = await command(teacher, w.workspaceId, {kind: 'rename-document', commandId: randomUUID(), documentId: doc, expectedRevision: 1, title: 'never committed'});
      expect(result.status).toBe(503); expect(JSON.stringify(result.body)).not.toContain('synthetic write failure');
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

  it('imports v1/v2/v3 explicitly into fresh containers and preserves original bytes, IDs and receipts', async () => {
    const localActor = {actorId: 'device-owner', role: 'teacher'} as const;
    const local = await createCore({storage: new MemoryStorage(), pluginPolicy: policy});
    await local.execute(localActor, {kind: 'create-document', commandId: 'local-create', documentId: 'local-doc', expectedRevision: 0, title: 'Imported'});
    const source = local.snapshot();
    for (const version of [1, 2, 3]) {
      const {assignments: _assignments, learnerWork: _learnerWork, installations, ...old} = source;
      const raw = {...old, workspaceId: 'device-v' + version, schemaVersion: version, ...(version === 3 ? {installations} : {})};
      const snapshotText = JSON.stringify(raw, null, 2), commandId = randomUUID();
      const requestBody = {action: 'import-local', expectedAccountId: teacher.id, commandId, title: 'Import ' + version, snapshotText};
      const imported = await request(requestBody, teacher); expect(imported.status).toBe(200);
      expect(imported.body.result.actor.actorId).toBe('device-owner');
      expect(imported.body.result.documents[0].id).toBe('local-doc');
      const stored = (await admin.query('SELECT snapshot FROM ardesia_next.workspaces WHERE id=$1', [imported.body.result.workspaceId])).rows[0].snapshot;
      expect(stored.workspaceId).toBe(raw.workspaceId); expect(stored.receipts).toEqual(source.receipts);
      const archive = (await admin.query('SELECT original_text FROM ardesia_next.import_archives WHERE workspace_id=$1', [imported.body.result.workspaceId])).rows[0];
      expect(archive.original_text).toBe(snapshotText);
      expect((await request(requestBody, teacher)).body.result.workspaceId).toBe(imported.body.result.workspaceId);
      expect((await request({...requestBody, commandId: randomUUID()}, teacher)).body.error?.code).toBe('IMPORT_ALREADY_EXISTS');
      expect((await request({...requestBody, snapshotText: JSON.stringify(raw), commandId: randomUUID()}, teacher)).body.error?.code).toBe('IMPORT_ALREADY_EXISTS');
      expect((await request({...requestBody, expectedAccountId: studentA.id, commandId: randomUUID()}, teacher)).body.error?.code).toBe('SESSION_CHANGED');
    }
  });

  it('withdraws device plugin consent through Core during import, requiring explicit remote reconsent', async () => {
    const actor = {actorId: 'device-modules', role: 'teacher'} as const;
    const local = await createCore({storage: new MemoryStorage(), pluginPolicy: policy});
    await local.executePlugin(actor, {kind: 'install-plugin', commandId: randomUUID(), pluginId: release.pluginId, expectedRevision: 0, release});
    await local.executePlugin(actor, {kind: 'consent-plugin', commandId: randomUUID(), pluginId: release.pluginId, expectedRevision: 1, releaseDigest: release.bundleDigest, capabilities: release.capabilities});
    await local.executePlugin(actor, {kind: 'activate-plugin', commandId: randomUUID(), pluginId: release.pluginId, expectedRevision: 2});
    const {assignments: _a, learnerWork: _w, ...legacy} = local.snapshot();
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

  it('backs up and restores synthetic data into an empty database without passwords, sessions or overwrites', async () => {
    const fixture = await workspace('Backup restore fixture'), documentId = await lesson(fixture.workspaceId);
    await assign(fixture.workspaceId, documentId, studentA.id);
    expect((await command(studentA, fixture.workspaceId, {kind: 'save-learner-note', commandId: randomUUID(), documentId,
      expectedRevision: 0, text: 'Synthetic restore evidence'}, 'learning-command')).status).toBe(200);
    const backup = await exportBackup(admin);
    expect(backup.data.format).toBe('ardesia-server-backup-v2');
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
      const result = await restoreBackup(restorePool, backup); expect(result.workspaces).toBe(backup.data.workspaces.length);
      const restored = await exportBackup(restorePool);
      expect(restored.data.workspaces).toEqual(backup.data.workspaces); expect(restored.data.imports).toEqual(backup.data.imports);
      expect(restored.data.creationReceipts).toEqual(backup.data.creationReceipts);
      expect(restored.data.accounts).toEqual(backup.data.accounts);
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

  it('applies durable rate limits and fails closed when the service is not configured', async () => {
    const bucket = 'nonexistent-' + randomUUID().slice(0, 8);
    for (let index = 0; index < 12; index++) expect((await request({action: 'login', username: bucket, password: 'wrong'})).status).toBe(401);
    expect((await request({action: 'login', username: bucket, password: 'wrong'})).status).toBe(429);
    const closed = createApiHandler({store: null, allowedOrigins: [origin]});
    const response = await closed(new Request(origin + '/api/m3', {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json'}, body: JSON.stringify({action: 'session'})}));
    expect(response.status).toBe(503); expect((await response.json()).error.code).toBe('SERVICE_UNAVAILABLE');
  }, 15_000);
});
