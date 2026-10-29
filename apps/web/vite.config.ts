import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import deploymentConfig from '../../vercel.json' with {type: 'json'};
const previewHeaders = Object.fromEntries(deploymentConfig.headers.flatMap(block => block.headers.map(header => [header.key, header.value])));
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 450},
  server: {port: 5173, strictPort: true},
  preview: {port: 4173, strictPort: true, headers: previewHeaders}
});
