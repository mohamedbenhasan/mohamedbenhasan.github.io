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
      const downloadTitle = 'Télécharger l’application VruGuard pour Android (APK) | VruGuard';
      const downloadDesc =
        'Téléchargez l’application de sécurité routière VruGuard (VRU Guard Sentinel) pour Android : carte interactive des incidents, alertes routières, signalement des dangers et assistance SOS.';
      const downloadUrl = 'https://www.vruguard.me/download';

      const downloadJsonLd = JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': 'https://www.vruguard.me/#organization',
              name: 'VruGuard',
              alternateName: 'VRUGuard',
              url: 'https://www.vruguard.me/',
              email: 'support@vruguard.me',
              logo: {
                '@type': 'ImageObject',
                url: 'https://www.vruguard.me/favicon-192x192.png',
                width: 192,
                height: 192,
              },
            },
            {
              '@type': 'WebSite',
              '@id': 'https://www.vruguard.me/#website',
              name: 'VruGuard',
              alternateName: 'VRUGuard',
              url: 'https://www.vruguard.me/',
              inLanguage: 'fr',
              publisher: {
                '@id': 'https://www.vruguard.me/#organization',
              },
            },
            {
              '@type': 'SoftwareApplication',
              '@id': `${downloadUrl}#software`,
              name: 'VRU Guard Sentinel',
              alternateName: 'VruGuard Android',
              operatingSystem: 'Android',
              applicationCategory: 'NavigationApplication',
              inLanguage: 'fr',
              url: downloadUrl,
              description: downloadDesc,
              publisher: {
                '@id': 'https://www.vruguard.me/#organization',
              },
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'EUR',
              },
            },
          ],
        },
        null,
        2
      );

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
        )
        .replace(
          /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
          `<script type="application/ld+json">\n${downloadJsonLd}\n    </script>`
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
