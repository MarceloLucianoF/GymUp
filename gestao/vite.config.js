import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true, fs: { allow: ['..'] } },   // permite importar shared/ (contratos) de fora da pasta
  build: { target: 'es2020', chunkSizeWarningLimit: 400 },
  test: { environment: 'node' }
});
