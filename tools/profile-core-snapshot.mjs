import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {cpus, platform, release, arch} from 'node:os';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createServer} from 'vite';
import {identity} from './evidence.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const summary = values => {
  const sorted = values.toSorted((a, b) => a - b);
  return {samplesMs: values, samples: values.length, p50Ms: sorted[Math.ceil(sorted.length * .5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted.at(-1)};
};

/** CPU-only counterexperiment for the createCore path used by PostgresStore.openLocked. */
export async function profileCoreSnapshot(baselineRoot) {
  const candidateRoot = process.cwd();
  baselineRoot = resolve(baselineRoot);
  const roots = {baseline: baselineRoot, candidate: candidateRoot};
  const servers = [], modules = {}, sources = {};
  try {
    for (const [name, root] of Object.entries(roots)) {
      const git = args => execFileSync('git', ['-C', root, ...args], {encoding: 'utf8'}).trim();
      sources[name] = {commit: git(['rev-parse', 'HEAD']),
        coreBlobSha256: sha256(readFileSync(resolve(root, 'packages/core/src/index.ts'))),
        contractsBlobSha256: sha256(readFileSync(resolve(root, 'packages/contracts/src/index.ts'))),
        lockfileSha256: sha256(readFileSync(resolve(root, 'package-lock.json')))};
      const server = await createServer({root, configFile: false, logLevel: 'silent', appType: 'custom',
        server: {middlewareMode: true}, resolve: {alias: {
          '@ardesia/contracts': resolve(root, 'packages/contracts/src/index.ts'),
        }}});
      servers.push(server);
      modules[name] = {core: await server.ssrLoadModule('/@fs/' + resolve(root, 'packages/core/src/index.ts')),
        contracts: await server.ssrLoadModule('/@fs/' + resolve(root, 'packages/contracts/src/index.ts'))};
    }
    assert.equal(sources.baseline.lockfileSha256, sources.candidate.lockfileSha256);
    assert.equal(sources.baseline.contractsBlobSha256, sources.candidate.contractsBlobSha256);
    let serial = 0;
    const id = () => '00000000-0000-4000-8000-' + String(++serial).padStart(12, '0');
    const teacher = {actorId: id(), role: 'teacher'}, documentId = id();
    let stored = null;
    const core = await modules.baseline.core.createCore({storage: {read: async () => stored,
      write: async snapshot => {stored = snapshot;}}, workspaceId: id(), id,
      clock: () => '2026-11-02T00:00:00.000Z'});
    let revision = 0;
    const command = async input => {
      const receipt = await core.execute(teacher, {...input, commandId: id(), documentId, expectedRevision: revision});
      revision = receipt.documentRevision;
    };
    await command({kind: 'create-document', title: 'Bounded benchmark'});
    const ink = index => command({kind: 'add-object', object: {id: id(), type: 'ink', title: 'Synthetic stroke',
      x: 0, y: 0, width: 100, height: 100, data: {points: Array.from({length: 32}, (_, i) => ({x: i, y: index % 100, pressure: .5})),
        width: 2, color: '#151515'}}});
    for (let i = 0; i < 512; i++) await ink(i);
    for (let i = 0; i < 24; i++) {
      const student = {actorId: id(), role: 'student'};
      await core.executeLearning(teacher, {kind: 'assign-lesson', commandId: id(), documentId,
        studentId: student.actorId, expectedRevision: 0});
      await core.executeLearning(student, {kind: 'save-learner-note', commandId: id(), documentId,
        expectedRevision: 0, text: 'Synthetic private learner work'});
    }
    const fixtures = [];
    for (let round = 0; round < 110; round++) {
      await command({kind: 'rename-document', title: `Measured ${round}`});
      await ink(512 + round * 2); await ink(513 + round * 2);
      if (round === 9 || round === 109) fixtures.push(core.snapshot());
    }
    const profiles = [];
    for (const snapshot of fixtures) {
      const original = JSON.stringify(snapshot);
      let writes = 0;
      const storage = {read: async () => snapshot, write: async () => {writes++; throw Error('READ_ONLY_PROFILE');}};
      const samples = {baselineOpen: [], candidateOpen: [], legacyProbe: [], currentValidation: [], clone: []};
      const open = async name => modules[name].core.createCore({storage});
      for (let i = 0; i < 10; i++) for (const name of ['baseline', 'candidate']) await open(name);
      const order = [];
      for (let i = 0; i < 30; i++) {
        const pair = i % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'];
        order.push(pair);
        for (const name of pair) {
          const start = performance.now(); await open(name);
          samples[name + 'Open'].push(performance.now() - start);
        }
        // These calibration operations are separate measurements, not additive phase shares.
        for (const phase of i % 2 ? ['clone', 'currentValidation', 'legacyProbe'] : ['legacyProbe', 'currentValidation', 'clone']) {
          const start = performance.now();
          if (phase === 'clone') structuredClone(snapshot);
          else if (phase === 'currentValidation') assert.ok(modules.baseline.contracts.CoreSnapshotSchema.safeParse(snapshot).success);
          else modules.baseline.contracts.migrateSnapshotForOpen(snapshot);
          samples[phase].push(performance.now() - start);
        }
      }
      for (const name of ['baseline', 'candidate']) assert.deepEqual((await open(name)).snapshot(), snapshot);
      assert.equal(JSON.stringify(snapshot), original); assert.equal(writes, 0);
      profiles.push({inkStrokes: snapshot.documents[0].objects.length, pointsPerStroke: 32, assignedStudents: 24,
        events: snapshot.events.length, receipts: snapshot.receipts.length, snapshotJsonBytes: Buffer.byteLength(original),
        fixtureSha256: sha256(original), pairOrder: order,
        timings: Object.fromEntries(Object.entries(samples).map(([key, values]) => [key, summary(values)])),
        pairedSavedMs: summary(samples.baselineOpen.map((value, index) => value - samples.candidateOpen[index])),
        correctness: {baselineAndCandidateEqualFixture: true, inputUnchanged: true, writes}});
    }
    return {...identity(), kind: 'ardesia-core-snapshot-profile', sources,
      environment: {node: process.version, platform: platform(), osRelease: release(), arch: arch(), cpu: cpus()[0]?.model,
        cpuCount: cpus().length, vite: JSON.parse(readFileSync(resolve('node_modules/vite/package.json'))).version},
      hypothesis: 'Current v4 snapshots incur discarded legacy v1/v2/v3 schema traversal before current integrity validation.',
      measuredBoundary: 'Public createCore reopening an identical in-memory snapshot; storage read returns the same object as PostgresStore storage.read. No PostgreSQL, authentication, transaction, HTTP, TLS or rendering timing.',
      workload: {reference: 'PR18 extended 174d15bb: 512 seeded strokes, 24 assignments and notes, 10 warmup and 100 growing rounds of rename plus two ink commands',
        model: 'fixed-endpoint CPU counterexperiment, not a rerun of the original PostgreSQL extended benchmark', warmup: 10, pairs: 30,
        percentileMethod: 'nearest-rank observed samples; paired differences retained; calibration timings are not additive phase shares'},
      profiles, m3Acceptance: 'NOT_EVALUATED', passed: true};
  } finally {for (const server of servers) await server.close();}
}

if (process.argv[1] && resolve(process.argv[1]) === resolve('tools/profile-core-snapshot.mjs')) {
  if (process.argv.length !== 3) throw Error('Usage: node tools/profile-core-snapshot.mjs BASELINE_ROOT');
  const report = await profileCoreSnapshot(process.argv[2]);
  mkdirSync('artifacts', {recursive: true});
  writeFileSync('artifacts/core-snapshot-profile.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({passed: report.passed, sources: report.sources,
    profiles: report.profiles.map(({inkStrokes, timings, pairedSavedMs}) => ({inkStrokes,
      baselineP50Ms: timings.baselineOpen.p50Ms, candidateP50Ms: timings.candidateOpen.p50Ms,
      legacyProbeP50Ms: timings.legacyProbe.p50Ms, pairedSavedP50Ms: pairedSavedMs.p50Ms}))}));
}
