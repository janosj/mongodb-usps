import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ports come from the single root .env, so nothing is hardcoded in the UI code.
// The UI calls /api/... and /feed/... and this proxy forwards them.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const backend = `http://localhost:${env.PORT || 5001}`;
  const feed = `http://localhost:${env.FEED_PORT || 5003}`;
  return {
    plugins: [react()],
    server: {
      port: Number(env.FRONTEND_PORT || 3000),
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/feed': { target: feed, changeOrigin: true, rewrite: (p) => p.replace(/^\/feed/, '') },
      },
    },
  };
});
