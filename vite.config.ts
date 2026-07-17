import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const macProxyTarget = (env.VITE_MAC_PROXY_TARGET || 'https://api.amlak-app.com').replace(/\/+$/, '');
  const ollamaTarget = (env.VITE_LOCAL_AI_PROXY_TARGET || 'http://127.0.0.1:11434').replace(/\/+$/, '');

  const ollamaProxy = {
    '/ollama': {
      target: ollamaTarget,
      changeOrigin: true,
      secure: false,
      rewrite: (p: string) => p.replace(/^\/ollama/, '') || '/',
    },
  };

  return {
    base: './',
    server: {
      host: '0.0.0.0',
      // Default 5220 so another app can keep using 5200 on the same machine.
      port: Number(env.VITE_DEV_SERVER_PORT) || 5220,
      strictPort: true,
      open: false,
      // Same-origin /api → Mac Mini; /ollama → local Ollama (avoids localhost vs 127.0.0.1 CORS).
      proxy: {
        '/api': {
          target: macProxyTarget,
          changeOrigin: true,
          secure: true,
          ws: true,
        },
        ...ollamaProxy,
      },
    },
    preview: {
      proxy: {
        ...ollamaProxy,
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          owner: path.resolve(__dirname, 'owner.html'),
          main: path.resolve(__dirname, 'index.html'),
          tenant: path.resolve(__dirname, 'tenant.html'),
        },
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      dedupe: ['react', 'react-dom', 'firebase', '@firebase/app', '@firebase/firestore', '@firebase/auth'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
