import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Pinned so the port never drifts: Vite silently moves to 5174 when 5173 is
    // taken, which quietly breaks anything registered against a fixed origin.
    port: 5173,
    strictPort: true,
    // Proxying /api keeps every request same-origin from the browser's point of
    // view, so the backend needs no CORS configuration.
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});
