import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Vite 8 (Rolldown) : `manualChunks` objet a été remplacé par `advancedChunks.groups`.
        advancedChunks: {
          groups: [
            { name: 'charts', test: /node_modules[\\/]recharts/ },
            {
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|@tanstack[\\/]react-query|axios)/,
            },
          ],
        },
      },
    },
  },
});
