import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function staticDownloadRouteSeoPlugin(): Plugin {
  return {
    name: 'vruguard-static-download-route',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const indexHtmlPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexHtmlPath)) return;

      const baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');
      const downloadTitle = 'Télécharger VRU Guard Sentinel pour Android | VruGuard';
      const downloadDesc =
        'Téléchargez l’application Android officielle VRU Guard Sentinel (APK) : carte temps réel, navigation sécurisée, alertes de risque et assistance SOS.';
      const downloadUrl = 'https://www.vruguard.me/download';

      const downloadHtml = baseHtml
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${downloadTitle}</title>`)
        .replace(
          /<meta name="description" content="[^"]*"\s*\/?>/i,
          `<meta name="description" content="${downloadDesc}" />`
        )
        .replace(
          /<link rel="canonical" href="[^"]*"\s*\/?>/i,
          `<link rel="canonical" href="${downloadUrl}" />`
        )
        .replace(
          /<meta property="og:url" content="[^"]*"\s*\/?>/i,
          `<meta property="og:url" content="${downloadUrl}" />`
        )
        .replace(
          /<meta property="og:title" content="[^"]*"\s*\/?>/i,
          `<meta property="og:title" content="${downloadTitle}" />`
        )
        .replace(
          /<meta property="og:description" content="[^"]*"\s*\/?>/i,
          `<meta property="og:description" content="${downloadDesc}" />`
        )
        .replace(
          /<meta name="twitter:title" content="[^"]*"\s*\/?>/i,
          `<meta name="twitter:title" content="${downloadTitle}" />`
        )
        .replace(
          /<meta name="twitter:description" content="[^"]*"\s*\/?>/i,
          `<meta name="twitter:description" content="${downloadDesc}" />`
        );

      fs.writeFileSync(path.join(distDir, 'download.html'), downloadHtml, 'utf8');
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), staticDownloadRouteSeoPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY),
        'process.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL || ''),
        'process.env.APP_URL': JSON.stringify(process.env.APP_URL || env.APP_URL || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        include: [
          'firebase/app',
          'firebase/auth',
          'firebase/firestore',
          'firebase/storage',
        ],
      },
    };
});
