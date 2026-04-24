import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    server: {
      host: '0.0.0.0',
      port: 5200,
      strictPort: true,
      open: false,
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
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
