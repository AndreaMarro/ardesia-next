import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';

const [action, file] = process.argv.slice(2);
const actions = ['migrate', 'provision', 'backup', 'restore', 'revoke-sessions'];
if (!actions.includes(action) || (action !== 'migrate' && !file)) {
  console.error('Usage: node tools/database.mjs migrate | provision <accounts.json> | backup <new-file.json> | restore <backup.json> | revoke-sessions <account-id>');
  process.exit(1);
}
if (!process.env.ARDESIA_OPERATOR_DATABASE_URL) {
  console.error('ARDESIA_OPERATOR_DATABASE_URL is required; do not use the application runtime credential.');
  process.exit(1);
}
let vite, pool;
try {
  vite = await createServer({configFile: false, server: {middlewareMode: true}, appType: 'custom', logLevel: 'error'});
  const api = await vite.ssrLoadModule('/@fs/' + resolve('packages/server/src/index.ts'));
  pool = api.createDatabasePool(process.env.ARDESIA_OPERATOR_DATABASE_URL);
  let result;
  if (action === 'migrate') result = await api.migrate(pool);
  if (action === 'provision') {
    const accounts = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(accounts)) throw Error('INVALID_ACCOUNTS');
    await api.provisionTestAccounts(pool, accounts);
    result = {accounts: accounts.length};
  }
  if (action === 'backup') {
    const backup = await api.exportBackup(pool);
    await writeFile(file, JSON.stringify(backup, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    result = {written: true};
  }
  if (action === 'restore') result = await api.restoreBackup(pool, JSON.parse(await readFile(file, 'utf8')));
  if (action === 'revoke-sessions') {await api.revokeAccountSessions(pool, file); result = {revoked: true};}
  console.log(JSON.stringify({operation: action, success: true, result}));
} catch (error) {
  // Operator failures can contain credentials in driver messages; emit only a bounded code.
  const code = typeof error?.code === 'string' && /^[A-Z_0-9]{1,80}$/.test(error.code) ? error.code : 'OPERATION_FAILED';
  console.error(JSON.stringify({operation: action, success: false, code}));
  process.exitCode = 1;
} finally {await pool?.end(); await vite?.close();}
