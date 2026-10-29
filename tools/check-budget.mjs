import {readdirSync, readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {identity} from './evidence.mjs';
function javascriptFiles(dir) {return readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? javascriptFiles(`${dir}/${entry.name}`) : entry.name.endsWith('.js') ? [`${dir}/${entry.name}`] : []);}
const assets = javascriptFiles('apps/web/dist');
const manifest = JSON.parse(readFileSync('apps/web/dist/.vite/manifest.json', 'utf8'));
const initialFiles = new Set();
const visited = new Set();
function initial(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const entry = manifest[key];
  if (!entry) throw Error('Build manifest references a missing initial module.');
  if (entry.file.endsWith('.js')) initialFiles.add(entry.file);
  for (const imported of entry.imports ?? []) initial(imported);
}
for (const [key, entry] of Object.entries(manifest)) if (entry.isEntry) initial(key);
if (!initialFiles.size) throw Error('Build manifest has no initial JavaScript entry.');
const files = assets.map(name => ({file: name.slice('apps/web/dist/'.length), gzipBytes: gzipSync(readFileSync(name)).byteLength}));
if ([...initialFiles].some(file => !files.some(asset => asset.file === file))) throw Error('Initial JavaScript is missing from the distributed files.');
const bytes = files.reduce((total, file) => total + file.gzipBytes, 0);
const initialJavaScriptGzipBytes = files.filter(file => initialFiles.has(file.file)).reduce((total, file) => total + file.gzipBytes, 0);
const limit = 240 * 1024;
const report = {...identity(), metric: 'all-javascript-gzip-bytes', bytes, limit, passed: bytes <= limit,
  initialJavaScriptGzipBytes, deferredJavaScriptGzipBytes: bytes - initialJavaScriptGzipBytes,
  loadingMetric: 'Static entry/import graph; deferred code remains included in the total gate; not a measured network trace',
  files: files.map(file => ({...file, initial: initialFiles.has(file.file)})), physicalPerformanceTest: 'NOT_RUN'};
mkdirSync('artifacts', {recursive: true}); writeFileSync('artifacts/budget.json', JSON.stringify(report, null, 2));
console.log(`JavaScript gzip: ${Math.round(bytes / 1024)} KiB / ${limit / 1024} KiB budget.`);
if(bytes > limit) process.exit(1);

