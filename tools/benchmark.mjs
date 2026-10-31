import {performance} from 'node:perf_hooks';
import {randomBytes, randomUUID} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {identity} from './evidence.mjs';
import {requireLoopbackBenchmark} from './qa-database.mjs';

const summary = values => {
  if (!values.length) throw Error('BENCHMARK_HAS_NO_SAMPLES');
  const ordered = values.toSorted((a, b) => a - b), rank = p => ordered[Math.ceil(p * ordered.length) - 1];
  return {samples: ordered.length, p50Ms: rank(0.5), p95Ms: rank(0.95), maxMs: ordered.at(-1)};
};

/** Bounded, real PostgreSQL/Core workload; cannot select staging or another database. */
export async function runBenchmark(env = process.env) {
  const connectionString = env.M3_BENCHMARK_DATABASE_URL;
  requireLoopbackBenchmark(connectionString);
  const {createServer} = await import('vite');
  const vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom', logLevel: 'silent'});
  const report = {...identity(), kind: 'ardesia-postgres-benchmark', environment: 'isolated-loopback-ci',
    measuredBoundary: 'authenticated PostgresStore command/read including Core validation and authorized projections; HTTP, TLS and browser rendering excluded',
    percentileMethod: 'nearest-rank; bounded smoke workload, not a capacity or production latency estimate', sizes: [], concurrency: null, passed: false};
  let admin, runtime, runtimeRole, sampler;
  try {
    const api = await vite.ssrLoadModule('/@fs/' + resolve('packages/server/src/index.ts'));
    const lesson = await vite.ssrLoadModule('/@fs/' + resolve('packages/lesson-os/src/index.ts'));
    admin = api.createDatabasePool(connectionString, {max: 1});
    // A second invocation refuses a populated database rather than resetting anything.
    const prior = await admin.query("SELECT to_regclass('ardesia_next.workspaces') AS present");
    if (prior.rows[0].present) throw Error('BENCHMARK_DATABASE_NOT_FRESH');
    await api.migrate(admin);
    const teacher = {id: randomUUID(), username: `bench-${randomUUID()}`, role: 'teacher', displayName: 'Synthetic benchmark', password: randomBytes(24).toString('base64url')};
    const students = Array.from({length: 24}, () => ({id: randomUUID(), username: `bench-${randomUUID()}`, role: 'student', displayName: 'Synthetic student', password: randomBytes(24).toString('base64url')}));
    await api.provisionTestAccounts(admin, [teacher, ...students]);
    runtimeRole = 'bench_' + randomUUID().replaceAll('-', '');
    await admin.query(`CREATE ROLE ${runtimeRole} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
    await admin.query(`GRANT ardesia_next_runtime TO ${runtimeRole}`);
    const runtimeUrl = new URL(connectionString); runtimeUrl.username = runtimeRole; runtimeUrl.password = '';
    const applicationName = `ardesia-benchmark-${randomUUID()}`;
    runtime = api.createDatabasePool(runtimeUrl.href, {max: 5, application_name: applicationName});
    const store = api.createPostgresStore({pool: runtime, pluginPolicy: api.createFirstPartyPolicy({artifactRoot: resolve('apps/web/public')})});
    const signedIn = await store.login({action: 'login', username: teacher.username, password: teacher.password});
    const studentSessions = new Map();
    for (const student of students) studentSessions.set(student.id,
      await store.login({action: 'login', username: student.username, password: student.password}));
    const execute = input => store.execute(signedIn.token, teacher.id, input);
    const monitoring = {sampleIntervalMs: 5, samples: 0, maxDatabaseConnections: 0, maxLockWaiters: 0, maxPoolConnections: 0, maxPoolWaiters: 0, missedSamples: 0};
    let sampling = false, activeSample = Promise.resolve();
    sampler = setInterval(() => {
      monitoring.maxPoolConnections = Math.max(monitoring.maxPoolConnections, runtime.totalCount);
      monitoring.maxPoolWaiters = Math.max(monitoring.maxPoolWaiters, runtime.waitingCount);
      if (sampling) {monitoring.missedSamples++; return;}
      sampling = true;
      activeSample = admin.query(`SELECT count(*)::int AS connections,count(*) FILTER (WHERE wait_event_type='Lock')::int AS locks
        FROM pg_stat_activity WHERE datname=current_database() AND application_name=$1`, [applicationName]).then(({rows}) => {
        monitoring.samples++; monitoring.maxDatabaseConnections = Math.max(monitoring.maxDatabaseConnections, rows[0].connections);
        monitoring.maxLockWaiters = Math.max(monitoring.maxLockWaiters, rows[0].locks);
      }).catch(() => {monitoring.missedSamples++;}).finally(() => {sampling = false;});
    }, monitoring.sampleIntervalMs);
    const timed = async operation => {const start = performance.now(); const result = await operation(); return {ms: performance.now() - start, result};};
    async function seed(strokes, studentCount) {
      const workspace = await execute({action: 'create-workspace', commandId: randomUUID(), title: 'Bounded benchmark'}), documentId = randomUUID();
      await execute({action: 'command', workspaceId: workspace.workspaceId,
        command: {kind: 'create-document', commandId: randomUUID(), documentId, expectedRevision: 0, title: 'Benchmark'}});
      for (let index = 0; index < strokes; index++) await execute({action: 'command', workspaceId: workspace.workspaceId,
        command: {kind: 'add-object', commandId: randomUUID(), documentId, expectedRevision: index + 1,
          object: {id: randomUUID(), type: 'ink', title: 'Synthetic stroke', x: 0, y: 0, width: 100, height: 100,
            data: {points: Array.from({length: 32}, (_, i) => ({x: i, y: index % 100, pressure: 0.5})), width: 2, color: '#151515'}}}});
      for (const student of students.slice(0, studentCount)) {
        await execute({action: 'learning-command', workspaceId: workspace.workspaceId,
          command: {kind: 'assign-lesson', commandId: randomUUID(), documentId, studentId: student.id, expectedRevision: 0}});
        await store.execute(studentSessions.get(student.id).token, student.id, {action: 'learning-command', workspaceId: workspace.workspaceId,
          command: {kind: 'save-learner-note', commandId: randomUUID(), documentId, expectedRevision: 0, text: 'Synthetic private learner work'}});
      }
      return {workspaceId: workspace.workspaceId, documentId};
    }
    const read = row => execute({action: 'open-workspace', workspaceId: row.workspaceId});
    for (const [strokes, studentCount] of [[8, 1], [32, 8], [128, 24]]) {
      const row = await seed(strokes, studentCount);
      for (let i = 0; i < 3; i++) await read(row);
      const reopen = [], projection = [], commands = [];
      for (let sample = 0; sample < 12; sample++) {
        const opened = await timed(() => read(row)); reopen.push(opened.ms);
        const start = performance.now(), continuity = lesson.projectContinuity(opened.result.events, row.documentId);
        projection.push(performance.now() - start);
        if (continuity.latestRevision !== opened.result.documents[0].revision) throw Error('BENCHMARK_PROJECTION_MISMATCH');
        const changed = await timed(() => execute({action: 'command', workspaceId: row.workspaceId,
          command: {kind: 'rename-document', commandId: randomUUID(), documentId: row.documentId,
            expectedRevision: opened.result.documents[0].revision, title: `Measured ${sample}`}})); commands.push(changed.ms);
      }
      const stored = (await admin.query('SELECT octet_length(snapshot::text) AS bytes FROM ardesia_next.workspaces WHERE id=$1', [row.workspaceId])).rows[0];
      const opened = await read(row);
      report.sizes.push({inkStrokes: strokes, pointsPerStroke: 32, assignedStudents: studentCount, events: opened.events.length,
        snapshotJsonBytes: stored.bytes, reopen: summary(reopen), lessonOsProjection: summary(projection), command: summary(commands)});
    }
    // Equal, small snapshots for both contention cases; only workspace sharing changes.
    const rows = []; for (let i = 0; i < 8; i++) rows.push(await seed(8, 0));
    const contention = {};
    for (const shared of [true, false]) {
      const successTimes = [], conflictTimes = []; let successful = 0, conflicts = 0;
      for (let round = 0; round < 4; round++) {
        const selected = shared ? rows.map(() => rows[0]) : rows;
        const reads = await Promise.all(selected.map(read));
        await Promise.all(selected.map(async (row, index) => {
          const start = performance.now();
          try {
            await execute({action: 'command', workspaceId: row.workspaceId, command: {kind: 'rename-document', commandId: randomUUID(),
              documentId: row.documentId, expectedRevision: reads[index].documents[0].revision, title: `Race ${round}-${index}`}});
            successful++; successTimes.push(performance.now() - start);
          } catch (error) {if (error?.code !== 'REVISION_CONFLICT') throw error; conflicts++; conflictTimes.push(performance.now() - start);}
        }));
      }
      if (successful !== (shared ? 4 : 32) || conflicts !== (shared ? 28 : 0)) throw Error('BENCHMARK_CONCURRENCY_INVARIANT_FAILED');
      contention[shared ? 'sameWorkspace' : 'independentWorkspaces'] = {parallelCommands: 8, rounds: 4, successful, conflicts,
        commits: summary(successTimes), refusals: conflictTimes.length ? summary(conflictTimes) : null};
    }
    clearInterval(sampler); sampler = null; await activeSample;
    report.concurrency = contention; report.monitoring = monitoring; report.passed = true;
    return report;
  } finally {
    if (sampler) clearInterval(sampler);
    await runtime?.end();
    if (admin && runtimeRole) await admin.query(`DROP ROLE ${runtimeRole}`);
    await admin?.end(); await vite.close();
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const report = await runBenchmark(); mkdirSync('artifacts', {recursive: true});
    writeFileSync('artifacts/benchmark.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } catch {console.error('Bounded loopback PostgreSQL benchmark failed; no remote database was selected.'); process.exitCode = 1;}
}
