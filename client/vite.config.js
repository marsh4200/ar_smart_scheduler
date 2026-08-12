import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:3010',
      '/photos': 'http://localhost:3010',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Two pages sharing one build: the till/admin app, and the customer-
    // facing online ordering page (served on its own port by the server).
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        shop: resolve(__dirname, 'shop.html'),
      },
    },
  },
});
