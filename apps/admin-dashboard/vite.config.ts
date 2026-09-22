import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // 127.0.0.1 rather than localhost: Node may resolve localhost to ::1, and the
  // backend listens on IPv4 only, which would turn every /api call into a 502.
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000';

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      // Same-origin /api in dev means cookies work without any CORS configuration.
      proxy: {
        '/api': { target: apiProxyTarget, changeOrigin: true },
      },
    },
  };
});
