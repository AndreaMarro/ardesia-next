import type {Pool} from 'pg';
import {z} from 'zod';
import {CoreSnapshotSchema, migrateSnapshotForOpen} from '@ardesia/contracts';
import {hash, transaction} from './database';
import {canonical, ServerError} from './errors';

const id = z.string().min(1).max(200);
const stamp = z.iso.datetime();
const Digest = z.string().regex(/^[0-9a-f]{64}$/);
const BackupDataSchema = z.object({
  format: z.literal('ardesia-server-backup-v2'), exportedAt: stamp,
  accounts: z.array(z.object({id, role: z.enum(['teacher', 'student']), disabled_at: stamp.nullable()}).strict()).max(10_000),
  workspaces: z.array(z.object({id, owner_account_id: id, title: z.string().min(1).max(240),
    revision: z.number().int().positive().safe(), snapshot: CoreSnapshotSchema, created_at: stamp, updated_at: stamp}).strict()).max(10_000),
  bindings: z.array(z.object({workspace_id: id, account_id: id, actor_id: id}).strict()).max(10_000),
  imports: z.array(z.object({workspace_id: id, account_id: id, digest: Digest, semantic_digest: Digest, original_text: z.string().max(2_000_000),
    source_version: z.number().int().min(1).max(3), source_workspace_id: id, created_at: stamp}).strict()).max(10_000),
  creationReceipts: z.array(z.object({account_id: id, command_id: id, fingerprint: Digest, workspace_id: id}).strict()).max(20_000),
}).strict();
export type BackupData = z.infer<typeof BackupDataSchema>;
export interface ServerBackup {data: BackupData; sha256: string;}

async function requireOperator(client: import('pg').PoolClient) {
  const row = await client.query("SELECT has_table_privilege(current_user,'ardesia_next.accounts','INSERT') AS allowed");
  if (!row.rows[0]?.allowed) throw new ServerError('OPERATOR_REQUIRED', 'Backup and restore require the provisioning connection.', 403);
}

/** Explicit operator export. Password hashes, sessions and login counters are never exported. */
export async function exportBackup(pool: Pool): Promise<ServerBackup> {
  return transaction(pool, async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await requireOperator(client);
    const accounts = await client.query('SELECT id,role,disabled_at FROM ardesia_next.accounts ORDER BY id');
    const workspaces = await client.query('SELECT id,owner_account_id,title,revision,snapshot,created_at,updated_at FROM ardesia_next.workspaces ORDER BY id');
    const bindings = await client.query('SELECT workspace_id,account_id,actor_id FROM ardesia_next.owner_bindings ORDER BY workspace_id');
    const imports = await client.query('SELECT workspace_id,account_id,digest,semantic_digest,original_text,source_version,source_workspace_id,created_at FROM ardesia_next.import_archives ORDER BY workspace_id');
    const receipts = await client.query('SELECT account_id,command_id,fingerprint,workspace_id FROM ardesia_next.creation_receipts ORDER BY account_id,command_id');
    const data = BackupDataSchema.parse({format: 'ardesia-server-backup-v2', exportedAt: new Date().toISOString(),
      accounts: accounts.rows.map(row => ({...row, disabled_at: row.disabled_at?.toISOString() ?? null})),
      workspaces: workspaces.rows.map(row => ({...row, revision: Number(row.revision), created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString()})),
      bindings: bindings.rows,
      imports: imports.rows.map(row => ({...row, created_at: row.created_at.toISOString()})), creationReceipts: receipts.rows,
    });
    return {data, sha256: hash(canonical(data))};
  });
}

/** Explicit restore into an empty, already migrated database with independently provisioned accounts. */
export async function restoreBackup(pool: Pool, input: unknown): Promise<{workspaces: number; imports: number}> {
  if (typeof input === 'object' && input !== null && 'data' in input
    && typeof input.data === 'object' && input.data !== null && 'format' in input.data
    && input.data.format === 'ardesia-server-backup-v1') {
    throw new ServerError('BACKUP_ACCOUNT_STATE_REQUIRED', 'Backup v1 does not record disabled accounts. Export a v2 backup before restoring; account state is never inferred.', 422);
  }
  const envelope = z.object({data: BackupDataSchema, sha256: Digest}).strict().safeParse(input);
  if (!envelope.success || hash(canonical(envelope.data.data)) !== envelope.data.sha256) {
    throw new ServerError('INVALID_BACKUP', 'The backup checksum or data contract is invalid.', 422);
  }
  const {data} = envelope.data;
  const accounts = new Map(data.accounts.map(account => [account.id, account.role]));
  if (accounts.size !== data.accounts.length) throw new ServerError('INVALID_BACKUP', 'The backup contains duplicate account identities.', 422);
  const workspaceIds = new Set(data.workspaces.map(workspace => workspace.id));
  if (workspaceIds.size !== data.workspaces.length || data.bindings.length !== data.workspaces.length
    || new Set(data.bindings.map(binding => binding.workspace_id)).size !== data.bindings.length) {
    throw new ServerError('INVALID_BACKUP', 'The backup contains duplicate or missing workspace bindings.', 422);
  }
  for (const workspace of data.workspaces) {
    const binding = data.bindings.find(entry => entry.workspace_id === workspace.id);
    if (!binding || binding.account_id !== workspace.owner_account_id || accounts.get(workspace.owner_account_id) !== 'teacher'
      || workspace.snapshot.documents.some(document => document.ownerId !== binding.actor_id)
      || workspace.snapshot.installations.some(installation => installation.ownerId !== binding.actor_id)
      || workspace.snapshot.assignments.some(assignment => accounts.get(assignment.studentId) !== 'student')
      || workspace.snapshot.learnerWork.some(work => accounts.get(work.studentId) !== 'student')) {
      throw new ServerError('INVALID_BACKUP', 'The backup owner binding does not match its Core data.', 422);
    }
  }
  for (const archive of data.imports) {
    let semantic: unknown;
    try {semantic = CoreSnapshotSchema.parse(migrateSnapshotForOpen(JSON.parse(archive.original_text)));}
    catch {throw new ServerError('INVALID_BACKUP', 'An imported archive has invalid Core contents.', 422);}
    if (hash(archive.original_text) !== archive.digest || !workspaceIds.has(archive.workspace_id)
      || hash(canonical(semantic)) !== archive.semantic_digest
      || !data.workspaces.some(workspace => workspace.id === archive.workspace_id && workspace.owner_account_id === archive.account_id)) {
      throw new ServerError('INVALID_BACKUP', 'An imported source archive failed integrity verification.', 422);
    }
  }
  if (data.creationReceipts.some(receipt => !data.workspaces.some(workspace => workspace.id === receipt.workspace_id && workspace.owner_account_id === receipt.account_id))) {
    throw new ServerError('INVALID_BACKUP', 'A creation receipt does not belong to its workspace owner.', 422);
  }
  return transaction(pool, async client => {
    await requireOperator(client);
    // Restore is an explicit operation on an empty target. Lock accounts before workspaces,
    // matching authentication order, so no login can race the disabled-state restoration.
    await client.query('LOCK TABLE ardesia_next.accounts, ardesia_next.workspaces IN ACCESS EXCLUSIVE MODE');
    const existing = await client.query('SELECT id FROM ardesia_next.workspaces LIMIT 1');
    if (existing.rowCount) throw new ServerError('RESTORE_TARGET_NOT_EMPTY', 'Restore never overwrites an existing workspace.', 409);
    for (const account of data.accounts) {
      const present = await client.query('SELECT role FROM ardesia_next.accounts WHERE id=$1 FOR UPDATE', [account.id]);
      if (!present.rows[0] || present.rows[0].role !== account.role) throw new ServerError('RESTORE_ACCOUNTS_REQUIRED', 'Provision the exact account IDs and roles before restoring data.', 409);
    }
    for (const account of data.accounts) {
      const restored = await client.query('UPDATE ardesia_next.accounts SET disabled_at=COALESCE(disabled_at,$2::timestamptz) WHERE id=$1 RETURNING disabled_at', [account.id, account.disabled_at]);
      if (restored.rows[0].disabled_at !== null) {
        await client.query('UPDATE ardesia_next.sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE account_id=$1', [account.id]);
      }
    }
    for (const workspace of data.workspaces) {
      await client.query(`INSERT INTO ardesia_next.workspaces(id,owner_account_id,title,revision,snapshot,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`, [workspace.id, workspace.owner_account_id, workspace.title, workspace.revision,
        JSON.stringify(workspace.snapshot), workspace.created_at, workspace.updated_at]);
    }
    for (const binding of data.bindings) await client.query('INSERT INTO ardesia_next.owner_bindings(workspace_id,account_id,actor_id) VALUES ($1,$2,$3)', [binding.workspace_id, binding.account_id, binding.actor_id]);
    for (const archive of data.imports) await client.query(`INSERT INTO ardesia_next.import_archives(workspace_id,account_id,digest,semantic_digest,original_text,source_version,source_workspace_id,created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [archive.workspace_id, archive.account_id, archive.digest, archive.semantic_digest, archive.original_text,
      archive.source_version, archive.source_workspace_id, archive.created_at]);
    for (const receipt of data.creationReceipts) await client.query('INSERT INTO ardesia_next.creation_receipts(account_id,command_id,fingerprint,workspace_id) VALUES ($1,$2,$3,$4)',
      [receipt.account_id, receipt.command_id, receipt.fingerprint, receipt.workspace_id]);
    return {workspaces: data.workspaces.length, imports: data.imports.length};
  });
}
