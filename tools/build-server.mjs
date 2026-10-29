import {build} from 'vite';
import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

/** Emit the complete deployment in one build, without relying on ordering between framework/function builders. */
export async function buildServer({root = projectRoot, outDir = resolve(root, '.vercel/output')} = {}) {
  const staticDir = resolve(root, 'apps/web/dist');
  const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
  const buildInfo = JSON.parse(await readFile(join(staticDir, 'build-info.json'), 'utf8'));
  if (buildInfo.application !== 'ardesia-next' || !/^[a-f0-9]{64}$/.test(buildInfo.sourceDigest)) {
    throw new Error('Build the frontend with source provenance before packaging the server.');
  }
  await rm(outDir, {recursive: true, force: true});
  const functionDir = join(outDir, 'functions/api/m3.func');
  await mkdir(functionDir, {recursive: true});
  const result = await build({
    root, configFile: false, publicDir: false, logLevel: 'warn',
    ssr: {target: 'node', noExternal: true},
    build: {
      ssr: resolve(root, 'server/m3.ts'), target: 'es2023', minify: false, sourcemap: false,
      outDir: functionDir, emptyOutDir: false,
      rolldownOptions: {
        output: {
          format: 'es', entryFileNames: 'index.mjs', codeSplitting: false,
          // pg's optional native-driver branch contains a guarded CommonJS require.
          banner: 'import {createRequire as nodeCreateRequire} from "node:module"; const require = nodeCreateRequire(import.meta.url);',
        },
      },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunks = outputs.flatMap(output => output.output).filter(output => output.type === 'chunk');
  if (chunks.length !== 1 || chunks[0].fileName !== 'index.mjs'
    || chunks[0].imports.some(name => !name.startsWith('node:'))
    || chunks[0].dynamicImports.length) {
    throw new Error('The Node function must bundle every workspace and npm runtime dependency.');
  }
  if ((await readdir(functionDir)).some(name => name.endsWith('.ts'))) throw new Error('TypeScript source is not a runtime artifact.');
  await cp(resolve(root, 'apps/web/public/plugins'), join(functionDir, 'public/plugins'), {recursive: true});
  await writeFile(join(functionDir, '.vc-config.json'), JSON.stringify({
    runtime: 'nodejs24.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30,
  }, null, 2) + '\n');
  await cp(staticDir, join(outDir, 'static'), {recursive: true});
  const headers = (config.headers ?? []).map(block => ({src: block.source,
    headers: Object.fromEntries(block.headers.map(header => [header.key, header.value])), continue: true}));
  await writeFile(join(outDir, 'config.json'), JSON.stringify({version: 3, routes: [
    ...headers,
    {src: '^/api/m3/?$', dest: '/api/m3'},
    {handle: 'filesystem'},
    {src: '^/(?!api(?:/|$)).*$', dest: '/index.html'},
  ]}, null, 2) + '\n');
  console.log('Vercel Node function: bundled workspaces, PostgreSQL driver and immutable plugin assets.');
  return {outDir, functionDir, handler: join(functionDir, 'index.mjs'), buildInfo};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildServer({outDir: process.argv[2] ? resolve(process.argv[2]) : undefined});
}
