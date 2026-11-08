import {constants} from 'node:fs';
import {access, lstat, mkdir, open, readdir, realpath, rm, stat, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {crc32, inflateRawSync} from 'node:zlib';

// Fail closed if the trusted verifier changes these shared export budgets.
export const BUNDLE_LIMITS = Object.freeze({maxEntries: 512, maxZipBytes: 128 * 1024 ** 2,
  maxTotalBytes: 256 * 1024 ** 2, maxFileBytes: 64 * 1024 ** 2, maxRatio: 200});
const LOCAL_LIMITS = Object.freeze({maxPages: 250, maxCacheBytes: 512 * 1024 ** 2,
  maxCacheFiles: 20000, maxCacheDirectories: 20000, maxCacheDepth: 32,
  maxLogBytes: 8 * 1024 ** 2, maxRenderedBytes: 256 * 1024 ** 2});
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const requireCheck = (condition, code) => {if (!condition) throw new Error(code);};
const inside = (parent, child) => child === parent || child.startsWith(parent + sep);
const utf8 = new TextDecoder('utf-8', {fatal: true});

function safeName(name) {
  requireCheck(name.length > 0 && name.length <= 240 && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name), 'ZIP_UNSAFE_PATH');
  requireCheck(name.split('/').every(part => part && part !== '.' && part !== '..' && !part.endsWith('.')), 'ZIP_UNSAFE_PATH');
  requireCheck(!name.split('/').some(part => /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)), 'ZIP_RESERVED_PATH');
}
function extras(bytes, start, size) {
  const end = start + size;
  while (start < end) {
    requireCheck(start + 4 <= end, 'ZIP_EXTRA_TRUNCATED');
    const kind = bytes.readUInt16LE(start), length = bytes.readUInt16LE(start + 2);
    requireCheck(![0x0001, 0x7075, 0x9901].includes(kind), 'ZIP_UNSUPPORTED_EXTRA');
    start += 4 + length; requireCheck(start <= end, 'ZIP_EXTRA_TRUNCATED');
  }
}

/** Restricted classic ZIP preflight, before any decompression or filesystem extraction.
 * The browser emits ordinary stored/deflated files. ZIP64, volumes, aliases and
 * special files are deliberately unsupported. Node zlib performs bounded inflate.
 */
export function inspectZip(input, limits = BUNDLE_LIMITS) {
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  requireCheck(bytes.length >= 22 && bytes.length <= limits.maxZipBytes, 'ZIP_SIZE_LIMIT');
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 65535); at--) {
    if (bytes.readUInt32LE(at) === 0x06054b50 && at + 22 + bytes.readUInt16LE(at + 20) === bytes.length) {end = at; break;}
  }
  requireCheck(end >= 0, 'ZIP_END_MISSING');
  const count = bytes.readUInt16LE(end + 10), centralSize = bytes.readUInt32LE(end + 12), centralStart = bytes.readUInt32LE(end + 16);
  requireCheck(bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0 && bytes.readUInt16LE(end + 8) === count, 'ZIP_MULTIVOLUME');
  requireCheck(count !== 65535 && centralStart !== 0xffffffff && centralSize !== 0xffffffff, 'ZIP64_UNSUPPORTED');
  requireCheck(count > 0 && count <= limits.maxEntries, 'ZIP_ENTRY_LIMIT');
  requireCheck(centralStart + centralSize === end, 'ZIP_CENTRAL_RANGE');
  const entries = [], names = new Set(); let cursor = centralStart, total = 0;
  for (let index = 0; index < count; index++) {
    requireCheck(cursor + 46 <= end && bytes.readUInt32LE(cursor) === 0x02014b50, 'ZIP_CENTRAL_TRUNCATED');
    const needed = bytes.readUInt16LE(cursor + 6), flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10);
    const checksum = bytes.readUInt32LE(cursor + 16), compressed = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32);
    const attributes = bytes.readUInt32LE(cursor + 38), offset = bytes.readUInt32LE(cursor + 42);
    requireCheck(needed <= 20 && ![compressed, size, offset].includes(0xffffffff), 'ZIP64_UNSUPPORTED');
    requireCheck((flags & ~0x080e) === 0 && [0, 8].includes(method) && (method !== 0 || !(flags & 6)), 'ZIP_METHOD_OR_FLAGS');
    requireCheck(bytes.readUInt16LE(cursor + 34) === 0, 'ZIP_MULTIVOLUME');
    const mode = (attributes >>> 16) & 0xf000;
    requireCheck((mode === 0 || mode === 0x8000) && !(attributes & 0x10), 'ZIP_SPECIAL_FILE');
    const recordEnd = cursor + 46 + nameLength + extraLength + commentLength;
    requireCheck(recordEnd <= end, 'ZIP_CENTRAL_TRUNCATED');
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength), name = utf8.decode(nameBytes);
    safeName(name); const folded = name.toLowerCase();
    requireCheck(!names.has(folded), 'ZIP_DUPLICATE_PATH'); names.add(folded);
    extras(bytes, cursor + 46 + nameLength, extraLength);
    requireCheck(size <= limits.maxFileBytes && compressed <= limits.maxZipBytes, 'ZIP_FILE_LIMIT');
    requireCheck(size === 0 || compressed > 0 && size <= compressed * limits.maxRatio, 'ZIP_RATIO_LIMIT');
    requireCheck(method !== 0 || compressed === size, 'ZIP_STORED_SIZE');
    total += size; requireCheck(total <= limits.maxTotalBytes, 'ZIP_TOTAL_LIMIT');
    requireCheck(offset + 30 <= centralStart && bytes.readUInt32LE(offset) === 0x04034b50, 'ZIP_LOCAL_HEADER');
    requireCheck(bytes.readUInt16LE(offset + 4) === needed && bytes.readUInt16LE(offset + 6) === flags && bytes.readUInt16LE(offset + 8) === method, 'ZIP_LOCAL_MISMATCH');
    const localName = bytes.readUInt16LE(offset + 26), localExtra = bytes.readUInt16LE(offset + 28), dataStart = offset + 30 + localName + localExtra;
    requireCheck(dataStart <= centralStart && localName === nameLength && bytes.subarray(offset + 30, offset + 30 + localName).equals(nameBytes), 'ZIP_LOCAL_NAME');
    extras(bytes, offset + 30 + localName, localExtra);
    for (const [at, expected] of [[14, checksum], [18, compressed], [22, size]]) {
      const value = bytes.readUInt32LE(offset + at);
      requireCheck(value === expected || !!(flags & 8) && value === 0, 'ZIP_LOCAL_MISMATCH');
    }
    requireCheck(dataStart + compressed <= centralStart, 'ZIP_DATA_RANGE');
    entries.push({name, offset, dataStart, compressed, size, checksum, method, flags}); cursor = recordEnd;
  }
  requireCheck(cursor === end, 'ZIP_CENTRAL_RANGE');
  for (const name of names) {
    const segments = name.split('/'); segments.pop();
    while (segments.length) {requireCheck(!names.has(segments.join('/')), 'ZIP_PATH_PREFIX'); segments.pop();}
  }
  const ordered = [...entries].sort((a, b) => a.offset - b.offset);
  requireCheck(ordered[0].offset === 0, 'ZIP_PREFIX_OR_GAP');
  ordered.forEach((entry, index) => {
    const dataEnd = entry.dataStart + entry.compressed, next = ordered[index + 1]?.offset ?? centralStart, gap = next - dataEnd;
    if (!(entry.flags & 8)) requireCheck(gap === 0, 'ZIP_OVERLAP_OR_GAP');
    else {
      requireCheck(gap === 12 || gap === 16, 'ZIP_DESCRIPTOR_RANGE');
      const start = dataEnd + (gap === 16 ? 4 : 0);
      if (gap === 16) requireCheck(bytes.readUInt32LE(dataEnd) === 0x08074b50, 'ZIP_DESCRIPTOR_SIGNATURE');
      requireCheck(bytes.readUInt32LE(start) === entry.checksum && bytes.readUInt32LE(start + 4) === entry.compressed && bytes.readUInt32LE(start + 8) === entry.size, 'ZIP_DESCRIPTOR_MISMATCH');
    }
  });
  return {entries, expandedBytes: total};
}

export function extractZip(input, limits = BUNDLE_LIMITS) {
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength), inspection = inspectZip(bytes, limits), files = Object.create(null);
  for (const entry of inspection.entries) {
    const compressed = bytes.subarray(entry.dataStart, entry.dataStart + entry.compressed);
    let output;
    if (entry.method === 0) output = Buffer.from(compressed);
    else {
      const result = inflateRawSync(compressed, {maxOutputLength: Math.max(1, entry.size), info: true});
      requireCheck(result.engine.bytesWritten === compressed.length, 'ZIP_TRAILING_DEFLATE'); output = result.buffer;
    }
    requireCheck(output.length === entry.size && crc32(output) === entry.checksum, 'ZIP_CONTENT_MISMATCH');
    files[entry.name] = new Uint8Array(output);
  }
  return {files, inspection};
}

export function parseArgs(args) {
  const options = {timeoutMs: 120000, renderSize: 1600, pdfinfo: 'pdfinfo', pdftoppm: 'pdftoppm'};
  const names = new Map([['--input', 'input'], ['--output', 'output'], ['--cache', 'cache'], ['--tectonic', 'tectonic'],
    ['--pdfinfo', 'pdfinfo'], ['--pdftoppm', 'pdftoppm'], ['--timeout-ms', 'timeoutMs'], ['--render-size', 'renderSize']]);
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const key = names.get(args[i]); requireCheck(key && !seen.has(key) && args[i + 1] && !args[i + 1].startsWith('--'), 'CLI_UNKNOWN_MISSING_OR_DUPLICATE_ARGUMENT');
    seen.add(key); const value = args[++i]; options[key] = ['timeoutMs', 'renderSize'].includes(key) ? Number(value) : value;
  }
  for (const key of ['input', 'output', 'cache', 'tectonic']) requireCheck(typeof options[key] === 'string' && options[key].length > 0, 'CLI_REQUIRED_' + key.toUpperCase());
  requireCheck(Number.isInteger(options.timeoutMs) && options.timeoutMs >= 1000 && options.timeoutMs <= 300000, 'CLI_TIMEOUT_RANGE');
  requireCheck(Number.isInteger(options.renderSize) && options.renderSize >= 400 && options.renderSize <= 2400, 'CLI_RENDER_SIZE_RANGE');
  return options;
}

async function regularBytes(path, maximum) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat(); requireCheck(before.isFile() && before.size <= maximum, 'FILE_TYPE_OR_SIZE');
    // Allocate only the bounded initial size; never readFile() a growing file.
    const bytes = Buffer.allocUnsafe(before.size); let position = 0;
    while (position < bytes.length) {
      const {bytesRead} = await handle.read(bytes, position, Math.min(65536, bytes.length - position), position);
      requireCheck(bytesRead > 0, 'FILE_CHANGED'); position += bytesRead;
    }
    const extra = await handle.read(Buffer.alloc(1), 0, 1, position), after = await handle.stat();
    requireCheck(extra.bytesRead === 0 && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs, 'FILE_CHANGED');
    return bytes;
  }
  finally {await handle.close();}
}
async function freshFile(path, bytes) {await writeFile(path, bytes, {flag: 'wx', mode: 0o600});}
async function writeFiles(directory, files) {
  for (const name of Object.keys(files).sort()) {safeName(name); const path = join(directory, name); await mkdir(dirname(path), {recursive: true, mode: 0o700}); await freshFile(path, files[name]);}
}
async function executable(name) {
  const candidates = isAbsolute(name) || name.includes(sep) ? [resolve(name)] : (process.env.PATH ?? '').split(sep === '/' ? ':' : ';').map(folder => join(folder, name));
  for (const candidate of candidates) {
    try {await access(candidate, constants.X_OK); const path = await realpath(candidate); requireCheck((await stat(path)).isFile(), 'TOOL_NOT_FILE'); return {path, sha256: hash(await regularBytes(path, 256 * 1024 ** 2))};}
    catch { /* Try the next explicit PATH entry, never install a tool. */ }
  }
  throw new Error('TOOL_NOT_AVAILABLE: ' + name);
}
function toolEnvironment(cache, epoch, scratch) {
  // No inherited TEXINPUTS, engine options, credentials or proxy configuration.
  const env = {PATH: dirname(process.execPath) + ':' + (process.env.PATH ?? ''), LANG: 'C', LC_ALL: 'C', TZ: 'UTC', TMPDIR: scratch};
  if (process.platform === 'win32' && process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  if (cache) env.TECTONIC_CACHE_DIR = cache;
  if (epoch !== undefined) env.SOURCE_DATE_EPOCH = String(epoch);
  return env;
}
async function runProcess(command, args, {cwd, env, timeoutMs, logPath}) {
  const log = await open(logPath, 'wx', 0o600); const chunks = []; let total = 0, failure, termination;
  return await new Promise((resolveRun, rejectRun) => {
    const grouped = process.platform !== 'win32';
    const child = spawn(command, args, {cwd, env, stdio: ['ignore', 'pipe', 'pipe'], shell: false, detached: grouped});
    const signal = value => {
      try {if (grouped && child.pid) process.kill(-child.pid, value); else child.kill(value);} catch { /* Already exited. */ }
    };
    const kill = reason => {
      failure ??= reason;
      if (termination) return;
      termination = new Promise(done => {
        signal('SIGTERM');
        setTimeout(() => {signal('SIGKILL'); done();}, 1000);
      });
    };
    const timer = setTimeout(() => kill('PROCESS_TIMEOUT'), timeoutMs);
    const receive = chunk => {
      if (total + chunk.length > LOCAL_LIMITS.maxLogBytes) {kill('PROCESS_LOG_LIMIT'); return;}
      total += chunk.length; chunks.push(Buffer.from(chunk));
    };
    child.stdout.on('data', receive); child.stderr.on('data', receive);
    child.once('error', error => {failure ??= 'PROCESS_SPAWN: ' + error.message;});
    child.once('close', async (exitCode, signal) => {
      clearTimeout(timer);
      // close concerns the leader and its pipes, not descendants with ignored
      // stdio. Keep group escalation alive and await it before scratch cleanup.
      try {if (termination) await termination;
        const output = Buffer.concat(chunks); await log.writeFile(output); await log.close();
        const result = {command, args, exitCode, signal, log: logPath, output: output.toString('utf8')};
        if (failure || exitCode !== 0) {const error = new Error(failure ?? 'PROCESS_EXIT_' + exitCode); error.processResult = result; rejectRun(error);} else resolveRun(result);
      } catch (error) {await log.close().catch(() => {}); rejectRun(error);}
    });
  });
}

// This source is generated by this checked-in tool, never read from the ZIP.
// Running verification in a child bounds Vite/emitter CPU and heap independently.
async function verificationWorker() {
  const {readFile, writeFile} = await import('node:fs/promises');
  const {join} = await import('node:path'); const {pathToFileURL} = await import('node:url');
  const {createRequire, isBuiltin} = await import('node:module'); const {createHash} = await import('node:crypto');
  const config = JSON.parse(process.argv[2]), require = createRequire(join(config.root, 'package.json'));
  const {build} = await import(pathToFileURL(require.resolve('vite')).href);
  const entry = join(config.root, 'apps/web/src/handout/bundle.ts');
  const result = await build({root: config.root, configFile: false, envDir: false, publicDir: false, cacheDir: join(config.scratch, 'vite-cache'), logLevel: 'warn',
    ssr: {target: 'node', noExternal: true}, build: {ssr: entry, target: 'es2023', write: false, minify: false,
      outDir: config.scratch, emptyOutDir: false, rolldownOptions: {output: {format: 'es', entryFileNames: 'verifier.mjs', codeSplitting: false}}}});
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output), chunks = outputs.filter(item => item.type === 'chunk');
  // Rolldown reports inlined dynamic imports as references to this same chunk.
  if (chunks.length !== 1 || outputs.length !== 1 || chunks[0].fileName !== 'verifier.mjs'
    || chunks[0].dynamicImports.some(name => name !== chunks[0].fileName) || chunks[0].imports.some(name => !isBuiltin(name))) {
    throw Error('VERIFIER_MUST_BE_ONE_TRUSTED_CHUNK: ' + JSON.stringify(outputs.map(item => ({type: item.type, fileName: item.fileName, imports: item.imports, dynamicImports: item.dynamicImports}))));
  }
  const artifact = join(config.provenance, 'verifier.mjs'); await writeFile(artifact, chunks[0].code, {flag: 'wx', mode: 0o600});
  const trusted = await import(pathToFileURL(artifact).href);
  for (const [key, value] of Object.entries(config.limits)) if (trusted.HANDOUT_BUNDLE_LIMITS?.[key] !== value) throw Error('VERIFIER_LIMITS_MISMATCH');
  const files = Object.create(null);
  for (const name of config.names) files[name] = new Uint8Array(await readFile(join(config.staged, name)));
  const verified = await trusted.verifyHandoutFiles(files);
  if (!(verified.mainTex instanceof Uint8Array) || !verified.mainTex.length || verified.mainTex.length > config.limits.maxFileBytes) throw Error('VERIFIER_CANONICAL_TEX_MISSING');
  await writeFile(join(config.scratch, 'canonical-main.tex'), verified.mainTex, {flag: 'wx', mode: 0o600});
  await writeFile(join(config.scratch, 'verified.json'), JSON.stringify({manifest: verified.manifest, warnings: verified.warnings,
    verifierSha256: createHash('sha256').update(chunks[0].code).digest('hex'), verifierEntrySha256: createHash('sha256').update(await readFile(entry)).digest('hex')}), {flag: 'wx', mode: 0o600});
}
async function verifyFiles(files, paths, checkoutRoot, timeoutMs) {
  const staged = join(paths.scratch, 'unverified'); await mkdir(staged, {mode: 0o700}); await writeFiles(staged, files);
  const runner = join(paths.scratch, 'verify-runner.mjs'); await freshFile(runner, verificationWorker.toString() + '\nawait verificationWorker();\n');
  await runProcess(process.execPath, ['--max-old-space-size=768', runner, JSON.stringify({root: checkoutRoot, staged,
    scratch: paths.scratch, provenance: paths.provenance, limits: BUNDLE_LIMITS, names: Object.keys(files)})],
  {cwd: paths.scratch, env: toolEnvironment(undefined, undefined, paths.scratch), timeoutMs, logPath: join(paths.logs, 'verify.log')});
  const result = JSON.parse((await regularBytes(join(paths.scratch, 'verified.json'), 4 * 1024 ** 2)).toString('utf8'));
  requireCheck(result.manifest?.format === 'ardesia-handout-bundle-v1' && typeof result.manifest.buildId === 'string' && /^[A-Za-z0-9._:-]{1,200}$/.test(result.manifest.buildId), 'VERIFIER_MANIFEST_INVALID');
  const date = result.manifest.createdAt;
  requireCheck(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(date) && Number.isFinite(Date.parse(date)) && Date.parse(date) >= 0, 'VERIFIER_DATE_INVALID');
  requireCheck(Array.isArray(result.warnings) && result.warnings.length <= 1000 && result.warnings.every(w => typeof w === 'string' && w.length <= 10000), 'VERIFIER_WARNINGS_INVALID');
  const mainTex = await regularBytes(join(paths.scratch, 'canonical-main.tex'), BUNDLE_LIMITS.maxFileBytes);
  requireCheck(mainTex.length > 0, 'VERIFIER_CANONICAL_TEX_MISSING');
  return {...result, mainTex, sourceDateEpoch: Math.floor(Date.parse(date) / 1000)};
}
async function copyCache(source, destination) {
  const entries = []; let total = 0, directories = 0;
  async function visit(folder, depth = 0) {
    requireCheck(++directories <= LOCAL_LIMITS.maxCacheDirectories && depth <= LOCAL_LIMITS.maxCacheDepth, 'CACHE_DIRECTORY_LIMIT');
    for (const entry of (await readdir(folder, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const path = join(folder, entry.name), info = await lstat(path);
      requireCheck(!info.isSymbolicLink() && (info.isFile() || info.isDirectory()), 'CACHE_SPECIAL_FILE');
      if (info.isDirectory()) await visit(path, depth + 1);
      else {
        requireCheck(entries.length < LOCAL_LIMITS.maxCacheFiles && total + info.size <= LOCAL_LIMITS.maxCacheBytes, 'CACHE_LIMIT');
        const bytes = await regularBytes(path, LOCAL_LIMITS.maxCacheBytes - total); total += bytes.length;
        entries.push({path: relative(source, path).split(sep).join('/'), bytes: bytes.length, sha256: hash(bytes)});
      }
    }
  }
  await visit(source); requireCheck(entries.length > 0, 'CACHE_EMPTY');
  await mkdir(destination, {mode: 0o700});
  // Copy only inventoried files, never late additions or directory symlinks.
  for (const entry of entries) {
    const bytes = await regularBytes(join(source, entry.path), entry.bytes);
    requireCheck(bytes.length === entry.bytes && hash(bytes) === entry.sha256, 'CACHE_CHANGED');
    const target = join(destination, entry.path); await mkdir(dirname(target), {recursive: true, mode: 0o700}); await freshFile(target, bytes);
  }
  return {source, bytes: total, files: entries.length, directories, sha256: hash(JSON.stringify(entries)), entries};
}
async function inventory(directory, prefix = '') {
  const files = [];
  for (const entry of (await readdir(directory, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const name = prefix + entry.name, path = join(directory, entry.name), info = await lstat(path);
    requireCheck(!info.isSymbolicLink(), 'OUTPUT_SYMLINK');
    if (info.isDirectory()) files.push(...await inventory(path, name + '/'));
    else {requireCheck(info.isFile(), 'OUTPUT_SPECIAL_FILE'); files.push({path: name, bytes: info.size, sha256: hash(await regularBytes(path, BUNDLE_LIMITS.maxTotalBytes))});}
  }
  return files;
}

/** CLI callers cannot substitute a verifier. The second parameter is for isolated
 * integration fixtures owned by a trusted caller; no corresponding CLI flag exists.
 */
export async function compileHandout(options, {checkoutRoot = ROOT} = {}) {
  requireCheck(Number(process.versions.node.split('.')[0]) === 24, 'NODE_24_REQUIRED');
  const requestedOutput = resolve(options.output), output = join(await realpath(dirname(requestedOutput)), requestedOutput.split(sep).at(-1));
  const cacheSource = await realpath(options.cache);
  requireCheck((await stat(cacheSource)).isDirectory() && !inside(cacheSource, output), 'CACHE_OUTPUT_OVERLAP');
  await mkdir(output, {mode: 0o700}); // Atomic reservation: never reuse or overwrite a destination.
  const paths = Object.fromEntries(['source', 'compiled', 'rendered', 'logs', 'provenance', 'scratch'].map(name => [name, join(output, name === 'scratch' ? '.scratch' : name)]));
  const report = {format: 'ardesia-handout-build-report-v1', status: 'failed', startedAt: new Date().toISOString(),
    input: resolve(options.input), output, node: process.versions.node, stage: 'initialization', limits: {...BUNDLE_LIMITS, ...LOCAL_LIMITS},
    commands: [], warnings: [], manualReviewRequired: true,
    limitations: ['No operating-system sandbox is asserted. Tectonic --untrusted and verified regeneration are distinct safeguards.',
      'Rendering all pages is a mechanical check, not a scientific, pedagogical or accessibility approval. No ASR, AI or OCR is performed.']};
  try {
    for (const path of Object.values(paths)) await mkdir(path, {mode: 0o700});
    report.stage = 'zip-preflight';
    const zip = await regularBytes(resolve(options.input), BUNDLE_LIMITS.maxZipBytes); report.inputSha256 = hash(zip);
    const {files, inspection} = extractZip(zip); report.archive = {entries: inspection.entries.length, expandedBytes: inspection.expandedBytes};
    requireCheck(Object.hasOwn(files, 'main.tex') && Object.hasOwn(files, 'source.json') && Object.hasOwn(files, 'manifest.json'), 'BUNDLE_REQUIRED_FILES');
    report.stage = 'trusted-regeneration';
    const verified = await verifyFiles(files, paths, await realpath(checkoutRoot), options.timeoutMs);
    report.manifest = {format: verified.manifest.format, buildId: verified.manifest.buildId, createdAt: verified.manifest.createdAt};
    report.warnings.push(...verified.warnings); report.sourceDateEpoch = verified.sourceDateEpoch;
    report.verifier = {entry: 'apps/web/src/handout/bundle.ts', entrySha256: verified.verifierEntrySha256, artifactSha256: verified.verifierSha256};
    report.tex = {receivedSha256: hash(files['main.tex']), regeneratedSha256: hash(verified.mainTex), compiled: 'regenerated'};
    files['main.tex'] = new Uint8Array(verified.mainTex); await writeFiles(paths.source, files);
    await rm(join(paths.scratch, 'unverified'), {recursive: true, force: true});
    report.stage = 'toolchain';
    report.cache = await copyCache(cacheSource, join(paths.scratch, 'cache'));
    const env = toolEnvironment(join(paths.scratch, 'cache'), verified.sourceDateEpoch, paths.scratch);
    const tools = {tectonic: await executable(options.tectonic), pdfinfo: await executable(options.pdfinfo), pdftoppm: await executable(options.pdftoppm)};
    report.tools = tools;
    for (const [name, tool] of Object.entries(tools)) {
      const result = await runProcess(tool.path, [name === 'tectonic' ? '--version' : '-v'], {cwd: output, env, timeoutMs: 10000, logPath: join(paths.logs, name + '-version.log')});
      tool.version = result.output.trim().slice(0, 4000);
    }
    const run = async (name, args, cwd, label) => {
      const command = {tool: name, argv: args, cwd: relative(output, cwd), log: 'logs/' + label + '.log'}; report.commands.push(command);
      try {const result = await runProcess(tools[name].path, args, {cwd, env, timeoutMs: options.timeoutMs, logPath: join(paths.logs, label + '.log')}); command.exitCode = result.exitCode; return result;}
      catch (error) {command.exitCode = error.processResult?.exitCode ?? null; command.failure = error.message; throw error;}
    };
    report.stage = 'tectonic';
    await run('tectonic', ['--only-cached', '--untrusted', '--keep-logs', '--outdir', paths.compiled, 'main.tex'], paths.source, 'tectonic');
    const pdf = join(paths.compiled, 'main.pdf'), pdfBytes = await regularBytes(pdf, BUNDLE_LIMITS.maxFileBytes);
    requireCheck(pdfBytes.subarray(0, 5).toString('ascii') === '%PDF-', 'COMPILED_PDF_MISSING');
    const texLog = await regularBytes(join(paths.compiled, 'main.log'), LOCAL_LIMITS.maxLogBytes);
    report.layoutWarnings = texLog.toString('utf8').split(/\r?\n/).filter(line => /Overfull \\[hv]box|Underfull \\[hv]box|Missing character:|LaTeX Warning:/.test(line)).slice(0, 1000);
    report.stage = 'pdf-inspection';
    const info = await run('pdfinfo', [pdf], output, 'pdfinfo'), match = info.output.match(/^Pages:\s+(\d+)\s*$/m);
    requireCheck(match, 'PDF_PAGE_COUNT_MISSING'); const pageCount = Number(match[1]);
    requireCheck(pageCount > 0 && pageCount <= LOCAL_LIMITS.maxPages, 'PDF_PAGE_LIMIT'); report.pageCount = pageCount;
    report.stage = 'render-all-pages'; let renderedBytes = 0; report.pages = [];
    for (let page = 1; page <= pageCount; page++) {
      const name = 'page-' + String(page).padStart(4, '0'), prefix = join(paths.rendered, name);
      await run('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-scale-to', String(options.renderSize), '-png', pdf, prefix], output, name);
      const png = await regularBytes(prefix + '.png', BUNDLE_LIMITS.maxFileBytes);
      requireCheck(png.length >= 33 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && png.toString('ascii', 12, 16) === 'IHDR', 'RENDER_PNG_INVALID');
      const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
      requireCheck(width > 0 && height > 0 && width <= options.renderSize && height <= options.renderSize, 'RENDER_DIMENSION_LIMIT');
      renderedBytes += png.length; requireCheck(renderedBytes <= LOCAL_LIMITS.maxRenderedBytes, 'RENDER_TOTAL_LIMIT');
      report.pages.push({page, path: 'rendered/' + name + '.png', width, height, bytes: png.length, sha256: hash(png)});
    }
    report.pdf = {path: 'compiled/main.pdf', bytes: pdfBytes.length, sha256: hash(pdfBytes)};
    report.stage = 'complete'; report.status = 'succeeded';
  } catch (error) {report.error = {stage: report.stage, message: error instanceof Error ? error.message : String(error)};}
  finally {
    await rm(paths.scratch, {recursive: true, force: true});
    try {report.files = await inventory(output);} catch (error) {report.status = 'failed'; report.error = {stage: 'inventory', message: error.message};}
    report.completedAt = new Date().toISOString(); await freshFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--help')) {
    console.log('Usage: node tools/compile-handout.mjs --input bundle.zip --output NEW_DIRECTORY --cache EXISTING_TECTONIC_CACHE --tectonic TECTONIC_BINARY [--pdfinfo BINARY] [--pdftoppm BINARY] [--timeout-ms 120000] [--render-size 1600]\nRequires Node 24 and the trusted verifier in this checkout. No installation, network fallback or overwrite. Inspect report.json and every rendered page.');
  } else {
    try {const report = await compileHandout(parseArgs(process.argv.slice(2))); console.log(JSON.stringify({status: report.status, report: join(report.output, 'report.json'), pdf: report.pdf?.path, error: report.error})); if (report.status !== 'succeeded') process.exitCode = 1;}
    catch (error) {console.error(error.message); process.exitCode = 1;}
  }
}
