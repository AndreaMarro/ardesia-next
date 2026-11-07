import {expect, test} from 'vitest';
import {build} from 'vite';

test('the real browser entry uses one Preact runtime without React, ReactDOM or scheduler', async () => {
  // Build the actual entry and config, not an alias-only fixture. No dist writes.
  const result = await build({configFile: 'apps/web/vite.config.ts', logLevel: 'silent', build: {write: false, minify: false}});
  if (Array.isArray(result) || !('output' in result)) throw Error('Expected one application build');
  const modules = result.output.flatMap(item => item.type === 'chunk' ? Object.keys(item.modules) : []);
  expect(modules.some(id => /node_modules[\/]preact[\/]dist[\/]/.test(id))).toBe(true);
  expect(modules.some(id => /node_modules[\/]preact[\/]compat[\/]/.test(id))).toBe(true);
  const preactRoots = new Set(modules.flatMap(id => id.match(/^(.*node_modules[\/]preact)[\/]/)?.[1] ?? []));
  expect(preactRoots.size).toBe(1);
  expect(modules.filter(id => /node_modules[\/](?:react|react-dom|scheduler|lucide-react|preact-render-to-string)[\/]/.test(id))).toEqual([]);
}, 30_000);
