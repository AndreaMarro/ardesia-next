import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {uiRuntimeAliases} from '../../tools/ui-runtime.mjs';
import deploymentConfig from '../../vercel.json' with {type: 'json'};
const previewHeaders = Object.fromEntries(deploymentConfig.headers.flatMap(block => block.headers.map(header => [header.key, header.value])));
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {alias: uiRuntimeAliases},
  build: {
    assetsInlineLimit: 0, // Keep bundled fonts on-origin under font-src 'self'.
    manifest: true, target: 'es2022', minify: 'terser', modulePreload: {polyfill: false},
    terserOptions: {ecma: 2022, safari10: false, compress: {passes: 3, reduce_funcs: false, sequences: false, join_vars: false}, format: {comments: false, ascii_only: true}},
    rolldownOptions: {output: {
      charset: 'ascii', minify: {compress: {target: 'es2022'}, mangle: true},
      codeSplitting: {groups: [
        {name: 'math', test: /node_modules[\\/]katex[\\/]/, priority: 10},
        {name: 'foundation', test: /packages[\\/](?:contracts|remote-client)[\\/]|node_modules[\\/](?:preact|zod)[\\/]/},
      ]},
    }},
    sourcemap: false, chunkSizeWarningLimit: 450,
  },
  server: {port: 5173, strictPort: true},
  preview: {port: 4173, strictPort: true, headers: previewHeaders}
});
