import {defineConfig} from 'vitest/config';
import {uiRuntimeAliases} from './tools/ui-runtime.mjs';
export default defineConfig({
  resolve: {alias: uiRuntimeAliases},
  // WASM deadline probes and real PostgreSQL fixtures share this host. Avoid CPU
  // contention between files; keep their existing time and resource assertions.
  test: {include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'plugins/**/*.test.ts'], environment: 'node', reporters: ['default'], clearMocks: true, fileParallelism: false},
});

