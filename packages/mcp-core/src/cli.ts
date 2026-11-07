import {mkdir, open, unlink} from 'node:fs/promises';
import {dirname, isAbsolute} from 'node:path';
import {serveStdio, StdioServerTransport} from '@modelcontextprotocol/server/stdio';
import {canonicalJson} from '@ardesia/contracts';
import {z} from 'zod';
import {createMcpServer} from './index';
import {AdapterError, ConfigSchema, fail, OriginSchema, readConfig, type McpConfig} from './config';
import {SessionSchema, WorkspaceSummarySchema} from './adapter';
import {MAX_REQUEST_BYTES, post} from './http';
import {terminalQuestion as question} from './prompt';
const terminalText = (text: string) => text.replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, ' ');

async function configure(path: string, origin: string, writable: boolean) {
  if (!OriginSchema.safeParse(origin).success) return fail('CONFIGURATION_INVALID');
  // Exclusive create before acquiring a new session; never overwrite an existing one or follow a link.
  await mkdir(dirname(path), {recursive: true, mode: 0o700});
  const file = await open(path, 'wx', 0o600);
  let saved = false, config: McpConfig | undefined;
  try {
    const username = await question('Utente Ardesia: '), password = await question('Password (nascosta): ', true);
    const login = await post(origin, {action: 'login', username, password});
    const session = SessionSchema.parse(login.result), sessionToken = login.cookie?.split(';')[0]?.split('=')[1];
    if (!sessionToken || !/^[a-f0-9]{64}$/.test(sessionToken)) return fail('INVALID_RESPONSE');
    // Keep auth for cleanup even if the user cannot finish selecting a workspace.
    config = {version: 1, origin, accountId: session.account.id, role: session.account.role, sessionToken, access: 'read-only', workspaceIds: []};
    const workspaces = z.array(WorkspaceSummarySchema).parse((await post(origin, {action: 'list-workspaces'}, config)).result);
    if (!workspaces.length) return fail('NO_WORKSPACES');
    workspaces.forEach((entry, index) => process.stderr.write(`${index + 1}. ${terminalText(entry.title)} (${entry.workspaceId})\n`));
    const choice = await question('Numeri degli spazi da autorizzare, separati da virgola: ');
    if (!/^\d+(\s*,\s*\d+)*$/.test(choice)) return fail('CONFIGURATION_INVALID');
    const selected = choice.split(',').map(value => workspaces[Number(value.trim()) - 1]?.workspaceId);
    if (selected.some(value => !value)) return fail('CONFIGURATION_INVALID');
    config = ConfigSchema.parse({...config, access: writable ? 'read-write' : 'read-only', workspaceIds: selected});
    await file.writeFile(JSON.stringify(config, null, 2) + '\n', 'utf8'); await file.sync(); saved = true;
    process.stderr.write(`Accesso ${writable ? 'in lettura e scrittura nei tuoi spazi; sola lettura negli spazi assegnati' : 'in sola lettura'} configurato. Sessione valida fino a ${session.expiresAt}.\n`);
  } finally {
    await file.close();
    if (!saved) {
      if (config) await post(config.origin, {action: 'logout'}, config).catch(() => undefined);
      await unlink(path);
    }
  }
}

async function main() {
  const [mode = 'serve', ...args] = process.argv.slice(2), flags = new Map<string, string>();
  if (!['serve', 'configure', 'logout'].includes(mode)) return fail('CLI_ARGUMENTS_INVALID');
  for (let i = 0; i < args.length; i++) {
    const key = args[i]!;
    if (!['--config', '--origin', '--write'].includes(key) || flags.has(key)) return fail('CLI_ARGUMENTS_INVALID');
    if (key === '--write') flags.set(key, 'true');
    else {const value = args[++i]; if (!value || value.startsWith('--')) return fail('CLI_ARGUMENTS_INVALID'); flags.set(key, value);}
  }
  const path = flags.get('--config') ?? process.env.ARDESIA_MCP_CONFIG;
  if (!path || !isAbsolute(path) || mode !== 'configure' && (flags.has('--origin') || flags.has('--write'))) return fail('CLI_ARGUMENTS_INVALID');
  if (mode === 'configure') return configure(path, flags.get('--origin') ?? '', flags.has('--write'));
  const config = await readConfig(path);
  if (mode === 'logout') {
    try {await post(config.origin, {action: 'logout'}, config);}
    catch (error) {if (!(error instanceof AdapterError) || error.code !== 'UNAUTHENTICATED') throw error;}
    await unlink(path); process.stderr.write('Sessione MCP revocata e file locale rimosso.\n'); return;
  }
  const configuration = canonicalJson(config);
  const handle = serveStdio(() => createMcpServer(config, {async checkConfiguration() {
    if (canonicalJson(await readConfig(path)) !== configuration) fail('CONFIGURATION_CHANGED');
  }}), {transport: new StdioServerTransport(process.stdin, process.stdout, {maxBufferSize: MAX_REQUEST_BYTES}),
    onerror: () => process.stderr.write('Ardesia MCP: errore di protocollo.\n'), maxSubscriptions: 0});
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {void handle.close();});
}
main().catch(error => {
  process.stderr.write(`Ardesia MCP: ${error instanceof AdapterError ? error.code : 'CONFIGURATION_OR_STARTUP_FAILED'}.\n`);
  process.exitCode = 1;
});
