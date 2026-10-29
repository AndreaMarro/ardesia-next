import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {isIP} from 'node:net';
import {checkServerIdentity, type ConnectionOptions} from 'node:tls';
import {Pool, type PoolClient, type PoolConfig} from 'pg';
import {ServerError} from './errors';

export {Pool};
export type {PoolClient};
export const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

function secureConnection(connectionString: string, configured: PoolConfig['ssl']): {connectionString: string; ssl?: PoolConfig['ssl']} {
  let url: URL;
  try {url = new URL(connectionString);} catch {throw new ServerError('DATABASE_CONFIGURATION_INVALID', 'Configure an explicit PostgreSQL database URL.', 503);}
  const host = (url.searchParams.getAll('host').at(-1) || url.hostname).replace(/^\[(.*)\]$/, '$1');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !host) {
    throw new ServerError('DATABASE_CONFIGURATION_INVALID', 'Configure an explicit PostgreSQL host.', 503);
  }
  const loopback = host === 'localhost' || host === '::1' || (isIP(host) === 4 && host.startsWith('127.'));
  if (loopback) return {connectionString, ...(configured === undefined ? {} : {ssl: configured})};
  const reject = () => new ServerError('DATABASE_TLS_REQUIRED', 'Remote PostgreSQL requires certificate and hostname verification. Use verify-full or a trusted CA.', 503);
  if (url.searchParams.getAll('sslmode').some(value => value !== 'verify-full')
    || url.searchParams.getAll('ssl').some(value => !['true', '1'].includes(value))
    || configured === false || (configured !== undefined && configured !== true && (typeof configured !== 'object' || configured === null))) throw reject();
  const ssl: ConnectionOptions = typeof configured === 'object' && configured !== null ? {...configured} : {};
  if (ssl.rejectUnauthorized === false || (ssl.checkServerIdentity && ssl.checkServerIdentity !== checkServerIdentity)
    || (ssl.host !== undefined && ssl.host !== host) || (ssl.servername !== undefined && ssl.servername !== host)) throw reject();
  try {
    for (const [parameter, field] of [['sslrootcert', 'ca'], ['sslcert', 'cert'], ['sslkey', 'key']] as const) {
      const path = url.searchParams.getAll(parameter).at(-1);
      if (path !== undefined) ssl[field] = readFileSync(path, 'utf8');
    }
  } catch {throw new ServerError('DATABASE_CONFIGURATION_INVALID', 'The configured PostgreSQL TLS material cannot be read.', 503);}
  // pg lets SSL URL parameters replace the entire options.ssl object. Remove them only after
  // validation/loading, then supply the verified options explicitly so neither URL nor env can downgrade TLS.
  for (const parameter of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) url.searchParams.delete(parameter);
  return {connectionString: url.toString(), ssl: {...ssl, host, rejectUnauthorized: true, checkServerIdentity}};
}

export function createDatabasePool(connectionString: string, options: Omit<PoolConfig, 'connectionString'> = {}): Pool {
  if (!connectionString) throw new ServerError('SERVICE_UNAVAILABLE', 'A dedicated database is not configured.', 503);
  const connection = secureConnection(connectionString, options.ssl);
  const pool = new Pool({max: 5, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 10_000,
    application_name: 'ardesia-next-m3', ...options, ...connection});
  // Pool background errors have no request to reject. Do not log credentials or SQL parameters.
  pool.on('error', () => {});
  return pool;
}

export async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '15000ms'");
    await client.query("SET LOCAL lock_timeout = '8000ms'");
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* The original failure remains authoritative. */ }
    throw error;
  } finally { client.release(); }
}

/** Operator-only, explicit migration. No request handler calls this function. */
export async function migrate(pool: Pool): Promise<{version: 1; digest: string}> {
  const sql = await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8');
  const digest = hash(sql);
  return transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('ardesia-next-migrations', 0))");
    const legacy = await client.query("SELECT to_regclass('public.study_resources') IS NOT NULL OR to_regclass('public.study_principals') IS NOT NULL AS present");
    if (legacy.rows[0]?.present) throw new ServerError('LEGACY_DATABASE_REFUSED', 'Use a dedicated Ardesia Next database; the legacy database was not changed.', 409);
    await client.query('CREATE SCHEMA IF NOT EXISTS ardesia_next');
    await client.query('REVOKE ALL ON SCHEMA ardesia_next FROM PUBLIC');
    await client.query('CREATE TABLE IF NOT EXISTS ardesia_next.schema_migrations (version integer PRIMARY KEY, digest text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    await client.query('REVOKE ALL ON ardesia_next.schema_migrations FROM PUBLIC');
    const applied = await client.query('SELECT digest FROM ardesia_next.schema_migrations WHERE version = 1');
    if (applied.rows[0]) {
      if (applied.rows[0].digest !== digest) throw new ServerError('MIGRATION_DRIFT', 'The applied migration differs from the reviewed SQL.', 409);
    } else {
      await client.query(sql);
      await client.query('INSERT INTO ardesia_next.schema_migrations(version,digest) VALUES (1,$1)', [digest]);
    }
    return {version: 1, digest};
  });
}
