import {createHash} from 'node:crypto';

/** Stable non-secret resource identity; credentials and connection parameters are excluded. */
export function databaseIdentity(value) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !/^\/[a-zA-Z0-9_]+$/.test(url.pathname)
    || url.searchParams.has('host') || url.searchParams.has('port') || url.searchParams.has('dbname')) throw Error('EXPLICIT_DATABASE_RESOURCE_REQUIRED');
  const hostname = url.hostname.toLowerCase(), name = url.pathname.slice(1), port = url.port || '5432';
  return {hostname, name, resourceIdHash: createHash('sha256').update(`${hostname}:${port}/${name}`).digest('hex')};
}

export function requireIsolatedRestore(sourceUrl, restoreUrl, expectedRestoreHash) {
  const source = databaseIdentity(sourceUrl), target = databaseIdentity(restoreUrl);
  if (source.resourceIdHash === target.resourceIdHash || source.name === target.name
    || !/^[a-f0-9]{64}$/.test(expectedRestoreHash ?? '') || target.resourceIdHash !== expectedRestoreHash) throw Error('ISOLATED_RESTORE_RESOURCE_REQUIRED');
  return {source, target};
}

export function requireLoopbackBenchmark(value) {
  const info = databaseIdentity(value);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(info.hostname) || info.name !== 'ardesia_m3_benchmark') throw Error('DEDICATED_LOOPBACK_BENCHMARK_REQUIRED');
  return info;
}
