import {describe, it, expect} from 'vitest';
import {bundleTransportHeader, decodeBundleTransport} from './bundle-transport';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPluginHost, firstPartyTrust} from '@ardesia/plugin-host';
import {packWorkerTransport} from '../../../../tools/pack-worker-transport.mjs';
const encode = (d: unknown) => new TextEncoder().encode(bundleTransportHeader + JSON.stringify(d));
const path = '/plugins/shared/' + 'a'.repeat(64) + '.js';
const valid = () => ({path, byteLength: 4, ranges: [[0, 2], [4, 2]]});
describe('first-party byte transport, before mandatory Host verification', () => {
  it('roundtrips both real signed releases through the packer/decoder/Host and refuses altered shared bytes', async () => {
    const directory = mkdtempSync(join(tmpdir(),'ardesia-byte-transport-'));
    try {
      const catalog = JSON.parse(readFileSync('apps/web/public/plugins/catalog.json','utf8'));
      mkdirSync(join(directory,'plugins'),{recursive:true});writeFileSync(join(directory,'plugins/catalog.json'),JSON.stringify(catalog));
      const plugins = catalog.entries.filter((entry: {kind: string}) => entry.kind === 'plugin');
      for (const entry of plugins) {const target=join(directory,entry.bundlePath.slice(1));mkdirSync(join(target,'..'),{recursive:true});writeFileSync(target,readFileSync('apps/web/public'+entry.bundlePath));}
      packWorkerTransport(directory);
      const host = createPluginHost({trustStore:firstPartyTrust.trustStore,policy:{allowlist:firstPartyTrust.allowlist,capabilities:['state:read','state:write'],maxBundleBytes:512_000,timeoutMs:5_000}});
      for (const entry of plugins) {
        const descriptor=new Uint8Array(readFileSync(join(directory,entry.bundlePath.slice(1))));
        const read=async (path: string) => new Uint8Array(readFileSync(join(directory,path.slice(1))));
        const bundle=await decodeBundleTransport(descriptor,read);
        expect(bundle).toEqual(new Uint8Array(readFileSync('apps/web/public'+entry.bundlePath)));
        expect((await host.verify({manifest:entry.manifest,bundle})).integrity.digest).toBe(entry.manifest.integrity.digest);
        const altered=await decodeBundleTransport(descriptor,async path=>{const bytes=await read(path);bytes[0]=bytes[0]!^1;return bytes;});
        await expect(host.verify({manifest:entry.manifest,bundle:altered})).rejects.toMatchObject({code:'INTEGRITY_MISMATCH'});
      }
    } finally {rmSync(directory,{recursive:true,force:true});}
  });
  it('retains raw legacy bytes and reconstructs exact ordered byte ranges', async () => {
    const original = new Uint8Array([0, 255, 12]);
    expect(await decodeBundleTransport(original, async () => {throw Error('must not read');})).toBe(original);
    expect(await decodeBundleTransport(encode(valid()), async (p, maximum) => {
      expect(p).toBe(path); expect(maximum).toBe(512_000); return new Uint8Array([0, 255, 99, 98, 12, 13]);
    })).toEqual(new Uint8Array([0, 255, 12, 13]));
  });
  it('rejects foreign/traversal paths, unknown fields and unbounded or inconsistent ranges before fetching', async () => {
    const cases = [{...valid(), path:'https://example.test/code.js'}, {...valid(), path:'/plugins/shared/../code.js'},
      {...valid(), extra:true}, {...valid(), byteLength:512_001}, {...valid(), ranges:[[0, 512_000], [1, 1]]},
      {...valid(), ranges:[[0, 1.5], [4, 2.5]]}, {...valid(), ranges:[[0, -1], [4, 5]]}, {...valid(), ranges:[[0, 2]]}];
    for (const d of cases) await expect(decodeBundleTransport(encode(d), async () => {throw Error('unexpected fetch');})).rejects.toThrow('INVALID_BUNDLE_TRANSPORT');
  });
  it('rejects a truncated or oversized container and malformed descriptor', async () => {
    await expect(decodeBundleTransport(encode(valid()), async () => new Uint8Array(5))).rejects.toThrow('INVALID_BUNDLE_TRANSPORT');
    await expect(decodeBundleTransport(encode(valid()), async () => new Uint8Array(512_001))).rejects.toThrow('INVALID_BUNDLE_TRANSPORT');
    await expect(decodeBundleTransport(new TextEncoder().encode(bundleTransportHeader+'{'), async () => new Uint8Array())).rejects.toThrow('INVALID_BUNDLE_TRANSPORT');
  });
});
