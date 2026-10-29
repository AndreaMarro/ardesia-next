import {createServer as createViteServer} from 'vite';
import {spawn} from 'node:child_process';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {cp, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {identity} from './evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://ardesia-bundle.test';
const digest = value => createHash('sha256').update(value).digest('hex');
const requireCheck = (condition, code) => {if (!condition) throw Object.assign(new Error(code), {smokeCode: code});};

// This child has no Vite loader, TypeScript sources, application node_modules or operator credentials.
const nativeRunner = `import {createServer} from 'node:http';
try {
  const {default: handler} = await import('./function/index.mjs');
  if (typeof handler !== 'function') throw new Error('handler');
  const server = createServer((req,res) => Promise.resolve(handler(req,res)).catch(() => {
    if (!res.headersSent) res.writeHead(503, {'Content-Type':'application/json'});
    res.end('{"ok":false}');
  }));
  server.on('error', () => {process.send?.({type:'failure'}); process.exit(1);});
  server.listen(0,'127.0.0.1',() => process.send?.({type:'ready',port:server.address().port}));
  process.on('message', message => {
    if (message?.type === 'stop') {
      server.close(() => process.exit(0)); server.closeAllConnections();
      setTimeout(() => process.exit(0),1000).unref();
    }
  });
} catch {process.send?.({type:'failure'}); process.exit(1);}
`;

/** Exercise the deployed Node artifact against an isolated, disposable PostgreSQL database. */
export async function verifyServerBundle({outDir = resolve(root, '.vercel/output')} = {}) {
  const startedAt = Date.now(), source = identity();
  const report = {...source, schemaVersion: 1, kind: 'ardesia-server-runtime-local', remoteAcceptance: false,
    runtime: process.version, checks: [], passed: false};
  let phase = 'configuration', failure, setup, admin, operator, probe, temporary, child, port, cookie;
  let databaseCreated = false, roleCreated = false;
  const suffix = randomUUID().replaceAll('-', '');
  const database = `m3_${suffix}_bundle_test`, role = `m3_bundle_${suffix}`;
  const accountId = `teacher-bundle-${suffix}`, password = randomBytes(32).toString('hex');
  const runtimePassword = randomBytes(32).toString('hex');
  const pass = name => report.checks.push({name, passed: true});

  async function start(connectionString) {
    child = spawn(process.execPath, [join(temporary, 'runner.mjs')], {cwd: temporary,
      env: {PATH: process.env.PATH ?? '', NODE_ENV: 'test', ARDESIA_APP_ORIGIN: origin,
        ...(connectionString ? {ARDESIA_DATABASE_URL: connectionString} : {})},
      stdio: ['ignore', 'ignore', 'ignore', 'ipc']});
    const [message] = await once(child, 'message', {signal: AbortSignal.timeout(15_000)});
    requireCheck(message?.type === 'ready' && Number.isInteger(message.port), 'NATIVE_BOOTSTRAP_FAILED');
    port = message.port;
  }
  async function stop() {
    if (!child) return;
    const current = child; child = undefined;
    if (current.exitCode !== null || current.signalCode !== null) return;
    const exited = once(current, 'exit');
    const timer = setTimeout(() => current.kill('SIGKILL'), 5_000);
    try {current.send({type: 'stop'}); await exited;} finally {clearTimeout(timer);}
  }
  async function post(body, expected = 200, authenticated = true) {
    const response = await fetch(`http://127.0.0.1:${port}/api/m3`, {method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: {Origin: origin, 'Content-Type': 'application/json',
        ...(authenticated ? {Cookie: cookie, 'X-Ardesia-Account': accountId} : {})}, body: JSON.stringify(body)});
    requireCheck(response.status === expected, 'UNEXPECTED_HTTP_STATUS');
    const bodyResult = await response.json();
    requireCheck(bodyResult.ok === (expected < 400), 'INVALID_HTTP_ENVELOPE');
    return {result: bodyResult.result, error: bodyResult.error, headers: response.headers};
  }
  async function login() {
    const response = await post({action: 'login', username: accountId, password}, 200, false);
    requireCheck(response.result.account.id === accountId && response.result.account.role === 'teacher', 'ACCOUNT_MISMATCH');
    const value = response.headers.get('set-cookie') ?? '';
    requireCheck(['HttpOnly', 'Secure', 'SameSite=Strict'].every(flag => value.includes(flag)), 'COOKIE_FLAGS_MISSING');
    cookie = value.split(';')[0];
  }

  try {
    requireCheck(resolve(process.cwd()) === resolve(root), 'RUN_FROM_REPOSITORY_ROOT');
    requireCheck(process.versions.node.split('.')[0] === '24', 'NODE24_REQUIRED');
    const configured = process.env.M3_TEST_DATABASE_URL;
    requireCheck(typeof configured === 'string' && configured.length > 0, 'TEST_DATABASE_REQUIRED');
    const address = new URL(configured);
    requireCheck(['postgres:', 'postgresql:'].includes(address.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname)
      && address.pathname.endsWith('_test'), 'DEDICATED_LOOPBACK_TEST_DATABASE_REQUIRED');

    phase = 'artifact-provenance';
    const buildInfo = JSON.parse(await readFile(join(outDir, 'static/build-info.json'), 'utf8'));
    requireCheck(buildInfo.commit === source.commit && buildInfo.sourceDigest === source.sourceDigest, 'STALE_BUILD_ARTIFACT');
    const functionDir = join(outDir, 'functions/api/m3.func');
    const functionConfig = JSON.parse(await readFile(join(functionDir, '.vc-config.json'), 'utf8'));
    requireCheck(functionConfig.runtime === 'nodejs24.x' && functionConfig.launcherType === 'Nodejs'
      && functionConfig.handler === 'index.mjs', 'INVALID_NODE_FUNCTION_CONFIG');
    report.functionSha256 = digest(await readFile(join(functionDir, 'index.mjs')));
    temporary = await mkdtemp(join(tmpdir(), 'ardesia-bundle-regression-'));
    await cp(functionDir, join(temporary, 'function'), {recursive: true});
    await writeFile(join(temporary, 'runner.mjs'), nativeRunner);

    phase = 'unconfigured-native-bootstrap';
    await start();
    const unavailable = await fetch(`http://127.0.0.1:${port}/api/m3`, {signal: AbortSignal.timeout(15_000)});
    requireCheck(unavailable.status === 503 && (await unavailable.json()).result.configured === false, 'UNCONFIGURED_SERVICE_NOT_CLOSED');
    await stop(); pass('isolated-native-bootstrap');

    phase = 'disposable-postgres-setup';
    setup = await createViteServer({root, configFile: false, appType: 'custom', server: {middlewareMode: true}});
    const api = await setup.ssrLoadModule('@ardesia/server');
    admin = api.createDatabasePool(configured, {max: 1});
    await admin.query(`CREATE DATABASE ${database} ENCODING 'UTF8' TEMPLATE template0`); databaseCreated = true;
    address.pathname = '/' + database;
    operator = api.createDatabasePool(address.href, {max: 1});
    await api.migrate(operator);
    await api.provisionTestAccounts(operator, [{id: accountId, username: accountId, displayName: 'Synthetic bundle teacher', role: 'teacher', password}]);
    // Names and the password use only generated hexadecimal characters, never caller-supplied SQL.
    await admin.query(`CREATE ROLE ${role} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${runtimePassword}'`); roleCreated = true;
    await admin.query(`GRANT ardesia_next_runtime TO ${role}`);
    address.username = role; address.password = runtimePassword;
    const runtimeUrl = address.href;
    probe = api.createDatabasePool(runtimeUrl, {max: 1});
    const permissions = (await probe.query(`SELECT current_user AS login,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,
      has_table_privilege(current_user,'ardesia_next.accounts','INSERT') AS provision,
      has_schema_privilege(current_user,'ardesia_next','CREATE') AS ddl FROM pg_roles WHERE rolname=current_user`)).rows[0];
    requireCheck(permissions.login === role && ['rolsuper', 'rolcreatedb', 'rolcreaterole', 'rolbypassrls', 'provision', 'ddl']
      .every(key => permissions[key] === false), 'RUNTIME_ROLE_NOT_RESTRICTED');
    await probe.end(); probe = undefined; pass('restricted-postgres-runtime');

    phase = 'authenticated-core-write';
    await start(runtimeUrl); await login();
    const workspace = (await post({action: 'create-workspace', commandId: randomUUID(), title: 'Compiled function regression'})).result;
    const documentId = randomUUID(), objectId = randomUUID(), instanceId = randomUUID();
    const command = async (value, action = 'command', status = 200) => post({action, workspaceId: workspace.workspaceId,
      command: {commandId: randomUUID(), ...value}}, status);
    await command({kind: 'create-document', documentId, expectedRevision: 0, title: 'Persisted compiled Worker'});

    phase = 'signed-worker-execution';
    const manifest = JSON.parse(await readFile(join(temporary, 'function/public/plugins/ideal-spring/1.0.0/manifest.json'), 'utf8'));
    const release = {pluginId: manifest.id, version: manifest.version, bundleDigest: manifest.integrity.digest,
      publisher: manifest.publisher, license: manifest.license, provenance: manifest.provenance, sdkVersion: manifest.sdkVersion,
      stateSchemaVersion: manifest.stateSchemaVersion, capabilities: manifest.capabilities};
    report.pluginSha256 = digest(await readFile(join(temporary, 'function/public/plugins/ideal-spring/1.0.0/plugin.js')));
    requireCheck(report.pluginSha256 === release.bundleDigest, 'PLUGIN_BYTES_CHANGED');
    for (const value of [{kind: 'install-plugin', expectedRevision: 0, release},
      {kind: 'consent-plugin', expectedRevision: 1, releaseDigest: release.bundleDigest, capabilities: release.capabilities},
      {kind: 'activate-plugin', expectedRevision: 2}]) await command({...value, pluginId: release.pluginId}, 'plugin-command');
    const state = {schemaVersion: '1.0.0', value: {massKg: 4, stiffnessNPerM: 4, initialDisplacementM: 0.25, initialVelocityMPerS: 0, timeS: 0}};
    const object = {id: objectId, type: 'lab', title: 'Molla', x: 0, y: 0, width: 300, height: 200,
      data: {pluginId: release.pluginId, pluginVersion: release.version, instanceId, stateSchemaVersion: release.stateSchemaVersion,
        bundleDigest: release.bundleDigest, publisher: release.publisher, state}};
    const added = (await command({kind: 'add-object', documentId, expectedRevision: 1, object})).result;
    await command({kind: 'add-object', documentId, expectedRevision: 2, object: {...object, id: randomUUID(),
      data: {...object.data, instanceId: randomUUID(), state: {...state, value: {...state.value, massKg: 11}}}}}, 'command', 422);
    pass('authenticated-persisted-worker');

    phase = 'cold-reopen-and-logout';
    const firstCookie = cookie;
    await stop(); await start(runtimeUrl); await login();
    requireCheck(cookie !== firstCookie, 'SESSION_NOT_INDEPENDENT');
    const reopened = (await post({action: 'open-workspace', workspaceId: workspace.workspaceId})).result;
    const document = reopened.documents[0], recovered = document?.objects[0];
    requireCheck(reopened.workspaceRevision === added.projection.workspaceRevision && reopened.documents.length === 1
      && document.id === documentId && document.revision === 2 && document.objects.length === 1
      && recovered.id === objectId && recovered.data.instanceId === instanceId
      && isDeepStrictEqual(recovered.data.state, state), 'PERSISTED_LAB_MISMATCH');
    await post({action: 'logout'}); await post({action: 'session'}, 401);
    pass('cold-reopen-and-logout');
  } catch (error) {
    failure = {phase, code: error?.smokeCode ?? 'UNEXPECTED_FAILURE'};
  } finally {
    async function cleanup(name, operation) {
      try {await operation();} catch {failure ??= {phase: 'cleanup', code: name};}
    }
    await cleanup('CHILD_STOP_FAILED', stop);
    await cleanup('POOL_CLOSE_FAILED', async () => {await probe?.end(); await operator?.end();});
    if (databaseCreated) await cleanup('DATABASE_DROP_FAILED', () => admin.query(`DROP DATABASE ${database} WITH (FORCE)`));
    if (roleCreated) await cleanup('ROLE_DROP_FAILED', () => admin.query(`DROP ROLE ${role}`));
    await cleanup('ADMIN_CLOSE_FAILED', async () => {await admin?.end(); await setup?.close();});
    if (temporary) await cleanup('ARTIFACT_CLEANUP_FAILED', () => rm(temporary, {recursive: true, force: true}));
  }
  const completedSource = identity();
  if (!failure && (completedSource.commit !== source.commit || completedSource.sourceDigest !== source.sourceDigest)) {
    failure = {phase: 'source-provenance', code: 'SOURCE_CHANGED_DURING_TEST'};
  }
  if (!failure) pass('isolated-resource-cleanup');
  report.passed = !failure; report.durationMs = Date.now() - startedAt;
  if (failure) report.failure = failure;
  await mkdir(resolve(root, 'artifacts'), {recursive: true});
  await writeFile(resolve(root, 'artifacts/server-runtime.json'), JSON.stringify(report, null, 2) + '\n');
  if (failure) throw new Error(`Server bundle regression failed: ${failure.phase}/${failure.code}`);
  console.log(`Server bundle regression: PASS (${report.checks.length} checks; native Node, isolated PostgreSQL and signed Worker).`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {await verifyServerBundle({outDir: process.argv[2] ? resolve(process.argv[2]) : undefined});}
  catch (error) {console.error(error.message); process.exitCode = 1;}
}
