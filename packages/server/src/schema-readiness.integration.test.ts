import {describe, expect, it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Pool} from 'pg';
import {hash} from './database';
import {migrations} from './migrations';
import {createApiHandler, createFirstPartyPolicy, createPostgresStore, migrate, provisionTestAccounts} from './index';

const origin = 'https://ardesia-readiness.test';
const upgradeCode = 'SERVICE_UPGRADE_REQUIRED';
const migrationDirectory = new URL('../migrations/', import.meta.url);
type Fixture = {
  operator: Pool; runtime: Pool; password: string; username: string;
  handler: ReturnType<typeof createApiHandler>;
};

/** Each case owns its database and login role; only the supplied loopback cluster is used. */
async function withDatabase(schema: 'initial' | 'complete', run: (fixture: Fixture) => Promise<void>) {
  const configured = process.env.M3_TEST_DATABASE_URL;
  if (!configured) throw Error('M3_TEST_DATABASE_URL is required; readiness needs real PostgreSQL.');
  const address = new URL(configured);
  if (!['localhost', '127.0.0.1'].includes(address.hostname) || !address.pathname.endsWith('_test')) {
    throw Error('Readiness fixtures require a dedicated loopback *_test database.');
  }
  const suffix = randomUUID().replaceAll('-', ''), database = `readiness_${suffix}_test`, role = `readiness_${suffix}`;
  const control = new Pool({connectionString: configured});
  let operator: Pool | undefined, runtime: Pool | undefined, databaseCreated = false, roleCreated = false;
  try {
    await control.query(`CREATE DATABASE ${database} ENCODING 'UTF8' TEMPLATE template0`); databaseCreated = true;
    address.pathname = '/' + database;
    operator = new Pool({connectionString: address.href});
    if (schema === 'complete') await migrate(operator);
    else {
      // Reproduce SQL001 as actually deployed, including no runtime metadata grant.
      const sql = await readFile(new URL('001_initial.sql', migrationDirectory), 'utf8');
      await operator.query(sql);
      await operator.query('CREATE TABLE ardesia_next.schema_migrations (version integer PRIMARY KEY,digest text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
      await operator.query('REVOKE ALL ON ardesia_next.schema_migrations FROM PUBLIC');
      await operator.query('INSERT INTO ardesia_next.schema_migrations(version,digest) VALUES (1,$1)', [hash(sql)]);
    }
    const username = 'readiness-teacher', password = randomUUID() + randomUUID();
    await provisionTestAccounts(operator, [{id: username, username, displayName: 'Synthetic readiness teacher', role: 'teacher', password}]);
    await control.query(`CREATE ROLE ${role} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`); roleCreated = true;
    await control.query(`GRANT ardesia_next_runtime TO ${role}`);
    address.username = role; address.password = '';
    runtime = new Pool({connectionString: address.href});
    const handler = createApiHandler({store: createPostgresStore({pool: runtime,
      pluginPolicy: createFirstPartyPolicy({artifactRoot: resolve('apps/web/public')})}), allowedOrigins: [origin]});
    await run({operator, runtime, username, password, handler});
  } finally {
    await runtime?.end(); await operator?.end();
    if (databaseCreated) await control.query(`DROP DATABASE ${database} WITH (FORCE)`);
    if (roleCreated) await control.query(`DROP ROLE ${role}`);
    await control.end();
  }
}

async function post(f: Fixture, body: unknown, cookie?: string, extra: Record<string, string> = {}) {
  return f.handler(new Request(origin + '/api/m3', {method: 'POST',
    headers: {Origin: origin, 'Content-Type': 'application/json',
      ...(cookie ? {Cookie: cookie, 'X-Ardesia-Account': f.username} : {}), ...extra}, body: JSON.stringify(body)}));
}
function health(f: Fixture) {return f.handler(new Request(origin + '/api/m3'));}
function login(f: Fixture) {return post(f, {action: 'login', username: f.username, password: f.password});}
async function rejected(response: Response) {
  expect(response.status).toBe(503);
  expect(Boolean(response.headers.get('set-cookie'))).toBe(false);
  const body = await response.json();
  expect(body).toEqual({ok: false, error: {code: upgradeCode,
    message: 'The service requires a database update before it can accept changes. Saved data has not been modified.'}});
}
async function counts(f: Fixture) {
  return (await f.operator.query(`SELECT (SELECT count(*) FROM ardesia_next.workspaces) AS workspaces,
    (SELECT count(*) FROM ardesia_next.sessions) AS sessions,
    (SELECT count(*) FROM ardesia_next.login_limits) AS login_limits,
    (SELECT last_login_at FROM ardesia_next.accounts LIMIT 1) AS last_login_at`)).rows[0];
}

describe('Runtime database readiness uses canonical migrations', () => {
  it('uses the exact checked-in SQL bytes and includes every numbered migration', async () => {
    const names = (await readdir(migrationDirectory)).filter(name => /^\d+_.*\.sql$/.test(name)).sort();
    expect(migrations).toHaveLength(names.length);
    for (const [index, name] of names.entries()) {
      const bytes = await readFile(new URL(name, migrationDirectory), 'utf8');
      expect(migrations[index]).toEqual({version: Number(name.slice(0, 3)), sql: bytes, digest: hash(bytes)});
    }
  });

  it('refuses real SQL001 before login or writes, then opens only after an explicit operator migration', async () => {
    await withDatabase('initial', async f => {
      const before = await counts(f);
      await rejected(await health(f)); await rejected(await login(f));
      expect(await counts(f)).toEqual(before);
      expect((await f.operator.query('SELECT version FROM ardesia_next.schema_migrations ORDER BY version')).rows).toEqual([{version: 1}]);
      expect((await f.operator.query("SELECT to_regclass('ardesia_next.materials') IS NULL AS absent")).rows[0].absent).toBe(true);

      await migrate(f.operator);
      expect((await health(f)).status).toBe(200);
      const signedIn = await login(f); expect(signedIn.status).toBe(200);
      const cookie = signedIn.headers.get('set-cookie')!.split(';')[0]!;
      const created = await post(f, {action: 'create-workspace', title: 'Readiness upgrade', commandId: randomUUID()}, cookie);
      expect(created.status).toBe(200);
      const projection = (await created.json()).result;
      const reopened = await post(f, {action: 'open-workspace', workspaceId: projection.workspaceId}, cookie);
      expect(reopened.status).toBe(200); expect((await reopened.json()).result.workspaceId).toBe(projection.workspaceId);
      expect((await f.operator.query("SELECT snapshot->>'schemaVersion' AS version FROM ardesia_next.workspaces")).rows).toEqual([{version: '11'}]);
    });
  });

  it('grants restricted runtime only metadata reads, never migration or identity writes', async () => {
    await withDatabase('complete', async f => {
      expect((await health(f)).status).toBe(200);
      expect((await f.runtime.query('SELECT version,digest FROM ardesia_next.schema_migrations')).rowCount).toBe(migrations.length);
      const rights = (await f.runtime.query(`SELECT
        has_column_privilege(current_user,'ardesia_next.schema_migrations','version','SELECT') AS read_version,
        has_column_privilege(current_user,'ardesia_next.schema_migrations','digest','SELECT') AS read_digest,
        has_table_privilege(current_user,'ardesia_next.schema_migrations','INSERT') AS insert_migration,
        has_table_privilege(current_user,'ardesia_next.schema_migrations','UPDATE') AS update_migration,
        has_table_privilege(current_user,'ardesia_next.schema_migrations','DELETE') AS delete_migration,
        has_schema_privilege(current_user,'ardesia_next','CREATE') AS create_schema_object,
        has_table_privilege(current_user,'ardesia_next.accounts','INSERT') AS create_account,
        has_column_privilege(current_user,'ardesia_next.accounts','password_hash','UPDATE') AS change_password`)).rows[0];
      expect(rights).toEqual({read_version: true, read_digest: true, insert_migration: false, update_migration: false,
        delete_migration: false, create_schema_object: false, create_account: false, change_password: false});
      await expect(f.runtime.query('UPDATE ardesia_next.schema_migrations SET digest=digest')).rejects.toMatchObject({code: '42501'});
    });
  });

  it('rechecks drift after a healthy response and rejects existing sessions without leaking registry values', async () => {
    await withDatabase('complete', async f => {
      expect((await health(f)).status).toBe(200);
      const signedIn = await login(f); expect(signedIn.status).toBe(200);
      const cookie = signedIn.headers.get('set-cookie')!.split(';')[0]!;
      const before = await counts(f);
      await f.operator.query('UPDATE ardesia_next.schema_migrations SET digest=$1 WHERE version=2', ['untrusted-digest-do-not-expose']);
      await rejected(await health(f)); await rejected(await login(f));
      await rejected(await post(f, {action: 'session'}, cookie));
      await rejected(await post(f, {action: 'create-workspace', title: 'Must not exist', commandId: randomUUID()}, cookie));
      expect(await counts(f)).toEqual(before);
    });
  });

  it('refuses missing and newer registry entries instead of treating the highest version as sufficient', async () => {
    await withDatabase('complete', async f => {
      const old = (await f.operator.query('DELETE FROM ardesia_next.schema_migrations WHERE version=3 RETURNING version,digest')).rows[0];
      await rejected(await health(f));
      await f.operator.query('INSERT INTO ardesia_next.schema_migrations(version,digest) VALUES ($1,$2)', [old.version, old.digest]);
      expect((await health(f)).status).toBe(200);
      await f.operator.query('INSERT INTO ardesia_next.schema_migrations(version,digest) VALUES ($1,$2)', [migrations.length + 1, 'future-migration']);
      await rejected(await health(f));
      await expect(migrate(f.operator)).rejects.toMatchObject({code: 'MIGRATION_DRIFT'});
    });
  });

  it('still revokes an authenticated session during an upgrade without permitting data writes', async () => {
    await withDatabase('complete', async f => {
      const signedIn = await login(f); expect(signedIn.status).toBe(200);
      const cookie = signedIn.headers.get('set-cookie')!.split(';')[0]!;
      await f.operator.query('DELETE FROM ardesia_next.schema_migrations WHERE version=3');
      await rejected(await post(f, {action: 'create-workspace', title: 'Blocked', commandId: randomUUID()}, cookie));
      const signedOut = await post(f, {action: 'logout'}, cookie);
      expect(signedOut.status).toBe(200); expect(await signedOut.json()).toEqual({ok: true, result: {signedOut: true}});
      expect(signedOut.headers.get('set-cookie')?.includes('Max-Age=0')).toBe(true);
      const reopened = await post(f, {action: 'session'}, cookie);
      expect(reopened.status).toBe(401); expect((await reopened.json()).error.code).toBe('UNAUTHENTICATED');
      expect((await f.operator.query('SELECT count(*) FROM ardesia_next.sessions WHERE revoked_at IS NULL')).rows[0].count).toBe('0');
    });
  });

  it('keeps origin, strict request and unauthenticated rejection ahead of database readiness', async () => {
    await withDatabase('initial', async f => {
      const anonymous = await post(f, {action: 'session'});
      expect(anonymous.status).toBe(401); expect((await anonymous.json()).error.code).toBe('UNAUTHENTICATED');
      const foreign = await post(f, {action: 'session'}, undefined, {Origin: 'https://other.example'});
      expect(foreign.status).toBe(403); expect((await foreign.json()).error.code).toBe('ORIGIN_REJECTED');
      const forged = await post(f, {action: 'session', role: 'teacher'});
      expect(forged.status).toBe(400); expect((await forged.json()).error.code).toBe('INVALID_REQUEST');
      expect((await counts(f)).sessions).toBe('0');
    });
  });
});
