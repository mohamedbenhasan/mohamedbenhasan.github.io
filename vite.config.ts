import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL || ''),
        'process.env.APP_URL': JSON.stringify(process.env.APP_URL || env.APP_URL || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
