import {verifyMaterialBytes} from './materials';
import type {Pool} from 'pg';
import {z} from 'zod';
import {CoreSnapshotSchema, migrateSnapshotForOpen, MaterialStateSchema, EducationalObjectSchema, RecordingStateSchema, type RecordingState} from '@ardesia/contracts';
import {createCore, validateMaterialReference, validateRecordingCapture} from '@ardesia/core';
import {mediaHash} from './recordings';
import {hash, transaction} from './database';
import {canonical, ServerError} from './errors';
import {parseLegacyImport} from './legacy-import';

const id = z.string().min(1).max(200);
const stamp = z.iso.datetime();
const Digest = z.string().regex(/^[0-9a-f]{64}$/);
const LegacyBackupDataSchema = z.object({
  format: z.literal('ardesia-server-backup-v2'), exportedAt: stamp,
  accounts: z.array(z.object({id, role: z.enum(['teacher', 'student']), disabled_at: stamp.nullable()}).strict()).max(10_000),
  workspaces: z.array(z.object({id, owner_account_id: id, title: z.string().min(1).max(240),
    revision: z.number().int().positive().safe(), snapshot: z.preprocess(migrateSnapshotForOpen, CoreSnapshotSchema), created_at: stamp, updated_at: stamp}).strict()).max(10_000),
  bindings: z.array(z.object({workspace_id: id, account_id: id, actor_id: id}).strict()).max(10_000),
  imports: z.array(z.object({workspace_id: id, account_id: id, digest: Digest, semantic_digest: Digest, original_text: z.string().max(2_000_000),
    source_version: z.number().int().min(1).max(3), source_workspace_id: id, created_at: stamp}).strict()).max(10_000),
  creationReceipts: z.array(z.object({account_id: id, command_id: id, fingerprint: Digest, workspace_id: id}).strict()).max(20_000),
}).strict();
const RecordingRowSchema = z.object({id, workspace_id: id, owner_account_id: id, document_id: id, state: RecordingStateSchema, created_at: stamp, updated_at: stamp}).strict();
const PartRowSchema = z.object({recording_id: id, part_index: z.number().int().nonnegative().max(1023), sha256: Digest, base64: z.string().max(699052)}).strict();
const BackupV3Schema = LegacyBackupDataSchema.extend({format: z.literal('ardesia-server-backup-v3'), recordings: z.array(RecordingRowSchema), recordingParts: z.array(PartRowSchema)});
const MaterialRowSchema = z.object({id,workspace_id:id,owner_account_id:id,document_id:id,state:MaterialStateSchema,created_at:stamp}).strict();
const MaterialPartRowSchema=z.object({asset_id:id,part_index:z.number().int().min(0).max(63),sha256:Digest,base64:z.string().max(699052)}).strict();
const BackupDataSchema=BackupV3Schema.extend({format:z.literal('ardesia-server-backup-v4'),materials:z.array(MaterialRowSchema),materialParts:z.array(MaterialPartRowSchema)});
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
    const recordings = await client.query('SELECT id,workspace_id,owner_account_id,document_id,state,created_at,updated_at FROM ardesia_next.recordings ORDER BY id');
    const parts = await client.query('SELECT recording_id,part_index,sha256,bytes FROM ardesia_next.recording_parts ORDER BY recording_id,part_index');
    const materials=await client.query('SELECT id,workspace_id,owner_account_id,document_id,state,created_at FROM ardesia_next.materials ORDER BY id');
    const materialParts=await client.query('SELECT asset_id,part_index,sha256,bytes FROM ardesia_next.material_parts ORDER BY asset_id,part_index');
    const data = BackupDataSchema.parse({format: 'ardesia-server-backup-v4', exportedAt: new Date().toISOString(),
      materials:materials.rows.map(row=>({...row,created_at:row.created_at.toISOString()})),
      materialParts:materialParts.rows.map(({bytes,...row})=>({...row,base64:bytes.toString('base64')})),
      accounts: accounts.rows.map(row => ({...row, disabled_at: row.disabled_at?.toISOString() ?? null})),
      workspaces: workspaces.rows.map(row => ({...row, revision: Number(row.revision), created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString()})),
      recordings: recordings.rows.map(row => ({...row, created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString()})),
      recordingParts: parts.rows.map(({bytes, ...row}) => ({...row, base64: bytes.toString('base64')})),
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
  // Authenticate the original envelope before applying any version migration or normalization.
  const envelope = z.object({data: z.unknown(), sha256: Digest}).strict().safeParse(input);
  if (!envelope.success || hash(canonical(envelope.data.data)) !== envelope.data.sha256) {
    throw new ServerError('INVALID_BACKUP', 'The backup checksum or data contract is invalid.', 422);
  }
  const parsed = z.union([BackupDataSchema, BackupV3Schema, LegacyBackupDataSchema]).safeParse(envelope.data.data);
  if (!parsed.success) throw new ServerError('INVALID_BACKUP', 'The backup data contract is invalid.', 422);
  const data: BackupData = parsed.data.format === 'ardesia-server-backup-v4' ? parsed.data : parsed.data.format === 'ardesia-server-backup-v3' ? {...parsed.data,format:'ardesia-server-backup-v4',materials:[],materialParts:[]}
    : {...parsed.data, format: 'ardesia-server-backup-v4', recordings: [], recordingParts: [],materials:[],materialParts:[]};
  const accounts = new Map(data.accounts.map(account => [account.id, account.role]));
  if (accounts.size !== data.accounts.length) throw new ServerError('INVALID_BACKUP', 'The backup contains duplicate account identities.', 422);
  const workspaceIds = new Set(data.workspaces.map(workspace => workspace.id));
  if (workspaceIds.size !== data.workspaces.length || data.bindings.length !== data.workspaces.length
    || new Set(data.bindings.map(binding => binding.workspace_id)).size !== data.bindings.length) {
    throw new ServerError('INVALID_BACKUP', 'The backup contains duplicate or missing workspace bindings.', 422);
  }
  for (const workspace of data.workspaces) {
    try {await createCore({storage:{async read(){return workspace.snapshot;},async write(){throw Error('Read only');}}});}
    catch {throw new ServerError('INVALID_BACKUP', 'Workspace content integrity verification failed.', 422);}
    const binding = data.bindings.find(entry => entry.workspace_id === workspace.id);
    if (!binding || binding.account_id !== workspace.owner_account_id || !accounts.has(workspace.owner_account_id)
      || accounts.has(binding.actor_id) && binding.actor_id !== binding.account_id
      || accounts.get(workspace.owner_account_id) === 'student' && (workspace.snapshot.assignments.length > 0 || workspace.snapshot.tutorRecords.length > 0
        || workspace.snapshot.courseDeliveries.some(value => value.learnerId !== binding.actor_id))
      || workspace.snapshot.documents.some(document => document.ownerId !== binding.actor_id)
      || workspace.snapshot.notebookLibraries.some(library => library.ownerId !== binding.actor_id)
      || workspace.snapshot.installations.some(installation => installation.ownerId !== binding.actor_id)
      || workspace.snapshot.assignments.some(assignment => accounts.get(assignment.studentId) !== 'student')
      || workspace.snapshot.learnerWork.some(work => accounts.get(work.studentId) !== 'student')
      || workspace.snapshot.tutorRecords.some(record => record.ownerId !== binding?.actor_id)
      || workspace.snapshot.courses.some(course => course.ownerId !== binding?.actor_id)
      || workspace.snapshot.courseDeliveries.some(value => value.ownerId !== binding?.actor_id
        || value.learnerId !== binding?.actor_id && accounts.get(value.learnerId) !== 'student')) {
      throw new ServerError('INVALID_BACKUP', 'The backup owner binding does not match its Core data.', 422);
    }
  }
  for (const archive of data.imports) {
    let semantic: ReturnType<typeof parseLegacyImport>;
    try {semantic = parseLegacyImport(archive.original_text);}
    catch {throw new ServerError('INVALID_BACKUP', 'An imported archive has invalid Core contents.', 422);}
    if (hash(archive.original_text) !== archive.digest || !workspaceIds.has(archive.workspace_id)
      || semantic.semanticDigest !== archive.semantic_digest || semantic.sourceVersion !== archive.source_version || semantic.sourceWorkspaceId !== archive.source_workspace_id
      || !data.workspaces.some(workspace => workspace.id === archive.workspace_id && workspace.owner_account_id === archive.account_id)) {
      throw new ServerError('INVALID_BACKUP', 'An imported source archive failed integrity verification.', 422);
    }
  }
  if (data.creationReceipts.some(receipt => !data.workspaces.some(workspace => workspace.id === receipt.workspace_id && workspace.owner_account_id === receipt.account_id))) {
    throw new ServerError('INVALID_BACKUP', 'A creation receipt does not belong to its workspace owner.', 422);
  }
  // Validate media and exact Core references before touching the empty target.
  const media = new Map<string, RecordingState>();
  for (const row of data.recordings) {
    const workspace = data.workspaces.find(workspace => workspace.id === row.workspace_id);
    const binding = data.bindings.find(binding => binding.workspace_id === row.workspace_id);
    if (media.has(row.id) || !workspace || !binding || workspace.owner_account_id !== row.owner_account_id
      || row.state.summary.recordingId !== row.id || row.state.summary.documentId !== row.document_id || row.state.summary.ownerId !== binding.actor_id) {
      throw new ServerError('INVALID_BACKUP', 'Recording identity or owner binding is invalid.', 422);
    }
    if (row.state.summary.status === 'ready' && row.state.capture && row.state.summary.mediaDigest !== hash(canonical({mimeType: row.state.capture.mimeType, parts: row.state.capture.parts}))) {
      throw new ServerError('INVALID_BACKUP', 'The recording media identity is inconsistent.', 422);
    }
    media.set(row.id, row.state);
    if (row.state.capture) {
      const core = await createCore({storage: {async read() {return workspace.snapshot;}, async write() {throw Error('Read only');}}});
      validateRecordingCapture(core, {actorId: binding.actor_id, role: accounts.get(workspace.owner_account_id)!}, row.state.capture);
    }
  }
  const keys = new Set<string>();
  for (const row of data.recordingParts) {
    const state = media.get(row.recording_id), part = state?.capture?.parts[row.part_index], key = row.recording_id + ':' + row.part_index;
    const bytes = Buffer.from(row.base64, 'base64');
    if (!part || keys.has(key) || bytes.toString('base64') !== row.base64 || row.sha256 !== part.sha256
      || bytes.length !== part.bytes || mediaHash(bytes) !== part.sha256) throw new ServerError('INVALID_BACKUP', 'Recording bytes failed integrity verification.', 422);
    keys.add(key);
  }
  for (const [id, state] of media) if (state.summary.status === 'ready' && state.capture?.parts.some(part => !keys.has(id + ':' + part.index))) {
    throw new ServerError('INVALID_BACKUP', 'Ready recording media is incomplete.', 422);
  }
  const materialIds=new Set<string>();
  for(const row of data.materials){
    const workspace=data.workspaces.find(w=>w.id===row.workspace_id),binding=data.bindings.find(b=>b.workspace_id===row.workspace_id);
    if(materialIds.has(row.id)||!workspace||!binding||row.owner_account_id!==workspace.owner_account_id||row.state.ownerId!==binding.actor_id
      ||row.state.manifest.assetId!==row.id||row.state.manifest.documentId!==row.document_id||!workspace.snapshot.documents.some(d=>d.id===row.document_id))throw new ServerError('INVALID_BACKUP','Invalid material ownership or identity.',422);
    materialIds.add(row.id);
    const parts=data.materialParts.filter(p=>p.asset_id===row.id).sort((a,b)=>a.part_index-b.part_index);
    const seen=new Set<number>();
    for(const part of parts){const expected=row.state.manifest.parts[part.part_index],bytes=Buffer.from(part.base64,'base64');
      if(seen.has(part.part_index)||!expected||bytes.toString('base64')!==part.base64||bytes.length!==expected.bytes||part.sha256!==expected.sha256||mediaHash(bytes)!==part.sha256)throw new ServerError('INVALID_BACKUP','Material chunk integrity failure.',422);seen.add(part.part_index);
    }
    if(row.state.status==='ready')try{verifyMaterialBytes(row.state,parts.map(({base64,...p})=>({...p,bytes:Buffer.from(base64,'base64')})));}catch{throw new ServerError('INVALID_BACKUP','Material original integrity failure.',422);}
  }
  if(data.materialParts.some(p=>!materialIds.has(p.asset_id)))throw new ServerError('INVALID_BACKUP','Orphan material bytes.',422);
  for(const workspace of data.workspaces){
    const candidates=workspace.snapshot.documents.flatMap(d=>d.objects.map(o=>({documentId:d.id,object:o})));
    for(const event of workspace.snapshot.events)if('documentId'in event&&event.payload&&typeof event.payload==='object'&&!Array.isArray(event.payload))for(const name of ['object','previous']){
      const parsed=EducationalObjectSchema.safeParse(event.payload[name]);if(parsed.success)candidates.push({documentId:event.documentId,object:parsed.data});
    }
    for(const {documentId,object} of candidates)if(object.type==='material'){
      const row=data.materials.find(m=>m.id===object.data.assetId&&m.workspace_id===workspace.id);
      try{if(!row)throw Error();validateMaterialReference(row.state,documentId,object.data);}catch{throw new ServerError('INVALID_BACKUP','A material page has no exact original.',422);}
    }
  }
  return transaction(pool, async client => {
    await requireOperator(client);
    // Restore is an explicit operation on an empty target. Lock accounts before workspaces,
    // matching authentication order, so no login can race the disabled-state restoration.
    await client.query('LOCK TABLE ardesia_next.accounts, ardesia_next.workspaces IN ACCESS EXCLUSIVE MODE');
    const existing = await client.query('SELECT id FROM ardesia_next.workspaces LIMIT 1');
    if (existing.rowCount) throw new ServerError('RESTORE_TARGET_NOT_EMPTY', 'Restore never overwrites an existing workspace.', 409);
    for (const binding of data.bindings) {
      const collision = await client.query('SELECT id FROM ardesia_next.accounts WHERE id=$1 AND id<>$2', [binding.actor_id, binding.account_id]);
      if (collision.rowCount) throw new ServerError('IDENTITY_COLLISION', 'A target account collides with an imported owner binding.', 409);
    }
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
    for (const row of data.recordings) await client.query('INSERT INTO ardesia_next.recordings(id,workspace_id,owner_account_id,document_id,state,created_at,updated_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)',
      [row.id, row.workspace_id, row.owner_account_id, row.document_id, JSON.stringify(row.state), row.created_at, row.updated_at]);
    for (const row of data.recordingParts) await client.query('INSERT INTO ardesia_next.recording_parts(recording_id,part_index,sha256,bytes) VALUES($1,$2,$3,$4)',
      [row.recording_id, row.part_index, row.sha256, Buffer.from(row.base64, 'base64')]);
    for(const row of data.materials)await client.query('INSERT INTO ardesia_next.materials(id,workspace_id,owner_account_id,document_id,state,created_at) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[row.id,row.workspace_id,row.owner_account_id,row.document_id,JSON.stringify(row.state),row.created_at]);
    for(const row of data.materialParts)await client.query('INSERT INTO ardesia_next.material_parts(asset_id,part_index,sha256,bytes) VALUES($1,$2,$3,$4)',[row.asset_id,row.part_index,row.sha256,Buffer.from(row.base64,'base64')]);
    return {workspaces: data.workspaces.length, imports: data.imports.length};
  });
}
