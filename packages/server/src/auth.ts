import {randomBytes, randomUUID, scrypt, timingSafeEqual} from 'node:crypto';
import type {Pool, PoolClient} from 'pg';
import {hash, transaction} from './database';
import {ServerError, unauthenticated} from './errors';
import type {Account, Session} from './types';

const PASSWORD_N = 131_072;
const PASSWORD_R = 8;
const PASSWORD_P = 1;
const DUMMY = `scrypt$${PASSWORD_N}$${PASSWORD_R}$${PASSWORD_P}$${'00'.repeat(16)}$${'00'.repeat(64)}`;
const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,63}$/;
let activeDerivations = 0;
const derivationQueue: (() => void)[] = [];

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (activeDerivations >= 2) {
    if (derivationQueue.length >= 16) throw new ServerError('RATE_LIMITED', 'Too many concurrent sign-in attempts. Try again later.', 429);
    await new Promise<void>(resolve => derivationQueue.push(resolve));
  } else activeDerivations += 1;
  try {
    return await new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64,
      {N: PASSWORD_N, r: PASSWORD_R, p: PASSWORD_P, maxmem: 256 * 1024 * 1024},
      (error, result) => error ? reject(error) : resolve(result)));
  } finally {
    const next = derivationQueue.shift();
    if (next) next(); else activeDerivations -= 1;
  }
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 16 || password.length > 256) throw new ServerError('INVALID_PASSWORD', 'Provision a password of 16–256 characters.');
  const salt = randomBytes(16), derived = await derive(password, salt);
  return `scrypt$${PASSWORD_N}$${PASSWORD_R}$${PASSWORD_P}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function checkPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt' || Number(parts[1]) !== PASSWORD_N
    || Number(parts[2]) !== PASSWORD_R || Number(parts[3]) !== PASSWORD_P
    || !/^[0-9a-f]{32}$/.test(parts[4]!) || !/^[0-9a-f]{128}$/.test(parts[5]!)) return false;
  const candidate = await derive(password, Buffer.from(parts[4]!, 'hex'));
  return timingSafeEqual(candidate, Buffer.from(parts[5]!, 'hex'));
}

/** No HTTP signup/role endpoint exists. This requires the migration/provisioning connection. */
export async function provisionTestAccounts(pool: Pool, accounts: readonly {
  id?: string; username: string; displayName: string; role: 'teacher' | 'student'; password: string;
}[]): Promise<Account[]> {
  const prepared = await Promise.all(accounts.map(async input => {
    if (!usernamePattern.test(input.username) || !input.displayName.trim() || input.displayName.length > 120
      || !['teacher', 'student'].includes(input.role)) throw new ServerError('INVALID_ACCOUNT', 'The provisioned account does not satisfy the account contract.');
    return {...input, id: input.id ?? randomUUID(), encoded: await hashPassword(input.password)};
  }));
  return transaction(pool, async client => {
    const result: Account[] = [];
    for (const input of prepared) {
      await client.query('INSERT INTO ardesia_next.accounts(id,username,display_name,role,password_hash) VALUES ($1,$2,$3,$4,$5)',
        [input.id, input.username, input.displayName, input.role, input.encoded]);
      result.push({id: input.id, displayName: input.displayName, role: input.role});
    }
    return result;
  });
}

/** Failure counters commit independently; an unsuccessful login never rolls them back. */
async function checkLoginRate(pool: Pool, username: string): Promise<void> {
  const allowed = await transaction(pool, async client => {
    let result = true;
    for (const limit of [{key: 'global', seconds: 60, maximum: 80}, {key: 'user:' + hash(username), seconds: 900, maximum: 12}]) {
      const row = await client.query(`INSERT INTO ardesia_next.login_limits(bucket,attempts) VALUES ($1,1)
        ON CONFLICT (bucket) DO UPDATE SET
          attempts = CASE WHEN ardesia_next.login_limits.started_at < now() - $2 * interval '1 second' THEN 1 ELSE ardesia_next.login_limits.attempts + 1 END,
          started_at = CASE WHEN ardesia_next.login_limits.started_at < now() - $2 * interval '1 second' THEN now() ELSE ardesia_next.login_limits.started_at END
        RETURNING attempts`, [limit.key, limit.seconds]);
      if (Number(row.rows[0].attempts) > limit.maximum) result = false;
    }
    await client.query("DELETE FROM ardesia_next.login_limits WHERE started_at < now() - interval '1 day'");
    return result;
  });
  if (!allowed) throw new ServerError('RATE_LIMITED', 'Too many sign-in attempts. Try again later.', 429);
}

export async function login(pool: Pool, username: string, password: string, lifetimeSeconds: number, oldToken?: string): Promise<Session & {token: string}> {
  await checkLoginRate(pool, username);
  const candidates = await pool.query('SELECT id,username,display_name,role,password_hash,disabled_at FROM ardesia_next.accounts WHERE username = $1', [username]);
  const account = candidates.rows[0];
  const valid = await checkPassword(password, account?.password_hash ?? DUMMY);
  if (!account || !valid || account.disabled_at !== null) throw new ServerError('INVALID_CREDENTIALS', 'The sign-in details are not valid.', 401);
  return transaction(pool, async client => {
    const checked = await client.query('SELECT id,display_name,role,password_hash,disabled_at FROM ardesia_next.accounts WHERE id = $1 FOR UPDATE', [account.id]);
    const current = checked.rows[0];
    if (!current || current.disabled_at !== null || current.password_hash !== account.password_hash) throw unauthenticated();
    await client.query('UPDATE ardesia_next.accounts SET last_login_at=now() WHERE id=$1', [account.id]);
    if (oldToken && /^[0-9a-f]{64}$/.test(oldToken)) await client.query('UPDATE ardesia_next.sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [hash(oldToken)]);
    const token = randomBytes(32).toString('hex');
    const created = await client.query(`INSERT INTO ardesia_next.sessions(token_hash,account_id,expires_at)
      VALUES ($1,$2,now() + $3 * interval '1 second') RETURNING expires_at`, [hash(token), current.id, lifetimeSeconds]);
    return {token, account: {id: current.id, role: current.role, displayName: current.display_name}, expiresAt: created.rows[0].expires_at.toISOString()};
  });
}

/** Hold account/session row locks until the data transaction commits, including before receipt retries. */
export async function authenticate(client: PoolClient, token: string | undefined, expectedAccountId?: string, exclusiveSession = false): Promise<Session> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) throw unauthenticated();
  const result = await client.query(`SELECT a.id,a.display_name,a.role,s.expires_at
    FROM ardesia_next.sessions s JOIN ardesia_next.accounts a ON a.id=s.account_id
    WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now() AND a.disabled_at IS NULL
    ${exclusiveSession ? 'FOR SHARE OF a FOR UPDATE OF s' : 'FOR SHARE OF a,s'}`, [hash(token)]);
  const row = result.rows[0];
  if (!row) throw unauthenticated();
  if (expectedAccountId !== undefined && row.id !== expectedAccountId) {
    throw new ServerError('SESSION_CHANGED', 'The signed-in account changed. Discard the old view and reopen your area.', 409);
  }
  return {account: {id: row.id, role: row.role, displayName: row.display_name}, expiresAt: row.expires_at.toISOString()};
}

/** Operator-only revocation; the API permits each account to log out its own session. */
export async function revokeAccountSessions(pool: Pool, accountId: string): Promise<void> {
  await transaction(pool, async client => {
    await client.query('UPDATE ardesia_next.sessions SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL', [accountId]);
  });
}
