import {readdirSync, readFileSync, statSync, mkdirSync, writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {identity} from './evidence.mjs';
function javascriptFiles(dir) {return readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? javascriptFiles(`${dir}/${entry.name}`) : entry.name.endsWith('.js') ? [`${dir}/${entry.name}`] : []);}
const assets = javascriptFiles('apps/web/dist');
const bytes = assets.reduce((total, name) => total + gzipSync(readFileSync(name)).byteLength, 0);
const limit = 240 * 1024;
const report = {...identity(), metric: 'all-javascript-gzip-bytes', bytes, limit, passed: bytes <= limit, physicalPerformanceTest: 'NOT_RUN'};
mkdirSync('artifacts', {recursive: true}); writeFileSync('artifacts/budget.json', JSON.stringify(report, null, 2));
console.log(`JavaScript gzip: ${Math.round(bytes / 1024)} KiB / ${limit / 1024} KiB budget.`);
if(bytes > limit) process.exit(1);

