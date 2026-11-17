import {materialRequest} from './materials';
import {MaterialStateSchema} from '@ardesia/contracts';
import {validateMaterialReference} from '@ardesia/core';
import {randomUUID} from 'node:crypto';
import type {Pool, PoolClient} from 'pg';
import {
  CoreError, CoreSnapshotSchema, emptySnapshot, migrateSnapshotForOpen,
  type Actor, type CoreSnapshot, type WorkspaceReceipt, type WorkspaceAccess,
} from '@ardesia/contracts';
import {createCore, type CoreService, type PluginPolicy, type StorageAdapter} from '@ardesia/core';
import {authenticate, login} from './auth';
import {createDatabasePool, hash, requireCurrentSchema, transaction} from './database';
import {canonical, ServerError, unavailable} from './errors';
import type {AuthenticatedRequest, ApiRequest} from './requests';
import type {Account, WorkspaceProjection, WorkspaceSummary} from './types';
import {recordingRequest} from './recordings';
import {parseLegacyImport} from './legacy-import';

interface WorkspaceRow { id: string; owner_account_id: string; title: string; revision: string; snapshot: CoreSnapshot; }
interface StoreOptions { pool?: Pool; connectionString?: string; pluginPolicy: PluginPolicy; sessionLifetimeSeconds?: number; }

function projection(core: CoreService, actor: Actor, workspace: WorkspaceRow, access: WorkspaceAccess): WorkspaceProjection {
  const assignments = core.listAssignments(actor);
  const documents = core.listDocuments(actor);
  const assignedDocuments = actor.role === 'student'
    ? [...new Set(assignments.map(entry => entry.documentId))].map(id => core.getAssignedDocument(actor, id)) : [];
  const learnerWork: WorkspaceProjection['learnerWork'] = [];
  const learningEvents: WorkspaceProjection['learningEvents'] = [];
  for (const assignment of assignments.filter(entry => entry.status === 'active')) {
    try {
      const work = core.getLearnerWork(actor, assignment.documentId, assignment.studentId);
      if (work) learnerWork.push(work);
      learningEvents.push(...core.learningEvents(actor, assignment.documentId, assignment.studentId));
    } catch (error) {
      if (!(error instanceof CoreError) || error.code !== 'NOT_FOUND') throw error;
      // Absence and unshared evidence are the same projection: no private student payload.
    }
  }
  return {
    workspaceId: workspace.id, title: workspace.title, workspaceRevision: Number(workspace.revision), actor, access,
    tutorSpace: core.getTutorSpace(actor),
    notebookSpace: access === 'owner' ? core.getNotebookSpace(actor) : {revision: 0, notebooks: []},
    courseSpace: core.getCourseSpace(actor),
    documents, assignedDocuments, installations: core.listInstallations(actor),
    events: documents.flatMap(document => core.events(actor, document.id)), assignments, learnerWork, learningEvents,
    labAccess: assignedDocuments.flatMap(document => document.objects.filter(object => object.type === 'lab')
      .map(object => core.getAssignedLabAccess(actor, document.id, object.id))),
  };
}

function isAssigned(snapshot: CoreSnapshot, accountId: string): boolean {
  return snapshot.assignments.some(entry => entry.studentId === accountId && entry.status === 'active')
    || snapshot.courseDeliveries.some(entry => entry.learnerId === accountId);
}

async function openLocked(client: PoolClient, account: Account, workspaceId: string, policy: PluginPolicy) {
  // Serialize the complete Core read/command/write, not just its final UPDATE.
  const query = await client.query<WorkspaceRow>('SELECT id,owner_account_id,title,revision,snapshot FROM ardesia_next.workspaces WHERE id=$1 FOR UPDATE', [workspaceId]);
  const workspace = query.rows[0];
  if (!workspace) throw unavailable();
  const validated = CoreSnapshotSchema.safeParse(migrateSnapshotForOpen(workspace.snapshot));
  if (!validated.success) throw new CoreError('INVALID_SNAPSHOT', 'The stored workspace failed its integrity contract. It was not replaced.');
  workspace.snapshot = validated.data;
  let actor: Actor;
  const access: WorkspaceAccess = workspace.owner_account_id === account.id ? 'owner' : 'assigned';
  if (access === 'assigned' && (account.role !== 'student' || !isAssigned(workspace.snapshot, account.id))) throw unavailable();
  const bound = await client.query('SELECT actor_id FROM ardesia_next.owner_bindings WHERE workspace_id=$1 AND account_id=$2', [workspaceId, workspace.owner_account_id]);
  if (!bound.rows[0]) throw new ServerError('INTEGRITY_FAILURE', 'The workspace identity binding is unavailable.', 503);
  if (access === 'assigned' && account.id === bound.rows[0].actor_id) throw unavailable();
  const collision = await client.query('SELECT id FROM ardesia_next.accounts WHERE id=$1 AND id<>$2', [bound.rows[0].actor_id, workspace.owner_account_id]);
  if (collision.rowCount) throw new ServerError('INTEGRITY_FAILURE', 'The workspace owner binding collides with an account. No data was returned.', 503);
  if (access === 'owner') {
    actor = {actorId: bound.rows[0].actor_id, role: account.role};
  } else {
    actor = {actorId: account.id, role: 'student'};
  }
  const storage: StorageAdapter = {
    async read() { return workspace.snapshot; },
    async write(snapshot) {
      const updated = await client.query(`UPDATE ardesia_next.workspaces SET snapshot=$1::jsonb,revision=revision+1,updated_at=now()
        WHERE id=$2 AND revision=$3 RETURNING revision`, [JSON.stringify(snapshot), workspace.id, workspace.revision]);
      if (updated.rowCount !== 1) throw new CoreError('REVISION_CONFLICT', 'The workspace changed concurrently.');
      workspace.snapshot = snapshot;
      workspace.revision = updated.rows[0].revision;
    },
  };
  const core = await createCore({storage, pluginPolicy: policy});
  return {workspace, actor, core, access};
}

/** One Postgres authority; no disk/memory fallback exists if its connection is unavailable. */
export function createPostgresStore(options: StoreOptions) {
  const pool = options.pool ?? createDatabasePool(options.connectionString ?? '');
  const lifetime = options.sessionLifetimeSeconds ?? 8 * 60 * 60;
  if (!Number.isInteger(lifetime) || lifetime < 60 || lifetime > 86_400) throw new ServerError('INVALID_CONFIGURATION', 'Session lifetime must be between 60 and 86400 seconds.');

  async function createWorkspace(client: PoolClient, account: Account,
    input: Extract<AuthenticatedRequest, {action: 'create-workspace' | 'import-local'}>): Promise<WorkspaceProjection> {
    if (input.action === 'import-local' && input.expectedAccountId !== account.id) {
      throw new ServerError('SESSION_CHANGED', 'Import must explicitly target the currently authenticated account.', 409);
    }
    // Serialize creation retries across all instances without choosing a browser-supplied owner.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['create:' + account.id]);
    const fingerprint = hash(canonical(input));
    const prior = await client.query('SELECT fingerprint,workspace_id FROM ardesia_next.creation_receipts WHERE account_id=$1 AND command_id=$2', [account.id, input.commandId]);
    if (prior.rows[0]) {
      if (prior.rows[0].fingerprint !== fingerprint) throw new CoreError('IDEMPOTENCY_CONFLICT', 'The creation command ID already identifies a different request.');
      const opened = await openLocked(client, account, prior.rows[0].workspace_id, options.pluginPolicy);
      return projection(opened.core, opened.actor, opened.workspace, opened.access);
    }
    const workspaceId = randomUUID();
    let snapshot = emptySnapshot(workspaceId), actorId = account.id;
    let archive: {digest: string; semanticDigest: string; sourceVersion: number; sourceWorkspaceId: string; text: string} | undefined;
    if (input.action === 'import-local') {
      const imported = parseLegacyImport(input.snapshotText);
      snapshot = imported.snapshot;
      const owners = new Set([...snapshot.documents.map(entry => entry.ownerId), ...snapshot.installations.map(entry => entry.ownerId),
        ...snapshot.events.map(entry => entry.actorId), ...snapshot.receipts.map(entry => entry.actorId)]);
      if (owners.size > 1) throw new ServerError('IMPORT_MULTIPLE_OWNERS', 'Import requires a single device owner. No data was linked.', 409);
      actorId = owners.values().next().value ?? account.id;
      if (snapshot.documents.some(document => document.status !== 'draft' || document.objects.some(object => object.status !== 'draft'))) {
        throw new ServerError('IMPORT_UNTRUSTED_APPROVAL', 'A device import cannot establish remote approval authority.', 409);
      }
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['identity:' + actorId]);
      const collision = await client.query('SELECT id FROM ardesia_next.accounts WHERE id=$1 AND id<>$2', [actorId, account.id]);
      if (collision.rowCount) throw new ServerError('IMPORT_OWNER_COLLISION', 'The device owner collides with another authenticated identity.', 409);
      const digest = hash(input.snapshotText);
      const semanticDigest = imported.semanticDigest;
      const duplicate = await client.query('SELECT workspace_id FROM ardesia_next.import_archives WHERE account_id=$1 AND semantic_digest=$2', [account.id, semanticDigest]);
      if (duplicate.rowCount) throw new ServerError('IMPORT_ALREADY_EXISTS', 'These exact source bytes were already imported. Open that workspace instead.', 409);
      archive = {digest, semanticDigest, text: input.snapshotText, sourceVersion: imported.sourceVersion, sourceWorkspaceId: imported.sourceWorkspaceId};
      // Snapshot.workspaceId and every historical object/receipt remain untouched. The DB container has a fresh ID.
    }
    await client.query('INSERT INTO ardesia_next.workspaces(id,owner_account_id,title,snapshot) VALUES ($1,$2,$3,$4::jsonb)',
      [workspaceId, account.id, input.title, JSON.stringify(snapshot)]);
    await client.query('INSERT INTO ardesia_next.owner_bindings(workspace_id,account_id,actor_id) VALUES ($1,$2,$3)', [workspaceId, account.id, actorId]);
    if (archive) {
      await client.query(`INSERT INTO ardesia_next.import_archives(workspace_id,account_id,digest,semantic_digest,original_text,source_version,source_workspace_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [workspaceId, account.id, archive.digest, archive.semanticDigest, archive.text, archive.sourceVersion, archive.sourceWorkspaceId]);
    }
    const opened = await openLocked(client, account, workspaceId, options.pluginPolicy);
    // Revocation is a Core command: past events/receipts are never rewritten to fabricate a remote consent.
    if (archive) for (const installation of opened.core.listInstallations(opened.actor)) {
      if (installation.status !== 'revoked') await opened.core.executePlugin(opened.actor, {
        kind: 'withdraw-plugin-consent', commandId: randomUUID(), pluginId: installation.pluginId, expectedRevision: installation.revision,
      });
    }
    await client.query('INSERT INTO ardesia_next.creation_receipts(account_id,command_id,fingerprint,workspace_id) VALUES ($1,$2,$3,$4)',
      [account.id, input.commandId, fingerprint, workspaceId]);
    return projection(opened.core, opened.actor, opened.workspace, opened.access);
  }

  return {
    pool,
    sessionLifetimeSeconds: lifetime,
    async health() {
      return transaction(pool, async client => {
        await requireCurrentSchema(client);
        await client.query('SELECT id FROM ardesia_next.workspaces LIMIT 1');
        return {configured: true as const, authority: 'postgres' as const};
      });
    },
    async login(input: Extract<ApiRequest, {action: 'login'}>, oldToken?: string) {
      return login(pool, input.username, input.password, lifetime, oldToken);
    },
    async execute(token: string | undefined, expectedAccountId: string | undefined, input: AuthenticatedRequest): Promise<unknown> {
      if (input.action !== 'session' && !expectedAccountId) throw new ServerError('ACCOUNT_PRECONDITION_REQUIRED', 'Refresh your session before sending this request.', 409);
      return transaction(pool, async client => {
        const session = await authenticate(client, token, expectedAccountId, input.action === 'logout');
        const {account} = session;
        // Revocation uses only the original authenticated session contract. An
        // upgrade must never trap an existing user in an unrevoked session.
        if (input.action === 'logout') {
          await client.query('UPDATE ardesia_next.sessions SET revoked_at=now() WHERE token_hash=$1', [hash(token!)]);
          return {signedOut: true};
        }
        await requireCurrentSchema(client);
        if (input.action === 'session') return session;
        if (input.action === 'create-workspace' || input.action === 'import-local') return createWorkspace(client, account, input);
        if (input.action === 'list-workspaces') {
          const rows = await client.query<WorkspaceRow>(`SELECT id,title,revision,owner_account_id FROM ardesia_next.workspaces
            WHERE owner_account_id=$1 OR ($2='student'
              AND EXISTS(SELECT 1 FROM ardesia_next.owner_bindings b WHERE b.workspace_id=workspaces.id AND b.actor_id<>$1)
              AND (snapshot->'assignments' @> $3::jsonb OR snapshot->'courseDeliveries' @> $4::jsonb))
            ORDER BY created_at,id`, [account.id, account.role, JSON.stringify([{studentId: account.id, status: 'active'}]), JSON.stringify([{learnerId: account.id}])]);
          return rows.rows.map((row): WorkspaceSummary => ({workspaceId: row.id, title: row.title, workspaceRevision: Number(row.revision), access: row.owner_account_id === account.id ? 'owner' : 'assigned'}));
        }
        const opened = await openLocked(client, account, input.workspaceId, options.pluginPolicy);
        // The workspace container is owned independently of teaching role. An assignment
        // authorizes learner work only; it must never become a place to create private
        // documents, installations or course drafts inside another person's snapshot.
        if (opened.access !== 'owner' && (input.action === 'command' || input.action === 'plugin-command' || input.action === 'tutor-command' || input.action === 'notebook-command'
          || input.action === 'course-command' && ['save-course', 'create-course-edition', 'assign-course', 'revoke-course-delivery'].includes(input.command.kind))) {
          throw new ServerError('FORBIDDEN', 'Authoring requires your own workspace.', 403);
        }
        if (input.action === 'prepare-material' || input.action === 'put-material-part' || input.action === 'finish-material' || input.action === 'read-material' || input.action === 'read-material-part') return materialRequest(client, account, opened.core, opened.actor, input);
        if (input.action === 'command' && (input.command.kind === 'add-object' || input.command.kind === 'replace-object') && input.command.object.type === 'material') {
          const row = (await client.query('SELECT state FROM ardesia_next.materials WHERE id=$1 AND workspace_id=$2',[input.command.object.data.assetId,input.workspaceId])).rows[0];
          if (!row) throw unavailable();
          validateMaterialReference(MaterialStateSchema.parse(row.state), input.command.documentId, input.command.object.data);
        }
        if (input.action === 'search-recordings' || input.action === 'list-recordings' || input.action === 'read-recording' || input.action === 'recording-command'
          || input.action === 'put-recording-part' || input.action === 'read-recording-part') {
          return recordingRequest(client, account, opened.core, opened.actor, input);
        }
        if (input.action === 'open-workspace') return projection(opened.core, opened.actor, opened.workspace, opened.access);
        if (input.action === 'read-course-lesson') return opened.core.readCourseLesson(opened.actor, input.editionId, input.unitId);
        if (input.action === 'read-attempt-source') return opened.core.readAttemptSource(opened.actor, input.documentId, input.attemptId, input.studentId);
        if (input.action === 'export-personal') return {
          format: 'ardesia-personal-v1', accountId: account.id, workspaceId: input.workspaceId, exportedAt: new Date().toISOString(),
          projection: projection(opened.core, opened.actor, opened.workspace, opened.access),
        };
        let receipt: WorkspaceReceipt;
        if (input.action === 'command') receipt = await opened.core.execute(opened.actor, input.command);
        else if (input.action === 'notebook-command') receipt = await opened.core.executeNotebook(opened.actor, input.command);
        else if (input.action === 'plugin-command') receipt = await opened.core.executePlugin(opened.actor, input.command);
        else if (input.action === 'tutor-command') receipt = await opened.core.executeTutor(opened.actor, input.command);
        else if (input.action === 'course-command') {
          if (input.command.kind === 'assign-course' && input.command.learnerId !== opened.actor.actorId) {
            if (account.role !== 'teacher') throw new ServerError('FORBIDDEN', 'Teaching delivery requires a teacher account.', 403);
            const target = await client.query("SELECT id FROM ardesia_next.accounts WHERE id=$1 AND role='student' AND disabled_at IS NULL FOR SHARE", [input.command.learnerId]);
            if (!target.rows[0]) throw unavailable();
          }
          receipt = await opened.core.executeCourse(opened.actor, input.command);
        } else {
          if (input.command.kind === 'assign-lesson' || input.command.kind === 'revoke-assignment') {
            const target = await client.query("SELECT id FROM ardesia_next.accounts WHERE id=$1 AND role='student' AND disabled_at IS NULL FOR SHARE", [input.command.studentId]);
            if (!target.rows[0]) throw unavailable();
          }
          receipt = await opened.core.executeLearning(opened.actor, input.command);
        }
        return {receipt, projection: projection(opened.core, opened.actor, opened.workspace, opened.access)};
      });
    },
    async close() { if (!options.pool) await pool.end(); },
  };
}
export type PostgresStore = ReturnType<typeof createPostgresStore>;
