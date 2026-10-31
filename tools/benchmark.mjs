import {performance} from 'node:perf_hooks';
import {randomBytes, randomUUID} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {identity} from './evidence.mjs';
import {requireLoopbackBenchmark} from './qa-database.mjs';

export function summarizeSamples(values) {
  if (!Array.isArray(values) || !values.length || values.some(value => !Number.isFinite(value) || value < 0)) throw Error('BENCHMARK_INVALID_SAMPLES');
  const ordered = values.toSorted((a, b) => a - b), rank = p => ordered[Math.ceil(p * ordered.length) - 1];
  return {samples: ordered.length, samplesMs: [...values], p50Ms: rank(0.5), p95Ms: rank(0.95), maxMs: ordered.at(-1),
    tailEstimate: values.length < 20 ? 'small-sample-maximum' : values.length < 100 ? 'limited-small-sample' : 'observed-samples-only'};
}

export function benchmarkConfiguration(args = []) {
  if (!Array.isArray(args) || args.length > 1 || args.length === 1 && args[0] !== '--extended') {
    throw Object.assign(Error('BENCHMARK_ARGUMENTS_REFUSED'), {phase: 'configuration', code: 'BENCHMARK_ARGUMENTS_REFUSED'});
  }
  const extended = args.length === 1;
  return {mode: extended ? 'extended' : 'smoke', samples: extended ? 100 : 12, warmup: extended ? 10 : 3,
    pointsPerStroke: 32, maxDurationMs: extended ? 600_000 : 120_000,
    profiles: extended ? [[512, 24]] : [[8, 1], [32, 1], [128, 1], [128, 8], [128, 24]]};
}

export function makeInkCommand(documentId, expectedRevision, pointsPerStroke) {
  if (!Number.isInteger(pointsPerStroke) || pointsPerStroke < 2 || pointsPerStroke > 256) throw Error('BENCHMARK_INVALID_POINTS');
  return {kind: 'add-object', commandId: randomUUID(), documentId, expectedRevision,
    object: {id: randomUUID(), type: 'ink', title: 'Synthetic measured stroke', x: 0, y: 0, width: 100, height: 100,
      data: {points: Array.from({length: pointsPerStroke}, (_, i) => ({x: i, y: i % 7, pressure: 0.5})), width: 2, color: '#151515'}}};
}

/** Bounded, real PostgreSQL/Core workload; cannot select staging or another database. */
export async function runBenchmark(env = process.env, args = []) {
  const config = benchmarkConfiguration(args), started = performance.now();
  const checkDeadline = () => {if (performance.now() - started > config.maxDurationMs) throw Error('BENCHMARK_TIME_LIMIT');};
  const connectionString = env.M3_BENCHMARK_DATABASE_URL;
  const report = {...identity(), kind: 'ardesia-postgres-benchmark', environment: 'isolated-loopback-ci',
    schemaVersion: 2, mode: config.mode, m3Acceptance: 'NOT_EVALUATED',
    measuredBoundary: 'authenticated PostgresStore with Core/projections; separate in-process HTTP handler with JSON encode/decode; no network, TLS or browser rendering',
    percentileMethod: 'nearest-rank; raw ordered samples retained; observed workload is not a production SLA or a capacity estimate',
    workload: {...config, model: 'growing-session', repetitions: 1, mutationOrder: ['rename-document', 'store-add-ink', 'handler-add-ink']},
    boundaries: {store: 'authenticated PostgresStore, Core and authorized projection',
      handler: 'Web Request/Response handler in-process, including JSON serialization; no TCP',
      browser: {status: 'NOT_RUN', reason: 'This runner does not measure pointer events, rendering or frame latency.'}},
    sizes: [], concurrency: null, passed: false};
  let vite, admin, runtime, runtimeRole, sampler, phase = 'configuration';
  try {
    requireLoopbackBenchmark(connectionString);
    const {createServer} = await import('vite');
    vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom', logLevel: 'silent'});
    phase = 'load-server';
    const api = await vite.ssrLoadModule('/@fs/' + resolve('packages/server/src/index.ts'));
    phase = 'load-lesson-os';
    const lesson = await vite.ssrLoadModule('/@fs/' + resolve('packages/lesson-os/src/index.ts'));
    phase = 'prepare-database';
    admin = api.createDatabasePool(connectionString, {max: 1, query_timeout: 30_000});
    // A second invocation refuses a populated database rather than resetting anything.
    const prior = await admin.query("SELECT to_regclass('ardesia_next.workspaces') AS present");
    if (prior.rows[0].present) throw Error('BENCHMARK_DATABASE_NOT_FRESH');
    await api.migrate(admin);
    phase = 'provision-synthetic-accounts';
    const teacher = {id: randomUUID(), username: `bench-${randomUUID()}`, role: 'teacher', displayName: 'Synthetic benchmark', password: randomBytes(24).toString('base64url')};
    const students = Array.from({length: 24}, () => ({id: randomUUID(), username: `bench-${randomUUID()}`, role: 'student', displayName: 'Synthetic student', password: randomBytes(24).toString('base64url')}));
    // Provisioning hashes in parallel internally; respect its bounded derivation queue.
    const syntheticAccounts = [teacher, ...students];
    for (let offset = 0; offset < syntheticAccounts.length; offset += 8) {
      await api.provisionTestAccounts(admin, syntheticAccounts.slice(offset, offset + 8));
    }
    phase = 'restricted-runtime';
    const role = 'bench_' + randomUUID().replaceAll('-', '');
    await admin.query(`CREATE ROLE ${role} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
    runtimeRole = role;
    await admin.query(`GRANT ardesia_next_runtime TO ${runtimeRole}`);
    const runtimeUrl = new URL(connectionString); runtimeUrl.username = runtimeRole; runtimeUrl.password = '';
    const applicationName = `ardesia-benchmark-${randomUUID()}`;
    runtime = api.createDatabasePool(runtimeUrl.href, {max: 5, query_timeout: 30_000, application_name: applicationName});
    const store = api.createPostgresStore({pool: runtime, pluginPolicy: api.createFirstPartyPolicy({artifactRoot: resolve('apps/web/public')})});
    phase = 'authenticate';
    const signedIn = await store.login({action: 'login', username: teacher.username, password: teacher.password});
    const studentSessions = new Map();
    for (const student of students) studentSessions.set(student.id,
      await store.login({action: 'login', username: student.username, password: student.password}));
    const execute = async input => {
      checkDeadline(); const result = await store.execute(signedIn.token, teacher.id, input); checkDeadline(); return result;
    };
    const origin = 'https://benchmark.invalid', handler = api.createApiHandler({store, allowedOrigins: [origin]});
    const throughHandler = async input => {
      checkDeadline();
      const response = await handler(new Request(origin + '/api/m3', {method: 'POST', headers: {
        Origin: origin, 'Content-Type': 'application/json', Cookie: '__Host-ardesia_session=' + signedIn.token, 'X-Ardesia-Account': teacher.id,
      }, body: JSON.stringify(input)}));
      const body = await response.json(); checkDeadline();
      if (response.status !== 200 || body.ok !== true) throw Error('BENCHMARK_HANDLER_REFUSED');
      return body.result;
    };
    function confirmedWrite(result, command) {
      const document = result?.projection?.documents?.find(row => row.id === command.documentId);
      if (result?.receipt?.commandId !== command.commandId || document?.revision !== command.expectedRevision + 1
        || command.kind === 'add-object' && !document.objects.some(object => object.id === command.object.id && object.type === 'ink')) {
        throw Error('BENCHMARK_WRITE_NOT_CONFIRMED');
      }
      return document;
    }
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
      for (let index = 0; index < strokes; index++) {
        await execute({action: 'command', workspaceId: workspace.workspaceId, command: makeInkCommand(documentId, index + 1, config.pointsPerStroke)});
      }
      for (const student of students.slice(0, studentCount)) {
        await execute({action: 'learning-command', workspaceId: workspace.workspaceId,
          command: {kind: 'assign-lesson', commandId: randomUUID(), documentId, studentId: student.id, expectedRevision: 0}});
        await store.execute(studentSessions.get(student.id).token, student.id, {action: 'learning-command', workspaceId: workspace.workspaceId,
          command: {kind: 'save-learner-note', commandId: randomUUID(), documentId, expectedRevision: 0, text: 'Synthetic private learner work'}});
      }
      return {workspaceId: workspace.workspaceId, documentId};
    }
    const read = row => execute({action: 'open-workspace', workspaceId: row.workspaceId});
    const snapshotSize = async row => {
      const stored = (await admin.query(`SELECT octet_length(snapshot::text) AS bytes,jsonb_array_length(snapshot->'events') AS events
        FROM ardesia_next.workspaces WHERE id=$1`, [row.workspaceId])).rows[0];
      return {snapshotJsonBytes: stored.bytes, snapshotEvents: stored.events};
    };
    for (const [strokes, studentCount] of config.profiles) {
      phase = `snapshot-${strokes}`;
      const row = await seed(strokes, studentCount), timings = {reopen: [], lessonOsProjection: [], command: [], inkCommand: [], handlerRead: [], handlerInk: []};
      const sampleInkStrokes = [];
      let roundNumber = 0;
      async function round(record) {
        const capture = async (key, operation) => {const measured = await timed(operation); if (record) timings[key].push(measured.ms); return measured.result;};
        const opened = await capture('reopen', () => read(row));
        const continuity = await capture('lessonOsProjection', () => lesson.projectContinuity(opened.events, row.documentId));
        if (continuity.latestRevision !== opened.documents[0].revision) throw Error('BENCHMARK_PROJECTION_MISMATCH');
        const rename = {kind: 'rename-document', commandId: randomUUID(), documentId: row.documentId,
          expectedRevision: opened.documents[0].revision, title: `Measured ${roundNumber++}`};
        let document = confirmedWrite(await capture('command', () => execute({action: 'command', workspaceId: row.workspaceId, command: rename})), rename);
        const ink = makeInkCommand(row.documentId, document.revision, config.pointsPerStroke);
        document = confirmedWrite(await capture('inkCommand', () => execute({action: 'command', workspaceId: row.workspaceId, command: ink})), ink);
        const reopened = await capture('handlerRead', () => throughHandler({action: 'open-workspace', workspaceId: row.workspaceId}));
        if (reopened.documents[0].revision !== document.revision) throw Error('BENCHMARK_HANDLER_REVISION_MISMATCH');
        const apiInk = makeInkCommand(row.documentId, document.revision, config.pointsPerStroke);
        document = confirmedWrite(await capture('handlerInk', () => throughHandler({action: 'command', workspaceId: row.workspaceId, command: apiInk})), apiInk);
        if (record) sampleInkStrokes.push(document.objects.filter(object => object.type === 'ink').length);
      }
      // Warm every measured operation; seeding and warm-up never enter the sample arrays.
      for (let i = 0; i < config.warmup; i++) await round(false);
      const before = await snapshotSize(row);
      for (let sample = 0; sample < config.samples; sample++) await round(true);
      const after = await snapshotSize(row), opened = await read(row);
      const finalInkStrokes = opened.documents[0].objects.filter(object => object.type === 'ink').length;
      if (finalInkStrokes !== strokes + 2 * (config.warmup + config.samples)
        || opened.documents[0].revision !== strokes + 1 + 3 * (config.warmup + config.samples)) throw Error('BENCHMARK_INK_GROWTH_MISMATCH');
      report.sizes.push({inkStrokes: strokes, initialMeasuredInkStrokes: strokes + 2 * config.warmup, finalInkStrokes,
        sampleInkStrokes, pointsPerStroke: config.pointsPerStroke, assignedStudents: studentCount,
        warmupRounds: config.warmup, measuredRounds: config.samples, before, ...after, documentEvents: opened.events.length,
        commandKind: 'rename-document', ...Object.fromEntries(Object.entries(timings).map(([name, values]) => [name, summarizeSamples(values)]))});
    }
    // Equal, small snapshots for both contention cases; only workspace sharing changes.
    phase = 'concurrency';
    const contention = {};
    for (const shared of [true, false]) {
      const rows = []; for (let i = 0; i < (shared ? 1 : 8); i++) rows.push(await seed(8, 0));
      const successTimes = [], conflictTimes = []; let successful = 0, conflicts = 0;
      for (let round = 0; round < 4; round++) {
        const selected = shared ? Array.from({length: 8}, () => rows[0]) : rows;
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
        meaning: shared ? 'expected CAS refusals from eight writers using the same revision' : 'valid writes in independent workspaces',
        commits: summarizeSamples(successTimes), refusals: conflictTimes.length ? summarizeSamples(conflictTimes) : null};
    }
    clearInterval(sampler); sampler = null; await activeSample;
    report.concurrency = contention; report.monitoring = monitoring; report.elapsedMs = performance.now() - started; report.passed = true;
    return report;
  } catch (error) {
    const code = /^[A-Z_0-9]{1,80}$/.test(error?.code ?? '') ? error.code
      : /^[A-Z_]{1,80}$/.test(error?.message ?? '') ? error.message : 'BENCHMARK_FAILED';
    throw Object.assign(Error('BENCHMARK_FAILED'), {phase, code});
  } finally {
    if (sampler) clearInterval(sampler);
    await runtime?.end();
    if (admin && runtimeRole) await admin.query(`DROP ROLE ${runtimeRole}`);
    await admin?.end(); await vite?.close();
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const report = await runBenchmark(process.env, process.argv.slice(2)); mkdirSync('artifacts', {recursive: true});
    const path = report.mode === 'extended' ? 'artifacts/benchmark-extended.json' : 'artifacts/benchmark.json';
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({kind: report.kind, mode: report.mode, passed: report.passed, commit: report.commit,
      sourceDigest: report.sourceDigest, elapsedMs: report.elapsedMs, report: path,
      sizes: report.sizes.map(row => ({initialInkStrokes: row.initialMeasuredInkStrokes, finalInkStrokes: row.finalInkStrokes,
        snapshotJsonBytes: row.snapshotJsonBytes, samples: row.measuredRounds,
        inkP50Ms: row.inkCommand.p50Ms, inkP95Ms: row.inkCommand.p95Ms,
        handlerInkP50Ms: row.handlerInk.p50Ms, handlerInkP95Ms: row.handlerInk.p95Ms}))}));
  } catch (error) {console.error(JSON.stringify({kind: 'ardesia-postgres-benchmark', passed: false,
    phase: error.phase ?? 'cleanup', code: error.code ?? 'BENCHMARK_FAILED'})); process.exitCode = 1;}
}
