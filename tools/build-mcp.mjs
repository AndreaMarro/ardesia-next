import {build} from 'vite';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {identity} from './evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildMcp() {
  const outDir = resolve(root, 'packages/mcp-core/dist');
  const result = await build({root, configFile: false, publicDir: false, logLevel: 'warn', ssr: {target: 'node', noExternal: true},
    build: {ssr: resolve(root, 'packages/mcp-core/src/cli.ts'), target: 'es2023', outDir, emptyOutDir: true, minify: false,
      rolldownOptions: {output: {format: 'es', entryFileNames: 'ardesia-mcp.mjs', codeSplitting: false}}}});
  const chunks = (Array.isArray(result) ? result : [result]).flatMap(output => output.output).filter(output => output.type === 'chunk');
  if (chunks.length !== 1 || chunks[0].imports.some(name => !name.startsWith('node:')) || chunks[0].dynamicImports.length) {
    throw new Error('MCP CLI must bundle all non-Node dependencies.');
  }
  const artifact = await readFile(resolve(outDir, 'ardesia-mcp.mjs'));
  await mkdir(outDir, {recursive: true});
  await writeFile(resolve(outDir, 'build-info.json'), JSON.stringify({...identity(), application: 'ardesia-mcp-core',
    sdk: '2.4.0', transport: 'stdio', artifactSha256: createHash('sha256').update(artifact).digest('hex')}, null, 2) + '\n');
  const notices = [];
  for (const name of ['@modelcontextprotocol/server', '@modelcontextprotocol/core', 'zod']) {
    const metadata = JSON.parse(await readFile(resolve(root, 'node_modules', name, 'package.json'), 'utf8'));
    notices.push(`${name}@${metadata.version}\n${await readFile(resolve(root, 'node_modules', name, 'LICENSE'), 'utf8')}`);
  }
  await writeFile(resolve(outDir, 'THIRD_PARTY_NOTICES.txt'), notices.join('\n\n'));
  console.log('MCP Core: standalone stdio artifact, separate from the browser/server deployment.');
  return outDir;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await buildMcp();
