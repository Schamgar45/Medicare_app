import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          const normalizedId = id.replace(/\\/g, '/');

          if (normalizedId.includes('/node_modules/recharts/')) return 'charts';
          if (
            /\/node_modules\/(?:react|react-dom|react-router|react-router-dom|@tanstack\/react-query|axios)(?:\/|$)/.test(
              normalizedId,
            )
          ) {
            return 'vendor';
          }
        },
      },
    },
  },
});
