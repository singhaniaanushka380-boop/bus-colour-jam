import { defineConfig } from 'vite';

// Relative base keeps every asset path valid on Vercel (root domain) and on sub-path hosts.
export default defineConfig({
  base: './',
  // HMR is pinned to localhost so the live-reload WebSocket does not break behind VPNs/proxies/IPv6 quirks.
  // To test on a phone, run: npm run dev -- --host
  server: { port: 5173, hmr: { host: 'localhost' } },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2018',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Phaser is large and rarely changes: keep it in its own long-cached chunk.
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
});
