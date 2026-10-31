import {randomBytes, randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {mkdirSync, writeFileSync} from 'node:fs';
import {identity} from './evidence.mjs';
import {databaseIdentity} from './qa-database.mjs';
import {collectOperatorAcceptance} from './m3-operator.mjs';

// Exercises the real operator producer in two disposable CI databases. Never emits remote acceptance.
let vite, sourcePool, restorePool;
try {
  const base = new URL(process.env.M3_TEST_ADMIN_DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.searchParams.has('host')) throw Error('LOOPBACK_QA_REQUIRED');
  const sourceUrl = new URL(base), restoreUrl = new URL(base);
  sourceUrl.pathname = '/ardesia_m3_qa_test'; restoreUrl.pathname = '/ardesia_m3_qa_restore';
  const {createServer} = await import('vite');
  vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom', logLevel: 'silent'});
  const api = await vite.ssrLoadModule('/@fs/' + resolve('packages/server/src/index.ts'));
  sourcePool = api.createDatabasePool(sourceUrl.href); restorePool = api.createDatabasePool(restoreUrl.href);
  for (const pool of [sourcePool, restorePool]) {
    if ((await pool.query("SELECT to_regclass('ardesia_next.workspaces') AS present")).rows[0].present) throw Error('FRESH_QA_DATABASE_REQUIRED');
    await api.migrate(pool);
  }
  const accounts = ['teacher', 'student', 'student'].map(role => ({id: randomUUID(), role, username: `qa-${randomUUID()}`,
    displayName: 'CI synthetic', password: randomBytes(24).toString('base64url')}));
  await api.provisionTestAccounts(sourcePool, accounts);
  const store = api.createPostgresStore({pool: sourcePool, pluginPolicy: api.createFirstPartyPolicy({artifactRoot: resolve('apps/web/public')})});
  const teacher = accounts[0], session = await store.login({action: 'login', username: teacher.username, password: teacher.password});
  const workspace = await store.execute(session.token, teacher.id, {action: 'create-workspace', commandId: randomUUID(), title: 'Synthetic operator contract'});
  const current = identity(), startedAt = new Date().toISOString();
  const report = await collectOperatorAcceptance({current, deployment: {...current, projectId: 'local-test', deploymentId: 'dpl_LocalContract',
    url: 'https://ardesia-next-local-contract.vercel.app', status: 'READY'}, browser: {operatorScope: {accountIds: accounts.map(a => a.id), teacherId: teacher.id,
      workspaceId: workspace.workspaceId, nonce: randomUUID()}}, env: {ARDESIA_QA_OPERATOR_DATABASE_URL: sourceUrl.href,
      ARDESIA_QA_RESTORE_DATABASE_URL: restoreUrl.href, ARDESIA_QA_RESTORE_RESOURCE_HASH: databaseIdentity(restoreUrl.href).resourceIdHash}});
  if (Object.keys(report.checks).length !== 4 || report.checks.expired.responseStatus !== 401 || report.checks.outage.failedStatus !== 503
    || report.checks.outage.recoveredStatus !== 200 || report.checks.backupRestore.beforeDigest !== report.checks.backupRestore.restoredDigest
    || report.checks.import.versions.length !== 3 || report.database.remote !== false) throw Error('QA_COLLECTOR_CONTRACT_FAILED');
  const result = {...current, kind: 'ardesia-local-operator-producer-test', startedAt, completedAt: new Date().toISOString(), passed: true,
    checks: report.checks, m3Acceptance: 'NOT_EVALUATED', executionScope: 'two-disposable-loopback-ci-databases'};
  mkdirSync('artifacts', {recursive: true}); writeFileSync('artifacts/m3-operator-contract.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({kind: result.kind, passed: true, counterproofs: 4, importVersions: [1, 2, 3], m3Acceptance: result.m3Acceptance}));
} catch {console.error('Isolated operator producer contract failed. No remote acceptance was produced.'); process.exitCode = 1;}
finally {await sourcePool?.end(); await restorePool?.end(); await vite?.close();}
