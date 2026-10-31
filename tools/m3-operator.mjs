import {randomBytes, randomUUID, createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {m3ReportDigest} from './m3-evidence.mjs';
import {requireIsolatedRestore} from './qa-database.mjs';

const now = () => new Date().toISOString();
const need = condition => {if (!condition) throw Error('ISOLATED_OPERATOR_PROBE_FAILED');};
const hash = value => createHash('sha256').update(value).digest('hex');
const content = backup => {const {exportedAt, ...data} = backup.data; return data;};
const proof = observation => {const value = {...observation, observedAt: now(), passed: true}; return {...value, artifactDigest: m3ReportDigest(value)};};

/** Source connection is read-only. All writes target an explicitly bound, pre-existing empty restore DB. */
export async function collectOperatorAcceptance({current, deployment, browser, env = process.env}) {
  const {source, target} = requireIsolatedRestore(env.ARDESIA_QA_OPERATOR_DATABASE_URL,
    env.ARDESIA_QA_RESTORE_DATABASE_URL, env.ARDESIA_QA_RESTORE_RESOURCE_HASH);
  const startedAt = now(), checks = {};
  const {createServer} = await import('vite');
  const vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom', logLevel: 'silent'});
  let sourcePool, restorePool, failedPool;
  try {
    const api = await vite.ssrLoadModule('/@fs/' + resolve('packages/server/src/index.ts'));
    const coreApi = await vite.ssrLoadModule('/@fs/' + resolve('packages/core/src/index.ts'));
    sourcePool = api.createDatabasePool(env.ARDESIA_QA_OPERATOR_DATABASE_URL,
      {options: '-c default_transaction_read_only=on', max: 1, application_name: 'ardesia-qa-source-readonly'});
    restorePool = api.createDatabasePool(env.ARDESIA_QA_RESTORE_DATABASE_URL, {max: 2, application_name: 'ardesia-qa-isolated-restore'});
    // Query the server too: alternate hostnames/credentials cannot make the same DB a restore target.
    const sourceName = (await sourcePool.query('SELECT current_database() AS name')).rows[0].name;
    const targetName = (await restorePool.query('SELECT current_database() AS name')).rows[0].name;
    need(sourceName === source.name && targetName === target.name && sourceName !== targetName);
    const empty = await restorePool.query(`SELECT (SELECT count(*) FROM ardesia_next.workspaces) AS workspaces,
      (SELECT count(*) FROM ardesia_next.accounts) AS accounts`);
    need(empty.rows[0].workspaces === '0' && empty.rows[0].accounts === '0');
    const sourceMigration = (await sourcePool.query('SELECT digest FROM ardesia_next.schema_migrations WHERE version=1')).rows[0];
    const targetMigration = (await restorePool.query('SELECT digest FROM ardesia_next.schema_migrations WHERE version=1')).rows[0];
    need(sourceMigration?.digest === targetMigration?.digest);
    const backup = await api.exportBackup(sourcePool), scope = browser.operatorScope;
    need(Array.isArray(scope?.accountIds) && scope.accountIds.length === 3 && new Set(scope.accountIds).size === 3
      && backup.data.accounts.length === 3 && backup.data.accounts.every(a => scope.accountIds.includes(a.id) && a.disabled_at === null)
      && backup.data.workspaces.length > 0 && backup.data.workspaces.every(w => w.owner_account_id === scope.teacherId
        && w.snapshot.assignments.every(a => scope.accountIds.includes(a.studentId))
        && w.snapshot.learnerWork.every(w => scope.accountIds.includes(w.studentId))));
    const qaCredentials = backup.data.accounts.map(a => ({...a, username: `qa-${randomUUID()}`, displayName: 'Isolated QA', password: randomBytes(24).toString('base64url')}));
    await api.provisionTestAccounts(restorePool, qaCredentials);
    await api.restoreBackup(restorePool, backup);
    const restored = await api.exportBackup(restorePool);
    need(m3ReportDigest(content(backup)) === m3ReportDigest(content(restored)));
    checks.backupRestore = proof({sourceDatabaseHash: source.resourceIdHash, restoreDatabaseHash: target.resourceIdHash, syntheticOnly: true,
      recordCount: backup.data.workspaces.length, beforeDigest: m3ReportDigest(content(backup)), restoredDigest: m3ReportDigest(content(restored)),
      executionScope: 'existing-isolated-restore', sourceWrites: false});
    const origin = deployment.url, policy = api.createFirstPartyPolicy({artifactRoot: resolve('apps/web/public')});
    const handler = api.createApiHandler({store: api.createPostgresStore({pool: restorePool, pluginPolicy: policy}), allowedOrigins: [origin]});
    async function request(body, identity, selectedHandler = handler) {
      const response = await selectedHandler(new Request(origin + '/api/m3', {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json',
        ...(identity ? {Cookie: identity.cookie, 'X-Ardesia-Account': identity.id} : {})}, body: JSON.stringify(body)}));
      return {status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0]};
    }
    const qaTeacher = qaCredentials.find(a => a.role === 'teacher'); need(qaTeacher);
    async function signIn() {
      const signed = await request({action: 'login', username: qaTeacher.username, password: qaTeacher.password}); need(signed.status === 200);
      return {id: qaTeacher.id, cookie: signed.cookie};
    }
    const expiring = await signIn();
    const sessionHash = hash(expiring.cookie.split('=')[1]);
    const expired = await restorePool.query(`UPDATE ardesia_next.sessions SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour'
      WHERE token_hash=$1 AND account_id=$2 RETURNING token_hash`, [sessionHash, qaTeacher.id]);
    need(expired.rowCount === 1);
    const refusal = await request({action: 'list-workspaces'}, expiring); need(refusal.status === 401 && refusal.body.error?.code === 'UNAUTHENTICATED');
    checks.expired = proof({responseStatus: refusal.status, code: refusal.body.error.code, executionScope: 'isolated-session-in-restore'});
    const beforeOutage = m3ReportDigest(content(await api.exportBackup(restorePool)));
    // Connect a disposable handler to a closed loopback port. Never stop or reconfigure the shared service.
    failedPool = api.createDatabasePool('postgres://qa@127.0.0.1:1/qa_unavailable', {connectionTimeoutMillis: 250});
    const failedHandler = api.createApiHandler({store: api.createPostgresStore({pool: failedPool, pluginPolicy: policy}), allowedOrigins: [origin]});
    const failed = await failedHandler(new Request(origin + '/api/m3'));
    const recovered = await handler(new Request(origin + '/api/m3'));
    const afterOutage = m3ReportDigest(content(await api.exportBackup(restorePool)));
    need(failed.status === 503 && recovered.status === 200 && beforeOutage === afterOutage);
    checks.outage = proof({failedStatus: failed.status, recoveredStatus: recovered.status, localFallbackUsed: false,
      beforeStateDigest: beforeOutage, afterStateDigest: afterOutage, executionScope: 'isolated-handler-connection-failure'});
    const teacher = await signIn(), versions = [];
    const manifest = JSON.parse(await readFile('apps/web/public/plugins/ideal-spring/1.0.0/manifest.json', 'utf8'));
    const release = {pluginId: manifest.id, version: manifest.version, bundleDigest: manifest.integrity.digest, publisher: manifest.publisher,
      license: manifest.license, provenance: manifest.provenance, sdkVersion: manifest.sdkVersion, stateSchemaVersion: manifest.stateSchemaVersion, capabilities: manifest.capabilities};
    for (const version of [1, 2, 3]) {
      const actor = {actorId: `qa-device-${randomUUID()}`, role: 'teacher'}, local = await coreApi.createCore({storage: new coreApi.MemoryStorage(), pluginPolicy: policy});
      const documentId = randomUUID();
      await local.execute(actor, {kind: 'create-document', commandId: randomUUID(), documentId, expectedRevision: 0, title: 'Synthetic legacy import'});
      // v3 exercises removal of actual active device consent; v1/v2 contain no plugin installation schema.
      if (version === 3) for (const spec of [{kind: 'install-plugin', expectedRevision: 0, release},
        {kind: 'consent-plugin', expectedRevision: 1, releaseDigest: release.bundleDigest, capabilities: release.capabilities},
        {kind: 'activate-plugin', expectedRevision: 2}]) await local.executePlugin(actor, {...spec, commandId: randomUUID(), pluginId: release.pluginId});
      const sourceSnapshot = local.snapshot(), {assignments, learnerWork, installations, ...old} = sourceSnapshot;
      const snapshotText = JSON.stringify({...old, schemaVersion: version, ...(version === 3 ? {installations} : {})}, null, 2);
      const value = {action: 'import-local', expectedAccountId: teacher.id, commandId: randomUUID(), title: `QA import ${version}`, snapshotText};
      const imported = await request(value, teacher); need(imported.status === 200);
      const workspaceId = imported.body.result.workspaceId;
      const stored = (await restorePool.query(`SELECT w.snapshot,a.original_text FROM ardesia_next.workspaces w
        JOIN ardesia_next.import_archives a ON a.workspace_id=w.id WHERE w.id=$1 AND w.owner_account_id=$2`, [workspaceId, teacher.id])).rows[0];
      need(stored?.original_text === snapshotText);
      const doc = stored.snapshot.documents.find(d => d.id === documentId);
      const beforeReceipts = sourceSnapshot.receipts, originalReceipts = stored.snapshot.receipts.slice(0, beforeReceipts.length);
      need(m3ReportDigest(beforeReceipts) === m3ReportDigest(originalReceipts) && doc.revision === 1
        && stored.snapshot.installations.every(i => i.consent === null && i.status === 'disabled'));
      const duplicate = await request({...value, commandId: randomUUID()}, teacher);
      const mismatch = await request({...value, commandId: randomUUID(), expectedAccountId: qaCredentials.find(a => a.role === 'student').id}, teacher);
      need(duplicate.status === 409 && mismatch.status === 409);
      versions.push({version, sourceBytesDigest: hash(snapshotText), archivedBytesDigest: hash(stored.original_text), beforeReceiptsDigest: m3ReportDigest(beforeReceipts),
        afterReceiptsDigest: m3ReportDigest(originalReceipts), beforeRevision: 1, afterRevision: doc.revision, consentReset: true,
        duplicateStatus: duplicate.status, ownershipMismatchStatus: mismatch.status});
    }
    checks.import = proof({versions, executionScope: 'isolated-restore-real-import-handler', sourceData: 'authored-synthetic-legacy-bytes', receiptScope: 'original-history-prefix'});
    return {...deployment, ...current, startedAt, completedAt: now(), checks,
      database: {authority: 'postgres', configured: true, remote: !['127.0.0.1', 'localhost', '[::1]'].includes(source.hostname), hostname: source.hostname, resourceIdHash: source.resourceIdHash},
      isolation: {sourceReadOnly: true, restoreTargetInitiallyEmpty: true, sharedServiceInterrupted: false}};
  } finally {await failedPool?.end(); await restorePool?.end(); await sourcePool?.end(); await vite.close();}
}
