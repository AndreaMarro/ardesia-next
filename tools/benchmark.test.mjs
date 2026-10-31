import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import * as benchmark from './benchmark.mjs';

test('raw samples retain collection order and independently computed nearest-rank percentiles', () => {
  const values = [9, 1, 5, 3];
  const result = benchmark.summarizeSamples(values);
  assert.deepEqual(result, {samples: 4, samplesMs: [9, 1, 5, 3], p50Ms: 3, p95Ms: 9, maxMs: 9, tailEstimate: 'small-sample-maximum'});
  assert.deepEqual(values, [9, 1, 5, 3]);
  values[0] = 100;
  assert.equal(result.samplesMs[0], 9);
});

test('one hundred observations place p95 below the maximum without claiming production capacity', () => {
  const result = benchmark.summarizeSamples(Array.from({length: 100}, (_, i) => 100 - i));
  assert.equal(result.samples, 100);
  assert.equal(result.p50Ms, 50);
  assert.equal(result.p95Ms, 95);
  assert.equal(result.maxMs, 100);
  assert.equal(result.tailEstimate, 'observed-samples-only');
});

test('empty, negative and non-finite timings cannot become successful statistics', () => {
  for (const values of [[], [-1], [NaN], [Infinity], ['1']]) {
    assert.throws(() => benchmark.summarizeSamples(values), /BENCHMARK_INVALID_SAMPLES/);
  }
});

test('extended mode increases observations and seeds a longer lesson while keeping bounded defaults', () => {
  const smoke = benchmark.benchmarkConfiguration([]);
  const extended = benchmark.benchmarkConfiguration(['--extended']);
  assert.equal(smoke.mode, 'smoke');
  assert.equal(smoke.samples, 12);
  assert.deepEqual(smoke.profiles, [[8, 1], [32, 1], [128, 1], [128, 8], [128, 24]]);
  assert.equal(extended.mode, 'extended');
  assert.equal(extended.samples, 100);
  assert.deepEqual(extended.profiles, [[512, 24]]);
  assert.ok(extended.warmup >= 3 && extended.warmup <= 10);
  assert.ok(extended.maxDurationMs > 0 && extended.maxDurationMs <= 600000);
});

test('unknown or repeated CLI options fail before database work', async () => {
  for (const args of [['--url=postgres://private'], ['--extended', '--extended'], ['--unknown']]) {
    await assert.rejects(benchmark.runBenchmark({}, args), /BENCHMARK_ARGUMENTS_REFUSED/);
  }
});

test('measured pen payload adds a real independently identified ink object with a bounded point count', () => {
  const first = benchmark.makeInkCommand('lesson-a', 7, 32);
  const next = benchmark.makeInkCommand('lesson-a', 8, 32);
  assert.equal(first.kind, 'add-object');
  assert.equal(first.documentId, 'lesson-a');
  assert.equal(first.expectedRevision, 7);
  assert.equal(first.object.type, 'ink');
  assert.equal(first.object.data.points.length, 32);
  assert.deepEqual(first.object.data.points[0], {x: 0, y: 0, pressure: 0.5});
  assert.notEqual(first.commandId, next.commandId);
  assert.notEqual(first.object.id, next.object.id);
  for (const count of [0, -1, 1.5, 257]) assert.throws(() => benchmark.makeInkCommand('lesson-a', 1, count), /BENCHMARK_INVALID_POINTS/);
});

test('remote database targets are refused before any PostgreSQL module is loaded', async () => {
  await assert.rejects(benchmark.runBenchmark({M3_BENCHMARK_DATABASE_URL: 'postgresql://user:private@remote.example/ardesia_m3_benchmark'}),
    {message: 'BENCHMARK_FAILED', phase: 'configuration', code: 'DEDICATED_LOOPBACK_BENCHMARK_REQUIRED'});
});

test('CLI refusals expose a stable reason without echoing supplied private arguments', () => {
  const child = spawnSync(process.execPath, ['tools/benchmark.mjs', '--url=postgresql://user:private@remote.example/data'], {encoding: 'utf8'});
  assert.equal(child.status, 1);
  assert.deepEqual(JSON.parse(child.stderr.trim()), {kind: 'ardesia-postgres-benchmark', passed: false,
    phase: 'configuration', code: 'BENCHMARK_ARGUMENTS_REFUSED'});
  assert.doesNotMatch(child.stdout + child.stderr, /private|remote\.example|postgresql:\/\//);
});

