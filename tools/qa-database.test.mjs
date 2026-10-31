import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseIdentity, requireIsolatedRestore, requireLoopbackBenchmark} from './qa-database.mjs';

test('QA refuses resource aliases, credential-only changes, unbound restore targets and remote benchmark writes', () => {
  const source = 'postgres://operator:secret@database.example/source';
  const restore = 'postgres://operator:secret@database.example/restore';
  const expected = databaseIdentity(restore).resourceIdHash;
  assert.equal(requireIsolatedRestore(source, restore, expected).target.name, 'restore');
  for (const target of ['postgres://different@database.example/source', 'postgres://operator@alias.example/source',
    restore + '?host=somewhere', restore + '?port=5433', restore + '?dbname=source']) {
    assert.throws(() => requireIsolatedRestore(source, target, expected));
  }
  assert.throws(() => requireIsolatedRestore(source, restore));
  assert.throws(() => requireIsolatedRestore(source, restore, 'a'.repeat(64)));
  assert.equal(requireLoopbackBenchmark('postgres://postgres@127.0.0.1/ardesia_m3_benchmark').name, 'ardesia_m3_benchmark');
  for (const value of ['postgres://postgres@db.example/ardesia_m3_benchmark', 'postgres://postgres@127.0.0.1/production',
    'postgres://postgres@127.0.0.1/ardesia_m3_benchmark?host=db.example']) assert.throws(() => requireLoopbackBenchmark(value));
  assert.equal(databaseIdentity('postgres://a:first@database.example/restore').resourceIdHash,
    databaseIdentity('postgres://b:second@database.example/restore').resourceIdHash);
});
