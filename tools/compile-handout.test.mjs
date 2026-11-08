import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {crc32, deflateRawSync} from 'node:zlib';
import {setTimeout as delay} from 'node:timers/promises';
import {BUNDLE_LIMITS, compileHandout, extractZip, inspectZip, parseArgs} from './compile-handout.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const dependencies = resolve(process.env.ARDESIA_HANDOUT_TEST_DEPENDENCIES ?? ROOT);
const require = createRequire(join(dependencies, 'package.json'));
const fflate = require('fflate');
const work = resolve(process.env.ARDESIA_HANDOUT_TEST_WORK ?? join(ROOT, 'work/handout-builder-tests'));
await mkdir(work, {recursive: true});
const temporary = await mkdtemp(join(work, 'run-'));
after(async () => {await rm(temporary, {recursive: true, force: true});});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const asBytes = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));

// Deliberately tiny test fixture writer. Production ZIP inflation uses Node zlib;
// interoperability is also checked against fflate's real browser exporter below.
function archive(entries, {prefix = Buffer.alloc(0), gap = Buffer.alloc(0)} = {}) {
  const locals = [prefix], centrals = []; let offset = prefix.length;
  for (const item of entries) {
    const name = Buffer.from(item.name), data = Buffer.from(item.data ?? 'fixture'), method = item.method ?? 0;
    const compressed = item.compressed ?? (method === 8 ? deflateRawSync(data) : data);
    const size = item.size ?? data.length, compressedSize = item.compressedSize ?? compressed.length;
    const checksum = item.checksum ?? crc32(data), flags = item.flags ?? (item.descriptor ? 8 : 0);
    const needed = item.needed ?? 20, extra = item.extra ?? Buffer.alloc(0);
    const local = Buffer.alloc(30 + name.length + extra.length);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(needed, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8);
    if (!(flags & 8)) {local.writeUInt32LE(checksum, 14); local.writeUInt32LE(compressedSize, 18); local.writeUInt32LE(size, 22);}
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(extra.length, 28); name.copy(local, 30); extra.copy(local, 30 + name.length);
    const descriptor = Buffer.alloc(item.descriptor ?? 0);
    if (descriptor.length) {
      const start = descriptor.length === 16 ? 4 : 0;
      if (start) descriptor.writeUInt32LE(0x08074b50);
      descriptor.writeUInt32LE(checksum, start); descriptor.writeUInt32LE(compressedSize, start + 4); descriptor.writeUInt32LE(size, start + 8);
    }
    const central = Buffer.alloc(46 + name.length + extra.length);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(0x0314, 4); central.writeUInt16LE(needed, 6); central.writeUInt16LE(flags, 8); central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16); central.writeUInt32LE(compressedSize, 20); central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt16LE(extra.length, 30); central.writeUInt32LE(item.attributes ?? 0, 38); central.writeUInt32LE(offset, 42);
    name.copy(central, 46); extra.copy(central, 46 + name.length);
    locals.push(local, compressed, descriptor, gap); centrals.push(central); offset += local.length + compressed.length + descriptor.length + gap.length;
  }
  const central = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}
const centralStart = bytes => bytes.readUInt32LE(bytes.length - 6);
const small = [{name: 'source.json', data: '{}'}, {name: 'main.tex', data: 'ignored'}, {name: 'manifest.json', data: '{}'}];

test('classic stored, deflated and both data descriptors round-trip', () => {
  for (const method of [0, 8]) for (const descriptor of [0, 12, 16]) {
    const input = archive([{name: 'source.json', data: 'A bounded fixture', method, descriptor}, {name: 'assets/x.png', data: '', method, descriptor}]);
    const {files, inspection} = extractZip(input);
    assert.equal(inspection.entries.length, 2); assert.equal(inspection.expandedBytes, 17);
    assert.equal(Buffer.from(files['source.json']).toString(), 'A bounded fixture'); assert.equal(files['assets/x.png'].length, 0);
    assert.equal(Object.getPrototypeOf(files), null);
  }
});

test('real fflate async stored and deflated exports, plus streaming descriptors, are accepted', async () => {
  const source = {'source.json': asBytes('{"title":"Test"}'), 'main.tex': asBytes('plain text')};
  for (const level of [0, 6]) {
    const bytes = await new Promise((resolveZip, reject) => fflate.zip(source, {level, mtime: new Date('2000-01-01T00:00:00Z')}, (error, result) => error ? reject(error) : resolveZip(result)));
    assert.deepEqual(Object.keys(extractZip(bytes).files).sort(), Object.keys(source).sort());
    if (!level) assert.ok(inspectZip(bytes).entries.every(entry => entry.method === 0));
  }
  const bytes = await new Promise((resolveZip, reject) => {
    const chunks = [], writer = new fflate.Zip((error, chunk, final) => {
      if (error) return reject(error); chunks.push(chunk); if (final) resolveZip(Buffer.concat(chunks));
    });
    const file = new fflate.ZipPassThrough('main.tex'); writer.add(file); file.push(asBytes('streaming'), true); writer.end();
  });
  assert.ok(inspectZip(bytes).entries[0].flags & 8);
  assert.equal(Buffer.from(extractZip(bytes).files['main.tex']).toString(), 'streaming');
});

test('unsafe, aliased and platform-reserved paths are rejected before extraction', () => {
  for (const name of ['../x', '/absolute', 'C:/escape', 'a\\b', 'a//b', './x', 'a/..', 'x.', 'é.txt', 'NUL.tex', 'a/COM1', 'a/file:stream', 'a\0b']) {
    assert.throws(() => inspectZip(archive([{name}])), /ZIP_(UNSAFE|RESERVED)_PATH/, name);
  }
  for (const names of [['a', 'a'], ['A.tex', 'a.tex']]) assert.throws(() => inspectZip(archive(names.map(name => ({name})))), /ZIP_DUPLICATE_PATH/);
  assert.throws(() => inspectZip(archive([{name: 'assets'}, {name: 'assets/x.png'}])), /ZIP_PATH_PREFIX/);
  assert.throws(() => inspectZip(archive([{name: 'Assets'}, {name: 'assets/x.png'}])), /ZIP_PATH_PREFIX/);
  assert.equal(Buffer.from(extractZip(archive([{name: 'constructor', data: 'safe'}])).files.constructor).toString(), 'safe');
});

test('links, directories, encryption, unsupported codecs, ZIP64 and volume flags fail closed', () => {
  for (const attributes of [0xa0000000, 0x40000000, 0x10000000, 0x10]) assert.throws(() => inspectZip(archive([{name: 'x', attributes}])), /ZIP_SPECIAL_FILE/);
  for (const flags of [1, 0x40, 0x2000, 2]) assert.throws(() => inspectZip(archive([{name: 'x', flags}])), /ZIP_METHOD_OR_FLAGS/);
  assert.throws(() => inspectZip(archive([{name: 'x', method: 12}])), /ZIP_METHOD_OR_FLAGS/);
  assert.throws(() => inspectZip(archive([{name: 'x', needed: 45}])), /ZIP64_UNSUPPORTED/);
  for (const kind of [0x0001, 0x7075, 0x9901]) {
    const extra = Buffer.alloc(4); extra.writeUInt16LE(kind);
    assert.throws(() => inspectZip(archive([{name: 'x', extra}])), /ZIP_UNSUPPORTED_EXTRA/);
  }
  const bytes = archive([{name: 'x'}]); bytes.writeUInt16LE(1, bytes.length - 18);
  assert.throws(() => inspectZip(bytes), /ZIP_MULTIVOLUME/);
  const sentinel = archive([{name: 'x'}]); sentinel.writeUInt32LE(0xffffffff, centralStart(sentinel) + 24);
  assert.throws(() => inspectZip(sentinel), /ZIP64_UNSUPPORTED/);
});

test('mismatched headers, descriptors, prefix, gap, overlap and truncated records are rejected', () => {
  const mismatch = archive([{name: 'a'}]); mismatch.writeUInt16LE(8, 8);
  assert.throws(() => inspectZip(mismatch), /ZIP_LOCAL_MISMATCH/);
  const renamed = archive([{name: 'a'}]); renamed[centralStart(renamed) + 46] = 'b'.charCodeAt(0);
  assert.throws(() => inspectZip(renamed), /ZIP_LOCAL_NAME/);
  const descriptor = archive([{name: 'a', descriptor: 16}]); descriptor[centralStart(descriptor) - 16] = 0;
  assert.throws(() => inspectZip(descriptor), /ZIP_DESCRIPTOR_SIGNATURE/);
  const checksum = archive([{name: 'a', descriptor: 12}]); checksum[centralStart(checksum) - 12] ^= 1;
  assert.throws(() => inspectZip(checksum), /ZIP_DESCRIPTOR_MISMATCH/);
  assert.throws(() => inspectZip(archive([{name: 'a'}], {prefix: Buffer.from('x')})), /ZIP_PREFIX_OR_GAP/);
  assert.throws(() => inspectZip(archive([{name: 'a'}], {gap: Buffer.from('x')})), /ZIP_OVERLAP_OR_GAP/);
  assert.throws(() => inspectZip(archive([{name: 'a', data: 'x', size: 33, compressedSize: 33}, {name: 'b'}])), /ZIP_OVERLAP_OR_GAP/);
  const valid = archive([{name: 'x'}]);
  for (const cut of [1, 21, valid.length - 1]) assert.throws(() => inspectZip(valid.subarray(0, cut)), /ZIP_/);
  assert.throws(() => inspectZip(Buffer.concat([valid, Buffer.from('trailing')])), /ZIP_END_MISSING/);
});

test('CRC, inflated size and unconsumed compressed bytes are verified after bounded inflate', () => {
  assert.throws(() => extractZip(archive([{name: 'x', checksum: 0}])), /ZIP_CONTENT_MISMATCH/);
  assert.throws(() => extractZip(archive([{name: 'x', method: 8, checksum: 0}])), /ZIP_CONTENT_MISMATCH/);
  assert.throws(() => extractZip(archive([{name: 'x', data: 'a'.repeat(500), method: 8, size: 1}])), error => error.code === 'ERR_BUFFER_TOO_LARGE');
  assert.throws(() => extractZip(archive([{name: 'x', data: 'a', method: 8, size: 2}])), /ZIP_CONTENT_MISMATCH/);
  const compressed = Buffer.concat([deflateRawSync(asBytes('abc')), Buffer.from('extra')]);
  assert.throws(() => extractZip(archive([{name: 'x', data: 'abc', method: 8, compressed}])), /ZIP_TRAILING_DEFLATE/);
});

test('entry, archive, file, expansion-ratio and total budgets reject before decompression', () => {
  const bytes = archive([{name: 'a', data: 'four'}, {name: 'b', data: 'four'}]);
  for (const [override, error] of [[{maxEntries: 1}, 'ZIP_ENTRY_LIMIT'], [{maxZipBytes: 22}, 'ZIP_SIZE_LIMIT'], [{maxFileBytes: 3}, 'ZIP_FILE_LIMIT'], [{maxTotalBytes: 7}, 'ZIP_TOTAL_LIMIT']]) {
    assert.throws(() => inspectZip(bytes, {...BUNDLE_LIMITS, ...override}), new RegExp(error));
  }
  assert.throws(() => inspectZip(archive([{name: 'a', data: 'a'.repeat(1000), method: 8}]), {...BUNDLE_LIMITS, maxRatio: 2}), /ZIP_RATIO_LIMIT/);
  assert.throws(() => inspectZip(archive([])), /ZIP_ENTRY_LIMIT/);
  assert.throws(() => inspectZip(archive([{name: 'a', data: 'x', size: 2}])), /ZIP_STORED_SIZE/);
});

test('CLI requires explicit toolchain, new output and bounded options with no verifier override', () => {
  const args = ['--input', 'bundle.zip', '--output', 'new', '--cache', 'cache', '--tectonic', 'tectonic'];
  assert.equal(parseArgs(args).timeoutMs, 120000); assert.equal(parseArgs(args).renderSize, 1600);
  for (const suffix of [['--input', 'again'], ['--verifier', '/untrusted'], ['--unknown', 'x'], ['--render-size'], ['--timeout-ms', '999'], ['--timeout-ms', '300001'], ['--render-size', '399'], ['--render-size', '2401'], ['--render-size', 'NaN']]) {
    assert.throws(() => parseArgs([...args, ...suffix]), /CLI_/);
  }
  assert.throws(() => parseArgs(args.slice(0, -2)), /CLI_REQUIRED_TECTONIC/);
});

async function fixture({tex = 'CANONICAL_SAFE_TEX', verifier = 'pass', pdfPages = 2, pngWidth = 1, limitMismatch = false} = {}) {
  const root = await mkdtemp(join(temporary, 'checkout-')), entry = join(root, 'apps/web/src/handout');
  await mkdir(entry, {recursive: true}); await writeFile(join(root, 'package.json'), '{"type":"module"}');
  await symlink(join(dependencies, 'node_modules'), join(root, 'node_modules'), 'dir');
  await writeFile(join(root, 'vite.config.ts'), 'throw Error("UNTRUSTED_CONFIG_LOADED");');
  await writeFile(join(root, '.env'), 'VITE_HANDOUT_SECRET=must-not-be-loaded\n');
  const verifierBody = verifier === 'reject' ? 'throw Error("FIXTURE_REJECTED");' : verifier === 'hang' ? 'await new Promise(() => setInterval(() => {}, 100));' : '';
  await writeFile(join(entry, 'bundle.ts'), `
    export const HANDOUT_BUNDLE_LIMITS = ${JSON.stringify({...BUNDLE_LIMITS, ...(limitMismatch ? {maxEntries: 3} : {})})};
    export async function unusedExporter() {return (await import('fflate')).zipSync({});}
    export async function verifyHandoutFiles(files) {
      if (import.meta.env.VITE_HANDOUT_SECRET || process.env.HANDOUT_PARENT_SECRET || process.env.TEXINPUTS) throw Error('ENV_LEAKED');
      ${verifierBody}
      return {manifest: {format: 'ardesia-handout-bundle-v1', buildId: 'fixture-001', createdAt: '2026-11-07T00:00:00Z'}, warnings: ['Synthetic fixture'], mainTex: new TextEncoder().encode(${JSON.stringify(tex)})};
    }
  `);
  const cache = join(root, 'donor-cache'), bin = join(root, 'bin');
  await mkdir(join(cache, 'nested'), {recursive: true}); await mkdir(bin);
  await writeFile(join(cache, 'nested/donor'), 'immutable-cache');
  const helperPath = join(bin, 'ignore-term-helper.mjs');
  await writeFile(helperPath, `
    import {existsSync, writeFileSync} from 'node:fs';
    import {join} from 'node:path';
    const [scratch, proof] = process.argv.slice(2);
    process.on('SIGTERM', () => writeFileSync(join(proof, 'helper-term'), 'ignored'));
    writeFileSync(join(proof, 'helper-ready'), String(process.pid));
    setInterval(() => {
      if (!existsSync(scratch)) writeFileSync(join(proof, 'cleanup-while-alive'), String(Date.now()));
    }, 5);
  `);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
  const scripts = {
    tectonic: `
      if (process.argv.includes('--version')) {console.log('tectonic fixture 1'); process.exit(0);}
      const args = process.argv.slice(2), output = args[args.indexOf('--outdir') + 1];
      const tex = await fs.readFile('main.tex', 'utf8');
      await fs.writeFile(path.join(output, 'observed.json'), JSON.stringify({args, tex, env: process.env, cwd: process.cwd()}));
      await fs.writeFile(path.join(process.env.TECTONIC_CACHE_DIR, 'private-mutation'), 'private only');
      console.log('fixture compiler started');
      if (tex.includes('FAIL_TECTONIC')) process.exit(3);
      if (tex.includes('DESCENDANT_TIMEOUT')) {
        const {spawn} = await import('node:child_process');
        const {writeFileSync} = await import('node:fs');
        const proof = path.join(output, 'descendant'); await fs.mkdir(proof);
        const helper = spawn(process.execPath, [${JSON.stringify(helperPath)}, process.env.TMPDIR, proof], {stdio: 'ignore'});
        await fs.writeFile(path.join(proof, 'spawned.json'), JSON.stringify({leaderPid: process.pid, helperPid: helper.pid}));
        process.on('SIGTERM', () => {writeFileSync(path.join(proof, 'leader-term'), 'exited immediately'); process.exit(0);});
        await new Promise(() => setInterval(() => {}, 100));
      }
      if (tex.includes('TIMEOUT_TECTONIC')) await new Promise(() => setInterval(() => {}, 100));
      await fs.writeFile(path.join(output, 'main.pdf'), '%PDF-1.7\\nsynthetic-fixture');
      await fs.writeFile(path.join(output, 'main.log'), 'Overfull \\\\hbox (2pt too wide)\\nLaTeX Warning: synthetic warning\\n');
    `,
    pdfinfo: `if (process.argv.includes('-v')) {console.error('pdfinfo fixture 1'); process.exit(0);} console.log('Pages: ${pdfPages}');`,
    pdftoppm: `if (process.argv.includes('-v')) {console.error('pdftoppm fixture 1'); process.exit(0);} const png = Buffer.from(${JSON.stringify(png)}, 'base64'); png.writeUInt32BE(${pngWidth}, 16); await fs.writeFile(process.argv.at(-1) + '.png', png);`
  };
  const binaries = {};
  for (const [name, script] of Object.entries(scripts)) {
    binaries[name] = join(bin, name); await writeFile(binaries[name], '#!/usr/bin/env node\n' + "import * as fs from 'node:fs/promises'; import * as path from 'node:path';\n" + script); await chmod(binaries[name], 0o700);
  }
  const input = join(root, 'input.zip'); await writeFile(input, archive(small));
  return {root, input, cache, options: {input, output: join(root, 'build'), cache, ...binaries, timeoutMs: 10000, renderSize: 800}};
}
const build = item => compileHandout(item.options, {checkoutRoot: item.root});

test('isolated pipeline compiles only regenerated TeX, sanitizes env, keeps cache intact and renders every page', async () => {
  const item = await fixture(), donor = await readFile(join(item.cache, 'nested/donor'));
  const inherited = {HANDOUT_PARENT_SECRET: process.env.HANDOUT_PARENT_SECRET, TEXINPUTS: process.env.TEXINPUTS};
  process.env.HANDOUT_PARENT_SECRET = 'do-not-inherit'; process.env.TEXINPUTS = '/untrusted';
  let report;
  try {report = await build(item);} finally {for (const [key, value] of Object.entries(inherited)) if (value === undefined) delete process.env[key]; else process.env[key] = value;}
  assert.equal(report.status, 'succeeded', JSON.stringify(report.error)); assert.equal(report.stage, 'complete');
  const observed = JSON.parse(await readFile(join(item.options.output, 'compiled/observed.json')));
  assert.equal(observed.tex, 'CANONICAL_SAFE_TEX'); assert.notEqual(report.tex.receivedSha256, report.tex.regeneratedSha256);
  assert.deepEqual(observed.args.slice(0, 3), ['--only-cached', '--untrusted', '--keep-logs']); assert.equal(observed.args.at(-1), 'main.tex');
  assert.equal(observed.env.SOURCE_DATE_EPOCH, '1794009600'); assert.equal(observed.env.HANDOUT_PARENT_SECRET, undefined); assert.equal(observed.env.TEXINPUTS, undefined);
  assert.equal(observed.env.NODE_OPTIONS, undefined); assert.equal(observed.env.HOME, undefined);
  assert.ok(observed.env.TECTONIC_CACHE_DIR.startsWith(item.options.output + '/.scratch/'));
  assert.deepEqual(await readFile(join(item.cache, 'nested/donor')), donor); assert.deepEqual(await readdir(item.cache), ['nested']);
  assert.equal(report.cache.files, 1); assert.equal(report.cache.entries[0].sha256, hash(donor));
  assert.equal(report.pages.length, 2); assert.deepEqual(report.pages.map(page => page.page), [1, 2]);
  assert.ok(report.commands.some(command => command.tool === 'pdftoppm' && command.argv[1] === '2'));
  assert.equal(report.layoutWarnings.length, 2); assert.equal(report.manualReviewRequired, true);
  assert.equal(report.pdf.sha256, hash(await readFile(join(item.options.output, report.pdf.path))));
  assert.equal(report.verifier.artifactSha256, hash(await readFile(join(item.options.output, 'provenance/verifier.mjs'))));
  assert.equal((await readdir(item.options.output)).includes('.scratch'), false);
  assert.equal(JSON.parse(await readFile(join(item.options.output, 'report.json'))).status, 'succeeded');
});

test('verifier rejection and limit mismatch prevent any compiler invocation and retain failures', async () => {
  for (const variant of [{verifier: 'reject'}, {limitMismatch: true}]) {
    const item = await fixture(variant), report = await build(item);
    assert.equal(report.status, 'failed'); assert.equal(report.error.stage, 'trusted-regeneration');
    assert.deepEqual(report.commands, []); assert.deepEqual(await readdir(join(item.options.output, 'compiled')), []);
    const log = await readFile(join(item.options.output, 'logs/verify.log'), 'utf8');
    assert.match(log, variant.limitMismatch ? /VERIFIER_LIMITS_MISMATCH/ : /FIXTURE_REJECTED/);
    assert.equal((await readdir(item.options.output)).includes('.scratch'), false);
  }
});

test('missing bundle files and bad CRC fail in preflight without launching verification or compiler', async () => {
  for (const bytes of [archive([{name: 'source.json', data: '{}'}]), archive([{name: 'source.json', checksum: 0}])]) {
    const item = await fixture(); await writeFile(item.input, bytes); const report = await build(item);
    assert.equal(report.status, 'failed'); assert.equal(report.error.stage, 'zip-preflight');
    assert.deepEqual(await readdir(join(item.options.output, 'logs')), []);
  }
});

test('output reservation refuses an existing directory and canonical cache overlap', async () => {
  const item = await fixture(); await mkdir(item.options.output); await writeFile(join(item.options.output, 'keep'), 'unchanged');
  await assert.rejects(() => build(item), {code: 'EEXIST'});
  assert.equal(await readFile(join(item.options.output, 'keep'), 'utf8'), 'unchanged');
  const alias = join(item.root, 'cache-alias'); await symlink(item.cache, alias, 'dir'); item.options.output = join(alias, 'new-build');
  await assert.rejects(() => build(item), /CACHE_OUTPUT_OVERLAP/); assert.equal((await readdir(item.cache)).includes('new-build'), false);
});

test('cache symlinks are rejected and compiler failure records the exit code and logs', async () => {
  const unsafe = await fixture(); await symlink(join(unsafe.cache, 'nested/donor'), join(unsafe.cache, 'link'));
  const rejected = await build(unsafe); assert.equal(rejected.error.stage, 'toolchain'); assert.match(rejected.error.message, /CACHE_SPECIAL_FILE/);
  assert.deepEqual(rejected.commands, []);
  const failed = await fixture({tex: 'FAIL_TECTONIC'}), report = await build(failed);
  assert.equal(report.error.stage, 'tectonic'); assert.equal(report.commands[0].exitCode, 3); assert.equal(report.commands[0].failure, 'PROCESS_EXIT_3');
  assert.match(await readFile(join(failed.options.output, 'logs/tectonic.log'), 'utf8'), /fixture compiler started/);
  assert.equal((await readdir(failed.options.output)).includes('.scratch'), false);
});

test('verifier and compiler timeouts stop owned children and preserve a failure report', async () => {
  for (const variant of [{verifier: 'hang'}, {tex: 'TIMEOUT_TECTONIC'}]) {
    const item = await fixture(variant); item.options.timeoutMs = 1000;
    const start = performance.now(), report = await build(item);
    assert.equal(report.status, 'failed'); assert.equal(report.error.message, 'PROCESS_TIMEOUT');
    assert.equal(report.error.stage, variant.verifier ? 'trusted-regeneration' : 'tectonic');
    assert.ok(performance.now() - start < 10000); assert.equal((await readdir(item.options.output)).includes('.scratch'), false);
  }
});

test('timeout kills a TERM-ignoring descendant after leader close and before scratch cleanup', {skip: process.platform === 'win32'}, async t => {
  const item = await fixture({tex: 'DESCENDANT_TIMEOUT'}); item.options.timeoutMs = 1500;
  const proof = join(item.options.output, 'compiled/descendant'), scratch = join(item.options.output, '.scratch');
  const pending = build(item), observed = {}; let pids;
  const alive = pid => {try {process.kill(pid, 0); return true;} catch (error) {if (error.code === 'ESRCH') return false; throw error;}};
  const until = async (predicate, timeout = 5000) => {
    const deadline = performance.now() + timeout;
    while (!predicate()) {assert.ok(performance.now() < deadline, 'Timed out waiting for owned fixture process'); await delay(10);}
  };
  try {
    await until(() => existsSync(join(proof, 'spawned.json')) && existsSync(join(proof, 'helper-ready')));
    pids = JSON.parse(await readFile(join(proof, 'spawned.json')));
    const groups = execFileSync('/bin/ps', ['-o', 'pid=,pgid=', '-p', pids.leaderPid + ',' + pids.helperPid], {encoding: 'utf8'})
      .trim().split('\n').map(line => line.trim().split(/\s+/).map(Number));
    assert.equal(groups.length, 2); assert.ok(groups.every(([, pgid]) => pgid === pids.leaderPid));
    observed.sameOwnedGroup = true;
    await until(() => existsSync(join(proof, 'leader-term')) && existsSync(join(proof, 'helper-term')));
    observed.helperAliveAfterLeaderTerm = alive(pids.helperPid);
    observed.scratchAfterLeaderTerm = existsSync(scratch);
    const report = await pending; await delay(100);
    observed.cleanupWhileHelperAlive = existsSync(join(proof, 'cleanup-while-alive'));
    observed.helperAliveAfterBuild = alive(pids.helperPid); observed.scratchAfterBuild = existsSync(scratch);
    assert.equal(report.error.message, 'PROCESS_TIMEOUT'); assert.equal(report.error.stage, 'tectonic');
    assert.equal(report.commands[0].exitCode, 0, 'Leader exits immediately from its SIGTERM handler');
    assert.equal(observed.helperAliveAfterLeaderTerm, true, 'Helper received and ignored SIGTERM');
    assert.equal(observed.scratchAfterLeaderTerm, true, 'Scratch must remain during group escalation');
    assert.equal(observed.cleanupWhileHelperAlive, false, 'Descendant observed scratch removal while still alive');
    assert.equal(observed.helperAliveAfterBuild, false, 'Descendant survived the completed timeout');
    assert.equal(observed.scratchAfterBuild, false);
  } finally {
    // A RED run must never leak the deliberately stubborn helper.
    pids ??= await readFile(join(proof, 'spawned.json')).then(bytes => JSON.parse(bytes)).catch(() => undefined);
    if (pids) {
      if (alive(pids.helperPid)) {observed.emergencyCleanupRequired = true; try {process.kill(-pids.leaderPid, 'SIGKILL');} catch {} try {process.kill(pids.helperPid, 'SIGKILL');} catch {}}
      await until(() => !alive(pids.helperPid), 3000); observed.helperGoneAfterCleanup = true;
    }
    await pending;
    t.diagnostic(JSON.stringify({pids, ...observed}));
  }
});

test('page count and renderer dimensions enforce the post-compile bounds', async () => {
  const pages = await fixture({pdfPages: 251}), pageReport = await build(pages);
  assert.equal(pageReport.error.stage, 'pdf-inspection'); assert.equal(pageReport.error.message, 'PDF_PAGE_LIMIT');
  assert.ok(pageReport.commands.every(command => command.tool !== 'pdftoppm'));
  const dimensions = await fixture({pngWidth: 801}), dimensionReport = await build(dimensions);
  assert.equal(dimensionReport.error.stage, 'render-all-pages'); assert.equal(dimensionReport.error.message, 'RENDER_DIMENSION_LIMIT');
});
