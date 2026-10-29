import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 450},
  server: {port: 5173, strictPort: true},
  preview: {port: 4173, strictPort: true}
});
