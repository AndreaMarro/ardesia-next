import {readdirSync, readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {PROGRAM_BUDGET,programBudgetTotals,programBudgetMatches} from './program-budget.mjs';
import {identity} from './evidence.mjs';
function javascriptFiles(dir) {return readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? javascriptFiles(`${dir}/${entry.name}`) : (/\.(?:m?js|wasm)$/.test(entry.name)||dir.includes('/pdf-runtime')) ? [`${dir}/${entry.name}`] : []);}
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
const files = assets.map(name => ({file: name.slice('apps/web/dist/'.length), rawBytes:readFileSync(name).byteLength,gzipBytes: gzipSync(readFileSync(name)).byteLength}));
if ([...initialFiles].some(file => !files.some(asset => asset.file === file))) throw Error('Initial JavaScript is missing from the distributed files.');
const totals=programBudgetTotals(files);
const initialJavaScriptGzipBytes=files.filter(file=>initialFiles.has(file.file)).reduce((sum,file)=>sum+file.gzipBytes,0);
const report={...identity(),metric:'core-and-optional-runtimes-v3',...totals,limits:PROGRAM_BUDGET,
  initialJavaScriptGzipBytes,deferredJavaScriptGzipBytes:totals.allJavaScriptGzipBytes-initialJavaScriptGzipBytes,
  previous320KiBCoreComparison:{bytes:totals.coreGzipBytes,limit:327680,passed:totals.coreGzipBytes<=327680},
  previous312KiBCoreComparison:{bytes:totals.coreGzipBytes,limit:319488,passed:totals.coreGzipBytes<=319488},
  previous304KiBCoreComparison:{bytes:totals.coreGzipBytes,limit:311296,passed:totals.coreGzipBytes<=311296},
  previous272KiBCoreComparison:{bytes:totals.coreGzipBytes,limit:278528,passed:totals.coreGzipBytes<=278528},
  previousCoreComparison:{metric:'all-non-program-assets-gzip',bytes:totals.coreGzipBytes+totals.pdfGzipBytes,limit:245760,passed:totals.coreGzipBytes+totals.pdfGzipBytes<=245760},
  legacyComparison:{metric:'all-javascript-gzip-bytes',bytes:totals.allJavaScriptGzipBytes,limit:245760,passed:totals.allJavaScriptGzipBytes<=245760},
  loadingMetric:'Static module graph; runtime network deferral is tested separately. No existing asset is reclassified as optional. All JS and WASM raw/gzip costs are retained.',
  files:files.map(file=>({...file,initial:initialFiles.has(file.file)})),physicalPerformanceTest:'NOT_RUN'};
report.passed=programBudgetMatches(report);
mkdirSync('artifacts', {recursive: true}); writeFileSync('artifacts/budget.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({coreGzipBytes:report.coreGzipBytes,optionalGzipBytes:report.optionalGzipBytes,allGzipBytes:report.allGzipBytes,limits:report.limits,legacyComparison:report.legacyComparison,passed:report.passed}));
if(!report.passed)process.exit(1);

