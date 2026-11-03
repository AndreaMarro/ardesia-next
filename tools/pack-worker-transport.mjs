import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const header = 'ARDESIA-WORKER-PARTS/1\n';
/** Only the web output is packed. Source/signatures and server verification assets stay original. */
export function packWorkerTransport(root = 'apps/web/dist') {
  const catalog = JSON.parse(readFileSync(join(root, 'plugins/catalog.json'), 'utf8'));
  const entries = catalog.entries.filter(e => e.kind === 'plugin');
  const inputs = [...new Map(entries.map(e => [e.bundlePath, e])).values()].map(e => {
    if (!/^\/plugins\/[a-zA-Z0-9._/-]+\.js$/.test(e.bundlePath) || e.bundlePath.includes('..')) throw Error('Invalid worker artifact path');
    const bytes = readFileSync(join(root, e.bundlePath.slice(1)));
    if (!bytes.length || bytes.length > 512_000) throw Error('Worker exceeds the transport byte limit');
    if (sha(bytes) !== e.manifest.integrity.digest) throw Error('Worker does not match its original signed digest');
    return {path:e.bundlePath, bytes};
  });
  if (inputs.length < 2) return;
  let prefix = 0;
  while (inputs.every(x => prefix < x.bytes.length && x.bytes[prefix] === inputs[0].bytes[prefix])) prefix++;
  if (!prefix) throw Error('No common worker prefix');
  const container = Buffer.concat([inputs[0].bytes, ...inputs.slice(1).map(x => x.bytes.subarray(prefix))]);
  if (container.length > 512_000) throw Error('Shared worker container exceeds the decoder byte limit');
  const path = '/plugins/shared/' + sha(container) + '.js';
  const outputs = []; let cursor = inputs[0].bytes.length;
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i], start = i === 0 ? prefix : cursor, length = input.bytes.length - prefix;
    const ranges = [[0, prefix], [start, length]];
    const reconstructed = Buffer.concat(ranges.map(([offset, size]) => container.subarray(offset, offset+size)));
    if (!reconstructed.equals(input.bytes)) throw Error('Byte reconstruction changed a signed worker');
    const bytes = Buffer.from(header + JSON.stringify({path,byteLength:input.bytes.length,ranges}));
    if (bytes.length > 2_048) throw Error('Worker descriptor exceeds the decoder byte limit');
    outputs.push({path:input.path,bytes,originalSha256:sha(input.bytes),originalBytes:input.bytes.length});
    if (i > 0) cursor += length;
  }
  const before = inputs.reduce((n,x)=>n+gzipSync(x.bytes).length,0);
  const after = gzipSync(container).length + outputs.reduce((n,x)=>n+gzipSync(x.bytes).length,0);
  if (after >= before) throw Error('Worker transport does not reduce the unchanged total gzip metric');
  mkdirSync(join(root,'plugins/shared'),{recursive:true});writeFileSync(join(root,path.slice(1)),container);
  for (const output of outputs) writeFileSync(join(root,output.path.slice(1)),output.bytes);
  mkdirSync('artifacts',{recursive:true});
  writeFileSync('artifacts/bundle-transport.json',JSON.stringify({kind:'lossless-worker-byte-transport',prefixBytes:prefix,beforeGzipBytes:before,afterGzipBytes:after,
    container:{path,bytes:container.length,sha256:sha(container)},workers:outputs.map(({bytes,...x})=>x),
    gate:'Every descriptor and the complete shared payload retain .js paths and remain charged by the existing total gzip gate; no asset excluded.'},null,2)+'\n');
}
