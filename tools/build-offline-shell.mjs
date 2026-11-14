import {readFileSync, readdirSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function buildOfflineShell(build) {
  const root = 'apps/web/dist';
  const assets = readdirSync(root + '/assets').filter(file => /\.(?:m?js|css|woff2?|ttf)$/.test(file)).map(file => '/assets/' + file).sort();
  if (!assets.some(file => file.endsWith('.js')) || !assets.some(file => file.endsWith('.css'))) throw Error('Offline shell requires the real built UI.');
  const walk = dir => readdirSync(root+dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
  const pdfAssets=existsSync(root+'/pdf-runtime')?walk('/pdf-runtime'):[];
  const paths = ['/', ...assets, ...pdfAssets, '/build-info.json'];
  // Store the same 32 SHA-256 bytes compactly; every asset still gets checked.
  const digests = Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(root + (path === '/' ? '/index.html' : path))).digest('base64')]));
  const shellDigest = createHash('sha256').update(JSON.stringify(digests)).digest('hex');
  const source = readFileSync('apps/web/offline-worker.js', 'utf8')
    .replace('__ARDESIA_CACHE_NAME__', JSON.stringify('ardesia-shell-' + build.sourceDigest + '-' + shellDigest))
    .replace('__ARDESIA_SHELL_DIGESTS__', JSON.stringify(digests));
  writeFileSync(root + '/sw.js', source);
}
